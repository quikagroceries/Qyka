"use client";

import { useEffect, useRef, useState } from "react";
import Icon from "@/components/ui/Icon";

const MAX_BYTES = 10 * 1024 * 1024;

// A single document/photo picker: thumbnail (or file-name chip for PDFs),
// Replace/Remove actions, size guard. Files stay local (File objects) until
// final submit — no bytes are uploaded yet. Verification/storage is backend
// work that doesn't exist for this form yet (see RiderApplicationWizard).
function UploadField({
  id,
  label,
  required,
  hint,
  accept = "image/*",
  value,
  onChange,
  error,
}: {
  id: string;
  label: string;
  required?: boolean;
  hint?: string;
  accept?: string;
  value: File | null;
  onChange: (file: File | null) => void;
  error?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [localError, setLocalError] = useState("");

  useEffect(() => {
    if (!value || !value.type.startsWith("image/")) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(value);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [value]);

  function handlePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setLocalError("");
    if (file.size > MAX_BYTES) {
      setLocalError("That file is too large — pick one under 10 MB.");
      return;
    }
    onChange(file);
  }

  const shownError = error || localError;

  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-semibold text-ink">
        {label}
        {required && <span className="text-brand-orange-dark"> *</span>}
      </label>
      <input ref={inputRef} id={id} type="file" accept={accept} onChange={handlePick} className="hidden" />
      {value ? (
        <div className="flex items-center gap-3 rounded-2xl border border-line-strong bg-canvas p-3">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="" className="h-12 w-12 shrink-0 rounded-xl object-cover" />
          ) : (
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-sunken text-faint">
              <Icon name="basket" className="h-5 w-5" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink">{value.name}</p>
            <p className="text-xs text-faint">{(value.size / 1024).toFixed(0)} KB</p>
          </div>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="shrink-0 rounded-full px-2 py-1 text-xs font-bold text-brand-orange-dark hover:underline"
          >
            Replace
          </button>
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label="Remove file"
            className="shrink-0 rounded-full p-1.5 text-faint hover:bg-sunken hover:text-red-600"
          >
            <Icon name="trash" className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line-strong bg-canvas px-4 text-sm font-semibold text-muted transition hover:border-brand-orange hover:text-brand-orange-dark"
        >
          <Icon name="plus" className="h-4 w-4" />
          Upload {label.toLowerCase()}
        </button>
      )}
      {hint && !shownError && <p className="mt-1 text-xs text-faint">{hint}</p>}
      {shownError && <p className="mt-1 text-xs font-semibold text-red-600">{shownError}</p>}
    </div>
  );
}

export default UploadField;
