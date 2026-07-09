import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import TrainCard from '../components/TrainCard';
import Loader from '../components/Loader';
import CardDatePicker from '../components/CardDatePicker';
import MultiHopResults from '../components/MultiHopResults';
import api from '../api';

const Dashboard = () => {
    const [searchParams] = useSearchParams();
    const sourceParam = searchParams.get('source') || 'NDLS';
    const destParam = searchParams.get('destination') || 'MMCT';
    const dateParam = searchParams.get('date') || '01-07-2026';

    const [trainData, setTrainData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [sortBy, setSortBy] = useState('departure_early');
    const [filterClass, setFilterClass] = useState([]);
    const [filterType, setFilterType] = useState([]);
    const [filterDepartureBlock, setFilterDepartureBlock] = useState([]);
    const [filterArrivalBlock, setFilterArrivalBlock] = useState([]);
    const [quickAcOnly, setQuickAcOnly] = useState(false);
    const [quickAvailable, setQuickAvailable] = useState(true);
    const [quota, setQuota] = useState('GN');
    const [isFiltersOpen, setIsFiltersOpen] = useState(false);
    const [activeMainTab, setActiveMainTab] = useState('direct');

    const dates = useMemo(() => {
        const [d, m, y] = dateParam.split('-');
        let baseDate = new Date(`${y}-${m}-${d}`);
        if (isNaN(baseDate.getTime())) baseDate = new Date();
        return Array.from({ length: 6 }).map((_, i) => {
            const dt = new Date(baseDate);
            dt.setDate(baseDate.getDate() + i);
            return {
                day: dt.toLocaleDateString('en-US', { weekday: 'short' }),
                date: dt.getDate().toString().padStart(2, '0'),
                full: `${dt.getDate().toString().padStart(2, '0')}-${(dt.getMonth() + 1).toString().padStart(2, '0')}-${dt.getFullYear()}`,
                status: i % 3 === 0 ? 'Few Seats' : 'Filling',
            };
        });
    }, [dateParam]);

    const [selectedDate, setSelectedDate] = useState(dates[0].full);

    useEffect(() => {
        const fetchTrains = async () => {
            setLoading(true);
            setError('');
            const startTime = Date.now();
            try {
                const response = await api.get('/trains', { params: { source: sourceParam, destination: destParam, date: selectedDate } });
                const delay = Math.max(0, 2000 - (Date.now() - startTime));
                setTimeout(() => { setTrainData(response.data); setLoading(false); }, delay);
            } catch (err) {
                const delay = Math.max(0, 2000 - (Date.now() - startTime));
                setTimeout(() => { setError(err.response?.data?.message || 'Failed to fetch trains.'); setLoading(false); }, delay);
            }
        };
        fetchTrains();
    }, [sourceParam, destParam, selectedDate]);

    const parseTime = (t) => { if (!t) return 0; const [h, m] = t.split(':').map(Number); return h * 60 + m; };
    const getTimeBlock = (t) => { if (!t) return -1; const h = parseInt(t.split(':')[0], 10); if (h < 6) return 0; if (h < 12) return 1; if (h < 18) return 2; return 3; };

    const handleClassToggle = cls => setFilterClass(p => p.includes(cls) ? p.filter(c => c !== cls) : [...p, cls]);
    const handleTypeToggle = type => setFilterType(p => p.includes(type) ? p.filter(t => t !== type) : [...p, type]);
    const handleDepBlockToggle = b => setFilterDepartureBlock(p => p.includes(b) ? p.filter(x => x !== b) : [...p, b]);
    const handleArrBlockToggle = b => setFilterArrivalBlock(p => p.includes(b) ? p.filter(x => x !== b) : [...p, b]);

    const processedTrains = useMemo(() => {
        if (!trainData) return [];
        let filtered = [...trainData.trains];
        if (quickAcOnly) { const ac = ['1A', '2A', '3A', 'CC', '3E', 'EC']; filtered = filtered.filter(t => ac.some(c => Object.keys(t.availability).includes(c))); }
        if (quickAvailable) { filtered = filtered.filter(t => Object.values(t.availability).map(a => (a.status || '').toUpperCase()).some(s => s.includes('AVAILABLE') || s.includes('CURR_AV') || s.includes('RAC') || (s.includes('AVL') && !s.includes('NOT')))); }
        if (filterClass.length > 0) { filtered = filtered.filter(t => filterClass.some(c => Object.keys(t.availability).includes(c))); }
        if (filterType.length > 0) { filtered = filtered.filter(t => { const name = (t.trainInfo?.trainName || '').toUpperCase(); if (filterType.includes('Premium') && (name.includes('RAJDHANI') || name.includes('SHATABDI') || name.includes('DURONTO') || name.includes('VANDE'))) return true; if (filterType.includes('Express') && name.includes('EXP')) return true; if (filterType.includes('Superfast') && name.includes('SF')) return true; return false; }); }
        if (filterDepartureBlock.length > 0) { filtered = filtered.filter(t => filterDepartureBlock.includes(getTimeBlock(t.trainInfo.departureTime))); }
        if (filterArrivalBlock.length > 0) { filtered = filtered.filter(t => filterArrivalBlock.includes(getTimeBlock(t.trainInfo.arrivalTime))); }
        filtered.sort((a, b) => {
            if (sortBy === 'departure_early') return parseTime(a.trainInfo.departureTime) - parseTime(b.trainInfo.departureTime);
            if (sortBy === 'departure_late') return parseTime(b.trainInfo.departureTime) - parseTime(a.trainInfo.departureTime);
            if (sortBy === 'arrival_early') return parseTime(a.trainInfo.arrivalTime) - parseTime(b.trainInfo.arrivalTime);
            if (sortBy === 'duration_fast') return (a.trainInfo.durationMinutes || 0) - (b.trainInfo.durationMinutes || 0);
            return 0;
        });
        return filtered;
    }, [trainData, filterClass, filterType, quickAcOnly, quickAvailable, filterDepartureBlock, filterArrivalBlock, sortBy]);

    const timeBlocks = [
        { id: 0, label: '12am–6am' }, { id: 1, label: '6am–12pm' },
        { id: 2, label: '12pm–6pm' }, { id: 3, label: '6pm–12am' },
    ];
    const allClasses = ['1A', '2A', '3A', 'SL', '2S', 'CC', '3E', 'EC'];
    const allTypes = ['Premium', 'Superfast', 'Express'];

    const activeFiltersCount = filterClass.length + filterType.length + filterDepartureBlock.length + filterArrivalBlock.length + (quickAcOnly ? 1 : 0);

    const CheckBox = ({ checked, onClick, label }) => (
        <label className="flex items-center gap-2.5 cursor-pointer" onClick={onClick}>
            <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors flex-shrink-0 ${checked ? 'bg-gray-900 border-gray-900' : 'border-[#E4E7EC] bg-white hover:border-gray-400'}`}>
                {checked && <span className="material-symbols-outlined text-white text-[11px]">check</span>}
            </div>
            <span className="text-sm text-gray-700">{label}</span>
        </label>
    );

    const Toggle = ({ active, onClick, label }) => (
        <label className="flex items-center gap-2.5 cursor-pointer" onClick={onClick}>
            <div className={`relative w-9 h-5 rounded-full transition-colors ${active ? 'bg-gray-900' : 'bg-gray-200'}`}>
                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${active ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
            </div>
            <span className="text-sm text-gray-600">{label}</span>
        </label>
    );

    const FilterSection = ({ title, children }) => (
        <div className="space-y-3">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{title}</p>
            {children}
        </div>
    );

    return (
        <div className="min-h-screen bg-[#F7F8FA]">
            <Navbar />
            <main className="max-w-6xl mx-auto px-4 py-6">

                {/* Page Header */}
                <div className="mb-5 animate-fade-up">
                    <h1 className="text-xl font-bold text-gray-900">
                        {trainData ? `${trainData.searchContext.sourceStationName} → ${trainData.searchContext.destinationStationName}` : 'Loading trains...'}
                    </h1>
                    <p className="text-sm text-gray-400 mt-0.5">
                        {trainData ? `${trainData.searchContext.totalTrainsFound} trains found · ${trainData.searchContext.sourceStationCode} to ${trainData.searchContext.destinationStationCode}` : 'Fetching schedules...'}
                    </p>
                </div>

                {/* Tab Bar */}
                <div className="flex border-b border-[#E4E7EC] mb-5 gap-6">
                    {[{ id: 'direct', label: 'Direct Trains', icon: 'train' }, { id: 'multihop', label: 'Multi-Hop Routes', icon: 'route' }].map(tab => (
                        <button key={tab.id} onClick={() => setActiveMainTab(tab.id)}
                            className={`flex items-center gap-1.5 pb-3 text-sm font-medium border-b-2 transition-colors ${activeMainTab === tab.id
                                ? 'border-gray-900 text-gray-900'
                                : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
                            <span className="material-symbols-outlined text-base">{tab.icon}</span>
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div key={activeMainTab} className="animate-fade-in">
                {activeMainTab === 'direct' ? (
                    <>
                        {/* Date Strip + Quick Filters Bar */}
                        <div className="bg-white border border-[#E4E7EC] rounded-xl mb-4">
                            {/* Date tabs */}
                            <div className="flex border-b border-[#E4E7EC] rounded-t-xl">
                                <div className="flex-1 flex overflow-x-auto hide-scrollbar">
                                    {dates.map((d, i) => (
                                        <button key={i} onClick={() => setSelectedDate(d.full)}
                                            className={`flex-shrink-0 flex flex-col items-center px-5 py-3 text-center border-r border-[#E4E7EC] transition-colors ${selectedDate === d.full ? 'bg-gray-900 text-white' : 'hover:bg-[#F7F8FA] text-gray-600'}`}>
                                            <span className={`text-xs font-medium ${selectedDate === d.full ? 'text-gray-300' : 'text-gray-400'}`}>{d.day}</span>
                                            <span className={`text-sm font-semibold mt-0.5 ${selectedDate === d.full ? 'text-white' : 'text-gray-900'}`}>{d.date}</span>
                                            <span className={`text-[10px] mt-0.5 ${selectedDate === d.full ? 'text-gray-400' : 'text-gray-400'}`}>{d.status}</span>
                                        </button>
                                    ))}
                                </div>
                                <div className="flex items-center px-4 bg-[#F7F8FA] min-w-[140px] border-l border-[#E4E7EC] rounded-tr-xl">
                                    <CardDatePicker value={selectedDate} onChange={newDate => { if (newDate) { const url = new URL(window.location.href); url.searchParams.set('date', newDate); window.history.pushState({}, '', url); setSelectedDate(newDate); } }} placeholder="Pick date" />
                                </div>
                            </div>

                            {/* Quick filter bar */}
                            <div className="px-4 py-3 flex items-center gap-5 flex-wrap">
                                <button onClick={() => setIsFiltersOpen(true)}
                                    className={`flex items-center gap-1.5 text-xs font-medium border rounded-lg px-3 py-1.5 transition-colors ${activeFiltersCount > 0 ? 'bg-gray-900 text-white border-gray-900' : 'border-[#E4E7EC] text-gray-600 hover:bg-gray-50'}`}>
                                    <span className="material-symbols-outlined text-sm">tune</span>
                                    Filters{activeFiltersCount > 0 && ` (${activeFiltersCount})`}
                                </button>

                                <div className="h-4 w-px bg-[#E4E7EC]" />

                                <Toggle active={quickAvailable} onClick={() => setQuickAvailable(!quickAvailable)} label="Available only" />
                                <Toggle active={quickAcOnly} onClick={() => setQuickAcOnly(!quickAcOnly)} label="AC only" />

                                <div className="ml-auto flex items-center gap-2">
                                    <span className="text-xs text-gray-400">Sort:</span>
                                    <select value={sortBy} onChange={e => setSortBy(e.target.value)}
                                        className="border border-[#E4E7EC] rounded-lg text-xs font-medium text-gray-700 px-3 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-gray-900 cursor-pointer">
                                        <option value="departure_early">Early Departure</option>
                                        <option value="departure_late">Late Departure</option>
                                        <option value="arrival_early">Early Arrival</option>
                                        <option value="duration_fast">Fastest</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Results */}
                        <div className="space-y-3">
                            {error && (
                                <div className="border border-red-200 bg-red-50 text-red-700 text-sm p-4 rounded-xl flex items-center gap-2">
                                    <span className="material-symbols-outlined text-base">error</span>
                                    {error}
                                </div>
                            )}
                            {loading ? <Loader message="Fetching trains..." /> : (
                                processedTrains.length === 0 ? (
                                    <div className="bg-white border border-[#E4E7EC] rounded-xl p-12 text-center">
                                        <span className="material-symbols-outlined text-3xl text-gray-300 block mb-3">search_off</span>
                                        <h3 className="text-base font-semibold text-gray-900 mb-1">No trains match your filters</h3>
                                        <p className="text-sm text-gray-400">Try clearing some filters or checking another date.</p>
                                    </div>
                                ) : (
                                    processedTrains.map((train, idx) => (
                                        <TrainCard key={idx} trainObj={train} date={selectedDate} source={trainData.searchContext.sourceStationCode} destination={trainData.searchContext.destinationStationCode} index={idx} />
                                    ))
                                )
                            )}
                        </div>
                    </>
                ) : (
                    <MultiHopResults source={sourceParam} destination={destParam} date={selectedDate} />
                )}
                </div>
            </main>

            {/* Filter Drawer */}
            <div className={`fixed inset-0 z-50 transition-opacity duration-200 ${isFiltersOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
                <div className="absolute inset-0 bg-black/40" onClick={() => setIsFiltersOpen(false)} />
                <div className={`absolute top-0 right-0 h-full w-full max-w-xs bg-white shadow-xl transition-transform duration-300 ${isFiltersOpen ? 'translate-x-0' : 'translate-x-full'} flex flex-col`} style={{ transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)' }}>
                    <div className="flex items-center justify-between p-5 border-b border-[#E4E7EC]">
                        <h3 className="text-base font-semibold text-gray-900">Filters</h3>
                        <button onClick={() => setIsFiltersOpen(false)} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100">
                            <span className="material-symbols-outlined text-base">close</span>
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-5 space-y-6">
                        <FilterSection title="Quota">
                            {['GN', 'LD', 'TQ'].map((q, i) => (
                                <CheckBox key={q} checked={quota === q} onClick={() => setQuota(q)} label={['General', 'Ladies', 'Tatkal'][i]} />
                            ))}
                        </FilterSection>

                        <hr className="border-[#E4E7EC]" />

                        <FilterSection title="Travel Class">
                            <div className="grid grid-cols-2 gap-2">
                                {allClasses.map(cls => (
                                    <CheckBox key={cls} checked={filterClass.includes(cls)} onClick={() => handleClassToggle(cls)} label={cls} />
                                ))}
                            </div>
                        </FilterSection>

                        <hr className="border-[#E4E7EC]" />

                        <FilterSection title="Train Type">
                            {allTypes.map(type => (
                                <CheckBox key={type} checked={filterType.includes(type)} onClick={() => handleTypeToggle(type)} label={type} />
                            ))}
                        </FilterSection>

                        <hr className="border-[#E4E7EC]" />

                        <FilterSection title="Departure Time">
                            <div className="grid grid-cols-2 gap-2">
                                {timeBlocks.map(b => (
                                    <button key={b.id} onClick={() => handleDepBlockToggle(b.id)}
                                        className={`py-2 px-3 rounded-lg text-xs font-medium border transition-colors ${filterDepartureBlock.includes(b.id) ? 'bg-gray-900 text-white border-gray-900' : 'border-[#E4E7EC] text-gray-600 hover:bg-gray-50'}`}>
                                        {b.label}
                                    </button>
                                ))}
                            </div>
                        </FilterSection>

                        <hr className="border-[#E4E7EC]" />

                        <FilterSection title="Arrival Time">
                            <div className="grid grid-cols-2 gap-2">
                                {timeBlocks.map(b => (
                                    <button key={b.id} onClick={() => handleArrBlockToggle(b.id)}
                                        className={`py-2 px-3 rounded-lg text-xs font-medium border transition-colors ${filterArrivalBlock.includes(b.id) ? 'bg-gray-900 text-white border-gray-900' : 'border-[#E4E7EC] text-gray-600 hover:bg-gray-50'}`}>
                                        {b.label}
                                    </button>
                                ))}
                            </div>
                        </FilterSection>
                    </div>

                    <div className="p-5 border-t border-[#E4E7EC]">
                        <button onClick={() => { setFilterClass([]); setFilterType([]); setFilterDepartureBlock([]); setFilterArrivalBlock([]); setQuickAcOnly(false); }}
                            className="w-full border border-[#E4E7EC] text-gray-600 text-sm font-medium py-2.5 rounded-lg hover:bg-gray-50 transition-colors">
                            Clear All Filters
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
