import type { Metadata } from "next";
import { Syne } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { readRequestTeacherLocale } from "@/locales/server";
import { getTeacherLocaleProfile } from "@/locales";
import { isAiTeacherModeEnabled } from "@/constants/featureFlags";

const syne = Syne({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-syne",
});

export async function generateMetadata(): Promise<Metadata> {
  if (!isAiTeacherModeEnabled()) {
    return { title: "My Agora AI App", description: "Real-time video calling with Conversational AI agents, avatars, and collaboration tools — powered by Agora", icons: { icon: "/favicon.svg" } };
  }
  const profile = getTeacherLocaleProfile(await readRequestTeacherLocale());
  return { ...profile.metadata, icons: { icon: "/favicon.svg" } };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const initialLocale = isAiTeacherModeEnabled() ? await readRequestTeacherLocale() : "en-US";
  return (
    <html lang={isAiTeacherModeEnabled() ? initialLocale : "en"} className="dark">
      <body className={syne.variable}>
        <Providers initialLocale={initialLocale}>{children}</Providers>
      </body>
    </html>
  );
}
