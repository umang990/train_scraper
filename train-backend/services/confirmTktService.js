const axios = require('axios');

const USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/158.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/158.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/158.0.0.0 Safari/537.36"
];

const getRandomAgent = () => USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

const humanDelay = (minSeconds = 0.0, maxSeconds = 0.05) => {
    const delay = Math.random() * (maxSeconds - minSeconds) + minSeconds;
    return new Promise(resolve => setTimeout(resolve, delay * 1000));
};

// Shared ct-mweb headers matching ConfirmTkt mweb API specs
const getMwebHeaders = () => ({
    'Accept': '*/*',
    'Accept-Language': 'en-US,en-IN;q=0.9,en-GB;q=0.8,en;q=0.7,hi;q=0.6',
    'ApiKey': process.env.CT_API_KEY_MWEB || 'ct-mweb!2$',
    'CT-Token': process.env.CT_TOKEN_MWEB || process.env.CT_TOKEN || '2744E8A32688D8479A85CC9D2CECFE4982D39E89DF2C13E5FDCF66911F3E23E6',
    'CT-Userkey': process.env.CT_USERKEY || '65D4C34794A1EF8924C3A214322311E1CFDDA9135B671AA9CE29DD2947F6B63C',
    'ClientId': 'ct-mweb',
    'Connection': 'keep-alive',
    'Content-Type': 'application/json',
    'DeviceId': process.env.CT_DEVICE_ID_MWEB || process.env.CT_DEVICE_ID || '94c0c329-4ed0-45f9-9c34-9c41af741b66',
    'Origin': 'https://www.confirmtkt.com',
    'Referer': 'https://www.confirmtkt.com/',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-site',
    'User-Agent': getRandomAgent(),
    'sec-ch-ua': '"Chromium";v="158", "Not.A/Brand";v="24", "Google Chrome";v="158"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
});

// Shared ct-web headers — fallback so env vars are read at request time
const getWebHeaders = () => ({
    'Accept': '*/*',
    'Accept-Language': 'en-US,en-IN;q=0.9,en-GB;q=0.8,en;q=0.7,hi;q=0.6',
    'ApiKey': process.env.CT_API_KEY_WEB || 'ct-web!2$',
    'CT-Token': process.env.CT_TOKEN || '2744E8A32688D8479A85CC9D2CECFE4982D39E89DF2C13E5FDCF66911F3E23E6',
    'CT-Userkey': process.env.CT_USERKEY || '65D4C34794A1EF8924C3A214322311E1CFDDA9135B671AA9CE29DD2947F6B63C',
    'ClientId': 'ct-web',
    'Connection': 'keep-alive',
    'Content-Type': 'application/json',
    'DeviceId': process.env.CT_DEVICE_ID || '94c0c329-4ed0-45f9-9c34-9c41af741b66',
    'Origin': 'https://www.confirmtkt.com',
    'Referer': 'https://www.confirmtkt.com/',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-site',
    'User-Agent': getRandomAgent(),
    'sec-ch-ua': '"Chromium";v="158", "Not.A/Brand";v="24", "Google Chrome";v="158"',
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

    try {
        await humanDelay(0.0, 0.05);
        const response = await apiClient.get(url, { params, headers: getMwebHeaders() });
        return response.data?.data?.trainList || [];
    } catch (error) {
        console.error('Error searching trains:', error.message);
        return [];
    }
};

// ─── Fetch Train Schedule ───────────────────────────────────────────────────
const fetchTrainSchedule = async (trainNumber) => {
    // Primary: ConfirmTkt Official API endpoint
    const apiUrl = `https://cttrainsapi.confirmtkt.com/api/v1/trains/schedule?trainNo=${trainNumber}`;
    try {
        await humanDelay(0.0, 0.05);
        const response = await apiClient.get(apiUrl, { headers: getMwebHeaders() });
        if (response.data && response.data.Schedule) {
            return response.data;
        }
    } catch (apiError) {
        console.warn(`API schedule fetch failed for ${trainNumber} (${apiError.message}), falling back to HTML scrape...`);
    }

    // Fallback: Web scrape (in case API is unavailable)
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
        await humanDelay(0.0, 0.05);
        // Try web headers first, fallback to mweb headers
        let response;
        try {
            response = await apiClient.post(url, null, { params, headers: getWebHeaders() });
        } catch (e) {
            response = await apiClient.post(url, null, { params, headers: getMwebHeaders() });
        }
        return response?.data || null;
    } catch (error) {
        return null;
    }
};

// ─── Fetch Availability Calendar (14/15-day date strip) ─────────────────────────
const fetchAvailabilityCalendar = async (source, destination, startDate, days = 14) => {
    const url = 'https://cttrainsapi.confirmtkt.com/api/v1/availability/availabilityCalender';

    const params = {
        'sourceStationCode': source,
        'destinationStationCode': destination,
        'startDate': startDate,
        'days': String(days),
    };

    try {
        await humanDelay(0.0, 0.05);
        const response = await apiClient.get(url, { params, headers: getMwebHeaders() });
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
