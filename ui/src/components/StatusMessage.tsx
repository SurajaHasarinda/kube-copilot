import React from 'react';
import { CheckCircle, AlertCircle } from 'lucide-react';

interface StatusMessageProps {
    message: { type: 'success' | 'error'; text: string } | null;
}

const StatusMessage: React.FC<StatusMessageProps> = ({ message }) => {
    if (!message) return null;

    const isSuccess = message.type === 'success';

    return (
        <div className={`flex items-center gap-2 p-4 rounded-md ${isSuccess
                ? 'bg-green-900/20 border border-green-700 text-green-400'
                : 'bg-red-900/20 border border-red-700 text-red-400'
            }`}>
            {isSuccess ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
            <span>{message.text}</span>
        </div>
    );
};

export default StatusMessage;
