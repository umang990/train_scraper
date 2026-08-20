const { searchTrains, fetchTrainSchedule, fetchLiveAvailability, fetchAvailabilityCalendar, humanDelay } = require('../services/confirmTktService');

// @desc    Get trains data (Master search + Schedules + optional Live Availability)
// @route   GET /api/trains
// @access  Private
const getTrainsData = async (req, res) => {
    const { source, destination, date, targetTrain } = req.query;

    if (!source || !destination || !date) {
        return res.status(400).json({ message: 'Missing required query parameters: source, destination, date' });
    }

    try {
        // Phase 1: Search Trains
        const trainsList = await searchTrains(source, destination, date);
        
        if (!trainsList || trainsList.length === 0) {
            return res.status(404).json({ message: 'No trains found or API blocked' });
        }

        const formattedTrains = [];

        for (const train of trainsList) {
            const tInfo = {
                trainNumber: train.trainNumber,
                trainName: train.trainName,
                trainType: train.trainType,
                fromStationCode: train.fromStnCode,
                fromStationName: train.fromStnName,
                toStationCode: train.toStnCode,
                toStationName: train.toStnName,
                departureTime: train.departureTime,
                arrivalTime: train.arrivalTime,
                durationMinutes: train.duration,
                totalDistanceKm: parseFloat(train.distance) || 0.0,
                runningDays: train.runningDays,
                hasPantry: train.hasPantry,
                trainRating: train.trainRating
            };

            const availDict = {};
            const rawCache = train.availabilityCache || {};
            
            for (const [cls, clsData] of Object.entries(rawCache)) {
                availDict[cls] = {
                    status: clsData.availability,
                    displayName: clsData.availabilityDisplayName,
                    fare: parseFloat(clsData.fare) || 0.0,
                    prediction: clsData.prediction,
                    predictionPercentage: clsData.predictionPercentage,
                    confirmTktStatus: clsData.confirmTktStatus,
                    insuranceType: clsData.insuranceType,
                    lastUpdated: "CACHED - " + clsData.cacheTime
                };
            }

            formattedTrains.push({
                trainInfo: tInfo,
                availability: availDict,
                routeSchedule: []
            });
        }

        // Phase 3: Optional Live Seat Extraction for a target train
        if (targetTrain) {
            const trainIndex = formattedTrains.findIndex(t => t.trainInfo.trainNumber === targetTrain);
            
            if (trainIndex !== -1) {
                const targetObj = formattedTrains[trainIndex];
                const tNumber = targetObj.trainInfo.trainNumber;
                const tSource = targetObj.trainInfo.fromStationCode;
                const tDest = targetObj.trainInfo.toStationCode;

                const liveAvailDict = {};

                for (const cls of Object.keys(targetObj.availability)) {
                    const liveData = await fetchLiveAvailability(tNumber, cls, tSource, tDest, date);
                    
                    if (liveData && liveData.data) {
                        const trainInfo = liveData.data;
                        const fareInfo = trainInfo.fareInfo || {};
                        const dayList = trainInfo.avlDayList || [];

                        if (dayList.length > 0) {
                            const targetDay = dayList[0];
                            liveAvailDict[cls] = {
                                status: targetDay.availablityStatus || "N/A",
                                displayName: targetDay.availabilityDisplayName || "N/A",
                                fare: parseFloat(fareInfo.totalFare) || 0.0,
                                prediction: targetDay.prediction || "N/A",
                                predictionPercentage: targetDay.predictionPercentage || "N/A",
                                confirmTktStatus: targetDay.confirmTktStatus || "N/A",
                                insuranceType: targetDay.insuranceType || "N/A",
                                lastUpdated: "LIVE_FETCHED_JUST_NOW"
                            };
                        } else {
                            liveAvailDict[cls] = { ...targetObj.availability[cls], lastUpdated: "FAILED_LIVE_FETCH_USED_CACHE" };
                        }
                    } else {
                        liveAvailDict[cls] = { ...targetObj.availability[cls], lastUpdated: "FAILED_LIVE_FETCH_USED_CACHE" };
                    }
                }

                formattedTrains[trainIndex].availability = liveAvailDict;
            }
        }

        // Extract source and destination names for UI
        let sName = source;
        let dName = destination;
        if (formattedTrains.length > 0) {
            sName = formattedTrains[0].trainInfo.fromStationName || source;
            dName = formattedTrains[0].trainInfo.toStationName || destination;
        }

        // Final Response Compilation
        const finalData = {
            searchContext: {
                sourceCode: source,
                destinationCode: destination,
                sourceStationName: sName,
                destinationStationName: dName,
                dateOfJourney: date,
                totalTrainsFound: formattedTrains.length,
                targetLiveTrain: targetTrain || null
            },
            trains: formattedTrains
        };

        res.json(finalData);

    } catch (error) {
        console.error('API Route Error:', error);
        res.status(500).json({ message: 'Server Error processing train data', error: error.message });
    }
};

