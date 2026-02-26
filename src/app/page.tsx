import Link from "next/link";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { verifyAccessToken } from "@/lib/access";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { CatalogSection } from "@/components/catalog-section";

export default async function CatalogPage() {
  const [channel, sections, session] = await Promise.all([
    prisma.channel.upsert({
      where: { id: "default" },
      create: { id: "default", title: "My Channel" },
      update: {},
    }),
    prisma.section.findMany({
      orderBy: { order: "asc" },
      include: {
        videos: {
          where: { status: "READY" },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            title: true,
            thumbKey: true,
            duration: true,
            views: true,
          },
        },
      },
    }),
    getSession(),
  ]);

  const isOwner = !!session;
  const cookieStore = await cookies();

  const sectionsWithAccess = await Promise.all(
    sections.map(async (s) => {
      let hasAccess = s.visibility === "PUBLIC" || isOwner;
      if (!hasAccess) {
        const accessCookie = cookieStore.get(`access_${s.id}`)?.value;
        if (accessCookie) {
          const access = await verifyAccessToken(accessCookie);
          if (access && access.sectionId === s.id) {
            hasAccess = true;
          }
        }
      }
      return { section: s, hasAccess };
    }),
  );

  return (
    <div className="min-h-screen flex flex-col">
      <PageHeader>
        {isOwner ? (
          <Link href="/dashboard">
            <Button variant="accent" size="sm">Dashboard</Button>
          </Link>
        ) : (
          <Link href="/login">
            <Button variant="ghost" size="sm">Sign in</Button>
          </Link>
        )}
      </PageHeader>

      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-10">
        <div className="mb-6">
          <h1 className="text-3xl md:text-4xl font-bold text-text-primary">
            {channel.title}
          </h1>
          {channel.description && (
            <p className="text-text-muted mt-2 text-lg">{channel.description}</p>
          )}
        </div>

        {sectionsWithAccess.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-text-muted text-lg">No content yet</p>
          </div>
        ) : (
          <div className="divide-y divide-glass-border">
            {sectionsWithAccess.map(({ section, hasAccess }) => (
              <CatalogSection
                key={section.id}
                section={section}
                hasAccess={hasAccess}
                isOwner={isOwner}
              />
            ))}
          </div>
        )}
      </main>

      <footer className="border-t border-glass-border py-6 px-6 text-center text-text-faint text-sm">
        Powered by{" "}
        <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="hover:text-text-muted transition-colors">
          OpenLoom
        </a>
      </footer>
    </div>
  );
}
