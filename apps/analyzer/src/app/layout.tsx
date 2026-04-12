import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import dynamic from "next/dynamic";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
});

const MapProvider = dynamic(
  () => import("@/components/maps/MapProvider").then(m => m.MapProvider),
  { ssr: false }
);

export const metadata: Metadata = {
  title: "ClearPath Analyzer | Instant Deal Analysis",
  description: "Analyze the deal. ARV, rehab, rent, and profit — instantly. A precision tool for real estate investors.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} ${playfair.variable} font-sans antialiased bg-noise min-h-screen flex flex-col`}>
        <MapProvider>
          <ErrorBoundary>
            <Navbar />
            {children}
            <Footer />
          </ErrorBoundary>
        </MapProvider>
      </body>
    </html>
  );
}
