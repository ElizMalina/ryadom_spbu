import { SiteFooter } from '@/modules/navigation/components/SiteFooter';
import { AuthProvider } from '@/modules/auth/components/AuthProvider';
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: 'Рядом — психологическая поддержка СПбГУ',
  description: 'Открытые материалы, практики и информация о психологической помощи СПбГУ',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body>
        <AuthProvider>{children}</AuthProvider>
        <SiteFooter />
      </body>
    </html>
  );
}
