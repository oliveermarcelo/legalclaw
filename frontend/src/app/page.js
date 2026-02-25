'use client';
import { useEffect } from 'react';
import { isAuthenticated } from '@/lib/api';

export default function Home() {
  useEffect(() => {
    if (isAuthenticated()) {
      window.location.href = '/dashboard';
    } else {
      window.location.href = '/login';
    }
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-950">
      <div className="animate-pulse text-brand-400 font-display text-2xl">Dr. Lex</div>
    </div>
  );
}
