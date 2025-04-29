'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
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
import { collection, query, where, onSnapshot, QuerySnapshot, DocumentData, doc, deleteDoc, increment, getDoc, updateDoc, orderBy, limit, getDocs } from "firebase/firestore";
import {Trash2,Users, Copy, Edit } from 'lucide-react';
import { toast } from "sonner";
import GroupFormDialog from '@/components/groups/GroupFormDialog';
import JoinGroupForm from '@/components/groups/JoinGroupForm';
import ManageMembersDialog from '@/components/groups/ManageMembersDialog';
import { format } from 'date-fns';

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
    lastMatchDate?: Date | null;
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
  
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

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
          userGroups.push({ id: doc.id, ...doc.data(), lastMatchDate: null } as GroupDoc);
        });
        
        const sortedGroups = userGroups.sort((a, b) => a.name.localeCompare(b.name));
        setGroups(sortedGroups);
        
        const matchDataPromises: Promise<void>[] = [];
        
        sortedGroups.forEach(async (group) => {
          const promise = (async () => {
            try {
              const matchesRef = collection(db, "matches");
              const matchesQuery = query(
                matchesRef, 
                where("groupId", "==", group.id),
                orderBy("playedAt", "desc"), 
                limit(1)
              );
              
              const matchesSnapshot = await getDocs(matchesQuery);
              
              if (!matchesSnapshot.empty) {
                const matchData = matchesSnapshot.docs[0].data();
                let matchDate = null;
                
                if (matchData.playedAt && typeof matchData.playedAt === 'object') {
                  if (matchData.playedAt.seconds !== undefined) {
                    matchDate = new Date(matchData.playedAt.seconds * 1000);
                  } else if (matchData.playedAt.toDate) {
                    matchDate = matchData.playedAt.toDate();
                  }
                }
                
                if (matchDate) {
                  setGroups(currentGroups => {
                    const updatedGroups = currentGroups.map(g => 
                      g.id === group.id ? {...g, lastMatchDate: matchDate} : g
                    );
                    
                    return updatedGroups.sort((a, b) => {
                      if (a.lastMatchDate && b.lastMatchDate) {
                        return b.lastMatchDate.getTime() - a.lastMatchDate.getTime();
                      } else if (a.lastMatchDate) {
                        return -1;
                      } else if (b.lastMatchDate) {
                        return 1;
                      }
                      return a.name.localeCompare(b.name);
                    });
                  });
                }
              }
            } catch (error) {
              console.error(`Error fetching matches for group ${group.id}:`, error);
            }
          })();
          
          matchDataPromises.push(promise);
        });
        
        Promise.all(matchDataPromises).then(() => {
          setGroups(currentGroups => 
            [...currentGroups].sort((a, b) => {
              if (a.lastMatchDate && b.lastMatchDate) {
                return b.lastMatchDate.getTime() - a.lastMatchDate.getTime();
              } else if (a.lastMatchDate) {
                return -1;
              } else if (b.lastMatchDate) {
                return 1;
              }
              return a.name.localeCompare(b.name);
            })
          );
          setGroupsLoading(false);
        });
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

  const resetAllDialogStates = () => {
    setOpenDropdownId(null);
    setGroupToManage(null);
    setIsManageMembersDialogOpen(false);
    setGroupToDelete(null);
    setIsDeleteDialogOpen(false);
  };

  const handleOpenDeleteDialog = (group: GroupDoc) => {
      setGroupToDelete(group);
      setIsDeleteDialogOpen(true);
      setOpenDropdownId(null);
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

          const ratelimitRef = doc(db, 'ratelimits', user.uid);
          await updateDoc(ratelimitRef, {
            groupCount: increment(-1)
          });

          toast.success(`Group "${groupToDelete.name}" deleted successfully.`);
          resetAllDialogStates();
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
      setOpenDropdownId(null);
  };

  const handleCopyInviteCode = (inviteCode: string) => {
    navigator.clipboard.writeText(inviteCode)
      .then(() => toast.success('Invite code copied to clipboard'))
      .catch(() => toast.error('Failed to copy invite code'));
  };

  const formatLastMatchDate = (date: Date | null) => {
    if (!date) return null;
    return format(date, 'MMM d, yyyy');
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
    <div className="container mx-auto py-8 px-4 md:px-8 min-h-screen">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0 mb-8">
        <h1 className="text-3xl font-bold">Groups</h1>
        <div className="flex flex-row max-[480px]:flex-col gap-2 items-center max-[480px]:items-stretch w-full sm:w-auto">
          <Button
            variant="outline"
            onClick={() => setIsJoinGroupOpen(true)}
            className="max-[480px]:w-full"
          >
            Join Group
          </Button>
          <Button
            onClick={() => setIsCreateGroupOpen(true)}
            disabled={rateLimit ? rateLimit.cooldownRemaining > 0 : false}
            className="max-[480px]:w-full"
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
            <div key={group.id} className="border-2 rounded-lg p-4 flex flex-col relative overflow-hidden shadow-md hover:shadow-lg transition-shadow bg-card">
              <div
                className="absolute -top-4 -left-4 w-16 h-16 rounded-full flex items-center justify-center text-2xl opacity-80"
                style={{ backgroundColor: group.groupColor || '#cccccc' }}
                aria-hidden="true"
              >
                <span className="mt-4 ml-4">⚽</span>
              </div>

              <div className="flex justify-between items-start mb-2 pl-10">
                <div>
                  <h2 className="text-xl font-semibold">{group.name}</h2>
                  {group.lastMatchDate && (
                    <div className="text-xs text-muted-foreground mt-1">
                      Last match: {formatLastMatchDate(group.lastMatchDate)}
                    </div>
                  )}
                </div>
                {(user.uid === group.adminUid || group.members[user.uid]?.role === 'editor') && (
                  <DropdownMenu open={openDropdownId === group.id} onOpenChange={(open) => {
                    if (open) {
                      setOpenDropdownId(group.id);
                    } else {
                      setOpenDropdownId(null);
                    }
                  }}>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="icon" className="h-9 w-9">
                        <Edit className="h-5 w-5" />
                        <span className="sr-only">Group Options</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuPortal>
                      <DropdownMenuContent align="end" className="w-58 p-2.75">
                        <DropdownMenuLabel className="text-lg font-medium py-2">Group Options</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleOpenManageMembersDialog(group)}
                          className="py-3 text-base cursor-pointer"
                        >
                          <Users className="mr-3 h-5 w-5" />
                          <span>{user.uid === group.adminUid ? "Manage Group" : "View Details"}</span>
                        </DropdownMenuItem>
                        {user.uid === group.adminUid && (
                          <DropdownMenuItem
                            onClick={() => handleOpenDeleteDialog(group)}
                            className="text-red-600 focus:text-red-600 py-3 text-base cursor-pointer"
                          >
                            <Trash2 className="mr-3 h-5 w-5" />
                            <span>Delete Group</span>
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenuPortal>
                  </DropdownMenu>
                )}
              </div>

              <div className="flex items-center gap-2 mb-4 text-sm text-muted-foreground pl-10">
                <span className="inline-block h-5 w-5 rounded-full border-2 border-black dark:border-white" style={{ backgroundColor: group.teamColors.teamOne }}></span>
                <span>vs</span>
                <span className="inline-block h-5 w-5 rounded-full border-2 border-black dark:border-white" style={{ backgroundColor: group.teamColors.teamTwo }}></span>
              </div>

              {(user.uid === group.adminUid || group.members[user.uid]?.role === 'editor') && group.inviteCode && (
                <div className="mt-1 mb-2 pt-1 border-t">
                  <div className="flex items-center justify-between h-12">
                    <div className="text-sm text-muted-foreground">
                      <span className="font-semibold">Invite Code:</span>
                      <span className="font-mono ml-1">{group.inviteCode}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-9 px-3"
                      onClick={() => handleCopyInviteCode(group.inviteCode || '')}
                    >
                      <Copy className="h-5 w-5 mr-1" />
                      <span className="text-sm">Copy</span>
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
                  size="default"
                  className="h-12 px-6"
                  onClick={() => router.push(`/group/${group.id}`)}
                >
                  Matches
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

      <ManageMembersDialog
        isOpen={isManageMembersDialogOpen}
        onOpenChange={(open) => {
          setIsManageMembersDialogOpen(open);
          if (!open) {
            setOpenDropdownId(null);
            setTimeout(() => setGroupToManage(null), 100);
          }
        }}
        group={groupToManage}
        currentUser={user}
      />

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={(open) => {
        setIsDeleteDialogOpen(open);
        if (!open) {
          setOpenDropdownId(null);
          setTimeout(() => setGroupToDelete(null), 100);
        }
      }}>
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
