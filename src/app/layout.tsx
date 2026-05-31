import type { Metadata } from "next";
import { Playfair_Display, Cormorant_Garamond, Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  display: "swap",
});

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Jolie Fragrances | Gestor de Publicaciones",
  description: "Gestor de imágenes para publicaciones de Jolie Fragrances. Edita, transforma y organiza tus imágenes de Instagram con estilo premium.",
  keywords: ["Jolie Fragrances", "gestor de imágenes", "Instagram", "perfumes", "publicaciones"],
  authors: [{ name: "Jolie Fragrances" }],
  icons: {
    icon: "/favicon.ico",
  },
  openGraph: {
    title: "Jolie Fragrances | Gestor de Publicaciones",
    description: "Gestor de imágenes para publicaciones de Jolie Fragrances",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark" suppressHydrationWarning>
      <body
        className={`${playfair.variable} ${cormorant.variable} ${inter.variable} antialiased bg-[#0a0a0a] text-white`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
