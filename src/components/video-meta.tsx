"use client";

import { useState } from "react";
import { EditableTitle } from "@/components/ui/editable-title";
import { fetchJSON } from "@/lib/fetch-json";
import { formatDuration } from "@/lib/format";

interface VideoMetaProps {
  videoId: string;
  title: string;
  authorName: string;
  duration: number | null;
  views: number;
  createdAt: string;
  isOwner: boolean;
}

export function VideoMeta({
  videoId,
  title: initialTitle,
  authorName,
  duration,
  views,
  createdAt,
  isOwner,
}: VideoMetaProps) {
  const [title, setTitle] = useState(initialTitle);

  async function handleSave(newTitle: string) {
    await fetchJSON(`/api/videos/${videoId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTitle }),
    });
    setTitle(newTitle);
  }

  return (
    <div className="mt-4">
      <EditableTitle
        value={title}
        onSave={handleSave}
        editable={isOwner}
        size="lg"
      />
      <p className="text-text-muted text-sm mt-1">
        {authorName}
        {duration != null && <> &middot; {formatDuration(duration)}</>}
        {" "}&middot; {views} views &middot;{" "}
        {new Date(createdAt).toLocaleDateString()}
      </p>
    </div>
  );
}
