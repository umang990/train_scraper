import React from 'react';

const TrainCardSkeleton = () => (
    <div className="bg-white border border-[#E4E7EC] rounded-xl p-4 space-y-4 animate-fade-in">
        <div className="flex justify-between items-center">
            <div className="space-y-1.5">
                <div className="skeleton h-3 w-20" />
                <div className="skeleton h-4 w-40" />
            </div>
            <div className="skeleton h-7 w-24 rounded-lg" />
        </div>
        <div className="border-t border-[#F2F4F7] pt-3 flex items-center gap-6">
            <div className="space-y-1">
                <div className="skeleton h-7 w-14" />
                <div className="skeleton h-3 w-10" />
            </div>
            <div className="flex-1 flex flex-col items-center gap-2">
                <div className="skeleton h-2 w-full" />
                <div className="skeleton h-3 w-16" />
            </div>
            <div className="space-y-1 items-end flex flex-col">
                <div className="skeleton h-7 w-14" />
                <div className="skeleton h-3 w-10" />
            </div>
        </div>
        <div className="border-t border-[#F2F4F7] pt-3 grid grid-cols-4 gap-2">
            {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-16 rounded-lg" />)}
        </div>
    </div>
);

const Loader = ({ message }) => (
    <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
            <div key={i} style={{ animationDelay: `${i * 80}ms` }}>
                <TrainCardSkeleton />
            </div>
        ))}
    </div>
);

export default Loader;
