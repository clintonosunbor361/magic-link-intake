import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        kuartz: {
          navy: "#15163f",
          ink: "#15163f",
          muted: "#8c95a5",
          line: "#d9e0eb",
          graphite: "#15163f",
          smoke: "#8c95a5",
          lime: "#d2ff67",
          limeDeep: "#bdf447",
          paper: "#ffffff",
        },
      },
      fontFamily: {
        display: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "Segoe UI",
          "sans-serif",
        ],
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "Segoe UI",
          "sans-serif",
        ],
      },
      boxShadow: {
        glass: "0 30px 90px rgba(21, 22, 63, 0.10)",
        lift: "0 16px 44px rgba(21, 22, 63, 0.12)",
      },
    },
  },
  plugins: [],
};

export default config;