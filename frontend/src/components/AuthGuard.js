'use client';
import { useEffect, useState } from 'react';
import { isAuthenticated } from '@/lib/api';

export default function AuthGuard({ children }) {
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) {
      window.location.href = '/login';
    } else {
      setChecked(true);
    }
  }, []);

  if (!checked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-50">
        <div className="animate-pulse text-brand-600 font-display text-2xl">Dr. Lex</div>
      </div>
    );
  }

  return children;
}
