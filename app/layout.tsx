import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/constants";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — Trade with clarity.`,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

// Deliberately minimal: no header/footer/skip-link here — those belong to
// whichever section actually defines page chrome ((marketing) or /app),
// since this root layout wraps every route including the auth-gated
// /app/* section, which needs its own distinct shell, not the marketing
// site's nav stacked on top of it.
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // next-themes sets the class attribute on <html> before hydration, which
    // will legitimately differ from the server-rendered markup.
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className="font-sans antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
