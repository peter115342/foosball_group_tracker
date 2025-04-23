'use client';

import { usePathname } from 'next/navigation';

export default function AppFooter() {
  const pathname = usePathname();
  const isLandingPage = pathname === '/';

  // Don't render anything if we're on the landing page
  if (isLandingPage) {
    return null;
  }

  return (
    <footer className="static md:fixed bottom-0 left-0 w-full h-14 bg-[#468f49] border-t border-white/30 backdrop-blur-md z-20 text-white shadow-[0_-2px_10px_rgba(0,0,0,0.2)]">
      <div className="h-full max-w-7xl mx-auto px-4 flex items-center justify-between">
        <span className="text-xs text-white/90">© 2025 peter115342</span>
        <div className="flex items-center gap-4">
          <a 
            href="https://github.com/peter115342/foosball_group_tracker/issues" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="flex items-center hover:text-white/75 transition-colors text-white font-medium text-sm"
          >
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              width="14" 
              height="14" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              className="mr-1"
            >
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            Report Issues
          </a>
        </div>
      </div>
    </footer>
  );
}
