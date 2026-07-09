const { fetchLiveAvailability } = require('./confirmTktService');

const getVal = (statusStr) => {
    if (!statusStr) return 0;
    const s = statusStr.toUpperCase();
    if ((s.includes('AVAILABLE') || s.includes('CURR_AV') || s.includes('CURR_AVBL')) && !s.includes('NOT')) return 4;
    if (s.includes('RAC')) return 3;
    if (s.includes('WL') || s.includes('WAITLIST')) return 2;
    return 1;
};

const getScore = (result) => {
    if (result.type === 'QUOTA_HACK') {
        const val = getVal(result.status);
        return val * 900;
    } else if (result.type === 'SEAT_SWITCH') {
        const v1 = getVal(result.status1);
        const v2 = getVal(result.status2);
        
        // Both legs MUST be >= RAC (3). If either is Waitlisted (<= 2), the entire combination is useless.
        if (v1 < 3 || v2 < 3) return 0;

        const minV = Math.min(v1, v2);
        const maxV = Math.max(v1, v2);
        return minV * 800 + maxV * 10;
    }
    return 0;
};

// Boundary Matrix & Heuristic Logic
const getHaltMins = (station) => {
    const str = station.HaltTime || station.haltMinutes || '0';
    return parseInt(str.replace(/[^0-9]/g, ''), 10) || 0;
};

const addDays = (baseDateStr, daysToAdd) => {
    if (!daysToAdd) return baseDateStr;
    const parts = baseDateStr.split('-');
    let dateObj;
    if (parts[0].length === 4) { // YYYY-MM-DD
        dateObj = new Date(parts[0], parseInt(parts[1]) - 1, parts[2]);
    } else { // DD-MM-YYYY
        dateObj = new Date(parts[2], parseInt(parts[1]) - 1, parts[0]);
    }
    dateObj.setDate(dateObj.getDate() + daysToAdd);
    const d = String(dateObj.getDate()).padStart(2, '0');
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const y = dateObj.getFullYear();
    // Maintain DD-MM-YYYY which is used by ConfirmTkt
    return `${d}-${m}-${y}`;
};

const EQUIVALENT_STATIONS = {
    'NDLS': ['NDLS', 'DLI', 'ANVT', 'NZM', 'DEC', 'DEE'],
    'DLI': ['NDLS', 'DLI', 'ANVT', 'NZM', 'DEC', 'DEE'],
    'ANVT': ['NDLS', 'DLI', 'ANVT', 'NZM', 'DEC', 'DEE'],
    'NZM': ['NDLS', 'DLI', 'ANVT', 'NZM', 'DEC', 'DEE'],
    'DEC': ['NDLS', 'DLI', 'ANVT', 'NZM', 'DEC', 'DEE'],
    'DEE': ['NDLS', 'DLI', 'ANVT', 'NZM', 'DEC', 'DEE'],
    'MMCT': ['MMCT', 'CSTM', 'LTT', 'BDTS', 'BCT', 'DDR', 'DR', 'KYN', 'TNA', 'BVI'],
    'CSTM': ['MMCT', 'CSTM', 'LTT', 'BDTS', 'BCT', 'DDR', 'DR', 'KYN', 'TNA', 'BVI'],
    'LTT': ['MMCT', 'CSTM', 'LTT', 'BDTS', 'BCT', 'DDR', 'DR', 'KYN', 'TNA', 'BVI'],
    'BDTS': ['MMCT', 'CSTM', 'LTT', 'BDTS', 'BCT', 'DDR', 'DR', 'KYN', 'TNA', 'BVI'],
    'HWH': ['HWH', 'SDAH', 'KOAA', 'SHM', 'SRC'],
    'SDAH': ['HWH', 'SDAH', 'KOAA', 'SHM', 'SRC'],
    'KOAA': ['HWH', 'SDAH', 'KOAA', 'SHM', 'SRC'],
    'HYB': ['HYB', 'SC', 'KCG'],
    'SC': ['HYB', 'SC', 'KCG'],
    'KCG': ['HYB', 'SC', 'KCG'],
    'SBC': ['SBC', 'YPR', 'KJM', 'BNC'],
    'YPR': ['SBC', 'YPR', 'KJM', 'BNC'],
    'MAS': ['MAS', 'MS', 'TBM'],
    'MS': ['MAS', 'MS', 'TBM'],
    'PNBE': ['PNBE', 'PPTA', 'RJPB', 'DNR'],
    'PPTA': ['PNBE', 'PPTA', 'RJPB', 'DNR'],
    'CNB': ['CNB', 'KAN', 'CPB'],
    'KAN': ['CNB', 'KAN', 'CPB'],
};

