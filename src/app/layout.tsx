import type { Metadata } from "next";
import "./globals.css";
import ShowdownDataGate from "../components/ShowdownDataGate";

export const metadata: Metadata = {
  title: "Pokemon Team Lab",
  description: "6v6 Pokemon matchup analysis powered by Smogon damage calculations.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body suppressHydrationWarning><ShowdownDataGate>{children}</ShowdownDataGate></body>
    </html>
  );
}
