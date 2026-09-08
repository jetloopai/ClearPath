import type { Metadata } from "next";
import { Inter, Playfair_Display, Dancing_Script, Great_Vibes, Sacramento } from "next/font/google";
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

// Typed-signature font choices on the offer-sign page (SignaturePad).
const dancingScript = Dancing_Script({
  subsets: ["latin"],
  variable: "--font-dancing-script",
  display: "swap",
});

const greatVibes = Great_Vibes({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-great-vibes",
  display: "swap",
});

const sacramento = Sacramento({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-sacramento",
  display: "swap",
});

const MapProvider = dynamic(
  () => import("@/components/maps/MapProvider").then(m => m.MapProvider),
  { ssr: false }
);

export const metadata: Metadata = {
  title: "ClearPath Analyzer | Instant Deal Analysis",
  description: "Analyze the deal. ARV, rehab, rent, and profit — instantly. A precision tool for real estate investors.",
  metadataBase: new URL('https://clearpathanalyzer.com'),
  openGraph: {
    title: "ClearPath Analyzer | Instant Deal Analysis",
    description: "Analyze the deal. ARV, rehab, rent, and profit — instantly.",
    url: "https://clearpathanalyzer.com",
    siteName: "ClearPath Analyzer",
    images: [{ url: "/api/og", width: 1200, height: 630, alt: "ClearPath Analyzer" }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ClearPath Analyzer | Instant Deal Analysis",
    description: "Analyze the deal. ARV, rehab, rent, and profit — instantly.",
    images: ["/api/og"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} ${playfair.variable} ${dancingScript.variable} ${greatVibes.variable} ${sacramento.variable} font-sans antialiased bg-noise min-h-screen flex flex-col`}>
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
