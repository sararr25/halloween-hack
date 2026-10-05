import type { Metadata } from "next";
import { Inter_Tight, JetBrains_Mono, Newsreader, Nothing_You_Could_Do } from "next/font/google";
import "./globals.css";

const sans = Inter_Tight({ variable: "--font-sans", subsets: ["latin"] });
const mono = JetBrains_Mono({ variable: "--font-mono", subsets: ["latin"] });
// reading face for Mail: long text in a serif, a little larger
const serif = Newsreader({ variable: "--font-serif", subsets: ["latin"], style: ["normal", "italic"] });
// E.V.'s handwriting (polaroid captions)
const hand = Nothing_You_Could_Do({ variable: "--font-hand", weight: "400", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL("https://halloween-hack.vercel.app"),
  title: "recovery",
  description: "File recovery session",
  // the link preview in chats and DMs (app/opengraph-image.png, scripts/make-og.py)
  openGraph: {
    title: "case ████",
    description: "E.V. has been missing for 7 days. You have access now. Look carefully.",
    siteName: "recovery",
  },
  twitter: { card: "summary_large_image", title: "case ████", description: "E.V. has been missing for 7 days. Look carefully." },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} ${serif.variable} ${hand.variable}`}>
      <body>{children}</body>
    </html>
  );
}
