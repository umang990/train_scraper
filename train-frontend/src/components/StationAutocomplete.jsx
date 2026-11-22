import React, { useState, useEffect, useRef, useMemo } from 'react';
import api from '../api';
import { stations as localStationsList } from '../data/stations';

const StationAutocomplete = ({ value, onChange, placeholder, icon, autoFocus }) => {
    const [query, setQuery] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef(null);
    const isInteractingRef = useRef(false);

    // Initial and external sync with value
    useEffect(() => {
        if (!value) {
            if (!isInteractingRef.current) setQuery('');
            return;
        }
        // If current query already contains this code, don't clobber it
        const currentCodeMatch = query.match(/\(([A-Z0-9]{2,5})\)\s*$/i);
        if (currentCodeMatch && currentCodeMatch[1].toUpperCase() === value.toUpperCase()) {
            return;
        }
        if (query.trim().toUpperCase() === value.toUpperCase()) {
            return;
        }

        const found = localStationsList.find(s => (s.code || '').toUpperCase() === value.toUpperCase());
        if (found) {
            setQuery(`${found.name} (${found.code})`);
        } else {
            setQuery(value);
        }
    }, [value]);

    // Handle click outside to close dropdown
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setIsOpen(false);
                isInteractingRef.current = false;
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Instant local filtering + remote fallback
    useEffect(() => {
        const rawQ = query.trim();
        // If it's already an accepted selection like "NEW DELHI (NDLS)", don't suggest
        if (/\([A-Z0-9]{2,5}\)\s*$/i.test(rawQ)) {
            setSuggestions([]);
            return;
        }

        if (!rawQ || rawQ.length < 1) {
            setSuggestions([]);
            return;
        }

        const q = rawQ.toLowerCase();
        const exact = [];
        const codePrefix = [];
        const namePrefix = [];
        const nameContains = [];

        for (const s of localStationsList) {
            const c = (s.code || '').toLowerCase();
            const n = (s.name || '').toLowerCase();

            if (c === q) {
                exact.push({ name: s.name, code: s.code });
            } else if (c.startsWith(q)) {
                codePrefix.push({ name: s.name, code: s.code });
            } else if (n.startsWith(q)) {
                namePrefix.push({ name: s.name, code: s.code });
            } else if (n.includes(q)) {
                nameContains.push({ name: s.name, code: s.code });
            }
        }

        const localMatches = [...exact, ...codePrefix, ...namePrefix, ...nameContains].slice(0, 10);
        setSuggestions(localMatches);

        // Optional: fetch backend if 2+ chars to merge any server-exclusive stations
        if (rawQ.length >= 2) {
            let active = true;
            api.get('/stations/search', { params: { q: rawQ } })
                .then(res => {
                    if (!active || !res.data || !Array.isArray(res.data)) return;
                    const remote = res.data.map(s => ({
                        name: s.stationName || s.name,
                        code: s.stationCode || s.code,
                        state: s.state
                    }));
                    setSuggestions(prev => {
                        const seen = new Set(prev.map(p => (p.code || '').toUpperCase()));
                        const merged = [...prev];
                        for (const r of remote) {
                            if (r.code && !seen.has(r.code.toUpperCase())) {
                                seen.add(r.code.toUpperCase());
                                merged.push(r);
                            }
                        }
                        return merged.slice(0, 10);
                    });
                })
                .catch(() => {});
            return () => { active = false; };
        }
    }, [query]);

    const handleSelect = (station) => {
        isInteractingRef.current = false;
        setQuery(`${station.name} (${station.code})`);
        onChange(station.code);
        setIsOpen(false);
    };

    const handleInputChange = (e) => {
        isInteractingRef.current = true;
        const val = e.target.value;
        setQuery(val);
        setIsOpen(true);

        const codeMatch = val.match(/\(([A-Z0-9]{2,5})\)\s*$/i);
        if (codeMatch) {
            onChange(codeMatch[1].toUpperCase());
        } else {
            const direct = localStationsList.find(s => (s.code || '').toLowerCase() === val.trim().toLowerCase());
            if (direct) {
                onChange(direct.code.toUpperCase());
            } else {
                onChange(val.trim().toUpperCase());
            }
        }
    };

    return (
        <div ref={wrapperRef} className="w-full relative">
            <input
                type="text"
                required
                autoFocus={autoFocus}
                value={query}
                onChange={handleInputChange}
                onFocus={() => {
                    isInteractingRef.current = true;
                    if (query.trim().length >= 1) setIsOpen(true);
                }}
                className="w-full bg-transparent px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none"
                placeholder={placeholder}
                autoComplete="off"
            />

            {/* Dropdown Menu */}
            {isOpen && suggestions.length > 0 && (
                <div className="absolute z-50 top-full left-0 w-full mt-1 bg-white border border-[#E4E7EC] rounded-xl shadow-lg overflow-hidden max-h-64 overflow-y-auto">
                    {suggestions.map((station, idx) => (
                        <div
                            key={`${station.code}-${idx}`}
                            onClick={() => handleSelect(station)}
                            className="px-4 py-3 hover:bg-[#F7F8FA] cursor-pointer flex items-center justify-between border-b border-[#F2F4F7] last:border-0 transition-colors"
                        >
                            <div className="flex flex-col">
                                <span className="text-sm font-medium text-gray-900">{station.name}</span>
                                <span className="text-xs text-gray-400 font-mono font-medium">{station.code}{station.state ? ` · ${station.state}` : ''}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default StationAutocomplete;
