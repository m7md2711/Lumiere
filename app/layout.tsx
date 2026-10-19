import type { Metadata, Viewport } from "next";
import { Almarai, Josefin_Sans } from "next/font/google";
import "./globals.css";

/**
 * Self-hosted at build time. These were a <link> to Google, which put a
 * render-blocking request to another company's servers in front of every
 * first paint — about 430ms measured on the patient form — and swapped the
 * text in late, nudging the layout.
 */
// Only the weights the interface actually sets: 200 had no uses at all but
// cost a download on every page. font-bold falls to 600, its nearest.
const josefin = Josefin_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-josefin",
  display: "swap",
});

const almarai = Almarai({
  subsets: ["arabic"],
  weight: ["300", "400", "700"],
  variable: "--font-almarai",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Lumiere Skin Clinic — Your experience matters",
  description: "Share your feedback, suggestion, or concern with Lumiere Skin Clinic.",
  icons: { icon: "/logo.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#080808" },
    { media: "(prefers-color-scheme: light)", color: "#faf8f4" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${josefin.variable} ${almarai.variable}`}>
      <body className="min-h-screen">
        <script
          // Runs before paint: without it the page renders dark, then snaps.
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('lsc_theme');if(t==='dark'||t==='light'){document.documentElement.setAttribute('data-theme',t);}}catch(e){}})();`,
          }}
        />
        {children}
      </body>
    </html>
  );
}
