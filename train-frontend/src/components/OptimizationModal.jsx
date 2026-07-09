import React, { useEffect, useState } from 'react';
import { API_BASE_URL } from '../api';

const OptimizationModal = ({ isOpen, onClose, trainInfo, travelClass, source, destination, date }) => {
    const [activeTab, setActiveTab] = useState('QUOTA');
    const [mode, setMode] = useState('QUOTA');
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [aiResults, setAiResults] = useState([]);
    const [progress, setProgress] = useState({ completed: 0, total: 0, message: '' });
    const [aiError, setAiError] = useState('');
    const [selectedOption, setSelectedOption] = useState(null);
    const [hasPerfectQuota, setHasPerfectQuota] = useState(false);
    const [hasPerfectExactSplit, setHasPerfectExactSplit] = useState(false);
    const [quotaFinished, setQuotaFinished] = useState(false);
    const [exactSplitFinished, setExactSplitFinished] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        setActiveTab('QUOTA'); setMode('QUOTA');
        setHasPerfectQuota(false); setHasPerfectExactSplit(false);
        setQuotaFinished(false); setExactSplitFinished(false);
        setSelectedOption(null);
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen || !travelClass || !mode) return;
        setAiResults(mode === 'SPLIT_EXTENDED' ? aiResults : []);
        setProgress({ completed: 0, total: 0, message: 'Initializing...' });
        setAiError('');
        setIsAiLoading(true);

        const storedUser = localStorage.getItem('user');
        const token = storedUser ? JSON.parse(storedUser).token : '';
        const queryParams = new URLSearchParams({
            source: source || trainInfo.fromStationCode,
            destination: destination || trainInfo.toStationCode,
            date, travelClasses: travelClass, mode, token
        });

        const evtSource = new EventSource(`${API_BASE_URL}/trains/${trainInfo.trainNumber}/optimize-stream?${queryParams.toString()}`);

        evtSource.onmessage = (event) => {
            try {
                const parsed = JSON.parse(event.data);
                if (parsed.type === 'progress') {
                    setProgress({ completed: parsed.completed, total: parsed.total, message: parsed.message });
                } else if (parsed.type === 'result') {
                    setAiResults(prev => {
                        const newResults = [...prev, parsed.data];
                        const r = parsed.data;
                        if (r.type === 'QUOTA_HACK') {
                            if (r.status.toUpperCase().includes('AVAILABLE') && !r.status.toUpperCase().includes('NOT')) setHasPerfectQuota(true);
                        } else if (r.type === 'SEAT_SWITCH') {
                            const s1 = r.status1.toUpperCase(), s2 = r.status2.toUpperCase();
                            if ((s1.includes('AVAILABLE') || s1.includes('RAC')) && (s2.includes('AVAILABLE') || s2.includes('RAC'))) {
                                if (mode === 'SPLIT_EXACT') setHasPerfectExactSplit(true);
                            }
                        }
                        const hasGood = newResults.some(res => {
                            if (res.type === 'QUOTA_HACK') return res.status.toUpperCase().includes('AVAILABLE') || res.status.toUpperCase().includes('RAC');
                            return (res.status1.toUpperCase().includes('AVAILABLE') || res.status1.toUpperCase().includes('RAC')) && (res.status2.toUpperCase().includes('AVAILABLE') || res.status2.toUpperCase().includes('RAC'));
                        });
                        let filtered = newResults;
                        if (hasGood) {
                            filtered = newResults.filter(res => {
                                if (res.type === 'QUOTA_HACK') return !res.status.toUpperCase().includes('WL') && !res.status.toUpperCase().includes('WAITLIST');
                                return !res.status1.toUpperCase().includes('WL') && !res.status2.toUpperCase().includes('WL');
                            });
                        }
                        return filtered.sort((a, b) => { if (a.type !== b.type) return a.type === 'QUOTA_HACK' ? -1 : 1; return b.score - a.score; });
                    });
                } else if (parsed.type === 'done') {
                    setIsAiLoading(false);
                    setProgress(p => ({ ...p, message: 'Complete' }));
                    if (mode === 'QUOTA') setQuotaFinished(true);
                    if (mode === 'SPLIT_EXACT') setExactSplitFinished(true);
                    evtSource.close();
                } else if (parsed.type === 'error') {
                    setAiError(parsed.message || 'Server error.');
                    setIsAiLoading(false);
                    if (mode === 'QUOTA') setQuotaFinished(true);
                    if (mode === 'SPLIT_EXACT') setExactSplitFinished(true);
                    evtSource.close();
                }
            } catch (err) { console.error('SSE parse error', err); }
        };

        evtSource.onerror = () => {
            setAiError('Connection lost.');
            setIsAiLoading(false);
            if (mode === 'QUOTA') setQuotaFinished(true);
            if (mode === 'SPLIT_EXACT') setExactSplitFinished(true);
            evtSource.close();
        };

        return () => evtSource.close();
    }, [isOpen, trainInfo, travelClass, source, destination, date, mode]);

    if (!isOpen) return null;

    const percent = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;

    const getStatusCls = (st) => {
        const s = (st || '').toUpperCase();
        if (s.includes('AVAILABLE') || s.includes('CURR_AV') || s.includes('AVL')) return 'text-green-700 bg-green-50 border-green-200';
        if (s.includes('RAC')) return 'text-amber-700 bg-amber-50 border-amber-200';
        if (s.includes('WL') || s.includes('WAIT')) return 'text-red-700 bg-red-50 border-red-200';
        return 'text-gray-600 bg-gray-100 border-gray-200';
    };

    /* ── Station helpers ── */
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

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-4 animate-fade-in">
            <div className="bg-white w-full max-w-5xl max-h-[92vh] rounded-xl shadow-xl overflow-hidden flex flex-col animate-scale-in">
                <div className="flex items-center justify-between px-5 py-4 border-b border-[#E4E7EC] shrink-0">
                    <div>
                        <h2 className="text-base font-semibold text-gray-900">Seat Optimizer</h2>
                        <p className="text-xs text-gray-400 mt-0.5">{trainInfo.trainNumber} · {trainInfo.trainName} · {travelClass} class</p>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors">
                        <span className="material-symbols-outlined text-base">close</span>
                    </button>
                </div>

                <div className="flex border-b border-[#E4E7EC] px-5 gap-6 shrink-0">
                    <button
                        onClick={() => { if (!isAiLoading) { setActiveTab('QUOTA'); setMode('QUOTA'); } }}
                        className={`pb-3 pt-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'QUOTA' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                    >
                        Quota Hack
                    </button>
                    <button
                        onClick={() => { if (!isAiLoading && quotaFinished) { setActiveTab('SPLIT'); setMode('SPLIT_EXACT'); } }}
                        disabled={!quotaFinished || isAiLoading}
                        className={`pb-3 pt-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'SPLIT' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-400'} ${(!quotaFinished || isAiLoading) && activeTab !== 'SPLIT' ? 'opacity-40 cursor-not-allowed' : 'hover:text-gray-600'}`}
                    >
                        Seat Switch
                    </button>
                </div>

                {isAiLoading && (
                    <div className="px-6 py-4 border-b border-[#E4E7EC] bg-[#F7F8FA] shrink-0 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="loader-dots"><span></span><span></span><span></span></div>
                            <p className="text-xs font-medium text-gray-700">{progress.message}</p>
                        </div>
                        {progress.total > 0 && (
                            <span className="text-[10px] text-gray-400 font-medium bg-white border border-[#E4E7EC] px-2 py-0.5 rounded-full">
                                {progress.completed}/{progress.total} checked
                            </span>
                        )}
                    </div>
                )}

                <div className="flex-1 overflow-y-auto p-5 bg-[#F7F8FA] space-y-4">
                    {aiError && (
                        <div className="border border-red-200 bg-red-50 text-red-700 text-sm p-3 rounded-lg flex items-center gap-2">
                            <span className="material-symbols-outlined text-base">error</span>
                            {aiError}
                        </div>
                    )}

                    {!isAiLoading && aiResults.length === 0 && !aiError && (
                        <div className="bg-white border border-[#E4E7EC] rounded-xl p-12 text-center">
                            <span className="material-symbols-outlined text-3xl text-gray-300 block mb-3">search_off</span>
                            <h3 className="text-base font-semibold text-gray-900 mb-1">No optimizations found</h3>
                            <p className="text-sm text-gray-400 max-w-sm mx-auto">All combinations are fully booked for this class right now.</p>
                        </div>
                    )}

                    {aiResults.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {aiResults.map((opt, idx) => {
                                const isSwitch = opt.type === 'SEAT_SWITCH';
                                const st = isSwitch
                                    ? `${opt.status1 || ''} + ${opt.status2 || ''}`
                                    : (opt.status || '');
                                const statusCls = getStatusCls(isSwitch ? opt.status1 : opt.status);

                                if (isSwitch) {
                                    const { fromCode, fromName, midCode, midName, toCode, toName } = getSwitchStations(opt);
                                    return (
                                        <div
                                            key={idx}
                                            onClick={() => setSelectedOption(opt)}
                                            className="bg-white border border-[#E4E7EC] rounded-xl p-5 cursor-pointer hover:border-gray-300 hover:-translate-y-0.5 hover:shadow-sm transition-all duration-150 animate-fade-up flex flex-col gap-4"
                                            style={{ animationDelay: `${idx * 50}ms` }}
                                        >
                                            <div className="flex items-start justify-between">
                                                <span className="text-xs text-gray-400">Seat Switch</span>
                                                <span className="text-lg font-bold text-gray-900">₹{opt.totalFare || opt.fare || '—'}</span>
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
                                                <span className="text-[10px] text-gray-400">Class {opt.class1}/{opt.class2}</span>
                                            </div>
                                            <button className="w-full border border-gray-900 text-gray-900 text-xs font-medium py-2.5 rounded-lg hover:bg-gray-900 hover:text-white active:scale-95 transition-all duration-150">
                                                View &amp; Book
                                            </button>
                                        </div>
                                    );
                                } else {
                                    const { fromCode, fromName, toCode, toName } = getQuotaStations(opt);
                                    return (
                                        <div
                                            key={idx}
                                            onClick={() => setSelectedOption(opt)}
                                            className="bg-white border border-[#E4E7EC] rounded-xl p-5 cursor-pointer hover:border-gray-300 hover:-translate-y-0.5 hover:shadow-sm transition-all duration-150 animate-fade-up flex flex-col gap-4"
                                            style={{ animationDelay: `${idx * 50}ms` }}
                                        >
                                            <div className="flex items-start justify-between">
                                                <span className="text-xs text-gray-400">Quota Hack</span>
                                                <span className="text-lg font-bold text-gray-900">₹{opt.fare || opt.totalFare || '—'}</span>
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
                                                <span className="text-[10px] text-gray-400">Class {opt.class || '—'}</span>
                                            </div>
                                            <button className="w-full border border-gray-900 text-gray-900 text-xs font-medium py-2.5 rounded-lg hover:bg-gray-900 hover:text-white active:scale-95 transition-all duration-150">
                                                View &amp; Book
                                            </button>
                                        </div>
                                    );
                                }
                            })}
                        </div>
                    )}

                    {!isAiLoading && activeTab === 'QUOTA' && quotaFinished && !hasPerfectQuota && (
                        <div className="bg-white border border-[#E4E7EC] rounded-xl p-6 text-center animate-fade-up" style={{ animationDelay: '100ms' }}>
                            <h4 className="text-base font-semibold text-gray-900 mb-1">Still waitlisted?</h4>
                            <p className="text-sm text-gray-400 mb-4 max-w-sm mx-auto">Try seat switching — book two shorter legs on the same train and switch seats mid-journey.</p>
                            <button
                                onClick={() => { setActiveTab('SPLIT'); setMode('SPLIT_EXACT'); }}
                                className="bg-gray-900 text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-gray-800 transition-colors"
                            >
                                Try Seat Switch
                            </button>
                        </div>
                    )}

                    {!isAiLoading && activeTab === 'SPLIT' && exactSplitFinished && !hasPerfectExactSplit && mode !== 'SPLIT_EXTENDED' && (
                        <div className="bg-white border border-[#E4E7EC] rounded-xl p-6 text-center animate-fade-up" style={{ animationDelay: '100ms' }}>
                            <h4 className="text-base font-semibold text-gray-900 mb-1">Want a deeper search?</h4>
                            <p className="text-sm text-gray-400 mb-4 max-w-sm mx-auto">Extended search scans surrounding stations and extended quota pools for hidden confirmed combinations.</p>
                            <button
                                onClick={() => setMode('SPLIT_EXTENDED')}
                                className="bg-gray-900 text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-gray-800 transition-colors"
                            >
                                Deep Search
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {selectedOption && (
                <div
                    className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/50 animate-fade-in"
                    onClick={() => setSelectedOption(null)}
                >
                    <div
                        className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[88vh] overflow-y-auto animate-scale-in"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between p-5 border-b border-[#E4E7EC]">
                            <div>
                                <h3 className="text-base font-semibold text-gray-900">
                                    {selectedOption.type === 'QUOTA_HACK' ? 'Quota Extension Route' : 'Seat Switch Route'}
                                </h3>
                                <p className="text-xs text-gray-400 mt-0.5">{date} · {trainInfo.trainNumber} {trainInfo.trainName}</p>
                            </div>
                            <button onClick={() => setSelectedOption(null)} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors">
                                <span className="material-symbols-outlined text-base">close</span>
                            </button>
                        </div>

                        <div className="p-5 border-b border-[#E4E7EC]">
                            {selectedOption.type === 'SEAT_SWITCH' ? (() => {
                                const { fromCode, fromName, midCode, midName, toCode, toName } = getSwitchStations(selectedOption);
                                return (
                                    <div className="flex items-center gap-3">
                                        <div>
                                            <div className="text-lg font-bold text-gray-900">{fromCode}</div>
                                            <div className="text-xs text-gray-400">{fromName}</div>
                                        </div>
                                        <div className="flex-1 border-t border-dashed border-gray-200" />
                                        <div className="text-center shrink-0">
                                            <div className="text-sm font-semibold text-gray-900">{midCode}</div>
                                            <div className="text-[10px] text-gray-400">{midName}</div>
                                            <div className="text-[10px] text-gray-400 mt-0.5">switch here</div>
                                        </div>
                                        <div className="flex-1 border-t border-dashed border-gray-200" />
                                        <div className="text-right">
                                            <div className="text-lg font-bold text-gray-900">{toCode}</div>
                                            <div className="text-xs text-gray-400">{toName}</div>
                                        </div>
                                    </div>
                                );
                            })() : (() => {
                                const { fromCode, fromName, toCode, toName } = getQuotaStations(selectedOption);
                                return (
                                    <div className="flex items-center gap-3">
                                        <div>
                                            <div className="text-lg font-bold text-gray-900">{fromCode}</div>
                                            <div className="text-xs text-gray-400">{fromName}</div>
                                        </div>
                                        <div className="flex-1 border-t border-dashed border-gray-200" />
                                        <div className="text-right">
                                            <div className="text-lg font-bold text-gray-900">{toCode}</div>
                                            <div className="text-xs text-gray-400">{toName}</div>
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>

                        <div className="p-5 space-y-3">
                            {selectedOption.type === 'SEAT_SWITCH' ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {[
                                        {
                                            label: '1st Ticket',
                                            cls: selectedOption.class1,
                                            status: selectedOption.status1,
                                            from: (selectedOption.boardStation?.StationCode || '').toUpperCase(),
                                            fromName: selectedOption.boardStation?.StationName,
                                            to: (selectedOption.splitStation?.StationCode || '').toUpperCase(),
                                            toName: selectedOption.splitStation?.StationName,
                                            fare: selectedOption.fare1 || Math.round((selectedOption.fare || selectedOption.totalFare || 1100) / 2),
                                            leg: 1
                                        },
                                        {
                                            label: '2nd Ticket',
                                            cls: selectedOption.class2,
                                            status: selectedOption.status2,
                                            from: (selectedOption.splitStation?.StationCode || '').toUpperCase(),
                                            fromName: selectedOption.splitStation?.StationName,
                                            to: (selectedOption.alightStation?.StationCode || '').toUpperCase(),
                                            toName: selectedOption.alightStation?.StationName,
                                            fare: selectedOption.fare2 || Math.round((selectedOption.fare || selectedOption.totalFare || 1100) / 2),
                                            leg: 2
                                        }
                                    ].map((ticket, ti) => (
                                        <div key={ti} className="border border-[#E4E7EC] rounded-xl p-4 space-y-3">
                                            <div className="flex items-center justify-between">
                                                <p className="text-xs text-gray-400">{ticket.label} · {ticket.cls}</p>
                                                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${getStatusCls(ticket.status)}`}>{ticket.status}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div>
                                                    <div className="text-sm font-semibold text-gray-900">{ticket.from}</div>
                                                    <div className="text-[10px] text-gray-400 truncate max-w-[72px]">{ticket.fromName}</div>
                                                </div>
                                                <div className="flex-1 border-t border-dashed border-gray-200" />
                                                <div className="text-right">
                                                    <div className="text-sm font-semibold text-gray-900">{ticket.to}</div>
                                                    <div className="text-[10px] text-gray-400 truncate max-w-[72px]">{ticket.toName}</div>
                                                </div>
                                            </div>
                                            <button className="w-full border border-gray-900 text-gray-900 text-xs font-medium py-2 rounded-lg hover:bg-gray-900 hover:text-white transition-colors">
                                                Book Leg {ticket.leg} (₹{ticket.fare})
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            ) : (() => {
                                const { fromCode, fromName, toCode, toName } = getQuotaStations(selectedOption);
                                return (
                                    <div className="border border-[#E4E7EC] rounded-xl p-4 space-y-3 max-w-md mx-auto">
                                        <div className="flex items-center justify-between">
                                            <p className="text-xs text-gray-400">Single continuous ticket · Class {selectedOption.class || '3A'}</p>
                                            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${getStatusCls(selectedOption.status)}`}>{selectedOption.status}</span>
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
                                        <button className="w-full bg-gray-900 text-white text-sm font-medium py-2.5 rounded-lg hover:bg-gray-800 transition-colors">
                                            Book Ticket (₹{selectedOption.fare || selectedOption.totalFare || '—'})
                                        </button>
                                    </div>
                                );
                            })()}
                        </div>

                        <div className="p-5 border-t border-[#E4E7EC] flex flex-col sm:flex-row items-center justify-between gap-4">
                            <div>
                                <p className="text-2xl font-bold text-gray-900">₹{selectedOption.fare || selectedOption.totalFare || '—'}</p>
                                <p className="text-xs text-gray-400">Total fare</p>
                            </div>
                            <button
                                onClick={() => alert('Redirecting to IRCTC for ' + (selectedOption.type === 'QUOTA_HACK' ? 'quota hack booking' : 'split seat booking'))}
                                className="bg-gray-900 text-white text-sm font-medium px-6 py-2.5 rounded-lg hover:bg-gray-800 transition-colors flex items-center gap-2"
                            >
                                Proceed to Book
                                <span className="material-symbols-outlined text-base">arrow_forward</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default OptimizationModal;
