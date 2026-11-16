import type { Metadata } from 'next';
import { Toaster } from 'sonner';
import { BrandingProvider } from '@/components/branding/BrandingProvider';
import { getShopBranding } from '@/lib/services/branding';
import './globals.css';

export const dynamic = 'force-dynamic';

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
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900" suppressHydrationWarning>
        <BrandingProvider initialBranding={initialBranding}>
          {children}
        </BrandingProvider>
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  );
}
