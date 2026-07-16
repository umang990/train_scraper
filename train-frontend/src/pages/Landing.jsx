import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import StationAutocomplete from '../components/StationAutocomplete';
import CardDatePicker from '../components/CardDatePicker';
import useInView from '../hooks/useInView';
import useCountUp from '../hooks/useCountUp';

const Landing = () => {
    const [searchParams, setSearchParams] = useState({
        source: '',
        destination: '',
        date: ''
    });
    const navigate = useNavigate();
    const { user } = useAuth();

    const { ref: statsRef, inView: statsInView } = useInView();
    const count1 = useCountUp(8000, 1500, statsInView);
    const count2 = useCountUp(17, 1000, statsInView);
    const count3 = useCountUp(100, 1200, statsInView);

    // Scroll state for zoom-on-scroll parallax images
    const [scrollOffset, setScrollOffset] = useState(0);
    const [showNavbar, setShowNavbar] = useState(true);
    const [lastScrollY, setLastScrollY] = useState(0);
    const section1Ref = useRef(null);
    const section2Ref = useRef(null);

    useEffect(() => {
        const handleScroll = () => {
            const currentScrollY = window.scrollY;
            setScrollOffset(currentScrollY);

            if (currentScrollY < 10) {
                setShowNavbar(true);
            } else if (currentScrollY > lastScrollY) {
                // Scroll down -> Reappear
                setShowNavbar(true);
            } else {
                // Scroll up -> Disappear
                setShowNavbar(false);
            }
            setLastScrollY(currentScrollY);
        };
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, [lastScrollY]);

    const handleSearch = (e) => {
        e.preventDefault();
        const query = new URLSearchParams(searchParams).toString();
        navigate(`/search?${query}`);
    };

    // Animation view states for sections
    const { ref: feat1Ref, inView: feat1InView } = useInView();
    const { ref: feat2Ref, inView: feat2InView } = useInView();
    const { ref: feat3Ref, inView: feat3InView } = useInView();
    const { ref: networkRef, inView: networkInView } = useInView();

    // Parallax calculations (modulate scale and speed)
    // Start with a base zoom of 1.15 so that the image safely exceeds container boundaries
    const scaleFactor1 = Math.min(1.4, 1.15 + scrollOffset * 0.0003);
    const scaleFactor2 = Math.min(1.4, 1.15 + Math.max(0, scrollOffset - 600) * 0.0003);

    return (
        <div className="bg-[#F7F8FA] min-h-screen flex flex-col overflow-x-hidden">

            {/* Nav */}
            <nav className={`fixed top-0 left-0 right-0 z-50 border-b border-[#E4E7EC] bg-white/80 backdrop-blur-md py-4 transition-transform duration-300 ${showNavbar ? 'translate-y-0' : '-translate-y-full'}`}>
                <div className="max-w-5xl mx-auto px-6 flex justify-between items-center">
                    <div className="flex items-center gap-2 cursor-pointer hover:opacity-75 transition-opacity" onClick={() => navigate('/')}>
                        <span
                            className="material-symbols-outlined text-gray-900 text-xl"
                            style={{ fontVariationSettings: "'FILL' 0, 'wght' 200" }}
                        >
                            route
                        </span>
                        <span className="font-semibold text-gray-900 tracking-tight text-base">RailPath</span>
                    </div>
                    <div className="flex items-center gap-3">
                        {user ? (
                            <>
                                <Link to="/search" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">Dashboard</Link>
                                <Link to="/profile" className="text-sm font-medium bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors">My Profile</Link>
                            </>
                        ) : (
                            <>
                                <Link to="/login" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">Sign In</Link>
                                <Link to="/signup" className="text-sm font-medium bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors">Sign Up</Link>
                            </>
                        )}
                    </div>
                </div>
            </nav>
            <div className="h-[57px] md:h-[65px] w-full shrink-0" />

            {/* Hero Section */}
            <div className="max-w-5xl mx-auto px-6 pt-20 pb-20 w-full">
                <h1 className="leading-none">
                    <span className="block text-5xl md:text-7xl font-extrabold text-gray-900 animate-fade-up stagger-1">Find your</span>
                    <span className="block text-5xl md:text-7xl font-light text-gray-400 animate-fade-up stagger-2">confirmed seat.</span>
                </h1>

                <p className="text-base text-gray-400 mt-4 max-w-sm animate-fade-up stagger-3">
                    Smart train search across India.
                </p>

                <div className="flex items-center gap-3 mt-8 animate-fade-up stagger-4">
                    {user ? (
                        <Link
                            to="/chat"
                            className="inline-flex items-center gap-2 bg-gray-900 text-white text-sm font-medium px-5 py-2.5 rounded-xl hover:bg-gray-700 transition-colors active:scale-95"
                        >
                            <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 0, 'wght' 200" }}>auto_awesome</span>
                            Chat
                        </Link>
                    ) : (
                        <Link
                            to="/login?redirect=/chat"
                            className="inline-flex items-center gap-2 bg-gray-900 text-white text-sm font-medium px-5 py-2.5 rounded-xl hover:bg-gray-700 transition-colors active:scale-95"
                        >
                            <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 0, 'wght' 200" }}>auto_awesome</span>
                            Chat
                        </Link>
                    )}
                </div>

                {/* Search Form */}
                <div className="animate-fade-up" style={{ animationDelay: '0.5s' }}>
                    <form onSubmit={handleSearch} className="mt-10 bg-white border border-[#E4E7EC] rounded-xl p-1 flex flex-col md:flex-row items-stretch md:items-center gap-1 max-w-3xl shadow-sm overflow-visible">
                        <div className="flex-1 min-w-0 overflow-visible">
                            <StationAutocomplete
                                value={searchParams.source}
                                onChange={(val) => setSearchParams({ ...searchParams, source: val })}
                                placeholder="From Station (e.g. NDLS)"
                                autoFocus={true}
                            />
                        </div>

                        <div className="hidden md:block w-px h-8 bg-[#E4E7EC] flex-shrink-0" />

                        <div className="flex-1 min-w-0 overflow-visible">
                            <StationAutocomplete
                                value={searchParams.destination}
                                onChange={(val) => setSearchParams({ ...searchParams, destination: val })}
                                placeholder="To Station (e.g. MMCT)"
                            />
                        </div>

                        <div className="hidden md:block w-px h-8 bg-[#E4E7EC] flex-shrink-0" />

                        <div className="md:w-44 flex-shrink-0">
                            <CardDatePicker
                                value={searchParams.date}
                                onChange={(val) => setSearchParams({ ...searchParams, date: val })}
                                placeholder="Journey Date"
                            />
                        </div>

                        <button
                            type="submit"
                            className="bg-gray-900 text-white px-6 py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2 hover:bg-gray-800 transition-colors flex-shrink-0 hover:scale-[1.02] active:scale-[0.98] transition-transform duration-150"
                        >
                            <span
                                className="material-symbols-outlined text-base"
                                style={{ fontVariationSettings: "'FILL' 0, 'wght' 200" }}
                            >
                                search
                            </span>
                            Search
                        </button>
                    </form>
                </div>
            </div>

            {/* Stats Strip */}
            <div className="border-t border-b border-[#E4E7EC] bg-white py-10">
                <div ref={statsRef} className="max-w-5xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-8 text-center md:text-left">
                    <div>
                        <div className="text-3xl font-extrabold text-gray-900">{count1.toLocaleString()}+</div>
                        <div className="text-xs text-gray-400 uppercase tracking-wider font-semibold mt-1">Daily Trains Scanned</div>
                        <p className="text-xs text-gray-500 mt-1 max-w-xs">Indexing schedules across the entire Indian Railways grid in real-time.</p>
                    </div>
                    <div>
                        <div className="text-3xl font-extrabold text-gray-900">{count2} Quotas</div>
                        <div className="text-xs text-gray-400 uppercase tracking-wider font-semibold mt-1">Simultaneous Searches</div>
                        <p className="text-xs text-gray-500 mt-1 max-w-xs">Automated hacking of Tatkal, General, Ladies, Defense and Lower Berth allocations.</p>
                    </div>
                    <div>
                        <div className="text-3xl font-extrabold text-gray-900">{count3}% Coverage</div>
                        <div className="text-xs text-gray-400 uppercase tracking-wider font-semibold mt-1">Indian Railway Grid</div>
                        <p className="text-xs text-gray-500 mt-1 max-w-xs">Every station, branch-line, and junction mapped from Kashmir to Kanyakumari.</p>
                    </div>
                </div>
            </div>

            {/* Parallax Image 1 Section */}
            <div ref={section1Ref} className="relative h-[400px] overflow-hidden flex items-center justify-center bg-black">
                <div
                    className="absolute inset-0 bg-cover bg-center transition-transform duration-75"
                    style={{
                        backgroundImage: `url('/aesthetic_rail_night_one.png')`,
                        transform: `scale(${scaleFactor1}) translateY(${scrollOffset * 0.03}px)`,
                        opacity: 0.65
                    }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#F7F8FA] via-transparent to-[#F7F8FA]/20" />
                <div className="relative z-10 text-center px-6 max-w-2xl">
                    <h2 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight drop-shadow-sm">Built for Indian Railways</h2>
                    <p className="text-gray-300 mt-3 text-sm md:text-base">We scan every rail connection, station code, and junction to reveal options normal booking portals hide from you.</p>
                </div>
            </div>

            {/* Deep-Dive Explanation Sections */}
            <div className="max-w-5xl mx-auto px-6 py-20 space-y-24">

                {/* Feature 1 */}
                <div ref={feat1Ref} className={`flex flex-col md:flex-row gap-8 items-start md:items-center transition-all duration-700 ${feat1InView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                    <div className="flex-1 space-y-3">
                        <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Feature 01 / Smart Allocations</span>
                        <h3 className="text-xl font-bold text-gray-900 leading-tight">Longer Route Booking</h3>
                        <p className="text-xs text-gray-400 leading-relaxed">
                            Bypass limited intermediate quotas by booking from preceding stations or extensions beyond your destination.
                        </p>
                    </div>
                    <div className="flex-1 bg-white border border-[#E4E7EC] rounded-xl p-5 shadow-xs w-full">
                        <div className="border-b border-[#F2F4F7] pb-3 mb-3 flex items-center justify-between">
                            <span className="text-xs font-semibold text-gray-900">Seat Optimizer</span>
                            <span className="text-[10px] text-green-700 bg-green-50 px-2 py-0.5 rounded-full font-medium border border-green-200">LONGER ROUTE</span>
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-xs text-gray-500">
                                <span>Requested Route (NDLS → SPJ)</span>
                                <span className="font-medium text-red-600">WL 12</span>
                            </div>
                            <div className="flex items-center justify-between text-xs text-gray-500">
                                <span>Booked Route (NDLS → DBRG)</span>
                                <span className="font-semibold text-green-600">AVAILABLE 07</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Feature 2 */}
                <div ref={feat2Ref} className={`flex flex-col md:flex-row-reverse gap-8 items-start md:items-center transition-all duration-700 ${feat2InView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                    <div className="flex-1 space-y-3">
                        <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Feature 02 / Continuous Journeys</span>
                        <h3 className="text-xl font-bold text-gray-900 leading-tight">Seat Switching</h3>
                        <p className="text-xs text-gray-400 leading-relaxed">
                            Split your trip across two consecutive tickets on the same train to bypass sold-out direct routes.
                        </p>
                    </div>
                    <div className="flex-1 bg-white border border-[#E4E7EC] rounded-xl p-5 shadow-xs w-full">
                        <div className="border-b border-[#F2F4F7] pb-3 mb-3 flex items-center justify-between">
                            <span className="text-xs font-semibold text-gray-900">Seat Optimizer</span>
                            <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full font-medium border border-amber-200">SEAT SWITCH</span>
                        </div>
                        <div className="flex items-center justify-between text-xs font-medium text-gray-700">
                            <span>Ticket 1 (ANVT ➔ LKO)</span>
                            <span className="text-gray-300">───</span>
                            <span className="text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md text-[10px]">Switch seat</span>
                            <span className="text-gray-300">───</span>
                            <span>Ticket 2 (LKO ➔ MFP)</span>
                        </div>
                    </div>
                </div>

                {/* Feature 3 */}
                <div ref={feat3Ref} className={`flex flex-col md:flex-row gap-8 items-start md:items-center transition-all duration-700 ${feat3InView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                    <div className="flex-1 space-y-3">
                        <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Feature 03 / Connecting Trains</span>
                        <h3 className="text-xl font-bold text-gray-900 leading-tight">Multi-Leg Routes</h3>
                        <p className="text-xs text-gray-400 leading-relaxed">
                            Connect multiple trains at intermediate junctions with layovers automatically timed by the routing engine.
                        </p>
                    </div>
                    <div className="flex-1 bg-white border border-[#E4E7EC] rounded-xl p-5 shadow-xs w-full">
                        <div className="border-b border-[#F2F4F7] pb-3 mb-3 flex items-center justify-between">
                            <span className="text-xs font-semibold text-gray-900">Multi-Hop Search</span>
                            <span className="text-[10px] text-gray-700 bg-gray-50 px-2 py-0.5 rounded-full font-medium border border-gray-200">1 CHANGE</span>
                        </div>
                        <div className="text-xs space-y-1">
                            <div className="flex justify-between"><span>Leg 1 (NDLS → CNB)</span><span className="text-green-600 font-medium">Available</span></div>
                            <div className="flex justify-between text-gray-400"><span>Layover (Kanpur)</span><span>1h 15m wait</span></div>
                            <div className="flex justify-between"><span>Leg 2 (CNB → MFP)</span><span className="text-green-600 font-medium">Available</span></div>
                        </div>
                    </div>
                </div>

            </div>

            {/* Parallax Image 2 Section */}
            <div ref={section2Ref} className="relative h-[400px] overflow-hidden flex items-center justify-center bg-black">
                <div
                    className="absolute inset-0 bg-cover bg-center transition-transform duration-75"
                    style={{
                        backgroundImage: `url('/aesthetic_rail_night_two.png')`,
                        transform: `scale(${scaleFactor2}) translateY(${(scrollOffset - 600) * 0.03}px)`,
                        opacity: 0.65
                    }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#F7F8FA] via-transparent to-[#F7F8FA]/20" />
                <div className="relative z-10 text-center px-6 max-w-2xl">
                    <h2 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight drop-shadow-sm">National Network Coverage</h2>
                    <p className="text-gray-300 mt-3 text-sm md:text-base">Connecting Delhi, Mumbai, Kolkata, Chennai, and every minor junction in between. Over 8,000 daily trains are processed in real-time by the scrapers.</p>
                </div>
            </div>

            {/* Network Detail Grid Section */}
            <div className={`max-w-5xl mx-auto px-6 py-20 transition-all duration-700 ${networkInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`} ref={networkRef}>
                <div className="text-center max-w-xl mx-auto mb-12">
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Database coverage</span>
                    <h3 className="text-2xl font-bold text-gray-900 mt-2">Zero Blind Spots</h3>
                    <p className="text-sm text-gray-500 mt-2">We scan schedules and real-time quotas across all 17 railway zones in India, supporting every train type from local passenger expresses to Rajdhani, Shatabdi, and Vande Bharat superfast links.</p>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                    <div className="bg-white border border-[#E4E7EC] rounded-xl p-4">
                        <span className="text-sm font-bold text-gray-900">7,000+ Stations</span>
                        <p className="text-xs text-gray-400 mt-0.5">Fully searchable database</p>
                    </div>
                    <div className="bg-white border border-[#E4E7EC] rounded-xl p-4">
                        <span className="text-sm font-bold text-gray-900">17 Railway Zones</span>
                        <p className="text-xs text-gray-400 mt-0.5">100% geographic coverage</p>
                    </div>
                    <div className="bg-white border border-[#E4E7EC] rounded-xl p-4">
                        <span className="text-sm font-bold text-gray-900">Real-Time Streams</span>
                        <p className="text-xs text-gray-400 mt-0.5">Live status API calls</p>
                    </div>
                    <div className="bg-white border border-[#E4E7EC] rounded-xl p-4">
                        <span className="text-sm font-bold text-gray-900">Instant Checkups</span>
                        <p className="text-xs text-gray-400 mt-0.5">Direct IRCTC matching</p>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <footer className="border-t border-[#E4E7EC] bg-white py-8 mt-auto">
                <div className="max-w-5xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4">
                    <p className="text-xs text-gray-400">© 2026 RailPath. Built for seamless rail travel optimization across India.</p>
                    <div className="flex gap-4">
                        <Link to="/login" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">Sign In</Link>
                        <Link to="/signup" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">Sign Up</Link>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default Landing;
