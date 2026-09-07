import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        clinic: {
          50: "#fbf5fa",
          100: "#f5e6f2",
          200: "#ecc9e3",
          300: "#dc9ecb",
          400: "#c56cab",
          500: "#a8478c",
          600: "#7d2f6b",
          700: "#632457",
          800: "#4f1d46",
          900: "#3c1636",
          950: "#240d21",
        },
      },
      fontFamily: {
        sans: [
          "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto",
          "Helvetica Neue", "Arial", "Noto Sans", "Noto Sans Arabic", "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};
export default config;
