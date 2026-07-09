import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import Loader from '../components/Loader';
import api from '../api';

const passwordSchema = z.object({
    oldPassword: z.string().min(1, "Old password is required"),
    newPassword: z.string()
        .min(8, "Password must be at least 8 characters")
        .regex(/[!@#$%^&*(),.?":{}|<>]/, "Password must contain at least one special character")
        .regex(/[0-9]/, "Password must contain at least one number")
        .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
});

const profileSchema = z.object({
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    gender: z.string().optional(),
    dob: z.string().optional(),
    nationality: z.string().optional(),
    maritalStatus: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    passportNo: z.string().optional(),
    passportExpiry: z.string().optional(),
    issuingCountry: z.string().optional(),
    panCard: z.string().optional(),
});

const inputClass = "w-full border border-[#E4E7EC] rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900 bg-white transition-colors appearance-none";
const labelClass = "text-sm font-medium text-gray-700 mb-1 block";

const Profile = () => {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState('profile');

    // Profile Form
    const { register: registerProfile, handleSubmit: handleProfileSubmit, reset: resetProfile } = useForm({
        resolver: zodResolver(profileSchema)
    });

    const [profileLoading, setProfileLoading] = useState(true);
    const [profileStatus, setProfileStatus] = useState({ type: '', message: '' });

    // Password Form
    const { register: registerPwd, handleSubmit: handlePwdSubmit, formState: { errors: pwdErrors }, reset: resetPwd } = useForm({
        resolver: zodResolver(passwordSchema)
    });
    const [pwdStatus, setPwdStatus] = useState({ type: '', message: '' });
    const [pwdLoading, setPwdLoading] = useState(false);

    // Fetch profile data on mount
    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const res = await api.get('/auth/profile');
                resetProfile(res.data);
            } catch (err) {
                console.error('Failed to fetch profile', err);
            } finally {
                setProfileLoading(false);
            }
        };
        fetchProfile();
    }, [resetProfile]);

    const onProfileSave = async (data) => {
        setProfileStatus({ type: '', message: '' });
        try {
            const res = await api.put('/auth/profile', data);
            setProfileStatus({ type: 'success', message: res.data.message });
            setTimeout(() => setProfileStatus({ type: '', message: '' }), 3000);
        } catch (err) {
            setProfileStatus({ type: 'error', message: err.response?.data?.message || 'Failed to update profile' });
        }
    };

    const onPasswordSubmit = async (data) => {
        setPwdLoading(true);
        setPwdStatus({ type: '', message: '' });
        try {
            const response = await api.post('/auth/change-password', data);
            setPwdStatus({ type: 'success', message: response.data.message });
            resetPwd();
        } catch (error) {
            setPwdStatus({ type: 'error', message: error.response?.data?.message || 'Failed to change password' });
        } finally {
            setPwdLoading(false);
        }
    };

    if (profileLoading) {
        return (
            <div className="min-h-screen bg-[#F7F8FA] flex items-center justify-center">
                <Loader message="Loading Profile..." />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#F7F8FA]">
            <Navbar />

            <main className="max-w-3xl mx-auto px-4 py-6">
                {/* Page Header */}
                <div>
                    <h1 className="text-xl font-bold text-gray-900">Account</h1>
                    <p className="text-sm text-gray-400 mt-0.5">{user?.email}</p>
                </div>

                {/* Tab Bar */}
                <div className="border-b border-[#E4E7EC] flex gap-6 mt-4 mb-6">
                    <button
                        onClick={() => setActiveTab('profile')}
                        className={`pb-3 text-sm font-medium transition-colors ${
                            activeTab === 'profile'
                                ? 'border-b-2 border-gray-900 text-gray-900'
                                : 'text-gray-400 hover:text-gray-600'
                        }`}
                    >
                        Profile
                    </button>
                    <button
                        onClick={() => setActiveTab('password')}
                        className={`pb-3 text-sm font-medium transition-colors ${
                            activeTab === 'password'
                                ? 'border-b-2 border-gray-900 text-gray-900'
                                : 'text-gray-400 hover:text-gray-600'
                        }`}
                    >
                        Security
                    </button>
                </div>

                {/* Profile Tab */}
                {activeTab === 'profile' && (
                    <form onSubmit={handleProfileSubmit(onProfileSave)} className="space-y-4">

                        {/* Status Message */}
                        {profileStatus.message && (
                            <div className={`text-sm rounded-lg p-3 border ${
                                profileStatus.type === 'success'
                                    ? 'text-green-700 bg-green-50 border-green-200'
                                    : 'text-red-700 bg-red-50 border-red-200'
                            }`}>
                                {profileStatus.message}
                            </div>
                        )}

                        {/* General Information */}
                        <div className="bg-white border border-[#E4E7EC] rounded-xl p-5 space-y-4">
                            <div className="border-b border-[#E4E7EC] pb-3 mb-4">
                                <h2 className="text-sm font-medium text-gray-900">General Information</h2>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={labelClass}>First &amp; Middle Name</label>
                                    <input
                                        {...registerProfile('firstName')}
                                        type="text"
                                        className={inputClass}
                                        placeholder="Enter name"
                                    />
                                </div>
                                <div>
                                    <label className={labelClass}>Last Name</label>
                                    <input
                                        {...registerProfile('lastName')}
                                        type="text"
                                        className={inputClass}
                                        placeholder="Enter last name"
                                    />
                                </div>
                                <div>
                                    <label className={labelClass}>Gender</label>
                                    <select
                                        id="gender-select"
                                        {...registerProfile('gender')}
                                        className={inputClass}
                                    >
                                        <option value="">Select Gender</option>
                                        <option value="Male">Male</option>
                                        <option value="Female">Female</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>
                                <div>
                                    <label className={labelClass}>Date of Birth</label>
                                    <input
                                        {...registerProfile('dob')}
                                        type="date"
                                        className={inputClass}
                                    />
                                </div>
                                <div>
                                    <label className={labelClass}>Nationality</label>
                                    <select {...registerProfile('nationality')} className={inputClass}>
                                        <option value="Indian">Indian</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>
                                <div>
                                    <label className={labelClass}>Marital Status</label>
                                    <select {...registerProfile('maritalStatus')} className={inputClass}>
                                        <option value="">Select</option>
                                        <option value="Single">Single</option>
                                        <option value="Married">Married</option>
                                    </select>
                                </div>
                                <div>
                                    <label className={labelClass}>City of Residence</label>
                                    <input
                                        {...registerProfile('city')}
                                        type="text"
                                        className={inputClass}
                                        placeholder="e.g. Mumbai"
                                    />
                                </div>
                                <div>
                                    <label className={labelClass}>State</label>
                                    <select {...registerProfile('state')} className={inputClass}>
                                        <option value="">Select State</option>
                                        <option value="Maharashtra">Maharashtra</option>
                                        <option value="Delhi">Delhi</option>
                                        <option value="Bihar">Bihar</option>
                                        <option value="Karnataka">Karnataka</option>
                                    </select>
                                    <p className="text-xs text-gray-400 mt-1">Required for GST purpose on your tax invoice</p>
                                </div>
                            </div>
                        </div>

                        {/* Contact Details */}
                        <div className="bg-white border border-[#E4E7EC] rounded-xl p-5 space-y-4">
                            <div className="border-b border-[#E4E7EC] pb-3 mb-4">
                                <h2 className="text-sm font-medium text-gray-900">Contact Details</h2>
                                <p className="text-xs text-gray-400 mt-0.5">Add contact information to receive booking details &amp; other alerts</p>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="border border-[#E4E7EC] rounded-lg px-4 py-3 flex items-center justify-between">
                                    <div>
                                        <p className="text-xs text-gray-400 mb-0.5">Mobile Number</p>
                                        <p className="text-sm font-medium text-gray-900">+91-8955491950</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => alert("To change your mobile number, please contact customer support.")}
                                        className="text-xs font-medium text-gray-500 hover:text-gray-900 transition-colors"
                                    >
                                        Edit
                                    </button>
                                </div>
                                <div className="border border-[#E4E7EC] rounded-lg px-4 py-3 flex items-center justify-between">
                                    <div>
                                        <p className="text-xs text-gray-400 mb-0.5">Email ID</p>
                                        <p className="text-sm font-medium text-gray-900">{user?.email}</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => alert("To change your email address, please contact customer support.")}
                                        className="text-xs font-medium text-gray-500 hover:text-gray-900 transition-colors"
                                    >
                                        Edit
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Documents Details */}
                        <div className="bg-white border border-[#E4E7EC] rounded-xl p-5 space-y-4">
                            <div className="border-b border-[#E4E7EC] pb-3 mb-4">
                                <h2 className="text-sm font-medium text-gray-900">Documents</h2>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={labelClass}>Passport No.</label>
                                    <input
                                        {...registerProfile('passportNo')}
                                        type="text"
                                        className={inputClass}
                                        placeholder="e.g. A1234567"
                                    />
                                </div>
                                <div>
                                    <label className={labelClass}>Expiry Date</label>
                                    <input
                                        {...registerProfile('passportExpiry')}
                                        type="date"
                                        className={inputClass}
                                    />
                                </div>
                                <div>
                                    <label className={labelClass}>Issuing Country</label>
                                    <select {...registerProfile('issuingCountry')} className={inputClass}>
                                        <option value="">Select</option>
                                        <option value="India">India</option>
                                    </select>
                                </div>
                                <div>
                                    <label className={labelClass}>PAN Card Number</label>
                                    <input
                                        {...registerProfile('panCard')}
                                        type="text"
                                        className={inputClass}
                                        placeholder="e.g. ABCDE1234F"
                                    />
                                </div>
                            </div>
                            <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3 mt-2">
                                <strong className="font-medium">Note:</strong> Your PAN No. will only be used for international bookings as per RBI Guidelines.
                            </div>
                        </div>

                        {/* Save Button */}
                        <div className="flex justify-end">
                            <button
                                type="submit"
                                className="bg-gray-900 text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-gray-800 transition-colors"
                            >
                                Save changes
                            </button>
                        </div>
                    </form>
                )}

                {/* Security Tab */}
                {activeTab === 'password' && (
                    <div className="space-y-4">
                        <div className="bg-white border border-[#E4E7EC] rounded-xl p-5">
                            <div className="border-b border-[#E4E7EC] pb-3 mb-4">
                                <h2 className="text-sm font-medium text-gray-900">Change Password</h2>
                                <p className="text-xs text-gray-400 mt-0.5">Create a new, strong password to keep your account secure.</p>
                            </div>

                            {pwdStatus.message && (
                                <div className={`text-sm rounded-lg p-3 border mb-4 ${
                                    pwdStatus.type === 'success'
                                        ? 'text-green-700 bg-green-50 border-green-200'
                                        : 'text-red-700 bg-red-50 border-red-200'
                                }`}>
                                    {pwdStatus.message}
                                </div>
                            )}

                            <form onSubmit={handlePwdSubmit(onPasswordSubmit)} className="space-y-4">
                                <div>
                                    <label className={labelClass}>Current Password</label>
                                    <input
                                        {...registerPwd('oldPassword')}
                                        type="password"
                                        className={inputClass}
                                        placeholder="••••••••"
                                    />
                                    {pwdErrors.oldPassword && (
                                        <p className="text-red-600 text-xs mt-1">{pwdErrors.oldPassword.message}</p>
                                    )}
                                </div>

                                <div>
                                    <label className={labelClass}>New Password</label>
                                    <input
                                        {...registerPwd('newPassword')}
                                        type="password"
                                        className={inputClass}
                                        placeholder="••••••••"
                                    />
                                    {pwdErrors.newPassword && (
                                        <p className="text-red-600 text-xs mt-1">{pwdErrors.newPassword.message}</p>
                                    )}
                                </div>

                                <div className="flex justify-end pt-1">
                                    <button
                                        type="submit"
                                        disabled={pwdLoading}
                                        className="bg-gray-900 text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center gap-2"
                                    >
                                        {pwdLoading
                                            ? <span className="material-symbols-outlined text-base animate-spin">refresh</span>
                                            : 'Update Password'
                                        }
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default Profile;
