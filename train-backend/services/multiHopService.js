const path = require('path');
const { searchTrains, humanDelay } = require('./confirmTktService');

// Load junction data
const allJunctions = require(path.join(__dirname, '..', 'data', 'junctions.json'));

// ===========================================================================
// GEOGRAPHIC UTILITIES
// ===========================================================================

const EARTH_RADIUS_KM = 6371;
const DEG_TO_RAD = Math.PI / 180;

/**
 * Haversine distance between two lat/lng points in kilometres.
 */
function haversineDistance(lat1, lng1, lat2, lng2) {
    const dLat = (lat2 - lat1) * DEG_TO_RAD;
    const dLng = (lng2 - lng1) * DEG_TO_RAD;

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * DEG_TO_RAD) * Math.cos(lat2 * DEG_TO_RAD) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return EARTH_RADIUS_KM * c;
}

/**
 * Approximate perpendicular distance (km) from point P to the great-circle
 * line defined by points A and B.
 *
 * Uses a flat-earth projection (accurate enough for corridor filtering within
 * India's latitude range).  Projects P onto the AB vector, then computes the
 * orthogonal component via Haversine.
 */
function perpendicularDistance(pLat, pLng, aLat, aLng, bLat, bLng) {
    // Convert everything to a local Cartesian frame centred on A.
    // x = lng direction, y = lat direction (scaled by cos(avgLat))
    const avgLat = ((aLat + bLat) / 2) * DEG_TO_RAD;
    const cosLat = Math.cos(avgLat);

    const ax = 0, ay = 0;
    const bx = (bLng - aLng) * cosLat;
    const by = (bLat - aLat);
    const px = (pLng - aLng) * cosLat;
    const py = (pLat - aLat);

    const abLenSq = bx * bx + by * by;
    if (abLenSq === 0) {
        // A and B are the same point — distance from P to A
        return haversineDistance(pLat, pLng, aLat, aLng);
    }

    // Projection of AP onto AB  (clamped to [0,1] so we measure distance to
    // the *segment*, but for corridor filtering we intentionally do NOT clamp
    // — we handle the "beyond endpoints" check separately).
    const t = (px * bx + py * by) / abLenSq;

    // Closest point on the infinite AB line
    const closestX = ax + t * bx;
    const closestY = ay + t * by;

    // Convert the offset back to degrees and then to km via Haversine
    const closestLat = aLat + closestY;
    const closestLng = aLng + closestX / cosLat;

    return haversineDistance(pLat, pLng, closestLat, closestLng);
}

// ===========================================================================
// GEOGRAPHIC CORRIDOR FILTER
// ===========================================================================

/**
 * Filter junctions to those within the geographic corridor between source
 * and destination.
 *
 * The corridor is defined by two constraints:
 *   1. Perpendicular distance from the junction to the src→dest line
 *      must be ≤ max(150 km, 35% of direct distance).
 *   2. The junction must not be farther than 20% past either endpoint
 *      along the src→dest axis.
 *
 * Junctions too close to either endpoint (< 40 km) are also excluded to
 * avoid degenerate "hop" scenarios.
 *
 * Results are sorted by distance from source (progressive corridor).
 */
function getCorridorJunctions(srcLat, srcLng, dstLat, dstLng) {
    const directDist = haversineDistance(srcLat, srcLng, dstLat, dstLng);
    const maxPerp = Math.max(150, directDist * 0.35);   // km
    const maxBeyond = directDist * 0.2;                   // km past endpoints
    const minProximity = 40;                              // km from endpoints

    const filtered = [];

    for (const j of allJunctions) {
        const perpDist = perpendicularDistance(
            j.lat, j.lng, srcLat, srcLng, dstLat, dstLng
        );
        if (perpDist > maxPerp) continue;

        const dToSrc = haversineDistance(j.lat, j.lng, srcLat, srcLng);
        const dToDest = haversineDistance(j.lat, j.lng, dstLat, dstLng);

        // Skip junctions too close to either endpoint
        if (dToSrc < minProximity || dToDest < minProximity) continue;

        // Skip junctions that are way past both endpoints
        if (dToSrc > directDist + maxBeyond && dToDest > directDist + maxBeyond) {
            continue;
        }

        filtered.push({
            ...j,
            distFromSrc: dToSrc,
            distFromDest: dToDest,
            perpDist
        });
    }

    // Sort by distance from source so we scan geographically progressively
    filtered.sort((a, b) => a.distFromSrc - b.distFromSrc);
    return filtered;
}

