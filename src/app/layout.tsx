import './globals.css';
import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';

export const metadata: Metadata = {
  title: 'Technology Roadmap Viewer',
  description: 'Internal tool to visualize technology roadmap ideas',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap"
        />
      </head>
      <body className="bg-slate-50 text-slate-900">
        <ClerkProvider>{children}</ClerkProvider>
      </body>
    </html>
  );
}
