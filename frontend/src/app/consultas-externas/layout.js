import AuthGuard from '@/components/AuthGuard';
import Sidebar from '@/components/Sidebar';

export default function DashboardLayout({ children }) {
  return (
    <AuthGuard>
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="relative flex-1 overflow-auto bg-gradient-to-b from-surface-50 via-white to-surface-100">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_8%,rgba(66,99,235,.08),transparent_26%),radial-gradient(circle_at_88%_15%,rgba(250,176,5,.08),transparent_22%)]" />
          <div className="relative max-w-7xl mx-auto px-8 py-8">{children}</div>
        </main>
      </div>
    </AuthGuard>
  );
}

