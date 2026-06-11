import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Orkestra Data Lens — La couche de vérité data pour Shopify",
  description:
    "Comprenez enfin chaque visite, ajout panier, checkout et achat de votre boutique Shopify : données horodatées, parcours reconstruits, écarts expliqués.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f7f8fa",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
