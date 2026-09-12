import type { Metadata } from "next";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: "Open Ried Sens | Umweltsensornetzwerk Bürstadt & Lampertheim",
  description: "Digitales Umweltsensornetzwerk & LoRaWAN-Infrastruktur für Bürstadt, Lampertheim und das Hessische Ried – eine Initiative des Kulturzentrums KAMÜ & Bürgerinnen/Bürger.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de" className={cn("h-full antialiased", "font-sans", geist.variable)}>
      <body className="min-h-full flex flex-col bg-slate-950 text-slate-100 font-sans selection:bg-emerald-500 selection:text-slate-950">
        {children}
      </body>
    </html>
  );
}
