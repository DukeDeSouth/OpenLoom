"use client";

import { useEffect, useState, useCallback } from "react";
import { Nav } from "@/components/nav";
import { VideoCard } from "@/components/video-card";
import { Card } from "@/components/ui/card";
import { ErrorBanner } from "@/components/ui/error-banner";
import { DashboardSectionGroup } from "@/components/dashboard-section-group";
import { SectionSlideOver } from "@/components/section-slide-over";
import { CreateSectionInline } from "@/components/create-section-inline";
import { fetchJSON } from "@/lib/fetch-json";

interface Section {
  id: string;
  title: string;
  description: string | null;
  visibility: "PUBLIC" | "PRIVATE";
  order: number;
}

interface Video {
  id: string;
  title: string | null;
  status: string;
  duration: number | null;
  thumbKey?: string | null;
  thumbUrl?: string | null;
  views: number;
  sectionId: string | null;
  createdAt: string;
}

export default function DashboardPage() {
  const [sections, setSections] = useState<Section[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      const [secs, vids] = await Promise.all([
        fetchJSON<Section[]>("/api/sections"),
        fetchJSON<Video[]>("/api/videos"),
      ]);
      setSections(secs);
      setVideos(vids);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to load"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 5000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const editId = params.get("edit");
    if (editId) {
      setEditingSectionId(editId);
      window.history.replaceState({}, "", "/dashboard");
    }
  }, []);

  // Group videos by section
  const grouped = new Map<string | null, Video[]>();
  sections.forEach((s) => grouped.set(s.id, []));
  grouped.set(null, []);
  videos.forEach((v) => {
    const key = v.sectionId && grouped.has(v.sectionId) ? v.sectionId : null;
    grouped.get(key)!.push(v);
  });

  async function handleDelete(id: string) {
    try {
      await fetchJSON(`/api/videos/${id}`, { method: "DELETE" });
      setVideos((prev) => prev.filter((v) => v.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to delete video"));
    }
  }

  async function handleTitleSave(id: string, newTitle: string) {
    await fetchJSON(`/api/videos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTitle }),
    });
    setVideos((prev) =>
      prev.map((v) => (v.id === id ? { ...v, title: newTitle } : v)),
    );
  }

  function handleSectionCreated(section: { id: string }) {
    fetchAll();
    setEditingSectionId(section.id);
  }

  function handleSlideOverDeleted() {
    setEditingSectionId(null);
    fetchAll();
  }

  function renderVideoGrid(sectionVideos: Video[]) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {sectionVideos.map((v) => (
          <VideoCard
            key={v.id}
            {...v}
            processingMinutes={
              v.status === "PROCESSING"
                ? Math.floor((Date.now() - new Date(v.createdAt).getTime()) / 60000)
                : undefined
            }
            onDelete={handleDelete}
            onRetry={() => fetchAll()}
            onTitleSave={handleTitleSave}
          />
        ))}
      </div>
    );
  }

  const unsortedVideos = grouped.get(null) || [];

  return (
    <div className="min-h-screen">
      <Nav />

      <main className="max-w-6xl mx-auto p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h1 className="text-2xl font-bold text-text-primary">Your Videos</h1>
          <CreateSectionInline onCreated={handleSectionCreated} />
        </div>

        {error && (
          <ErrorBanner error={error} onRetry={fetchAll} className="mb-4" />
        )}

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="h-24 animate-pulse" />
            ))}
          </div>
        ) : videos.length === 0 && sections.length === 0 ? (
          <div className="text-center py-20">
            <svg className="w-16 h-16 text-gray-700 mx-auto mb-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" />
            </svg>
            <p className="text-text-muted text-lg">No recordings yet</p>
            <p className="text-text-faint text-sm mt-1">
              Click &quot;New Recording&quot; to get started
            </p>
          </div>
        ) : (
          <>
            {/* Section groups */}
            {sections.map((s) => {
              const sectionVideos = grouped.get(s.id) || [];
              return (
                <DashboardSectionGroup
                  key={s.id}
                  title={s.title}
                  sectionId={s.id}
                  visibility={s.visibility}
                  videoCount={sectionVideos.length}
                  defaultOpen={sectionVideos.length > 0}
                  onGearClick={() => setEditingSectionId(s.id)}
                >
                  {renderVideoGrid(sectionVideos)}
                </DashboardSectionGroup>
              );
            })}

            {/* Unsorted group */}
            {(unsortedVideos.length > 0 || sections.length > 0) && (
              <DashboardSectionGroup
                title="Unsorted"
                sectionId={null}
                videoCount={unsortedVideos.length}
                defaultOpen={unsortedVideos.length > 0}
              >
                {renderVideoGrid(unsortedVideos)}
              </DashboardSectionGroup>
            )}
          </>
        )}
      </main>

      {/* Slide-over */}
      {editingSectionId && (
        <SectionSlideOver
          sectionId={editingSectionId}
          onClose={() => setEditingSectionId(null)}
          onRefresh={fetchAll}
          onDeleted={handleSlideOverDeleted}
        />
      )}
    </div>
  );
}
