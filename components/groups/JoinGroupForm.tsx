'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { User } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase/config';
import { cn } from "@/lib/utils";
import { AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";

interface JoinGroupFormProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  user: User;
}

const INVITE_CODE_REGEX = /^[A-Z0-9]{8}$/;

export default function JoinGroupForm({ isOpen, onOpenChange }: JoinGroupFormProps) {
  const [inviteCode, setInviteCode] = useState('');
  const [inviteCodeError, setInviteCodeError] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const router = useRouter();
  
  const joinGroupFunction = httpsCallable(functions, 'join_group_fn');

  const validateInviteCode = (code: string): string | null => {
    if (!code) return "Invite code is required";
    if (code.length !== 8) return "Invite code must be 8 characters";
    if (!INVITE_CODE_REGEX.test(code)) return "Invite code must be uppercase letters and numbers only";
    return null;
  };

  const handleInviteCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInviteCode(value);
    setInviteCodeError(validateInviteCode(value));
  };

  const handleJoinGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const error = validateInviteCode(inviteCode.trim());
    if (error) {
      setInviteCodeError(error);
      return;
    }

    setIsJoining(true);
    try {
      const result = await joinGroupFunction({ inviteCode: inviteCode.trim() });
      const data = result.data as { 
        success: boolean, 
        message: string, 
        groupId: string, 
        groupName: string,
        alreadyMember: boolean
      };
      
      if (data.success) {
        toast.success(data.message);
        onOpenChange(false);
        router.push(`/group/${data.groupId}`);
      }
    } catch (error) {
      console.error('Error joining group:', error);
      toast.error('Failed to join group');
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        setInviteCode('');
        setInviteCodeError(null);
      }
      onOpenChange(open);
    }}>
      <DialogContent className="sm:max-w-[425px]" hideCloseButton>
        <DialogHeader>
          <DialogTitle>Join a Group</DialogTitle>
          <DialogDescription>
            Enter an invite code to join an existing foosball group.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleJoinGroup}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-1 items-center gap-2">
              <Input
                id="inviteCode"
                placeholder="Enter invite code (e.g. ABC12345)"
                value={inviteCode}
                onChange={handleInviteCodeChange}
                className={cn(
                  inviteCodeError ? "border-red-500 focus-visible:ring-red-500" : ""
                )}
                required
                disabled={isJoining}
              />
              {inviteCodeError && (
                <div className="flex items-center mt-1 text-sm text-red-500">
                  <AlertCircle className="h-4 w-4 mr-1" />
                  <span>{inviteCodeError}</span>
                </div>
              )}
            </div>
          </div>
          
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isJoining}>
                Cancel
              </Button>
            </DialogClose>
            <Button 
              type="submit" 
              disabled={isJoining || !!inviteCodeError || !inviteCode}
            >
              {isJoining ? 'Joining...' : 'Join Group'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
