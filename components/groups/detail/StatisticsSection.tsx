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
import { BarChart, Calendar, InfoIcon } from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

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
    longestWinStreak: {
        player: string;
        count: number;
        playerName: string;
    };
    mostMatchesInOneDay: {
        date: string;
        count: number;
    };
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
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

const formatDateString = (dateStr: string): string => {
  try {
    if (!dateStr) return 'Unknown date';
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  } catch (err) {
    console.error("Error formatting date string:", err, dateStr);
    return 'Date format error';
  }
};

export default function StatisticsSection({
    groupStats,
    statsLoading,
    group
}: StatisticsSectionProps) {
    const ratingFormula = "Rating = 1000 + (WinRate × 500) + ((AvgGoalsScored - AvgGoalsConceded) × 10)";
    
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
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
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
                                    <div className="h-5 w-5 rounded-full border border-black dark:border-white" 
                                         style={{ backgroundColor: Object.entries(groupStats.teamColorStats).sort((a, b) => b[1].winRate - a[1].winRate)[0]?.[0] || '#000' }} />
                                    Best Team
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {Object.entries(groupStats.teamColorStats).length > 0 ? (
                                    <>
                                        <div className="text-3xl font-bold">{Object.entries(groupStats.teamColorStats).sort((a, b) => b[1].winRate - a[1].winRate)[0]?.[1].wins || 0} wins</div>
                                        <div className="text-sm text-muted-foreground mt-1">
                                            {Math.round((Object.entries(groupStats.teamColorStats).sort((a, b) => b[1].winRate - a[1].winRate)[0]?.[1].winRate || 0) * 100)}% win rate
                                        </div>
                                    </>
                                ) : (
                                    <div className="text-sm text-muted-foreground">No team data yet</div>
                                )}
                            </CardContent>
                        </Card>
                        
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="flex items-center gap-2">
                                    <Calendar className="h-5 w-5 text-primary" />
                                    Most Active Day
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {groupStats.mostMatchesInOneDay.count > 0 ? (
                                    <>
                                        <div className="text-3xl font-bold">{groupStats.mostMatchesInOneDay.count} matches</div>
                                        <div className="text-sm text-muted-foreground mt-1">
                                            on {groupStats.mostMatchesInOneDay.date ? formatDateString(groupStats.mostMatchesInOneDay.date) : 'Unknown date'}
                                        </div>
                                    </>
                                ) : (
                                    <div className="text-sm text-muted-foreground">No matches yet</div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    <div className="mb-6">
                        <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                            Player Statistics
                            <TooltipProvider delayDuration={0} skipDelayDuration={500} disableHoverableContent={false}>
                                <Tooltip>
                                <TooltipTrigger asChild>
                                <button 
                                    className="inline-flex items-center justify-center rounded-full w-5 h-5 bg-muted hover:bg-muted-foreground/20 transition-colors"
                                    aria-label="Rating formula info"
                                >
                                    <InfoIcon className="h-3 w-3 text-muted-foreground" />
                                </button>
                                </TooltipTrigger>
                                    <TooltipContent className="max-w-[240px]" side="bottom">
                                        <p><strong>Rating Formula:</strong></p>
                                        <p className="font-mono text-xs mt-1">{ratingFormula}</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </h3>
                        
                        <Accordion type="single" collapsible className="w-full">
                            {Object.entries(groupStats.playerStats)
                                .sort((a, b) => b[1].rating - a[1].rating)
                                .map(([playerId, player]) => (
                                    <AccordionItem key={playerId} value={playerId}>
                                        <AccordionTrigger>
                                            <div className="flex items-center justify-between w-full">
                                                <div className="flex items-center">
                                                    <span className="mr-2 truncate max-w-[150px] sm:max-w-none">{player.displayName}</span>
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
                                                        {/* <li className="flex justify-between">
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
                                                        </li> */}
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
                                                
                                                {player.teamPartners && Object.keys(player.teamPartners).length > 0 && (
                                                    <div className="col-span-1 sm:col-span-2 mt-2">
                                                        <h4 className="font-semibold mb-2">Team Partnerships (2v2)</h4>
                                                        <div className="overflow-x-auto -mx-2">
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
                                                                                <TableCell className="max-w-[120px] truncate">{partnerStats.displayName}</TableCell>
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
                </>
            )}
        </div>
    );
}
