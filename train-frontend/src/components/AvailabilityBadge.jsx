import React from 'react';

const AvailabilityBadge = ({ travelClass, data, onOptimize }) => {
    const { status, seats, fare } = data;
    const statusUpper = (status || '').toUpperCase();

    let statusBadgeClass = 'text-[10px] font-medium text-gray-500 bg-gray-50 px-2 py-0.5 rounded-full border border-gray-200';
    let statusLabel = status || 'N/A';
    let dotColor = 'bg-gray-300';
    let dotExtra = '';

    if (statusUpper.includes('AVAILABLE') || statusUpper.includes('CURR_AV') || statusUpper.includes('AVL')) {
        statusBadgeClass = 'text-[10px] font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full border border-green-200';
        dotColor = 'bg-green-500';
        dotExtra = 'dot-available';
    } else if (statusUpper.includes('RAC')) {
        statusBadgeClass = 'text-[10px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200';
        dotColor = 'bg-amber-500';
    } else if (statusUpper.includes('WL') || statusUpper.includes('WAIT') || statusUpper.includes('REGRET') || statusUpper.includes('NOT')) {
        statusBadgeClass = 'text-[10px] font-medium text-red-700 bg-red-50 px-2 py-0.5 rounded-full border border-red-200';
        dotColor = 'bg-red-500';
    }

    const isBookable = statusUpper.includes('AVAILABLE') || statusUpper.includes('RAC') || statusUpper.includes('CURR_AV') || statusUpper.includes('WL');

    return (
        <div className="border border-[#E4E7EC] rounded-lg p-3 bg-white flex flex-col gap-2 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-sm hover:border-gray-300 animate-fade-up">
            <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-900">{travelClass}</span>
                <span className={`w-2 h-2 rounded-full ${dotColor} ${dotExtra}`} />
            </div>
            <div className="text-base font-bold text-gray-900">{fare ? `₹${fare}` : '—'}</div>
            <div className="flex items-center justify-between gap-1">
                <span className={statusBadgeClass}>{statusLabel}</span>
                {seats && <span className="text-[10px] text-gray-400">{seats}</span>}
            </div>
            {isBookable && onOptimize && (
                <button
                    onClick={() => onOptimize(travelClass)}
                    className="w-full border border-gray-900 text-gray-900 text-xs font-medium py-1.5 rounded-md hover:bg-gray-900 hover:text-white active:scale-95 transition-all duration-150 mt-1"
                >
                    Check Quota
                </button>
            )}
        </div>
    );
};

export default AvailabilityBadge;
