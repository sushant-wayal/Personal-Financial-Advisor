import type { Metadata } from "next";
import { Noto_Sans } from "next/font/google";
import "./globals.css";
import ReactQueryProvider from "../src/providers/ReactQueryProvider";

const notoSans = Noto_Sans({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: "Personal Finance OS",
  description: "AI-powered personal finance assistant (local-first)",
};

import Sidebar from "./components/Sidebar";
import Header from "./components/Header";

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${notoSans.variable} h-full antialiased dark`}>
      <body className="h-full overflow-hidden bg-background text-foreground">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 rounded bg-cyan-200 px-3 py-1 text-sm font-semibold text-slate-900"
        >
          Skip to main content
        </a>
        <ReactQueryProvider>
          <div className="flex h-full w-full">
            <Sidebar />
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              <Header />
              <main id="main" className="min-h-0 flex-1 overflow-y-auto p-6">
                {children}
              </main>
            </div>
          </div>
        </ReactQueryProvider>
      </body>
    </html>
  );
}
