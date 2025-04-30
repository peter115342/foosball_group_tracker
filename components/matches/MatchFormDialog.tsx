'use client';

import { useState, useEffect } from 'react';
import { useForm, SubmitHandler, Controller } from "react-hook-form";
import { addDoc, collection, doc, serverTimestamp, Timestamp, updateDoc, getDoc} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { toast } from "sonner";

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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

interface SelectablePlayer {
    uid: string;
    displayName: string;
}

interface GroupData {
    id: string;
    teamColors: {
        teamOne: string;
        teamTwo: string;
    };
}

interface PlayerWithPosition {
    uid: string;
    displayName: string;
    position?: 'attack' | 'defense';
}

interface MatchData {
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

type MatchFormInputs = {
    gameType: '1v1' | '2v2';
    team1Player1: string;
    team1Player2?: string;
    team2Player1: string;
    team2Player2?: string;
    team1Score: number;
    team2Score: number;
    playedAt: string;
};

const GUEST_PREFIX = 'guest_';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const formatTimestampForInput = (timestamp: any): string => {
    if (!timestamp) return '';
    
    try {
        if (typeof timestamp.toDate === 'function') {
            return timestamp.toDate().toISOString().split('T')[0];
        } 
        else if (typeof timestamp === 'object' && 'seconds' in timestamp) {
            const date = new Date(timestamp.seconds * 1000);
            return date.toISOString().split('T')[0];
        }
        else if (typeof timestamp === 'string') {
            const date = new Date(timestamp);
            if (!isNaN(date.getTime())) {
                return date.toISOString().split('T')[0];
            }
        }
        return '';
    } catch (err) {
        console.error("Error formatting date for input:", err, timestamp);
        return '';
    }
};

interface MatchFormDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    editingMatch: MatchData | null;
    group: GroupData;
    groupId: string;
    selectablePlayers: SelectablePlayer[];
    members: Array<{ uid: string; displayName: string }>;
    user: { uid: string; displayName: string | null };
}