// ===========================================================================
// TIME / DATE UTILITIES
// ===========================================================================

/**
 * Parse "HH:MM" to minutes since midnight.  Returns null on bad input.
 */
function parseTime(timeStr) {
    if (!timeStr || typeof timeStr !== 'string') return null;
    const parts = timeStr.split(':');
    if (parts.length < 2) return null;
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (isNaN(h) || isNaN(m)) return null;
    return h * 60 + m;
}

/**
 * Parse duration — could be a number (minutes), or "Xh Ym" style string.
 */
function parseDuration(duration) {
    if (typeof duration === 'number') return duration;
    if (!duration || typeof duration !== 'string') return 0;

    const hMatch = duration.match(/(\d+)\s*h/i);
    const mMatch = duration.match(/(\d+)\s*m/i);
    if (hMatch || mMatch) {
        return (parseInt(hMatch?.[1] || '0', 10) * 60) +
               parseInt(mMatch?.[1] || '0', 10);
    }
    const num = parseInt(duration, 10);
    return isNaN(num) ? 0 : num;
}

/**
 * Increment a "YYYY-MM-DD" date string by N days.
 */
function addDays(dateStr, days) {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + days);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

// ===========================================================================
// LAYOVER / CONNECTION LOGIC
// ===========================================================================

const DEFAULT_MIN_LAYOVER = 30;   // minutes
const MAX_LAYOVER = 12 * 60;      // 12 hours

/**
 * Calculate layover in minutes between arrival of legA and departure of legB.
 * `nextDay` = true means legB departs the next calendar day.
 * Returns -1 on invalid/unparseable times.
 */
function calculateLayover(arrivalTime, departureTime, nextDay = false) {
    const arrMins = parseTime(arrivalTime);
    const depMins = parseTime(departureTime);
    if (arrMins === null || depMins === null) return -1;

    let layover = depMins - arrMins;
    if (nextDay) {
        layover += 24 * 60;
    } else if (layover < 0) {
        layover += 24 * 60; // departure past midnight same calendar day
    }
    return layover;
}

// ===========================================================================
// TRAIN DATA HELPERS
// ===========================================================================

/**
 * Find the cheapest *bookable* class from availabilityCache.
 * Returns { cls, fare } or { cls: null, fare: 0 }.
 */
function getCheapestAvailable(availabilityCache) {
    if (!availabilityCache || typeof availabilityCache !== 'object') {
        return { cls: null, fare: 0 };
    }

    let cheapest = null;
    let cheapestFare = Infinity;

    for (const [cls, data] of Object.entries(availabilityCache)) {
        const status = (data.availability || data.status || '').toUpperCase();
        const isBookable =
            status.startsWith('AVAILABLE') ||
            status.startsWith('RAC') ||
            status.startsWith('WL') ||
            status.includes('AVAILABLE');

        if (!isBookable) continue;

        const fare = parseFloat(data.fare) || 0;
        if (fare > 0 && fare < cheapestFare) {
            cheapestFare = fare;
            cheapest = cls;
        }
    }

    return cheapest ? { cls: cheapest, fare: cheapestFare } : { cls: null, fare: 0 };
}

/**
 * Build a class map { "3A": { status, fare }, ... } from availabilityCache.
 */
function buildClassMap(availabilityCache) {
    if (!availabilityCache || typeof availabilityCache !== 'object') return {};
    const map = {};
    for (const [cls, data] of Object.entries(availabilityCache)) {
        map[cls] = {
            status: data.availability || data.status || 'N/A',
            fare: parseFloat(data.fare) || 0
        };
    }
    return map;
}

/**
 * Build a standardised leg object from a raw ConfirmTkt train result.
 */
function buildLeg(train) {
    const durationMins = parseDuration(train.duration);
    return {
        trainNumber: train.trainNumber,
        trainName: train.trainName,
        from: { code: train.fromStnCode, name: train.fromStnName },
        to: { code: train.toStnCode, name: train.toStnName },
        fromStationCode: train.fromStnCode,
        fromStationName: train.fromStnName || train.fromStnCode,
        source: train.fromStnCode,
        sourceName: train.fromStnName || train.fromStnCode,
        toStationCode: train.toStnCode,
        toStationName: train.toStnName || train.toStnCode,
        destination: train.toStnCode,
        destinationName: train.toStnName || train.toStnCode,
        departure: train.departureTime,
        departureTime: train.departureTime,
        arrival: train.arrivalTime,
        arrivalTime: train.arrivalTime,
        duration: durationMins,
        durationMins: durationMins,
        classes: buildClassMap(train.availabilityCache)
    };
}

