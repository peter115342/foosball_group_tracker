'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { doc, collection, query, where, getDocs, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { User } from 'firebase/auth';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface JoinGroupFormProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  user: User;
}

export default function JoinGroupForm({ isOpen, onOpenChange, user }: JoinGroupFormProps) {
  const [inviteCode, setInviteCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const router = useRouter();

  const handleJoinGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim()) {
      toast.error('Please enter an invite code');
      return;
    }

    setIsJoining(true);
    try {
      const groupsRef = collection(db, 'groups');
      const q = query(groupsRef, where('inviteCode', '==', inviteCode.trim()));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        toast.error('Invalid invite code. Please check and try again.');
        return;
      }

      const groupDoc = querySnapshot.docs[0];
      const groupData = groupDoc.data();
      
      if (groupData.members && groupData.members[user.uid]) {
        toast.info('You are already a member of this group');
        router.push(`/group/${groupDoc.id}`);
        return;
      }
      
      await updateDoc(doc(db, 'groups', groupDoc.id), {
        [`members.${user.uid}`]: {
          name: user.displayName || 'User',
          role: 'viewer'
        }
      });
      
      toast.success(`You've successfully joined the group: ${groupData.name}`);
      onOpenChange(false);
      router.push(`/group/${groupDoc.id}`);
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
      <DialogContent className="sm:max-w-[425px]">
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
            <Button type="submit" disabled={isJoining}>
              {isJoining ? 'Joining...' : 'Join Group'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}


