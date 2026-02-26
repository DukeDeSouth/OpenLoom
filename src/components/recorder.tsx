"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ErrorBanner } from "@/components/ui/error-banner";
import { PreflightBanner, type PreflightResult } from "@/components/ui/preflight-banner";
import { fetchJSON, ApiError } from "@/lib/fetch-json";

type RecorderState = "idle" | "preview" | "recording" | "uploading" | "done";

const MAX_DURATION = 30 * 60; // 30 min

function getSupportedMimeType(hasAudio: boolean): string {
  const withAudio = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  const videoOnly = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  const types = hasAudio ? withAudio : videoOnly;
  return types.find((t) => MediaRecorder.isTypeSupported(t)) || "video/webm";
}

function createRecorder(
  stream: MediaStream,
  mimeType: string,
  videoBitsPerSecond: number,
): MediaRecorder {
  try {
    return new MediaRecorder(stream, { mimeType, videoBitsPerSecond });
  } catch {
    try {
      return new MediaRecorder(stream, { mimeType: "video/webm", videoBitsPerSecond });
    } catch {
      return new MediaRecorder(stream);
    }
  }
}

function formatTime(secs: number): string {
  const m = Math.floor(secs / 60)
    .toString()
    .padStart(2, "0");
  const s = (secs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export function Recorder({
  onComplete,
}: {
  onComplete: (videoId: string) => void;
}) {
  const [state, setState] = useState<RecorderState>("idle");
  const [timer, setTimer] = useState(0);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<Error | null>(null);
  const [preflight, setPreflight] = useState<PreflightResult | null>(null);
  const [preflightChecking, setPreflightChecking] = useState(true);
  const [preflightCountdown, setPreflightCountdown] = useState(0);
  const [hasCamera, setHasCamera] = useState(false);
  const [hasMic, setHasMic] = useState(false);
  const [micLabel, setMicLabel] = useState<string>("");
  const [micStatus, setMicStatus] = useState<string>("");
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedMicId, setSelectedMicId] = useState<string>("");

  const screenStreamRef = useRef<MediaStream | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const recordedMimeRef = useRef<string>("video/webm");
  const screenRecorderRef = useRef<MediaRecorder | null>(null);
  const cameraRecorderRef = useRef<MediaRecorder | null>(null);
  const micRecorderRef = useRef<MediaRecorder | null>(null);
  const screenChunksRef = useRef<Blob[]>([]);
  const cameraChunksRef = useRef<Blob[]>([]);
  const micChunksRef = useRef<Blob[]>([]);
  const micChunkCountRef = useRef(0);
  const micBytesRef = useRef(0);
  const micMonitorRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cameraVideoRef = useRef<HTMLVideoElement>(null);
  const screenVideoRef = useRef<HTMLVideoElement>(null);
  const recScreenVideoRef = useRef<HTMLVideoElement>(null);
  const recCameraVideoRef = useRef<HTMLVideoElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cleanup = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    cameraStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;
    cameraStreamRef.current = null;
    micStreamRef.current = null;
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const runPreflight = useCallback(async () => {
    setPreflightChecking(true);
    try {
      const res = await fetch("/api/health");
      const data: PreflightResult = await res.json();
      setPreflight(data);
    } catch {
      setPreflight({
        ok: false,
        services: {
          db: { status: "down", error: "Could not reach server" },
          s3: { status: "down", error: "Could not reach server" },
          redis: { status: "down", error: "Could not reach server" },
          worker: { status: "down", error: "Could not reach server" },
        },
      });
    } finally {
      setPreflightChecking(false);
    }
  }, []);

  useEffect(() => {
    runPreflight();
  }, [runPreflight]);

  useEffect(() => {
    if (!preflight || preflight.ok || state !== "idle") return;
    setPreflightCountdown(5);
    const interval = setInterval(() => {
      setPreflightCountdown((c) => {
        if (c <= 1) {
          runPreflight();
          return 5;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [preflight, state, runPreflight]);

  useEffect(() => {
    if (state === "recording") {
      document.title = `● REC ${formatTime(timer)} — OpenLoom`;
    } else if (state === "uploading") {
      document.title = "Uploading... — OpenLoom";
    } else {
      document.title = "Record — OpenLoom";
    }
    return () => {
      document.title = "OpenLoom";
    };
  }, [state, timer]);

  useEffect(() => {
    if (!error) return;
    const isSticky = error instanceof ApiError &&
      (error.code === "DB_UNREACHABLE" || error.code === "NETWORK");
    if (isSticky) return;
    const t = setTimeout(() => setError(null), 8000);
    return () => clearTimeout(t);
  }, [error]);

  useEffect(() => {
    if (!navigator.mediaDevices) return;
    const handler = async () => {
      console.log("[mic] device change detected");
      const devices = await navigator.mediaDevices.enumerateDevices();
      const mics = devices.filter(d => d.kind === "audioinput");
      setAudioDevices(mics);
      if (micStreamRef.current) {
        const track = micStreamRef.current.getAudioTracks()[0];
        if (track && track.readyState === "ended") {
          console.warn("[mic] current track ended after device change");
          setMicStatus("ended");
        }
      }
    };
    navigator.mediaDevices.addEventListener("devicechange", handler);
    return () => navigator.mediaDevices.removeEventListener("devicechange", handler);
  }, []);

  useEffect(() => {
    if (state === "preview" && cameraVideoRef.current && cameraStreamRef.current) {
      cameraVideoRef.current.srcObject = cameraStreamRef.current;
    }
    if (state === "recording") {
      if (recScreenVideoRef.current && screenStreamRef.current) {
        recScreenVideoRef.current.srcObject = screenStreamRef.current;
      }
      if (recCameraVideoRef.current && cameraStreamRef.current) {
        recCameraVideoRef.current.srcObject = cameraStreamRef.current;
      }
    }
  }, [state]);

  const startPreview = useCallback(async () => {
    setError(null);

    try {
      const res = await fetch("/api/health");
      const health: PreflightResult = await res.json();
      setPreflight(health);
      if (!health.ok) return;
    } catch {
      setPreflight({
        ok: false,
        services: {
          db: { status: "down", error: "Could not reach server" },
          s3: { status: "down", error: "Could not reach server" },
          redis: { status: "down", error: "Could not reach server" },
          worker: { status: "down", error: "Could not reach server" },
        },
      });
      return;
    }

    try {
      let controller: unknown;
      if ("CaptureController" in window) {
        controller = new (window as any).CaptureController();
        (controller as any).setFocusBehavior("focus-captured-surface");
      }
      const screen = await navigator.mediaDevices.getDisplayMedia({
        video: { width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
        ...(controller ? { controller } : {}),
      } as any);
      screenStreamRef.current = screen;

      try {
        const camera = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 } },
        });
        cameraStreamRef.current = camera;
        setHasCamera(true);
      } catch {
        setHasCamera(false);
      }

      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const mics = devices.filter(d => d.kind === "audioinput");
        setAudioDevices(mics);

        let micDeviceId = selectedMicId;
        if (!micDeviceId) {
          const builtIn = mics.find(d => {
            const l = d.label.toLowerCase();
            return l.includes("built-in") || l.includes("macbook") || l.includes("internal");
          });
          if (builtIn) micDeviceId = builtIn.deviceId;
        }

        const audioConstraints: MediaTrackConstraints = {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          ...(micDeviceId ? { deviceId: { exact: micDeviceId } } : {}),
        };

        const mic = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
        micStreamRef.current = mic;
        setHasMic(true);
        const micTrack = mic.getAudioTracks()[0];
        if (micTrack) {
          const actualDeviceId = micTrack.getSettings().deviceId;
          console.log(`[mic] requested: "${micDeviceId}", got: "${micTrack.label}" (id=${actualDeviceId}), state: ${micTrack.readyState}`);
          if (micDeviceId && actualDeviceId !== micDeviceId) {
            console.warn(`[mic] DEVICE MISMATCH: requested ${micDeviceId}, got ${actualDeviceId}`);
          }
          setMicLabel(micTrack.label);
          setMicStatus("connected");
          micTrack.onended = () => { setMicStatus("ended"); console.warn("[mic] track ended"); };
          micTrack.onmute = () => { setMicStatus("muted"); console.warn("[mic] track muted"); };
          micTrack.onunmute = () => setMicStatus("connected");
        }
      } catch (e) {
        setHasMic(false);
        setMicLabel("");
        setMicStatus("failed");
        console.error("[mic] acquisition failed:", e);
      }

      screen.getVideoTracks()[0].onended = () => {
        if (screenRecorderRef.current?.state === "recording") {
          stopRecording();
        } else {
          cleanup();
          setState("idle");
        }
      };

      setState("preview");
    } catch {
      setError(new Error("Screen access denied. Please allow screen sharing."));
    }
  }, [cleanup, selectedMicId]);

  const startRecording = useCallback(() => {
    setError(null);
    screenChunksRef.current = [];
    cameraChunksRef.current = [];
    micChunksRef.current = [];

    const screenStream = screenStreamRef.current!;

    // Screen recorder: video + system audio (if any), NO mic mixing
    const screenCombined = new MediaStream([
      ...screenStream.getVideoTracks(),
      ...screenStream.getAudioTracks(),
    ]);
    const hasScreenAudio = screenStream.getAudioTracks().length > 0;
    const mimeType = getSupportedMimeType(hasScreenAudio);
    recordedMimeRef.current = mimeType;

    const screenRec = createRecorder(screenCombined, mimeType, 3_000_000);
    screenRec.ondataavailable = (e) => {
      if (e.data.size > 0) screenChunksRef.current.push(e.data);
    };
    screenRecorderRef.current = screenRec;

    // Camera recorder: video only
    if (cameraStreamRef.current) {
      const cameraStream = new MediaStream(
        cameraStreamRef.current.getVideoTracks(),
      );
      const cameraMime = getSupportedMimeType(false);
      const cameraRec = createRecorder(cameraStream, cameraMime, 1_000_000);
      cameraRec.ondataavailable = (e) => {
        if (e.data.size > 0) cameraChunksRef.current.push(e.data);
      };
      cameraRecorderRef.current = cameraRec;
      cameraRec.start(3000);
    }

    micChunkCountRef.current = 0;
    micBytesRef.current = 0;

    if (micStreamRef.current && micStreamRef.current.getAudioTracks().length > 0) {
      const micTrack = micStreamRef.current.getAudioTracks()[0];

      if (micTrack.readyState !== "live") {
        console.error(`[mic] track dead before recording: ${micTrack.readyState}`);
        setMicStatus("ended");
      } else {
        console.log(`[mic] recording with: "${micTrack.label}", muted=${micTrack.muted}`);
        const micStream = new MediaStream([micTrack]);
        const micMime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm";
        try {
          const micRec = new MediaRecorder(micStream, { mimeType: micMime });
          micRec.ondataavailable = (e) => {
            if (e.data.size > 0) {
              micChunksRef.current.push(e.data);
              micChunkCountRef.current++;
              micBytesRef.current += e.data.size;
            }
          };
          micRec.onerror = (ev) => {
            console.error("[mic] MediaRecorder error:", ev);
            setMicStatus("error");
          };
          micRecorderRef.current = micRec;
          micRec.start(3000);
          console.log("[mic] recorder started");

          const savedDeviceId = micTrack.getSettings().deviceId;
          micMonitorRef.current = setInterval(() => {
            const t = micStreamRef.current?.getAudioTracks()[0];
            if (!t) { console.warn("[mic-mon] track GONE"); return; }
            const curId = t.getSettings().deviceId;
            const bytesNow = micBytesRef.current;
            console.log(`[mic-mon] ${t.readyState} muted=${t.muted} dev=${curId?.slice(0,8)} bytes=${bytesNow}${curId !== savedDeviceId ? " ⚠ DEVICE CHANGED!" : ""}`);
          }, 2000);
        } catch (err) {
          console.error("[mic] recorder creation failed:", err);
          setMicStatus("error");
        }
      }
    } else {
      console.warn("[mic] no mic stream at recording start");
    }

    screenRec.start(3000);
    setTimer(0);
    timerRef.current = setInterval(() => {
      setTimer((t) => {
        if (t + 1 >= MAX_DURATION) {
          stopRecording();
          return t;
        }
        return t + 1;
      });
    }, 1000);
    setState("recording");
  }, []);

  const stopRecording = useCallback(async () => {
    setError(null);
    if (timerRef.current) clearInterval(timerRef.current);

    const waitStop = (rec: MediaRecorder) =>
      new Promise<void>((resolve) => {
        rec.onstop = () => resolve();
        if (rec.state === "recording") rec.stop();
        else resolve();
      });

    await Promise.all([
      screenRecorderRef.current && waitStop(screenRecorderRef.current),
      cameraRecorderRef.current && waitStop(cameraRecorderRef.current),
      micRecorderRef.current && waitStop(micRecorderRef.current),
    ]);

    if (micMonitorRef.current) { clearInterval(micMonitorRef.current); micMonitorRef.current = null; }
    console.log(`[mic] stop: ${micChunkCountRef.current} chunks, ${micBytesRef.current} bytes`);

    cleanup();
    setState("uploading");
    await uploadBlobs();
  }, [cleanup]);

  const uploadBlobs = async () => {
    try {
      const mimeType = recordedMimeRef.current;
      const screenBlob = new Blob(screenChunksRef.current, { type: mimeType });
      const cameraBlob =
        cameraChunksRef.current.length > 0
          ? new Blob(cameraChunksRef.current, { type: mimeType })
          : null;
      const micBlob =
        micChunksRef.current.length > 0
          ? new Blob(micChunksRef.current, { type: "audio/webm" })
          : null;

      console.log(`[upload] screen: ${screenBlob.size}b, camera: ${cameraBlob?.size ?? 0}b, mic: ${micBlob?.size ?? 0}b (${micChunksRef.current.length} chunks)`);

      const { id: videoId } = await fetchJSON<{ id: string }>("/api/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `Recording ${new Date().toLocaleString()}`,
        }),
      });

      const getPresigned = (fileType: string) =>
        fetchJSON<{ url: string; key: string }>("/api/upload/presign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ videoId, fileType }),
        });

      const uploadWithXHR = (
        url: string,
        blob: Blob,
        weight: number,
        offset: number,
      ) =>
        new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              setUploadProgress(offset + (e.loaded / e.total) * weight);
            }
          };
          xhr.onload = () =>
            xhr.status < 400
              ? resolve()
              : reject(new Error(`Upload failed: ${xhr.status}`));
          xhr.onerror = () => reject(new Error("Upload network error"));
          xhr.open("PUT", url);
          xhr.setRequestHeader("Content-Type", blob.type);
          xhr.send(blob);
        });

      const totalParts = 1 + (cameraBlob ? 1 : 0) + (micBlob ? 1 : 0);
      const partWeight = 1 / totalParts;
      let uploadOffset = 0;

      const screenPresign = await getPresigned("screen");
      await uploadWithXHR(screenPresign.url, screenBlob, partWeight, uploadOffset);
      uploadOffset += partWeight;

      if (cameraBlob) {
        const cameraPresign = await getPresigned("camera");
        await uploadWithXHR(cameraPresign.url, cameraBlob, partWeight, uploadOffset);
        uploadOffset += partWeight;
      }

      if (micBlob) {
        const micPresign = await getPresigned("mic");
        await uploadWithXHR(micPresign.url, micBlob, partWeight, uploadOffset);
      }

      await fetchJSON(`/api/videos/${videoId}/complete`, { method: "POST" });
      setState("done");
      onComplete(videoId);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Upload failed"));
      setState("idle");
    }
  };

  if (typeof window !== "undefined" && !navigator.mediaDevices?.getDisplayMedia) {
    return (
      <div className="text-center py-20">
        <p className="text-red-400 text-lg">
          Screen recording requires a secure connection
        </p>
        <p className="text-gray-400 mt-2">
          Access this site via HTTPS to enable recording.
          Make sure your domain is configured with SSL.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6">
      {error && (
        <ErrorBanner error={error} onRetry={() => setError(null)} className="w-full max-w-lg" />
      )}

      {state === "idle" && (
        <div className="flex flex-col items-center gap-4 w-full max-w-lg">
          {preflight && !preflight.ok && (
            <PreflightBanner
              result={preflight}
              checking={preflightChecking}
              nextRetryIn={preflightCountdown > 0 ? preflightCountdown : undefined}
              onRetry={runPreflight}
            />
          )}

          {preflightChecking && !preflight && (
            <div className="flex items-center gap-2 text-text-muted text-sm">
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Checking services...
            </div>
          )}

          <Button
            variant="primary"
            size="lg"
            onClick={startPreview}
            disabled={!preflight?.ok}
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" />
            </svg>
            Start Recording
          </Button>
        </div>
      )}

      {state === "preview" && (
        <div className="flex flex-col items-center gap-4">
          <div className="flex flex-col items-center gap-2">
            <p className="text-gray-300">
              Ready to record. Click below to begin.
            </p>
            <div className="flex flex-col items-center gap-2">
            <div className={`flex items-center gap-2 text-sm ${hasMic ? "text-green-400" : "text-yellow-400"}`}>
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                {hasMic ? (
                  <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5-3c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                ) : (
                  <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z" />
                )}
              </svg>
              {hasMic ? micLabel || "Microphone connected" : "No microphone — recording will have no audio"}
            </div>
              <select
                value={selectedMicId}
                onChange={(e) => {
                  setSelectedMicId(e.target.value);
                  if (micStreamRef.current) {
                    micStreamRef.current.getTracks().forEach(t => t.stop());
                    micStreamRef.current = null;
                  }
                  const constraints: MediaTrackConstraints = {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false,
                    ...(e.target.value ? { deviceId: { exact: e.target.value } } : {}),
                  };
                  navigator.mediaDevices.getUserMedia({ audio: constraints }).then(mic => {
                    micStreamRef.current = mic;
                    setHasMic(true);
                    const t = mic.getAudioTracks()[0];
                    if (t) {
                      setMicLabel(t.label);
                      setMicStatus("connected");
                      console.log(`[mic] switched to: "${t.label}", id=${t.getSettings().deviceId}`);
                      t.onended = () => { setMicStatus("ended"); console.warn("[mic] track ended after switch"); };
                      t.onmute = () => { setMicStatus("muted"); console.warn("[mic] track muted after switch"); };
                      t.onunmute = () => setMicStatus("connected");
                    }
                  }).catch((err) => {
                    setHasMic(false);
                    setMicLabel("");
                    setMicStatus("failed");
                    console.error("[mic] switch failed:", err);
                  });
                }}
                className="bg-gray-800 text-gray-300 text-xs rounded px-2 py-1 border border-gray-700 min-w-48"
              >
                <option value="">Auto (prefer built-in)</option>
                {audioDevices.map(d => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `Mic ${d.deviceId.slice(0, 8)}`}
                  </option>
                ))}
              </select>
          </div>
          </div>
          {hasCamera && (
            <video
              autoPlay
              muted
              playsInline
              className="w-40 h-28 rounded-md object-cover border-2 border-border-input"
              ref={cameraVideoRef}
            />
          )}
          <div className="flex gap-3">
            <Button variant="primary" size="md" onClick={startRecording}>
              Record
            </Button>
            <Button
              variant="secondary"
              size="md"
              onClick={() => {
                cleanup();
                setState("idle");
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {state === "recording" && (
        <div className="fixed inset-0 z-50 bg-gray-950 flex flex-col">
          <div className="flex-1 relative min-h-0">
            <video
              autoPlay
              muted
              playsInline
              className="w-full h-full object-contain bg-black"
              ref={recScreenVideoRef}
            />
            {hasCamera && cameraStreamRef.current && (
              <video
                autoPlay
                muted
                playsInline
                className="absolute bottom-4 right-4 w-40 rounded-lg border-2 border-gray-600 shadow-lg object-cover"
                ref={recCameraVideoRef}
              />
            )}
          </div>
          <div className="flex items-center justify-center gap-6 py-3 bg-gray-950/90 border-t border-gray-800">
            <div className="flex items-center gap-3">
              <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
              <span className="text-2xl font-mono text-white">
                {formatTime(timer)}
              </span>
            </div>
            <span className={`flex items-center gap-1 text-xs ${hasMic && micStatus === "connected" ? "text-green-400" : "text-yellow-400"}`}>
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                {hasMic && micStatus === "connected" ? (
                  <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5-3c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                ) : (
                  <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z" />
                )}
              </svg>
              {hasMic && micStatus === "connected" ? micLabel : "No mic"}
            </span>
            <Button variant="secondary" size="md" onClick={stopRecording}>
              Stop Recording
            </Button>
          </div>
        </div>
      )}

      {state === "uploading" && (
        <div className="flex flex-col items-center gap-4 w-full max-w-md">
          <p className="text-gray-300">Uploading...</p>
          <p className={`text-xs ${micBytesRef.current > 5000 ? "text-green-400" : "text-yellow-400"}`}>
            Audio: {micChunkCountRef.current} chunks, {Math.round(micBytesRef.current / 1024)} KB
            {micBytesRef.current < 5000 && " — possibly silent!"}
          </p>
          <div className="w-full bg-gray-800 rounded-full h-3 overflow-hidden">
            <div
              className="bg-blue-500 h-full rounded-full transition-all duration-300"
              style={{ width: `${Math.round(uploadProgress * 100)}%` }}
            />
          </div>
          <span className="text-sm text-gray-400">
            {Math.round(uploadProgress * 100)}%
          </span>
        </div>
      )}

      {state === "done" && (
        <div className="text-center">
          <p className="text-green-400 text-lg font-medium">
            Upload complete! Processing your video...
          </p>
          <p className="text-gray-400 text-sm mt-2">
            You&apos;ll be redirected shortly.
          </p>
        </div>
      )}

    </div>
  );
}
