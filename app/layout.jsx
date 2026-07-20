
import { Geist, Geist_Mono } from "next/font/google";
import Providers from "./lib/provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Truck Logging",
  description: "Truck Logging",
};

export default function RootLayout({
  children
}) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col" style={{background: "#f4f6f9"}}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
