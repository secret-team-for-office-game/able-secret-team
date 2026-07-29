import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Bright Fantasy / Premium Mobile Game palette — spec explicitly says
        // "ไม่ทำธีมมืดหรือน่ากลัว" (no dark/scary theme), main colors blue/purple/red.
        sky: { DEFAULT: "#8ec9f0", light: "#dceefb" },
        cream: "#fffdf8",
        panel: "#f3f1fb",
        ink: { DEFAULT: "#2b2a4a", soft: "#5c5a82" },
        dolphin: { DEFAULT: "#3d9fd6", dark: "#2b7fae", bg: "#e3f2fb" },
        whale:   { DEFAULT: "#8a5cf0", dark: "#6d3fc9", bg: "#efe8fd" },
        shark:   { DEFAULT: "#e0533f", dark: "#c23c29", bg: "#fdeae6" },
        gold: "#f2ba36",
        good: "#3fa35e",
        bad: "#e0473b",
        line: "#e3dcf5",
      },
      fontFamily: {
        display: ["var(--font-baloo)", "cursive"],
        sans: ["var(--font-thai)", "sans-serif"],
      },
      borderRadius: { xl2: "1.25rem", xl3: "1.5rem" },
    },
  },
  plugins: [],
};
export default config;
