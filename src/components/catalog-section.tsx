import Link from "next/link";
import { getObjectUrl } from "@/lib/s3";
import { formatDuration } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { KeyGate } from "@/components/key-gate";

interface Video {
  id: string;
  title: string | null;
  thumbKey: string | null;
  duration: number | null;
  views: number;
}

interface CatalogSectionProps {
  section: {
    id: string;
    title: string;
    description: string | null;
    visibility: "PUBLIC" | "PRIVATE";
    videos: Video[];
  };
  hasAccess: boolean;
  isOwner: boolean;
}

export function CatalogSection({ section, hasAccess, isOwner }: CatalogSectionProps) {
  const isPrivate = section.visibility === "PRIVATE";

  return (
    <section id={`section-${section.id}`} className="py-8">
      <div className="flex items-center gap-3 mb-2">
        <h2 className="text-xl md:text-2xl font-bold text-text-primary">
          {section.title}
        </h2>
        {isPrivate && (
          <svg className="w-5 h-5 text-text-faint shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
          </svg>
        )}
        <span className="text-sm text-text-faint ml-auto">
          {section.videos.length} video{section.videos.length !== 1 ? "s" : ""}
        </span>
      </div>

      {section.description && (
        <p className="text-text-muted mb-4">{section.description}</p>
      )}

      {!hasAccess ? (
        <KeyGate sectionId={section.id} sectionTitle={section.title} compact />
      ) : section.videos.length === 0 ? (
        <p className="text-text-faint text-sm py-6">No videos in this section yet</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {section.videos.map((v) => {
            const thumbUrl = v.thumbKey ? getObjectUrl(v.thumbKey) : null;
            return (
              <Link key={v.id} href={`/watch/${v.id}`}>
                <Card className="group/vid hover:scale-[1.02] transition-transform">
                  <div className="aspect-video bg-black/30 relative">
                    {thumbUrl ? (
                      <img src={thumbUrl} alt={v.title || ""} className="w-full h-full object-cover rounded-t-md" />
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
    </section>
  );
}
