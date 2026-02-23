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
        background: "#070A13",
        foreground: "#EAF2FF",
        panel: "#0B1224",
        neon: "#2EF2B8",
        accent: "#35B5FF",
        danger: "#FF5A8A",
        border: "#1F2B45"
      },
      boxShadow: {
        neon: "0 0 30px rgba(46,242,184,0.18)"
      }
    }
  },
  plugins: []
};

export default config;