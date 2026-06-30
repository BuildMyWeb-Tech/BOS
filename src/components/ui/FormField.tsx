'use client';
// src/components/ui/FormField.tsx

interface FormFieldProps {
  label:      string;
  error?:     string | null;
  required?:  boolean;
  hint?:      string;
  children:   React.ReactNode;
}

export default function FormField({ label, error, required, hint, children }: FormFieldProps) {
  return (
    <div>
      <label className="form-label">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
