import type { Metadata } from 'next';
import './globals.css';
import { NavBar } from '@/components/NavBar';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'Онлайн-библиотека',
  description: 'Кураторская подборка книг в тёмном премиальном стиле.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body className="min-h-screen bg-bg font-sans text-white antialiased">
        {/*
          The Providers boundary mounts the Redux store once per tab.
          It wraps every client island in the tree (NavBar, search,
          filters, bookmark toggle, admin forms) so they share a single
          RTK Query cache. Server components inside <main> render
          normally and never subscribe to the store.

          The page fade-in is applied to <main> via the `animate-fade-in`
          utility, which resolves to a 300ms ease-out fade defined in
          `tailwind.config.ts` (Requirement 12.2). Re-keying the element
          on each child render would make it replay on navigation but
          isn't required: Next.js mounts a new <main> per route segment.
        */}
        <Providers>
          <NavBar />
          <main className="animate-fade-in">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
