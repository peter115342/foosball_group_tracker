'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/authContext';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
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
import { db } from '@/lib/firebase/config';
import { collection, query, where, onSnapshot, QuerySnapshot, DocumentData, doc, deleteDoc, increment, getDoc, updateDoc } from "firebase/firestore";
import {Trash2,Users, Copy, Edit } from 'lucide-react';
import { toast } from "sonner";
import GroupFormDialog from '@/components/groups/GroupFormDialog';
import JoinGroupForm from '@/components/groups/JoinGroupForm';
import ManageMembersDialog from '@/components/groups/ManageMembersDialog';

interface MemberData {
    name: string;
    role: 'editor' | 'viewer';
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
    inviteCode?: string;
    members: { [uid: string]: MemberData };
    guests?: GuestData[] | string[];
    teamColors: {
        teamOne: string;
        teamTwo: string;
    };
    groupColor?: string;
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
  const { user, loading} = useAuth();
  const router = useRouter();
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [isJoinGroupOpen, setIsJoinGroupOpen] = useState(false);
  const [groups, setGroups] = useState<GroupDoc[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(true);

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState<GroupDoc | null>(null);
  const [isDeletingGroup, setIsDeletingGroup] = useState(false);

  const [isManageMembersDialogOpen, setIsManageMembersDialogOpen] = useState(false);
  const [groupToManage, setGroupToManage] = useState<GroupDoc | null>(null);
  
  const [rateLimit, setRateLimit] = useState<{
    groupCount: number;
    lastGroupCreation: Date | null;
    cooldownRemaining: number;
  } | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user && !loading) {
      setGroupsLoading(true);
      const groupsCollectionRef = collection(db, "groups");
      const q = query(groupsCollectionRef, where(`members.${user.uid}.role`, "in", ["admin","editor", "viewer"]));

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
    } else if (!user && !loading) {
      setGroups([]);
      setGroupsLoading(false);
    }
  }, [user, loading]);
  
  useEffect(() => {
    if (user && !loading) {
      const fetchRateLimits = async () => {
        try {
          const ratelimitRef = doc(db, 'ratelimits', user.uid);
          const ratelimitDoc = await getDoc(ratelimitRef);
          
          if (ratelimitDoc.exists()) {
            const data = ratelimitDoc.data();
            const lastCreation = data.lastGroupCreation ? 
              data.lastGroupCreation.toDate() : null;
            
            let cooldownRemaining = 0;
            if (lastCreation) {
              const cooldownEnd = new Date(lastCreation.getTime() + (60 * 1000)); // 1 min
              cooldownRemaining = Math.max(0, 
                Math.floor((cooldownEnd.getTime() - Date.now()) / 1000));
            }
            
            setRateLimit({
              groupCount: data.groupCount || 0,
              lastGroupCreation: lastCreation,
              cooldownRemaining
            });
          }
        } catch (error) {
          console.error("Error fetching rate limits:", error);
        }
      };
      
      fetchRateLimits();
      
      // Set up an interval to update the cooldown timer
      if (rateLimit && rateLimit.cooldownRemaining > 0) {
        const interval = setInterval(() => {
          setRateLimit(prev => {
            if (!prev) return prev;
            const newRemaining = Math.max(0, prev.cooldownRemaining - 1);
            return { ...prev, cooldownRemaining: newRemaining };
          });
        }, 1000);
        
        return () => clearInterval(interval);
      }
    }
  }, [user, loading, rateLimit?.cooldownRemaining]);

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
          
          // Decrement group count in rate limits
          const ratelimitRef = doc(db, 'ratelimits', user.uid);
          await updateDoc(ratelimitRef, {
            groupCount: increment(-1)
          });
          
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

  const handleCopyInviteCode = (inviteCode: string) => {
    navigator.clipboard.writeText(inviteCode)
      .then(() => toast.success('Invite code copied to clipboard'))
      .catch(() => toast.error('Failed to copy invite code'));
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
        <div className="flex gap-2 items-center">
          {rateLimit && (
            <div className="text-sm text-muted-foreground mr-4">
              <span className="font-semibold">{20 - rateLimit.groupCount}</span> groups remaining for this user
              {rateLimit.cooldownRemaining > 0 && (
                <span className="ml-2">
                  • Next in {Math.floor(rateLimit.cooldownRemaining / 60)}m {rateLimit.cooldownRemaining % 60}s
                </span>
              )}
            </div>
          )}
          <Button 
            variant="outline" 
            onClick={() => setIsJoinGroupOpen(true)}
          >
            Join Group
          </Button>
          <Button 
            onClick={() => setIsCreateGroupOpen(true)}
            disabled={rateLimit ? rateLimit.cooldownRemaining > 0 : false}
          >
            {rateLimit && rateLimit.cooldownRemaining > 0 
              ? `Create Group (${Math.floor(rateLimit.cooldownRemaining / 60)}:${(rateLimit.cooldownRemaining % 60).toString().padStart(2, '0')})` 
              : 'Create Group'}
          </Button>
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
              <div
                className="absolute -top-4 -left-4 w-16 h-16 rounded-full flex items-center justify-center text-2xl opacity-80"
                style={{ backgroundColor: group.groupColor || '#cccccc' }}
                aria-hidden="true"
              >
                <span className="mt-4 ml-4">⚽</span>
              </div>

              <div className="flex justify-between items-start mb-2 pl-10">
                <h2 className="text-xl font-semibold">{group.name}</h2>
                {(user.uid === group.adminUid || group.members[user.uid]?.role === 'editor') && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="relative z-10">
                        <Edit className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Group Options</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => handleOpenManageMembersDialog(group)}>
                        <Users className="mr-2 h-4 w-4" />
                        <span>{user.uid === group.adminUid ? "Manage Group" : "View Details"}</span>
                      </DropdownMenuItem>
                      {user.uid === group.adminUid && (
                        <DropdownMenuItem
                          onClick={() => handleOpenDeleteDialog(group)}
                          className="text-red-600 focus:text-red-600"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          <span>Delete Group</span>
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>

              <div className="flex items-center gap-2 mb-4 text-sm text-muted-foreground pl-10">
                <span className="inline-block h-5 w-5 rounded-full border" style={{ backgroundColor: group.teamColors.teamOne }}></span>
                <span>vs</span>
                <span className="inline-block h-5 w-5 rounded-full border" style={{ backgroundColor: group.teamColors.teamTwo }}></span>
              </div>

              {(user.uid === group.adminUid || group.members[user.uid]?.role === 'editor') && group.inviteCode && (
                <div className="mt-2 mb-2 pt-2 border-t">
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-muted-foreground">
                      <span className="font-semibold">Invite Code:</span> 
                      <span className="font-mono ml-1">{group.inviteCode}</span>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-6 px-2"
                      onClick={() => handleCopyInviteCode(group.inviteCode || '')}
                    >
                      <Copy className="h-3 w-3 mr-1" />
                      <span className="text-xs">Copy</span>
                    </Button>
                  </div>
                </div>
              )}

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
          <div className="flex justify-center gap-3">
            <Button variant="outline" onClick={() => setIsJoinGroupOpen(true)}>Join a Group</Button>
            <Button 
              onClick={() => setIsCreateGroupOpen(true)}
              disabled={rateLimit ? rateLimit.cooldownRemaining > 0 : false}
            >
              {rateLimit && rateLimit.cooldownRemaining > 0 
                ? `Create Group (${Math.floor(rateLimit.cooldownRemaining / 60)}:${(rateLimit.cooldownRemaining % 60).toString().padStart(2, '0')})` 
                : 'Create Your First Group'}
            </Button>
          </div>
        </div>
      )}

      {user && (
        <>
          <GroupFormDialog
            isOpen={isCreateGroupOpen}
            onOpenChange={setIsCreateGroupOpen}
            user={user}
          />
          <JoinGroupForm
            isOpen={isJoinGroupOpen}
            onOpenChange={setIsJoinGroupOpen}
            user={user}
          />
        </>
      )}

      {groupToManage && (
        <ManageMembersDialog 
          isOpen={isManageMembersDialogOpen}
          onOpenChange={setIsManageMembersDialogOpen}
          group={groupToManage}
          currentUser={user}
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
    </div>
  );
}
