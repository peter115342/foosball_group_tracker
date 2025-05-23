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
import { Trash2, UserPlus, X, ArrowRight, AlertCircle } from 'lucide-react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase/config';
import { cn } from "@/lib/utils";

const GUEST_NAME_MAX_LENGTH = 20;
const ALPHANUMERIC_REGEX = /^[a-zA-Z0-9 ]+$/;

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
  const [savedGuests, setSavedGuests] = useState<GuestData[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isEditor, setIsEditor] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [guestNameInput, setGuestNameInput] = useState('');
  const [guestInputError, setGuestInputError] = useState<string | null>(null);
  
  const [selectedGuest, setSelectedGuest] = useState<string>('');
  const [selectedMember, setSelectedMember] = useState<string>('');
  const [isMigrating, setIsMigrating] = useState(false);

  useEffect(() => {
    if (isOpen && group) {
      setMembers(group.members || {});
      const loadedGuests = Array.isArray(group.guests) ? group.guests : [];
      setGuests(loadedGuests);
      setSavedGuests(loadedGuests);
      setIsAdmin(currentUser.uid === group.adminUid);
      setIsEditor(group.members?.[currentUser.uid]?.role === 'editor' || currentUser.uid === group.adminUid);
      setGuestInputError(null);
    }
  }, [isOpen, group, currentUser]);

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setMembers({});
      setGuests([]);
      setSavedGuests([]);
      setSelectedGuest('');
      setSelectedMember('');
      setGuestNameInput('');
      setGuestInputError(null);
      setIsMigrating(false);
      setIsSubmitting(false);
    }
    onOpenChange(open);
  };

  const validateGuestName = (name: string): string | null => {
    if (name.length === 0) return null;
    if (name.length > GUEST_NAME_MAX_LENGTH) 
      return `Name must be ${GUEST_NAME_MAX_LENGTH} characters or less`;
    if (!ALPHANUMERIC_REGEX.test(name)) 
      return "Name must contain only letters, numbers, and spaces";
    return null;
  };

  const handleGuestNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setGuestNameInput(value);
    setGuestInputError(validateGuestName(value));
  };

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
    if (!trimmedName) return;
    
    const error = validateGuestName(trimmedName);
    if (error) {
      setGuestInputError(error);
      return;
    }
    
    if (guests.length >= 50) {
      toast.warning("Guest limit reached", { 
        description: "A group can have a maximum of 50 guest players." 
      });
      return;
    }

    const existingGuest = guests.find(guest => guest.name.toLowerCase() === trimmedName.toLowerCase());

    if (!existingGuest) {
      const guestId = uuidv4();
      setGuests([...guests, { id: guestId, name: trimmedName }]);
      setGuestNameInput('');
      setGuestInputError(null);
    } else {
      toast.warning("Guest with this name already exists.");
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
    
    setIsSubmitting(true);
    try {
      const groupRef = doc(db, 'groups', group.id);
      await updateDoc(groupRef, {
        members: members,
        guests: guests
      });
      setSavedGuests([...guests]);
      toast.success('Group updated successfully');
      handleOpenChange(false);
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

  const handleMigrateGuest = async () => {
    if (!selectedGuest || !selectedMember || !isAdmin) {
      return;
    }

    setIsMigrating(true);
    try {
      const migrateGuestToMember = httpsCallable(functions, 'migrate_guest_to_member_fn');
      
      await migrateGuestToMember({
        groupId: group.id,
        guestId: selectedGuest,
        memberId: selectedMember
      });

      setGuests(guests.filter(guest => guest.id !== selectedGuest));
      setSavedGuests(savedGuests.filter(guest => guest.id !== selectedGuest));
      
      setSelectedGuest('');
      setSelectedMember('');
      
      toast.success('Guest successfully migrated to member');
    } catch (error) {
      console.error('Error migrating guest to member:', error);
      toast.error('Failed to migrate guest');
    } finally {
      setIsMigrating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[550px] overflow-hidden" hideCloseButton>
        <div className="dialog-scrollable custom-scrollbar">
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
              <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
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
              <h3 className="font-medium mb-2">Guest Players</h3>
              
              {isEditor && (
                <div className="flex gap-2 mb-3">
                  <div className="flex-1">
                    <Input
                      placeholder="Add guest name"
                      value={guestNameInput}
                      onChange={handleGuestNameChange}
                      className={cn(
                        guestInputError ? "border-red-500 focus-visible:ring-red-500" : ""
                      )}
                      disabled={isSubmitting}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddGuest();
                        }
                      }}
                    />
                    {guestInputError && (
                      <div className="flex items-center mt-1 text-sm text-red-500">
                        <AlertCircle className="h-4 w-4 mr-1" />
                        <span>{guestInputError}</span>
                      </div>
                    )}
                  </div>
                  <Button
                    type="button"
                    onClick={handleAddGuest}
                    disabled={!guestNameInput.trim() || !!guestInputError || isSubmitting}
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

            {isAdmin && (
              <div className="border-t pt-4 mt-4">
                <h3 className="font-medium mb-3">Migrate Guest to Member</h3>
                {savedGuests.length === 0 || Object.keys(members).length <= 1 ? (
                  <p className="text-sm text-muted-foreground">
                    {savedGuests.length === 0 
                      ? "Save guests to Firestore first before migrating them to members." 
                      : "You need at least two members (including admin) to migrate guests."}
                  </p>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm text-muted-foreground mb-1 block">Select Guest</label>
                      <Select
                        value={selectedGuest}
                        onValueChange={setSelectedGuest}
                        disabled={isMigrating}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select a guest" />
                        </SelectTrigger>
                        <SelectContent>
                          {savedGuests.map(guest => (
                            <SelectItem key={guest.id} value={guest.id}>
                              {guest.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="flex items-center justify-center">
                      <ArrowRight className="text-muted-foreground" />
                    </div>
                    
                    <div>
                      <label className="text-sm text-muted-foreground mb-1 block">Target Member</label>
                      <Select
                        value={selectedMember}
                        onValueChange={setSelectedMember}
                        disabled={isMigrating}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select a member" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(members)
                            .filter(([uid]) => uid !== group.adminUid) 
                            .map(([uid, memberData]) => (
                              <SelectItem key={uid} value={uid}>
                                {memberData.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <Button 
                      onClick={handleMigrateGuest}
                      disabled={!selectedGuest || !selectedMember || isMigrating}
                      className="w-full"
                    >
                      {isMigrating ? 'Migrating...' : 'Migrate Guest Data to Member'}
                    </Button>
                    
                    <p className="text-xs text-muted-foreground">
                      This will transfer all match history from the guest to the selected member and remove the guest.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
          
          <DialogFooter>
            <DialogClose asChild>
              <Button 
                variant="outline" 
                onClick={() => handleOpenChange(false)}
              >
                Close
              </Button>
            </DialogClose>
            {isEditor && (
              <Button 
                onClick={handleSaveChanges}
                disabled={isSubmitting || isMigrating}
              >
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </Button>
            )}
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
