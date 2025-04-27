'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/authContext';
import { db } from '@/lib/firebase/config';
import {
    doc,
    collection,
    query,
    where,
    orderBy,
    onSnapshot,
    DocumentData,
    QuerySnapshot,
    deleteDoc,
    Timestamp,
} from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
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
import { toast } from "sonner";
import MatchFormDialog from '@/components/matches/MatchFormDialog';
import { ArrowLeft, Edit, Trash2 } from 'lucide-react';

interface GroupData extends DocumentData {
    id: string;
    name: string;
    adminUid: string;
    adminName?: string;
    members: {
        [uid: string]: {
            name: string;
            role: 'admin' | 'editor' | 'viewer';
        };
    };
    guests?: Array<{id: string; name: string}>;
    teamColors: {
        teamOne: string;
        teamTwo: string;
    };
    groupColor?: string;
}

interface Member {
    uid: string;
    displayName: string;
}

interface SelectablePlayer {
    uid: string;
    displayName: string;
}

interface PlayerWithPosition {
    uid: string;
    displayName: string;
    position?: 'attack' | 'defense';
}

interface MatchData extends DocumentData {
    id: string;
    groupId: string;
    createdAt: Timestamp;
    playedAt: Timestamp;
    gameType: '1v1' | '2v2';
    team1: {
        color: string;
        score: number;
        players: PlayerWithPosition[];
    };
    team2: {
        color: string;
        score: number;
        players: PlayerWithPosition[];
    };
    winner: 'team1' | 'team2' | 'draw';
}

const formatAdminDisplayName = (fullName: string | null | undefined): string => {
    if (!fullName) return 'N/A';
    const parts = fullName.trim().split(' ');
    if (parts.length <= 1) return fullName;
    const firstParts = parts.slice(0, -1).join(' ');
    const lastInitial = parts[parts.length - 1].charAt(0);
    return `${firstParts} ${lastInitial}.`;
};

