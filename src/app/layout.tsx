import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OpenLoom",
  description: "Self-hosted video messaging for teams",
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
        <body className="text-text-secondary antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
