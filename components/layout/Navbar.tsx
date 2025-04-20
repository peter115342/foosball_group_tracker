'use client';

import Link from 'next/link';
import { useAuth } from '@/context/authContext';
import { Button } from '@/components/ui/button';
import { useEffect, useState } from 'react';
import { MoonIcon, SunIcon } from 'lucide-react';

export default function Navbar() {
  const { user, logout } = useAuth();
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    const isDark = document.documentElement.classList.contains('dark');
    setIsDarkMode(isDark);
  }, []);

  const toggleDarkMode = () => {
    document.documentElement.classList.toggle('dark');
    setIsDarkMode(!isDarkMode);
  };

  return (
    <nav className="border-navbar border-b bg-navbar sticky top-0 z-50">
      <div className="container mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
        <Link href={user ? "/dashboard" : "/"} className="text-navbar text-lg font-semibold">
          Foosballek
        </Link>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleDarkMode}
            aria-label="Toggle dark mode"
            className="text-navbar hover:bg-white/20 hover:text-white"
          >
            {isDarkMode ? (
              <SunIcon className="h-5 w-5" />
            ) : (
              <MoonIcon className="h-5 w-5" />
            )}
          </Button>
          {user && (
            <Button
              // Removed variant="outline"
              size="sm"
              onClick={logout}
              // Explicitly set background, text, border, and hover states
              // Added 'border' class to ensure a border is present
              className="bg-black text-white border border-black hover:bg-black/80 hover:text-white font-medium"
            >
              Logout
            </Button>
          )}
        </div>
      </div>
    </nav>
  );
}
