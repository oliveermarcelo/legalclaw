'use client';
import { usePathname } from 'next/navigation';
import {
  BookOpenText,
  Bot,
  Clock3,
  FileText,
  FilePenLine,
  LayoutDashboard,
  Link2,
  LogOut,
  MessageCircle,
  Newspaper,
  Scale,
  ShieldCheck,
  Target,
} from 'lucide-react';
import { getUser, logout } from '@/lib/api';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/contratos', label: 'Contratos', icon: FileText },
  { href: '/prazos', label: 'Prazos', icon: Clock3 },
  { href: '/diarios', label: 'Diarios', icon: Newspaper },
  { href: '/conhecimento', label: 'Conhecimento', icon: BookOpenText },
  { href: '/fluxos', label: 'Fluxos Juridicos', icon: FilePenLine },
  { href: '/consultas-externas', label: 'Processos', icon: Link2 },
  { href: '/prospeccao', label: 'Prospecção', icon: Target },
  { href: '/dashboard/chat', label: 'Assistente IA', icon: Bot },
  { href: '/whatsapp', label: 'WhatsApp', icon: MessageCircle },
];

export default function Sidebar() {
  const pathname = usePathname();
  const user = getUser();

  return (
    <aside className="w-72 min-h-screen flex flex-col border-r border-white/10 bg-gradient-to-b from-surface-950 via-[#0d1230] to-[#070b1c]">
      <div className="px-5 pt-6 pb-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-brand-600/95 shadow-lg shadow-brand-900/35 flex items-center justify-center">
            <Scale className="h-5 w-5 text-white" strokeWidth={2.2} />
          </div>
          <div>
            <h1 className="font-display text-3xl leading-none text-white">Dr. Lex</h1>
            <p className="text-[11px] mt-1 uppercase tracking-[0.14em] text-brand-200/85">Suite Juridica</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-4 py-6 space-y-2.5">
        {NAV_ITEMS.map((item) => {
          const isExact = pathname === item.href;
          const isNested = pathname.startsWith(`${item.href}/`);
          const hasMoreSpecificActive = NAV_ITEMS.some((other) => {
            if (other.href === item.href) return false;
            if (!other.href.startsWith(`${item.href}/`)) return false;
            return pathname === other.href || pathname.startsWith(`${other.href}/`);
          });
          const active = isExact || (isNested && !hasMoreSpecificActive);
          const Icon = item.icon;

          return (
            <a
              key={item.href}
              href={item.href}
              className={[
                'group flex items-center gap-3 rounded-2xl px-3 py-3 transition-all duration-200',
                active
                  ? 'bg-gradient-to-r from-brand-700/40 to-brand-500/20 border border-brand-300/30 shadow-lg shadow-brand-900/20'
                  : 'border border-transparent hover:border-white/10 hover:bg-white/5',
              ].join(' ')}
            >
              <span
                className={[
                  'h-9 w-9 rounded-xl flex items-center justify-center transition-colors',
                  active ? 'bg-brand-500/30 text-brand-100' : 'bg-white/5 text-surface-300 group-hover:text-white',
                ].join(' ')}
              >
                <Icon className="h-4 w-4" strokeWidth={2.3} />
              </span>
              <span className={active ? 'text-white font-semibold text-sm' : 'text-surface-200 text-sm'}>
                {item.label}
              </span>
            </a>
          );
        })}
      </nav>

      <div className="px-4 pb-4 pt-3 border-t border-white/10">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-brand-700 flex items-center justify-center text-white text-sm font-semibold">
              {user?.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate">{user?.name || 'Usuario'}</p>
              <div className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-brand-200">
                <ShieldCheck className="h-3 w-3" strokeWidth={2.2} />
                <span>{user?.plan || 'solo'}</span>
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={logout}
          className="w-full mt-2 rounded-xl px-3 py-2.5 text-sm text-surface-200 hover:text-white hover:bg-white/10 transition-colors flex items-center gap-2"
        >
          <LogOut className="h-4 w-4" strokeWidth={2.2} />
          <span>Sair</span>
        </button>
      </div>
    </aside>
  );
}
