import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const Navbar = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const [showNavbar, setShowNavbar] = useState(true);
    const [lastScrollY, setLastScrollY] = useState(0);

    useEffect(() => {
        const handleScroll = () => {
            const currentScrollY = window.scrollY;
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

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    if (!user) return null;

    return (
        <>
            <nav className={`fixed top-0 left-0 right-0 z-50 bg-white border-b border-[#E4E7EC] transition-transform duration-300 ${showNavbar ? 'translate-y-0' : '-translate-y-full'}`}>
            <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
                {/* Logo */}
                <div
                    className="flex items-center gap-2 cursor-pointer hover:opacity-70 transition-opacity duration-200 active:scale-95"
                    onClick={() => navigate('/')}
                >
                    <span
                        className="material-symbols-outlined text-base text-gray-900"
                        style={{ fontVariationSettings: "'FILL' 0, 'wght' 200" }}
                    >
                        route
                    </span>
                    <span className="text-sm font-semibold tracking-tight text-gray-900">RailPath</span>
                </div>

                {/* Nav links + actions */}
                <div className="flex items-center gap-6">
                    <button
                        onClick={() => navigate('/search')}
                        className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-all duration-200 active:scale-95"
                    >
                        Search
                    </button>

                    <button
                        onClick={() => navigate('/chat')}
                        className="flex items-center gap-1.5 text-sm font-medium text-gray-900 bg-gray-900 text-white px-3 py-1.5 rounded-lg hover:bg-gray-700 transition-all duration-200 active:scale-95"
                    >
                        <span className="material-symbols-outlined text-sm text-white" style={{ fontVariationSettings: "'FILL' 0, 'wght' 200" }}>
                            auto_awesome
                        </span>
                        Chat
                    </button>

                    <button
                        onClick={() => navigate('/profile')}
                        className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-all duration-200 active:scale-95"
                    >
                        Profile
                    </button>

                    <span className="hidden md:inline text-xs text-gray-400 font-normal">{user.email}</span>

                    <button
                        onClick={handleLogout}
                        className="text-sm text-gray-400 hover:text-red-500 transition-all duration-150 active:scale-95"
                    >
                        Logout
                    </button>
                </div>
            </div>
            </nav>
            <div className="h-[53px] md:h-[61px] w-full shrink-0" />
        </>
    );
};

export default Navbar;
