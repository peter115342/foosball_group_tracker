'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Copy } from 'lucide-react';
import { toast } from 'sonner';

interface InviteCodeDisplayProps {
  groupName: string;
  inviteCode: string;
  onRegenerateCode?: () => Promise<void>;
  isAdmin: boolean;
}

export default function InviteCodeDisplay({ 
  groupName, 
  inviteCode, 
  onRegenerateCode,
  isAdmin
}: InviteCodeDisplayProps) {
  const [isCopying, setIsCopying] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);

  const copyToClipboard = async () => {
    setIsCopying(true);
    try {
      await navigator.clipboard.writeText(inviteCode);
      toast.success('Invite code copied to clipboard');
    } catch (error) {
      toast.error('Failed to copy to clipboard');
      console.error('Copy failed:', error);
    } finally {
      setIsCopying(false);
    }
  };

  const handleRegenerateCode = async () => {
    if (!onRegenerateCode) return;
    setIsRegenerating(true);
    try {
      await onRegenerateCode();
      toast.success('Invite code regenerated successfully');
    } catch (error) {
      toast.error('Failed to regenerate invite code');
      console.error('Regenerate failed:', error);
    } finally {
      setIsRegenerating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invitation Code</CardTitle>
        <CardDescription>
          Share this code with people you want to invite to &quot;{groupName}&quot;
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col space-y-4">
          <div className="space-y-2">
            <Label htmlFor="invite-code">Invite Code</Label>
            <div className="flex gap-2">
              <Input
                id="invite-code"
                value={inviteCode}
                readOnly
                className="font-mono text-center"
              />
              <Button 
                variant="outline" 
                size="icon" 
                onClick={copyToClipboard}
                disabled={isCopying}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
      {isAdmin && onRegenerateCode && (
        <CardFooter>
          <Button 
            variant="outline" 
            onClick={handleRegenerateCode}
            disabled={isRegenerating}
            className="ml-auto"
          >
            {isRegenerating ? 'Regenerating...' : 'Generate New Code'}
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
