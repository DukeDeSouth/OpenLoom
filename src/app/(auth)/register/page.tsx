"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name, inviteCode: inviteCode || undefined }),
      });

      if (!res.ok) {
        let msg = "Registration failed";
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
          Create your account
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <Alert>{error}</Alert>}

          <Input
            id="invite"
            label="Invite Code"
            type="text"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            placeholder="Enter invite code"
          />

          <Input
            id="name"
            label="Name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
          />

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
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Min 8 characters"
          />

          <Button variant="accent" fullWidth disabled={loading}>
            {loading ? "Creating account..." : "Create account"}
          </Button>
        </form>

        <p className="text-center text-sm text-text-muted mt-6">
          Already have an account?{" "}
          <Link href="/login" className="text-accent hover:text-accent-hover">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
