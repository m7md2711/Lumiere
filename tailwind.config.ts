import type { Config } from "tailwindcss";

/**
 * Lumiere brand identity — from the clinic's official guide.
 *
 *   Midnight      #080808   the ground
 *   Lumiere Gold  #C9A84C   the one accent
 *   Warm Bronze   #8A7340   secondary / muted
 *   Soft Noir     #1A1A1A   raised surfaces
 *
 * Typography is Josefin Sans (Latin) with Almarai (Arabic).
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
        slate: {
          50: "#080808",   // Midnight — page ground
          100: "#1a1a1a",  // Soft Noir — cards
          200: "#262626",  // borders, inputs
          300: "#3a3226",  // stronger border, warmed toward the gold
          400: "#6e6450",
          500: "#8a7340",  // Warm Bronze — muted text
          600: "#a89364",
          700: "#c9bfa8",
          800: "#e3dccb",
          900: "#f1ece0",  // primary text
          950: "#ffffff",
        },
        clinic: {
          50: "#17130a",
          100: "#241d0f",
          200: "#3a2f18",
          300: "#6b5a2e",
          400: "#8a7340",  // Warm Bronze
          500: "#a88c4a",
          600: "#c9a84c",  // Lumiere Gold — the accent
          700: "#d9be6e",
          800: "#e4cc8a",
          900: "#efdca8",
          950: "#f7ebc9",
        },
        gold: {
          deep: "#8a7340",
          mid: "#c9a84c",
          light: "#e4cc8a",
        },
        midnight: "#080808",
        noir: "#1a1a1a",
        bronze: "#8a7340",
        ink: "#080808",
        cream: "#f1ece0",
      },
      fontFamily: {
        // Josefin runs light by design; Almarai carries every Arabic string.
        sans: ["Josefin Sans", "Almarai", "system-ui", "-apple-system", "sans-serif"],
        arabic: ["Almarai", "Josefin Sans", "system-ui", "sans-serif"],
      },
      letterSpacing: {
        brand: "0.18em",
        label: "0.22em",
      },
      boxShadow: {
        gold: "0 1px 3px rgb(0 0 0 / 0.7), 0 0 0 1px rgb(201 168 76 / 0.10)",
      },
    },
  },
  plugins: [],
};
export default config;
