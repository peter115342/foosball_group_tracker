'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/authContext'; // Corrected import path
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
    addDoc,
    updateDoc,
    serverTimestamp,
    Timestamp,
    // getDoc // Import getDoc if you implement real user fetching later
} from 'firebase/firestore';
import { useForm, SubmitHandler, Controller } from "react-hook-form";
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
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

// --- Interfaces ---
interface GroupData extends DocumentData {
    id: string;
    name: string;
    adminUid: string;
    adminName?: string; // Added from dashboard changes
    members: { // Updated structure
        [uid: string]: {
            name: string;
            isMember: boolean;
            isAdmin?: boolean;
        };
    };
    guests?: string[]; // Added from dashboard changes
    teamColors: {
        teamOne: string;
        teamTwo: string;
    };
}

// Interface for actual members (fetched or constructed)
interface Member {
    uid: string;
    displayName: string;
}

// Interface for combined list used in dropdowns
interface SelectablePlayer {
    uid: string; // Real UID or generated guest ID (e.g., "guest_John Doe")
    displayName: string; // Display name, potentially with "(Guest)" suffix
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
        players: { uid: string; displayName: string }[]; // uid can be real or guest ID
    };
    team2: {
        color: string;
        score: number;
        players: { uid: string; displayName: string }[]; // uid can be real or guest ID
    };
    winner: 'team1' | 'team2' | 'draw';
}

// --- Form Input Type ---
type MatchFormInputs = {
    gameType: '1v1' | '2v2';
    team1Player1: string; // UID or guest ID
    team1Player2?: string; // UID or guest ID | undefined
    team2Player1: string; // UID or guest ID
    team2Player2?: string; // UID or guest ID | undefined
    team1Score: number;
    team2Score: number;
    playedAt: string; // ISO string from datetime-local input
};

// --- Helper Functions ---
const formatAdminDisplayName = (fullName: string | null | undefined): string => {
    if (!fullName) return 'N/A';
    const parts = fullName.trim().split(' ');
    if (parts.length <= 1) return fullName;
    const firstParts = parts.slice(0, -1).join(' ');
    const lastInitial = parts[parts.length - 1].charAt(0);
    return `${firstParts} ${lastInitial}.`;
};

const formatTimestampForInput = (timestamp: Timestamp | undefined): string => {
    if (!timestamp) return '';
    const date = timestamp.toDate();
    const timezoneOffset = date.getTimezoneOffset() * 60000;
    const localISOTime = new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16);
    return localISOTime;
};

const GUEST_PREFIX = 'guest_'; // Prefix for guest IDs

