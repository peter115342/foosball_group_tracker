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

// --- Interfaces ---
interface GroupData extends DocumentData {
    id: string;
    name: string;
    adminUid: string;
    adminName?: string;
    members: {
        [uid: string]: {
            name: string;
            isMember: boolean;
            isAdmin?: boolean;
        };
    };
    guests?: Array<{id: string; name: string}>;
    teamColors: {
        teamOne: string;
        teamTwo: string;
    };
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

// --- Helper Functions ---
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

    // --- Data Fetching Effects ---
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

                if (!groupData.members || !groupData.members[user.uid]?.isMember) {
                    setError("Access Denied: You are not a member of this group.");
                    setGroup(null);
                    setMembers([]);
                    setSelectablePlayers([]);
                } else {
                    setGroup(groupData);

                    const fetchedMembers: Member[] = Object.entries(groupData.members)
                        .filter(([, memberData]) => memberData.isMember)
                        .map(([uid, memberData]) => ({
                            uid: uid,
                            displayName: memberData.name || `User ${uid.substring(0, 5)}`
                        }));
                    setMembers(fetchedMembers);

                    // --- IMPROVED GUEST PROCESSING ---
                    const guests: SelectablePlayer[] = [];
                    
                    if (Array.isArray(groupData.guests)) {
                        for (let i = 0; i < groupData.guests.length; i++) {
                            const guest = groupData.guests[i];
                            
                            console.log(`Processing guest ${i}:`, JSON.stringify(guest));
                            
                            if (guest && typeof guest.id === 'string' && typeof guest.name === 'string') {
                                guests.push({
                                    uid: `${GUEST_PREFIX}${guest.id}`,
                                    displayName: `${guest.name} (Guest)`
                                });
                            } else {
                                console.warn(`Invalid guest at index ${i}:`, guest);
                            }
                        }
                    }
                    // --- END IMPROVED GUEST PROCESSING ---
                    
                    console.log("Processed guests:", guests);

                    const combinedPlayers = [...fetchedMembers, ...guests].sort((a, b) =>
                        a.displayName.localeCompare(b.displayName)
                    );
                    
                    console.log("Final combined players:", combinedPlayers);
                    setSelectablePlayers(combinedPlayers);
                }
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
        if (!groupId || !group || error) {
            setMatches([]);
            setMatchesLoading(!group && !error);
            return;
        }

        setMatchesLoading(true);
        const matchesCollectionRef = collection(db, "matches");
        const q = query(matchesCollectionRef, where("groupId", "==", groupId), orderBy("createdAt", "desc"));

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
    }, [groupId, group, error]);

    // --- Dialog/Delete Handlers ---
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
        if (!matchToDelete) return;
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

    // --- Render Logic ---
    if (authLoading || groupLoading) {
        return (
             <div className="flex flex-col items-center justify-center min-h-screen p-8">
                 <Skeleton className="h-8 w-48 mb-4" />
                 <Skeleton className="h-6 w-32 mb-6" />
                 <Skeleton className="h-10 w-32 mb-8" />
                 <div className="w-full max-w-2xl space-y-4">
                     <Skeleton className="h-16 w-full" />
                     <Skeleton className="h-16 w-full" />
                 </div>
             </div>
         );
    }

    if (error) {
        return (
             <div className="flex flex-col items-center justify-center min-h-screen p-8 text-red-600">
                 <p>{error}</p>
                 <Button onClick={() => router.push('/dashboard')} className="mt-4">Back to Dashboard</Button>
             </div>
         );
    }

    if (!group) {
         return <div className="flex items-center justify-center min-h-screen">Group not found or loading...</div>;
    }

    return (
        <div className="container mx-auto p-4 md:p-8">
            {/* Header */}
            <header className="mb-8">
                <h1 className="text-3xl font-bold mb-2">{group.name}</h1>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>Team 1: <span className="inline-block h-4 w-4 rounded-full border" style={{ backgroundColor: group.teamColors.teamOne }}></span></span>
                    <span>Team 2: <span className="inline-block h-4 w-4 rounded-full border" style={{ backgroundColor: group.teamColors.teamTwo }}></span></span>
                    {group.adminName && <span className="ml-auto">Admin: {formatAdminDisplayName(group.adminName)}</span>}
                </div>
            </header>

            {/* Main Content */}
            <main>
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-semibold">Matches</h2>
                    {/* Disable button if no players (members or guests) are available */}
                    <Button 
                        onClick={handleOpenAddMatchDialog} 
                        disabled={!group || selectablePlayers.length < 2}
                    >
                        Add Match
                    </Button>
                </div>

                {/* Match List */}
                <div className="space-y-4">
                    {matchesLoading ? (
                        <>
                            <Skeleton className="h-20 w-full" />
                            <Skeleton className="h-20 w-full" />
                        </>
                    ) : matches.length > 0 ? (
                        matches.map((match) => (
                            <div key={match.id} className="border rounded-lg p-4 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                                <div className="flex-grow">
                                    <div className="flex items-center gap-4 mb-1">
                                        <span className="font-semibold text-lg" style={{ color: match.team1?.color }}>
                                            {match.team1?.score ?? '?'}
                                        </span>
                                        <span className="text-muted-foreground">:</span>
                                         <span className="font-semibold text-lg" style={{ color: match.team2?.color }}>
                                            {match.team2?.score ?? '?'}
                                        </span>
                                        <span className="text-xs px-2 py-0.5 rounded bg-secondary text-secondary-foreground ml-2">{match.gameType}</span>
                                        {match.winner && <span className={`text-xs px-2 py-0.5 rounded ml-2 ${match.winner === 'team1' ? 'bg-green-100 text-green-800' : match.winner === 'team2' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>
                                            Winner: {match.winner === 'team1' ? 'Team 1' : match.winner === 'team2' ? 'Team 2' : 'Draw'}
                                        </span>}
                                    </div>
                                    <div className="text-sm text-muted-foreground mb-2">
                                        <span style={{ color: match.team1?.color }}>Team 1:</span> {match.team1?.players?.map(p => 
                                            `${p.displayName}${formatPosition(p.position, match.gameType)}`
                                        ).join(' & ') || 'N/A'}
                                        <span className="mx-2">|</span>
                                        <span style={{ color: match.team2?.color }}>Team 2:</span> {match.team2?.players?.map(p => 
                                            `${p.displayName}${formatPosition(p.position, match.gameType)}`
                                        ).join(' & ') || 'N/A'}
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        Played: {match.playedAt?.toDate().toLocaleString() ?? 'Unknown date'}
                                    </p>
                                </div>
                                <div className="flex gap-2 flex-shrink-0">
                                    <Button variant="outline" size="sm" onClick={() => handleOpenEditMatchDialog(match)}>Edit</Button>
                                    <Button variant="destructive" size="sm" onClick={() => handleOpenDeleteDialog(match.id)}>Delete</Button>
                                </div>
                            </div>
                        ))
                    ) : (
                        <p className="text-center text-muted-foreground py-8">No matches recorded yet.</p>
                    )}
                </div>
            </main>

            {/* Match Form Dialog Component */}
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

            {/* Delete Confirmation AlertDialog */}
            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete the match record.
                    </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setMatchToDelete(null)}>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        Delete
                    </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
