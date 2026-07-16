import axios from 'axios';

export const API_BASE_URL = 'https://train-scraper.onrender.com/api';

const api = axios.create({
    baseURL: API_BASE_URL,
});

// Silently wake the Render backend on app load (free tier sleeps after inactivity)
fetch('https://train-scraper.onrender.com/health').catch(() => {});

// Interceptor to attach JWT
api.interceptors.request.use((config) => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
        const user = JSON.parse(storedUser);
        if (user.token) {
            config.headers.Authorization = `Bearer ${user.token}`;
        }
    }
    return config;
}, (error) => {
    return Promise.reject(error);
});

export default api;
