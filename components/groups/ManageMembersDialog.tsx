'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { toast } from 'sonner';
import { User } from 'firebase/auth';
import InviteCodeDisplay from './InviteCodeDisplay';

const generateInviteCode = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

interface MemberData {
  name: string;
  role: 'viewer' | 'editor';
}

interface GroupMembersProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  group: any;
  currentUser: User;
}

export default function ManageMembersDialog({ 
  isOpen, 
  onOpenChange, 
  group, 
  currentUser 
}: GroupMembersProps) {
  const [members, setMembers] = useState<{[uid: string]: MemberData}>({});
  const [isAdmin, setIsAdmin] = useState(false);
  const [isEditor, setIsEditor] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  useEffect(() => {
    if (isOpen && group) {
      setMembers(group.members || {});
      setIsAdmin(currentUser.uid === group.adminUid);
      setIsEditor(group.members?.[currentUser.uid]?.role === 'editor' || currentUser.uid === group.adminUid);
    }
  }, [isOpen, group, currentUser]);

  const handleRoleChange = (uid: string, newRole: 'viewer' | 'editor') => {
    if (!isAdmin) return;
    setMembers(prev => ({
      ...prev,
      [uid]: {
        ...prev[uid],
        role: newRole
      }
    }));
  };

  const handleSaveChanges = async () => {
    if (!isAdmin || !group) return;
    
    setIsSubmitting(true);
    try {
      const groupRef = doc(db, 'groups', group.id);
      await updateDoc(groupRef, {
        members: members
      });
      toast.success('Member roles updated successfully');
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating member roles:', error);
      toast.error('Failed to update member roles');
    } finally {
      setIsSubmitting(false);
    }
  };

  const regenerateInviteCode = async () => {
    if (!isAdmin || !group) return;
    
    const newCode = generateInviteCode();
    
    try {
      const groupRef = doc(db, 'groups', group.id);
      await updateDoc(groupRef, {
        inviteCode: newCode
      });
      // Update local state to reflect the new code
      group.inviteCode = newCode;
      toast.success('Invite code regenerated successfully');
      
      // Force refresh the page
      window.location.reload();
      
      return;
    } catch (error) {
      console.error('Error regenerating invite code:', error);
      toast.error('Failed to regenerate invite code');
      throw error;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>Manage Group</DialogTitle>
          <DialogDescription>
            {isAdmin 
              ? "Manage members and their roles for" 
              : "View members of"} &quot;{group?.name}&quot;
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4 space-y-6">
          {/* Invite Code Display */}
          {group && isEditor && (
            <InviteCodeDisplay 
              groupName={group.name}
              inviteCode={group.inviteCode}
              onRegenerateCode={regenerateInviteCode}
              isAdmin={isAdmin}
            />
          )}
          
          {/* Members List */}
          <div>
            <h3 className="font-medium mb-2">Members</h3>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {Object.entries(members).map(([uid, memberData]) => (
                <div key={uid} className="flex items-center justify-between p-2 border rounded">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>{memberData.name?.charAt(0)?.toUpperCase() || '?'}</AvatarFallback>
                    </Avatar>
                    <span>{memberData.name}</span>
                    {uid === group?.adminUid && <span className="ml-1 text-xs text-muted-foreground">(Admin)</span>}
                  </div>
                  
                  {isAdmin && uid !== group?.adminUid && (
                    <Select
                      value={memberData.role}
                      onValueChange={(value) => handleRoleChange(uid, value as 'viewer' | 'editor')}
                      disabled={!isAdmin}
                    >
                      <SelectTrigger className="w-[110px]">
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="viewer">Viewer</SelectItem>
                        <SelectItem value="editor">Editor</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
        
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Close</Button>
          </DialogClose>
          {isAdmin && (
            <Button 
              onClick={handleSaveChanges}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
