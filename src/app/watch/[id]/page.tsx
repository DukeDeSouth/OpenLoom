import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { getObjectUrl } from "@/lib/s3";
import { getSession } from "@/lib/auth";
import { verifyAccessToken } from "@/lib/access";
import { VideoPlayer } from "@/components/video-player";
import { VideoMeta } from "@/components/video-meta";
import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import { PageHeader } from "@/components/ui/page-header";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const video = await prisma.video.findUnique({ where: { id } });
  if (!video) return {};

  const thumbUrl = video.thumbKey ? getObjectUrl(video.thumbKey) : undefined;
  const title = video.title || "OpenLoom Recording";

  return {
    title: `${title} | OpenLoom`,
    openGraph: {
      title,
      type: "video.other",
      images: thumbUrl ? [{ url: thumbUrl }] : [],
    },
    twitter: { card: "summary_large_image" },
  };
}

export default async function WatchPage({ params }: Props) {
  const { id } = await params;
  const video = await prisma.video.findUnique({
    where: { id },
    include: {
      segments: { orderBy: { start: "asc" } },
      user: { select: { name: true } },
      section: { select: { id: true, visibility: true } },
    },
  });

  if (!video || video.status === "UPLOADING" || video.status === "FAILED") {
    notFound();
  }

  const session = await getSession();
  const isOwner = session?.userId === video.userId;

  if (!isOwner && video.section?.visibility === "PRIVATE") {
    const cookieStore = await cookies();
    const accessCookie = cookieStore.get(`access_${video.section.id}`)?.value;
    let hasAccess = false;
    if (accessCookie) {
      const access = await verifyAccessToken(accessCookie);
      if (access && access.sectionId === video.section.id) {
        hasAccess = true;
      }
    }
    if (!hasAccess) {
      redirect(`/s/${video.section.id}`);
    }
  }

  await prisma.video.update({
    where: { id },
    data: { views: { increment: 1 } },
  });

  const videoUrl = video.outputKey ? getObjectUrl(video.outputKey) : null;
  const subtitleUrl = video.subtitleKey
    ? getObjectUrl(video.subtitleKey)
    : undefined;

  if (!videoUrl) notFound();

  return (
    <div className="min-h-screen">
      <PageHeader />

      <main className="max-w-5xl mx-auto p-6">
        <VideoPlayer
          src={videoUrl}
          subtitleSrc={subtitleUrl}
          segments={video.segments}
        />

        <VideoMeta
          videoId={video.id}
          title={video.title || "Recording"}
          authorName={video.user.name || "Anonymous"}
          duration={video.duration}
          views={video.views}
          createdAt={video.createdAt.toISOString()}
          isOwner={isOwner}
        />
      </main>
    </div>
  );
}