// ===========================================================================
// COORDINATE RESOLUTION
// ===========================================================================

/**
 * Look up coordinates for a station code from the junctions list.
 */
function getJunctionCoords(stationCode) {
    const upper = stationCode.toUpperCase();
    const found = allJunctions.find(j => j.code.toUpperCase() === upper);
    return found ? { lat: found.lat, lng: found.lng } : null;
}

// ===========================================================================
// SAFE SEARCH WRAPPER
// ===========================================================================

async function safeSearchTrains(source, destination, date) {
    try {
        const results = await searchTrains(source, destination, date);
        return Array.isArray(results) ? results : [];
    } catch (err) {
        console.error(`[multiHop] safeSearchTrains ${source}→${destination} failed:`, err.message);
        return [];
    }
}

// ===========================================================================
// CONNECTION FINDER
// ===========================================================================

/**
 * Check if a leg has at least 1 available or RAC seat in any class.
 */
function hasAnyAvailableSeat(leg) {
    if (!leg || !leg.classes) return false;
    for (const data of Object.values(leg.classes)) {
        const s = (data.status || '').toUpperCase();
        if (s.includes('AVAILABLE') || s.includes('CURR_AV') || s.includes('RAC') || (s.includes('AVL') && !s.includes('NOT'))) {
            return true;
        }
    }
    return false;
}

/**
 * Given trains from A→Junction and Junction→B, find all valid timed
 * connections.  Returns array of route objects.
 */
function findValidConnections(trainsAJ, trainsJB, minLayover, nextDay = false) {
    const connections = [];

    for (const tA of trainsAJ) {
        const legA = buildLeg(tA);
        const cheapA = getCheapestAvailable(tA.availabilityCache);
        if (!cheapA.cls) continue;

        for (const tB of trainsJB) {
            // Skip if same train (would be a direct route, not a connection)
            if (tA.trainNumber === tB.trainNumber) continue;

            const legB = buildLeg(tB);
            const cheapB = getCheapestAvailable(tB.availabilityCache);
            if (!cheapB.cls) continue;

            const layover = calculateLayover(tA.arrivalTime, tB.departureTime, nextDay);
            if (layover < minLayover || layover > MAX_LAYOVER) continue;

            // Enforce requirement: At least 1 available or RAC seat across any class in BOTH trains (every leg must be confirmed/RAC to travel)
            const routeHasAvailable = hasAnyAvailableSeat(legA) && hasAnyAvailableSeat(legB);
            if (!routeHasAvailable) continue;

            const totalDurationMins = legA.duration + layover + legB.duration;

            connections.push({
                legs: [legA, legB],
                totalFare: cheapA.fare + cheapB.fare,
                totalDurationMins,
                totalLayoverMins: layover,
                connections: [{
                    station: tA.toStnCode,
                    stationName: tA.toStnName,
                    layoverMins: layover
                }]
            });
        }
    }

    // Sort: both available/RAC first, then shortest duration
    connections.sort((a, b) => {
        const aBoth = hasAnyAvailableSeat(a.legs[0]) && hasAnyAvailableSeat(a.legs[1]) ? 1 : 0;
        const bBoth = hasAnyAvailableSeat(b.legs[0]) && hasAnyAvailableSeat(b.legs[1]) ? 1 : 0;
        if (aBoth !== bBoth) return bBoth - aBoth;
        return a.totalDurationMins - b.totalDurationMins;
    });

    // Limit to top 4 best connections per junction to keep results focused and super responsive
    return connections.slice(0, 4);
}

// ===========================================================================
// RATE LIMITER
// ===========================================================================

/**
 * Returns a small delay promise.  Called every `interval` junction searches
 * to avoid hammering the upstream API.
 */
async function rateLimitDelay(iterationIndex, interval = 3, delayMs = 200) {
    if ((iterationIndex + 1) % interval === 0) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
    }
}

// ===========================================================================
// 1-HOP SEARCH: source → junction → destination
// ===========================================================================

