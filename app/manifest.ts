import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Kuartz Fashion CRM",
    short_name: "Kuartz",
    description: "Fashion operations from enquiry to delivery.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f4f3ee",
    theme_color: "#171b36",
    icons: [
      { src: "/icons/kuartz-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/kuartz-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/kuartz-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
