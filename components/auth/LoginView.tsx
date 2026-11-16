'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, KeyRound, Loader2, MapPin, Phone, ShieldCheck, User } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { BrandMark } from '@/components/branding/BrandMark';
import { useBranding } from '@/components/branding/BrandingProvider';
import { formatShopPhones, normalizeShopBranding, type ShopBranding } from '@/lib/branding';

export function LoginView({ initialBranding }: { initialBranding: ShopBranding }) {
  const router = useRouter();
  const { branding: contextBranding } = useBranding();

  const branding = React.useMemo(
    () => normalizeShopBranding(contextBranding || initialBranding),
    [contextBranding, initialBranding]
  );

  React.useEffect(() => {
    document.title = `Sign In — ${branding.shopName}`;
  }, [branding.shopName]);

  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState('');

  const phonesLabel = formatShopPhones(branding.phone1, branding.phone2);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Invalid username or password.');
        return;
      }
      toast.success(`Welcome to ${branding.shopName}`);
      router.push('/');
      router.refresh();
    } catch {
      setError('Unable to reach the local server. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col justify-between bg-slate-50 px-4 py-8 sm:px-6">
      <div className="mx-auto w-full max-w-md my-auto space-y-6">
        {/* Dynamic Shop Branding Header */}
        <div className="flex flex-col items-center text-center space-y-3">
          <BrandMark
            shopName={branding.shopName}
            logoDataUrl={branding.logoDataUrl}
            size="xl"
            className="shadow-sm"
          />
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              {branding.shopName}
            </h1>
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-slate-500">
              {branding.address && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 text-slate-400" />
                  {branding.address}
                </span>
              )}
              {phonesLabel && (
                <span className="inline-flex items-center gap-1 font-mono">
                  <Phone className="h-3.5 w-3.5 text-slate-400" />
                  {phonesLabel}
                </span>
              )}
            </div>
          </div>
        </div>

        <Card className="border-slate-200/90 shadow-sm">
          <CardHeader className="space-y-1 pb-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-blue-600" />
              <CardTitle className="text-base">Admin Sign In</CardTitle>
            </div>
            <CardDescription>
              Sign in to access {branding.shopName} inventory, sales invoices, and financial reports.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700"
                >
                  {error}
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="login-username">Username</Label>
                <div className="relative">
                  <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="login-username"
                    name="username"
                    autoComplete="username"
                    placeholder="Enter admin username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="pl-9"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="login-password">Password</Label>
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="login-password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    placeholder="Enter password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-9"
                    required
                  />
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    Sign In to {branding.shopName}
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </form>

            <div className="mt-4 border-t border-slate-100 pt-3 text-center text-xs text-slate-500">
              Local Admin Portal
            </div>
          </CardContent>
        </Card>
      </div>

      <footer className="mt-8 text-center text-xs text-slate-400">
        {branding.shopName} Management System
      </footer>
    </div>
  );
}
