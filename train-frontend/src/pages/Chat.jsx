import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import api, { API_BASE_URL } from '../api';
import { useAuth } from '../context/AuthContext';

import TrainCard from '../components/TrainCard';
import MultiHopCard from '../components/MultiHopCard';

/* ─── Helpers ─────────────────────────────────────────────────── */
const getToken = () => {
    const stored = localStorage.getItem('user');
    if (stored) { try { return JSON.parse(stored).token; } catch { return null; } }
    return null;
};

/* ─── Sub-Components ──────────────────────────────────────────── */

// Optimization result card (quota hack / seat switch) - Matches exact styling of cards in OptimizationModal.jsx
const OptResultCard = ({ result, index, onClick }) => {
    const isSwitch = result.type === 'SEAT_SWITCH';

    const getStatusCls = (st) => {
        const s = (st || '').toUpperCase();
        if (s.includes('AVAILABLE') || s.includes('CURR_AV') || s.includes('AVL')) return 'text-green-700 bg-green-50 border-green-200';
        if (s.includes('RAC')) return 'text-amber-700 bg-amber-50 border-amber-200';
        if (s.includes('WL') || s.includes('WAIT')) return 'text-red-700 bg-red-50 border-red-200';
        return 'text-gray-600 bg-gray-100 border-gray-200';
    };

    const getQuotaStations = (opt) => {
        const fromCode = (opt.bookFrom?.StationCode || opt.bookFrom?.stationCode || opt.boardStation?.StationCode || opt.boardStation?.stationCode || '').toUpperCase();
        const fromName = opt.bookFrom?.StationName || opt.bookFrom?.stationName || opt.boardStation?.StationName || opt.boardStation?.stationName || fromCode;
        const toCode   = (opt.bookTo?.StationCode  || opt.bookTo?.stationCode  || opt.alightStation?.StationCode  || opt.alightStation?.stationCode  || '').toUpperCase();
        const toName   = opt.bookTo?.StationName   || opt.bookTo?.stationName   || opt.alightStation?.StationName   || opt.alightStation?.stationName   || toCode;
        return { fromCode, fromName, toCode, toName };
    };

    const getSwitchStations = (opt) => {
        const fromCode = (opt.boardStation?.StationCode || opt.boardStation?.stationCode || '').toUpperCase();
        const fromName = opt.boardStation?.StationName  || opt.boardStation?.stationName  || fromCode;
        const midCode  = (opt.splitStation?.StationCode || opt.splitStation?.stationCode  || '').toUpperCase();
        const midName  = opt.splitStation?.StationName  || opt.splitStation?.stationName  || midCode;
        const toCode   = (opt.alightStation?.StationCode || opt.alightStation?.stationCode || '').toUpperCase();
        const toName   = opt.alightStation?.StationName  || opt.alightStation?.stationName  || toCode;
        return { fromCode, fromName, midCode, midName, toCode, toName };
    };

    if (isSwitch) {
        const { fromCode, fromName, midCode, midName, toCode, toName } = getSwitchStations(result);
        const st = `${result.status1 || ''} + ${result.status2 || ''}`;
        const statusCls = getStatusCls(result.status1);
        return (
            <div
                onClick={onClick}
                className="bg-white border border-[#E4E7EC] rounded-xl p-5 hover:border-gray-400 hover:shadow-sm cursor-pointer transition-all duration-150 animate-fade-up flex flex-col gap-4 w-full hover:bg-gray-50/50"
                style={{ animationDelay: `${index * 50}ms` }}
            >
                <div className="flex items-start justify-between">
                    <span className="text-xs text-gray-400 font-medium">Seat Switch</span>
                    <span className="text-lg font-bold text-gray-900">₹{result.totalFare || result.fare || '—'}</span>
                </div>
                <div className="flex items-center gap-2">
                    <div>
                        <div className="text-sm font-semibold text-gray-900">{fromCode}</div>
                        <div className="text-[10px] text-gray-400 truncate max-w-[72px]">{fromName}</div>
                    </div>
                    <div className="flex-1 border-t border-dashed border-gray-200" />
                    <div className="text-center shrink-0">
                        <div className="text-xs font-medium text-gray-900">{midCode}</div>
                        <div className="text-[10px] text-gray-400">switch</div>
                    </div>
                    <div className="flex-1 border-t border-dashed border-gray-200" />
                    <div className="text-right">
                        <div className="text-sm font-semibold text-gray-900">{toCode}</div>
                        <div className="text-[10px] text-gray-400 truncate max-w-[72px]">{toName}</div>
                    </div>
                </div>
                <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${statusCls}`}>{st}</span>
                    <span className="text-[10px] text-gray-400">Class {result.class1}/{result.class2}</span>
                </div>
            </div>
        );
    } else {
        const { fromCode, fromName, toCode, toName } = getQuotaStations(result);
        const st = result.status || '';
        const statusCls = getStatusCls(result.status);
        return (
            <div
                onClick={onClick}
                className="bg-white border border-[#E4E7EC] rounded-xl p-5 hover:border-gray-400 hover:shadow-sm cursor-pointer transition-all duration-150 animate-fade-up flex flex-col gap-4 w-full hover:bg-gray-50/50"
                style={{ animationDelay: `${index * 50}ms` }}
            >
                <div className="flex items-start justify-between">
                    <span className="text-xs text-gray-400 font-medium">Quota Hack</span>
                    <span className="text-lg font-bold text-gray-900">₹{result.fare || result.totalFare || '—'}</span>
                </div>
                <div className="flex items-center gap-2">
                    <div>
                        <div className="text-sm font-semibold text-gray-900">{fromCode}</div>
                        <div className="text-[10px] text-gray-400 truncate max-w-[80px]">{fromName}</div>
                    </div>
                    <div className="flex-1 border-t border-dashed border-gray-200" />
                    <div className="text-right">
                        <div className="text-sm font-semibold text-gray-900">{toCode}</div>
                        <div className="text-[10px] text-gray-400 truncate max-w-[80px]">{toName}</div>
                    </div>
                </div>
                <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${statusCls}`}>{st}</span>
                    <span className="text-[10px] text-gray-400">Class {result.class || '—'}</span>
                </div>
            </div>
        );
    }
};

