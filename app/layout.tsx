import type { Metadata } from 'next';
import { Plus_Jakarta_Sans, DM_Sans, JetBrains_Mono } from 'next/font/google';
import { Toaster } from 'sonner';
import { BrandingProvider } from '@/components/branding/BrandingProvider';
import { getShopBranding } from '@/lib/services/branding';
import './globals.css';

export const dynamic = 'force-dynamic';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-display',
  display: 'swap',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-body',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
  display: 'swap',
});

export async function generateMetadata(): Promise<Metadata> {
  const branding = await getShopBranding();
  const title = `${branding.shopName} Management System`;
  const description = `Complete offline-capable laptop and accessories shop management software for ${branding.shopName}.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const initialBranding = await getShopBranding();

  return (
    <html
      lang="en"
      className={`${plusJakarta.variable} ${dmSans.variable} ${jetbrainsMono.variable}`}
    >
      <body className="min-h-screen bg-slate-50 text-slate-900" suppressHydrationWarning>
        <BrandingProvider initialBranding={initialBranding}>
          {children}
        </BrandingProvider>
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  );
}
