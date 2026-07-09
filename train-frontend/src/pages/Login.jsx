import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Loader from '../components/Loader';
import api from '../api';

const loginSchema = z.object({
    email: z.string().email("Invalid email address"),
    password: z.string().min(1, "Password is required"),
});

const Login = () => {
    const { register, handleSubmit, formState: { errors } } = useForm({
        resolver: zodResolver(loginSchema),
    });
    const { login } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [serverError, setServerError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    
    const redirectUrl = searchParams.get('redirect') || '/search';

    const onSubmit = async (data) => {
        setIsLoading(true);
        setServerError('');
        
        // Artificial delay for UX
        const startTime = Date.now();
        let apiError = null;
        let response = null;

        try {
            response = await api.post('/auth/login', data);
        } catch (error) {
            apiError = error;
        }

        const elapsedTime = Date.now() - startTime;
        const delay = Math.max(0, 2000 - elapsedTime);

        setTimeout(() => {
            setIsLoading(false);
            if (apiError) {
                setServerError(apiError.response?.data?.message || 'Login failed');
            } else if (response) {
                login(response.data);
                navigate(redirectUrl, { replace: true });
            }
        }, delay);
    };

    if (isLoading) {
        return (
            <div className="bg-[#F7F8FA] min-h-screen flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <div className="loader-dots"><span></span><span></span><span></span></div>
                    <p className="text-sm text-gray-500">Signing in...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-[#F7F8FA] min-h-screen flex items-center justify-center p-4">
            <div className="bg-white border border-[#E4E7EC] rounded-xl p-8 max-w-sm w-full mx-4 shadow-sm animate-scale-in">
                {/* Header */}
                <div className="mb-6">
                    <span className="material-symbols-outlined text-2xl text-gray-300 block mb-3">train</span>
                    <h1 className="text-2xl font-bold text-gray-900">Sign in</h1>
                    <p className="text-sm text-gray-500 mt-1">Enter your details below</p>
                </div>

                {serverError && (
                    <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3 mb-5">
                        {serverError}
                    </div>
                )}

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div>
                        <label className="text-sm font-medium text-gray-700 mb-1 block">Email</label>
                        <input
                            {...register('email')}
                            type="email"
                            className="w-full border border-[#E4E7EC] rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900 bg-white transition-colors"
                            placeholder="name@example.com"
                        />
                        {errors.email && <p className="text-xs text-red-600 mt-1">{errors.email.message}</p>}
                    </div>

                    <div>
                        <label className="text-sm font-medium text-gray-700 mb-1 block">Password</label>
                        <input
                            {...register('password')}
                            type="password"
                            className="w-full border border-[#E4E7EC] rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900 bg-white transition-colors"
                            placeholder="••••••••"
                        />
                        {errors.password && <p className="text-xs text-red-600 mt-1">{errors.password.message}</p>}
                    </div>

                    <button
                        type="submit"
                        className="bg-gray-900 text-white text-sm font-medium w-full py-2.5 rounded-lg hover:bg-gray-800 hover:scale-[1.01] active:scale-[0.98] transition-all duration-150 mt-2"
                    >
                        Sign in
                    </button>
                </form>

                <p className="text-sm text-gray-500 text-center mt-6">
                    Don't have an account?{' '}
                    <Link to="/signup" className="underline text-gray-900">Sign up</Link>
                </p>
            </div>
        </div>
    );
};

export default Login;