export default function MatchFormDialog({
    isOpen,
    onOpenChange,
    editingMatch,
    group,
    groupId,
    selectablePlayers,
    members,
    user
}: MatchFormDialogProps) {
    const [isSubmittingMatch, setIsSubmittingMatch] = useState(false);
    const [normalizedPlayers, setNormalizedPlayers] = useState<SelectablePlayer[]>([]);
    const [rateLimit, setRateLimit] = useState<{
        lastMatchCreation: Date | null;
        cooldownRemaining: number;
    } | null>(null);

    useEffect(() => {
        if (user?.uid && isOpen) {
            const fetchRateLimits = async () => {
                try {
                    const ratelimitRef = doc(db, 'matchRatelimits', user.uid);
                    const ratelimitDoc = await getDoc(ratelimitRef);
                    
                    if (ratelimitDoc.exists()) {
                        const data = ratelimitDoc.data();
                        const lastCreation = data.lastMatchCreation ?
                            data.lastMatchCreation.toDate() : null;
                        
                        let cooldownRemaining = 0;
                        if (lastCreation) {
                            const cooldownEnd = new Date(lastCreation.getTime() + (10 * 1000));
                            cooldownRemaining = Math.max(0,
                                Math.floor((cooldownEnd.getTime() - Date.now()) / 1000));
                        }
                        
                        setRateLimit({
                            lastMatchCreation: lastCreation,
                            cooldownRemaining
                        });
                    } else {
                        setRateLimit({
                            lastMatchCreation: null,
                            cooldownRemaining: 0
                        });
                    }
                } catch (error) {
                    console.error("Error fetching match rate limits:", error);
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
    }, [user?.uid, isOpen, rateLimit?.cooldownRemaining]);

    useEffect(() => {
        const safeSelectablePlayers = Array.isArray(selectablePlayers) ? selectablePlayers : [];
        const validPlayers: SelectablePlayer[] = [];

        for (let i = 0; i < safeSelectablePlayers.length; i++) {
            const player = safeSelectablePlayers[i];

            if (player &&
                typeof player.uid === 'string' &&
                typeof player.displayName === 'string' &&
                !player.uid.includes('[object Object]')) {

                validPlayers.push({
                    uid: player.uid,
                    displayName: player.displayName
                });
            } else {
                if (player && player.uid && player.uid.includes('[object Object]')) {
                    if (typeof player.displayName === 'string') {
                        const sanitizedUid = `guest_fallback_${i}_${Date.now()}`;
                        validPlayers.push({
                            uid: sanitizedUid,
                            displayName: player.displayName.replace(' (Guest)', '') + ' (Guest)'
                        });
                    }
                }
            }
        }
        setNormalizedPlayers(validPlayers);

    }, [selectablePlayers]);

    const findPlayerByPosition = (players: PlayerWithPosition[], position: 'attack' | 'defense'): string => {
        if (!players || players.length === 0) return '';
        const player = players.find(p => p.position === position);
        return player?.uid || '';
    };

    const team1DefensePlayer = editingMatch?.gameType === '2v2'
        ? findPlayerByPosition(editingMatch.team1.players, 'defense')
        : editingMatch?.team1.players[0]?.uid || '';

    const team1AttackPlayer = editingMatch?.gameType === '2v2'
        ? findPlayerByPosition(editingMatch.team1.players, 'attack')
        : '';

    const team2DefensePlayer = editingMatch?.gameType === '2v2'
        ? findPlayerByPosition(editingMatch.team2.players, 'defense')
        : editingMatch?.team2.players[0]?.uid || '';

    const team2AttackPlayer = editingMatch?.gameType === '2v2'
        ? findPlayerByPosition(editingMatch.team2.players, 'attack')
        : '';

    const { register, handleSubmit, reset, control, watch, formState: { errors } } = useForm<MatchFormInputs>({
        defaultValues: {
            gameType: editingMatch?.gameType || '2v2',
            team1Player1: team1DefensePlayer,
            team1Player2: team1AttackPlayer,
            team2Player1: team2DefensePlayer,
            team2Player2: team2AttackPlayer,
            team1Score: editingMatch?.team1.score || 0,
            team2Score: editingMatch?.team2.score || 0,
            playedAt: formatTimestampForInput(editingMatch?.playedAt || Timestamp.now()),
        }
    });

    useEffect(() => {
        if (editingMatch) {
            const team1DefensePlayer = editingMatch.gameType === '2v2'
                ? findPlayerByPosition(editingMatch.team1.players, 'defense')
                : editingMatch.team1.players[0]?.uid || '';

            const team1AttackPlayer = editingMatch.gameType === '2v2'
                ? findPlayerByPosition(editingMatch.team1.players, 'attack')
                : '';

            const team2DefensePlayer = editingMatch.gameType === '2v2'
                ? findPlayerByPosition(editingMatch.team2.players, 'defense')
                : editingMatch.team2.players[0]?.uid || '';

            const team2AttackPlayer = editingMatch.gameType === '2v2'
                ? findPlayerByPosition(editingMatch.team2.players, 'attack')
                : '';

            reset({
                gameType: editingMatch.gameType || '2v2',
                team1Player1: team1DefensePlayer,
                team1Player2: team1AttackPlayer,
                team2Player1: team2DefensePlayer,
                team2Player2: team2AttackPlayer,
                team1Score: editingMatch.team1.score || 0,
                team2Score: editingMatch.team2.score || 0,
                playedAt: formatTimestampForInput(editingMatch.playedAt || Timestamp.now()),
            });
        } else {
            reset({
                gameType: '2v2',
                team1Player1: '',
                team1Player2: '',
                team2Player1: '',
                team2Player2: '',
                team1Score: 0,
                team2Score: 0,
                playedAt: formatTimestampForInput(Timestamp.now()),
            });
        }
    }, [editingMatch, reset]);

    const watchedGameType = watch('gameType');

    const onSubmitMatch: SubmitHandler<MatchFormInputs> = async (data) => {
        setIsSubmittingMatch(true);

        if (rateLimit && rateLimit.cooldownRemaining > 0 && !editingMatch) {
            toast.error("Rate limit cooldown active", {
                description: `Please wait ${rateLimit.cooldownRemaining}s before creating another match.`
            });
            setIsSubmittingMatch(false);
            return;
        }

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
        } else {
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

        try {
            const getPlayerDetails = (playerId: string | undefined, positionParam?: 'attack' | 'defense'): PlayerWithPosition | null => {
                if (!playerId) return null;

                const safePosition = positionParam;

                if (typeof playerId !== 'string' || playerId.includes('[object Object]')) {
                    return null;
                }

                let playerData: PlayerWithPosition;

                if (playerId.startsWith(GUEST_PREFIX)) {
                    const guestPlayer = normalizedPlayers.find(p => p.uid === playerId);
                    if (guestPlayer) {
                        playerData = {
                            uid: playerId,
                            displayName: (guestPlayer.displayName || '').replace(' (Guest)', '') || 'Guest',
                            position: safePosition
                        };
                    } else {
                        const guestId = playerId.substring(GUEST_PREFIX.length);
                        playerData = {
                            uid: playerId,
                            displayName: `Guest ${guestId.substring(0, 5)}`,
                            position: safePosition
                        };
                    }
                } else {
                    const member = members.find(m => m.uid === playerId);
                    if (member) {
                        playerData = {
                            uid: member.uid || playerId,
                            displayName: member.displayName || 'Player',
                            position: safePosition
                        };
                    } else {
                        playerData = {
                            uid: playerId,
                            displayName: 'Unknown Player',
                            position: safePosition
                        };
                    }
                }

                return {
                    uid: playerData.uid || `player_${Date.now()}`,
                    displayName: playerData.displayName || 'Player',
                    position: playerData.position
                };
            };

            const team1Players = data.gameType === '1v1'
                ? [getPlayerDetails(data.team1Player1)]
                : [
                    getPlayerDetails(data.team1Player1, 'defense'),
                    getPlayerDetails(data.team1Player2, 'attack')
                  ];

            const team2Players = data.gameType === '1v1'
                ? [getPlayerDetails(data.team2Player1)]
                : [
                    getPlayerDetails(data.team2Player1, 'defense'),
                    getPlayerDetails(data.team2Player2, 'attack')
                  ];

            const filteredTeam1Players = team1Players.filter(Boolean) as PlayerWithPosition[];
            const filteredTeam2Players = team2Players.filter(Boolean) as PlayerWithPosition[];

            if (filteredTeam1Players.length === 0 || filteredTeam2Players.length === 0) {
                toast.error("Error", { description: "Invalid player selections. Please try again." });
                setIsSubmittingMatch(false);
                return;
            }

            let winner: 'team1' | 'team2' | 'draw';
            if (data.team1Score > data.team2Score) winner = 'team1';
            else if (data.team2Score > data.team1Score) winner = 'team2';
            else winner = 'draw';

            let playedAtTimestamp: Timestamp;
            try {
                if (!data.playedAt || data.playedAt.trim() === '') {
                    playedAtTimestamp = Timestamp.now();
                } else {
                    const playedAtDate = new Date(data.playedAt);
                    if (isNaN(playedAtDate.getTime())) {
                        throw new Error("Invalid date format");
                    }
                    playedAtDate.setHours(12, 0, 0, 0);
                    playedAtTimestamp = Timestamp.fromDate(playedAtDate);
                }
            } catch (error) {
                console.warn("Invalid date conversion, using current time:", error);
                playedAtTimestamp = Timestamp.now();
            }

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const cleanObject = (obj: any): any => {
                if (obj === null || obj === undefined) return null;
                if (typeof obj !== 'object') return obj;

                if (Array.isArray(obj)) {
                    return obj.map(item => cleanObject(item));
                }

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const cleaned: any = {};
                for (const key in obj) {
                    if (Object.prototype.hasOwnProperty.call(obj, key)) {
                        if (obj[key] !== undefined) {
                            cleaned[key] = cleanObject(obj[key]);
                        }
                    }
                }
                return cleaned;
            };

            const matchDocData = {
                groupId: groupId || '',
                playedAt: playedAtTimestamp,
                gameType: data.gameType || '1v1',
                team1: {
                    color: (group?.teamColors?.teamOne) || '#FF0000',
                    score: Number(data.team1Score) || 0,
                    players: filteredTeam1Players.map(player => ({
                        uid: player?.uid || `player_${Math.random().toString(36).substring(2, 9)}`,
                        displayName: player?.displayName || 'Player',
                        position: player?.position
                    }))
                },
                team2: {
                    color: (group?.teamColors?.teamTwo) || '#0000FF',
                    score: Number(data.team2Score) || 0,
                    players: filteredTeam2Players.map(player => ({
                        uid: player?.uid || `player_${Math.random().toString(36).substring(2, 9)}`,
                        displayName: player?.displayName || 'Player',
                        position: player?.position
                    }))
                },
                winner: winner || 'draw',
                createdBy: user.uid,
            };

            const cleanedMatchData = cleanObject(matchDocData);

            if (editingMatch) {
                const matchRef = doc(db, "matches", editingMatch.id);
                await updateDoc(matchRef, {
                    ...cleanedMatchData,
                    updatedAt: serverTimestamp()
                });
                toast.success("Match updated successfully!");
            } else {
                await addDoc(collection(db, "matches"), {
                    ...cleanedMatchData,
                    createdAt: serverTimestamp(),
                });
                
                toast.success("Match added successfully!");
            }

            onOpenChange(false);
            reset();

        } catch (err) {
            console.error("Error saving match:", err);
            if (err instanceof Error &&
                err.message.includes("permission") &&
                err.message.includes("insufficient")) {
                toast.error("Rate limit reached", {
                    description: "You must wait 10 seconds between creating matches."
                });
            } else {
                toast.error("Error saving match", { description: (err as Error).message });
            }
        } finally {
            setIsSubmittingMatch(false);
        }
    };

    const getPlayerDisplayName = (playerId: string): string => {
        if (!playerId) return 'Select player';

        if (playerId.includes('[object Object]')) {
            return 'Invalid player';
        }
        const player = normalizedPlayers.find(p => p.uid === playerId);
        if (player) return player.displayName;

        if (playerId.startsWith(GUEST_PREFIX)) {
            const guestId = playerId.substring(GUEST_PREFIX.length);
            return `Guest ${guestId.substring(0, 5)}`;
        }

        const member = members.find(m => m.uid === playerId);
        if (member) return member.displayName;

        return 'Unknown Player';
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[525px] w-[95vw] overflow-hidden" hideCloseButton>
                <div className="dialog-scrollable custom-scrollbar">
                    <DialogHeader>
                        <DialogTitle>{editingMatch ? 'Edit Match' : 'Add New Match'}</DialogTitle>
                        <DialogDescription>
                            Record the details of the foosball match.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit(onSubmitMatch)}>
                        <div className="grid gap-4 py-4">
                            <div className="space-y-4">
                                <Label className="text-base font-medium">Game Type</Label>
                                <Controller
                                    name="gameType"
                                    control={control}
                                    render={({ field }) => (
                                        <div className="flex gap-2">
                                            <Button
                                                type="button"
                                                variant={field.value === "1v1" ? "default" : "outline"}
                                                className="flex-1"
                                                onClick={() => field.onChange("1v1")}
                                                disabled={isSubmittingMatch}
                                            >
                                                <span className="mr-2">1v1</span>
                                                {field.value === "1v1" && "Match"}
                                            </Button>
                                            <Button
                                                type="button"
                                                variant={field.value === "2v2" ? "default" : "outline"}
                                                className="flex-1"
                                                onClick={() => field.onChange("2v2")}
                                                disabled={isSubmittingMatch}
                                            >
                                                <span className="mr-2">2v2</span>
                                                {field.value === "2v2" && "Match"}
                                            </Button>
                                        </div>
                                    )}
                                />
                            </div>

                            {watchedGameType === '1v1' ? (
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <div
                                            className="w-5 h-5 rounded-full border-2 border-black dark:border-white"
                                            style={{ backgroundColor: group?.teamColors?.teamOne }}
                                        />
                                        <Label htmlFor="t1p1">Team 1 Player</Label>
                                    </div>
                                    <Controller
                                        name="team1Player1"
                                        control={control}
                                        rules={{ required: 'Player is required' }}
                                        render={({ field }) => (
                                            <Select onValueChange={field.onChange} value={field.value} disabled={isSubmittingMatch}>
                                                <SelectTrigger id="t1p1">
                                                    <SelectValue placeholder="Select player">
                                                        {field.value ? getPlayerDisplayName(field.value) : "Select player"}
                                                    </SelectValue>
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {normalizedPlayers.map((player, index) => {
                                                        const uniqueKey = `t1p1-${player.uid.replace(/\W/g, '')}-${index}`;
                                                        return (
                                                            <SelectItem
                                                                key={uniqueKey}
                                                                value={player.uid}
                                                            >
                                                                {player.displayName}
                                                            </SelectItem>
                                                        );
                                                    })}
                                                </SelectContent>
                                            </Select>
                                        )}
                                    />
                                    {errors.team1Player1 && <p className="text-red-500 text-sm">{errors.team1Player1.message}</p>}
                                </div>
                            ) : (
                                <>
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                            <div
                                                className="w-5 h-5 rounded-full border-2 border-black dark:border-white"
                                                style={{ backgroundColor: group?.teamColors?.teamOne }}
                                            />
                                            <Label htmlFor="t1p1">Team 1 Defense</Label>
                                        </div>
                                        <Controller
                                            name="team1Player1"
                                            control={control}
                                            rules={{ required: 'Defense player is required' }}
                                            render={({ field }) => (
                                                <Select onValueChange={field.onChange} value={field.value} disabled={isSubmittingMatch}>
                                                    <SelectTrigger id="t1p1">
                                                        <SelectValue placeholder="Select defense player">
                                                            {field.value ? getPlayerDisplayName(field.value) : "Select defense player"}
                                                        </SelectValue>
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {normalizedPlayers.map((player, index) => {
                                                            const uniqueKey = `t1p1-${player.uid.replace(/\W/g, '')}-${index}`;
                                                            return (
                                                                <SelectItem
                                                                    key={uniqueKey}
                                                                    value={player.uid}
                                                                >
                                                                    {player.displayName}
                                                                </SelectItem>
                                                            );
                                                        })}
                                                    </SelectContent>
                                                </Select>
                                            )}
                                        />
                                        {errors.team1Player1 && <p className="text-red-500 text-sm">{errors.team1Player1.message}</p>}
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                            <div
                                                className="w-5 h-5 rounded-full border-2 border-black dark:border-white"
                                                style={{ backgroundColor: group?.teamColors?.teamOne }}
                                            />
                                            <Label htmlFor="t1p2">Team 1 Attack</Label>
                                        </div>
                                        <Controller
                                            name="team1Player2"
                                            control={control}
                                            rules={{ required: 'Attack player is required' }}
                                            render={({ field }) => (
                                                <Select onValueChange={field.onChange} value={field.value} disabled={isSubmittingMatch}>
                                                    <SelectTrigger id="t1p2">
                                                        <SelectValue placeholder="Select attack player">
                                                            {field.value ? getPlayerDisplayName(field.value) : "Select attack player"}
                                                        </SelectValue>
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {normalizedPlayers.map((player, index) => {
                                                            const uniqueKey = `t1p2-${player.uid.replace(/\W/g, '')}-${index}`;
                                                            return (
                                                                <SelectItem
                                                                    key={uniqueKey}
                                                                    value={player.uid}
                                                                >
                                                                    {player.displayName}
                                                                </SelectItem>
                                                            );
                                                        })}
                                                    </SelectContent>
                                                </Select>
                                            )}
                                        />
                                        {errors.team1Player2 && <p className="text-red-500 text-sm">{errors.team1Player2.message}</p>}
                                    </div>
                                </>
                            )}

                            {watchedGameType === '1v1' ? (
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <div
                                            className="w-5 h-5 rounded-full border-2 border-black dark:border-white"
                                            style={{ backgroundColor: group?.teamColors?.teamTwo }}
                                        />
                                        <Label htmlFor="t2p1">Team 2 Player</Label>
                                    </div>
                                    <Controller
                                        name="team2Player1"
                                        control={control}
                                        rules={{ required: 'Player is required' }}
                                        render={({ field }) => (
                                            <Select onValueChange={field.onChange} value={field.value} disabled={isSubmittingMatch}>
                                                <SelectTrigger id="t2p1">
                                                    <SelectValue placeholder="Select player">
                                                        {field.value ? getPlayerDisplayName(field.value) : "Select player"}
                                                    </SelectValue>
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {normalizedPlayers.map((player, index) => {
                                                        const uniqueKey = `t2p1-${player.uid.replace(/\W/g, '')}-${index}`;
                                                        return (
                                                            <SelectItem
                                                                key={uniqueKey}
                                                                value={player.uid}
                                                            >
                                                                {player.displayName}
                                                            </SelectItem>
                                                        );
                                                    })}
                                                </SelectContent>
                                            </Select>
                                        )}
                                    />
                                    {errors.team2Player1 && <p className="text-red-500 text-sm">{errors.team2Player1.message}</p>}
                                </div>
                            ) : (
                                <>
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                            <div
                                                className="w-5 h-5 rounded-full border-2 border-black dark:border-white"
                                                style={{ backgroundColor: group?.teamColors?.teamTwo }}
                                            />
                                            <Label htmlFor="t2p1">Team 2 Defense</Label>
                                        </div>
                                        <Controller
                                            name="team2Player1"
                                            control={control}
                                            rules={{ required: 'Defense player is required' }}
                                            render={({ field }) => (
                                                <Select onValueChange={field.onChange} value={field.value} disabled={isSubmittingMatch}>
                                                    <SelectTrigger id="t2p1">
                                                        <SelectValue placeholder="Select defense player">
                                                            {field.value ? getPlayerDisplayName(field.value) : "Select defense player"}
                                                        </SelectValue>
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {normalizedPlayers.map((player, index) => {
                                                            const uniqueKey = `t2p1-${player.uid.replace(/\W/g, '')}-${index}`;
                                                            return (
                                                                <SelectItem
                                                                    key={uniqueKey}
                                                                    value={player.uid}
                                                                >
                                                                    {player.displayName}
                                                                </SelectItem>
                                                            );
                                                        })}
                                                    </SelectContent>
                                                </Select>
                                            )}
                                        />
                                        {errors.team2Player1 && <p className="text-red-50 text-sm">{errors.team2Player1.message}</p>}
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                            <div
                                                className="w-5 h-5 rounded-full border-2 border-black dark:border-white"
                                                style={{ backgroundColor: group?.teamColors?.teamTwo }}
                                            />
                                            <Label htmlFor="t2p2">Team 2 Attack</Label>
                                        </div>
                                        <Controller
                                            name="team2Player2"
                                            control={control}
                                            rules={{ required: 'Attack player is required' }}
                                            render={({ field }) => (
                                                <Select onValueChange={field.onChange} value={field.value} disabled={isSubmittingMatch}>
                                                    <SelectTrigger id="t2p2">
                                                        <SelectValue placeholder="Select attack player">
                                                            {field.value ? getPlayerDisplayName(field.value) : "Select attack player"}
                                                        </SelectValue>
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {normalizedPlayers.map((player, index) => {
                                                            const uniqueKey = `t2p2-${player.uid.replace(/\W/g, '')}-${index}`;
                                                            return (
                                                                <SelectItem
                                                                    key={uniqueKey}
                                                                    value={player.uid}
                                                                >
                                                                    {player.displayName}
                                                                </SelectItem>
                                                            );
                                                        })}
                                                    </SelectContent>
                                                </Select>
                                            )}
                                        />
                                        {errors.team2Player2 && <p className="text-red-500 text-sm">{errors.team2Player2.message}</p>}
                                    </div>
                                </>
                            )}

                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <div
                                        className="w-5 h-5 rounded-full border-2 border-black dark:border-white"
                                        style={{ backgroundColor: group?.teamColors?.teamOne }}
                                    />
                                    <Label htmlFor="t1score">Team 1 Score</Label>
                                </div>
                                <Input
                                    id="t1score"
                                    type="number"
                                    min="0"
                                    {...register("team1Score", { required: true, valueAsNumber: true, min: 0 })}
                                    disabled={isSubmittingMatch}
                                />
                                {errors.team1Score && <p className="text-red-500 text-sm">Score is required and must be 0 or more.</p>}
                            </div>
                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <div
                                        className="w-5 h-5 rounded-full border-2 border-black dark:border-white"
                                        style={{ backgroundColor: group?.teamColors?.teamTwo }}
                                    />
                                    <Label htmlFor="t2score">Team 2 Score</Label>
                                </div>
                                <Input
                                    id="t2score"
                                    type="number"
                                    min="0"
                                    {...register("team2Score", { required: true, valueAsNumber: true, min: 0 })}
                                    disabled={isSubmittingMatch}
                                />
                                {errors.team2Score && <p className="text-red-500 text-sm">Score is required and must be 0 or more.</p>}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="playedAt">
                                    Played On
                                </Label>
                                <Input
                                    id="playedAt"
                                    type="date"
                                    {...register("playedAt", { required: "Date is required" })}
                                    disabled={isSubmittingMatch}
                                />
                                {errors.playedAt && <p className="text-red-500 text-sm">{errors.playedAt.message}</p>}
                            </div>
                        </div>
                        <DialogFooter className="flex-col sm:flex-row gap-2">
                            <DialogClose asChild>
                                <Button type="button" variant="outline" disabled={isSubmittingMatch} className="w-full sm:w-auto">Cancel</Button>
                            </DialogClose>
                            <Button
                                type="submit"
                                disabled={isSubmittingMatch || (!editingMatch && (rateLimit?.cooldownRemaining || 0) > 0)}
                                className="w-full sm:w-auto"
                            >
                                {isSubmittingMatch
                                    ? (editingMatch ? 'Saving...' : 'Adding...')
                                    : (!editingMatch && (rateLimit?.cooldownRemaining || 0) > 0)
                                        ? `Add Match (${rateLimit?.cooldownRemaining}s)`
                                        : (editingMatch ? 'Save Changes' : 'Add Match')}
                            </Button>
                        </DialogFooter>
                    </form>
                </div>
            </DialogContent>
        </Dialog>
    );
}
