'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Boxes,
  Download,
  ExternalLink,
  FileText,
  HardDriveUpload,
  KeyRound,
  RefreshCw,
  Save,
  Store,
  Trash2,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner';
import { AppShell } from '@/components/layout/AppShell';
import { BrandMark } from '@/components/branding/BrandMark';
import { useBranding } from '@/components/branding/BrandingProvider';
import { DEFAULT_SHOP_BRANDING, slugifyShopName } from '@/lib/branding';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type SettingsTabKey = 'shop' | 'invoice' | 'inventory' | 'security' | 'backup' | 'updates';

const VALID_TABS: SettingsTabKey[] = ['shop', 'invoice', 'inventory', 'security', 'backup', 'updates'];

interface ShopSettingsData {
  shopName: string;
  address: string;
  phone1: string;
  phone2: string;
  logoDataUrl: string | null;
  invoicePrefix: string;
  purchasePrefix: string;
  invoiceFooter: string;
  warrantyTerms: string;
  showWarrantyOnInvoice: boolean;
  defaultMinStock: number;
  lowStockAlertsEnabled: boolean;
  backupDirectory: string;
}

function SettingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setBranding } = useBranding();
  const tabParam = searchParams.get('tab') as SettingsTabKey | null;
  const activeTab: SettingsTabKey =
    tabParam && VALID_TABS.includes(tabParam) ? tabParam : 'shop';

  const [loading, setLoading] = React.useState(true);
  const [savingShop, setSavingShop] = React.useState(false);
  const [savingPassword, setSavingPassword] = React.useState(false);

  // Shop settings state
  const [form, setForm] = React.useState<ShopSettingsData>({
    shopName: DEFAULT_SHOP_BRANDING.shopName,
    address: DEFAULT_SHOP_BRANDING.address,
    phone1: DEFAULT_SHOP_BRANDING.phone1,
    phone2: DEFAULT_SHOP_BRANDING.phone2,
    logoDataUrl: DEFAULT_SHOP_BRANDING.logoDataUrl,
    invoicePrefix: DEFAULT_SHOP_BRANDING.invoicePrefix,
    purchasePrefix: DEFAULT_SHOP_BRANDING.purchasePrefix,
    invoiceFooter: DEFAULT_SHOP_BRANDING.invoiceFooter,
    warrantyTerms: DEFAULT_SHOP_BRANDING.warrantyTerms,
    showWarrantyOnInvoice: DEFAULT_SHOP_BRANDING.showWarrantyOnInvoice,
    defaultMinStock: 3,
    lowStockAlertsEnabled: true,
    backupDirectory: '',
  });

  // Admin password change state
  const [username, setUsername] = React.useState('admin');
  const [currentPassword, setCurrentPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');

  // Backup & Restore state
  const [downloadingBackup, setDownloadingBackup] = React.useState(false);
  const [restoreFile, setRestoreFile] = React.useState<File | null>(null);
  const [restoreConfirmOpen, setRestoreConfirmOpen] = React.useState(false);
  const [restoring, setRestoring] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((data) => {
        if (data.settings) {
          setForm({
            shopName: data.settings.shopName || 'Tayyab Enterprises',
            address: data.settings.address || '',
            phone1: data.settings.phone1 || '',
            phone2: data.settings.phone2 || '',
            logoDataUrl: data.settings.logoDataUrl || null,
            invoicePrefix: data.settings.invoicePrefix || 'TE-INV-',
            purchasePrefix: data.settings.purchasePrefix || 'TE-PUR-',
            invoiceFooter: data.settings.invoiceFooter || '',
            warrantyTerms: data.settings.warrantyTerms || '',
            showWarrantyOnInvoice: Boolean(data.settings.showWarrantyOnInvoice),
            defaultMinStock: Number(data.settings.defaultMinStock ?? 3),
            lowStockAlertsEnabled: Boolean(data.settings.lowStockAlertsEnabled),
            backupDirectory: data.settings.backupDirectory || '',
          });
        }
        if (data.admin?.username) {
          setUsername(data.admin.username);
        }
      })
      .catch(() => toast.error('Could not load settings.'))
      .finally(() => setLoading(false));
  }, []);

  // -------- Application updates (desktop only) --------
  type UpdatePhase =
    | 'idle'
    | 'checking'
    | 'available'
    | 'downloading'
    | 'downloaded'
    | 'not-available'
    | 'error';
  const [desktopVersion, setDesktopVersion] = React.useState<string | null>(null);
  const [updatePhase, setUpdatePhase] = React.useState<UpdatePhase>('idle');
  const [updateDetail, setUpdateDetail] = React.useState<{ version?: string; percent?: number; message?: string }>({});
  const isDesktop = typeof window !== 'undefined' && Boolean(window.electronAPI?.isDesktop);

  React.useEffect(() => {
    if (!window.electronAPI?.isDesktop) return;
    window.electronAPI
      .getDesktopInfo()
      .then((info) => setDesktopVersion(info.version))
      .catch(() => {});
    const unsubscribe = window.electronAPI.onUpdateStatus((status) => {
      switch (status.state) {
        case 'checking':
          setUpdatePhase('checking');
          break;
        case 'available':
          setUpdatePhase('available');
          setUpdateDetail({ version: status.version });
          break;
        case 'downloading':
          setUpdatePhase('downloading');
          setUpdateDetail({ percent: status.percent });
          break;
        case 'downloaded':
          setUpdatePhase('downloaded');
          setUpdateDetail({ version: status.version });
          break;
        case 'not-available':
          setUpdatePhase('not-available');
          break;
        case 'error':
          setUpdatePhase('error');
          setUpdateDetail({ message: status.message });
          break;
      }
    });
    return () => unsubscribe();
  }, []);

  async function handleCheckForUpdates() {
    if (!window.electronAPI?.isDesktop) return;
    setUpdatePhase('checking');
    const result = await window.electronAPI.checkForUpdates();
    if (!result.supported) {
      setUpdatePhase('error');
      setUpdateDetail({ message: result.error || 'Updates only run in the packaged desktop app.' });
    } else if (result.error) {
      setUpdatePhase('error');
      setUpdateDetail({ message: result.error });
    }
  }

  async function handleDownloadUpdate() {
    if (!window.electronAPI?.isDesktop) return;
    const result = await window.electronAPI.downloadUpdate();
    if (!result.ok) toast.error(result.error || 'Download failed. Check your internet connection.');
  }

  function handleInstallUpdate() {
    window.electronAPI?.installUpdate();
  }

  function handleTabChange(nextTab: string) {
    if (VALID_TABS.includes(nextTab as SettingsTabKey)) {
      router.replace(`/settings?tab=${nextTab}`, { scroll: false });
    }
  }

  function handleLogoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1024 * 1024) {
      toast.error('Logo image must be smaller than 1 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setForm((prev) => ({ ...prev, logoDataUrl: reader.result as string }));
      }
    };
    reader.readAsDataURL(file);
  }

  async function handleSaveShopSettings(e: React.FormEvent) {
    e.preventDefault();
    setSavingShop(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || 'Failed to save settings.');
        return;
      }
      setBranding(json);
      router.refresh();
      toast.success('Settings saved and branding updated.');
    } catch {
      toast.error('Network error saving settings.');
    } finally {
      setSavingShop(false);
    }
  }

  async function handleUpdatePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('New password and confirmation do not match.');
      return;
    }
    setSavingPassword(true);
    try {
      const res = await fetch('/api/settings/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          currentPassword,
          newPassword,
          confirmPassword,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || 'Failed to update credentials.');
        return;
      }
      toast.success('Admin username & password updated.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch {
      toast.error('Network error updating credentials.');
    } finally {
      setSavingPassword(false);
    }
  }

  async function handleBackupDownload() {
    setDownloadingBackup(true);
    try {
      const res = await fetch('/api/backup');
      if (!res.ok) throw new Error('Backup failed');
      const blob = await res.blob();
      const stamp = new Date().toISOString().slice(0, 10);
      const filename = `${slugifyShopName(form.shopName)}-backup-${stamp}.db`;

      if (window.electronAPI?.saveBackupToDisk) {
        const buffer = await blob.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i += 1) {
          binary += String.fromCharCode(bytes[i]);
        }
        const saved = await window.electronAPI.saveBackupToDisk(filename, btoa(binary));
        if (!saved.canceled) {
          toast.success(`Database backup saved to ${saved.filePath}`);
        }
        return;
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success('Database backup downloaded.');
    } catch {
      toast.error('Could not generate database backup.');
    } finally {
      setDownloadingBackup(false);
    }
  }

  async function handleRestoreDatabase() {
    if (!restoreFile) return;
    setRestoring(true);
    try {
      const formData = new FormData();
      formData.append('backupFile', restoreFile);
      formData.append('confirmed', 'true');
      const res = await fetch('/api/backup', {
        method: 'POST',
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || 'Database restore failed.');
        return;
      }
      toast.success(json.message || 'Database restored successfully.');
      setRestoreConfirmOpen(false);
      setRestoreFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch {
      toast.error('Network error restoring database.');
    } finally {
      setRestoring(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
        Loading shop settings...
      </div>
    );
  }

  return (
    <>
      <div className="mx-auto max-w-5xl space-y-5">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 tracking-tight">
            Shop Settings, Security &amp; Backup
          </h1>
          <p className="text-sm text-slate-500">
            Configure shop branding, invoice prefixes &amp; warranty terms, inventory alerts, admin security, and database backups.
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-5">
          <TabsList aria-label="Settings sections">
            <TabsTrigger value="shop">
              <Store className="h-3.5 w-3.5" />
              Shop &amp; Branding
            </TabsTrigger>
            <TabsTrigger value="invoice">
              <FileText className="h-3.5 w-3.5" />
              Invoice &amp; Warranty
            </TabsTrigger>
            <TabsTrigger value="inventory">
              <Boxes className="h-3.5 w-3.5" />
              Inventory &amp; Alerts
            </TabsTrigger>
            <TabsTrigger value="security">
              <KeyRound className="h-3.5 w-3.5" />
              Admin Security
            </TabsTrigger>
            <TabsTrigger value="backup">
              <HardDriveUpload className="h-3.5 w-3.5" />
              Backup &amp; Restore
            </TabsTrigger>
            <TabsTrigger value="updates">
              <RefreshCw className="h-3.5 w-3.5" />
              Updates
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: Shop & Branding */}
          <TabsContent value="shop">
            <form onSubmit={handleSaveShopSettings}>
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Store className="h-4 w-4 text-blue-600" />
                    <CardTitle>Shop Profile &amp; Branding</CardTitle>
                  </div>
                  <CardDescription>
                    Displayed live on the Sidebar, Header, Dashboard, Login screen, A4 Invoices, and exported reports.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="shop-name">Shop Name</Label>
                    <Input
                      id="shop-name"
                      value={form.shopName}
                      onChange={(e) => setForm({ ...form, shopName: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="shop-address">Shop Address</Label>
                    <Input
                      id="shop-address"
                      value={form.address}
                      onChange={(e) => setForm({ ...form, address: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="shop-phone1">Primary Contact Number</Label>
                    <Input
                      id="shop-phone1"
                      value={form.phone1}
                      onChange={(e) => setForm({ ...form, phone1: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="shop-phone2">Secondary Contact Number</Label>
                    <Input
                      id="shop-phone2"
                      value={form.phone2}
                      onChange={(e) => setForm({ ...form, phone2: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label>Shop Logo (Shown on Sidebar, Dashboard, Login &amp; A4 Invoices)</Label>
                    <div className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-slate-50/50 p-3">
                      <BrandMark
                        shopName={form.shopName}
                        logoDataUrl={form.logoDataUrl}
                        size="xl"
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
                          <Upload className="h-3.5 w-3.5" />
                          Upload Logo
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            className="hidden"
                            onChange={handleLogoSelect}
                          />
                        </label>
                        {form.logoDataUrl && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setForm({ ...form, logoDataUrl: null })}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-red-600" />
                            Remove Logo
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="md:col-span-2 flex justify-end pt-2">
                    <Button type="submit" disabled={savingShop}>
                      <Save className="h-4 w-4" />
                      {savingShop ? 'Saving...' : 'Save Shop Profile'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </form>
          </TabsContent>

          {/* Tab 2: Invoice & Warranty */}
          <TabsContent value="invoice">
            <form onSubmit={handleSaveShopSettings}>
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-blue-600" />
                    <CardTitle>Invoice Numbering &amp; Warranty Terms</CardTitle>
                  </div>
                  <CardDescription>
                    Customize automatic invoice/purchase prefixes, footer remarks, and default warranty policies.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="invoice-prefix">Invoice Number Prefix</Label>
                    <Input
                      id="invoice-prefix"
                      value={form.invoicePrefix}
                      onChange={(e) => setForm({ ...form, invoicePrefix: e.target.value })}
                      className="font-mono"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="purchase-prefix">Purchase Number Prefix</Label>
                    <Input
                      id="purchase-prefix"
                      value={form.purchasePrefix}
                      onChange={(e) => setForm({ ...form, purchasePrefix: e.target.value })}
                      className="font-mono"
                      required
                    />
                  </div>

                  <div className="space-y-1.5 md:col-span-2">
                    <Label htmlFor="warranty-terms">Default Warranty Terms</Label>
                    <Textarea
                      id="warranty-terms"
                      rows={3}
                      value={form.warrantyTerms}
                      onChange={(e) => setForm({ ...form, warrantyTerms: e.target.value })}
                    />
                  </div>

                  <div className="space-y-1.5 md:col-span-2">
                    <Label htmlFor="invoice-footer">A4 Invoice Footer Note</Label>
                    <Input
                      id="invoice-footer"
                      value={form.invoiceFooter}
                      onChange={(e) => setForm({ ...form, invoiceFooter: e.target.value })}
                    />
                  </div>

                  <div className="md:col-span-2 pt-1">
                    <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.showWarrantyOnInvoice}
                        onChange={(e) =>
                          setForm({ ...form, showWarrantyOnInvoice: e.target.checked })
                        }
                        className="h-4 w-4 rounded border-slate-300 text-blue-600"
                      />
                      Print warranty terms on A4 invoices
                    </label>
                  </div>

                  <div className="md:col-span-2 flex justify-end pt-2">
                    <Button type="submit" disabled={savingShop}>
                      <Save className="h-4 w-4" />
                      {savingShop ? 'Saving...' : 'Save Invoice & Warranty Settings'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </form>
          </TabsContent>

          {/* Tab 3: Inventory & Alerts */}
          <TabsContent value="inventory">
            <form onSubmit={handleSaveShopSettings}>
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Boxes className="h-4 w-4 text-blue-600" />
                    <CardTitle>Inventory Thresholds &amp; Backup Preferences</CardTitle>
                  </div>
                  <CardDescription>
                    Control low-stock dashboard alerts, default minimum stock levels, and preferred backup directory.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="default-min-stock">Default Low Stock Threshold</Label>
                    <Input
                      id="default-min-stock"
                      type="number"
                      min={0}
                      value={form.defaultMinStock}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          defaultMinStock: Math.max(0, Number(e.target.value) || 0),
                        })
                      }
                      className="tabular-nums"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="backup-dir">Preferred Backup Folder Path (Optional)</Label>
                    <Input
                      id="backup-dir"
                      value={form.backupDirectory}
                      onChange={(e) => setForm({ ...form, backupDirectory: e.target.value })}
                      placeholder="e.g. D:\TayyabBackups"
                    />
                  </div>

                  <div className="md:col-span-2 pt-1">
                    <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.lowStockAlertsEnabled}
                        onChange={(e) =>
                          setForm({ ...form, lowStockAlertsEnabled: e.target.checked })
                        }
                        className="h-4 w-4 rounded border-slate-300 text-blue-600"
                      />
                      Enable low stock alerts on Dashboard
                    </label>
                  </div>

                  <div className="md:col-span-2 flex justify-end pt-2">
                    <Button type="submit" disabled={savingShop}>
                      <Save className="h-4 w-4" />
                      {savingShop ? 'Saving...' : 'Save Inventory Settings'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </form>
          </TabsContent>

          {/* Tab 4: Admin Security */}
          <TabsContent value="security">
            <form onSubmit={handleUpdatePassword}>
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <KeyRound className="h-4 w-4 text-blue-600" />
                    <CardTitle>Admin Account Security</CardTitle>
                  </div>
                  <CardDescription>
                    Update the single-admin username and login password used to access {form.shopName}.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="admin-username">Admin Username</Label>
                    <Input
                      id="admin-username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="current-password">Current Password</Label>
                    <Input
                      id="current-password"
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="new-password">New Password (min 6 chars)</Label>
                    <Input
                      id="new-password"
                      type="password"
                      minLength={6}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="confirm-password">Confirm New Password</Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      minLength={6}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                    />
                  </div>
                  <div className="md:col-span-2 flex flex-wrap items-center justify-between gap-3 pt-2">
                    <Button type="button" variant="outline" asChild>
                      <Link href="/login">
                        <ExternalLink className="h-4 w-4" />
                        Open Branded Login Page
                      </Link>
                    </Button>
                    <Button type="submit" disabled={savingPassword}>
                      <KeyRound className="h-4 w-4" />
                      {savingPassword ? 'Updating...' : 'Update Admin Credentials'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </form>
          </TabsContent>

          {/* Tab 5: Backup & Restore */}
          <TabsContent value="backup">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <HardDriveUpload className="h-4 w-4 text-blue-600" />
                  <CardTitle>Manual Database Backup &amp; Restore</CardTitle>
                </div>
                <CardDescription>
                  Create an offline SQLite backup file (.db) or restore from a previously validated backup.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">Backup Now</h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Checkpoints the SQLite WAL log and downloads a complete standalone database snapshot.
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={handleBackupDownload}
                    disabled={downloadingBackup}
                  >
                    <Download className="h-4 w-4" />
                    {downloadingBackup ? 'Preparing Backup...' : 'Backup Now (.db)'}
                  </Button>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">Restore Database</h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Select a valid {form.shopName} SQLite (.db) backup file. Existing data will be backed up locally before restoring.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      ref={fileInputRef}
                      type="file"
                      accept=".db,.sqlite,.sqlite3"
                      onChange={(e) => setRestoreFile(e.target.files?.[0] || null)}
                      className="max-w-xs bg-white text-xs"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      disabled={!restoreFile}
                      onClick={() => setRestoreConfirmOpen(true)}
                    >
                      Restore Backup
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 6: Application Updates */}
          <TabsContent value="updates">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 text-blue-600" />
                  <CardTitle>Application Updates</CardTitle>
                </div>
                <CardDescription>
                  Keep the application current. Updates ship from GitHub Releases and never overwrite your shop data.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                  <div>
                    <p className="text-xs text-slate-500">Installed version</p>
                    <p className="text-lg font-semibold tabular-nums text-slate-900">
                      v{desktopVersion ?? 'browser / dev'}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!isDesktop || updatePhase === 'checking' || updatePhase === 'downloading'}
                    onClick={handleCheckForUpdates}
                  >
                    <RefreshCw className={`mr-2 h-4 w-4 ${updatePhase === 'checking' ? 'animate-spin' : ''}`} />
                    {updatePhase === 'checking' ? 'Checking…' : 'Check for Updates'}
                  </Button>
                </div>

                {updatePhase === 'available' && (
                  <div className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
                    <p className="text-sm font-medium text-blue-900">
                      Version {updateDetail.version} is available.
                    </p>
                    <Button type="button" onClick={handleDownloadUpdate}>
                      Download Update
                    </Button>
                  </div>
                )}

                {updatePhase === 'downloading' && (
                  <div className="space-y-2 rounded-lg border border-slate-200 px-4 py-3">
                    <p className="text-xs font-medium text-slate-600">
                      Downloading update… {updateDetail.percent ?? 0}%
                    </p>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-blue-600 transition-all duration-300"
                        style={{ width: `${updateDetail.percent ?? 0}%` }}
                      />
                    </div>
                  </div>
                )}

                {updatePhase === 'downloaded' && (
                  <div className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 px-4 py-3">
                    <p className="text-sm font-medium text-green-900">
                      Version {updateDetail.version} downloaded. Restart to install.
                    </p>
                    <Button type="button" onClick={handleInstallUpdate}>
                      Install &amp; Restart
                    </Button>
                  </div>
                )}

                {updatePhase === 'not-available' && (
                  <p className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-800">
                    You are running the latest version.
                  </p>
                )}

                {updatePhase === 'error' && (
                  <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                    {updateDetail.message || 'Could not check for updates. Check your internet connection.'}
                  </p>
                )}

                <p className="text-xs leading-5 text-slate-400">
                  {isDesktop
                    ? 'Updates are delivered silently in the background from GitHub Releases (beingadil/Laptop-Accessories-Shop). Installing an update never deletes or overwrites the shop database — it lives in the application data folder and is preserved across versions.'
                    : 'This screen works in the packaged desktop app. Running the web dev server, updates are not checked.'}
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <ConfirmDialog
        open={restoreConfirmOpen}
        onOpenChange={setRestoreConfirmOpen}
        title="Confirm Database Restore"
        description={
          restoreFile
            ? `Restoring "${restoreFile.name}" will replace the current live shop database. This cannot be undone easily. Continue?`
            : ''
        }
        confirmLabel="Yes, Overwrite & Restore"
        loading={restoring}
        onConfirm={handleRestoreDatabase}
      />
    </>
  );
}

export default function SettingsPage() {
  return (
    <AppShell pageTitle="Settings & Backup">
      <React.Suspense
        fallback={
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
            Loading shop settings...
          </div>
        }
      >
        <SettingsContent />
      </React.Suspense>
    </AppShell>
  );
}
