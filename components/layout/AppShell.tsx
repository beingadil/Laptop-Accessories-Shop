'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  LayoutDashboard,
  Laptop,
  Boxes,
  Receipt,
  ShoppingBag,
  RotateCcw,
  BarChart3,
  Settings,
  Search,
  Menu,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronDown,
  ChevronRight,
  Loader2,
  ArrowUpRight,
  Hash,
  Users,
  Truck,
  Wallet,
  CreditCard,
  ShieldCheck,
  FolderTree,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { formatPKR } from '@/lib/format';
import { BrandMark } from '@/components/branding/BrandMark';
import { useBranding } from '@/components/branding/BrandingProvider';

interface SubNavItem {
  label: string;
  href: string;
  matchPrefix?: string;
}

interface MasterNavGroup {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  items: SubNavItem[];
}

const MASTER_NAV_GROUPS: MasterNavGroup[] = [
  {
    id: 'catalog',
    label: 'Products & Catalog',
    icon: Laptop,
    items: [
      { label: 'All Products', href: '/products', matchPrefix: '/products' },
      { label: 'Add New Product', href: '/products/new' },
      { label: 'Categories', href: '/categories' },
    ],
  },
  {
    id: 'inventory',
    label: 'Inventory & Stock',
    icon: Boxes,
    items: [
      { label: 'Stock Overview', href: '/inventory' },
      { label: 'Opening Stock', href: '/inventory/opening-stock' },
      { label: 'Stock Adjustments', href: '/inventory/adjustments' },
    ],
  },
  {
    id: 'sales',
    label: 'Sales & Customers',
    icon: Receipt,
    items: [
      { label: 'Sales Invoices', href: '/sales', matchPrefix: '/sales' },
      { label: 'New Sale Invoice', href: '/sales/new' },
      { label: 'Customers', href: '/customers', matchPrefix: '/customers' },
      { label: 'Add Customer', href: '/customers/new' },
    ],
  },
  {
    id: 'returns',
    label: 'Returns & Warranty',
    icon: RotateCcw,
    items: [
      { label: 'Returns & Exchanges', href: '/returns' },
      { label: 'Process Return', href: '/returns/new' },
      { label: 'Process Exchange', href: '/returns/exchange' },
      { label: 'Warranty Tracker', href: '/warranty' },
    ],
  },
  {
    id: 'purchasing',
    label: 'Purchases & Suppliers',
    icon: ShoppingBag,
    items: [
      { label: 'Purchase Bills', href: '/purchases', matchPrefix: '/purchases' },
      { label: 'New Purchase', href: '/purchases/new' },
      { label: 'Suppliers', href: '/suppliers', matchPrefix: '/suppliers' },
      { label: 'Add Supplier', href: '/suppliers/new' },
      { label: 'Supplier Payments', href: '/supplier-payments', matchPrefix: '/supplier-payments' },
      { label: 'Record Payment', href: '/supplier-payments/new' },
    ],
  },
  {
    id: 'finance',
    label: 'Expenses & Reports',
    icon: BarChart3,
    items: [
      { label: 'Shop Expenses', href: '/expenses', matchPrefix: '/expenses' },
      { label: 'Add Expense', href: '/expenses/new' },
      { label: 'Business Reports', href: '/reports' },
    ],
  },
  {
    id: 'settings',
    label: 'Settings & Backup',
    icon: Settings,
    items: [
      { label: 'Shop & Branding', href: '/settings?tab=shop' },
      { label: 'Invoice & Warranty', href: '/settings?tab=invoice' },
      { label: 'Inventory & Alerts', href: '/settings?tab=inventory' },
      { label: 'Admin Security', href: '/settings?tab=security' },
      { label: 'Backup & Restore', href: '/settings?tab=backup' },
    ],
  },
];

