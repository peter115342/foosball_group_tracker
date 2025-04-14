'use client';

import Link from 'next/link';
import { useAuth } from '@/context/authContext';
import { Button } from '@/components/ui/button';

export default function Navbar() {
  const { user, logout } = useAuth();

  return (
    <nav className="border-b bg-background sticky top-0 z-50">
      <div className="container mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
        <Link href={user ? "/dashboard" : "/"} className="text-lg font-semibold">
          Foosball Group Tracker
        </Link>
        <div>
          {user && (
            <Button variant="outline" size="sm" onClick={logout}>
              Logout
            </Button>
          )}
          {/* Add other nav items here if needed in the future */}
        </div>
      </div>
    </nav>
  );
}
