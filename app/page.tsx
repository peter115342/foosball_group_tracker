'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/authContext";
import { Skeleton } from "@/components/ui/skeleton";

export default function LoginPage() {
  const { user, loading, signInWithGoogle } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.push('/dashboard');
    }
  }, [user, loading, router]);


  if (loading || user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-8">
        <Skeleton className="h-10 w-40" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-between min-h-screen p-8">
      <div className="flex flex-col items-center justify-center flex-grow gap-8">
        <h1 className="text-3xl font-semibold">Foosballek</h1>
        <p>Track scores and stats for your foosball group.</p>
        <Button onClick={signInWithGoogle} size="lg">
          <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="#FFFFFF" className="mr-2"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/><path d="M1 1h22v22H1z" fill="none"/></svg>
          Sign in with Google
        </Button>
      </div>
      
      <footer className="w-full mt-8 py-4 border-t text-center">
        <div className="flex flex-col items-center space-y-4 px-4 max-w-md mx-auto">
          <a 
            href="https://github.com/peter115342/foosball_group_tracker" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="flex items-center justify-center hover:text-gray-600 transition-colors"
          >
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              width="20" 
              height="20" 
              viewBox="0 0 24 24" 
              fill="currentColor" 
              className="mr-1 text-purple-600"
            >
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
            </svg>
            GitHub
          </a>
          <a 
            href="https://revolut.me/username" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="flex items-center justify-center hover:text-gray-600 transition-colors"
          >
            <svg 
              width="20" 
              height="22" 
              viewBox="0 0 34 56" 
              xmlns="http://www.w3.org/2000/svg" 
              fill="currentColor" 
              className="mr-1 text-[#4b50e0] transform translate-y-0.5"
            >
              <g>
                <path d="M8.1,10.7H0v32.8h8.1V10.7z"></path>
                <path d="M33.6,12.6c0-7-5.7-12.6-12.6-12.6H0v7h19.9c3.2,0,5.8,2.5,5.8,5.5c0,1.5-0.5,3-1.6,4.1c-1.1,1.1-2.5,1.7-4,1.7h-7.8 c-0.3,0-0.5,0.2-0.5,0.5V25c0,0.1,0,0.2,0.1,0.3l13.2,18.3h9.6L21.6,25.2C28.2,24.9,33.6,19.3,33.6,12.6z"></path>
              </g>
            </svg>
            Support me
          </a>
          <div className="text-sm text-gray-500">
            To contact, <a href="https://github.com/peter115342/foosball_group_tracker/issues" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">create an issue</a> on GitHub.
          </div>
          <div className="text-sm text-gray-500">
            © 2025 Peter115342.
          </div>
        </div>
      </footer>
    </div>
  );
}
