"use client";

import { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";

interface Segment {
  id: string;
  start: number;
  end: number;
  text: string;
}

export function VideoPlayer({
  src,
  subtitleSrc,
  segments,
}: {
  src: string;
  subtitleSrc?: string;
  segments?: Segment[];
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTimeUpdate = () => setCurrentTime(video.currentTime);
    video.addEventListener("timeupdate", onTimeUpdate);
    return () => video.removeEventListener("timeupdate", onTimeUpdate);
  }, []);

  function seekTo(time: number) {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      videoRef.current.play();
    }
  }

  function copyLink() {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-col lg:flex-row gap-4">
      <div className="flex-1">
        <video
          ref={videoRef}
          src={src}
          controls
          autoPlay
          playsInline
          className="w-full rounded-xl bg-black"
        >
          {subtitleSrc && (
            <track
              kind="subtitles"
              src={subtitleSrc}
              srcLang="auto"
              label="Auto"
              default
            />
          )}
        </video>

        <div className="mt-3 flex justify-end">
          <Button variant="ghost" size="sm" onClick={copyLink}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
            </svg>
            {copied ? "Copied!" : "Copy link"}
          </Button>
        </div>
      </div>

      {segments && segments.length > 0 && (
        <div className="lg:w-80 max-h-[600px] overflow-y-auto glass rounded-md p-4">
          <h3 className="text-sm font-medium text-text-muted uppercase tracking-wider mb-3">
            Transcript
          </h3>
          <div className="space-y-1">
            {segments.map((seg) => {
              const isActive =
                currentTime >= seg.start && currentTime < seg.end;
              return (
                <button
                  key={seg.id}
                  onClick={() => seekTo(seg.start)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                    isActive
                      ? "bg-accent/20 text-accent-hover"
                      : "text-text-muted hover:bg-white/5"
                  }`}
                >
                  <span className="text-xs text-gray-500 font-mono mr-2">
                    {formatTimestamp(seg.start)}
                  </span>
                  {seg.text}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}
