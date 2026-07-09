import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import Landing from './pages/Landing';
import Profile from './pages/Profile';
import Chat from './pages/Chat';

const ProtectedRoute = ({ children }) => {
    const { user, loading } = useAuth();
    const location = useLocation();
    
    if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
    
    if (!user) {
        // Redirect them to the /login page, but save the current location they were trying to go to
        return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`} replace />;
    }
    
    return children;
};

const AuthRoute = ({ children }) => {
    const { user, loading } = useAuth();
    const location = useLocation();
    
    if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
    
    if (user) {
        // If there's a redirect param, honor it; otherwise default to /search
        const params = new URLSearchParams(location.search);
        const redirect = params.get('redirect') || '/search';
        return <Navigate to={redirect} replace />;
    }
    
    return children;
};

const App = () => {
    return (
        <Routes>
            <Route path="/" element={<Landing />} />
            
            <Route path="/login" element={
                <AuthRoute>
                    <Login />
                </AuthRoute>
            } />
            
            <Route path="/signup" element={
                <AuthRoute>
                    <Signup />
                </AuthRoute>
            } />
            
            <Route path="/search" element={
                <ProtectedRoute>
                    <Dashboard />
                </ProtectedRoute>
            } />
            
            <Route path="/profile" element={
                <ProtectedRoute>
                    <Profile />
                </ProtectedRoute>
            } />

            <Route path="/chat" element={
                <ProtectedRoute>
                    <Chat />
                </ProtectedRoute>
            } />
            
            {/* Fallback route */}
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
};

export default App;
