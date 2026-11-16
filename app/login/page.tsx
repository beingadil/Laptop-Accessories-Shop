import { ensureDatabaseSeeded } from '@/lib/database/seed';
import { getShopBranding } from '@/lib/services/branding';
import { LoginView } from '@/components/auth/LoginView';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  await ensureDatabaseSeeded();
  const initialBranding = await getShopBranding();

  return <LoginView initialBranding={initialBranding} />;
}
