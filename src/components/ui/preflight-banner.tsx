"use client";

import { useState } from "react";

export interface ServiceHealth {
  status: "up" | "down";
  error?: string;
}

export interface PreflightResult {
  ok: boolean;
  services: {
    db: ServiceHealth;
    s3: ServiceHealth;
    redis: ServiceHealth;
    worker: ServiceHealth;
    ffmpeg?: ServiceHealth;
  };
}

const SERVICE_META: Record<
  string,
  { label: string; description: string; icon: React.ReactNode }
> = {
  db: {
    label: "PostgreSQL",
    description: "Stores your videos, accounts, and metadata",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
      </svg>
    ),
  },
  s3: {
    label: "S3 Storage",
    description: "Stores your video files and thumbnails",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
      </svg>
    ),
  },
  redis: {
    label: "Redis",
    description: "Job queue for video processing",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
      </svg>
    ),
  },
  worker: {
    label: "Worker",
    description: "Processes your recordings into playable videos",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12a7.5 7.5 0 0015 0m-15 0a7.5 7.5 0 1115 0m-15 0H3m16.5 0H21m-1.5 0H12m-8.457 3.077l1.41-.513m14.095-5.13l1.41-.513M5.106 17.785l1.15-.964m11.49-9.642l1.149-.964M7.501 19.795l.75-1.3m7.5-12.99l.75-1.3m-6.063 16.658l.26-1.477m2.605-14.772l.26-1.477m0 17.726l-.26-1.477M10.698 4.614l-.26-1.477M16.5 19.794l-.75-1.299M7.5 4.205L12 12m6.894 5.785l-1.149-.964M6.256 7.178l-1.15-.964m15.352 8.864l-1.41-.513M4.954 9.435l-1.41-.514M12.002 12l-3.75 6.495" />
      </svg>
    ),
  },
  ffmpeg: {
    label: "FFmpeg",
    description: "Converts and composes your video recordings",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
      </svg>
    ),
  },
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="shrink-0 px-2 py-1 rounded bg-surface-light hover:bg-gray-600 text-text-secondary text-xs transition-colors"
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

function ServiceRow({
  name,
  health,
}: {
  name: string;
  health: ServiceHealth;
}) {
  const meta = SERVICE_META[name];
  if (!meta) return null;

  const isUp = health.status === "up";

  return (
    <div className={`flex items-start gap-3 px-4 py-3 rounded-md ${
      isUp ? "bg-green-500/5" : "bg-red-500/8"
    }`}>
      <div className={`mt-0.5 ${isUp ? "text-success" : "text-error"}`}>
        {meta.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`font-medium text-sm ${isUp ? "text-success" : "text-error"}`}>
            {meta.label}
          </span>
          <span className={`text-xs px-1.5 py-0.5 rounded ${
            isUp
              ? "bg-green-500/20 text-success"
              : "bg-error-bg text-error"
          }`}>
            {isUp ? "connected" : "offline"}
          </span>
        </div>
        {!isUp && (
          <p className="text-text-faint text-xs mt-1">{meta.description}</p>
        )}
      </div>
    </div>
  );
}

interface PreflightBannerProps {
  result: PreflightResult;
  checking: boolean;
  nextRetryIn?: number;
  onRetry: () => void;
  className?: string;
}

export function PreflightBanner({
  result,
  checking,
  nextRetryIn,
  onRetry,
  className = "",
}: PreflightBannerProps) {
  if (result.ok) return null;

  return (
    <div className={`border border-red-500/20 rounded-md bg-red-500/5 backdrop-blur-sm p-4 space-y-3 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-error" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
          <h3 className="font-semibold text-text-primary">
            Some services are not available
          </h3>
        </div>
        <button
          onClick={onRetry}
          disabled={checking}
          className="text-xs text-text-muted hover:text-text-primary transition-colors disabled:opacity-50"
        >
          {checking ? (
            <span className="flex items-center gap-1">
              <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Checking...
            </span>
          ) : nextRetryIn != null ? (
            `Retry in ${nextRetryIn}s`
          ) : (
            "Retry now"
          )}
        </button>
      </div>

      <p className="text-text-muted text-sm">
        Recording requires all services to be running.
      </p>

      <div className="space-y-1.5">
        {(["db", "s3", "redis", "worker"] as const).map((name) => (
          <ServiceRow key={name} name={name} health={result.services[name]} />
        ))}
        {result.services.ffmpeg && (
          <ServiceRow name="ffmpeg" health={result.services.ffmpeg} />
        )}
      </div>

      {(result.services.db.status === "down" ||
        result.services.s3.status === "down" ||
        result.services.redis.status === "down") && (
        <div className="space-y-1">
          <p className="text-text-muted text-xs">Start Docker services:</p>
          <div className="flex items-center gap-2 bg-black/40 rounded-sm px-3 py-2 font-mono text-xs">
            <code className="flex-1 text-green-400 select-all">docker compose up -d</code>
            <CopyButton text="docker compose up -d" />
          </div>
        </div>
      )}

      {result.services.worker.status === "down" && (
        <div className="space-y-1">
          <p className="text-text-muted text-xs">Start the worker in a <strong className="text-text-secondary">separate terminal</strong>:</p>
          <div className="flex items-center gap-2 bg-black/40 rounded-sm px-3 py-2 font-mono text-xs">
            <code className="flex-1 text-green-400 select-all">cd OpenLoom && npm run worker:dev</code>
            <CopyButton text="cd OpenLoom && npm run worker:dev" />
          </div>
          <p className="text-text-faint text-xs">
            Run from the folder where you cloned the project. Keep this terminal open.
          </p>
        </div>
      )}

      {result.services.ffmpeg?.status === "down" && (
        <div className="space-y-1">
          <p className="text-text-muted text-xs">Install FFmpeg (required for video processing):</p>
          <div className="flex items-center gap-2 bg-black/40 rounded-sm px-3 py-2 font-mono text-xs">
            <code className="flex-1 text-green-400 select-all">brew install ffmpeg</code>
            <CopyButton text="brew install ffmpeg" />
          </div>
        </div>
      )}

      <p className="text-text-faint text-xs">
        Not sure what&apos;s wrong?{" "}
        <code className="text-text-muted">docker compose logs</code> will show service errors.
      </p>
    </div>
  );
}
