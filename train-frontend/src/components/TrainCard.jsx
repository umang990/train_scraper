import React, { useState } from 'react';
import AvailabilityBadge from './AvailabilityBadge';
import OptimizationModal from './OptimizationModal';
import api from '../api';
import useInView from '../hooks/useInView';

const TrainCard = ({ trainObj, date, source, destination, index = 0, chatMode = false, onClassClick, onTrainClick }) => {
    const { trainInfo, availability } = trainObj;

    const [isRouteExpanded, setIsRouteExpanded] = useState(false);
    const [isLoadingRoute, setIsLoadingRoute] = useState(false);
    const [routeSchedule, setRouteSchedule] = useState(null);
    const [routeError, setRouteError] = useState('');

    const [selectedAiClass, setSelectedAiClass] = useState(null);

    const { ref, inView } = useInView();

    const toggleRoute = async () => {
        if (isRouteExpanded) {
            setIsRouteExpanded(false);
            return;
        }
        setIsRouteExpanded(true);
        if (!routeSchedule) {
            setIsLoadingRoute(true);
            setRouteError('');
            try {
                const response = await api.get(`/trains/${trainInfo.trainNumber}/schedule`);
                setRouteSchedule(response.data.schedule);
            } catch (err) {
                console.error("Failed to fetch route", err);
                setRouteError("Could not load route schedule.");
                setIsRouteExpanded(false);
            } finally {
                setIsLoadingRoute(false);
            }
        }
    };

    const durationH = Math.floor(trainInfo.durationMinutes / 60);
    const durationM = trainInfo.durationMinutes % 60;

    return (
        <>
            <div
                ref={ref}
                style={{ animationDelay: `${Math.min(index * 60, 360)}ms` }}
                className={`bg-white border border-[#E4E7EC] rounded-xl overflow-hidden mb-3 hover:border-gray-300 transition-colors ${inView ? 'animate-fade-up' : 'opacity-0'} ${chatMode ? 'cursor-pointer hover:bg-gray-50' : ''}`}
                onClick={(e) => {
                    if (chatMode && onTrainClick) {
                        if (e.target.closest('button') || e.target.closest('.availability-badge-click')) return;
                        onTrainClick(trainInfo);
                    }
                }}
            >
                <div className="p-4">
                    {/* Row 1 — Train identity */}
                    <div className="flex items-center justify-between">
                        <div>
                            <span className="text-xs font-medium text-gray-400">#{trainInfo.trainNumber}</span>
                            <h3 className="text-sm font-semibold text-gray-900 mt-0.5">{trainInfo.trainName}</h3>
                            <span className="text-xs text-gray-400">{trainInfo.runningDays}</span>
                        </div>
                        <button
                            onClick={toggleRoute}
                            className="text-xs text-gray-500 border border-[#E4E7EC] rounded-md px-3 py-1.5 hover:bg-gray-50 transition-colors flex items-center gap-1.5"
                        >
                            <span
                                className={`material-symbols-outlined text-sm transition-transform duration-300 ${isRouteExpanded ? 'rotate-180' : ''}`}
                            >
                                expand_more
                            </span>
                            {isRouteExpanded ? 'Hide' : 'Schedule'}
                        </button>
                    </div>

                    {/* Row 2 — Journey */}
                    <div className="border-t border-[#F2F4F7] mt-3 pt-3 flex items-center gap-4">
                        {/* FROM */}
                        <div>
                            <div className="text-2xl font-bold text-gray-900">{trainInfo.fromStationCode}</div>
                            <div className="text-xs text-gray-400 mt-0.5">{trainInfo.departureTime}</div>
                        </div>

                        {/* Middle route line */}
                        <div className="flex-1 flex flex-col items-center gap-1">
                            <span className="text-xs text-gray-400">{trainInfo.totalDistanceKm} km</span>
                            <div className="flex items-center w-full gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-gray-300 shrink-0"></span>
                                <div className="border-t border-dashed border-gray-200 flex-1"></div>
                                <span className="w-1.5 h-1.5 rounded-full bg-gray-300 shrink-0"></span>
                            </div>
                            <span className="text-xs font-medium text-gray-700">{durationH}h {durationM}m</span>
                        </div>

                        {/* TO */}
                        <div className="text-right">
                            <div className="text-2xl font-bold text-gray-900">{trainInfo.toStationCode}</div>
                            <div className="text-xs text-gray-400 mt-0.5">{trainInfo.arrivalTime}</div>
                        </div>
                    </div>

                    {/* Row 3 — Classes grid */}
                    <div className="border-t border-[#F2F4F7] mt-3 pt-3">
                        <span className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2 block">Classes</span>
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
                            {Object.entries(availability).map(([cls, data]) => (
                                <div key={cls} className="availability-badge-click">
                                    <AvailabilityBadge
                                        travelClass={cls}
                                        data={data}
                                        onOptimize={() => {
                                            if (chatMode && onClassClick) {
                                                onClassClick(trainInfo, cls);
                                            } else {
                                                setSelectedAiClass(cls);
                                            }
                                        }}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Route drawer — always rendered, height-animated */}
                <div
                    className={`overflow-hidden transition-all duration-300 ease-out ${isRouteExpanded ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'}`}
                >
                    <div className="border-t border-[#F2F4F7]">
                        <div className="p-4 bg-[#F7F8FA]">
                            <span className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3 block">Route &amp; Station Halts</span>

                            {isLoadingRoute ? (
                                <div className="flex items-center justify-center py-6">
                                    <div className="loader-dots"><span /><span /><span /></div>
                                </div>
                            ) : routeError ? (
                                <div className="text-red-600 text-sm font-medium text-center py-4 bg-red-50 rounded-lg border border-red-200">{routeError}</div>
                            ) : routeSchedule && routeSchedule.length > 0 ? (
                                <div className="space-y-0 max-h-64 overflow-y-auto">
                                    {routeSchedule.map((stop, index) => (
                                        <div key={index} className="flex items-start gap-3 py-2.5">
                                            {/* Index */}
                                            <span className="text-[10px] text-gray-400 w-4 text-right shrink-0 pt-0.5">{index + 1}</span>
                                            {/* Vertical line + dot */}
                                            <div className="flex flex-col items-center shrink-0">
                                                <div className="w-1.5 h-1.5 rounded-full bg-gray-300 mt-1"></div>
                                                {index < routeSchedule.length - 1 && (
                                                    <div className="w-px flex-1 bg-[#E4E7EC] mt-1" style={{ minHeight: '20px' }}></div>
                                                )}
                                            </div>
                                            {/* Content */}
                                            <div className="flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-1">
                                                <div>
                                                    <span className="text-sm font-medium text-gray-900">{stop.stationName}</span>
                                                    <span className="text-xs text-gray-400 ml-1">({stop.stationCode})</span>
                                                    <div className="text-xs text-gray-400 mt-0.5">
                                                        Arr: <span className="text-gray-700">{stop.arrivalTime}</span> · Dep: <span className="text-gray-700">{stop.departureTime}</span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    {stop.haltMinutes !== "0m" && stop.haltMinutes !== "0" && (
                                                        <span className="text-[10px] font-medium text-gray-500 bg-gray-100 border border-[#E4E7EC] px-2 py-0.5 rounded-full">
                                                            {stop.haltMinutes}
                                                        </span>
                                                    )}
                                                    <span className="text-[10px] font-medium text-gray-500 bg-gray-100 border border-[#E4E7EC] px-2 py-0.5 rounded-full">
                                                        Day {stop.day}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-gray-400 text-sm text-center py-4">No route data available.</div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {!chatMode && (
                <OptimizationModal
                    isOpen={!!selectedAiClass}
                    onClose={() => setSelectedAiClass(null)}
                    trainInfo={trainInfo}
                    travelClass={selectedAiClass}
                    source={source}
                    destination={destination}
                    date={date}
                />
            )}
        </>
    );
};

export default TrainCard;
