'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
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
    Timestamp,
    getDoc,
} from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from '@/components/ui/tabs';
import { toast } from "sonner";
import { ArrowLeft } from 'lucide-react';
import MatchesSection from '@/components/groups/detail/MatchesSection';
import StatisticsSection from '@/components/groups/detail/StatisticsSection';

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

interface PlayerStats {
    displayName: string;
    isGuest: boolean;
    totalMatches: number;
    wins: number;
    draws: number;
    losses: number;
    winRate: number;
    rating: number;
    streak: number;
    currentStreak: number;
    longestWinStreak: number;
    longestLossStreak: number;
    goalsScored: number;
    goalsConceded: number;
    averageGoalsScored: number;
    averageGoalsConceded: number;
    teamPartners: {
        [partnerId: string]: {
            displayName: string;
            matches: number;
            wins: number;
            winRate: number;
        }
    };
    lastPlayed: Timestamp | { seconds: number; nanoseconds: number };
}

interface TeamColorStats {
    totalMatches: number;
    wins: number;
    draws: number;
    losses: number;
    winRate: number;
    goalsScored: number;
    goalsConceded: number;
}

interface RecentMatch {
    id: string;
    playedAt: Timestamp | { seconds: number; nanoseconds: number };
    team1Score: number;
    team2Score: number;
    gameType: '1v1' | '2v2';
    winner: 'team1' | 'team2' | 'draw';
}

interface GroupStats extends DocumentData {
    groupId: string;
    lastUpdated: Timestamp;
    playerStats: {
        [playerId: string]: PlayerStats;
    };
    teamColorStats: {
        [colorCode: string]: TeamColorStats;
    };
    totalMatches: number;
    matchesByGameType: {
        '1v1': number;
        '2v2': number;
    };
    highestScore: {
        score: number;
        matchId: string;
        player: string;
        date: Timestamp | { seconds: number; nanoseconds: number };
    };
    longestWinStreak: {
        player: string;
        count: number;
        playerName: string;
    };
    recentMatches: RecentMatch[];
}

const formatAdminDisplayName = (fullName: string | null | undefined): string => {
    if (!fullName) return 'N/A';
    const parts = fullName.trim().split(' ');
    if (parts.length <= 1) return fullName;
    const firstParts = parts.slice(0, -1).join(' ');
    const lastInitial = parts[parts.length - 1].charAt(0);
    return `${firstParts} ${lastInitial}.`;
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
    const [groupStats, setGroupStats] = useState<GroupStats | null>(null);
    const [groupLoading, setGroupLoading] = useState(true);
    const [matchesLoading, setMatchesLoading] = useState(true);
    const [statsLoading, setStatsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [matchRateLimit, setMatchRateLimit] = useState<{
        lastMatchCreation: Date | null;
        cooldownRemaining: number;
    } | null>(null);

    const isAdmin = user?.uid === group?.adminUid;
    const canEditMatches = isAdmin || group?.members[user?.uid || '']?.role === 'editor';

    const fetchMatchRateLimit = async () => {
        if (!user) return;
        
        try {
            const ratelimitRef = doc(db, 'matchRatelimits', user.uid);
            const ratelimitDoc = await getDoc(ratelimitRef);
            
            if (ratelimitDoc.exists()) {
                const data = ratelimitDoc.data();
                const lastCreation = data.lastMatchCreation ? 
                    data.lastMatchCreation.toDate() : null;
                
                let cooldownRemaining = 0;
                if (lastCreation) {
                    const cooldownEnd = new Date(lastCreation.getTime() + (10 * 1000)); // 10 seconds
                    cooldownRemaining = Math.max(0, 
                        Math.floor((cooldownEnd.getTime() - Date.now()) / 1000));
                }
                
                setMatchRateLimit({
                    lastMatchCreation: lastCreation,
                    cooldownRemaining
                });
            } else {
                setMatchRateLimit({
                    lastMatchCreation: null,
                    cooldownRemaining: 0
                });
            }
        } catch (error) {
            console.error("Error fetching match rate limits:", error);
        }
    };

    const handleMatchDialogOpenChange = (open: boolean) => {
        if (!open) {
            fetchMatchRateLimit();
        }
    };

    useEffect(() => {
        if (group?.name) {
            document.title = `Foosballek/${group.name}`;
        } else {
            document.title = 'Foosballek';
        }
    }, [group]);

    useEffect(() => {
        if (!user) return;
        
        fetchMatchRateLimit();
        
        if (matchRateLimit && matchRateLimit.cooldownRemaining > 0) {
            const interval = setInterval(() => {
                setMatchRateLimit(prev => {
                    if (!prev) return prev;
                    const newRemaining = Math.max(0, prev.cooldownRemaining - 1);
                    return { ...prev, lastMatchCreation: prev.lastMatchCreation, cooldownRemaining: newRemaining };
                });
            }, 1000);
            
            return () => clearInterval(interval);
        }
    }, [user, matchRateLimit?.cooldownRemaining]);

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

    // Fetch group stats
    useEffect(() => {
        if (!groupId || !group) {
            setGroupStats(null);
            setStatsLoading(groupLoading);
            return;
        }

        if (groupLoading || error) {
            setGroupStats(null);
            setStatsLoading(false);
            return;
        }

        setStatsLoading(true);
        const statsRef = doc(db, "groupStats", groupId);

        const unsubscribe = onSnapshot(statsRef, (docSnap) => {
            if (docSnap.exists()) {
                setGroupStats({ ...docSnap.data() } as GroupStats);
            } else {
                setGroupStats(null);
            }
            setStatsLoading(false);
        }, (err) => {
            console.error("Error fetching group statistics:", err);
            setStatsLoading(false);
            toast.error("Error fetching statistics", { description: err.message });
        });

        return () => unsubscribe();
    }, [groupId, group, error, groupLoading]);

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

            <Tabs defaultValue="matches" className="w-full">
                <TabsList className="mb-4">
                    <TabsTrigger value="matches">Matches</TabsTrigger>
                    <TabsTrigger value="statistics">Statistics</TabsTrigger>
                </TabsList>

                {/* Matches Tab */}
                <TabsContent value="matches">
                    <MatchesSection
                        matches={matches}
                        matchesLoading={matchesLoading}
                        group={group}
                        groupId={groupId}
                        selectablePlayers={selectablePlayers}
                        members={members}
                        user={user}
                        canEditMatches={canEditMatches}
                        matchRateLimit={matchRateLimit}
                        onMatchDialogOpenChange={handleMatchDialogOpenChange}
                    />
                </TabsContent>

                {/* Statistics Tab */}
                <TabsContent value="statistics">
                    <StatisticsSection
                        groupStats={groupStats}
                        statsLoading={statsLoading}
                        group={group}
                    />
                </TabsContent>
            </Tabs>
        </div>
    );
}
