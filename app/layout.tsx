import type { Metadata } from "next";
import { PwaRuntime } from "@/components/pwa-runtime";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Kuartz Fashion CRM", template: "%s · Kuartz" },
  description: "Fashion operations from client contact to delivery.",
  applicationName: "Kuartz Fashion CRM",
  appleWebApp: { capable: true, title: "Kuartz" },
  icons: {
    icon: [
      { url: "/icons/kuartz-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/kuartz-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/kuartz-apple-touch.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport = { themeColor: "#171b36", colorScheme: "light" };

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
