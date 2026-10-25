import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const instrument = Instrument_Serif({
  variable: "--font-instrument",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

const themeScript = `(function(){var d=document.documentElement,t=null;try{t=new URLSearchParams(location.search).get("theme")||localStorage.getItem("ib-theme")}catch(e){}if(t==="light"||t==="dark"){d.setAttribute("data-theme",t);d.classList.toggle("dark",t==="dark");}})();`;

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FFFFFF" },
    { media: "(prefers-color-scheme: dark)", color: "#111113" },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://127.0.0.1:4721"),
  title: {
    default: "Inbox Bodyguard",
    template: "%s · Inbox Bodyguard",
  },
  description: "The AI email assistant that can't be turned against you.",
  applicationName: "Inbox Bodyguard",
  openGraph: {
    title: "Inbox Bodyguard",
    description: "The AI email assistant that can't be turned against you.",
    siteName: "Inbox Bodyguard",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Inbox Bodyguard",
    description: "The AI email assistant that can't be turned against you.",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${instrument.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
