import { forwardRef, useId } from "react";
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

const controlBase =
  "w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-primary placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent disabled:opacity-50";

export interface FieldProps {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
}

export function Field({ label, hint, error, required, children, id }: FieldProps & { children: ReactNode; id?: string }) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={fieldId} className="block text-sm font-medium">
          {label}
          {required && <span className="ml-0.5 text-muted">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p id={`${fieldId}-error`} role="alert" className="text-xs text-red-600">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & FieldProps>(function Input(
  { label, hint, error, required, className, id, ...props },
  ref,
) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <Field label={label} hint={hint} error={error} required={required} id={fieldId}>
      <input
        ref={ref}
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${fieldId}-error` : hint ? undefined : undefined}
        className={`${controlBase} ${error ? "border-red-400" : ""} ${className ?? ""}`}
        {...props}
      />
    </Field>
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & FieldProps>(
  function Textarea({ label, hint, error, required, className, id, ...props }, ref) {
    const autoId = useId();
    const fieldId = id ?? autoId;
    return (
      <Field label={label} hint={hint} error={error} required={required} id={fieldId}>
        <textarea
          ref={ref}
          id={fieldId}
          aria-invalid={error ? true : undefined}
          className={`${controlBase} ${error ? "border-red-400" : ""} ${className ?? ""}`}
          {...props}
        />
      </Field>
    );
  },
);

export function Select({
  label,
  hint,
  error,
  required,
  id,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & FieldProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <Field label={label} hint={hint} error={error} required={required} id={fieldId}>
      <select id={fieldId} className={controlBase} {...props}>
        {children}
      </select>
    </Field>
  );
}

export function Checkbox({
  label,
  error,
  hint,
  id,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string; hint?: string }) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <div className="space-y-1">
      <label htmlFor={fieldId} className="flex items-start gap-2.5 text-sm text-secondary">
        <input
          id={fieldId}
          type="checkbox"
          className="mt-0.5 h-4 w-4 rounded border-border accent-accent"
          {...props}
        />
        <span>
          {label}
          {hint && <span className="block text-xs text-muted">{hint}</span>}
        </span>
      </label>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function Switch({
  label,
  checked,
  onChange,
  disabled,
  description,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  description?: string;
}) {
  return (
    <label className={`flex items-start justify-between gap-4 ${disabled ? "opacity-50" : ""}`}>
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {description && <span className="block text-xs text-muted">{description}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
          checked ? "bg-accent" : "bg-border"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-bg shadow transition-transform ${
            checked ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </label>
  );
}

export function Slider({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className={disabled ? "opacity-50" : ""}>
      <div className="mb-2 flex items-center justify-between">
        <label className="text-sm font-medium">{label}</label>
        <span className="rounded-md bg-surface-muted px-2 py-0.5 text-sm font-semibold tabular-nums">
          {value}
          <span className="ml-1 text-xs font-normal text-muted">{unit}</span>
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-border accent-accent disabled:cursor-not-allowed"
      />
      <div className="mt-1 flex justify-between text-xs text-muted">
        <span>
          {min} {unit}
        </span>
        <span>
          {max} {unit}
        </span>
      </div>
    </div>
  );
}