const QUICK_MODULE_ROUTES: Array<{ label: string; category: string; href: string; keywords: string }> = [
  { label: 'Dashboard', category: 'Module', href: '/', keywords: 'home overview profit kpi' },
  { label: 'Products Catalog', category: 'Module', href: '/products', keywords: 'laptop chromebook sku items' },
  { label: 'Add New Product', category: 'Action', href: '/products/new', keywords: 'create product item' },
  { label: 'Product Categories', category: 'Module', href: '/categories', keywords: 'category groups' },
  { label: 'Inventory & Serial Stock', category: 'Module', href: '/inventory', keywords: 'stock warehouse serials' },
  { label: 'Record Opening Stock', category: 'Action', href: '/inventory/opening-stock', keywords: 'opening balance stock' },
  { label: 'Stock Adjustments', category: 'Action', href: '/inventory/adjustments', keywords: 'damaged lost audit adjustment' },
  { label: 'Sales Invoices', category: 'Module', href: '/sales', keywords: 'bills receipts invoices revenue' },
  { label: 'New Sale Invoice', category: 'Action', href: '/sales/new', keywords: 'pos billing sell invoice' },
  { label: 'Customers Directory', category: 'Module', href: '/customers', keywords: 'clients buyers' },
  { label: 'Purchases & Stock Intake', category: 'Module', href: '/purchases', keywords: 'buying bills stock in' },
  { label: 'New Stock Purchase', category: 'Action', href: '/purchases/new', keywords: 'create purchase bill' },
  { label: 'Suppliers Directory', category: 'Module', href: '/suppliers', keywords: 'vendors distributors' },
  { label: 'Supplier Payments', category: 'Module', href: '/supplier-payments', keywords: 'payables ledger cash paid' },
  { label: 'Shop Expenses', category: 'Module', href: '/expenses', keywords: 'rent utility bills overhead' },
  { label: 'Returns & Exchanges', category: 'Module', href: '/returns', keywords: 'refund swap defective' },
  { label: 'Process Return', category: 'Action', href: '/returns/new', keywords: 'refund item' },
  { label: 'Process Exchange', category: 'Action', href: '/returns/exchange', keywords: 'replace swap laptop' },
  { label: 'Warranty Tracker', category: 'Module', href: '/warranty', keywords: 'warranty expiry checking' },
  { label: 'Business Reports', category: 'Module', href: '/reports', keywords: 'analytics profit loss valuation excel pdf' },
  { label: 'Shop Settings & Backup', category: 'Module', href: '/settings?tab=shop', keywords: 'logo password backup restore' },
];

interface SearchResults {
  products: Array<{ id: string; name: string; sku: string; currentStock: number; sellingPrice: number }>;
  serials: Array<{ id: string; serialNumber: string; stockStatus: string; product: { id: string; name: string } }>;
  sales: Array<{ id: string; invoiceNumber: string; totalAmount: number; walkInCustomerName: string | null; customer: { name: string } | null }>;
  purchases: Array<{ id: string; purchaseNumber: string; totalAmount: number; supplier: { name: string } }>;
  customers: Array<{ id: string; name: string; phone: string }>;
  suppliers: Array<{ id: string; name: string; phone: string; outstandingBalance: number }>;
  supplierPayments: Array<{ id: string; amount: number; referenceNumber: string | null; supplier: { name: string } }>;
  expenses: Array<{ id: string; title: string; amount: number; category: { name: string } }>;
  returns: Array<{ id: string; returnNumber: string; type: string; originalSaleId: string; originalSale: { invoiceNumber: string } }>;
  warranties: Array<{ id: string; status: string; product: { name: string }; serializedItem: { serialNumber: string } | null; sale: { id: string; invoiceNumber: string } }>;
  categories: Array<{ id: string; name: string; defaultInventoryType: string; _count: { products: number } }>;
}