async function search1Hop(source, destination, date, junctions, minLayover, onProgress, onResult) {
    const total = junctions.length;
    const nextDate = addDays(date, 1);

    for (let i = 0; i < total; i++) {
        const junc = junctions[i];
        onProgress(i + 1, total, `Scanning via ${junc.name} (${junc.code})...`);

        // Search both legs in parallel for speed
        const [trainsToJunc, trainsFromJunc, trainsFromJuncNextDay] = await Promise.all([
            safeSearchTrains(source, junc.code, date),
            safeSearchTrains(junc.code, destination, date),
            safeSearchTrains(junc.code, destination, nextDate)
        ]);

        // Same-day connections
        const sameDayResults = findValidConnections(trainsToJunc, trainsFromJunc, minLayover, false);
        for (const result of sameDayResults) {
            onResult({ type: '1-hop', ...result });
        }

        // Next-day connections (for overnight arrivals at junction)
        const nextDayResults = findValidConnections(trainsToJunc, trainsFromJuncNextDay, minLayover, true);
        for (const result of nextDayResults) {
            onResult({ type: '1-hop', ...result });
        }

        // Rate-limit: pause every 3 junctions
        await rateLimitDelay(i, 3, 200);

        // Small human-like jitter between junctions
        await humanDelay(0.2, 0.6);
    }
}

// ===========================================================================
// 2-HOP SEARCH: source → J1 → J2 → destination
// ===========================================================================

async function search2Hop(source, destination, date, junctions, minLayover, onProgress, onResult) {
    // Build all unique junction pairs
    const pairs = [];
    for (let i = 0; i < junctions.length; i++) {
        for (let k = i + 1; k < junctions.length; k++) {
            pairs.push([junctions[i], junctions[k]]);
        }
    }

    const total = pairs.length;
    if (total === 0) return;

    onProgress(0, total, `Starting 2-hop search across ${total} junction pairs...`);
    const nextDate = addDays(date, 1);
    let total2HopEmitted = 0;

    for (let p = 0; p < total; p++) {
        if (total2HopEmitted >= 25) break;
        const [j1, j2] = pairs[p];
        onProgress(p + 1, total, `2-hop: scanning ${j1.code} → ${j2.code}`);

        // Fetch all three legs (+ next-day variants) in parallel
        const [legsA, legsB, legsBNext, legsC, legsCNext] = await Promise.all([
            safeSearchTrains(source, j1.code, date),
            safeSearchTrains(j1.code, j2.code, date),
            safeSearchTrains(j1.code, j2.code, nextDate),
            safeSearchTrains(j2.code, destination, date),
            safeSearchTrains(j2.code, destination, nextDate)
        ]);

        for (const tA of legsA) {
            if (total2HopEmitted >= 25) break;
            const legA = buildLeg(tA);
            const cheapA = getCheapestAvailable(tA.availabilityCache);
            if (!cheapA.cls) continue;

            const allLegsB = [...legsB, ...legsBNext];
            for (const tB of allLegsB) {
                if (total2HopEmitted >= 25) break;
                if (tA.trainNumber === tB.trainNumber) continue;

                const isNextDayB = legsBNext.includes(tB);
                const layover1 = calculateLayover(tA.arrivalTime, tB.departureTime, isNextDayB);
                if (layover1 < minLayover || layover1 > MAX_LAYOVER) continue;

                const legB = buildLeg(tB);
                const cheapB = getCheapestAvailable(tB.availabilityCache);
                if (!cheapB.cls) continue;

                const allLegsC = [...legsC, ...legsCNext];
                let pair2HopCount = 0;
                for (const tC of allLegsC) {
                    if (pair2HopCount >= 2 || total2HopEmitted >= 25) break;
                    if (tB.trainNumber === tC.trainNumber) continue;

                    const isNextDayC = legsCNext.includes(tC);
                    const layover2 = calculateLayover(tB.arrivalTime, tC.departureTime, isNextDayC);
                    if (layover2 < minLayover || layover2 > MAX_LAYOVER) continue;

                    const legC = buildLeg(tC);
                    const cheapC = getCheapestAvailable(tC.availabilityCache);
                    if (!cheapC.cls) continue;

                    if (!(hasAnyAvailableSeat(legA) && hasAnyAvailableSeat(legB) && hasAnyAvailableSeat(legC))) continue;

                    const totalFare = cheapA.fare + cheapB.fare + cheapC.fare;
                    const totalLayoverMins = layover1 + layover2;
                    const totalDurationMins = legA.duration + layover1 + legB.duration + layover2 + legC.duration;

                    pair2HopCount++;
                    total2HopEmitted++;
                    onResult({
                        type: '2-hop',
                        legs: [legA, legB, legC],
                        connections: [
                            {
                                station: tA.toStnCode,
                                stationName: tA.toStnName,
                                layoverMins: layover1
                            },
                            {
                                station: tB.toStnCode,
                                stationName: tB.toStnName,
                                layoverMins: layover2
                            }
                        ],
                        totalFare,
                        totalDurationMins,
                        totalLayoverMins
                    });
                }
            }
        }

        // Rate-limit between junction pairs
        await rateLimitDelay(p, 3, 200);
        await humanDelay(0.4, 1.0);
    }
}

