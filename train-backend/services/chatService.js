const axios = require('axios');

const GEMINI_API_KEYS = process.env.GEMINI_API_KEYS
    ? process.env.GEMINI_API_KEYS.split(',').map(k => k.trim())
    : [];

let currentKeyIndex = 0;

const getNextApiKey = () => {
    if (!GEMINI_API_KEYS.length) {
        return process.env.GEMINI_API_KEY || '';
    }
    const key = GEMINI_API_KEYS[currentKeyIndex];
    currentKeyIndex = (currentKeyIndex + 1) % GEMINI_API_KEYS.length;
    return key;
};

const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent`;

const today = new Date();
const todayStr = `${String(today.getDate()).padStart(2,'0')}-${String(today.getMonth()+1).padStart(2,'0')}-${today.getFullYear()}`;

const SYSTEM_PROMPT = `You are RailPath AI — an expert Indian Railways assistant inside the RailPath app. Help users find confirmed train tickets using 3 techniques.

## THE 3 FEATURES
1. Longer Route Booking — Books a longer ticket to unlock blocked intermediate quota seats.
2. Seat Switching — Splits a journey into two consecutive tickets on the SAME train at one intermediate station.
3. Multi-Leg Route — Connects two different trains at a junction for long-distance travel.

## CONVERSATION FLOW (FOLLOW EXACTLY)
1. User asks about trains → extract params → action: "SHOW_TRAINS"
2. After trains are shown → present 3 options → action: "PRESENT_OPTIONS"
3. User picks an option → check if train number AND class are known from conversation history
   - BOTH known → trigger the action
   - MISSING either → action: "CLARIFY", ask specifically, list train numbers/names from context
4. User provides missing info → trigger the action

## AMBIGUOUS STATIONS
If a city maps to multiple stations, return action: "CLARIFY" and list options.
If user says "any", "either", "both" → put ALL codes in alternateSource or alternateDest as array e.g. ["CNB","KAN"].
Ambiguous: Kanpur (CNB/KAN), Mumbai (MMCT/CSTM), Delhi (NDLS/DLI/ANVT), Hyderabad (HYB/SC), Bangalore (SBC/YPR)

## RESPONSE FORMAT
You MUST respond with ONLY a raw JSON object. No markdown fences, no explanation, just the JSON.

{
  "reply": "<message to user>",
  "action": "SHOW_TRAINS|PRESENT_OPTIONS|TRIGGER_OPTIMIZE|TRIGGER_MULTIHOP|CLARIFY|NONE",
  "params": {
    "source": "<station code or null>",
    "alternateSource": null,
    "destination": "<station code or null>",
    "alternateDest": null,
    "date": "<DD-MM-YYYY or null>",
    "trainNumber": "<string or null>",
    "travelClass": "<SL|3A|2A|1A|CC|EC|2S or null>",
    "optimizeMode": "<QUOTA|SEAT_SWITCH|null>",
    "maxHops": 1,
    "minLayover": 30,
    "sortBy": "cheapest"
  },
  "filters": { "anyAvailable": false, "classes": [], "trainTypes": [] },
  "missingFields": []
}

## STATION CODES
NDLS=New Delhi, DLI=Delhi Jn, ANVT=Anand Vihar, NZM=Hazrat Nizamuddin,
MMCT=Mumbai Central, CSTM=Mumbai CST, HWH=Kolkata, MAS=Chennai Central,
SBC=Bangalore, YPR=Yesvantpur, HYB=Hyderabad, SC=Secunderabad,
ADI=Ahmedabad, PUNE=Pune, JP=Jaipur, LKO=Lucknow, PNBE=Patna, BPL=Bhopal,
CNB=Kanpur Central, KAN=Kanpur Anwarganj, BSB=Varanasi, AGC=Agra, ST=Surat,
MFP=Muzaffarpur, GKP=Gorakhpur, ALD=Allahabad, RNC=Ranchi, BBS=Bhubaneswar,
VSKP=Visakhapatnam, CBE=Coimbatore, ASR=Amritsar, JU=Jodhpur, UDZ=Udaipur,
GHY=Guwahati, DBRG=Dibrugarh, JAT=Jammu Tawi, ERS=Kochi, TVC=Trivandrum,
NGP=Nagpur, INDB=Indore, GWL=Gwalior, MTJ=Mathura, HW=Haridwar, DDN=Dehradun,
CDG=Chandigarh, LDH=Ludhiana, DEE=Sarai Rohilla, MAQ=Mangalore

