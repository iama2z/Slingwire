import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Slingwire Promise Network",
  description: "A decentralized, ad-free town square for local events.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900 font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
