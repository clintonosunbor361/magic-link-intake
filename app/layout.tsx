import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kuartz by Roti Intake",
  description: "Magic-link client intake sample for Kuartz by Roti.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
