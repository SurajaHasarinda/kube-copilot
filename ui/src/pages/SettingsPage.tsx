import React, { useState, useEffect } from 'react';
import { Settings, Lock, User, Mail, Bell, Shield, Cpu } from 'lucide-react';
import { api } from '../api';
import { UserInfo } from '../types';
import FormField from '../components/FormField';
import StatusMessage from '../components/StatusMessage';

type FormMessage = { type: 'success' | 'error'; text: string } | null;

const SettingsPage: React.FC = () => {
    const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
    const [loadingUserInfo, setLoadingUserInfo] = useState(true);

    const [notificationsEnabled, setNotificationsEnabled] = useState(true);
    const [notificationsLoading, setNotificationsLoading] = useState(false);
    const [notificationsMessage, setNotificationsMessage] = useState<FormMessage>(null);

    const [newUsername, setNewUsername] = useState('');
    const [usernamePassword, setUsernamePassword] = useState('');
    const [usernameLoading, setUsernameLoading] = useState(false);
    const [usernameMessage, setUsernameMessage] = useState<FormMessage>(null);

    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordLoading, setPasswordLoading] = useState(false);
    const [passwordMessage, setPasswordMessage] = useState<FormMessage>(null);

    const [newEmail, setNewEmail] = useState('');
    const [emailPassword, setEmailPassword] = useState('');
    const [emailLoading, setEmailLoading] = useState(false);
    const [emailMessage, setEmailMessage] = useState<FormMessage>(null);

    const [googleApiKey, setGoogleApiKey] = useState('');
    const [geminiModel, setGeminiModel] = useState('gemini-3.0-flash');
    const [isApiKeySet, setIsApiKeySet] = useState(false);
    const [aiSettingsLoading, setAiSettingsLoading] = useState(false);
    const [aiSettingsMessage, setAiSettingsMessage] = useState<FormMessage>(null);

    const loadUserInfo = async () => {
        setLoadingUserInfo(true);
        const [info, aiSettings] = await Promise.all([
            api.getUserInfo(),
            api.getAISettings()
        ]);

        if (info) {
            setUserInfo(info);
            setNewUsername(info.username);
            setNewEmail(info.email || '');
            if (info.notifications_enabled !== undefined) {
                setNotificationsEnabled(info.notifications_enabled);
            }
        }

        if (aiSettings) {
            setIsApiKeySet(aiSettings.google_api_key_configured);
            setGeminiModel(aiSettings.gemini_model);
        }
        setLoadingUserInfo(false);
    };

    useEffect(() => { loadUserInfo(); }, []);

    const handleUsernameChange = async (e: React.FormEvent) => {
        e.preventDefault();
        setUsernameMessage(null);
        if (newUsername.length < 3) return setUsernameMessage({ type: 'error', text: 'Username must be at least 3 characters long.' });
        if (newUsername === userInfo?.username) return setUsernameMessage({ type: 'error', text: 'New username must be different from current username.' });

        setUsernameLoading(true);
        try {
            const result = await api.changeUsername(newUsername, usernamePassword);
            if (result.success) {
                setUsernameMessage({ type: 'success', text: 'Username changed successfully!' });
                setUsernamePassword('');
                await loadUserInfo();
            } else {
                setUsernameMessage({ type: 'error', text: 'Failed to change username. Check your password or the username may already exist.' });
            }
        } catch {
            setUsernameMessage({ type: 'error', text: 'An error occurred while changing the username.' });
        } finally {
            setUsernameLoading(false);
        }
    };

    const handleEmailChange = async (e: React.FormEvent) => {
        e.preventDefault();
        setEmailMessage(null);
        if (newEmail.length < 3 || !newEmail.includes('@')) return setEmailMessage({ type: 'error', text: 'Please enter a valid email address.' });

        setEmailLoading(true);
        try {
            const success = await api.changeEmail(newEmail, emailPassword);
            if (success) {
                setEmailMessage({ type: 'success', text: 'Email updated! Critical anomaly alerts will be sent here.' });
                setEmailPassword('');
                await loadUserInfo();
            } else {
                setEmailMessage({ type: 'error', text: 'Failed to update email. Please check your password.' });
            }
        } catch {
            setEmailMessage({ type: 'error', text: 'An error occurred while changing the email.' });
        } finally {
            setEmailLoading(false);
        }
    };

    const handleToggleNotifications = async () => {
        setNotificationsLoading(true);
        setNotificationsMessage(null);
        try {
            const newStatus = !notificationsEnabled;
            const success = await api.changeNotifications(newStatus);
            if (success) {
                setNotificationsEnabled(newStatus);
                setNotificationsMessage({ type: 'success', text: `Notifications ${newStatus ? 'enabled' : 'disabled'}.` });
            } else {
                setNotificationsMessage({ type: 'error', text: 'Failed to update notification settings.' });
            }
        } catch {
            setNotificationsMessage({ type: 'error', text: 'An error occurred.' });
        } finally {
            setNotificationsLoading(false);
        }
    };

    const handlePasswordChange = async (e: React.FormEvent) => {
        e.preventDefault();
        setPasswordMessage(null);
        if (newPassword.length < 6) return setPasswordMessage({ type: 'error', text: 'New password must be at least 6 characters long.' });
        if (newPassword !== confirmPassword) return setPasswordMessage({ type: 'error', text: 'New passwords do not match.' });
        if (currentPassword === newPassword) return setPasswordMessage({ type: 'error', text: 'New password must be different from current password.' });

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
        } catch {
            setPasswordMessage({ type: 'error', text: 'An error occurred while changing the password.' });
        } finally {
            setPasswordLoading(false);
        }
    };

    const handleAiSettingsChange = async (e: React.FormEvent) => {
        e.preventDefault();
        setAiSettingsMessage(null);
        setAiSettingsLoading(true);
        try {
            const success = await api.updateAISettings(
                googleApiKey || undefined,
                geminiModel
            );
            if (success) {
                setAiSettingsMessage({ type: 'success', text: 'AI settings updated successfully!' });
                setGoogleApiKey('');
                if (googleApiKey) setIsApiKeySet(true);
            } else {
                setAiSettingsMessage({ type: 'error', text: 'Failed to update AI settings.' });
            }
        } catch {
            setAiSettingsMessage({ type: 'error', text: 'An error occurred while updating AI settings.' });
        } finally {
            setAiSettingsLoading(false);
        }
    };

    if (loadingUserInfo) {
        return <div className="p-6 md:p-8 text-center text-slate-400 py-8">Loading user information...</div>;
    }

    return (
        <div className="p-6 md:p-8 max-w-4xl mx-auto">
            <div className="mb-8">
                <div className="flex items-center gap-3 mb-2">
                    <Settings className="text-brand" size={32} />
                    <h1 className="text-3xl font-bold text-slate-100">Settings</h1>
                </div>
                <p className="text-slate-400">Manage your account preferences and security settings</p>
            </div>

            <div className="space-y-6">
                {/* Username */}
                <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <User className="text-brand" size={20} />
                        <h2 className="text-xl font-semibold text-slate-100">Change Username</h2>
                    </div>
                    <p className="text-slate-400 mb-6">Update your username. Must be at least 3 characters and unique.</p>
                    <form onSubmit={handleUsernameChange} className="space-y-4">
                        <FormField id="current-username" label="Current Username" value={userInfo?.username || ''} disabled />
                        <FormField id="new-username" label="New Username" value={newUsername} onChange={e => setNewUsername(e.target.value)} placeholder="Enter your new username" required minLength={3} />
                        <FormField id="username-password" label="Current Password (for verification)" type="password" value={usernamePassword} onChange={e => setUsernamePassword(e.target.value)} placeholder="Enter your password" required />
                        <StatusMessage message={usernameMessage} />
                        <button type="submit" disabled={usernameLoading} className="w-full md:w-auto px-6 py-2 bg-brand hover:bg-brand-dark text-white font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                            {usernameLoading ? 'Updating...' : 'Update Username'}
                        </button>
                    </form>
                </div>

                {/* Email */}
                <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <Mail className="text-brand" size={20} />
                        <h2 className="text-xl font-semibold text-slate-100">Alert Email Address</h2>
                    </div>
                    <p className="text-slate-400 mb-6">Set an email address for critical cluster anomaly alerts.</p>
                    <form onSubmit={handleEmailChange} className="space-y-4">
                        <FormField id="current-email" label="Current Alert Email" value={userInfo?.email || 'Not configured'} disabled />
                        <FormField id="new-email" label="New Alert Email" type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="yourname@company.com" required />
                        <FormField id="email-password" label="Current Password (for verification)" type="password" value={emailPassword} onChange={e => setEmailPassword(e.target.value)} placeholder="Enter your password" required />
                        <StatusMessage message={emailMessage} />
                        <button type="submit" disabled={emailLoading} className="w-full md:w-auto px-6 py-2 bg-brand hover:bg-brand-dark text-white font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                            {emailLoading ? 'Updating Email...' : 'Update Alert Email'}
                        </button>
                    </form>
                </div>

                {/* Notifications */}
                <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <Bell className="text-brand" size={20} />
                        <h2 className="text-xl font-semibold text-slate-100">Notifications</h2>
                    </div>
                    <p className="text-slate-400 mb-6">Receive email alerts when critical cluster anomalies are detected.</p>
                    <div className="flex items-center justify-between p-4 bg-slate-900 rounded-lg border border-slate-700">
                        <div>
                            <p className="font-medium text-slate-200">Email Notifications</p>
                            <p className="text-sm text-slate-400">{notificationsEnabled ? "You will receive critical alerts." : "Alerts are currently paused."}</p>
                        </div>
                        <button
                            type="button"
                            onClick={handleToggleNotifications}
                            disabled={notificationsLoading}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${notificationsEnabled ? 'bg-brand' : 'bg-slate-600'} disabled:opacity-50`}
                        >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${notificationsEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                    </div>
                    {notificationsMessage && (
                        <div className="mt-4">
                            <StatusMessage message={notificationsMessage} />
                        </div>
                    )}
                </div>

                {/* AI Configuration */}
                <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 shadow-lg relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                        <Cpu size={80} className="text-brand" />
                    </div>

                    <div className="flex items-center gap-2 mb-4">
                        <Shield className="text-brand" size={20} />
                        <h2 className="text-xl font-semibold text-slate-100">AI Provider Settings</h2>
                    </div>
                    <p className="text-slate-400 mb-6">Configure your Gemini API key and model selection for KubeCopilot's AI features.</p>

                    <form onSubmit={handleAiSettingsChange} className="space-y-4">
                        <div className="space-y-1">
                            <FormField
                                id="google-api-key"
                                label="Google Gemini API Key"
                                type="password"
                                value={googleApiKey}
                                onChange={e => setGoogleApiKey(e.target.value)}
                                placeholder={isApiKeySet ? "•••••••••••••••• (API Key is set)" : "Enter your Gemini API key"}
                            />
                            {isApiKeySet && (
                                <p className="text-xs text-brand/80 ml-1">✓ API Key is currently configured and active.</p>
                            )}
                        </div>

                        <div className="space-y-1">
                            <FormField
                                id="gemini-model"
                                label="Gemini Model"
                                value={geminiModel}
                                onChange={e => setGeminiModel(e.target.value)}
                                placeholder="e.g. gemini-2.0-flash"
                                required
                            />
                        </div>

                        <StatusMessage message={aiSettingsMessage} />

                        <div className="pt-2">
                            <button
                                type="submit"
                                disabled={aiSettingsLoading}
                                className="w-full md:w-auto px-6 py-2.5 bg-brand hover:bg-brand-dark text-white font-semibold rounded-md transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {aiSettingsLoading ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Saving...
                                    </>
                                ) : 'Save AI Settings'}
                            </button>
                        </div>
                    </form>
                </div>

                {/* Password */}
                <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <Lock className="text-brand" size={20} />
                        <h2 className="text-xl font-semibold text-slate-100">Change Password</h2>
                    </div>
                    <p className="text-slate-400 mb-6">Update your password. Must be at least 6 characters long.</p>
                    <form onSubmit={handlePasswordChange} className="space-y-4">
                        <FormField id="current-password" label="Current Password" type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} placeholder="Enter your current password" required />
                        <FormField id="new-password" label="New Password" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Enter your new password" required minLength={6} />
                        <FormField id="confirm-password" label="Confirm New Password" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Confirm your new password" required minLength={6} />
                        <StatusMessage message={passwordMessage} />
                        <button type="submit" disabled={passwordLoading} className="w-full md:w-auto px-6 py-2 bg-brand hover:bg-brand-dark text-white font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                            {passwordLoading ? 'Updating...' : 'Update Password'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default SettingsPage;
