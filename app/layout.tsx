import type { Metadata } from "next";
import { PwaRuntime } from "@/components/pwa-runtime";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Kuartz Fashion CRM", template: "%s · Kuartz" },
  description: "Fashion operations from enquiry to delivery.",
  applicationName: "Kuartz Fashion CRM",
  appleWebApp: { capable: true, title: "Kuartz" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans antialiased">
        <PwaRuntime />
        {children}
      </body>
    </html>
  );
}
