import React, { useState, useEffect, useRef } from 'react';
import api from '../api';

const StationAutocomplete = ({ value, onChange, placeholder, icon, autoFocus }) => {
    const [query, setQuery] = useState(value || '');
    const [suggestions, setSuggestions] = useState([]);
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef(null);

    // Update internal query if value prop changes externally
    useEffect(() => {
        setQuery(value || '');
    }, [value]);

    // Handle click outside to close dropdown
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Immediate Search Engine with Backend API
    useEffect(() => {
        if (!query || query.length < 2) {
            setSuggestions([]);
            return;
        }

        const fetchStations = async () => {
            try {
                const res = await api.get('/stations/search', { params: { q: query.trim() } });
                const results = (res.data || []).map(s => ({
                    name: s.stationName || s.name,
                    code: s.stationCode || s.code,
                    state: s.state
                }));
                setSuggestions(results);
            } catch (err) {
                console.error("Failed to fetch stations:", err);
            }
        };

        fetchStations();
    }, [query]);

    const handleSelect = (station) => {
        setQuery(`${station.name} (${station.code})`);
        onChange(station.code);
        setIsOpen(false);
    };

    const handleInputChange = (e) => {
        const val = e.target.value;
        setQuery(val);
        // Only send the code part to parent if user manually types a code
        // Otherwise send raw text (parent uses the code from handleSelect)
        const codeMatch = val.match(/\(([A-Z]{2,5})\)\s*$/);
        if (codeMatch) {
            onChange(codeMatch[1]);
        } else {
            onChange(val.toUpperCase());
        }
        setIsOpen(true);
    };

    return (
        <div ref={wrapperRef} className="w-full relative">
            <input
                type="text"
                required
                autoFocus={autoFocus}
                value={query}
                onChange={handleInputChange}
                onFocus={() => { if (query.length >= 2) setIsOpen(true); }}
                className="w-full bg-transparent px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none"
                placeholder={placeholder}
                autoComplete="off"
            />

            {/* Dropdown Menu */}
            {isOpen && suggestions.length > 0 && (
                <div className="absolute z-50 top-full left-0 w-full mt-1 bg-white border border-[#E4E7EC] rounded-xl shadow-sm overflow-hidden max-h-64 overflow-y-auto">
                    {suggestions.map((station, idx) => (
                        <div
                            key={`${station.code}-${idx}`}
                            onClick={() => handleSelect(station)}
                            className="px-4 py-3 hover:bg-[#F7F8FA] cursor-pointer flex items-center justify-between border-b border-[#F2F4F7] last:border-0 transition-colors"
                        >
                            <div className="flex flex-col">
                                <span className="text-sm font-medium text-gray-900">{station.name}</span>
                                <span className="text-xs text-gray-400">{station.code}{station.state ? ` · ${station.state}` : ''}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default StationAutocomplete;
