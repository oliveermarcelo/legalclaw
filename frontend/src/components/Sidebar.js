'use client';
import { usePathname } from 'next/navigation';
import { logout, getUser } from '@/lib/api';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: '📊' },
  { href: '/contratos', label: 'Contratos', icon: '📋' },
  { href: '/prazos', label: 'Prazos', icon: '⏰' },
  { href: '/diarios', label: 'Diários', icon: '📰' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const user = getUser();

  return (
    <aside className="w-64 bg-surface-950 min-h-screen flex flex-col border-r border-white/5">
      {/* Logo */}
      <div className="px-6 py-6 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-brand-600 rounded-xl flex items-center justify-center">
            <span className="text-white font-display text-lg">⚖</span>
          </div>
          <div>
            <h1 className="font-display text-xl text-white leading-tight">Dr. Lex</h1>
            <p className="text-surface-300 text-[11px] tracking-wider uppercase">Assistente Jurídico</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-1">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <a
              key={item.href}
              href={item.href}
              className={`sidebar-link ${active ? 'sidebar-link-active' : ''}`}
            >
              <span className="text-lg">{item.icon}</span>
              <span>{item.label}</span>
            </a>
          );
        })}
      </nav>

      {/* User */}
      <div className="px-4 py-4 border-t border-white/5">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-9 h-9 rounded-full bg-brand-700 flex items-center justify-center text-white text-sm font-semibold">
            {user?.name?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate">{user?.name || 'Usuário'}</p>
            <p className="text-surface-300 text-xs truncate">{user?.plan || 'solo'}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="w-full mt-2 text-left px-3 py-2 text-surface-300 hover:text-red-400 text-sm transition-colors rounded-lg hover:bg-white/5"
        >
          ↩ Sair
        </button>
      </div>
    </aside>
  );
}
