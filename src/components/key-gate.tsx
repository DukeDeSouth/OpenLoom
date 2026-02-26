"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";

interface KeyGateProps {
  sectionId: string;
  sectionTitle: string;
  compact?: boolean;
}

export function KeyGate({ sectionId, sectionTitle, compact }: KeyGateProps) {
  const router = useRouter();
  const [keyInput, setKeyInput] = useState("");
  const [fingerprint, setFingerprint] = useState<string | null>(null);
  const [fpError, setFpError] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const FingerprintJS = (await import("@fingerprintjs/fingerprintjs")).default;
        const fp = await FingerprintJS.load();
        const result = await fp.get();
        setFingerprint(result.visitorId);
      } catch {
        setFpError(true);
        const fallback = btoa(
          `${navigator.userAgent}-${screen.width}x${screen.height}-${Intl.DateTimeFormat().resolvedOptions().timeZone}`,
        ).slice(0, 32);
        setFingerprint(fallback);
      }
    })();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!keyInput.trim()) return;
    if (!fingerprint) {
      setError("Preparing device verification, please wait...");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/access/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: keyInput.trim(), sectionId, fingerprint }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Invalid key");
        return;
      }

      document.cookie = `access_${sectionId}=${data.accessToken}; path=/; max-age=${data.maxAge}; samesite=lax`;
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  if (compact) {
    return (
      <div className="glass rounded-lg p-4">
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="flex items-center gap-2 text-text-muted text-sm shrink-0">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
            </svg>
            <span>Private section</span>
          </div>
          <input
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            placeholder="Enter access key..."
            className="flex-1 bg-white/5 border border-glass-border rounded px-3 py-2 text-sm text-text-primary placeholder-text-faint focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
          <Button variant="accent" size="sm" disabled={loading || !fingerprint}>
            {loading ? "..." : "Unlock"}
          </Button>
        </form>
        {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-[60vh] px-4">
      <Card className="w-full max-w-md p-8">
        <div className="text-center mb-6">
          <svg className="w-12 h-12 text-text-faint mx-auto mb-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
          </svg>
          <h2 className="text-xl font-semibold text-text-primary">{sectionTitle}</h2>
          <p className="text-text-muted text-sm mt-1">Enter your access key to view this content</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <Alert>{error}</Alert>}
          {fpError && (
            <p className="text-xs text-text-faint">Using fallback device verification</p>
          )}

          <Input
            id="access-key"
            label="Access Key"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            placeholder="Paste your access key"
          />

          <Button variant="accent" fullWidth disabled={loading || !fingerprint}>
            {loading ? "Verifying..." : !fingerprint ? "Preparing..." : "Unlock"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
