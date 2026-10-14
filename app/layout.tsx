import type { Metadata } from "next";
import { Syne } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { readRequestTeacherLocale } from "@/locales/server";
import { getTeacherLocaleProfile } from "@/locales";

const syne = Syne({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-syne",
});

export async function generateMetadata(): Promise<Metadata> {
  const profile = getTeacherLocaleProfile(await readRequestTeacherLocale());
  return { ...profile.metadata, icons: { icon: "/favicon.svg" } };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const initialLocale = await readRequestTeacherLocale();
  return (
    <html lang={initialLocale} className="dark">
      <body className={syne.variable}>
        <Providers initialLocale={initialLocale}>{children}</Providers>
      </body>
    </html>
  );
}
