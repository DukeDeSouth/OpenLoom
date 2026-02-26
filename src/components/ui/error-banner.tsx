"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, type ErrorCode } from "@/lib/fetch-json";
import { Button } from "./button";

interface ErrorBannerProps {
  error: Error | ApiError | string;
  onRetry?: () => void;
  className?: string;
}

function getCodeFromError(error: Error | ApiError | string): ErrorCode {
  if (typeof error === "string") return "UNKNOWN";
  if (error instanceof ApiError) return error.code;
  if (error.message.includes("Database")) return "DB_UNREACHABLE";
  return "UNKNOWN";
}

function getMessageFromError(error: Error | ApiError | string): string {
  if (typeof error === "string") return error;
  return error.message;
}

function getHintFromError(error: Error | ApiError | string): string | undefined {
  if (error instanceof ApiError) return error.hint;
  return undefined;
}

function CopyCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex items-center gap-2 bg-black/40 rounded-sm px-3 py-2 font-mono text-xs">
      <code className="flex-1 text-green-400 select-all">{command}</code>
      <button
        onClick={handleCopy}
        className="shrink-0 px-2 py-1 rounded bg-surface-light hover:bg-gray-600 text-text-secondary text-xs transition-colors"
      >
        {copied ? "Copied!" : "Copy"}
      </button>
    </div>
  );
}

function DbErrorContent() {
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        <svg className="w-6 h-6 shrink-0 text-error mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
        </svg>
        <div>
          <p className="font-semibold text-text-primary">Database is not available</p>
          <p className="text-text-muted text-sm mt-1">
            PostgreSQL needs to be running for OpenLoom to work. Start it with Docker:
          </p>
        </div>
      </div>

      <CopyCommand command="docker compose up -d" />

      <p className="text-text-faint text-xs">
        Run this command inside your OpenLoom project folder.
        If Docker is not installed, see{" "}
        <a
          href="https://docs.docker.com/get-docker/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent hover:underline"
        >
          docker.com/get-docker
        </a>
      </p>
    </div>
  );
}

function AuthErrorContent() {
  const router = useRouter();

  return (
    <div className="flex items-start gap-3">
      <svg className="w-6 h-6 shrink-0 text-warning mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
      </svg>
      <div>
        <p className="font-semibold text-text-primary">Session expired</p>
        <p className="text-text-muted text-sm mt-1">
          Your session has ended. Sign in again to continue.
        </p>
        <Button
          variant="accent"
          size="sm"
          className="mt-3"
          onClick={() => router.push("/login")}
        >
          Sign in
        </Button>
      </div>
    </div>
  );
}

function NetworkErrorContent({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="flex items-start gap-3">
      <svg className="w-6 h-6 shrink-0 text-warning mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
      </svg>
      <div>
        <p className="font-semibold text-text-primary">Connection lost</p>
        <p className="text-text-muted text-sm mt-1">
          Could not reach the server. Check that OpenLoom is running and try again.
        </p>
        {onRetry && (
          <Button variant="secondary" size="sm" className="mt-3" onClick={onRetry}>
            Retry
          </Button>
        )}
      </div>
    </div>
  );
}

function GenericErrorContent({
  message,
  hint,
  onRetry,
}: {
  message: string;
  hint?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex items-start gap-3">
      <svg className="w-6 h-6 shrink-0 text-error mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
      </svg>
      <div>
        <p className="font-semibold text-text-primary">{message}</p>
        {hint && <p className="text-text-muted text-sm mt-1">{hint}</p>}
        {onRetry && (
          <Button variant="secondary" size="sm" className="mt-3" onClick={onRetry}>
            Try again
          </Button>
        )}
      </div>
    </div>
  );
}

export function ErrorBanner({ error, onRetry, className = "" }: ErrorBannerProps) {
  const code = getCodeFromError(error);
  const message = getMessageFromError(error);
  const hint = getHintFromError(error);

  return (
    <div
      className={`border rounded-md p-4 backdrop-blur-sm ${
        code === "DB_UNREACHABLE"
          ? "bg-red-500/10 border-red-500/20"
          : code === "UNAUTHORIZED"
            ? "bg-yellow-500/10 border-yellow-500/20"
            : code === "NETWORK"
              ? "bg-yellow-500/10 border-yellow-500/20"
              : "bg-red-500/10 border-red-500/20"
      } ${className}`}
    >
      {code === "DB_UNREACHABLE" && <DbErrorContent />}
      {code === "UNAUTHORIZED" && <AuthErrorContent />}
      {code === "NETWORK" && <NetworkErrorContent onRetry={onRetry} />}
      {!["DB_UNREACHABLE", "UNAUTHORIZED", "NETWORK"].includes(code) && (
        <GenericErrorContent message={message} hint={hint} onRetry={onRetry} />
      )}
    </div>
  );
}
