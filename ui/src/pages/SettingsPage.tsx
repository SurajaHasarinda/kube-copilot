import React, { useState, useEffect } from 'react';
import { Settings, Lock, User, Mail } from 'lucide-react';
import { api } from '../api';
import { UserInfo } from '../types';
import FormField from '../components/FormField';
import StatusMessage from '../components/StatusMessage';

type FormMessage = { type: 'success' | 'error'; text: string } | null;

const SettingsPage: React.FC = () => {
    const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
    const [loadingUserInfo, setLoadingUserInfo] = useState(true);

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
