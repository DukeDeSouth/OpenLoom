"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";

export function Nav() {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <PageHeader>
      <Link href="/dashboard/record">
        <Button variant="primary" size="sm">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="6" />
          </svg>
          New Recording
        </Button>
      </Link>
      <Link href="/dashboard/settings" className="text-sm text-text-muted hover:text-text-primary transition-colors">
        Settings
      </Link>
      <button
        onClick={handleLogout}
        className="text-sm text-text-muted hover:text-text-primary transition-colors"
      >
        Sign out
      </button>
    </PageHeader>
  );
}