// @desc    Get single train schedule
// @route   GET /api/trains/:trainNumber/schedule
// @access  Private
const getTrainSchedule = async (req, res) => {
    const { trainNumber } = req.params;

    if (!trainNumber) {
        return res.status(400).json({ message: 'Train number is required' });
    }

    try {
        const rawSched = await fetchTrainSchedule(trainNumber);
        if (!rawSched || !rawSched.Schedule) {
            return res.status(404).json({ message: 'Schedule not found for this train' });
        }

        const formattedSchedule = rawSched.Schedule.map(stop => ({
            stopNumber: stop.StopNumber,
            stationCode: stop.StationCode,
            stationName: stop.StationName,
            arrivalTime: stop.ArrivalTime || "Source",
            departureTime: stop.DepartureTime || "Destination",
            haltMinutes: stop.HaltMinutes || "0m",
            day: stop.Day,
            distanceKm: parseFloat(stop.Distance) || 0.0,
            expectedPlatformNo: stop.ExpectedPlatformNo,
            coordinates: {
                latitude: stop.Latitude,
                longitude: stop.Longitude
            }
        }));

        res.json({
            trainNumber,
            coachPosition: rawSched.CoachPosition || "N/A",
            schedule: formattedSchedule
        });
    } catch (error) {
        console.error('API Route Error [getTrainSchedule]:', error);
        res.status(500).json({ message: 'Server Error fetching schedule', error: error.message });
    }
};

const { optimizeTrainRouteStream } = require('../services/optimizationService');

// @desc    Live stream AI optimization results
// @route   GET /api/trains/:trainNumber/optimize-stream
// @access  Private
const optimizeTrainStream = async (req, res) => {
    const { trainNumber } = req.params;
    const { source, destination, date, travelClasses, mode } = req.query;

    if (!trainNumber || !source || !destination || !date || !travelClasses) {
        return res.status(400).json({ message: 'Missing required parameters' });
    }

    try {
        const rawSched = await fetchTrainSchedule(trainNumber);
        if (!rawSched || !rawSched.Schedule) {
            return res.status(404).json({ message: 'Schedule not found' });
        }
        
        // Setup SSE Headers
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        // Classes may be a string if one, or array if multiple
        const classesArray = Array.isArray(travelClasses) ? travelClasses : travelClasses.split(',');

        const onProgress = (completed, total, message) => {
            res.write(`data: ${JSON.stringify({ type: 'progress', completed, total, message })}\n\n`);
        };

        const onResult = (result) => {
            res.write(`data: ${JSON.stringify({ type: 'result', data: result })}\n\n`);
        };

        await optimizeTrainRouteStream(trainNumber, source, destination, date, classesArray, rawSched.Schedule, mode || 'QUOTA', onProgress, onResult);
        
        res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
        res.end();
    } catch (error) {
        console.error('API Route Error [optimizeTrainStream]:', error);
        if (!res.headersSent) {
            res.status(500).json({ message: 'Server Error during optimization' });
        } else {
            res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
            res.end();
        }
    }
};


// @desc    Get 15-day availability calendar for a route (date strip status labels)
// @route   GET /api/trains/calendar
// @access  Private
const getAvailabilityCalendar = async (req, res) => {
    const { source, destination, startDate, days } = req.query;

    if (!source || !destination || !startDate) {
        return res.status(400).json({ message: 'Missing required query parameters: source, destination, startDate' });
    }

    try {
        const raw = await fetchAvailabilityCalendar(source, destination, startDate, days || 15);

        // Log the raw response so we can see its structure in Render logs
        console.log('[Calendar] raw response keys:', raw ? Object.keys(raw) : 'null');
        console.log('[Calendar] raw.data type:', raw?.data ? (Array.isArray(raw.data) ? `array(${raw.data.length})` : typeof raw.data) : 'missing');
        if (raw?.data) console.log('[Calendar] first entry sample:', JSON.stringify(Array.isArray(raw.data) ? raw.data[0] : raw.data).slice(0, 300));

        if (!raw) {
            return res.json({ calendar: [] });
        }

        // Handle multiple possible response shapes from ConfirmTkt
        let entries = [];
        if (Array.isArray(raw.data)) {
            entries = raw.data;
        } else if (raw.data?.calendarList) {
            entries = raw.data.calendarList;
        } else if (raw.data?.trainCalendarList) {
            entries = raw.data.trainCalendarList;
        } else if (Array.isArray(raw)) {
            entries = raw;
        } else if (raw.data && typeof raw.data === 'object') {
            // Maybe it's a date-keyed object: { "20-08-2026": { availability: "..." } }
            entries = Object.entries(raw.data).map(([date, val]) => ({ date, ...val }));
        }

        const parseStatus = (avail = '') => {
            const a = avail.toUpperCase();
            if (a.includes('AVAILABLE') || a.includes('AVL') || a.includes('CURR_AV')) return 'Available';
            if (a.includes('RAC')) return 'RAC';
            if (a.includes('WL') || a.includes('WAIT')) return 'Waitlist';
            if (a.includes('REGRET') || a.includes('NOT')) return 'Full';
            return a || 'No Data';
        };

        const calendar = entries.map(entry => ({
            date: entry.date || entry.journeyDate || entry.travelDate,
            status: parseStatus(entry.availability || entry.status || entry.availabilityStatus || ''),
            raw: entry.availability || entry.status || ''
        }));

        console.log('[Calendar] parsed', calendar.length, 'entries, sample:', JSON.stringify(calendar[0]));

        res.json({ calendar });
    } catch (error) {
        console.error('API Route Error [getAvailabilityCalendar]:', error);
        res.status(500).json({ message: 'Server Error fetching calendar', error: error.message });
    }
};

module.exports = {
    getTrainsData,
    getTrainSchedule,
    optimizeTrainStream,
    getAvailabilityCalendar
};
