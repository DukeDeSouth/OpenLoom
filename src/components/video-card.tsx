"use client";

import Link from "next/link";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { EditableTitle } from "@/components/ui/editable-title";
import { fetchJSON } from "@/lib/fetch-json";
import { formatDuration } from "@/lib/format";

interface VideoCardProps {
  id: string;
  title: string | null;
  status: string;
  duration: number | null;
  thumbUrl?: string | null;
  thumbKey?: string | null;
  views: number;
  createdAt: string;
  processingMinutes?: number;
  onDelete: (id: string) => void;
  onRetry?: (id: string) => void;
  onTitleSave?: (id: string, newTitle: string) => Promise<void>;
}

function CopyCmd({ cmd }: { cmd: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-1.5 bg-black/50 rounded px-2 py-1 font-mono text-[10px] mt-1.5">
      <code className="flex-1 text-green-400 select-all">{cmd}</code>
      <button
        onClick={() => {
          navigator.clipboard.writeText(cmd);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
        className="shrink-0 px-1.5 py-0.5 rounded bg-surface-light hover:bg-gray-600 text-text-secondary text-[10px] transition-colors"
      >
        {copied ? "OK!" : "Copy"}
      </button>
    </div>
  );
}

function StuckHelp() {
  return (
    <div className="mt-2 p-2.5 rounded bg-orange-500/5 border border-orange-500/15 space-y-1.5">
      <p className="text-[11px] text-text-muted">
        The video worker is not processing this recording.
        Open a <strong className="text-text-secondary">new terminal</strong> and run:
      </p>
      <CopyCmd cmd="cd OpenLoom && npm run worker:dev" />
      <p className="text-[10px] text-text-faint">
        Run this from the folder where you cloned the project.
        Keep this terminal open — the worker must stay running while you use OpenLoom.
        Then click <strong>Retry</strong> below.
      </p>
    </div>
  );
}

function FailedHelp() {
  return (
    <div className="mt-2 p-2.5 rounded bg-red-500/5 border border-red-500/15 space-y-1.5">
      <p className="text-[11px] text-text-muted">
        Processing crashed. Common causes:
      </p>
      <ul className="text-[10px] text-text-faint list-disc ml-3 space-y-0.5">
        <li>Worker ran out of memory or disk space</li>
        <li>Corrupted recording file</li>
      </ul>
      <p className="text-[10px] text-text-faint">
        Then click <strong>Retry</strong>. For more details run <code className="text-text-muted">docker compose logs</code> inside your OpenLoom folder.
      </p>
    </div>
  );
}

const STATUS_STYLES: Record<string, { label: string; color: string }> = {
  UPLOADING: { label: "Uploading", color: "bg-yellow-500/20 text-yellow-400" },
  PROCESSING: { label: "Processing", color: "bg-blue-500/20 text-blue-400" },
  READY: { label: "Ready", color: "bg-green-500/20 text-green-400" },
  FAILED: { label: "Failed", color: "bg-red-500/20 text-red-400" },
};

export function VideoCard({
  id,
  title,
  status,
  duration,
  thumbUrl: thumbUrlProp,
  views,
  createdAt,
  processingMinutes,
  onDelete,
  onRetry,
  onTitleSave,
}: VideoCardProps) {
  const [confirming, setConfirming] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const s = STATUS_STYLES[status] || STATUS_STYLES.PROCESSING;
  const isReady = status === "READY";
  const isFailed = status === "FAILED";
  const isProcessing = status === "PROCESSING" || status === "UPLOADING";
  const isStuck = isProcessing && processingMinutes != null && processingMinutes >= 5;
  const canRetry = isFailed || isStuck;

  const thumbUrl = thumbUrlProp || null;

  async function handleRetry() {
    setRetrying(true);
    try {
      await fetchJSON(`/api/videos/${id}/retry`, { method: "POST" });
      onRetry?.(id);
    } catch (err) {
      console.error("[retry]", err);
    } finally {
      setRetrying(false);
    }
  }

  const badgeLabel = isStuck ? "May be stuck" : isFailed ? "Failed" : s.label;
  const badgeColor = isStuck
    ? "bg-orange-500/20 text-orange-400"
    : isFailed
      ? "bg-red-500/20 text-red-400"
      : s.color;

  const thumbnailContent = (
    <div className="aspect-video bg-black/30 relative">
      {thumbUrl ? (
        <img
          src={thumbUrl}
          alt={title || "Video thumbnail"}
          className="w-full h-full object-cover"
        />
      ) : isProcessing ? (
        <div className="flex flex-col items-center justify-center h-full">
          <svg
            className="w-8 h-8 text-blue-400 animate-spin"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          <span className="text-xs text-gray-500 mt-2">
            {isStuck ? "Stuck — try retrying" : `${s.label}...`}
          </span>
        </div>
      ) : isFailed ? (
        <div className="flex flex-col items-center justify-center h-full">
          <svg className="w-10 h-10 text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
          <span className="text-xs text-red-400 mt-2">Processing failed</span>
        </div>
      ) : (
        <div className="flex items-center justify-center h-full text-gray-600">
          <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
      )}
      <span
        className={`absolute top-2 right-2 text-xs font-medium px-2 py-0.5 rounded-full ${badgeColor}`}
      >
        {badgeLabel}
      </span>
      {isReady && duration != null && (
        <span className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded font-mono">
          {formatDuration(duration)}
        </span>
      )}
    </div>
  );

  return (
    <Card className="group">
      {isReady ? (
        <Link href={`/watch/${id}`}>{thumbnailContent}</Link>
      ) : (
        <div className="cursor-default">{thumbnailContent}</div>
      )}

      <div className="p-3">
        <EditableTitle
          value={title || "Untitled"}
          onSave={async (t) => onTitleSave?.(id, t)}
          editable={!!onTitleSave}
          size="sm"
        />

        {isStuck && (
          <div className="mt-1">
            <button
              onClick={() => setShowHelp(!showHelp)}
              className="text-xs text-orange-400 hover:text-orange-300 flex items-center gap-1"
            >
              <span>Stuck for {processingMinutes} min</span>
              <svg className={`w-3 h-3 transition-transform ${showHelp ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
              </svg>
            </button>
            {showHelp && <StuckHelp />}
          </div>
        )}
        {isFailed && (
          <div className="mt-1">
            <button
              onClick={() => setShowHelp(!showHelp)}
              className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1"
            >
              <span>Processing failed</span>
              <svg className={`w-3 h-3 transition-transform ${showHelp ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
              </svg>
            </button>
            {showHelp && <FailedHelp />}
          </div>
        )}
        {isProcessing && !isStuck && processingMinutes != null && processingMinutes > 0 && (
          <p className="text-xs text-gray-500 mt-1">
            Processing for {processingMinutes} min...
          </p>
        )}

        <div className="flex items-center justify-between mt-1.5">
          <span className="text-xs text-gray-500">
            {views} views &middot;{" "}
            {new Date(createdAt).toLocaleDateString()}
          </span>

          <div className="flex gap-1">
            {canRetry && (
              <button
                onClick={handleRetry}
                disabled={retrying}
                className="text-xs text-accent hover:text-accent-hover px-2 py-0.5 disabled:opacity-50"
              >
                {retrying ? "Retrying..." : "Retry"}
              </button>
            )}

            {confirming ? (
              <>
                <button
                  onClick={() => {
                    onDelete(id);
                    setConfirming(false);
                  }}
                  className="text-xs text-red-400 hover:text-red-300 px-2 py-0.5"
                >
                  Confirm
                </button>
                <button
                  onClick={() => setConfirming(false)}
                  className="text-xs text-gray-400 hover:text-white px-2 py-0.5"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                onClick={() => setConfirming(true)}
                className="text-xs text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                Delete
              </button>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
