import React, { useState, useEffect } from 'react';
import { Settings, Lock, User, CheckCircle, AlertCircle, Mail } from 'lucide-react';
import { api } from '../api';
import { UserInfo } from '../types';

const SettingsPage: React.FC = () => {
    const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
    const [loadingUserInfo, setLoadingUserInfo] = useState(true);

    // Username change state
    const [newUsername, setNewUsername] = useState('');
    const [usernamePassword, setUsernamePassword] = useState('');
    const [usernameLoading, setUsernameLoading] = useState(false);
    const [usernameMessage, setUsernameMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    // Password change state
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordLoading, setPasswordLoading] = useState(false);
    const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    // Alert Email change state
    const [newEmail, setNewEmail] = useState('');
    const [emailPassword, setEmailPassword] = useState('');
    const [emailLoading, setEmailLoading] = useState(false);
    const [emailMessage, setEmailMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    useEffect(() => {
        loadUserInfo();
    }, []);

    const loadUserInfo = async () => {
        setLoadingUserInfo(true);
        const info = await api.getUserInfo();
        if (info) {
            setUserInfo(info);
            setNewUsername(info.username);
            setNewEmail(info.email || '');
        }
        setLoadingUserInfo(false);
    };

    const handleUsernameChange = async (e: React.FormEvent) => {
        e.preventDefault();
        setUsernameMessage(null);

        // Validation
        if (newUsername.length < 3) {
            setUsernameMessage({ type: 'error', text: 'Username must be at least 3 characters long.' });
            return;
        }

        if (newUsername === userInfo?.username) {
            setUsernameMessage({ type: 'error', text: 'New username must be different from current username.' });
            return;
        }

        setUsernameLoading(true);
        try {
            const result = await api.changeUsername(newUsername, usernamePassword);
            if (result.success) {
                setUsernameMessage({ type: 'success', text: 'Username changed successfully!' });
                setUsernamePassword('');
                // Reload user info to update display
                await loadUserInfo();
            } else {
                setUsernameMessage({ type: 'error', text: 'Failed to change username. Please check your password or username may already exist.' });
            }
        } catch (error) {
            setUsernameMessage({ type: 'error', text: 'An error occurred while changing the username.' });
        } finally {
            setUsernameLoading(false);
        }
    };

    const handleEmailChange = async (e: React.FormEvent) => {
        e.preventDefault();
        setEmailMessage(null);

        // Validation
        if (newEmail.length < 3 || !newEmail.includes('@')) {
            setEmailMessage({ type: 'error', text: 'Please enter a valid email address.' });
            return;
        }

        setEmailLoading(true);
        try {
            const success = await api.changeEmail(newEmail, emailPassword);
            if (success) {
                setEmailMessage({ type: 'success', text: 'Email converted successfully! Critical anomalies will now be sent here.' });
                setEmailPassword('');
                await loadUserInfo();
            } else {
                setEmailMessage({ type: 'error', text: 'Failed to update email. Please check your password.' });
            }
        } catch (error) {
            setEmailMessage({ type: 'error', text: 'An error occurred while changing the email.' });
        } finally {
            setEmailLoading(false);
        }
    };

    const handlePasswordChange = async (e: React.FormEvent) => {
        e.preventDefault();
        setPasswordMessage(null);

        // Validation
        if (newPassword.length < 6) {
            setPasswordMessage({ type: 'error', text: 'New password must be at least 6 characters long.' });
            return;
        }

        if (newPassword !== confirmPassword) {
            setPasswordMessage({ type: 'error', text: 'New passwords do not match.' });
            return;
        }

        if (currentPassword === newPassword) {
            setPasswordMessage({ type: 'error', text: 'New password must be different from current password.' });
            return;
        }

        setPasswordLoading(true);
        try {
            const success = await api.changePassword(currentPassword, newPassword);
            if (success) {
                setPasswordMessage({ type: 'success', text: 'Password changed successfully!' });
                setCurrentPassword('');
                setNewPassword('');
                setConfirmPassword('');
            } else {
                setPasswordMessage({ type: 'error', text: 'Failed to change password. Please check your current password.' });
            }
        } catch (error) {
            setPasswordMessage({ type: 'error', text: 'An error occurred while changing the password.' });
        } finally {
            setPasswordLoading(false);
        }
    };

    return (
        <div className="p-6 md:p-8 max-w-4xl mx-auto">
            {/* Header */}
            <div className="mb-8">
                <div className="flex items-center gap-3 mb-2">
                    <Settings className="text-brand" size={32} />
                    <h1 className="text-3xl font-bold text-slate-100">Settings</h1>
                </div>
                <p className="text-slate-400">Manage your account preferences and security settings</p>
            </div>

            {loadingUserInfo ? (
                <div className="text-center text-slate-400 py-8">Loading user information...</div>
            ) : (
                <div className="space-y-6">
                    {/* Change Username Section */}
                    <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <User className="text-brand" size={20} />
                            <h2 className="text-xl font-semibold text-slate-100">Change Username</h2>
                        </div>
                        <p className="text-slate-400 mb-6">
                            Update your username. Your username must be at least 3 characters long and unique.
                        </p>

                        <form onSubmit={handleUsernameChange} className="space-y-4">
                            <div>
                                <label htmlFor="current-username" className="block text-sm font-medium text-slate-300 mb-2">
                                    Current Username
                                </label>
                                <input
                                    id="current-username"
                                    type="text"
                                    value={userInfo?.username || ''}
                                    disabled
                                    className="w-full px-4 py-2 bg-slate-900/50 border border-slate-600 rounded-md text-slate-400 cursor-not-allowed"
                                />
                            </div>

                            <div>
                                <label htmlFor="new-username" className="block text-sm font-medium text-slate-300 mb-2">
                                    New Username
                                </label>
                                <input
                                    id="new-username"
                                    type="text"
                                    value={newUsername}
                                    onChange={(e) => setNewUsername(e.target.value)}
                                    className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-md text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
                                    placeholder="Enter your new username"
                                    required
                                    minLength={3}
                                />
                            </div>

                            <div>
                                <label htmlFor="username-password" className="block text-sm font-medium text-slate-300 mb-2">
                                    Current Password (for verification)
                                </label>
                                <input
                                    id="username-password"
                                    type="password"
                                    value={usernamePassword}
                                    onChange={(e) => setUsernamePassword(e.target.value)}
                                    className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-md text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
                                    placeholder="Enter your password"
                                    required
                                />
                            </div>

                            {/* Message Display */}
                            {usernameMessage && (
                                <div
                                    className={`flex items-center gap-2 p-4 rounded-md ${usernameMessage.type === 'success'
                                            ? 'bg-green-900/20 border border-green-700 text-green-400'
                                            : 'bg-red-900/20 border border-red-700 text-red-400'
                                        }`}
                                >
                                    {usernameMessage.type === 'success' ? (
                                        <CheckCircle size={20} />
                                    ) : (
                                        <AlertCircle size={20} />
                                    )}
                                    <span>{usernameMessage.text}</span>
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={usernameLoading}
                                className="w-full md:w-auto px-6 py-2 bg-brand hover:bg-brand-dark text-white font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {usernameLoading ? 'Updating...' : 'Update Username'}
                            </button>
                        </form>
                    </div>

                    {/* Change Email Section */}
                    <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <Mail className="text-brand" size={20} />
                            <h2 className="text-xl font-semibold text-slate-100">Alert Email Address</h2>
                        </div>
                        <p className="text-slate-400 mb-6">
                            Set an email address where you will instantly receive reports if KubeCopilot detects a critical cluster anomaly.
                        </p>

                        <form onSubmit={handleEmailChange} className="space-y-4">
                            <div>
                                <label htmlFor="current-email" className="block text-sm font-medium text-slate-300 mb-2">
                                    Current Alert Email
                                </label>
                                <input
                                    id="current-email"
                                    type="text"
                                    value={userInfo?.email || 'Not configured'}
                                    disabled
                                    className="w-full px-4 py-2 bg-slate-900/50 border border-slate-600 rounded-md text-slate-400 cursor-not-allowed"
                                />
                            </div>

                            <div>
                                <label htmlFor="new-email" className="block text-sm font-medium text-slate-300 mb-2">
                                    New Alert Email
                                </label>
                                <input
                                    id="new-email"
                                    type="email"
                                    value={newEmail}
                                    onChange={(e) => setNewEmail(e.target.value)}
                                    className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-md text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
                                    placeholder="yourname@company.com"
                                    required
                                />
                            </div>

                            <div>
                                <label htmlFor="email-password" className="block text-sm font-medium text-slate-300 mb-2">
                                    Current Password (for verification)
                                </label>
                                <input
                                    id="email-password"
                                    type="password"
                                    value={emailPassword}
                                    onChange={(e) => setEmailPassword(e.target.value)}
                                    className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-md text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
                                    placeholder="Enter your password"
                                    required
                                />
                            </div>

                            {/* Message Display */}
                            {emailMessage && (
                                <div
                                    className={`flex items-center gap-2 p-4 rounded-md ${emailMessage.type === 'success'
                                            ? 'bg-green-900/20 border border-green-700 text-green-400'
                                            : 'bg-red-900/20 border border-red-700 text-red-400'
                                        }`}
                                >
                                    {emailMessage.type === 'success' ? (
                                        <CheckCircle size={20} />
                                    ) : (
                                        <AlertCircle size={20} />
                                    )}
                                    <span>{emailMessage.text}</span>
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={emailLoading}
                                className="w-full md:w-auto px-6 py-2 bg-brand hover:bg-brand-dark text-white font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {emailLoading ? 'Updating Email...' : 'Update Alert Email'}
                            </button>
                        </form>
                    </div>

                    {/* Change Password Section */}
                    <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <Lock className="text-brand" size={20} />
                            <h2 className="text-xl font-semibold text-slate-100">Change Password</h2>
                        </div>
                        <p className="text-slate-400 mb-6">
                            Update your password to keep your account secure. Your password must be at least 6 characters long.
                        </p>

                        <form onSubmit={handlePasswordChange} className="space-y-4">
                            <div>
                                <label htmlFor="current-password" className="block text-sm font-medium text-slate-300 mb-2">
                                    Current Password
                                </label>
                                <input
                                    id="current-password"
                                    type="password"
                                    value={currentPassword}
                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                    className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-md text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
                                    placeholder="Enter your current password"
                                    required
                                />
                            </div>

                            <div>
                                <label htmlFor="new-password" className="block text-sm font-medium text-slate-300 mb-2">
                                    New Password
                                </label>
                                <input
                                    id="new-password"
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-md text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
                                    placeholder="Enter your new password"
                                    required
                                    minLength={6}
                                />
                            </div>

                            <div>
                                <label htmlFor="confirm-password" className="block text-sm font-medium text-slate-300 mb-2">
                                    Confirm New Password
                                </label>
                                <input
                                    id="confirm-password"
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-md text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
                                    placeholder="Confirm your new password"
                                    required
                                    minLength={6}
                                />
                            </div>

                            {/* Message Display */}
                            {passwordMessage && (
                                <div
                                    className={`flex items-center gap-2 p-4 rounded-md ${passwordMessage.type === 'success'
                                            ? 'bg-green-900/20 border border-green-700 text-green-400'
                                            : 'bg-red-900/20 border border-red-700 text-red-400'
                                        }`}
                                >
                                    {passwordMessage.type === 'success' ? (
                                        <CheckCircle size={20} />
                                    ) : (
                                        <AlertCircle size={20} />
                                    )}
                                    <span>{passwordMessage.text}</span>
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={passwordLoading}
                                className="w-full md:w-auto px-6 py-2 bg-brand hover:bg-brand-dark text-white font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {passwordLoading ? 'Updating...' : 'Update Password'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SettingsPage;
