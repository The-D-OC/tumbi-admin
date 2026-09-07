import type { ReactNode } from 'react';

/** Label + optional hint + inline validation error around any input. */
export function Field({
  label,
  required,
  hint,
  error,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`field ${error ? 'invalid' : ''} ${className ?? ''}`}>
      <label>
        {label} {required && <span className="req">*</span>}
        {hint && <span className="hint"> — {hint}</span>}
      </label>
      {children}
      {error && <span className="error">{error}</span>}
    </div>
  );
}
