'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/context/authContext';
import { Button } from '@/components/ui/button';
import { useEffect, useState } from 'react';
import { MoonIcon, SunIcon, LogOutIcon, MenuIcon } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { 
  Drawer, 
  DrawerContent, 
  DrawerHeader, 
  DrawerTitle,
  DrawerTrigger,
  DrawerFooter,
  DrawerClose 
} from "@/components/ui/drawer";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function Navbar() {
  const { user, logout } = useAuth();
  const [isDarkMode, setIsDarkMode] = useState(false);
  const pathname = usePathname();
  const isLandingPage = pathname === '/';

  useEffect(() => {
    const isDark = document.documentElement.classList.contains('dark');
    setIsDarkMode(isDark);
  }, []);

  const toggleDarkMode = () => {
    document.documentElement.classList.toggle('dark');
    setIsDarkMode(!isDarkMode);
  };
  
  const userDisplayName = user?.displayName || user?.email?.split('@')[0] || 'User';
  const userEmail = user?.email || '';
  
  const getInitials = () => {
    if (user?.displayName) {
      return user.displayName
        .split(' ')
        .map(name => name[0])
        .join('')
        .toUpperCase()
        .substring(0, 2);
    }
    return userDisplayName.substring(0, 2).toUpperCase();
  };

  return (
    <nav className="border-navbar border-b bg-[#468f49] sticky top-0 z-50">
      <div className="container mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center">
          {!isLandingPage && (
            <a 
              href="https://github.com/peter115342/foosball_group_tracker" 
              target="_blank" 
              rel="noopener noreferrer"
              className="hidden md:flex items-center hover:opacity-80 transition-opacity"
              aria-label="GitHub Repository"
            >
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                width="24" 
                height="24" 
                viewBox="0 0 24 24" 
                fill="#d9eedc"
              >
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
            </a>
          )}
          
          <Link href={user ? "/dashboard" : "/"} className="relative group ml-2 md:ml-8">
            <div className="absolute inset-0 bg-green-50/90 rounded-lg -skew-x-6 transform transition-all duration-300 group-hover:skew-x-0"></div>
            <div className="absolute inset-0 border-2 border-navbar rounded-lg -skew-x-6 transform transition-all duration-300 group-hover:skew-x-0"></div>
            <div className="relative flex items-center gap-3 px-3 py-1 text-black font-semibold text-2xl">
            <Image 
              src="/images/logo_trans.png" 
              alt="Foosballek Logo" 
              width={96}
              height={96}
              quality={100}
              className="h-12 w-auto"
            />
            </div>
          </Link>
        </div>
        
        <div className="flex items-center gap-3">
          {/* User info for desktop */}
          {user && !isLandingPage && (
            <div className="hidden md:flex items-center gap-2 text-white bg-black/20 rounded-md px-3 py-1">
              <Avatar className="h-8 w-8 border border-white/30">
                <AvatarImage src={user.photoURL || ""} />
                <AvatarFallback className="bg-green-700 text-white text-xs">
                  {getInitials()}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <span className="text-sm font-medium">{userDisplayName}</span>
                <span className="text-xs opacity-75">{userEmail}</span>
              </div>
            </div>
          )}
          
          {/* Desktop Dark Mode + Logout */}
          {!isLandingPage && (
            <>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleDarkMode}
                aria-label="Toggle dark mode"
                className="hidden md:flex h-10 w-10 text-navbar bg-white/10 hover:bg-white/20 hover:text-white rounded-md"
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
                  className="hidden md:flex h-10 w-10 bg-black text-white hover:bg-black/80 hover:text-white rounded-md"
                >
                  <LogOutIcon className="h-6 w-6" />
                </Button>
              )}
            </>
          )}
          
          {/* Mobile Drawer */}
          {user && !isLandingPage && (
            <Drawer>
              <DrawerTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="md:hidden h-10 w-10 bg-white/10 hover:bg-white/20 text-white rounded-md"
                >
                  <MenuIcon className="h-6 w-6" />
                </Button>
              </DrawerTrigger>
              <DrawerContent className="px-4">
                <DrawerHeader>
                  <DrawerTitle className="text-center">User Profile</DrawerTitle>
                </DrawerHeader>
                
                <div className="flex flex-col items-center gap-4 py-6">
                  <Avatar className="h-20 w-20 border-2">
                    <AvatarImage src={user.photoURL || ""} />
                    <AvatarFallback className="bg-green-700 text-white text-lg">
                      {getInitials()}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="text-center">
                    <h3 className="font-semibold text-lg">{userDisplayName}</h3>
                    <p className="text-muted-foreground">{userEmail}</p>
                  </div>
                  
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-sm">Dark Mode</span>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={toggleDarkMode}
                      aria-label="Toggle dark mode"
                      className="h-9 w-9"
                    >
                      {isDarkMode ? (
                        <SunIcon className="h-5 w-5" />
                      ) : (
                        <MoonIcon className="h-5 w-5" />
                      )}
                    </Button>
                  </div>
                </div>
                
                <DrawerFooter className="pt-2">
                  <Button 
                    onClick={logout} 
                    variant="destructive" 
                    className="gap-2"
                  >
                    <LogOutIcon className="h-4 w-4" />
                    Logout
                  </Button>
                  <DrawerClose asChild>
                    <Button variant="outline">Close</Button>
                  </DrawerClose>
                </DrawerFooter>
              </DrawerContent>
            </Drawer>
          )}
        </div>
      </div>
    </nav>
  );
}
