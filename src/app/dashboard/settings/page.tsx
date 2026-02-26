"use client";

import { useEffect, useState, useCallback } from "react";
import { Nav } from "@/components/nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ErrorBanner } from "@/components/ui/error-banner";
import { fetchJSON } from "@/lib/fetch-json";

interface Channel {
  title: string;
  description: string | null;
}

export default function SettingsPage() {
  const [channel, setChannel] = useState<Channel | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchJSON<Channel>("/api/channel");
      setChannel(data);
      setTitle(data.title);
      setDescription(data.description || "");
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to load"));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      await fetchJSON("/api/channel", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to save"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen">
      <Nav />
      <main className="max-w-2xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-text-primary mb-6">Channel Settings</h1>

        {error && <ErrorBanner error={error} onRetry={load} className="mb-4" />}

        {channel && (
          <Card className="p-6 space-y-4">
            <Input
              id="channel-title"
              label="Channel Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="My Channel"
              maxLength={200}
            />

            <div>
              <label htmlFor="channel-desc" className="block text-sm font-medium text-text-secondary mb-1.5">
                Description
              </label>
              <textarea
                id="channel-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What is your channel about?"
                maxLength={1000}
                rows={3}
                className="w-full rounded-sm bg-white/5 border border-glass-border px-4 py-2.5 text-text-primary placeholder-text-faint backdrop-blur-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50 focus:bg-white/8 resize-none"
              />
            </div>

            <div className="flex items-center gap-3">
              <Button variant="accent" onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </Button>
              {saved && <span className="text-sm text-success">Saved</span>}
            </div>
          </Card>
        )}
      </main>
    </div>
  );
}