function isSubItemActive(item: SubNavItem, pathname: string, currentTab: string | null): boolean {
  if (item.href.startsWith('/settings?tab=')) {
    if (pathname !== '/settings') return false;
    const itemTab = item.href.split('tab=')[1];
    return (currentTab || 'shop') === itemTab;
  }

  if (pathname === item.href) return true;

  if (item.matchPrefix && pathname.startsWith(`${item.matchPrefix}/`)) {
    // Avoid highlighting list item when user is explicitly on the /new sibling route
    if (pathname === `${item.matchPrefix}/new`) return false;
    return true;
  }

  return false;
}

function getActiveGroupId(pathname: string): string | null {
  if (pathname === '/') return null;
  for (const group of MASTER_NAV_GROUPS) {
    if (
      group.items.some((it) => {
        const baseHref = it.href.split('?')[0];
        return pathname === baseHref || pathname.startsWith(`${baseHref}/`);
      })
    ) {
      return group.id;
    }
  }
  return null;
}

function getActiveHeaderContext(
  pageTitle: string | undefined,
  pathname: string,
  shopName: string
) {
  if (pathname === '/') {
    return {
      label: pageTitle || 'Dashboard',
      parentLabel: shopName,
      icon: LayoutDashboard,
    };
  }
  for (const group of MASTER_NAV_GROUPS) {
    for (const item of group.items) {
      const base = item.href.split('?')[0];
      if (pathname === base || pathname.startsWith(`${base}/`)) {
        return {
          label: pageTitle || item.label,
          parentLabel: group.label,
          icon: group.icon,
        };
      }
    }
  }
  return {
    label: pageTitle || shopName,
    parentLabel: shopName,
    icon: LayoutDashboard,
  };
}

