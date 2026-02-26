"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { fetchJSON } from "@/lib/fetch-json";

interface CreateSectionInlineProps {
  onCreated: (section: { id: string; title: string }) => void;
}

export function CreateSectionInline({ onCreated }: CreateSectionInlineProps) {
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setCreating(true);
    try {
      const section = await fetchJSON<{ id: string; title: string }>("/api/sections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim() }),
      });
      setTitle("");
      onCreated(section);
    } catch {
      // parent will handle refresh errors
    } finally {
      setCreating(false);
    }
  }

  return (
    <form onSubmit={handleCreate} className="flex items-center gap-2">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="New section..."
        maxLength={200}
        className="w-40 sm:w-52 bg-white/5 border border-glass-border rounded px-3 py-1.5 text-sm text-text-primary placeholder-text-faint focus:outline-none focus:ring-2 focus:ring-accent/30 transition-all"
      />
      <Button variant="secondary" size="sm" disabled={creating || !title.trim()}>
        {creating ? "..." : "+ Add"}
      </Button>
    </form>
  );
}
