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
          ink: "#171b36",
          body: "#272c45",
          secondary: "#50586c",
          muted: "#606777",
          subtle: "#676d7d",
          line: "#d9d8d1",
          lineSoft: "#eceae2",
          control: "#cfcec7",
          graphite: "#15163f",
          smoke: "#8c95a5",
          lime: "#d2ff67",
          limeDeep: "#bdf447",
          paper: "#ffffff",
          canvas: "#f4f3ee",
          danger: "#7e403d",
          success: "#44582a",
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
