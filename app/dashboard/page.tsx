'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/authContext';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { v4 as uuidv4 } from 'uuid';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
//import { Label } from "@/components/ui/label";
import { db } from '@/lib/firebase/config';
import { collection, query, where, onSnapshot, QuerySnapshot, DocumentData, doc, deleteDoc, updateDoc, deleteField } from "firebase/firestore";
import { X, Trash2, UserPlus, Users } from 'lucide-react';
import { toast } from "sonner";
import GroupFormDialog from '@/components/groups/GroupFormDialog';

interface MemberData {
    name: string;
    isMember: boolean;
    isAdmin?: boolean;
}

interface GuestData {
    id: string;
    name: string;
}

interface GroupDoc extends DocumentData {
    id: string;
    name: string;
    adminUid: string;
    adminName?: string;
    members: { [uid: string]: MemberData };
    guests?: GuestData[] | string[];
    teamColors: {
        teamOne: string;
        teamTwo: string;
    };
    groupColor?: string; // Added group color field
}

const formatAdminDisplayName = (fullName: string | null | undefined): string => {
  if (!fullName) return 'N/A';
  const parts = fullName.trim().split(' ');
  if (parts.length <= 1) return fullName;
  const firstParts = parts.slice(0, -1).join(' ');
  const lastInitial = parts[parts.length - 1].charAt(0);
  return `${firstParts} ${lastInitial}.`;
};

