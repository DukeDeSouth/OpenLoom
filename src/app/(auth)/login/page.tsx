"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        let msg = "Login failed";
        try {
          const data = await res.json();
          if (data?.error) msg = data.error;
        } catch {}
        setError(msg);
        return;
      }

      router.push("/dashboard");
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm glass-strong rounded-lg p-8">
        <h1 className="text-2xl font-bold text-center text-text-primary mb-8">
          Sign in to OpenLoom
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <Alert>{error}</Alert>}

          <Input
            id="email"
            label="Email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
          />

          <Input
            id="password"
            label="Password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />

          <Button variant="accent" fullWidth disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </Button>
        </form>

        <p className="text-center text-sm text-text-muted mt-6">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="text-accent hover:text-accent-hover">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
