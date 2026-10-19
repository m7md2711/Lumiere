import type { Config } from "tailwindcss";

/**
 * Lumiere brand — Midnight #080808, Lumiere Gold #C9A84C, Warm Bronze #8A7340,
 * Soft Noir #1A1A1A, with Josefin Sans and Almarai.
 *
 * Both palettes are served through CSS variables so one set of classes covers
 * light and dark. The scale is written by role rather than by lightness:
 * `slate-50` is always the page ground and `slate-900` always the strongest
 * type, whichever theme is on. Read slate-N as "N steps away from the ground".
 */
const scale = (name: string) =>
  Object.fromEntries(
    [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map((step) => [
      step,
      `rgb(var(--${name}-${step}) / <alpha-value>)`,
    ])
  );

const config: Config = {
  darkMode: ["class", '[data-theme="dark"]'],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        slate: scale("s"),
        clinic: scale("c"),
        gold: {
          deep: "rgb(var(--c-400) / <alpha-value>)",
          mid: "rgb(var(--c-600) / <alpha-value>)",
          light: "rgb(var(--c-800) / <alpha-value>)",
        },
        ink: "rgb(var(--on-gold) / <alpha-value>)",
        cream: "rgb(var(--s-900) / <alpha-value>)",
        midnight: "#080808",
        noir: "#1a1a1a",
        bronze: "#8a7340",
      },
      fontFamily: {
        sans: ["var(--font-josefin)", "var(--font-almarai)", "system-ui", "-apple-system", "sans-serif"],
        arabic: ["var(--font-almarai)", "var(--font-josefin)", "system-ui", "sans-serif"],
      },
      letterSpacing: { brand: "0.18em", label: "0.22em" },
      boxShadow: {
        gold: "var(--shadow-card)",
        lift: "var(--shadow-lift)",
      },
    },
  },
  plugins: [],
};
export default config;
