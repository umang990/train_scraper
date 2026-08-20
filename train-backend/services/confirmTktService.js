const axios = require('axios');

const USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36"
];

const getRandomAgent = () => USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

const humanDelay = (minSeconds = 0.0, maxSeconds = 0.05) => {
    const delay = Math.random() * (maxSeconds - minSeconds) + minSeconds;
    return new Promise(resolve => setTimeout(resolve, delay * 1000));
};

// Shared ct-web headers — call as a function so env vars are read at request time
const getWebHeaders = () => ({
    'Accept': '*/*',
    'Accept-Language': 'en-US,en-IN;q=0.9,en-GB;q=0.8,en;q=0.7,hi;q=0.6',
    'ApiKey': process.env.CT_API_KEY_WEB,
    'CT-Token': process.env.CT_TOKEN,
    'CT-Userkey': process.env.CT_USERKEY,
    'ClientId': 'ct-web',
    'Connection': 'keep-alive',
    'Content-Type': 'application/json',
    'DeviceId': process.env.CT_DEVICE_ID,
    'Origin': 'https://www.confirmtkt.com',
    'Referer': 'https://www.confirmtkt.com/',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-site',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36',
    'sec-ch-ua': '"Not=A?Brand";v="99", "Google Chrome";v="151", "Chromium";v="151"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
});

const apiClient = axios.create();

// ─── Search Trains ────────────────────────────────────────────────────────────
const searchTrains = async (source, destination, date) => {
    const url = 'https://cttrainsapi.confirmtkt.com/api/v1/trains/search';

    const params = {
        'sourceStationCode': source,
        'destinationStationCode': destination,
        'addAvailabilityCache': 'true',
        'excludeMultiTicketAlternates': 'false',
        'excludeBoostAlternates': 'false',
        'sortBy': 'DEFAULT',
        'dateOfJourney': date,
        'enableNearby': 'true',
        'enableTG': 'true',
        'tGPlan': 'CTG-A42',
        'showTGPrediction': 'false',
        'tgColor': 'DEFAULT',
        'showPredictionGlobal': 'true',
        'showNewAlternates': 'true',
        'showNewAltText': 'true',
    };

    const headers = {
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'ApiKey': process.env.CT_API_KEY_MWEB,
        'CT-Token': process.env.CT_TOKEN_MWEB,
        'CT-Userkey': process.env.CT_USERKEY,
        'ClientId': 'ct-mweb',
        'Connection': 'keep-alive',
        'Content-Type': 'application/json',
        'DeviceId': process.env.CT_DEVICE_ID_MWEB,
        'Origin': 'https://www.confirmtkt.com',
        'Referer': 'https://www.confirmtkt.com/',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-site',
        'User-Agent': getRandomAgent(),
        'sec-ch-ua': '"Not=A?Brand";v="99", "Google Chrome";v="151", "Chromium";v="151"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
    };

    try {
        await humanDelay(0.0, 0.1);
        const response = await apiClient.get(url, { params, headers });
        return response.data?.data?.trainList || [];
    } catch (error) {
        console.error('Error searching trains:', error.message);
        return [];
    }
};

// ─── Fetch Train Schedule (HTML scrape) ──────────────────────────────────────
const fetchTrainSchedule = async (trainNumber) => {
    const url = `https://www.confirmtkt.com/train-running-status/${trainNumber}`;
    const headers = { 'User-Agent': getRandomAgent() };

    try {
        const response = await apiClient.get(url, { headers });
        const html = response.data;
        const match = html.match(/data\s*=\s*({.*?});/s);
        if (match && match[1]) {
            return JSON.parse(match[1]);
        }
        return null;
    } catch (error) {
        console.error(`Error fetching schedule for ${trainNumber}:`, error.message);
        return null;
    }
};

// ─── Fetch Live Availability (single train + class) ──────────────────────────
const fetchLiveAvailability = async (trainNumber, travelClass, source, destination, date, quota = 'GN') => {
    const url = 'https://cttrainsapi.confirmtkt.com/api/v1/availability/fetchAvailability';

    const params = {
        'trainNo': trainNumber,
        'travelClass': travelClass,
        'quota': quota,
        'sourceStationCode': source,
        'destinationStationCode': destination,
        'dateOfJourney': date,
        'enableTG': 'true',
        'tGPlan': 'CTG-A48',
        'showTGPrediction': 'false',
        'tgColor': 'DEFAULT',
        'showPredictionGlobal': 'true',
        'showNewMealOptions': 'true',
        'showNewAlternates': 'false',
        'showNewAltText': 'true',
    };

    try {
        await humanDelay(0.0, 0.1);
        const response = await apiClient.post(url, null, { params, headers: getWebHeaders() });
        return response.data;
    } catch (error) {
        return null;
    }
};

// ─── Fetch Availability Calendar (15-day date strip) ─────────────────────────
const fetchAvailabilityCalendar = async (source, destination, startDate, days = 15) => {
    const url = 'https://cttrainsapi.confirmtkt.com/api/v1/availability/availabilityCalender';

    const params = {
        'sourceStationCode': source,
        'destinationStationCode': destination,
        'startDate': startDate,
        'days': String(days),
    };

    try {
        await humanDelay(0.0, 0.1);
        const response = await apiClient.get(url, { params, headers: getWebHeaders() });
        return response.data;
    } catch (error) {
        console.error('Error fetching availability calendar:', error.message);
        return null;
    }
};

module.exports = {
    searchTrains,
    fetchTrainSchedule,
    fetchLiveAvailability,
    fetchAvailabilityCalendar,
    humanDelay
};
