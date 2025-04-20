'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/context/authContext';
import { Button } from '@/components/ui/button';
import { useEffect, useState } from 'react';
import { MoonIcon, SunIcon, LogOutIcon } from 'lucide-react';

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
        <Link href={user ? "/dashboard" : "/"} className="relative group">
          <div className="absolute inset-0 bg-white rounded-lg -skew-x-6 transform transition-all duration-300 group-hover:skew-x-0"></div>
          <div className="absolute inset-0 border-2 border-navbar rounded-lg -skew-x-6 transform transition-all duration-300 group-hover:skew-x-0"></div>
          <div className="relative flex items-center gap-3 px-3 py-1 text-black font-semibold text-2xl">
            <Image 
              src="/images/logo_trans.png" 
              alt="Foosballek Logo" 
              width={44} 
              height={44} 
              className="h-11 w-auto"
            />
            Foosballek
          </div>
        </Link>
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleDarkMode}
            aria-label="Toggle dark mode"
            className="h-10 w-10 text-navbar bg-white/10 hover:bg-white/20 hover:text-white rounded-md"
          >
            {isDarkMode ? (
              <SunIcon className="h-6 w-6" />
            ) : (
              <MoonIcon className="h-6 w-6" />
            )}
          </Button>
          {user && (
            <Button
              variant="ghost"
              size="icon"
              onClick={logout}
              aria-label="Logout"
              className="h-10 w-10 bg-black text-white hover:bg-black/80 hover:text-white rounded-md"
            >
              <LogOutIcon className="h-6 w-6" />
            </Button>
          )}
        </div>
      </div>
    </nav>
  );
}
