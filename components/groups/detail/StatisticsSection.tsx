'use client';

import { Skeleton } from '@/components/ui/skeleton';
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from '@/components/ui/accordion';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { BarChart, Clock, User, TrendingUp } from 'lucide-react';
import { Timestamp } from 'firebase/firestore';

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

interface GroupStats {
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

interface GroupData {
    id: string;
    name: string;
    teamColors: {
        teamOne: string;
        teamTwo: string;
    };
}

interface StatisticsSectionProps {
    groupStats: GroupStats | null;
    statsLoading: boolean;
    group: GroupData;
}

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

export default function StatisticsSection({
    groupStats,
    statsLoading,
    group
}: StatisticsSectionProps) {
    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-semibold mb-4">Group Statistics</h2>

            {statsLoading ? (
                <div className="space-y-6 w-full">
                    <Skeleton className="h-40 w-full rounded-lg" />
                    <Skeleton className="h-60 w-full rounded-lg" />
                    <Skeleton className="h-40 w-full rounded-lg" />
                </div>
            ) : !groupStats ? (
                <div className="text-center py-12 border rounded-lg bg-muted/40">
                    <p className="text-muted-foreground">No statistics available yet. Play some matches to see statistics.</p>
                </div>
            ) : (
                <>
                    {/* Group Overview Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="flex items-center gap-2">
                                    <BarChart className="h-5 w-5 text-primary" />
                                    Total Matches
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-bold">{groupStats.totalMatches}</div>
                                <div className="text-sm text-muted-foreground mt-1">
                                    1v1: {groupStats.matchesByGameType["1v1"] || 0} | 
                                    2v2: {groupStats.matchesByGameType["2v2"] || 0}
                                </div>
                            </CardContent>
                        </Card>
                        
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="flex items-center gap-2">
                                    <TrendingUp className="h-5 w-5 text-primary" />
                                    Longest Win Streak
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {groupStats.longestWinStreak.count > 0 ? (
                                    <>
                                        <div className="text-3xl font-bold">{groupStats.longestWinStreak.count} wins</div>
                                        <div className="text-sm text-muted-foreground mt-1">
                                            by {groupStats.longestWinStreak.playerName || 'Unknown player'}
                                        </div>
                                    </>
                                ) : (
                                    <div className="text-sm text-muted-foreground">No win streaks yet</div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Player Statistics Accordion */}
                    <div className="mb-6">
                        <h3 className="text-xl font-semibold mb-4">Player Statistics</h3>
                        
                        {/* Player Leaderboard */}
                        <Card className="mb-4">
                            <CardHeader>
                                <CardTitle>Player Leaderboard</CardTitle>
                                <CardDescription>Top players ranked by rating</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Rank</TableHead>
                                            <TableHead>Player</TableHead>
                                            <TableHead>Rating</TableHead>
                                            <TableHead className="hidden sm:table-cell">W/D/L</TableHead>
                                            <TableHead className="text-right">Win Rate</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {Object.entries(groupStats.playerStats)
                                            .sort((a, b) => b[1].rating - a[1].rating)
                                            .slice(0, 5)
                                            .map(([playerId, player], index) => (
                                                <TableRow key={playerId}>
                                                    <TableCell className="font-medium">{index + 1}</TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center">
                                                            <User className="h-4 w-4 mr-2 text-muted-foreground" />
                                                            <span>{player.displayName}</span>
                                                            {player.isGuest && <span className="ml-1 text-xs text-muted-foreground">(Guest)</span>}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>{player.rating}</TableCell>
                                                    <TableCell className="hidden sm:table-cell">
                                                        {player.wins}/{player.draws}/{player.losses}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        {Math.round(player.winRate * 100)}%
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                        
                        <Accordion type="single" collapsible className="w-full">
                            {Object.entries(groupStats.playerStats)
                                .sort((a, b) => b[1].rating - a[1].rating)
                                .map(([playerId, player]) => (
                                    <AccordionItem key={playerId} value={playerId}>
                                        <AccordionTrigger>
                                            <div className="flex items-center justify-between w-full">
                                                <div className="flex items-center">
                                                    <span className="mr-2">{player.displayName}</span>
                                                    {player.isGuest && <span className="text-xs text-muted-foreground">(Guest)</span>}
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <span className="text-sm">
                                                        {player.wins}W/{player.draws}D/{player.losses}L
                                                    </span>
                                                    <span className="text-sm font-medium">
                                                        Rating: {player.rating}
                                                    </span>
                                                </div>
                                            </div>
                                        </AccordionTrigger>
                                        <AccordionContent>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-2">
                                                <div>
                                                    <h4 className="font-semibold mb-2">Performance</h4>
                                                    <ul className="space-y-1 text-sm">
                                                        <li className="flex justify-between">
                                                            <span>Matches played:</span> 
                                                            <span className="font-medium">{player.totalMatches}</span>
                                                        </li>
                                                        <li className="flex justify-between">
                                                            <span>Win rate:</span> 
                                                            <span className="font-medium">{Math.round(player.winRate * 100)}%</span>
                                                        </li>
                                                        <li className="flex justify-between">
                                                            <span>Current streak:</span> 
                                                            <span className="font-medium">
                                                                {player.currentStreak > 0 ? (
                                                                    <span className="text-green-600 dark:text-green-500">{player.currentStreak}W</span>
                                                                ) : player.currentStreak < 0 ? (
                                                                    <span className="text-red-600 dark:text-red-500">{Math.abs(player.currentStreak)}L</span>
                                                                ) : (
                                                                    '—'
                                                                )}
                                                            </span>
                                                        </li>
                                                        <li className="flex justify-between">
                                                            <span>Longest win streak:</span> 
                                                            <span className="font-medium">{player.longestWinStreak}</span>
                                                        </li>
                                                    </ul>
                                                </div>
                                                <div>
                                                    <h4 className="font-semibold mb-2">Team Goals</h4>
                                                    <ul className="space-y-1 text-sm">
                                                        <li className="flex justify-between">
                                                            <span>Team goals (when playing):</span> 
                                                            <span className="font-medium">{player.goalsScored}</span>
                                                        </li>
                                                        <li className="flex justify-between">
                                                            <span>Opponent goals (when playing):</span> 
                                                            <span className="font-medium">{player.goalsConceded}</span>
                                                        </li>
                                                        <li className="flex justify-between">
                                                            <span>Avg. team goals:</span> 
                                                            <span className="font-medium">{player.averageGoalsScored.toFixed(1)} per match</span>
                                                        </li>
                                                        <li className="flex justify-between">
                                                            <span>Avg. opponent goals:</span> 
                                                            <span className="font-medium">{player.averageGoalsConceded.toFixed(1)} per match</span>
                                                        </li>
                                                    </ul>
                                                </div>
                                                
                                                {/* Partner stats for 2v2 games */}
                                                {player.teamPartners && Object.keys(player.teamPartners).length > 0 && (
                                                    <div className="col-span-1 sm:col-span-2 mt-2">
                                                        <h4 className="font-semibold mb-2">Team Partnerships (2v2)</h4>
                                                        <div className="overflow-x-auto">
                                                            <Table>
                                                                <TableHeader>
                                                                    <TableRow>
                                                                        <TableHead>Partner</TableHead>
                                                                        <TableHead className="text-center">Games</TableHead>
                                                                        <TableHead className="text-center">Wins</TableHead>
                                                                        <TableHead className="text-right">Win Rate</TableHead>
                                                                    </TableRow>
                                                                </TableHeader>
                                                                <TableBody>
                                                                    {Object.entries(player.teamPartners)
                                                                        .sort((a, b) => b[1].matches - a[1].matches)
                                                                        .map(([partnerId, partnerStats]) => (
                                                                            <TableRow key={partnerId}>
                                                                                <TableCell>{partnerStats.displayName}</TableCell>
                                                                                <TableCell className="text-center">{partnerStats.matches}</TableCell>
                                                                                <TableCell className="text-center">{partnerStats.wins}</TableCell>
                                                                                <TableCell className="text-right">
                                                                                    {Math.round(partnerStats.winRate * 100)}%
                                                                                </TableCell>
                                                                            </TableRow>
                                                                        ))}
                                                                </TableBody>
                                                            </Table>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </AccordionContent>
                                    </AccordionItem>
                                ))}
                        </Accordion>
                    </div>

                    {/* Team Color Statistics */}
                    <div className="mb-6">
                        <h3 className="text-xl font-semibold mb-4">Team Color Performance</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {Object.entries(groupStats.teamColorStats).map(([color, stats]) => (
                                <Card key={color}>
                                    <CardHeader className="flex flex-row items-center space-y-0 pb-2">
                                        <div className="flex items-center gap-3">
                                            <div 
                                                className="h-8 w-8 rounded-full border-2 border-black dark:border-white" 
                                                style={{ backgroundColor: color }}
                                            />
                                            <CardTitle>{color === group.teamColors.teamOne ? 'Team 1' : 'Team 2'}</CardTitle>
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm">Win Rate:</span>
                                                <span className="text-sm font-medium">{Math.round(stats.winRate * 100)}%</span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm">Record:</span>
                                                <span className="text-sm font-medium">{stats.wins}W-{stats.draws}D-{stats.losses}L</span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm">Goals Scored:</span>
                                                <span className="text-sm font-medium">{stats.goalsScored} ({(stats.goalsScored / stats.totalMatches).toFixed(1)} avg)</span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm">Goals Conceded:</span>
                                                <span className="text-sm font-medium">{stats.goalsConceded} ({(stats.goalsConceded / stats.totalMatches).toFixed(1)} avg)</span>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </div>

                    {/* Recent Matches */}
                    {groupStats.recentMatches && groupStats.recentMatches.length > 0 && (
                        <div>
                            <h3 className="text-xl font-semibold mb-4">Recent Matches</h3>
                            <div className="space-y-2">
                                {groupStats.recentMatches.map((match) => (
                                    <div key={match.id} className="p-3 border rounded flex justify-between items-center">
                                        <div className="flex items-center gap-2">
                                            <Clock className="h-4 w-4 text-muted-foreground" />
                                            <span className="text-sm">{formatPlayedAt(match.playedAt)}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium">
                                                {match.team1Score} - {match.team2Score}
                                            </span>
                                            <span className="text-xs px-2 py-1 rounded-full bg-secondary">
                                                {match.gameType}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
