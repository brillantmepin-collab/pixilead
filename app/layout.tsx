import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PixiLead — Le scraper & générateur de prospection B2B par IA pour l'Afrique",
  description:
    "Trouvez des milliers d'entreprises locales sur Google Maps (Cameroun, Côte d'Ivoire, Sénégal), générez des messages de prospection WhatsApp ultra-personnalisés par IA et exportez vos leads en CSV.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className="dark">
      <body className="bg-[#061a12] text-slate-100 antialiased min-h-screen selection:bg-emerald-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
