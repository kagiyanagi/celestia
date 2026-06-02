import type { Metadata } from "next";
import { Paytone_One } from "next/font/google";

import { SiteHeader } from "@/components/site-header";
import "./globals.css";

const paytoneOne = Paytone_One({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-paytone",
});

export const metadata: Metadata = {
  title: {
    default: "Celestia - Watch Anime",
    template: "%s | Celestia",
  },
  description:
    "Watch anime, discover new seasons, and keep track of every episode with Celestia.",
  metadataBase: new URL("http://localhost:3000"),
  icons: {
    icon: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={paytoneOne.variable}>
        <SiteHeader />
        <main>{children}</main>
      </body>
    </html>
  );
}
