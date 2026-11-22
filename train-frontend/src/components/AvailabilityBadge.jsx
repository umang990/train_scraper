import React, { useMemo } from 'react';

export const TRAIN_BG_IMAGES = [
    '/train_bg/train_blur_1.jpg',
    '/train_bg/train_blur_2.jpg',
    '/train_bg/train_blur_3.jpg',
    '/train_bg/train_blur_4.jpg',
    '/train_bg/train_blur_5.jpg',
    '/train_bg/train_blur_6.jpg',
    '/train_bg/train_blur_7.jpg',
];

const AvailabilityBadge = ({ travelClass, data, onOptimize, bgImage }) => {
    const { status, seats, fare } = data;
    const statusUpper = (status || '').toUpperCase();

    // Fallback shuffled background if not supplied by parent
    const cardBg = bgImage || useMemo(() => {
        return TRAIN_BG_IMAGES[Math.floor(Math.random() * TRAIN_BG_IMAGES.length)];
    }, []);

    let statusBadgeClass = 'text-[10px] font-medium text-gray-700 bg-white/80 px-2 py-0.5 rounded-full border border-gray-200/80 shadow-2xs backdrop-blur-xs';
    let statusLabel = status || 'N/A';
    let dotColor = 'bg-gray-400';
    let dotExtra = '';

    if (statusUpper.includes('AVAILABLE') || statusUpper.includes('CURR_AV') || statusUpper.includes('AVL')) {
        statusBadgeClass = 'text-[10px] font-semibold text-green-800 bg-green-50/90 px-2 py-0.5 rounded-full border border-green-200 shadow-2xs backdrop-blur-xs';
        dotColor = 'bg-green-500';
        dotExtra = 'dot-available';
    } else if (statusUpper.includes('RAC')) {
        statusBadgeClass = 'text-[10px] font-semibold text-amber-800 bg-amber-50/90 px-2 py-0.5 rounded-full border border-amber-200 shadow-2xs backdrop-blur-xs';
        dotColor = 'bg-amber-500';
    } else if (statusUpper.includes('WL') || statusUpper.includes('WAIT') || statusUpper.includes('REGRET') || statusUpper.includes('NOT')) {
        statusBadgeClass = 'text-[10px] font-semibold text-red-800 bg-red-50/90 px-2 py-0.5 rounded-full border border-red-200 shadow-2xs backdrop-blur-xs';
        dotColor = 'bg-red-500';
    }

    const isBookable = statusUpper.includes('AVAILABLE') || statusUpper.includes('RAC') || statusUpper.includes('CURR_AV') || statusUpper.includes('WL');

    return (
        <div className="relative overflow-hidden border border-[#E4E7EC] rounded-xl p-3 bg-white flex flex-col gap-2 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-gray-300 animate-fade-up group">
            {/* Aesthetic Heavily Blurred Train Background */}
            <div
                className="absolute inset-0 bg-cover bg-center filter blur-[2px] scale-125 opacity-40 group-hover:opacity-55 transition-opacity duration-300 pointer-events-none"
                style={{ backgroundImage: `url(${cardBg})` }}
            />
            {/* Subtle soft white gradient overlay for high contrast readability */}
            <div className="absolute inset-0 bg-white/70 backdrop-blur-[1px] pointer-events-none" />

            {/* Foreground Content */}
            <div className="relative z-10 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-900 tracking-wide">{travelClass}</span>
                    <span className={`w-2 h-2 rounded-full ${dotColor} ${dotExtra}`} />
                </div>
                <div className="text-base font-extrabold text-gray-900 tracking-tight">{fare ? `₹${fare}` : '—'}</div>
                <div className="flex items-center justify-between gap-1">
                    <span className={statusBadgeClass}>{statusLabel}</span>
                    {seats && <span className="text-[10px] text-gray-600 font-medium">{seats}</span>}
                </div>
                {isBookable && onOptimize && (
                    <button
                        onClick={() => onOptimize(travelClass)}
                        className="w-full bg-white/90 hover:bg-gray-900 hover:text-white border border-gray-900/90 text-gray-900 text-xs font-semibold py-1.5 rounded-lg active:scale-95 transition-all duration-150 mt-1 shadow-2xs backdrop-blur-xs"
                    >
                        Check Quota
                    </button>
                )}
            </div>
        </div>
    );
};

export default AvailabilityBadge;
