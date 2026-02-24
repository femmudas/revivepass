import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        background: "#070A0D",
        foreground: "#E6FFF4",
        card: "#0B0F14",
        panel: "#0B0F14",
        navbar: "#0A0E13",
        neon: "#00FF88",
        neonHover: "#00CC6E",
        muted: "#9FD9C0",
        accent: "#9FD9C0",
        border: "rgba(0,255,136,0.25)",
        focus: "rgba(0,255,136,0.55)",
        danger: "#ff6b6b"
      },
      boxShadow: {
        neon: "0 10px 40px rgba(0,255,136,0.25)",
        card: "0 8px 30px rgba(0,0,0,0.35)"
      }
    }
  },
  plugins: []
};

export default config;
