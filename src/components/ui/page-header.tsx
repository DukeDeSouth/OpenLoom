import Image from "next/image";
import Link from "next/link";

export function PageHeader({ children }: { children?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-40 glass border-b border-glass-border px-6 py-4 flex items-center justify-between">
      <Link
        href="/"
        className="flex items-center gap-2 text-lg font-semibold text-text-primary tracking-tight"
      >
        <Image
          src="/icon-192.png"
          alt="OpenLoom"
          width={28}
          height={28}
          className="rounded-md"
        />
        OpenLoom
      </Link>
      {children && <div className="flex items-center gap-4">{children}</div>}
    </header>
  );
}
