"use client";

import { useRouter } from "next/navigation";
import { Recorder } from "@/components/recorder";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";

export default function RecordPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex flex-col">
      <PageHeader>
        <Link
          href="/dashboard"
          className="text-sm text-text-muted hover:text-text-primary transition-colors"
        >
          Back to videos
        </Link>
      </PageHeader>

      <main className="flex-1 flex items-center justify-center p-8">
        <Recorder
          onComplete={() => {
            setTimeout(() => router.push(`/dashboard`), 2000);
          }}
        />
      </main>
    </div>
  );
}
