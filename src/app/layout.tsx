import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Floorbase',
  description: 'Admin-first table reservation platform'
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