export default function GroupDetailPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const params = useParams();
    const groupId = params.groupId as string;

    const [group, setGroup] = useState<GroupData | null>(null);
    const [members, setMembers] = useState<Member[]>([]); // Authenticated members
    const [selectablePlayers, setSelectablePlayers] = useState<SelectablePlayer[]>([]); // Combined list for dropdowns
    const [matches, setMatches] = useState<MatchData[]>([]);
    const [groupLoading, setGroupLoading] = useState(true);
    const [matchesLoading, setMatchesLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [isMatchDialogOpen, setIsMatchDialogOpen] = useState(false);
    const [editingMatch, setEditingMatch] = useState<MatchData | null>(null);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [matchToDelete, setMatchToDelete] = useState<string | null>(null);
    const [isSubmittingMatch, setIsSubmittingMatch] = useState(false);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { register, handleSubmit, reset, control, watch, setValue, formState: { errors } } = useForm<MatchFormInputs>({
        defaultValues: {
            gameType: '1v1',
            team1Player1: '',
            team1Player2: '',
            team2Player1: '',
            team2Player2: '',
            team1Score: 0,
            team2Score: 0,
            playedAt: formatTimestampForInput(Timestamp.now()),
        }
    });
    const watchedGameType = watch('gameType');

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

                // Use updated check based on new members structure
                if (!groupData.members || !groupData.members[user.uid]?.isMember) {
                    setError("Access Denied: You are not a member of this group.");
                    setGroup(null);
                    setMembers([]);
                    setSelectablePlayers([]);
                } else {
                    setGroup(groupData);

                    // Extract authenticated members
                    const fetchedMembers: Member[] = Object.entries(groupData.members)
                        // eslint-disable-next-line @typescript-eslint/no-unused-vars
                        .filter(([uid, memberData]) => memberData.isMember)
                        .map(([uid, memberData]) => ({
                            uid: uid,
                            displayName: memberData.name || `User ${uid.substring(0, 5)}`
                        }));
                    setMembers(fetchedMembers);

                    const guests: SelectablePlayer[] = (groupData.guests || []).map(guestName => ({
                        uid: `${GUEST_PREFIX}${guestName}`,
                        displayName: `${guestName} (Guest)`
                    }));

                    const combinedPlayers = [...fetchedMembers, ...guests].sort((a, b) =>
                        a.displayName.localeCompare(b.displayName)
                    );
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

    // --- Effect to Reset Form ---
    useEffect(() => {
        if (editingMatch && group) {
            reset({
                gameType: editingMatch.gameType,
                team1Player1: editingMatch.team1.players[0]?.uid ?? '',
                team1Player2: editingMatch.team1.players[1]?.uid ?? '',
                team2Player1: editingMatch.team2.players[0]?.uid ?? '',
                team2Player2: editingMatch.team2.players[1]?.uid ?? '',
                team1Score: editingMatch.team1.score,
                team2Score: editingMatch.team2.score,
                playedAt: formatTimestampForInput(editingMatch.playedAt),
            });
        } else {
            reset({
                gameType: '1v1',
                team1Player1: '',
                team1Player2: '',
                team2Player1: '',
                team2Player2: '',
                team1Score: 0,
                team2Score: 0,
                playedAt: formatTimestampForInput(Timestamp.now()),
            });
        }
    }, [editingMatch, isMatchDialogOpen, reset, group]);


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

    // --- Form Submission Handler ---
    const onSubmitMatch: SubmitHandler<MatchFormInputs> = async (data) => {
        if (!group || !user) return;

        setIsSubmittingMatch(true);

        // --- Basic Validation ---
        const players = [data.team1Player1, data.team1Player2, data.team2Player1, data.team2Player2].filter(Boolean);
        const uniquePlayers = new Set(players);

        if (data.gameType === '1v1') {
            if (!data.team1Player1 || !data.team2Player1) {
                 toast.error("Validation Error", { description: "Please select one player for each team." });
                 setIsSubmittingMatch(false);
                 return;
            }
            if (data.team1Player1 === data.team2Player1) {
                toast.error("Validation Error", { description: "A player cannot be on both teams." });
                setIsSubmittingMatch(false);
                return;
            }
        } else { // 2v2
             if (!data.team1Player1 || !data.team1Player2 || !data.team2Player1 || !data.team2Player2) {
                 toast.error("Validation Error", { description: "Please select two players for each team." });
                 setIsSubmittingMatch(false);
                 return;
             }
             if (players.length !== uniquePlayers.size) {
                 toast.error("Validation Error", { description: "Each player can only be selected once per match." });
                 setIsSubmittingMatch(false);
                 return;
             }
        }
        if (data.team1Score < 0 || data.team2Score < 0) {
             toast.error("Validation Error", { description: "Scores cannot be negative." });
             setIsSubmittingMatch(false);
             return;
        }
        // --- End Validation ---

        try {
            // Updated function to handle both real UIDs and guest IDs
            const getPlayerDetails = (playerId: string | undefined): { uid: string; displayName: string } | null => {
                if (!playerId) return null;

                if (playerId.startsWith(GUEST_PREFIX)) {
                    // It's a guest
                    const guestName = playerId.substring(GUEST_PREFIX.length);
                    return { uid: playerId, displayName: guestName }; // Store the prefixed ID, use real name for display
                } else {
                    // It's a real member
                    const member = members.find(m => m.uid === playerId);
                    // Use the displayName from the fetched members state
                    return member ? { uid: member.uid, displayName: member.displayName } : null;
                }
            };

            const team1Players = [getPlayerDetails(data.team1Player1), getPlayerDetails(data.team1Player2)].filter(Boolean) as { uid: string; displayName: string }[];
            const team2Players = [getPlayerDetails(data.team2Player1), getPlayerDetails(data.team2Player2)].filter(Boolean) as { uid: string; displayName: string }[];

            let winner: 'team1' | 'team2' | 'draw';
            if (data.team1Score > data.team2Score) winner = 'team1';
            else if (data.team2Score > data.team1Score) winner = 'team2';
            else winner = 'draw';

            const matchDocData = {
                groupId: groupId,
                playedAt: data.playedAt ? Timestamp.fromDate(new Date(data.playedAt)) : Timestamp.now(),
                gameType: data.gameType,
                team1: {
                    color: group.teamColors.teamOne,
                    score: Number(data.team1Score),
                    players: team1Players, // Contains correct displayName for guests now
                },
                team2: {
                    color: group.teamColors.teamTwo,
                    score: Number(data.team2Score),
                    players: team2Players, // Contains correct displayName for guests now
                },
                winner: winner,
            };

            if (editingMatch) {
                const matchRef = doc(db, "matches", editingMatch.id);
                await updateDoc(matchRef, {
                    ...matchDocData,
                    updatedAt: serverTimestamp()
                });
                toast.success("Match updated successfully!");
            } else {
                await addDoc(collection(db, "matches"), {
                    ...matchDocData,
                    createdAt: serverTimestamp(),
                });
                toast.success("Match added successfully!");
            }

            setIsMatchDialogOpen(false);
            setEditingMatch(null);

        } catch (err) {
            console.error("Error saving match:", err);
            toast.error("Error saving match", { description: (err as Error).message });
        } finally {
            setIsSubmittingMatch(false);
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
                    <Button onClick={handleOpenAddMatchDialog} disabled={!group || selectablePlayers.length < (watchedGameType === '1v1' ? 2 : 4)}>
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
                                        <span className="text-muted-foreground">vs</span>
                                         <span className="font-semibold text-lg" style={{ color: match.team2?.color }}>
                                            {match.team2?.score ?? '?'}
                                        </span>
                                        <span className="text-xs px-2 py-0.5 rounded bg-secondary text-secondary-foreground ml-2">{match.gameType}</span>
                                       <span className="text-xs px-2 py-0.5 rounded bg-secondary text-secondary-foreground ml-2">{match.gameType}</span>
                                        {match.winner && <span className={`text-xs px-2 py-0.5 rounded ml-2 ${match.winner === 'team1' ? 'bg-green-100 text-green-800' : match.winner === 'team2' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>
                                            Winner: {match.winner === 'team1' ? 'Team 1' : match.winner === 'team2' ? 'Team 2' : 'Draw'}
                                        </span>}
                                    </div>
                                    <div className="text-sm text-muted-foreground mb-2">
                                        <span style={{ color: match.team1?.color }}>Team 1:</span> {match.team1?.players?.map(p => p.displayName).join(' & ') || 'N/A'}
                                        <span className="mx-2">|</span>
                                        <span style={{ color: match.team2?.color }}>Team 2:</span> {match.team2?.players?.map(p => p.displayName).join(' & ') || 'N/A'}
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

            {/* Add/Edit Match Dialog */}
            <Dialog open={isMatchDialogOpen} onOpenChange={setIsMatchDialogOpen}>
                <DialogContent className="sm:max-w-[525px]">
                    <DialogHeader>
                        <DialogTitle>{editingMatch ? 'Edit Match' : 'Add New Match'}</DialogTitle>
                        <DialogDescription>
                            Record the details of the foosball match.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit(onSubmitMatch)}>
                        <div className="grid gap-4 py-4">
                            {/* Game Type */}
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label className="text-right">Game Type</Label>
                                <Controller
                                    name="gameType"
                                    control={control}
                                    render={({ field }) => (
                                        <RadioGroup
                                            onValueChange={field.onChange}
                                            value={field.value}
                                            className="col-span-3 flex gap-4"
                                            disabled={isSubmittingMatch}
                                        >
                                            <div className="flex items-center space-x-2">
                                                <RadioGroupItem value="1v1" id="r1" />
                                                <Label htmlFor="r1">1 vs 1</Label>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <RadioGroupItem value="2v2" id="r2" />
                                                <Label htmlFor="r2">2 vs 2</Label>
                                            </div>
                                        </RadioGroup>
                                    )}
                                />
                            </div>

                            {/* Team 1 Players */}
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="t1p1" className="text-right" style={{ color: group?.teamColors?.teamOne }}>
                                    Team 1 Player 1
                                </Label>
                                <Controller
                                    name="team1Player1"
                                    control={control}
                                    rules={{ required: 'Player is required' }}
                                    render={({ field }) => (
                                        <Select onValueChange={field.onChange} value={field.value} disabled={isSubmittingMatch}>
                                            <SelectTrigger id="t1p1" className="col-span-3">
                                                <SelectValue placeholder="Select player" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {selectablePlayers.map(player => (
                                                    <SelectItem key={player.uid} value={player.uid}>
                                                        {player.displayName}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    )}
                                />
                                {errors.team1Player1 && <p className="col-span-4 text-red-500 text-sm text-right">{errors.team1Player1.message}</p>}
                            </div>
                            {watchedGameType === '2v2' && (
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="t1p2" className="text-right" style={{ color: group?.teamColors?.teamOne }}>
                                        Team 1 Player 2
                                    </Label>
                                    <Controller
                                        name="team1Player2"
                                        control={control}
                                        rules={{ required: 'Player is required for 2v2' }}
                                        render={({ field }) => (
                                            <Select onValueChange={field.onChange} value={field.value} disabled={isSubmittingMatch}>
                                                <SelectTrigger id="t1p2" className="col-span-3">
                                                    <SelectValue placeholder="Select player" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {selectablePlayers.map(player => (
                                                        <SelectItem key={player.uid} value={player.uid}>
                                                            {player.displayName}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        )}
                                    />
                                    {errors.team1Player2 && <p className="col-span-4 text-red-500 text-sm text-right">{errors.team1Player2.message}</p>}
                                </div>
                            )}

                            {/* Team 2 Players */}
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="t2p1" className="text-right" style={{ color: group?.teamColors?.teamTwo }}>
                                    Team 2 Player 1
                                </Label>
                                <Controller
                                    name="team2Player1"
                                    control={control}
                                    rules={{ required: 'Player is required' }}
                                    render={({ field }) => (
                                        <Select onValueChange={field.onChange} value={field.value} disabled={isSubmittingMatch}>
                                            <SelectTrigger id="t2p1" className="col-span-3">
                                                <SelectValue placeholder="Select player" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {selectablePlayers.map(player => (
                                                    <SelectItem key={player.uid} value={player.uid}>
                                                        {player.displayName}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    )}
                                />
                                {errors.team2Player1 && <p className="col-span-4 text-red-500 text-sm text-right">{errors.team2Player1.message}</p>}
                            </div>
                            {watchedGameType === '2v2' && (
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="t2p2" className="text-right" style={{ color: group?.teamColors?.teamTwo }}>
                                        Team 2 Player 2
                                    </Label>
                                    <Controller
                                        name="team2Player2"
                                        control={control}
                                        rules={{ required: 'Player is required for 2v2' }}
                                        render={({ field }) => (
                                            <Select onValueChange={field.onChange} value={field.value} disabled={isSubmittingMatch}>
                                                <SelectTrigger id="t2p2" className="col-span-3">
                                                    <SelectValue placeholder="Select player" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {selectablePlayers.map(player => (
                                                        <SelectItem key={player.uid} value={player.uid}>
                                                            {player.displayName}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        )}
                                    />
                                    {errors.team2Player2 && <p className="col-span-4 text-red-500 text-sm text-right">{errors.team2Player2.message}</p>}
                                </div>
                            )}

                            {/* Scores */}
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="t1score" className="text-right" style={{ color: group?.teamColors?.teamOne }}>
                                    Team 1 Score
                                </Label>
                                <Input
                                    id="t1score"
                                    type="number"
                                    min="0"
                                    className="col-span-3"
                                    {...register("team1Score", { required: true, valueAsNumber: true, min: 0 })}
                                    disabled={isSubmittingMatch}
                                />
                                {errors.team1Score && <p className="col-span-4 text-red-500 text-sm text-right">Score is required and must be 0 or more.</p>}
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="t2score" className="text-right" style={{ color: group?.teamColors?.teamTwo }}>
                                    Team 2 Score
                                </Label>
                                <Input
                                    id="t2score"
                                    type="number"
                                    min="0"
                                    className="col-span-3"
                                    {...register("team2Score", { required: true, valueAsNumber: true, min: 0 })}
                                    disabled={isSubmittingMatch}
                                />
                                {errors.team2Score && <p className="col-span-4 text-red-500 text-sm text-right">Score is required and must be 0 or more.</p>}
                            </div>

                             {/* Played At */}
                             <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="playedAt" className="text-right">
                                    Played At
                                </Label>
                                <Input
                                    id="playedAt"
                                    type="datetime-local"
                                    className="col-span-3"
                                    {...register("playedAt", { required: "Date and time are required" })}
                                    disabled={isSubmittingMatch}
                                />
                                {errors.playedAt && <p className="col-span-4 text-red-500 text-sm text-right">{errors.playedAt.message}</p>}
                            </div>

                        </div>
                        <DialogFooter>
                            <DialogClose asChild>
                                <Button type="button" variant="outline" disabled={isSubmittingMatch}>Cancel</Button>
                            </DialogClose>
                            <Button type="submit" disabled={isSubmittingMatch}>
                                {isSubmittingMatch ? (editingMatch ? 'Saving...' : 'Adding...') : (editingMatch ? 'Save Changes' : 'Add Match')}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

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