function SidebarMasterNav({
  collapsed,
  pathname,
  onNavigate,
  onExpandSidebar,
}: {
  collapsed: boolean;
  pathname: string;
  onNavigate: () => void;
  onExpandSidebar: () => void;
}) {
  const searchParams = useSearchParams();
  const currentTab = searchParams.get('tab');
  const activeGroupId = getActiveGroupId(pathname);

  const [openGroups, setOpenGroups] = React.useState<Record<string, boolean>>({});

  function toggleGroup(groupId: string) {
    if (collapsed) {
      onExpandSidebar();
      setOpenGroups((prev) => ({ ...prev, [groupId]: true }));
      return;
    }
    setOpenGroups((prev) => {
      const currentOpen = prev[groupId] ?? groupId === activeGroupId;
      return { ...prev, [groupId]: !currentOpen };
    });
  }

  return (
    <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1" aria-label="Primary Sidebar">
      <Link
        href="/"
        onClick={onNavigate}
        title={collapsed ? 'Dashboard' : undefined}
        className={cn(
          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap',
          pathname === '/'
            ? 'bg-blue-50 text-blue-700'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
        )}
      >
        <LayoutDashboard
          className={cn('h-4 w-4 shrink-0', pathname === '/' ? 'text-blue-600' : 'text-slate-500')}
        />
        {!collapsed && <span className="truncate">Dashboard</span>}
      </Link>

      {MASTER_NAV_GROUPS.map((group) => {
        const Icon = group.icon;
        const isGroupActive = group.id === activeGroupId;
        const isExpanded = openGroups[group.id] ?? isGroupActive;

        return (
          <div key={group.id} className="space-y-0.5">
            <button
              type="button"
              onClick={() => toggleGroup(group.id)}
              aria-expanded={!collapsed && isExpanded}
              title={collapsed ? group.label : undefined}
              className={cn(
                'flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap',
                isGroupActive
                  ? 'bg-blue-50/70 text-blue-700'
                  : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
              )}
            >
              <span className="flex items-center gap-3 min-w-0">
                <Icon
                  className={cn(
                    'h-4 w-4 shrink-0',
                    isGroupActive ? 'text-blue-600' : 'text-slate-500'
                  )}
                />
                {!collapsed && <span className="truncate">{group.label}</span>}
              </span>
              {!collapsed &&
                (isExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                ))}
            </button>

            {!collapsed && isExpanded && (
              <div className="ml-4 space-y-0.5 border-l border-slate-200 pl-3 py-0.5">
                {group.items.map((sub) => {
                  const subActive = isSubItemActive(sub, pathname, currentTab);
                  return (
                    <Link
                      key={sub.href}
                      href={sub.href}
                      onClick={onNavigate}
                      className={cn(
                        'block rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap truncate',
                        subActive
                          ? 'bg-blue-50 text-blue-700'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      )}
                    >
                      {sub.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}

export function AppShell({
  pageTitle,
  children,
}: {
  pageTitle?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { branding } = useBranding();
  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [searchResults, setSearchResults] = React.useState<SearchResults | null>(null);
  const [searching, setSearching] = React.useState(false);
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(-1);
  const searchRef = React.useRef<HTMLDivElement>(null);
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    }
    function handleShortcut(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        if (searchQuery.trim().length >= 2) {
          setSearchOpen(true);
        }
      }
    }
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleShortcut);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleShortcut);
    };
  }, [searchQuery]);

  React.useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        });
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data);
          setActiveIndex(-1);
          setSearchOpen(true);
        }
      } catch {
        // Ignore abort
      } finally {
        if (!controller.signal.aborted) {
          setSearching(false);
        }
      }
    }, 180);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [searchQuery]);

  const activeHeaderContext = getActiveHeaderContext(pageTitle, pathname, branding.shopName);

  React.useEffect(() => {
    document.title = pageTitle
      ? `${pageTitle} — ${branding.shopName}`
      : `${branding.shopName} Management System`;
  }, [pageTitle, branding.shopName]);

  const matchedModules = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (q.length < 2) return [];
    return QUICK_MODULE_ROUTES.filter(
      (r) => r.label.toLowerCase().includes(q) || r.keywords.includes(q)
    ).slice(0, 5);
  }, [searchQuery]);

  const searchSections = React.useMemo(() => {
    type SectionItem = {
      key: string;
      href: string;
      primary: string;
      secondary: string;
      primaryMono?: boolean;
      secondaryTone?: 'default' | 'success';
    };
    type SectionGroup = {
      id: string;
      title: string;
      icon: React.ComponentType<{ className?: string }>;
      items: SectionItem[];
    };

    const sections: SectionGroup[] = [];

    if (matchedModules.length > 0) {
      sections.push({
        id: 'modules',
        title: 'Pages & Modules',
        icon: ArrowUpRight,
        items: matchedModules.map((mod) => ({
          key: `mod-${mod.href}`,
          href: mod.href,
          primary: mod.label,
          secondary: mod.category,
        })),
      });
    }

    if (searchResults) {
      if (searchResults.products.length > 0) {
        sections.push({
          id: 'products',
          title: 'Products',
          icon: Laptop,
          items: searchResults.products.map((p) => ({
            key: `prod-${p.id}`,
            href: `/products/${p.id}`,
            primary: p.name,
            secondary: `${p.sku} · Stock ${p.currentStock} · ${formatPKR(p.sellingPrice)}`,
          })),
        });
      }
      if (searchResults.serials.length > 0) {
        sections.push({
          id: 'serials',
          title: 'Serial Numbers',
          icon: Hash,
          items: searchResults.serials.map((s) => ({
            key: `ser-${s.id}`,
            href: `/products/${s.product.id}`,
            primary: s.serialNumber,
            primaryMono: true,
            secondary: `${s.product.name} · ${s.stockStatus}`,
          })),
        });
      }
      if (searchResults.sales.length > 0) {
        sections.push({
          id: 'sales',
          title: 'Sales Invoices',
          icon: Receipt,
          items: searchResults.sales.map((s) => ({
            key: `sale-${s.id}`,
            href: `/sales/${s.id}`,
            primary: s.invoiceNumber,
            primaryMono: true,
            secondary: `${s.customer?.name || s.walkInCustomerName || 'Walk-in'} · ${formatPKR(s.totalAmount)}`,
          })),
        });
      }
      if (searchResults.purchases.length > 0) {
        sections.push({
          id: 'purchases',
          title: 'Purchases',
          icon: ShoppingBag,
          items: searchResults.purchases.map((pur) => ({
            key: `pur-${pur.id}`,
            href: `/purchases/${pur.id}`,
            primary: pur.purchaseNumber,
            primaryMono: true,
            secondary: `${pur.supplier.name} · ${formatPKR(pur.totalAmount)}`,
          })),
        });
      }
      if (searchResults.customers.length > 0) {
        sections.push({
          id: 'customers',
          title: 'Customers',
          icon: Users,
          items: searchResults.customers.map((c) => ({
            key: `cust-${c.id}`,
            href: `/customers/${c.id}`,
            primary: c.name,
            secondary: c.phone,
          })),
        });
      }
      if (searchResults.suppliers.length > 0) {
        sections.push({
          id: 'suppliers',
          title: 'Suppliers',
          icon: Truck,
          items: searchResults.suppliers.map((sup) => ({
            key: `sup-${sup.id}`,
            href: `/suppliers/${sup.id}`,
            primary: sup.name,
            secondary: `${sup.phone} · Due ${formatPKR(sup.outstandingBalance)}`,
          })),
        });
      }
      if (searchResults.supplierPayments.length > 0) {
        sections.push({
          id: 'supplierPayments',
          title: 'Supplier Payments',
          icon: Wallet,
          items: searchResults.supplierPayments.map((pay) => ({
            key: `pay-${pay.id}`,
            href: `/supplier-payments/${pay.id}/edit`,
            primary: `${pay.supplier.name}${pay.referenceNumber ? ` (${pay.referenceNumber})` : ''}`,
            secondary: formatPKR(pay.amount),
            secondaryTone: 'success',
          })),
        });
      }
      if (searchResults.expenses.length > 0) {
        sections.push({
          id: 'expenses',
          title: 'Expenses',
          icon: CreditCard,
          items: searchResults.expenses.map((exp) => ({
            key: `exp-${exp.id}`,
            href: `/expenses/${exp.id}/edit`,
            primary: exp.title,
            secondary: `${exp.category.name} · ${formatPKR(exp.amount)}`,
          })),
        });
      }
      if (searchResults.returns.length > 0) {
        sections.push({
          id: 'returns',
          title: 'Returns & Exchanges',
          icon: RotateCcw,
          items: searchResults.returns.map((ret) => ({
            key: `ret-${ret.id}`,
            href: `/sales/${ret.originalSaleId}`,
            primary: ret.returnNumber,
            primaryMono: true,
            secondary: `${ret.type} · Inv ${ret.originalSale.invoiceNumber}`,
          })),
        });
      }
      if (searchResults.warranties.length > 0) {
        sections.push({
          id: 'warranties',
          title: 'Warranties',
          icon: ShieldCheck,
          items: searchResults.warranties.map((w) => ({
            key: `war-${w.id}`,
            href: `/sales/${w.sale.id}`,
            primary: `${w.product.name}${w.serializedItem ? ` (${w.serializedItem.serialNumber})` : ''}`,
            secondary: `${w.sale.invoiceNumber} · ${w.status}`,
          })),
        });
      }
      if (searchResults.categories.length > 0) {
        sections.push({
          id: 'categories',
          title: 'Categories',
          icon: FolderTree,
          items: searchResults.categories.map((cat) => ({
            key: `cat-${cat.id}`,
            href: '/categories',
            primary: cat.name,
            secondary: `${cat.defaultInventoryType} · ${cat._count.products} items`,
          })),
        });
      }
    }

    return sections;
  }, [matchedModules, searchResults]);

  const flatSearchItems = React.useMemo(
    () => searchSections.flatMap((s) => s.items),
    [searchSections]
  );

  const hasSearchMatches = flatSearchItems.length > 0;
  const ActiveHeaderIcon = activeHeaderContext.icon;

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      {/* Mobile Sidebar Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden no-print"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex flex-col border-r border-slate-200 bg-white transition-all duration-200 no-print lg:static',
          collapsed ? 'lg:w-[72px]' : 'lg:w-[258px]',
          mobileOpen ? 'translate-x-0 w-[258px]' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-slate-200 px-4">
          <Link href="/" className="flex items-center gap-2.5 min-w-0">
            <BrandMark
              shopName={branding.shopName}
              logoDataUrl={branding.logoDataUrl}
              size="md"
            />
            {!collapsed && (
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-slate-900 leading-tight">
                  {branding.shopName}
                </div>
                <div className="truncate text-[11px] text-slate-500">
                  {branding.address}
                </div>
              </div>
            )}
          </Link>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation menu"
            className="rounded-md p-1 text-slate-400 hover:text-slate-700 lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <React.Suspense fallback={<div className="flex-1 px-3 py-3" />}>
          <SidebarMasterNav
            collapsed={collapsed}
            pathname={pathname}
            onNavigate={() => setMobileOpen(false)}
            onExpandSidebar={() => setCollapsed(false)}
          />
        </React.Suspense>

        <div className="border-t border-slate-200 p-3 hidden lg:flex items-center justify-between">
          <button
            type="button"
            onClick={() => setCollapsed((prev) => !prev)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900"
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <>
                <PanelLeftClose className="h-4 w-4" />
                <span>Collapse Menu</span>
              </>
            )}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Top Header — Name & Global Search Only */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 md:grid md:grid-cols-[minmax(0,1fr)_minmax(260px,380px)_minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_minmax(320px,440px)_minmax(0,1fr)] xl:grid-cols-[minmax(0,1fr)_minmax(380px,560px)_minmax(0,1fr)] md:items-center md:gap-4 border-b border-slate-200/80 bg-white/90 backdrop-blur-md px-4 lg:px-6 shadow-[0_1px_2px_rgba(15,23,42,0.03)] no-print">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation menu"
              className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 lg:hidden"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div className="hidden sm:flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200/80 bg-slate-50 text-blue-600">
              <ActiveHeaderIcon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <span className="block text-[11px] font-medium leading-none text-slate-400 truncate">
                {activeHeaderContext.parentLabel}
              </span>
              <h2 className="mt-1 text-sm sm:text-[15px] font-semibold tracking-tight text-slate-900 leading-none whitespace-nowrap truncate">
                {activeHeaderContext.label}
              </h2>
            </div>
          </div>

          {/* Truly Global Search Bar */}
          <div ref={searchRef} className="group relative flex-1 min-w-0 md:col-start-2 md:flex-none md:w-full md:justify-self-center">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-blue-600" />
            <Input
              ref={searchInputRef}
              value={searchQuery}
              onChange={(e) => {
                const next = e.target.value;
                setSearchQuery(next);
                setActiveIndex(-1);
                if (next.trim().length < 2) {
                  setSearching(false);
                  setSearchResults(null);
                  setSearchOpen(false);
                } else {
                  setSearchOpen(true);
                }
              }}
              onFocus={() => {
                if (searchQuery.trim().length >= 2) setSearchOpen(true);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setSearchOpen(false);
                  searchInputRef.current?.blur();
                  return;
                }
                if (!searchOpen || flatSearchItems.length === 0) return;
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setActiveIndex((prev) => (prev + 1) % flatSearchItems.length);
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setActiveIndex((prev) =>
                    prev <= 0 ? flatSearchItems.length - 1 : prev - 1
                  );
                } else if (e.key === 'Enter' && activeIndex >= 0) {
                  e.preventDefault();
                  const target = flatSearchItems[activeIndex];
                  if (target) {
                    setSearchOpen(false);
                    router.push(target.href);
                  }
                }
              }}
              placeholder="Search products, serials, invoices, customers, pages..."
              aria-label="Global search"
              className="h-10 rounded-xl border-slate-200/90 bg-slate-50/90 pl-10 pr-16 text-sm transition-all hover:border-slate-300 hover:bg-slate-100/70 focus-visible:border-blue-500 focus-visible:bg-white focus-visible:ring-4 focus-visible:ring-blue-500/10"
            />
            {searching ? (
              <Loader2 className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-blue-600" />
            ) : searchQuery ? (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => {
                  setSearchQuery('');
                  setSearchResults(null);
                  setActiveIndex(-1);
                  setSearchOpen(false);
                  searchInputRef.current?.focus();
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:bg-slate-200/70 hover:text-slate-700"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : (
              <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 hidden sm:inline-flex items-center rounded-md border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[10px] font-medium text-slate-400 shadow-2xs">
                Ctrl K
              </kbd>
            )}

            {searchOpen && searchQuery.trim().length >= 2 && (
              <div className="absolute right-0 sm:inset-x-0 top-full z-50 mt-2 w-full min-w-[280px] rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10 overflow-hidden">
                {searching && !searchResults && matchedModules.length === 0 ? (
                  <p className="px-4 py-6 text-center text-xs text-slate-500">
                    Searching across all modules...
                  </p>
                ) : !hasSearchMatches ? (
                  <p className="px-4 py-6 text-center text-xs text-slate-500">
                    No matching records for &ldquo;{searchQuery}&rdquo;
                  </p>
                ) : (
                  <>
                    <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-3.5 py-2 text-[11px] font-medium text-slate-500">
                      <span>Global Results</span>
                      <span className="tabular-nums">{flatSearchItems.length} matches</span>
                    </div>
                    <div className="max-h-[400px] overflow-y-auto p-2 space-y-2.5 text-xs">
                      {(() => {
                        let runningIdx = 0;
                        return searchSections.map((section) => {
                          const SectionIcon = section.icon;
                          return (
                            <div key={section.id}>
                              <div className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold text-slate-400">
                                <SectionIcon className="h-3 w-3" />
                                <span>{section.title}</span>
                              </div>
                              <div className="space-y-0.5">
                                {section.items.map((item) => {
                                  const currentIdx = runningIdx;
                                  runningIdx += 1;
                                  const isHighlighted = currentIdx === activeIndex;
                                  return (
                                    <Link
                                      key={item.key}
                                      href={item.href}
                                      onClick={() => setSearchOpen(false)}
                                      onMouseEnter={() => setActiveIndex(currentIdx)}
                                      className={cn(
                                        'flex items-center justify-between gap-3 rounded-lg px-2.5 py-2 transition-colors',
                                        isHighlighted
                                          ? 'bg-blue-50 text-blue-900'
                                          : 'hover:bg-slate-50'
                                      )}
                                    >
                                      <span
                                        className={cn(
                                          'truncate font-medium',
                                          item.primaryMono && 'font-mono',
                                          section.id === 'modules' || section.id === 'serials'
                                            ? 'text-blue-700'
                                            : 'text-slate-800'
                                        )}
                                      >
                                        {item.primary}
                                      </span>
                                      <span
                                        className={cn(
                                          'font-mono shrink-0 tabular-nums',
                                          item.secondaryTone === 'success'
                                            ? 'text-emerald-700 font-medium'
                                            : 'text-slate-500'
                                        )}
                                      >
                                        {item.secondary}
                                      </span>
                                    </Link>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                    <div className="hidden sm:flex items-center justify-between border-t border-slate-100 bg-slate-50/70 px-3.5 py-1.5 text-[10px] text-slate-400">
                      <span>↑↓ Navigate · ↵ Open · Esc Close</span>
                      <span>All 11 modules indexed</span>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </header>

        {/* Page Main Content */}
        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
