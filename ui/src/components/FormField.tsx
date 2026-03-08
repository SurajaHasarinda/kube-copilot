import React from 'react';

interface FormFieldProps {
    id: string;
    label: string;
    type?: string;
    value: string;
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    placeholder?: string;
    required?: boolean;
    disabled?: boolean;
    minLength?: number;
}

const FormField: React.FC<FormFieldProps> = ({
    id, label, type = 'text', value, onChange, placeholder, required, disabled, minLength
}) => (
    <div>
        <label htmlFor={id} className="block text-sm font-medium text-slate-300 mb-2">
            {label}
        </label>
        <input
            id={id}
            type={type}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            required={required}
            disabled={disabled}
            minLength={minLength}
            className={`w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-md text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent ${disabled ? 'bg-slate-900/50 text-slate-400 cursor-not-allowed' : ''}`}
        />
    </div>
);

export default FormField;
