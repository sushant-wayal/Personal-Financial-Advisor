import type { Metadata } from "next";
import { Noto_Sans } from "next/font/google";
import "./globals.css";
import ReactQueryProvider from "../src/providers/ReactQueryProvider";

const notoSans = Noto_Sans({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: "North : Personanl Financial Advisor",
  description: "AI-powered personal finance assistant",
};

import ClientLayout from "./components/ClientLayout";

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${notoSans.variable} h-full antialiased dark`}>
      <body className="h-full overflow-x-hidden bg-background text-foreground">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 rounded bg-cyan-200 px-3 py-1 text-sm font-semibold text-slate-900"
        >
          Skip to main content
        </a>
        <ReactQueryProvider>
          <ClientLayout>
            {children}
          </ClientLayout>
        </ReactQueryProvider>
      </body>
    </html>
  );
}
