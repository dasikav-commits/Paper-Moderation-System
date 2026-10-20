'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/Sidebar';
import { Menu } from 'lucide-react';

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, authHydrated } = useAuth();
  const router = useRouter();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (authHydrated && !user) {
      router.push('/login');
    }
  }, [authHydrated, user, router]);

  if (!authHydrated || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      <header className="md:hidden bg-gray-900 text-white px-4 py-3 flex items-center justify-between border-b border-gray-800 sticky top-0 z-30 shadow-md">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 rounded-lg text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
            aria-label="Open Navigation Menu"
          >
            <Menu className="w-6 h-6" />
          </button>
          <img src="/logo.png" alt="Wayamba Logo" className="w-7 h-7 object-contain rounded" />
          <span className="font-bold text-sm text-white">Paper Moderation</span>
        </div>
        <span className="text-xs text-blue-400 font-semibold uppercase bg-blue-950/60 px-2.5 py-1 rounded-full border border-blue-800/50">
          {user.department?.includes('Computing')
            ? 'CIS'
            : user.department?.includes('Electronics')
            ? 'EL'
            : user.department?.includes('Industrial')
            ? 'IM'
            : 'MS'}
        </span>
      </header>

      <Sidebar
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
      />

      <main className="flex-1 min-w-0 overflow-y-auto">{children}</main>
    </div>
  );
}