## CLASS CODES
SL=Sleeper, 3A=Third AC, 2A=Second AC, 1A=First AC, CC=Chair Car, EC=Executive, 2S=Second Seater

## DATE — Today is ${todayStr}. Format: DD-MM-YYYY always.

## OPTION MAPPING
Option 1 = Longer Route → TRIGGER_OPTIMIZE + optimizeMode: "QUOTA"
Option 2 = Seat Switch → TRIGGER_OPTIMIZE + optimizeMode: "SEAT_SWITCH"
Option 3 = Multi-Leg → TRIGGER_MULTIHOP

## STYLE
Friendly, short, crisp. Not robotic. When asking for missing info, list actual train numbers from conversation.`;

// Sleep helper
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Call Gemini REST API with automatic retry and key rotation on rate limits, timeouts, or network errors
const callGemini = async (prompt, retries = 5) => {
    for (let attempt = 1; attempt <= retries; attempt++) {
        const apiKey = getNextApiKey();
        const activeIndex = (currentKeyIndex - 1 + GEMINI_API_KEYS.length) % GEMINI_API_KEYS.length;
        try {
            const response = await axios.post(
                GEMINI_URL,
                {
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.2 },
                },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'X-goog-api-key': apiKey,
                    },
                    timeout: 8000, // 8 seconds timeout (prevents hanging)
                }
            );
            return response.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        } catch (err) {
            const status = err.response?.status;
            const isRateLimit = status === 429 || status === 503 || status === 504;
            const isTimeout = err.code === 'ECONNABORTED' || err.message.includes('timeout');
            const isNetworkError = !err.response && err.request;
            
            const isRetriable = isRateLimit || isTimeout || isNetworkError;

            if (isRetriable && attempt < retries) {
                const errType = isRateLimit ? `Status ${status}` : (isTimeout ? 'Timeout' : 'Network Error');
                console.warn(`[chatService] Key index ${activeIndex} failed with ${errType} (attempt ${attempt}/${retries}). Rotating key...`);
                // Sleep 250ms before trying the next key
                await sleep(250);
                continue;
            }

            // Non-retryable error (or exceeded max retries)
            throw err;
        }
    }
};

const processChat = async (messages) => {
    // Build conversation transcript embedded in the prompt
    let conversationTranscript = '';
    for (const msg of messages) {
        const role = msg.role === 'user' ? 'User' : 'Assistant';
        const content = typeof msg.content === 'string'
            ? msg.content
            : (msg.content?.reply || JSON.stringify(msg.content));
        conversationTranscript += `${role}: ${content}\n`;
    }

    const fullPrompt = `${SYSTEM_PROMPT}

---

CONVERSATION SO FAR:
${conversationTranscript}
Now respond to the last User message. Return ONLY a raw JSON object, no markdown, no explanation.`;

    const raw = (await callGemini(fullPrompt) || '').trim();

    // Strip markdown code fences if model wraps response
    const cleaned = raw.startsWith('```')
        ? raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
        : raw;

    try {
        return JSON.parse(cleaned);
    } catch (e) {
        // Last resort: extract JSON object from within the text
        const match = cleaned.match(/\{[\s\S]*\}/);
        if (match) {
            try { return JSON.parse(match[0]); } catch {}
        }
        console.error('[chatService] Could not parse Gemini output:\n', cleaned.slice(0, 400));
        throw new Error('Could not parse Gemini response');
    }
};

module.exports = { processChat };
