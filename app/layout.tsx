import type { Metadata, Viewport } from "next";
import "./globals.css";

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
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Josefin+Sans:wght@200;300;400;500;600&family=Almarai:wght@300;400;700&display=swap"
        />
      </head>
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
