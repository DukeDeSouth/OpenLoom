"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { fetchJSON } from "@/lib/fetch-json";

interface AccessKey {
  id: string;
  token: string;
  type: "PERMANENT" | "SINGLE_USE";
  label: string | null;
  fingerprint: string | null;
  activatedAt: string | null;
  createdAt: string;
}

interface KeyTableProps {
  sectionId: string;
  keys: AccessKey[];
  onRefresh: () => void;
}

export function KeyTable({ sectionId, keys, onRefresh }: KeyTableProps) {
  const [generating, setGenerating] = useState(false);
  const [genType, setGenType] = useState<"PERMANENT" | "SINGLE_USE">("SINGLE_USE");
  const [bulkCount, setBulkCount] = useState(5);
  const [copied, setCopied] = useState<string | null>(null);

  async function handleGenerate() {
    setGenerating(true);
    try {
      await fetchJSON(`/api/sections/${sectionId}/keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: genType }),
      });
      onRefresh();
    } finally {
      setGenerating(false);
    }
  }

  async function handleBulkGenerate() {
    setGenerating(true);
    try {
      await fetchJSON(`/api/sections/${sectionId}/keys/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: genType, count: bulkCount }),
      });
      onRefresh();
    } finally {
      setGenerating(false);
    }
  }

  async function handleDelete(keyId: string) {
    await fetchJSON(`/api/keys/${keyId}`, { method: "DELETE" });
    onRefresh();
  }

  function copyToken(token: string) {
    navigator.clipboard.writeText(token);
    setCopied(token);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={genType}
          onChange={(e) => setGenType(e.target.value as "PERMANENT" | "SINGLE_USE")}
          className="bg-white/5 border border-glass-border rounded px-3 py-2 text-sm text-text-primary"
        >
          <option value="SINGLE_USE">Single Use</option>
          <option value="PERMANENT">Permanent</option>
        </select>

        <Button variant="accent" size="sm" onClick={handleGenerate} disabled={generating}>
          Generate 1
        </Button>

        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            max={100}
            value={bulkCount}
            onChange={(e) => setBulkCount(Math.min(100, Math.max(1, parseInt(e.target.value) || 1)))}
            className="w-16 bg-white/5 border border-glass-border rounded px-2 py-2 text-sm text-text-primary text-center"
          />
          <Button variant="secondary" size="sm" onClick={handleBulkGenerate} disabled={generating}>
            Bulk Generate
          </Button>
        </div>
      </div>

      {keys.length === 0 ? (
        <p className="text-text-muted text-sm py-4">No keys generated yet</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-text-faint border-b border-glass-border">
                <th className="pb-2 pr-3">Token</th>
                <th className="pb-2 pr-3">Type</th>
                <th className="pb-2 pr-3">Label</th>
                <th className="pb-2 pr-3">Status</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => (
                <tr key={k.id} className="border-b border-glass-border/50">
                  <td className="py-2 pr-3">
                    <div className="flex items-center gap-1.5">
                      <code className="text-xs text-text-muted font-mono">
                        {k.token.slice(0, 8)}...{k.token.slice(-4)}
                      </code>
                      <button
                        onClick={() => copyToken(k.token)}
                        className="text-xs text-accent hover:text-accent-hover"
                      >
                        {copied === k.token ? "Copied!" : "Copy"}
                      </button>
                    </div>
                  </td>
                  <td className="py-2 pr-3">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      k.type === "PERMANENT"
                        ? "bg-blue-500/20 text-blue-400"
                        : "bg-purple-500/20 text-purple-400"
                    }`}>
                      {k.type === "PERMANENT" ? "Perm" : "1-use"}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-text-muted">{k.label || "—"}</td>
                  <td className="py-2 pr-3">
                    {k.fingerprint ? (
                      <span className="text-xs text-green-400">Activated</span>
                    ) : (
                      <span className="text-xs text-text-faint">Unused</span>
                    )}
                  </td>
                  <td className="py-2">
                    <button
                      onClick={() => handleDelete(k.id)}
                      className="text-xs text-red-400 hover:text-red-300"
                    >
                      Revoke
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
