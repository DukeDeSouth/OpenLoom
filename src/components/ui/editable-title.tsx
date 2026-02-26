"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface EditableTitleProps {
  value: string;
  onSave: (newTitle: string) => Promise<void>;
  editable?: boolean;
  size?: "sm" | "lg";
  className?: string;
}

const sizeStyles = {
  sm: "text-sm font-medium",
  lg: "text-xl font-semibold",
};

export function EditableTitle({
  value,
  onSave,
  editable = false,
  size = "sm",
  className = "",
}: EditableTitleProps) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const save = useCallback(async () => {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === value) {
      setDraft(value);
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(trimmed);
      setDraft(trimmed);
    } catch {
      setDraft(value);
    } finally {
      setSaving(false);
      setEditing(false);
    }
  }, [draft, value, onSave]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      save();
    } else if (e.key === "Escape") {
      setDraft(value);
      setEditing(false);
    }
  }

  if (!editable) {
    return (
      <h3 className={`${sizeStyles[size]} text-text-primary truncate ${className}`}>
        {value}
      </h3>
    );
  }

  if (editing) {
    return (
      <div className={`flex items-center gap-1.5 ${className}`}>
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={save}
          onKeyDown={handleKeyDown}
          disabled={saving}
          maxLength={200}
          className={`${sizeStyles[size]} text-text-primary bg-white/5 border border-glass-border rounded px-2 py-0.5 w-full outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 disabled:opacity-50`}
        />
        {saving && (
          <svg className="w-3.5 h-3.5 animate-spin text-text-muted shrink-0" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        )}
      </div>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className={`${sizeStyles[size]} text-text-primary truncate text-left group/title flex items-center gap-1.5 max-w-full ${className}`}
    >
      <span className="truncate">{value}</span>
      <svg
        className="w-3 h-3 text-text-faint opacity-0 group-hover/title:opacity-100 transition-opacity shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={2}
        stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" />
      </svg>
    </button>
  );
}
