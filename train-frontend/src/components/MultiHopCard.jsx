import React from 'react';
import useInView from '../hooks/useInView';

const MultiHopCard = ({ route, onSelect, style }) => {
    const { ref, inView } = useInView();

    const formatDuration = (mins) => {
        if (!mins && mins !== 0) return '—';
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        if (h === 0) return `${m}m`;
        if (m === 0) return `${h}h`;
        return `${h}h ${m}m`;
    };

    const formatFare = (fare) => {
        if (!fare) return '—';
        return `₹${fare.toLocaleString('en-IN')}`;
    };

    const { legs = [], connections = [], totalFare, totalDurationMins } = route;
    const numChanges = connections.length;

    // Derive first/last station info cleanly
    const firstLeg = legs[0];
    const lastLeg = legs[legs.length - 1];
    const originCode = firstLeg?.from?.code || firstLeg?.fromStationCode || firstLeg?.source || '—';
    const destCode = lastLeg?.to?.code || lastLeg?.toStationCode || lastLeg?.destination || '—';
    const departTime = firstLeg?.departureTime || firstLeg?.departure || '';
    const arriveTime = lastLeg?.arrivalTime || lastLeg?.arrival || '';

    return (
        <div
            ref={ref}
            onClick={() => onSelect && onSelect(route)}
            style={style}
            className={`bg-white border border-[#E4E7EC] rounded-xl p-4 cursor-pointer hover:border-gray-300 hover:-translate-y-0.5 hover:shadow-sm transition-all duration-150 ${inView ? 'animate-fade-up' : 'opacity-0'}`}
        >
            {/* Top row: changes label + fare */}
            <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-400">
                    {numChanges} change{numChanges !== 1 ? 's' : ''}
                </span>
                <span className="text-lg font-bold text-gray-900">{formatFare(totalFare)}</span>
            </div>

            {/* Route flow */}
            <div className="mt-3 flex items-center gap-2 flex-wrap">
                {/* FROM station */}
                <div className="flex flex-col">
                    <span className="text-sm font-semibold text-gray-900">{originCode}</span>
                    {departTime && <span className="text-xs text-gray-400">{departTime}</span>}
                </div>

                <span className="text-gray-300 text-sm">→</span>

                {/* Change stations */}
                {connections.map((conn, cIdx) => (
                    <React.Fragment key={cIdx}>
                        <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                            {conn.stationName || conn.station || conn.stationCode}
                            {conn.layoverMins ? ` · ${formatDuration(conn.layoverMins)}` : ''}
                        </span>
                        <span className="text-gray-300 text-sm">→</span>
                    </React.Fragment>
                ))}

                {/* TO station */}
                <div className="flex flex-col">
                    <span className="text-sm font-semibold text-gray-900">{destCode}</span>
                    {arriveTime && <span className="text-xs text-gray-400">{arriveTime}</span>}
                </div>
            </div>

            {/* Bottom row */}
            <div className="border-t border-[#F2F4F7] mt-3 pt-3 flex items-center justify-between">
                <span className="text-xs text-gray-400 flex items-center gap-1">
                    <span
                        className="material-symbols-outlined text-sm text-gray-400"
                        style={{ fontVariationSettings: "'FILL' 0, 'wght' 200" }}
                    >
                        schedule
                    </span>
                    {formatDuration(totalDurationMins)} total
                </span>
                <button
                    onClick={(e) => { e.stopPropagation(); onSelect && onSelect(route); }}
                    className="text-xs font-medium text-gray-600 border border-[#E4E7EC] rounded-md px-3 py-1.5 hover:bg-gray-50 transition-colors active:scale-95 transition-transform duration-150"
                >
                    View diagram
                </button>
            </div>
        </div>
    );
};

export default MultiHopCard;
