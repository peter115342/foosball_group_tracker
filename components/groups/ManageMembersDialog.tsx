'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { v4 as uuidv4 } from 'uuid';
import { Trash2, UserPlus, X } from 'lucide-react';

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

interface GuestData {
  id: string;
  name: string;
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
  const [guests, setGuests] = useState<GuestData[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isEditor, setIsEditor] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [guestNameInput, setGuestNameInput] = useState('');

  useEffect(() => {
    if (isOpen && group) {
      setMembers(group.members || {});
      setGuests(Array.isArray(group.guests) ? group.guests : []);
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

  const handleAddGuest = () => {
    const trimmedName = guestNameInput.trim();
    if (trimmedName) {
      if (guests.length >= 50) {
        toast.error("Guest limit reached", { 
          description: "A group can have a maximum of 50 guest players." 
        });
        return;
      }

      const existingGuest = guests.find(guest => guest.name.toLowerCase() === trimmedName.toLowerCase());

      if (!existingGuest) {
        const guestId = uuidv4();
        setGuests([...guests, { id: guestId, name: trimmedName }]);
        setGuestNameInput('');
      } else {
        toast.warning("Guest with this name already exists.");
      }
    }
  };

  const handleRemoveGuest = (guestIdToRemove: string) => {
    setGuests(guests.filter(guest => guest.id !== guestIdToRemove));
  };

  const handleRemoveMember = (uidToRemove: string) => {
    if (!isAdmin || uidToRemove === group?.adminUid) return;
    
    const updatedMembers = { ...members };
    delete updatedMembers[uidToRemove];
    setMembers(updatedMembers);
  };

  const handleSaveChanges = async () => {
    if (!isEditor || !group) return;
    
    if (guests.length > 50) {
      toast.error("Guest limit exceeded", { 
        description: "A group can have a maximum of 50 guest players." 
      });
      return;
    }
    
    setIsSubmitting(true);
    try {
      const groupRef = doc(db, 'groups', group.id);
      await updateDoc(groupRef, {
        members: members,
        guests: guests
      });
      toast.success('Group updated successfully');
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating group:', error);
      toast.error('Failed to update group');
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
      group.inviteCode = newCode;
      toast.success('Invite code regenerated successfully');
      
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
              : isEditor
                ? "Manage guests and view members of"
                : "View members of"} &quot;{group?.name}&quot;
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4 space-y-6">
          {group && isEditor && (
            <InviteCodeDisplay 
              groupName={group.name}
              inviteCode={group.inviteCode}
              onRegenerateCode={regenerateInviteCode}
              isAdmin={isAdmin}
            />
          )}
          
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
                  
                  <div className="flex items-center gap-2">
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
                    
                    {isAdmin && uid !== group?.adminUid && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveMember(uid)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-medium">Guest Players</h3>
              <span className="text-xs text-muted-foreground">{guests.length}/50</span>
            </div>
            
            {isEditor && (
              <div className="flex gap-2 mb-3">
                <Input
                  placeholder="Add guest name"
                  value={guestNameInput}
                  onChange={(e) => setGuestNameInput(e.target.value)}
                  disabled={isSubmitting}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddGuest();
                    }
                  }}
                />
                <Button
                  type="button"
                  onClick={handleAddGuest}
                  disabled={!guestNameInput.trim() || isSubmitting}
                >
                  <UserPlus className="h-4 w-4" />
                </Button>
              </div>
            )}
            
            {guests.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {guests.map(guest => (
                  <div key={guest.id} className="flex items-center bg-muted text-muted-foreground px-2 py-1 rounded-md text-sm">
                    {guest.name}
                    {isEditor && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="p-0 h-auto ml-1"
                        onClick={() => handleRemoveGuest(guest.id)}
                        disabled={isSubmitting}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No guest players added yet.</p>
            )}
          </div>
        </div>
        
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Close</Button>
          </DialogClose>
          {isEditor && (
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
