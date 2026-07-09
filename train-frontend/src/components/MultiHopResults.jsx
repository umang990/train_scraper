import React, { useState, useMemo, useRef, useCallback } from 'react';
import { API_BASE_URL } from '../api';
import MultiHopCard from './MultiHopCard';

const MultiHopResults = ({ source, destination, date }) => {
    const [maxHops, setMaxHops] = useState(1);
    const [sortBy, setSortBy] = useState('cheapest');
    const [minLayover, setMinLayover] = useState(0);
    const [isSearching, setIsSearching] = useState(false);
    const [routes, setRoutes] = useState([]);
    const [progress, setProgress] = useState({ completed: 0, total: 0, message: '' });
    const [error, setError] = useState('');
    const [searchDone, setSearchDone] = useState(false);
    const [selectedRoute, setSelectedRoute] = useState(null);
    const abortRef = useRef(null);

    const handleSearch = useCallback(async () => {
        if (abortRef.current) abortRef.current.abort();
        const controller = new AbortController();
        abortRef.current = controller;
        setIsSearching(true);
        setRoutes([]);
        setSelectedRoute(null);
        setProgress({ completed: 0, total: 0, message: 'Initializing search...' });
        setError('');
        setSearchDone(false);

        try {
            const token = JSON.parse(localStorage.getItem('user'))?.token;
            const params = new URLSearchParams({ source, destination, date, maxHops: maxHops.toString(), sortBy, minLayover: minLayover.toString() });
            const response = await fetch(`${API_BASE_URL}/multi-hop/search-stream?${params.toString()}`, {
                headers: { 'Authorization': `Bearer ${token}` },
                signal: controller.signal
            });
            if (!response.ok) throw new Error(`Server error: ${response.status}`);
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop();
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            if (data.type === 'progress') setProgress({ completed: data.completed || 0, total: data.total || 0, message: data.message || 'Scanning...' });
                            else if (data.type === 'result') setRoutes(prev => [...prev, data.data]);
                            else if (data.type === 'done') { setIsSearching(false); setSearchDone(true); setProgress(p => ({ ...p, message: 'Search complete' })); }
                            else if (data.type === 'error') { setError(data.message || 'An error occurred.'); setIsSearching(false); setSearchDone(true); }
                        } catch (e) { console.error('Parse error:', e); }
                    }
                }
            }
            setIsSearching(false);
            setSearchDone(true);
        } catch (err) {
            if (err.name === 'AbortError') return;
            setError(err.message || 'Failed to connect.');
            setIsSearching(false);
            setSearchDone(true);
        }
    }, [source, destination, date, maxHops, sortBy]);

    const filteredRoutes = useMemo(() => {
        let list = [...routes];
        list = list.filter(route => {
            if (!route.legs || route.legs.length === 0) return false;
            return route.legs.every(leg => {
                if (!leg || !leg.classes) return false;
                return Object.values(leg.classes).some(c => {
                    const st = (c.status || '').toUpperCase();
                    return st.includes('AVAILABLE') || st.includes('CURR_AV') || st.includes('RAC') || (st.includes('AVL') && !st.includes('NOT'));
                });
            });
        });
        if (minLayover > 0) {
            list = list.filter(route => {
                if (!route.connections || route.connections.length === 0) return true;
                return route.connections.every(conn => (conn.layoverMins || 0) >= minLayover);
            });
        }
        list.sort((a, b) => {
            if (sortBy === 'cheapest') return (a.totalFare || Infinity) - (b.totalFare || Infinity);
            if (sortBy === 'fastest') return (a.totalDurationMins || Infinity) - (b.totalDurationMins || Infinity);
            if (sortBy === 'layover') return (a.totalLayoverMins || Infinity) - (b.totalLayoverMins || Infinity);
            return 0;
        });
        return list.slice(0, 35);
    }, [routes, minLayover, sortBy]);

    const formatDuration = (mins) => {
        if (!mins && mins !== 0) return '—';
        const h = Math.floor(mins / 60), m = mins % 60;
        if (h === 0) return `${m}m`;
        if (m === 0) return `${h}h`;
        return `${h}h ${m}m`;
    };

    const progressPercent = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;

    const SegmentBtn = ({ active, onClick, children }) => (
        <button onClick={onClick}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${active
                ? 'bg-gray-900 text-white'
                : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'}`}>
            {children}
        </button>
    );

    return (
        <div className="w-full space-y-4">
            {/* Controls */}
            <div className="bg-white border border-[#E4E7EC] rounded-xl p-4 animate-fade-up">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="text-sm font-semibold text-gray-900">Multi-Hop Routes</h3>
                        <p className="text-xs text-gray-400 mt-0.5">{source} → {destination} · {date}</p>
                    </div>
                    <button
                        onClick={handleSearch}
                        disabled={isSearching}
                        className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors hover:scale-[1.02] active:scale-[0.98] transition-transform duration-150 ${isSearching
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-gray-900 text-white hover:bg-gray-800'}`}
                    >
                        <span
                            className="material-symbols-outlined text-base"
                            style={{ fontVariationSettings: "'FILL' 0, 'wght' 200" }}
                        >
                            {isSearching ? 'progress_activity' : 'search'}
                        </span>
                        {isSearching ? 'Searching...' : 'Find Routes'}
                    </button>
                </div>

                <div className="flex flex-wrap items-center gap-6">
                    <div>
                        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">Max Changes</p>
                        <div className="flex bg-gray-100 rounded-lg p-0.5 gap-0.5">
                            {[1, 2].map(num => (
                                <SegmentBtn key={num} active={maxHops === num} onClick={() => setMaxHops(num)}>
                                    {num} {num === 1 ? 'Change' : 'Changes'}
                                </SegmentBtn>
                            ))}
                        </div>
                    </div>

                    <div>
                        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">Sort By</p>
                        <div className="flex bg-gray-100 rounded-lg p-0.5 gap-0.5">
                            {[{ id: 'cheapest', label: 'Cheapest' }, { id: 'fastest', label: 'Fastest' }, { id: 'layover', label: 'Min Layover' }].map(opt => (
                                <SegmentBtn key={opt.id} active={sortBy === opt.id} onClick={() => setSortBy(opt.id)}>
                                    {opt.label}
                                </SegmentBtn>
                            ))}
                        </div>
                    </div>

                    <div>
                        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">Min Layover</p>
                        <div className="flex bg-gray-100 rounded-lg p-0.5 gap-0.5 flex-wrap">
                            {[{ mins: 0, label: 'Any' }, { mins: 30, label: '30m' }, { mins: 45, label: '45m' }, { mins: 60, label: '1h' }, { mins: 90, label: '1.5h' }].map(opt => (
                                <SegmentBtn key={opt.mins} active={minLayover === opt.mins} onClick={() => setMinLayover(opt.mins)}>
                                    {opt.label}
                                </SegmentBtn>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Progress */}
            {isSearching && (
                <div className="bg-white border border-[#E4E7EC] rounded-xl p-4 flex items-center justify-between animate-fade-in">
                    <div className="flex items-center gap-3">
                        <div className="loader-dots"><span></span><span></span><span></span></div>
                        <p className="text-xs font-medium text-gray-700">{progress.message}</p>
                    </div>
                    {progress.total > 0 && (
                        <div className="text-right">
                            <span className="text-[10px] text-gray-400 font-medium bg-[#F7F8FA] border border-[#E4E7EC] px-2 py-0.5 rounded-full">
                                {progress.completed}/{progress.total} scanned
                            </span>
                        </div>
                    )}
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="border border-red-200 bg-red-50 text-red-700 text-sm p-4 rounded-xl flex items-center gap-2">
                    <span
                        className="material-symbols-outlined text-base"
                        style={{ fontVariationSettings: "'FILL' 0, 'wght' 200" }}
                    >
                        error
                    </span>
                    {error}
                </div>
            )}

            {/* Results */}
            {filteredRoutes.length > 0 && (
                <div className="space-y-3">
                    <div className="flex items-center justify-between px-1">
                        <p className="text-xs font-medium text-gray-400">
                            {filteredRoutes.length} route{filteredRoutes.length !== 1 ? 's' : ''} found
                            {minLayover > 0 && ` · ${minLayover}min+ layover`}
                        </p>
                        {searchDone && routes.length !== filteredRoutes.length && (
                            <p className="text-xs text-gray-400">Showing {filteredRoutes.length} of {routes.length}</p>
                        )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {filteredRoutes.map((route, idx) => (
                            <MultiHopCard
                                key={idx}
                                route={route}
                                onSelect={() => setSelectedRoute(route)}
                                style={{ animationDelay: `${Math.min(idx * 50, 400)}ms` }}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* Selected Route Modal */}
            {selectedRoute && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-fade-in"
                    onClick={() => setSelectedRoute(null)}
                >
                    <div
                        className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto animate-scale-in"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className="flex items-center justify-between p-5 border-b border-[#E4E7EC]">
                            <div>
                                <h3 className="text-base font-semibold text-gray-900">Connecting Journey</h3>
                                <p className="text-xs text-gray-400 mt-0.5">
                                    {source} → {destination} · {selectedRoute.connections.length} change{selectedRoute.connections.length !== 1 ? 's' : ''}
                                </p>
                            </div>
                            <button onClick={() => setSelectedRoute(null)}
                                className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors active:scale-95">
                                <span
                                    className="material-symbols-outlined text-base"
                                    style={{ fontVariationSettings: "'FILL' 0, 'wght' 200" }}
                                >
                                    close
                                </span>
                            </button>
                        </div>

                        {/* Route Strip */}
                        <div className="p-5 border-b border-[#E4E7EC]">
                            <div className="flex items-center gap-2 flex-wrap">
                                <div className="flex flex-col">
                                    <span className="text-xs text-gray-400">Board at</span>
                                    <span className="text-base font-bold text-gray-900">
                                        {selectedRoute.legs[0]?.from?.code || selectedRoute.legs[0]?.fromStationCode || selectedRoute.legs[0]?.source || '—'}
                                    </span>
                                    <span className="text-xs text-gray-400">{selectedRoute.legs[0]?.departureTime || selectedRoute.legs[0]?.departure || ''}</span>
                                </div>

                                {selectedRoute.connections.map((conn, cIdx) => (
                                    <React.Fragment key={cIdx}>
                                        <span className="text-gray-300 text-xs">→</span>
                                        <div className="border border-amber-200 bg-amber-50 rounded-lg px-3 py-1.5 text-center">
                                            <span className="text-[10px] text-amber-600 uppercase tracking-wide block">Change train</span>
                                            <span className="text-xs font-semibold text-amber-900">
                                                {conn.stationName || conn.station || conn.stationCode || '—'}
                                            </span>
                                            <span className="text-[10px] text-amber-600 block">{formatDuration(conn.layoverMins)} wait</span>
                                        </div>
                                        <span className="text-gray-300 text-xs">→</span>
                                    </React.Fragment>
                                ))}

                                <div className="flex flex-col">
                                    <span className="text-xs text-gray-400">Get off at</span>
                                    <span className="text-base font-bold text-gray-900">
                                        {selectedRoute.legs[selectedRoute.legs.length - 1]?.to?.code || selectedRoute.legs[selectedRoute.legs.length - 1]?.toStationCode || selectedRoute.legs[selectedRoute.legs.length - 1]?.destination || '—'}
                                    </span>
                                    <span className="text-xs text-gray-400">{selectedRoute.legs[selectedRoute.legs.length - 1]?.arrivalTime || selectedRoute.legs[selectedRoute.legs.length - 1]?.arrival || ''}</span>
                                </div>
                            </div>
                        </div>

                        {/* Leg Cards */}
                        <div className="p-5 space-y-3">
                            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Individual Trains to Book</p>
                            <div className={`grid grid-cols-1 ${selectedRoute.legs.length === 2 ? 'md:grid-cols-2' : 'md:grid-cols-3'} gap-3`}>
                                {selectedRoute.legs.map((leg, lIdx) => {
                                    const classes = leg.classes ? Object.entries(leg.classes) : [];
                                    const bestCls = classes[0] || ['3A', { status: 'AVAILABLE', fare: 800 }];
                                    const clsInfo = typeof bestCls[1] === 'string' ? { status: bestCls[1] } : bestCls[1];
                                    const fromCode = leg.from?.code || leg.fromStationCode || leg.source || '—';
                                    const toCode = leg.to?.code || leg.toStationCode || leg.destination || '—';
                                    const depTime = leg.departureTime || leg.departure || '—';
                                    const arrTime = leg.arrivalTime || leg.arrival || '—';
                                    return (
                                        <div key={lIdx} className="border border-[#E4E7EC] rounded-xl p-4 flex flex-col gap-3">
                                            <div>
                                                <p className="text-xs text-gray-400">Train {lIdx + 1} · {leg.trainNumber || '—'}</p>
                                                <p className="text-sm font-semibold text-gray-900 truncate">{leg.trainName || 'Express'}</p>
                                            </div>
                                            <div className="text-xs text-gray-500 space-y-1 border-t border-[#F2F4F7] pt-2">
                                                <div><span className="text-green-700 font-medium">Board:</span> {leg.fromStationName || fromCode} ({fromCode}) · {depTime}</div>
                                                <div><span className="text-red-600 font-medium">Alight:</span> {leg.toStationName || toCode} ({toCode}) · {arrTime}</div>
                                            </div>
                                            {classes.length > 0 && (
                                                <div className="flex flex-wrap gap-1">
                                                    {classes.map(([cName, cData]) => {
                                                        const st = typeof cData === 'string' ? cData : cData?.status || '';
                                                        const stUp = st.toUpperCase();
                                                        let pillCls = 'bg-gray-100 text-gray-600';
                                                        if (stUp.includes('AVAILABLE') || stUp.includes('CURR_AV') || stUp.includes('AVL')) pillCls = 'bg-green-50 text-green-700 border border-green-200';
                                                        else if (stUp.includes('RAC')) pillCls = 'bg-amber-50 text-amber-700 border border-amber-200';
                                                        else if (stUp.includes('WL') || stUp.includes('WAIT')) pillCls = 'bg-red-50 text-red-700 border border-red-200';
                                                        return <span key={cName} className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${pillCls}`}>{cName}: {st}</span>;
                                                    })}
                                                </div>
                                            )}
                                            <button className="w-full border border-gray-900 text-gray-900 text-xs font-medium py-2 rounded-lg hover:bg-gray-900 hover:text-white transition-colors active:scale-95 transition-transform duration-150">
                                                Book Leg {lIdx + 1} (₹{clsInfo?.fare || Math.round((selectedRoute.totalFare || 1500) / selectedRoute.legs.length)})
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Footer CTA */}
                        <div className="p-5 border-t border-[#E4E7EC] flex flex-col sm:flex-row items-center justify-between gap-4">
                            <div>
                                <p className="text-2xl font-bold text-gray-900">₹{selectedRoute.totalFare || '—'}</p>
                                <p className="text-xs text-gray-400">Total combined fare</p>
                            </div>
                            <button onClick={() => alert('Redirecting to book all ' + selectedRoute.legs.length + ' tickets.')}
                                className="bg-gray-900 text-white text-sm font-medium px-6 py-2.5 rounded-lg hover:bg-gray-800 transition-colors flex items-center gap-2 active:scale-95 transition-transform duration-150">
                                Book All Connecting Tickets
                                <span
                                    className="material-symbols-outlined text-base"
                                    style={{ fontVariationSettings: "'FILL' 0, 'wght' 200" }}
                                >
                                    arrow_forward
                                </span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* No results */}
            {searchDone && !isSearching && filteredRoutes.length === 0 && !error && (
                <div className="bg-white border border-[#E4E7EC] rounded-xl p-12 text-center">
                    <div className="animate-scale-in">
                        <span
                            className="material-symbols-outlined text-3xl text-gray-300 block mb-3"
                            style={{ fontVariationSettings: "'FILL' 0, 'wght' 200" }}
                        >
                            search_off
                        </span>
                        <h3 className="text-base font-semibold text-gray-900 mb-1">No routes found</h3>
                        <p className="text-sm text-gray-400 max-w-md mx-auto">
                            {routes.length > 0 && minLayover > 0
                                ? `Found ${routes.length} routes but none match ${minLayover}min+ layover. Try reducing the filter.`
                                : 'No connecting routes on this date. Try 2 changes or a different date.'}
                        </p>
                        {routes.length > 0 && minLayover > 0 && (
                            <button onClick={() => setMinLayover(0)}
                                className="mt-4 border border-gray-900 text-gray-900 text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-900 hover:text-white transition-colors active:scale-95 transition-transform duration-150">
                                Clear Layover Filter
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Initial empty state */}
            {!searchDone && !isSearching && routes.length === 0 && (
                <div className="bg-white border border-[#E4E7EC] rounded-xl p-12 text-center">
                    <div className="animate-scale-in">
                        <span
                            className="material-symbols-outlined text-3xl text-gray-300 block mb-3"
                            style={{ fontVariationSettings: "'FILL' 0, 'wght' 200" }}
                        >
                            route
                        </span>
                        <h3 className="text-base font-semibold text-gray-900 mb-1">Find connecting routes</h3>
                        <p className="text-sm text-gray-400 max-w-sm mx-auto">
                            Configure max changes and layover buffer above, then click <strong className="text-gray-600">Find Routes</strong> to search.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MultiHopResults;
