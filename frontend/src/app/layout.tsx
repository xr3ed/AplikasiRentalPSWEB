import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Aplikasi Billing Rental PS",
  description: "Sistem Manajemen Rental Playstation",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning={true}>
      <body className={`${inter.className} bg-gray-900 text-white`} suppressHydrationWarning={true}>
        <main>
          {children}
        </main>
      </body>
    </html>
  );
}
