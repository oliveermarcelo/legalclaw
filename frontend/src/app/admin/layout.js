'use client';
import { useEffect } from 'react';
import { getUser } from '@/lib/api';

export default function AdminLayout({ children }) {
  useEffect(() => {
    const user = getUser();
    if (!user?.is_super_admin) {
      window.location.href = '/dashboard';
    }
  }, []);

  return <>{children}</>;
}