// ===========================================================================
// MAIN ENTRY POINT
// ===========================================================================

/**
 * Find multi-hop routes between source and destination with SSE streaming.
 *
 * @param {string} source       - Source station code (e.g. "NDLS")
 * @param {string} destination  - Destination station code (e.g. "MAS")
 * @param {string} date         - Journey date "YYYY-MM-DD"
 * @param {object} options      - { maxHops, sortBy, minLayover }
 * @param {function} onProgress - Callback(completed, total, message)
 * @param {function} onResult   - Callback(routeObject)
 */
async function findMultiHopRoutes(source, destination, date, options, onProgress, onResult) {
    const maxHops = (options && options.maxHops) || 1;
    const sortBy = (options && options.sortBy) || 'cheapest';
    const minLayover = (options && options.minLayover) || DEFAULT_MIN_LAYOVER;

    // ------ Step 1: Resolve source/destination coordinates ------
    let srcCoords = getJunctionCoords(source);
    let dstCoords = getJunctionCoords(destination);

    // If not in our junction list, try a probe search to infer coordinates
    if (!srcCoords || !dstCoords) {
        onProgress(0, 0, 'Resolving station coordinates...');

        const probe = await safeSearchTrains(source, destination, date);

        if (!srcCoords && probe.length > 0) {
            const fromCode = probe[0].fromStnCode;
            srcCoords = getJunctionCoords(fromCode);
        }

        if (!dstCoords && probe.length > 0) {
            const toCode = probe[0].toStnCode;
            dstCoords = getJunctionCoords(toCode);
        }
    }

    // If we still can't resolve, fall back to scanning all junctions
    if (!srcCoords || !dstCoords) {
        onProgress(0, 0, 'Could not resolve station coordinates. Scanning all major junctions...');

        const fallbackJunctions = allJunctions.filter(j => {
            const code = j.code.toUpperCase();
            return code !== source.toUpperCase() && code !== destination.toUpperCase();
        });

        // Limit fallback to first 20 junctions to keep runtime reasonable
        await search1Hop(source, destination, date, fallbackJunctions.slice(0, 20), minLayover, onProgress, onResult);
        return;
    }

    // ------ Step 2: Geographic corridor filtering ------
    const corridorJunctions = getCorridorJunctions(
        srcCoords.lat, srcCoords.lng, dstCoords.lat, dstCoords.lng
    );

    // Exclude source and destination from the junction list
    const filteredJunctions = corridorJunctions.filter(j => {
        const code = j.code.toUpperCase();
        return code !== source.toUpperCase() && code !== destination.toUpperCase();
    });

    if (filteredJunctions.length === 0) {
        onProgress(0, 0, 'No intermediate junctions found in corridor. Search complete.');
        return;
    }

    // ------ Step 3: 1-hop search ------
    const top1HopJunctions = filteredJunctions.slice(0, 15);
    onProgress(0, top1HopJunctions.length,
        `Found ${filteredJunctions.length} junctions in corridor. Scanning top ${top1HopJunctions.length} major connection hubs...`);
    await search1Hop(source, destination, date, top1HopJunctions, minLayover, onProgress, onResult);

    // ------ Step 4: 2-hop search (if requested) ------
    if (maxHops >= 2) {
        // Limit to top 6 junctions to keep O(n²) manageable
        const top2HopJunctions = filteredJunctions.slice(0, 6);
        await search2Hop(source, destination, date, top2HopJunctions, minLayover, onProgress, onResult);
    }
}

// ===========================================================================
// EXPORTS
// ===========================================================================

module.exports = {
    findMultiHopRoutes,
    getCorridorJunctions,
    haversineDistance,
    // Exported for testing
    perpendicularDistance,
    parseTime,
    parseDuration,
    calculateLayover,
    buildLeg,
    getCheapestAvailable,
    buildClassMap
};
