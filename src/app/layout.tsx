import type {Metadata} from 'next';
import './globals.css';
import { InvitationListener } from '@/components/InvitationListener';
import { Toaster } from '@/components/ui/toaster';

export const metadata: Metadata = {
  title: 'Apo54 Battleground',
  description: 'Real-time multiplayer arena combat game',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;600;700&family=Luckiest+Guy&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased selection:bg-accent selection:text-accent-foreground">
        <InvitationListener />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
