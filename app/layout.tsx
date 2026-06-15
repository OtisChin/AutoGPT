import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "../components/auth-provider";

export const metadata: Metadata = {
  title: "AutoGPT REDEEM",
  description: "ChatGPT Plus CDK redeem center",
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#050706",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
