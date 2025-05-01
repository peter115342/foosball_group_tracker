'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { User } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase/config';
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function JoinGroupForm({ isOpen, onOpenChange, user }: JoinGroupFormProps) {
  const [inviteCode, setInviteCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const router = useRouter();
  
  const joinGroupFunction = httpsCallable(functions, 'join_group_fn');

  const handleJoinGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim()) {
      toast.error('Please enter an invite code');
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
            <div className="grid grid-cols-4 items-center gap-4">
              <Input
                id="inviteCode"
                placeholder="Enter invite code"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                className="col-span-4"
                required
                disabled={isJoining}
              />
            </div>
          </div>
          
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isJoining}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isJoining}>
              {isJoining ? 'Joining...' : 'Join Group'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