// Typing dots indicator
const TypingDots = () => (
    <div className="flex items-center gap-1 px-4 py-3">
        {[0, 1, 2].map(i => (
            <span key={i} className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
        ))}
    </div>
);

// SSE streaming for optimize / multihop
const streamSSE = (url, token, onResult, onDone, onError) => {
    const evtSource = new EventSource(`${url}&token=${token}`);
    evtSource.onmessage = (e) => {
        try {
            const data = JSON.parse(e.data);
            if (data.type === 'result') onResult(data.data);
            else if (data.type === 'done') { onDone(); evtSource.close(); }
            else if (data.type === 'error') { onError(data.message); evtSource.close(); }
        } catch { /* ignore parse errors */ }
    };
    evtSource.onerror = () => { onError('Connection lost.'); evtSource.close(); };
    return evtSource;
};

/* ─── Main Chat Page ──────────────────────────────────────────── */
const Chat = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const bottomRef = useRef(null);
    const inputRef = useRef(null);

    const [messages, setMessages] = useState([
        {
            role: 'assistant',
            content: { reply: "Hey! I'm your RailPath AI assistant. Tell me where you want to go — just type naturally, like \"I want to go from New Delhi to Muzaffarpur on 23 July\".", action: 'NONE', params: {}, filters: {}, missingFields: [] },
            cards: null,
        }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);

    // Scroll to bottom whenever messages change
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Build the messages array for Gemini (serialize assistant replies as text)
    const buildGeminiMessages = useCallback((msgs) => {
        return msgs.map(m => ({
            role: m.role,
            content: m.role === 'user'
                ? m.content
                : (m.content?.reply || ''),
        }));
    }, []);

    const appendMessage = (msg) => setMessages(prev => [...prev, msg]);

    const appendCards = (cards) => {
        setMessages(prev => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last && last.role === 'assistant') {
                updated[updated.length - 1] = { ...last, cards: [...(last.cards || []), ...cards] };
            }
            return updated;
        });
    };

    // Run SSE optimization and stream cards into the last assistant message
    const runOptimizeStream = useCallback(async (params, geminiReply) => {
        const { trainNumber, source, destination, date, travelClass, optimizeMode } = params;
        const token = getToken();
        const classes = travelClass ? travelClass : 'SL,3A,2A,1A';

        appendMessage({
            role: 'assistant',
            content: { reply: geminiReply, action: 'TRIGGER_OPTIMIZE', params },
            cards: [],
            streaming: true,
        });

        let accumulatedResults = [];

        const processResult = (result) => {
            accumulatedResults.push(result);

            // Filter out waitlisted options if any available or RAC option is found
            const hasGood = accumulatedResults.some(res => {
                if (res.type === 'QUOTA_HACK') {
                    const s = (res.status || '').toUpperCase();
                    return s.includes('AVAILABLE') || s.includes('CURR_AV') || s.includes('RAC') || (s.includes('AVL') && !s.includes('NOT'));
                } else {
                    const s1 = (res.status1 || '').toUpperCase();
                    const s2 = (res.status2 || '').toUpperCase();
                    return (s1.includes('AVAILABLE') || s1.includes('RAC')) && (s2.includes('AVAILABLE') || s2.includes('RAC'));
                }
            });

            let filtered = [...accumulatedResults];
            if (hasGood) {
                filtered = accumulatedResults.filter(res => {
                    if (res.type === 'QUOTA_HACK') return !res.status.toUpperCase().includes('WL') && !res.status.toUpperCase().includes('WAITLIST');
                    return !res.status1.toUpperCase().includes('WL') && !res.status2.toUpperCase().includes('WL');
                });
            }

            // Sort: Quota Hack first, then Seat Switch, and descending by score
            filtered.sort((a, b) => {
                if (a.type !== b.type) return a.type === 'QUOTA_HACK' ? -1 : 1;
                return (b.score || 0) - (a.score || 0);
            });

            const sortedCards = filtered.map(item => ({ type: 'opt_result', data: item }));

            setMessages(prev => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last && last.role === 'assistant') {
                    updated[updated.length - 1] = { ...last, cards: sortedCards };
                }
                return updated;
            });
        };

        const url = `${API_BASE_URL}/trains/${trainNumber}/optimize-stream?source=${source}&destination=${destination}&date=${date}&travelClasses=${classes}&mode=${optimizeMode}`;
        streamSSE(url, token,
            (result) => processResult(result),
            () => setMessages(prev => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last) updated[updated.length - 1] = { ...last, streaming: false };
                return updated;
            }),
            (err) => {
                appendCards([{ type: 'error', data: err }]);
                setMessages(prev => { const u = [...prev]; if (u[u.length-1]) u[u.length-1] = { ...u[u.length-1], streaming: false }; return u; });
            }
        );
    }, []);

    const runMultiHopStream = useCallback(async (params, geminiReply) => {
        const { source, destination, date, maxHops = 1, minLayover = 30, sortBy = 'cheapest' } = params;
        const token = getToken();

        appendMessage({
            role: 'assistant',
            content: { reply: geminiReply, action: 'TRIGGER_MULTIHOP', params },
            cards: [],
            streaming: true,
        });

        const url = `${API_BASE_URL}/multi-hop/search-stream?source=${source}&destination=${destination}&date=${date}&maxHops=${maxHops}&minLayover=${minLayover}&sortBy=${sortBy}`;
        streamSSE(url, token,
            (result) => appendCards([{ type: 'multihop_result', data: result }]),
            () => setMessages(prev => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last) updated[updated.length - 1] = { ...last, streaming: false };
                return updated;
            }),
            (err) => {
                appendCards([{ type: 'error', data: err }]);
                setMessages(prev => { const u = [...prev]; if (u[u.length-1]) u[u.length-1] = { ...u[u.length-1], streaming: false }; return u; });
            }
        );
    }, []);

    const handleSend = useCallback(async (text) => {
        const trimmed = (text || input).trim();
        if (!trimmed || loading) return;

        setInput('');
        setLoading(true);

        const userMsg = { role: 'user', content: trimmed };
        const nextMessages = [...messages, userMsg];
        setMessages(nextMessages);

        try {
            const geminiMessages = buildGeminiMessages(nextMessages);
            const res = await api.post('/chat', { messages: geminiMessages });
            const gemini = res.data;
            const { action, params, reply, filters } = gemini;

            if (action === 'SHOW_TRAINS') {
                // Build list of source/destination combinations (handles ambiguous stations)
                const sources = params.alternateSource
                    ? (Array.isArray(params.alternateSource) ? params.alternateSource : [params.alternateSource])
                    : [params.source];
                const dests = params.alternateDest
                    ? (Array.isArray(params.alternateDest) ? params.alternateDest : [params.alternateDest])
                    : [params.destination];

                // Build unique pairs
                const pairs = [];
                for (const src of sources) {
                    for (const dst of dests) {
                        if (src && dst && src !== dst) pairs.push({ source: src, destination: dst });
                    }
                }
                if (!pairs.length && params.source && params.destination) {
                    pairs.push({ source: params.source, destination: params.destination });
                }

                // Fetch all pairs in parallel
                const allResponses = await Promise.all(
                    pairs.map(p => api.get('/trains', { params: { source: p.source, destination: p.destination, date: params.date } }).catch(() => null))
                );

                // Merge and deduplicate by trainNumber
                const seen = new Set();
                let trains = [];
                for (const r of allResponses) {
                    if (!r) continue;
                    for (const t of (r.data.trains || [])) {
                        const num = t.trainInfo?.trainNumber;
                        if (num && !seen.has(num)) { seen.add(num); trains.push(t); }
                    }
                }

                // Apply the exact same filtering and sorting as in the main app
                let filtered = trains;

                const isAvailable = (s) => {
                    const su = (s || '').toUpperCase();
                    return su.includes('AVAILABLE') || su.includes('CURR_AV') || su.includes('RAC') || (su.includes('AVL') && !su.includes('NOT'));
                };

                // 1. Availability filter (quickAvailable equivalent)
                if (filters?.anyAvailable) {
                    filtered = trains.filter(t =>
                        Object.values(t.availability || {}).some(a => isAvailable(a.status))
                    );
                }

                // 2. Class filter
                if (filters?.classes?.length > 0) {
                    filtered = filtered.filter(t =>
                        filters.classes.some(c => Object.keys(t.availability || {}).includes(c))
                    );
                }

                // 3. Train type filter
                if (filters?.trainTypes?.length > 0) {
                    filtered = filtered.filter(t => {
                        const name = (t.trainInfo?.trainName || '').toUpperCase();
                        return filters.trainTypes.some(type => {
                            if (type === 'Premium') return name.includes('RAJDHANI') || name.includes('SHATABDI') || name.includes('DURONTO') || name.includes('VANDE');
                            if (type === 'Express') return name.includes('EXP');
                            if (type === 'Superfast') return name.includes('SF');
                            return name.includes(type.toUpperCase());
                        });
                    });
                }

                // 4. Sort: departure_early (default sort in the main app)
                const parseTime = (t) => { if (!t) return 0; const [h, m] = t.split(':').map(Number); return h * 60 + m; };
                filtered.sort((a, b) => parseTime(a.trainInfo?.departureTime) - parseTime(b.trainInfo?.departureTime));

                const trainCards = filtered.slice(0, 8).map(t => ({ type: 'train', data: t }));
                const fromLabel = pairs.map(p => p.source).join('/');
                const toLabel = pairs.map(p => p.destination).join('/');

                const optionsReply = `Found ${filtered.length} train${filtered.length !== 1 ? 's' : ''} from ${fromLabel} to ${toLabel}.\n\nHere's what I can do next:\n\n**1** — Longer Route Booking\n**2** — Seat Switching\n**3** — Multi-Leg Route\n\nWhich would you like?`;

                appendMessage({
                    role: 'assistant',
                    content: { reply: optionsReply, action: 'PRESENT_OPTIONS', params },
                    cards: trainCards,
                });

            } else if (action === 'TRIGGER_OPTIMIZE') {
                await runOptimizeStream(params, reply);

            } else if (action === 'TRIGGER_MULTIHOP') {
                await runMultiHopStream(params, reply);

            } else {
                // CLARIFY / NONE / PRESENT_OPTIONS
                appendMessage({
                    role: 'assistant',
                    content: gemini,
                    cards: null,
                });
            }
        } catch (err) {
            console.error('[Chat] Error:', err?.response?.data || err.message);
            const backendReply = err?.response?.data?.reply;
            appendMessage({
                role: 'assistant',
                content: { reply: backendReply || "Something went wrong. Please try again.", action: 'NONE' },
                cards: null,
            });
        } finally {
            setLoading(false);
        }
    }, [input, loading, messages, buildGeminiMessages, runOptimizeStream, runMultiHopStream]);

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
    };

    const renderReply = (reply = '') => {
        // Convert **bold** and newlines to JSX
        return reply.split('\n').map((line, i) => {
            const parts = line.split(/\*\*(.*?)\*\*/g);
            return (
                <p key={i} className={i > 0 ? 'mt-1' : ''}>
                    {parts.map((part, j) =>
                        j % 2 === 1
                            ? <span key={j} className="font-semibold text-gray-900">{part}</span>
                            : <span key={j}>{part}</span>
                    )}
                </p>
            );
        });
    };

    return (
        <div className="flex flex-col h-screen bg-[#F7F8FA]">
            <Navbar />

            {/* Chat thread */}
            <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6 pb-32">
                <div className="max-w-2xl mx-auto space-y-6">
                    {messages.map((msg, idx) => (
                        <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-up`}>

                            {/* AI avatar */}
                            {msg.role === 'assistant' && (
                                <div className="shrink-0 w-7 h-7 rounded-full bg-gray-900 flex items-center justify-center mt-0.5">
                                    <span className="material-symbols-outlined text-white text-sm" style={{ fontVariationSettings: "'FILL' 0, 'wght' 200" }}>
                                        route
                                    </span>
                                </div>
                            )}

                            <div className={`max-w-[85%] space-y-3 ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col`}>
                                {/* Bubble */}
                                <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                                    msg.role === 'user'
                                        ? 'bg-gray-900 text-white rounded-tr-sm'
                                        : 'bg-white border border-[#E4E7EC] text-gray-600 rounded-tl-sm'
                                }`}>
                                    {msg.role === 'user'
                                        ? <p>{msg.content}</p>
                                        : <div className="space-y-0.5">{renderReply(msg.content?.reply || '')}</div>
                                    }
                                </div>

                                {/* Cards */}
                                {msg.cards && msg.cards.length > 0 && (
                                    <div className="w-full space-y-2">
                                        {msg.cards.map((card, ci) => {
                                            if (card.type === 'train') {
                                                return (
                                                    <div key={ci} className="w-full max-w-full overflow-hidden">
                                                        <TrainCard
                                                            trainObj={card.data}
                                                            date={msg.content.params?.date || ''}
                                                            source={msg.content.params?.source || ''}
                                                            destination={msg.content.params?.destination || ''}
                                                            index={ci}
                                                            chatMode={true}
                                                            onTrainClick={(trainInfo) => {
                                                                handleSend(trainInfo.trainNumber);
                                                            }}
                                                            onClassClick={(trainInfo, cls) => {
                                                                handleSend(`${trainInfo.trainNumber} ${cls}`);
                                                            }}
                                                        />
                                                    </div>
                                                );
                                            }
                                            if (card.type === 'opt_result') {
                                                return (
                                                    <OptResultCard
                                                        key={ci}
                                                        result={card.data}
                                                        index={ci}
                                                        onClick={() => {
                                                            const tNo = card.data.trainNumber || card.data.TrainNo || '';
                                                            if (card.data.type === 'SEAT_SWITCH') {
                                                                const splitCode = card.data.splitStation?.StationCode || card.data.splitStation?.stationCode || '';
                                                                handleSend(`Book Seat Switch on train ${tNo} via ${splitCode}`);
                                                            } else {
                                                                const quota = card.data.quotaDisplayName || card.data.quota || '';
                                                                handleSend(`Book Quota Hack on train ${tNo} via ${quota}`);
                                                            }
                                                        }}
                                                    />
                                                );
                                            }
                                            if (card.type === 'multihop_result') {
                                                return (
                                                    <div key={ci} className="w-full max-w-full overflow-hidden">
                                                        <MultiHopCard
                                                            route={card.data}
                                                            style={{ animationDelay: `${ci * 60}ms` }}
                                                        />
                                                    </div>
                                                );
                                            }
                                            if (card.type === 'error') return (
                                                <div key={ci} className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                                                    {card.data}
                                                </div>
                                            );
                                            return null;
                                        })}
                                        {msg.streaming && (
                                            <div className="flex items-center gap-2 text-[10px] text-gray-400 pt-1">
                                                <div className="flex gap-1">
                                                    {[0,1,2].map(i => <span key={i} className="w-1 h-1 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: `${i*0.15}s` }} />)}
                                                </div>
                                                Searching...
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* User avatar */}
                            {msg.role === 'user' && (
                                <div className="shrink-0 w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center mt-0.5">
                                    <span className="material-symbols-outlined text-gray-600 text-sm" style={{ fontVariationSettings: "'FILL' 0, 'wght' 200" }}>
                                        person
                                    </span>
                                </div>
                            )}
                        </div>
                    ))}

                    {loading && (
                        <div className="flex gap-3 justify-start animate-fade-up">
                            <div className="shrink-0 w-7 h-7 rounded-full bg-gray-900 flex items-center justify-center">
                                <span className="material-symbols-outlined text-white text-sm" style={{ fontVariationSettings: "'FILL' 0, 'wght' 200" }}>route</span>
                            </div>
                            <div className="bg-white border border-[#E4E7EC] rounded-2xl rounded-tl-sm">
                                <TypingDots />
                            </div>
                        </div>
                    )}

                    <div ref={bottomRef} />
                </div>
            </div>

            {/* Input bar — fixed at bottom */}
            <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t border-[#E4E7EC] px-4 py-4">
                <div className="max-w-2xl mx-auto">
                    {/* Quick prompts */}
                    {messages.length === 1 && (
                        <div className="flex flex-wrap gap-2 mb-3">
                            {[
                                'New Delhi to Muzaffarpur on 23 July',
                                'Mumbai to Kolkata, next Saturday',
                                'Trains from Bangalore to Chennai today',
                            ].map(prompt => (
                                <button
                                    key={prompt}
                                    onClick={() => handleSend(prompt)}
                                    className="text-xs text-gray-500 bg-gray-100 hover:bg-gray-200 border border-[#E4E7EC] px-3 py-1.5 rounded-full transition-colors"
                                >
                                    {prompt}
                                </button>
                            ))}
                        </div>
                    )}

                    <div className="flex items-end gap-3 bg-white border border-[#E4E7EC] rounded-2xl px-4 py-3 shadow-sm">
                        <textarea
                            ref={inputRef}
                            rows={1}
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Where do you want to go?"
                            className="flex-1 resize-none bg-transparent text-sm text-gray-900 placeholder-gray-400 outline-none leading-relaxed max-h-32"
                            style={{ minHeight: '24px' }}
                        />
                        <button
                            onClick={() => handleSend()}
                            disabled={!input.trim() || loading}
                            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-xl bg-gray-900 text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-700 transition-colors active:scale-95"
                        >
                            <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 0, 'wght' 300" }}>
                                arrow_upward
                            </span>
                        </button>
                    </div>
                    <p className="text-[10px] text-gray-400 text-center mt-2">RailPath AI · Powered by Gemini</p>
                </div>
            </div>
        </div>
    );
};

export default Chat;