const formatPosition = (position?: string, gameType?: string): string => {
    if (!position || gameType === '1v1') return '';
    switch (position) {
        case 'attack': return ' (Attack)';
        case 'defense': return ' (Defense)';
        default: return '';
    }
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const formatPlayedAt = (timestamp: any) => {
  try {
    if (timestamp && typeof timestamp.toDate === 'function') {
      return timestamp.toDate().toLocaleDateString(undefined, { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    } 
    else if (timestamp && typeof timestamp === 'object' && 'seconds' in timestamp) {
      const date = new Date(timestamp.seconds * 1000);
      return date.toLocaleDateString(undefined, { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    }
    else if (timestamp && typeof timestamp === 'string') {
      const date = new Date(timestamp);
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString(undefined, { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric'
        });
      }
    }
    return 'Invalid date';
  } catch (err) {
    console.error("Error formatting date:", err, timestamp);
    return 'Date format error';
  }
};

const GUEST_PREFIX = 'guest_';

export default function GroupDetailPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const params = useParams();
    const groupId = params.groupId as string;

    const [group, setGroup] = useState<GroupData | null>(null);
    const [members, setMembers] = useState<Member[]>([]);
    const [selectablePlayers, setSelectablePlayers] = useState<SelectablePlayer[]>([]);
    const [matches, setMatches] = useState<MatchData[]>([]);
    const [groupLoading, setGroupLoading] = useState(true);
    const [matchesLoading, setMatchesLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [isMatchDialogOpen, setIsMatchDialogOpen] = useState(false);
    const [editingMatch, setEditingMatch] = useState<MatchData | null>(null);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [matchToDelete, setMatchToDelete] = useState<string | null>(null);

    const isAdmin = user?.uid === group?.adminUid;
    const canEditMatches = isAdmin || group?.members[user?.uid || '']?.role === 'editor';

    useEffect(() => {
        if (group?.name) {
            document.title = `Foosballek/${group.name}`;
        } else {
            document.title = 'Foosballek';
        }
    }, [group]);

    useEffect(() => {
        if (!groupId || authLoading) return;
        if (!user) {
            router.push('/');
            return;
        }

        setGroupLoading(true);
        setError(null);
        const groupRef = doc(db, "groups", groupId);

        const unsubscribe = onSnapshot(groupRef, async (docSnap) => {
            if (docSnap.exists()) {
                const groupData = { id: docSnap.id, ...docSnap.data() } as GroupData;

                if (!groupData.members || !groupData.members[user.uid]?.role) {
                    setError("Access Denied: You are not a member of this group.");
                    setGroup(null);
                    setMembers([]);
                    setSelectablePlayers([]);
                    setGroupLoading(false);
                    return;
                }

                setGroup(groupData);

                const fetchedMembers: Member[] = [];
                if (groupData.members) {
                    Object.entries(groupData.members).forEach(([uid, memberData]) => {
                        if (uid && memberData && typeof uid === 'string') {
                            fetchedMembers.push({
                                uid: uid,
                                displayName: memberData.name || `User ${uid.substring(0, 5)}`
                            });
                        }
                    });
                }
                setMembers(fetchedMembers);

                const guests: SelectablePlayer[] = [];
                if (Array.isArray(groupData.guests)) {
                    groupData.guests.forEach((guest, i) => {
                        if (guest && typeof guest === 'object' && 
                            'id' in guest && 'name' in guest &&
                            typeof guest.id === 'string' && 
                            typeof guest.name === 'string') {
                            guests.push({
                                uid: `${GUEST_PREFIX}${guest.id}`,
                                displayName: `${guest.name} (Guest)`
                            });
                        } else {
                            console.warn(`Invalid guest format at index ${i}:`, guest);
                        }
                    });
                }

                const validPlayers = [...fetchedMembers, ...guests]
                    .filter(player => player && typeof player.uid === 'string' && typeof player.displayName === 'string')
                    .sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''));
                    
                setSelectablePlayers(validPlayers);

            } else {
                setError("Group not found.");
                setGroup(null);
                setMembers([]);
                setSelectablePlayers([]);
            }
            setGroupLoading(false);
        }, (err) => {
            console.error("Error fetching group:", err);
            setError("Failed to load group data.");
            setGroupLoading(false);
        });

        return () => unsubscribe();
    }, [groupId, user, authLoading, router]);

    useEffect(() => {
        if (!groupId || !group) {
            setMatches([]);
            setMatchesLoading(groupLoading);
            return;
        }

        if (groupLoading || error) {
            setMatches([]);
            setMatchesLoading(false);
            return;
        }

        setMatchesLoading(true);
        const matchesCollectionRef = collection(db, "matches");
        const q = query(matchesCollectionRef, where("groupId", "==", group.id), orderBy("playedAt", "desc"));

        const unsubscribe = onSnapshot(q, (querySnapshot: QuerySnapshot<DocumentData>) => {
            const groupMatches: MatchData[] = [];
            querySnapshot.forEach((doc) => {
                groupMatches.push({ id: doc.id, ...doc.data() } as MatchData);
            });
            setMatches(groupMatches);
            setMatchesLoading(false);
        }, (err) => {
            console.error("Error fetching matches:", err);
            setMatchesLoading(false);
            toast.error("Error fetching matches", { description: err.message });
        });

        return () => unsubscribe();
    }, [groupId, group, error, groupLoading]);

    const handleOpenAddMatchDialog = () => {
        setEditingMatch(null);
        setIsMatchDialogOpen(true);
    };

    const handleOpenEditMatchDialog = (match: MatchData) => {
        setEditingMatch(match);
        setIsMatchDialogOpen(true);
    };

    const handleOpenDeleteDialog = (matchId: string) => {
        setMatchToDelete(matchId);
        setIsDeleteDialogOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (!matchToDelete || !canEditMatches) {
             toast.error("Unauthorized or match not selected.");
             setIsDeleteDialogOpen(false);
             setMatchToDelete(null);
             return;
        }
        try {
            await deleteDoc(doc(db, "matches", matchToDelete));
            toast.success("Match deleted successfully.");
            setMatchToDelete(null);
            setIsDeleteDialogOpen(false);
        } catch (err) {
            console.error("Error deleting match:", err);
            toast.error("Error deleting match", { description: (err as Error).message });
            setMatchToDelete(null);
            setIsDeleteDialogOpen(false);
        }
    };

    if (authLoading || groupLoading) {
        return (
             <div className="flex flex-col items-center justify-center min-h-screen p-8">
                 <Skeleton className="h-5 w-36 mb-6 self-start" />
                 <Skeleton className="h-8 w-48 mb-2" />
                 <Skeleton className="h-1 w-24 mb-3" />
                 <Skeleton className="h-5 w-full max-w-md mb-8" />
                 <div className="w-full max-w-4xl flex justify-between items-center mb-6">
                    <Skeleton className="h-8 w-32" />
                    <Skeleton className="h-10 w-28" />
                 </div>
                 <div className="w-full max-w-4xl space-y-4">
                     <Skeleton className="h-24 w-full rounded-lg" />
                     <Skeleton className="h-24 w-full rounded-lg" />
                     <Skeleton className="h-24 w-full rounded-lg" />
                 </div>
             </div>
         );
    }

    if (error) {
        return (
             <div className="flex flex-col items-center justify-center min-h-screen p-8 text-center">
                 <p className="text-destructive mb-4">{error}</p>
                 <Button onClick={() => router.push('/dashboard')} variant="outline">
                     <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
                 </Button>
             </div>
         );
    }

    if (!group) {
         return (
            <div className="flex flex-col items-center justify-center min-h-screen p-8 text-center">
                 <p className="text-muted-foreground mb-4">Group data is currently unavailable.</p>
                 <Button onClick={() => router.push('/dashboard')} variant="outline">
                     <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
                 </Button>
             </div>
        );
    }

    return (
        <div className="container mx-auto p-4 md:p-8 min-h-screen">
            <Button
                variant="default"
                size="sm"
                onClick={() => router.push('/dashboard')}
                className="mb-6 flex items-center"
            >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Dashboard
            </Button>

            <header className="mb-8 border-b pb-4">
                <h1 className="text-3xl font-bold tracking-tight mb-1">{group.name}</h1>
                {group.groupColor && (
                    <div
                        className="h-1 w-16 rounded mb-3"
                        style={{ backgroundColor: group.groupColor }}
                        aria-hidden="true"
                    ></div>
                )}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    <span>Team 1: <span className="inline-block h-5 w-5 rounded-full border-2 border-black dark:border-white align-middle" style={{ backgroundColor: group.teamColors.teamOne }}></span></span>
                    <span>Team 2: <span className="inline-block h-5 w-5 rounded-full border-2 border-black dark:border-white align-middle" style={{ backgroundColor: group.teamColors.teamTwo }}></span></span>
                    {group.adminName && <span className="sm:ml-auto">Admin: {formatAdminDisplayName(group.adminName)}</span>}
                </div>
            </header>

            <main>
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-semibold">Match History</h2>
                    {canEditMatches && (
                        <Button
                            onClick={handleOpenAddMatchDialog}
                            disabled={selectablePlayers.length < 1}
                            size="sm"
                        >
                            Add Match
                        </Button>
                    )}
                </div>

                <div className="space-y-4">
                    {matchesLoading ? (
                        <>
                            <Skeleton className="h-24 w-full rounded-lg" />
                            <Skeleton className="h-24 w-full rounded-lg" />
                            <Skeleton className="h-24 w-full rounded-lg" />
                        </>
                    ) : matches.length > 0 ? (
                        matches.map((match) => (
                            <div key={match.id} className="border rounded-lg p-4 flex flex-col sm:flex-row justify-between sm:items-start gap-4 hover:shadow-sm transition-shadow duration-150">
                                <div className="flex-grow">
                                    <div className="flex items-center gap-x-3 gap-y-1 mb-2 flex-wrap">
                                        <div className="flex items-center gap-1.5">
                                            <span
                                                className="inline-block h-5 w-5 rounded-full border-2 border-black dark:border-white"
                                                style={{ backgroundColor: match.team1?.color }}
                                                aria-hidden="true"
                                            ></span>
                                            <span className="font-semibold text-xl">
                                                {match.team1?.score ?? '?'}
                                            </span>
                                        </div>

                                        <span className="text-muted-foreground text-lg">vs</span>

                                        <div className="flex items-center gap-1.5">
                                            <span
                                                className="inline-block h-5 w-5 rounded-full border-2 border-black dark:border-white"
                                                style={{ backgroundColor: match.team2?.color }}
                                                aria-hidden="true"
                                            ></span>
                                            <span className="font-semibold text-xl">
                                                {match.team2?.score ?? '?'}
                                            </span>
                                        </div>

                                        <span className="text-sm px-2.5 py-1 rounded-full bg-secondary text-secondary-foreground ml-1">{match.gameType}</span>
                                        {match.winner && (
                                            <span className={`text-sm px-2.5 py-1 rounded-full ml-1 font-medium ${
                                                match.winner === 'team1' ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' :
                                                match.winner === 'team2' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300' :
                                                'bg-gray-100 text-gray-800 dark:bg-gray-700/50 dark:text-gray-300'
                                            }`}>
                                                {match.winner === 'team1' ? 'Team 1 Wins' : match.winner === 'team2' ? 'Team 2 Wins' : 'Draw'}
                                            </span>
                                        )}
                                    </div>

                                    <div className="text-sm text-muted-foreground mb-2 space-y-1">
                                        <div className="flex items-start">
                                            <span className="inline-flex items-center gap-1.5 mr-2 min-w-[70px]">
                                                <span
                                                    className="inline-block h-4 w-4 rounded-full border-2 border-black dark:border-white"
                                                    style={{ backgroundColor: match.team1?.color }}
                                                    aria-hidden="true"
                                                ></span>
                                                <span className="font-medium">Team 1:</span>
                                            </span>
                                            <span>
                                                {match.team1?.players?.map(p =>
                                                    `${p.displayName}${formatPosition(p.position, match.gameType)}`
                                                ).join(' & ') || 'N/A'}
                                            </span>
                                        </div>
                                        <div className="flex items-start">
                                            <span className="inline-flex items-center gap-1.5 mr-2 min-w-[70px]">
                                                <span
                                                    className="inline-block h-4 w-4 rounded-full border-2 border-black dark:border-white"
                                                    style={{ backgroundColor: match.team2?.color }}
                                                    aria-hidden="true"
                                                ></span>
                                                <span className="font-medium">Team 2:</span>
                                            </span>
                                            <span>
                                                {match.team2?.players?.map(p =>
                                                    `${p.displayName}${formatPosition(p.position, match.gameType)}`
                                                ).join(' & ') || 'N/A'}
                                            </span>
                                        </div>
                                    </div>

                                    <p className="text-xs text-muted-foreground">
                                        Played: {formatPlayedAt(match.playedAt)}
                                    </p>
                                </div>

                                {canEditMatches && (
                                    <div className="flex gap-2 flex-shrink-0 sm:pt-1">
                                        <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => handleOpenEditMatchDialog(match)}>
                                            <Edit className="h-5 w-5" />
                                            <span className="sr-only">Edit Match</span>
                                        </Button>
                                        <Button variant="destructive" size="icon" className="h-9 w-9" onClick={() => handleOpenDeleteDialog(match.id)}>
                                            <Trash2 className="h-5 w-5" />
                                            <span className="sr-only">Delete Match</span>
                                        </Button>
                                    </div>
                                )}
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-12 border rounded-lg bg-muted/40">
                            <p className="text-muted-foreground mb-3">No matches have been recorded yet.</p>
                            {canEditMatches && (
                                <Button
                                    onClick={handleOpenAddMatchDialog}
                                    disabled={selectablePlayers.length < 1}
                                    size="sm"
                                >
                                    Record First Match
                                </Button>
                            )}
                        </div>
                    )}
                </div>
            </main>

            {group && (
                <MatchFormDialog
                    isOpen={isMatchDialogOpen}
                    onOpenChange={setIsMatchDialogOpen}
                    editingMatch={editingMatch}
                    group={group}
                    groupId={groupId}
                    selectablePlayers={selectablePlayers}
                    members={members}
                />
            )}

            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete the selected match record.
                    </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setMatchToDelete(null)}>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        Delete Match
                    </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
