import type { Metadata } from "next";
import { Syne } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const syne = Syne({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-syne",
});

export const metadata: Metadata = {
  title: "My Agora AI App",
  description:
    "Real-time video calling with Conversational AI agents, avatars, and collaboration tools — powered by Agora",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={syne.variable}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
