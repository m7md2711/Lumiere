import type { Config } from "tailwindcss";

/**
 * Lumiere brand: gold on near-black, taken from the clinic's landing page.
 * Gold gradient #f7e7b0 → #e3c46a → #c9a227, ground #0a0806, text #f8f1e2.
 *
 * The `slate` scale is deliberately inverted — 50 is the darkest and 900 the
 * lightest — so the light-theme classes already in the markup (bg-slate-50 for
 * the page, text-slate-900 for a heading) land correctly on a dark ground
 * without touching every file. Read slate-N as "N steps toward the light".
 */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Warm near-black ground through to cream type.
        slate: {
          50: "#0a0806",
          100: "#100d09",
          200: "#1b1610",
          300: "#2a2318",
          400: "#8a7f6c",
          500: "#a2957e",
          600: "#c0b39a",
          700: "#d8cbb3",
          800: "#ece2cd",
          900: "#f8f1e2",
          950: "#fffaf0",
        },
        // Gold. 50–300 are tinted surfaces, 600+ are the metal itself.
        clinic: {
          50: "#1a1408",
          100: "#2a2110",
          200: "#3d2f14",
          300: "#6b5520",
          400: "#c9a227",
          500: "#d9b648",
          600: "#e3c46a",
          700: "#ecd894",
          800: "#f7e7b0",
          900: "#fbf1d0",
          950: "#fdf9ed",
        },
        gold: {
          deep: "#c9a227",
          mid: "#e3c46a",
          light: "#f7e7b0",
        },
        // For type sitting on top of gold.
        ink: "#0a0806",
        cream: "#f8f1e2",
      },
      fontFamily: {
        sans: [
          "system-ui", "-apple-system", "Segoe UI", "Roboto",
          "Helvetica Neue", "Arial", "Noto Sans Arabic", "sans-serif",
        ],
      },
      boxShadow: {
        gold: "0 1px 3px rgb(0 0 0 / 0.6), 0 0 0 1px rgb(227 196 106 / 0.10)",
      },
    },
  },
  plugins: [],
};
export default config;