const resolveStationIndex = (code, schedule) => {
    const uppercaseCode = (code || '').toUpperCase();
    let idx = schedule.findIndex(s => (s.StationCode || s.stationCode || '').toUpperCase() === uppercaseCode);
    if (idx !== -1) return idx;

    const equivalents = EQUIVALENT_STATIONS[uppercaseCode] || [];
    for (const eq of equivalents) {
        idx = schedule.findIndex(s => (s.StationCode || s.stationCode || '').toUpperCase() === eq.toUpperCase());
        if (idx !== -1) return idx;
    }
    return -1;
};

const optimizeTrainRouteStream = async (trainNumber, source, destination, date, travelClasses, schedule, mode, onProgress, onResult) => {
    const srcIndex = resolveStationIndex(source, schedule);
    const destIndex = resolveStationIndex(destination, schedule);

    if (srcIndex === -1 || destIndex === -1 || srcIndex >= destIndex) {
        throw new Error(`Invalid source/destination combination for this train schedule.`);
    }

    const validClasses = Array.isArray(travelClasses) ? travelClasses : [travelClasses];
    const sourceDay = parseInt(schedule[srcIndex].Day || schedule[srcIndex].day || 1);
    
    // Short-circuit tracker
    const shortCircuits = {};
    validClasses.forEach(c => shortCircuits[c] = []);

    const isShortCircuited = (i, j, cls) => {
        return shortCircuits[cls].some(found => i <= found.i && j >= found.j);
    };

    let executableTasks = [];

    if (mode === 'QUOTA') {
        for (let i = srcIndex; i >= 0; i--) {
            // Outward Expansion logic for Quota Hack
            if (i !== srcIndex && i < srcIndex - 6 && i >= 6 && getHaltMins(schedule[i]) <= 10) continue;

            for (let j = destIndex; j < schedule.length; j++) {
                if (j !== destIndex && j > destIndex + 6 && (schedule.length - 1 - j) >= 6 && getHaltMins(schedule[j]) <= 10) continue;
                if (i === srcIndex && j === destIndex) continue; // Don't check the exact waitlisted route again here
                
                const dist = (srcIndex - i) + (j - destIndex);
                executableTasks.push({
                    type: 'QUOTA_HACK', i, j, dist, class: validClasses[0],
                    boardStation: schedule[i], alightStation: schedule[j],
                    bookFrom: schedule[i], boardAt: schedule[srcIndex], getDownAt: schedule[destIndex], bookTo: schedule[j]
                });
            }
        }
    } else if (mode === 'SPLIT_EXACT' || mode === 'SEAT_SWITCH') {
        // Seat Switch ONLY between exact source and exact destination
        for (let m = srcIndex + 1; m < destIndex; m++) {
            executableTasks.push({
                type: 'SEAT_SWITCH', i: srcIndex, m, j: destIndex, dist: 0,
                boardStation: schedule[srcIndex], splitStation: schedule[m], alightStation: schedule[destIndex],
                bookFrom: schedule[srcIndex], boardAt: schedule[srcIndex], getDownAt: schedule[destIndex], bookTo: schedule[destIndex]
            });
        }
    } else if (mode === 'SPLIT_EXTENDED') {
        // Find top 2 biggest halt stations between source and destination to act as splits
        const intermediateStations = [];
        for (let m = srcIndex + 1; m < destIndex; m++) {
            intermediateStations.push({ index: m, halt: getHaltMins(schedule[m]) });
        }
        intermediateStations.sort((a, b) => b.halt - a.halt);
        const splitCandidates = intermediateStations.slice(0, 2).map(s => s.index);

        // Max 3 stations backward, max 3 stations forward to severely limit requests < 400
        const minBoard = Math.max(0, srcIndex - 3);
        const maxAlight = Math.min(schedule.length - 1, destIndex + 3);

        for (let i = srcIndex; i >= minBoard; i--) {
            for (let j = destIndex; j <= maxAlight; j++) {
                if (i === srcIndex && j === destIndex) continue; // Already done in SPLIT_EXACT
                
                for (let m of splitCandidates) {
                    const dist = (srcIndex - i) + (j - destIndex);
                    executableTasks.push({
                        type: 'SEAT_SWITCH', i, m, j, dist,
                        boardStation: schedule[i], splitStation: schedule[m], alightStation: schedule[j],
                        bookFrom: schedule[i], boardAt: schedule[srcIndex], getDownAt: schedule[destIndex], bookTo: schedule[j]
                    });
                }
            }
        }
    }

    executableTasks.sort((a, b) => a.dist - b.dist);

    const totalTasks = executableTasks.length;
    let completed = 0;
    const poolLimit = 15;
    
    // If Quota mode finds an AVAILABLE ticket, it sets this to true so we can abort the current outward layer if needed
    let foundPerfectTicket = false;

    // Group tasks by distance
    const tasksByDist = {};
    for (const task of executableTasks) {
        if (!tasksByDist[task.dist]) tasksByDist[task.dist] = [];
        tasksByDist[task.dist].push(task);
    }
    const distKeys = Object.keys(tasksByDist).map(Number).sort((a, b) => a - b);

    for (const dist of distKeys) {
        // If we found a perfect Quota hack in an inner ring, don't check outer rings
        if (mode === 'QUOTA' && foundPerfectTicket) break;

        const distTasks = tasksByDist[dist];
        const executing = [];

        for (const task of distTasks) {
            if (task.type === 'QUOTA_HACK' && isShortCircuited(task.i, task.j, task.class)) {
                completed++;
                onProgress(completed, totalTasks, "Skipped redundant outer station");
                continue;
            }

                const p = Promise.resolve().then(async () => {
                let result = null;
                if (task.type === 'QUOTA_HACK') {
                    const boardCode = task.boardStation.StationCode || task.boardStation.stationCode;
                    const alightCode = task.alightStation.StationCode || task.alightStation.stationCode;
                    const bDay = parseInt(task.boardStation.Day || task.boardStation.day || 1);
                    const targetDate = addDays(date, bDay - sourceDay);
                    try {
                        const data = await fetchLiveAvailability(trainNumber, task.class, boardCode, alightCode, targetDate);
                        const st = data?.data?.avlDayList?.[0]?.availablityStatus || 'NOT AVAILABLE';
                        const fare = parseFloat(data?.data?.fareInfo?.totalFare) || 0;
                        
                        if (st.toUpperCase().includes('AVAILABLE') && !st.toUpperCase().includes('NOT')) {
                            shortCircuits[task.class].push({ i: task.i, j: task.j });
                            foundPerfectTicket = true;
                        }
                        result = { ...task, status: st, fare };
                    } catch(e) {}
                } else {
                    const boardCode = task.boardStation.StationCode || task.boardStation.stationCode;
                    const splitCode = task.splitStation.StationCode || task.splitStation.stationCode;
                    const alightCode = task.alightStation.StationCode || task.alightStation.stationCode;
                    
                    const bDay1 = parseInt(task.boardStation.Day || task.boardStation.day || 1);
                    const bDay2 = parseInt(task.splitStation.Day || task.splitStation.day || 1);
                    
                    const date1 = addDays(date, bDay1 - sourceDay);
                    const date2 = addDays(date, bDay2 - sourceDay);

                    try {
                        const { searchTrains } = require('./confirmTktService');
                        // Make only 2 calls to get all classes for both legs
                        const [list1, list2] = await Promise.all([
                            searchTrains(boardCode, splitCode, date1),
                            searchTrains(splitCode, alightCode, date2)
                        ]);
                        
                        const train1 = list1.find(t => String(t.trainNumber) === String(trainNumber));
                        const train2 = list2.find(t => String(t.trainNumber) === String(trainNumber));

                        if (train1 && train2 && train1.availabilityCache && train2.availabilityCache) {
                            // Cross matrix all classes present in both availability caches
                            const classes1 = Object.keys(train1.availabilityCache);
                            const classes2 = Object.keys(train2.availabilityCache);
                            const targetClass = validClasses[0];
                            
                            for (const c1 of classes1) {
                                for (const c2 of classes2) {
                                    // Tier 2 check: at least ONE seat must be in the class the user clicked to reach here
                                    if (c1 !== targetClass && c2 !== targetClass) continue;

                                    const ac1 = train1.availabilityCache[c1];
                                    const ac2 = train2.availabilityCache[c2];
                                    
                                    if (ac1 && ac2) {
                                        const st1 = ac1.availability || 'NOT AVAILABLE';
                                        const st2 = ac2.availability || 'NOT AVAILABLE';
                                        const f1 = parseFloat(ac1.fare) || 0;
                                        const f2 = parseFloat(ac2.fare) || 0;
                                        
                                        let comboResult = { 
                                            ...task, class1: c1, class2: c2, 
                                            status1: st1, status2: st2, 
                                            fare1: f1, fare2: f2, totalFare: f1 + f2 
                                        };
                                        comboResult.score = getScore(comboResult);
                                        
                                        if (comboResult.score >= 1800) {
                                            onResult(comboResult);
                                        }
                                    }
                                }
                            }
                        }
                    } catch(e) {}
                }
                
                completed++;
                if (task.type === 'QUOTA_HACK' && result) {
                    result.score = getScore(result);
                    if (result.score >= 1800) {
                        onResult(result);
                    }
                }
                onProgress(completed, totalTasks, `Scanning combinations...`);
            });

            const e = p.then(() => executing.splice(executing.indexOf(e), 1));
            executing.push(e);
            if (executing.length >= poolLimit) {
                await Promise.race(executing);
            }
        }
        
        await Promise.all(executing);
    }
    
    // Auto-complete any remaining progress if we short-circuited
    if (completed < totalTasks) {
        onProgress(totalTasks, totalTasks, "Optimization Complete!");
    } else {
        onProgress(totalTasks, totalTasks, "Optimization Complete!");
    }
};

module.exports = {
    optimizeTrainRouteStream
};
