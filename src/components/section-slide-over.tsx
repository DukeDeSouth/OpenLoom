"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ErrorBanner } from "@/components/ui/error-banner";
import { KeyTable } from "@/components/key-table";
import { fetchJSON } from "@/lib/fetch-json";

interface Video {
  id: string;
  title: string | null;
  sectionId: string | null;
}

interface AccessKey {
  id: string;
  token: string;
  type: "PERMANENT" | "SINGLE_USE";
  label: string | null;
  fingerprint: string | null;
  activatedAt: string | null;
  createdAt: string;
}

interface Section {
  id: string;
  title: string;
  description: string | null;
  visibility: "PUBLIC" | "PRIVATE";
}

interface SectionSlideOverProps {
  sectionId: string;
  onClose: () => void;
  onRefresh: () => void;
  onDeleted: () => void;
}

export function SectionSlideOver({ sectionId, onClose, onRefresh, onDeleted }: SectionSlideOverProps) {
  const [section, setSection] = useState<Section | null>(null);
  const [keys, setKeys] = useState<AccessKey[]>([]);
  const [allVideos, setAllVideos] = useState<Video[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"PUBLIC" | "PRIVATE">("PUBLIC");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [tab, setTab] = useState<"videos" | "keys">("videos");

  const load = useCallback(async () => {
    try {
      const [sec, keyList, videos] = await Promise.all([
        fetchJSON<Section>(`/api/sections/${sectionId}`),
        fetchJSON<AccessKey[]>(`/api/sections/${sectionId}/keys`),
        fetchJSON<Video[]>("/api/videos"),
      ]);
      setSection(sec);
      setTitle(sec.title);
      setDescription(sec.description || "");
      setVisibility(sec.visibility);
      setKeys(keyList);
      setAllVideos(videos);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to load"));
    }
  }, [sectionId]);

  useEffect(() => { load(); }, [load]);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      await fetchJSON(`/api/sections/${sectionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, visibility }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      load();
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Save failed"));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this section? Videos will become unsorted.")) return;
    await fetchJSON(`/api/sections/${sectionId}`, { method: "DELETE" });
    onDeleted();
  }

  async function assignVideo(videoId: string) {
    await fetchJSON(`/api/videos/${videoId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sectionId }),
    });
    load();
    onRefresh();
  }

  async function removeVideo(videoId: string) {
    await fetchJSON(`/api/videos/${videoId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sectionId: null }),
    });
    load();
    onRefresh();
  }

  const assignedVideos = allVideos.filter((v) => v.sectionId === sectionId);
  const unsortedVideos = allVideos.filter((v) => !v.sectionId);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed top-0 right-0 h-full w-[480px] max-w-full z-50 glass border-l border-glass-border shadow-2xl overflow-y-auto animate-slide-in-right">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-text-primary">
              {section?.title || "Loading..."}
            </h2>
            <button
              onClick={onClose}
              className="p-1.5 rounded hover:bg-white/10 text-text-faint hover:text-text-primary transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {error && <ErrorBanner error={error} onRetry={load} className="mb-4" />}

          {section && (
            <>
              {/* Edit form */}
              <div className="space-y-4 mb-6">
                <Input
                  id="slide-title"
                  label="Title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={200}
                />

                <div>
                  <label htmlFor="slide-desc" className="block text-sm font-medium text-text-secondary mb-1.5">
                    Description
                  </label>
                  <textarea
                    id="slide-desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                    maxLength={1000}
                    className="w-full rounded-sm bg-white/5 border border-glass-border px-4 py-2.5 text-text-primary placeholder-text-faint backdrop-blur-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50 resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">Visibility</label>
                  <select
                    value={visibility}
                    onChange={(e) => setVisibility(e.target.value as "PUBLIC" | "PRIVATE")}
                    className="bg-white/5 border border-glass-border rounded px-3 py-2 text-sm text-text-primary"
                  >
                    <option value="PUBLIC">Public</option>
                    <option value="PRIVATE">Private (key required)</option>
                  </select>
                </div>

                <div className="flex items-center gap-3">
                  <Button variant="accent" size="sm" onClick={handleSave} disabled={saving}>
                    {saving ? "Saving..." : "Save"}
                  </Button>
                  {saved && (
                    <span className="text-green-400 text-sm animate-pulse">Saved!</span>
                  )}
                </div>
              </div>

              {/* Tabs */}
              <div className="flex gap-4 mb-4 border-b border-glass-border">
                <button
                  onClick={() => setTab("videos")}
                  className={`pb-2 text-sm font-medium transition-colors ${
                    tab === "videos"
                      ? "text-accent border-b-2 border-accent"
                      : "text-text-muted hover:text-text-primary"
                  }`}
                >
                  Videos ({assignedVideos.length})
                </button>
                {visibility === "PRIVATE" && (
                  <button
                    onClick={() => setTab("keys")}
                    className={`pb-2 text-sm font-medium transition-colors ${
                      tab === "keys"
                        ? "text-accent border-b-2 border-accent"
                        : "text-text-muted hover:text-text-primary"
                    }`}
                  >
                    Access Keys ({keys.length})
                  </button>
                )}
              </div>

              {/* Videos tab */}
              {tab === "videos" && (
                <div className="space-y-4">
                  {assignedVideos.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-text-muted mb-2">In this section</h3>
                      <div className="space-y-1">
                        {assignedVideos.map((v) => (
                          <div key={v.id} className="flex items-center justify-between glass rounded px-3 py-2">
                            <span className="text-sm text-text-primary truncate">{v.title || "Untitled"}</span>
                            <button
                              onClick={() => removeVideo(v.id)}
                              className="text-xs text-red-400 hover:text-red-300 shrink-0 ml-2"
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {unsortedVideos.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-text-muted mb-2">Unsorted videos</h3>
                      <div className="space-y-1">
                        {unsortedVideos.map((v) => (
                          <div key={v.id} className="flex items-center justify-between glass rounded px-3 py-2">
                            <span className="text-sm text-text-primary truncate">{v.title || "Untitled"}</span>
                            <button
                              onClick={() => assignVideo(v.id)}
                              className="text-xs text-accent hover:text-accent-hover shrink-0 ml-2"
                            >
                              Add
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {assignedVideos.length === 0 && unsortedVideos.length === 0 && (
                    <p className="text-text-muted text-sm py-4">No videos available.</p>
                  )}
                </div>
              )}

              {/* Keys tab */}
              {tab === "keys" && visibility === "PRIVATE" && (
                <KeyTable sectionId={sectionId} keys={keys} onRefresh={load} />
              )}

              {/* Danger zone */}
              <div className="mt-8 pt-4 border-t border-glass-border">
                <Button variant="ghost" size="sm" onClick={handleDelete}>
                  <span className="text-red-400">Delete Section</span>
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
