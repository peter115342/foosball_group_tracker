'use client';

import { useState } from 'react';
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
import { Edit, Trash2 } from 'lucide-react';
import { doc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import MatchFormDialog from '@/components/matches/MatchFormDialog';
import { User } from 'firebase/auth';

interface PlayerWithPosition {
    uid: string;
    displayName: string;
    position?: 'attack' | 'defense';
}

interface MatchData {
    id: string;
    groupId: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createdAt: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    playedAt: any;
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

interface GroupData {
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

interface MatchesSectionProps {
    matches: MatchData[];
    matchesLoading: boolean;
    group: GroupData;
    groupId: string;
    selectablePlayers: SelectablePlayer[];
    members: Member[];
    user: User | null;
    canEditMatches: boolean;
    matchRateLimit: {
        lastMatchCreation: Date | null;
        cooldownRemaining: number;
    } | null;
    onMatchDialogOpenChange: (open: boolean) => void;
}

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

export default function MatchesSection({
    matches,
    matchesLoading,
    group,
    groupId,
    selectablePlayers,
    members,
    user,
    canEditMatches,
    matchRateLimit,
    onMatchDialogOpenChange
}: MatchesSectionProps) {
    const [isMatchDialogOpen, setIsMatchDialogOpen] = useState(false);
    const [editingMatch, setEditingMatch] = useState<MatchData | null>(null);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [matchToDelete, setMatchToDelete] = useState<string | null>(null);

    const handleOpenAddMatchDialog = () => {
        setEditingMatch(null);
        setIsMatchDialogOpen(true);
        onMatchDialogOpenChange(true);
    };

    const handleOpenEditMatchDialog = (match: MatchData) => {
        setEditingMatch(match);
        setIsMatchDialogOpen(true);
        onMatchDialogOpenChange(true);
    };

    const handleOpenDeleteDialog = (matchId: string) => {
        setMatchToDelete(matchId);
        setIsDeleteDialogOpen(true);
    };

    const handleMatchDialogOpenChange = (open: boolean) => {
        setIsMatchDialogOpen(open);
        onMatchDialogOpenChange(open);
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

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-semibold">Matches</h2>
                {canEditMatches && (
                    <Button
                        onClick={handleOpenAddMatchDialog}
                        disabled={selectablePlayers.length < 1 || !! (matchRateLimit && matchRateLimit.cooldownRemaining > 0)}
                        size="sm"
                    >
                        {matchRateLimit && matchRateLimit.cooldownRemaining > 0 
                            ? `Add Match (${matchRateLimit.cooldownRemaining}s)` 
                            : 'Add Match'}
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
                                disabled={selectablePlayers.length < 1 || !! (matchRateLimit && matchRateLimit.cooldownRemaining > 0)}
                                size="sm"
                            >
                                {matchRateLimit && matchRateLimit.cooldownRemaining > 0 
                                    ? `Record First Match (${matchRateLimit.cooldownRemaining}s)` 
                                    : 'Record First Match'}
                            </Button>
                        )}
                    </div>
                )}
            </div>

            {group && (
                <MatchFormDialog
                    isOpen={isMatchDialogOpen}
                    onOpenChange={handleMatchDialogOpenChange}
                    editingMatch={editingMatch}
                    group={group}
                    groupId={groupId}
                    selectablePlayers={selectablePlayers}
                    members={members}
                    user={user || { uid: '', displayName: null }}
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
