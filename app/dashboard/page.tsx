'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/authContext';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm, SubmitHandler } from "react-hook-form";
import { db } from '@/lib/firebase/config';
import { collection, addDoc, serverTimestamp, query, where, onSnapshot, QuerySnapshot, DocumentData, doc, deleteDoc, updateDoc, deleteField } from "firebase/firestore";
import { X, Trash2, UserPlus, Users } from 'lucide-react';
import { toast } from "sonner";

type GroupFormInputs = {
  groupName: string;
  teamOneColor: string;
  teamTwoColor: string;
};

interface MemberData {
    name: string;
    isMember: boolean;
    isAdmin?: boolean;
}

interface GroupDoc extends DocumentData {
    id: string;
    name: string;
    adminUid: string;
    adminName?: string;
    members: { [uid: string]: MemberData };
    guests?: string[];
    teamColors: {
        teamOne: string;
        teamTwo: string;
    };
}

const predefinedColors = [
  { name: 'Red', hex: '#FF0000' },
  { name: 'Blue', hex: '#0000FF' },
  { name: 'Green', hex: '#008000' },
  { name: 'Yellow', hex: '#FFFF00' },
  { name: 'Orange', hex: '#FFA500' },
  { name: 'Purple', hex: '#800080' },
  { name: 'Black', hex: '#000000' },
  { name: 'White', hex: '#FFFFFF' },
];

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
  const [isSubmittingGroup, setIsSubmittingGroup] = useState(false);
  const [groups, setGroups] = useState<GroupDoc[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(true);

  const [createGuestNameInput, setCreateGuestNameInput] = useState('');
  const [createGuestMembers, setCreateGuestMembers] = useState<string[]>([]);

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState<GroupDoc | null>(null);
  const [isDeletingGroup, setIsDeletingGroup] = useState(false);

  const [isManageMembersDialogOpen, setIsManageMembersDialogOpen] = useState(false);
  const [groupToManage, setGroupToManage] = useState<GroupDoc | null>(null);
  const [manageGuestNameInput, setManageGuestNameInput] = useState('');
  const [currentGuests, setCurrentGuests] = useState<string[]>([]);
  const [membersToRemove, setMembersToRemove] = useState<string[]>([]); 
  const [isManagingMembers, setIsManagingMembers] = useState(false);


  const { register: registerCreate, handleSubmit: handleCreateSubmit, reset: resetCreate, formState: { errors: createErrors }, setValue: setCreateValue, watch: watchCreate } = useForm<GroupFormInputs>({
      defaultValues: {
          groupName: "",
          teamOneColor: "#FF0000",
          teamTwoColor: "#0000FF",
      }
  });

  const watchedTeamOneColor = watchCreate('teamOneColor');
  const watchedTeamTwoColor = watchCreate('teamTwoColor');

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
    } else if (!user) {
      setGroups([]);
      setGroupsLoading(false);
    }
  }, [user, loading]);

  useEffect(() => {
     if (!isCreateGroupOpen) {
         setCreateGuestMembers([]);
         setCreateGuestNameInput('');
         resetCreate();
     }
   }, [isCreateGroupOpen, resetCreate]);

   useEffect(() => {
       if (isManageMembersDialogOpen && groupToManage) {
           setCurrentGuests(groupToManage.guests || []);
           setMembersToRemove([]);
           setManageGuestNameInput('');
       } else {
           setGroupToManage(null);
           setCurrentGuests([]);
           setMembersToRemove([]);
           setManageGuestNameInput('');
       }
   }, [isManageMembersDialogOpen, groupToManage]);


  const handleAddCreateGuest = () => {
    const trimmedName = createGuestNameInput.trim();
    if (trimmedName && !createGuestMembers.includes(trimmedName)) {
      setCreateGuestMembers([...createGuestMembers, trimmedName]);
      setCreateGuestNameInput('');
    } else if (createGuestMembers.includes(trimmedName)) {
        toast.warning("Guest already added.");
    }
  };

  const handleRemoveCreateGuest = (guestToRemove: string) => {
    setCreateGuestMembers(createGuestMembers.filter(name => name !== guestToRemove));
  };

  const handleCreateGroup: SubmitHandler<GroupFormInputs> = async (data) => {
    if (!user) {
      toast.error("User not logged in.");
      return;
    }
    setIsSubmittingGroup(true);
    try {
      const groupsCollectionRef = collection(db, "groups");

      const fullAdminName = user.displayName || `Admin_${user.uid.substring(0, 5)}`;
      const memberFirstName = user.displayName?.split(' ')[0] || `Admin_${user.uid.substring(0, 5)}`;

      const membersMap: { [key: string]: MemberData } = {};
      membersMap[user.uid] = {
          name: memberFirstName,
          isMember: true,
          isAdmin: true
      };

      const newGroupData = {
        name: data.groupName,
        adminUid: user.uid,
        adminName: fullAdminName,
        createdAt: serverTimestamp(),
        members: membersMap,
        guests: createGuestMembers,
        teamColors: {
          teamOne: data.teamOneColor,
          teamTwo: data.teamTwoColor,
        },
      };
      await addDoc(groupsCollectionRef, newGroupData);
      toast.success("Group created successfully!");
      setIsCreateGroupOpen(false);
    } catch (error) {
      console.error("Error creating group:", error);
      toast.error("Error creating group", { description: (error as Error).message });
    } finally {
      setIsSubmittingGroup(false);
    }
  };

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
       if (trimmedName && !currentGuests.includes(trimmedName)) {
           setCurrentGuests([...currentGuests, trimmedName]);
           setManageGuestNameInput('');
       } else if (currentGuests.includes(trimmedName)) {
           toast.warning("Guest already added.");
       }
   };

   const handleRemoveManageGuest = (guestToRemove: string) => {
       setCurrentGuests(currentGuests.filter(name => name !== guestToRemove));
   };

   const handleSaveChanges = async () => {
       if (!groupToManage || !user || user.uid !== groupToManage.adminUid) {
           toast.error("Unauthorized or group not selected.");
           return;
       }
       setIsManagingMembers(true);

       try {
           const groupRef = doc(db, "groups", groupToManage.id);
           const updateData: { [key: string]: string[] | ReturnType<typeof deleteField> } = {
               guests: currentGuests
           };

           membersToRemove.forEach(uid => {
               updateData[`members.${uid}`] = deleteField();
           });

           if (Object.keys(updateData).length > 1 || JSON.stringify(currentGuests) !== JSON.stringify(groupToManage.guests || [])) {
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
            <div key={group.id} className="border rounded-lg p-4 flex flex-col">
              <div className="flex justify-between items-start mb-2">
                <h2 className="text-xl font-semibold">{group.name}</h2>
                {user.uid === group.adminUid && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">...</Button>
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
              
              <div className="flex items-center gap-2 mb-4 text-sm text-muted-foreground">
                <span className="inline-block h-3 w-3 rounded-full border" style={{ backgroundColor: group.teamColors.teamOne }}></span>
                <span>vs</span>
                <span className="inline-block h-3 w-3 rounded-full border" style={{ backgroundColor: group.teamColors.teamTwo }}></span>
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

      {/* Create Group Dialog */}
      <Dialog open={isCreateGroupOpen} onOpenChange={setIsCreateGroupOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create New Group</DialogTitle>
            <DialogDescription>
              Create a new foosball group to track matches with friends or colleagues.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateSubmit(handleCreateGroup)}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="groupName" className="text-right">Group Name</Label>
                <Input 
                  id="groupName" 
                  className="col-span-3"
                  {...registerCreate("groupName", { required: "Group name is required" })}
                  disabled={isSubmittingGroup}
                />
                {createErrors.groupName && (
                  <p className="col-span-4 text-right text-sm text-red-500">{createErrors.groupName.message}</p>
                )}
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="teamOneColor" className="text-right">Team 1 Color</Label>
                <div className="col-span-3 flex gap-2">
                  <Input 
                    id="teamOneColor" 
                    type="color"
                    className="w-12 h-10 p-1 cursor-pointer"
                    {...registerCreate("teamOneColor")}
                    disabled={isSubmittingGroup}
                  />
                  <div className="flex flex-wrap gap-1 flex-1">
                    {predefinedColors.map(color => (
                      <button
                        key={color.name}
                        type="button"
                        title={color.name}
                        className={`w-6 h-6 rounded-full border ${watchedTeamOneColor === color.hex ? 'ring-2 ring-offset-2 ring-primary' : ''}`}
                        style={{ backgroundColor: color.hex }}
                        onClick={() => setCreateValue("teamOneColor", color.hex)}
                        disabled={isSubmittingGroup}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="teamTwoColor" className="text-right">Team 2 Color</Label>
                <div className="col-span-3 flex gap-2">
                  <Input 
                    id="teamTwoColor" 
                    type="color"
                    className="w-12 h-10 p-1 cursor-pointer"
                    {...registerCreate("teamTwoColor")}
                    disabled={isSubmittingGroup}
                  />
                  <div className="flex flex-wrap gap-1 flex-1">
                    {predefinedColors.map(color => (
                      <button
                        key={color.name}
                        type="button"
                        title={color.name}
                        className={`w-6 h-6 rounded-full border ${watchedTeamTwoColor === color.hex ? 'ring-2 ring-offset-2 ring-primary' : ''}`}
                        style={{ backgroundColor: color.hex }}
                        onClick={() => setCreateValue("teamTwoColor", color.hex)}
                        disabled={isSubmittingGroup}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-4 items-start gap-4 mt-2">
                <Label className="text-right pt-2">Guest Players</Label>
                <div className="col-span-3 space-y-3">
                  <div className="flex gap-2">
                    <Input 
                      placeholder="Add guest name"
                      value={createGuestNameInput}
                      onChange={(e) => setCreateGuestNameInput(e.target.value)}
                      disabled={isSubmittingGroup}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddCreateGuest();
                        }
                      }}
                    />
                    <Button 
                      type="button" 
                      onClick={handleAddCreateGuest} 
                      disabled={!createGuestNameInput.trim() || isSubmittingGroup}
                    >
                      <UserPlus className="h-4 w-4" />
                    </Button>
                  </div>
                  {createGuestMembers.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {createGuestMembers.map(guest => (
                        <div key={guest} className="flex items-center bg-muted text-muted-foreground px-2 py-1 rounded-md text-sm">
                          {guest}
                          <Button 
                            type="button" 
                            variant="ghost" 
                            size="sm" 
                            className="p-0 h-auto ml-1" 
                            onClick={() => handleRemoveCreateGuest(guest)}
                            disabled={isSubmittingGroup}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

            </div>
            <DialogFooter>
              <Button type="submit" disabled={isSubmittingGroup}>
                {isSubmittingGroup ? 'Creating...' : 'Create Group'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Group Confirmation Dialog */}
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

      {/* Manage Members Dialog */}
      <Dialog open={isManageMembersDialogOpen} onOpenChange={setIsManageMembersDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Manage Group Members</DialogTitle>
            <DialogDescription>
              Add or remove members from &quot;{groupToManage?.name}&quot;.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-6">
            {/* Member Management Section */}
            {groupToManage && Object.entries(groupToManage.members).length > 0 && (
              <div>
                <h3 className="text-sm font-medium mb-2">Members</h3>
                <div className="space-y-2">
                  {Object.entries(groupToManage.members).map(([uid, memberData]) => (
                    <div key={uid} className="flex items-center justify-between p-2 border rounded">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>{memberData.name?.charAt(0) || '?'}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">{memberData.name || `User ${uid.substring(0,5)}`}</p>
                          {memberData.isAdmin && <p className="text-xs text-muted-foreground">Admin</p>}
                        </div>
                      </div>
                      
                      {/* Don't allow removing admins or yourself */}
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

            {/* Guest Management Section */}
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
                  <div className="flex flex-wrap gap-2">
                    {currentGuests.map(guest => (
                      <div key={guest} className="flex items-center bg-muted text-muted-foreground px-2 py-1 rounded-md text-sm">
                        {guest}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="p-0 h-auto ml-1"
                          onClick={() => handleRemoveManageGuest(guest)}
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
              disabled={isManagingMembers}
            >
              {isManagingMembers ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
