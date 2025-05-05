'use client';

import { Button } from '@/components/ui/button';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Download, ChevronDown } from 'lucide-react';
import { useState } from 'react';

interface ExportButtonProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  matches: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  groupStats: any;
  groupName: string;
}

export default function ExportButton({ matches, groupStats, groupName }: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);
  
  const sanitizeFileName = (name: string) => {
    return name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
  };
  
  const exportStats = () => {
    setIsExporting(true);
    try {
      const data = {
        groupStats,
        exportDate: new Date().toISOString()
      };
      
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${sanitizeFileName(groupName)}_stats_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting stats data:', error);
    } finally {
      setIsExporting(false);
    }
  };
  
  const exportMatches = () => {
    setIsExporting(true);
    try {
      const data = {
        matches,
        exportDate: new Date().toISOString()
      };
      
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${sanitizeFileName(groupName)}_matches_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting matches data:', error);
    } finally {
      setIsExporting(false);
    }
  };
  
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={isExporting || (!groupStats && matches.length === 0)}>
        <Button variant="outline" size="sm" className="flex items-center">
          <Download className="mr-2 h-4 w-4" />
          Export
          <ChevronDown className="ml-2 h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem 
          onClick={exportStats}
          disabled={!groupStats || isExporting}
          className="cursor-pointer"
        >
          Export Statistics
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={exportMatches}
          disabled={matches.length === 0 || isExporting}
          className="cursor-pointer"
        >
          Export Matches
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
