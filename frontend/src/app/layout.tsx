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
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-gray-900 text-white`}>
        <div className="flex">
          {/* Sidebar can be a component here */}
          <aside className="w-64 bg-gray-800 p-4 h-screen">
            <h1 className="text-2xl font-bold text-red-500">RentalPS</h1>
            <nav className="mt-8">
              {/* Nav Links */}
            </nav>
          </aside>
          <main className="flex-1 p-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
