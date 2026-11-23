"use client";

import Input from "@/components/ui/Input";
import DatePicker from "@/components/ui/DatePicker";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/Select";

export const fieldInputClass =
  "min-h-[48px] w-full rounded-2xl border border-line-strong bg-canvas px-4 text-base text-ink placeholder:text-faint focus:border-brand-orange focus:outline-none focus:ring-2 focus:ring-brand-orange";

// Label + input/select/textarea + inline error — the one wrapper every field
// in the rider application uses, so the 40-odd fields across five sections
// stay visually consistent without repeating the label/error markup.
function FormField({
  label,
  htmlFor,
  required,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1 block text-sm font-semibold text-ink">
        {label}
        {required && <span className="text-brand-orange-dark"> *</span>}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-faint">{hint}</p>}
      {error && <p className="mt-1 text-xs font-semibold text-red-600">{error}</p>}
    </div>
  );
}

export function TextField({
  id, label, required, error, hint, type = "text", ...props
}: any) {
  return (
    <FormField label={label} htmlFor={id} required={required} error={error} hint={hint}>
      <Input id={id} type={type} required={required} className={error ? "border-red-400" : ""} {...props} />
    </FormField>
  );
}

export function TextAreaField({ id, label, required, error, hint, ...props }: any) {
  return (
    <FormField label={label} htmlFor={id} required={required} error={error} hint={hint}>
      <textarea
        id={id}
        required={required}
        rows={3}
        className={fieldInputClass + " min-h-[88px] resize-none rounded-2xl py-3" + (error ? " border-red-400" : "")}
        {...props}
      />
    </FormField>
  );
}

export function SelectField({
  id, label, required, error, hint, options, placeholder, value, onChange,
}: {
  id: string; label: string; required?: boolean; error?: string; hint?: string;
  options: { value: string; label: string }[]; placeholder?: string;
  value: string; onChange: (e: { target: { value: string } }) => void;
}) {
  return (
    <FormField label={label} htmlFor={id} required={required} error={error} hint={hint}>
      <Select value={value} onValueChange={(v) => onChange({ target: { value: v } })}>
        <SelectTrigger id={id} className={error ? "border-red-400" : ""}>
          <SelectValue placeholder={placeholder || "Select…"} />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FormField>
  );
}

export function DateField({
  id, label, required, error, hint, value, onChange, fromYear, toYear, disabled,
}: {
  id: string; label: string; required?: boolean; error?: string; hint?: string;
  value: string; onChange: (e: { target: { value: string } }) => void;
  fromYear?: number; toYear?: number; disabled?: (date: Date) => boolean;
}) {
  return (
    <FormField label={label} htmlFor={id} required={required} error={error} hint={hint}>
      <DatePicker
        id={id}
        value={value}
        onChange={(v) => onChange({ target: { value: v } })}
        fromYear={fromYear}
        toYear={toYear}
        disabled={disabled}
        className={error ? "border-red-400" : ""}
      />
    </FormField>
  );
}

export default FormField;