export default function DashboardPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [groups, setGroups] = useState<GroupDoc[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(true);

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState<GroupDoc | null>(null);
  const [isDeletingGroup, setIsDeletingGroup] = useState(false);

  const [isManageMembersDialogOpen, setIsManageMembersDialogOpen] = useState(false);
  const [groupToManage, setGroupToManage] = useState<GroupDoc | null>(null);
  const [manageGuestNameInput, setManageGuestNameInput] = useState('');
  const [currentGuests, setCurrentGuests] = useState<GuestData[]>([]);
  const [membersToRemove, setMembersToRemove] = useState<string[]>([]);
  const [isManagingMembers, setIsManagingMembers] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user && !loading) {
      setGroupsLoading(true);
      const groupsCollectionRef = collection(db, "groups");
      const q = query(groupsCollectionRef, where(`members.${user.uid}.isMember`, "==", true));

      const unsubscribe = onSnapshot(q, (querySnapshot: QuerySnapshot<DocumentData>) => {
        const userGroups: GroupDoc[] = [];
        querySnapshot.forEach((doc) => {
          userGroups.push({ id: doc.id, ...doc.data() } as GroupDoc);
        });
        setGroups(userGroups.sort((a, b) => a.name.localeCompare(b.name)));
        setGroupsLoading(false);
      }, (error) => {
        console.error("Error fetching groups:", error);
        toast.error("Error fetching groups", { description: error.message });
        setGroupsLoading(false);
      });

      return () => unsubscribe();
    } else if (!user && !loading) { // Ensure loading is false before clearing groups
      setGroups([]);
      setGroupsLoading(false);
    }
  }, [user, loading]);

  useEffect(() => {
    if (isManageMembersDialogOpen && groupToManage) {
        const guests = groupToManage.guests || [];
        const guestsWithIds: GuestData[] = Array.isArray(guests)
            ? guests.map(guest => {
                if (typeof guest === 'string') {
                    return { id: uuidv4(), name: guest };
                }
                else if (typeof guest === 'object' && guest !== null) {
                    const tempGuest = guest as unknown as { id?: string; name?: string };
                    return {
                        id: typeof tempGuest.id === 'string' ? tempGuest.id : uuidv4(),
                        name: typeof tempGuest.name === 'string' ? tempGuest.name : ''
                    };
                }
                return { id: uuidv4(), name: String(guest) };
            })
            : [];

        setCurrentGuests(guestsWithIds);
        setMembersToRemove([]);
        setManageGuestNameInput('');
    } else {
        // Reset state when dialog closes or groupToManage is null
        setGroupToManage(null);
        setCurrentGuests([]);
        setMembersToRemove([]);
        setManageGuestNameInput('');
    }
  }, [isManageMembersDialogOpen, groupToManage]);

  const handleOpenDeleteDialog = (group: GroupDoc) => {
      setGroupToDelete(group);
      setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
      if (!groupToDelete || !user || user.uid !== groupToDelete.adminUid) {
          toast.error("Unauthorized or group not selected.");
          return;
      }
      setIsDeletingGroup(true);
      try {
          const groupRef = doc(db, "groups", groupToDelete.id);
          await deleteDoc(groupRef);
          toast.success(`Group "${groupToDelete.name}" deleted successfully.`);
          setGroupToDelete(null);
          setIsDeleteDialogOpen(false);
      } catch (error) {
          console.error("Error deleting group:", error);
          toast.error("Error deleting group", { description: (error as Error).message });
      } finally {
          setIsDeletingGroup(false);
      }
  };

  const handleOpenManageMembersDialog = (group: GroupDoc) => {
      setGroupToManage(group);
      setIsManageMembersDialogOpen(true);
  };

  const handleToggleMemberRemoval = (uid: string) => {
      setMembersToRemove(prev =>
          prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]
      );
  };

  const handleAddManageGuest = () => {
      const trimmedName = manageGuestNameInput.trim();
      if (trimmedName) {
          const existingGuest = currentGuests.find(guest => guest.name.toLowerCase() === trimmedName.toLowerCase());

          if (!existingGuest) {
              const guestId = uuidv4();
              setCurrentGuests([...currentGuests, { id: guestId, name: trimmedName }]);
              setManageGuestNameInput('');
          } else {
              toast.warning("Guest with this name already exists.");
          }
      }
  };

  const handleRemoveManageGuest = (guestIdToRemove: string) => {
      setCurrentGuests(currentGuests.filter(guest => guest.id !== guestIdToRemove));
  };

  const handleSaveChanges = async () => {
      if (!groupToManage || !user || user.uid !== groupToManage.adminUid) {
          toast.error("Unauthorized or group not selected.");
          return;
      }
      setIsManagingMembers(true);

      try {
          const groupRef = doc(db, "groups", groupToManage.id);
          const updateData: {
              guests: GuestData[];
              [key: string]: GuestData[] | ReturnType<typeof deleteField>
          } = {
              guests: currentGuests
          };

          membersToRemove.forEach(uid => {
              updateData[`members.${uid}`] = deleteField();
          });

          const originalGuests = groupToManage.guests || [];
          const guestsChanged = currentGuests.length !== originalGuests.length ||
              currentGuests.some((guest, i) => {
                  if (i >= originalGuests.length) return true;

                  const origGuest = originalGuests[i];
                  if (typeof origGuest === 'string') {
                      return guest.name !== origGuest;
                  } else if (typeof origGuest === 'object' && origGuest !== null) {
                      const tempGuest = origGuest as unknown as { id?: string; name?: string };
                      // Compare both id and name for more robust change detection
                      return guest.id !== tempGuest.id || guest.name !== tempGuest.name;
                  }
                  return true; // Treat unknown original format as changed
              });

          if (membersToRemove.length > 0 || guestsChanged) {
               await updateDoc(groupRef, updateData);
               toast.success(`Members and guests updated for "${groupToManage.name}".`);
          } else {
              toast.info("No changes detected.");
          }

          setIsManageMembersDialogOpen(false);

      } catch (error) {
          console.error("Error updating members/guests:", error);
          toast.error("Error updating group", { description: (error as Error).message });
      } finally {
          setIsManagingMembers(false);
      }
  };

  if (loading || !user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-8">
        <Skeleton className="h-8 w-24 mb-4" />
        <Skeleton className="h-10 w-40" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 md:px-8">
      <header className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Your Groups</h1>
        <div className="flex gap-4">
          <Button onClick={() => setIsCreateGroupOpen(true)}>Create Group</Button>
          <Button variant="outline" onClick={logout}>Logout</Button>
        </div>
      </header>

      {groupsLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-lg" />
          ))}
        </div>
      ) : groups.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map((group) => (
            <div key={group.id} className="border rounded-lg p-4 flex flex-col relative overflow-hidden">
              {/* Colored Icon Placeholder */}
              <div
                className="absolute -top-4 -left-4 w-16 h-16 rounded-full flex items-center justify-center text-2xl opacity-80"
                style={{ backgroundColor: group.groupColor || '#cccccc' }} // Use group color or default gray
                aria-hidden="true"
              >
                <span className="mt-4 ml-4">⚽</span> {/* Football emoji */}
              </div>

              <div className="flex justify-between items-start mb-2 pl-10"> {/* Add padding to avoid overlap */}
                <h2 className="text-xl font-semibold">{group.name}</h2>
                {user.uid === group.adminUid && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="relative z-10">...</Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Group Options</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => handleOpenManageMembersDialog(group)}>
                        <Users className="mr-2 h-4 w-4" />
                        <span>Manage Members</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleOpenDeleteDialog(group)}
                        className="text-red-600 focus:text-red-600"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        <span>Delete Group</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>

              <div className="flex items-center gap-2 mb-4 text-sm text-muted-foreground pl-10"> {/* Add padding */}
                <span className="inline-block h-5 w-5 rounded-full border" style={{ backgroundColor: group.teamColors.teamOne }}></span>
                <span>vs</span>
                <span className="inline-block h-5 w-5 rounded-full border" style={{ backgroundColor: group.teamColors.teamTwo }}></span>
              </div>

              <div className="mt-auto pt-3 border-t flex justify-between items-center">
                <div className="text-sm text-muted-foreground">
                  Admin: {formatAdminDisplayName(group.adminName)}
                </div>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => router.push(`/group/${group.id}`)}
                >
                  View
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">You have not created or joined any groups yet.</p>
          <Button onClick={() => setIsCreateGroupOpen(true)}>Create Your First Group</Button>
        </div>
      )}

      {user && (
        <GroupFormDialog
          isOpen={isCreateGroupOpen}
          onOpenChange={setIsCreateGroupOpen}
          user={user}
        />
      )}

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to delete this group?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the group
              &quot;{groupToDelete?.name}&quot; and all associated match data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingGroup}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeletingGroup}
            >
              {isDeletingGroup ? 'Deleting...' : 'Delete Group'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isManageMembersDialogOpen} onOpenChange={setIsManageMembersDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Manage Group Members</DialogTitle>
            <DialogDescription>
              Add or remove members from &quot;{groupToManage?.name}&quot;.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-6">
            {groupToManage && Object.entries(groupToManage.members).length > 0 && (
              <div>
                <h3 className="text-sm font-medium mb-2">Members</h3>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-2"> {/* Added scroll for long member lists */}
                  {Object.entries(groupToManage.members).map(([uid, memberData]) => (
                    <div key={uid} className="flex items-center justify-between p-2 border rounded">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>{memberData.name?.charAt(0)?.toUpperCase() || '?'}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">{memberData.name || `User ${uid.substring(0,5)}`}</p>
                          {memberData.isAdmin && <p className="text-xs text-muted-foreground">Admin</p>}
                        </div>
                      </div>

                      {!memberData.isAdmin && uid !== user.uid && (
                        <Button
                          variant={membersToRemove.includes(uid) ? "destructive" : "outline"}
                          size="sm"
                          onClick={() => handleToggleMemberRemoval(uid)}
                          disabled={isManagingMembers}
                        >
                          {membersToRemove.includes(uid) ? 'Undo' : 'Remove'}
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h3 className="text-sm font-medium mb-2">Guest Players</h3>
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    placeholder="Add guest name"
                    value={manageGuestNameInput}
                    onChange={(e) => setManageGuestNameInput(e.target.value)}
                    disabled={isManagingMembers}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddManageGuest();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    onClick={handleAddManageGuest}
                    disabled={!manageGuestNameInput.trim() || isManagingMembers}
                  >
                    <UserPlus className="h-4 w-4" />
                  </Button>
                </div>

                {currentGuests.length > 0 ? (
                  <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto pr-2"> {/* Added scroll for guests */}
                    {currentGuests.map(guest => (
                      <div key={guest.id} className="flex items-center bg-muted text-muted-foreground px-2 py-1 rounded-md text-sm">
                        {guest.name}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="p-0 h-auto ml-1"
                          onClick={() => handleRemoveManageGuest(guest.id)}
                          disabled={isManagingMembers}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No guest players added.</p>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={isManagingMembers}>Cancel</Button>
            </DialogClose>
            <Button
              onClick={handleSaveChanges}
              disabled={isManagingMembers || (membersToRemove.length === 0 && JSON.stringify(currentGuests.map(g => ({id: g.id, name: g.name})).sort((a,b) => a.name.localeCompare(b.name))) === JSON.stringify((groupToManage?.guests || []).map(g => typeof g === 'string' ? {id: 'unknown', name: g} : {id: (g as GuestData).id, name: (g as GuestData).name}).sort((a,b) => a.name.localeCompare(b.name))))} // Disable save if no changes
            >
              {isManagingMembers ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
