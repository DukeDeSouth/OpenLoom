"use client";

import { useState } from "react";

interface DashboardSectionGroupProps {
  title: string;
  sectionId: string | null;
  visibility?: "PUBLIC" | "PRIVATE";
  videoCount: number;
  defaultOpen?: boolean;
  onGearClick?: () => void;
  children: React.ReactNode;
}

export function DashboardSectionGroup({
  title,
  sectionId,
  visibility,
  videoCount,
  defaultOpen = true,
  onGearClick,
  children,
}: DashboardSectionGroupProps) {
  const [open, setOpen] = useState(defaultOpen);
  const isUnsorted = sectionId === null;

  return (
    <div className="mb-6">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 py-3 px-4 rounded-lg glass hover:bg-glass-hover transition-colors text-left"
      >
        <svg
          className={`w-4 h-4 text-text-faint transition-transform duration-200 ${open ? "rotate-90" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
        </svg>

        <span className={`font-semibold ${isUnsorted ? "text-text-muted" : "text-text-primary"}`}>
          {title}
        </span>

        {visibility && (
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
            visibility === "PRIVATE"
              ? "bg-red-500/20 text-red-400"
              : "bg-green-500/20 text-green-400"
          }`}>
            {visibility === "PRIVATE" ? "Private" : "Public"}
          </span>
        )}

        <span className="text-xs text-text-faint ml-auto mr-2">
          {videoCount} video{videoCount !== 1 ? "s" : ""}
        </span>

        {!isUnsorted && onGearClick && (
          <span
            role="button"
            onClick={(e) => {
              e.stopPropagation();
              onGearClick();
            }}
            className="p-1 rounded hover:bg-white/10 transition-colors text-text-faint hover:text-text-primary"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            </svg>
          </span>
        )}
      </button>

      <div
        className="grid transition-[grid-template-rows] duration-300 ease-in-out"
        style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <div className="pt-4 px-1">
            {videoCount === 0 ? (
              <p className="text-text-faint text-sm py-4 text-center">
                {isUnsorted ? "All videos are organized into sections" : "No videos in this section"}
              </p>
            ) : (
              children
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
