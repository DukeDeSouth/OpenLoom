import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { verifyAccessToken } from "@/lib/access";
import { getObjectUrl } from "@/lib/s3";
import { formatDuration } from "@/lib/format";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { KeyGate } from "@/components/key-gate";

type Props = { params: Promise<{ id: string }> };

export default async function SectionPage({ params }: Props) {
  const { id } = await params;

  const section = await prisma.section.findUnique({
    where: { id },
    include: {
      videos: {
        where: { status: "READY" },
        orderBy: { createdAt: "desc" },
        select: { id: true, title: true, thumbKey: true, duration: true, views: true },
      },
    },
  });

  if (!section) notFound();

  const session = await getSession();
  const isOwner = !!session;
  let hasAccess = section.visibility === "PUBLIC" || isOwner;

  if (!hasAccess) {
    const cookieStore = await cookies();
    const accessCookie = cookieStore.get(`access_${id}`)?.value;
    if (accessCookie) {
      const access = await verifyAccessToken(accessCookie);
      if (access && access.sectionId === id) {
        hasAccess = true;
      }
    }
  }

  if (!hasAccess) {
    return (
      <div className="min-h-screen">
        <PageHeader>
          <Link href="/">
            <Button variant="ghost" size="sm">Back to catalog</Button>
          </Link>
        </PageHeader>
        <KeyGate sectionId={id} sectionTitle={section.title} />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <PageHeader>
        <Link href="/">
          <Button variant="ghost" size="sm">Back to catalog</Button>
        </Link>
        {isOwner && (
          <Link href="/dashboard">
            <Button variant="accent" size="sm">Dashboard</Button>
          </Link>
        )}
      </PageHeader>

      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-text-primary">{section.title}</h1>
          {section.description && (
            <p className="text-text-muted mt-2">{section.description}</p>
          )}
        </div>

        {section.videos.length === 0 ? (
          <p className="text-text-muted text-center py-20">No videos in this section yet</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {section.videos.map((v) => {
              const thumbUrl = v.thumbKey ? getObjectUrl(v.thumbKey) : null;
              return (
                <Link key={v.id} href={`/watch/${v.id}`}>
                  <Card className="group/vid hover:scale-[1.02] transition-transform">
                    <div className="aspect-video bg-black/30 relative">
                      {thumbUrl ? (
                        <img src={thumbUrl} alt={v.title || ""} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <svg className="w-10 h-10 text-text-faint" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        </div>
                      )}
                      {v.duration != null && (
                        <span className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded font-mono">
                          {formatDuration(v.duration)}
                        </span>
                      )}
                    </div>
                    <div className="p-3">
                      <h3 className="text-sm font-medium text-text-primary truncate">
                        {v.title || "Untitled"}
                      </h3>
                      <p className="text-xs text-text-faint mt-1">{v.views} views</p>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
