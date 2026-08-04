import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return { name: "Kuartz Fashion CRM", short_name: "Kuartz", description: "Fashion operations from enquiry to delivery.", start_url: "/", display: "standalone", background_color: "#f4f3ee", theme_color: "#171b36", icons: [{ src: "/kuartz-mark.svg", sizes: "any", type: "image/svg+xml" }] };
}
