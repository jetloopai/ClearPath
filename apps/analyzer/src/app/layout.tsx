import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { MapProvider } from "@/components/maps/MapProvider";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import "./globals.css";

const inter = Inter({ 
  subsets: ["latin"],
  variable: "--font-inter", 
});

const playfair = Playfair_Display({ 
  subsets: ["latin"],
  variable: "--font-playfair",
  weight: ["400", "500", "600", "700", "800", "900"],
  style: ["normal", "italic"],
});

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
