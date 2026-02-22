"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BatterStatsTable } from "./BatterStatsTable"
import { PitcherStatsTable } from "./PitcherStatsTable"
import type { Database } from "@/lib/supabase/types"
import type { ReactNode } from "react"

type BatterGameStats = Database["public"]["Views"]["v_batter_game_stats"]["Row"]
type PitcherGameStats = Database["public"]["Views"]["v_pitcher_game_stats"]["Row"]

interface GameStatsTabsProps {
  lineupContent: ReactNode
  batterStats: BatterGameStats[]
  pitcherStats: PitcherGameStats[]
}

export function GameStatsTabs({
  lineupContent,
  batterStats,
  pitcherStats,
}: GameStatsTabsProps) {
  return (
    <Tabs defaultValue="lineup">
      <TabsList className="w-full">
        <TabsTrigger value="lineup">オーダー</TabsTrigger>
        <TabsTrigger value="batter">打者成績</TabsTrigger>
        <TabsTrigger value="pitcher">投手成績</TabsTrigger>
      </TabsList>
      <TabsContent value="lineup" className="mt-4">
        {lineupContent}
      </TabsContent>
      <TabsContent value="batter" className="mt-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">打者成績</CardTitle>
          </CardHeader>
          <CardContent className="px-2">
            <BatterStatsTable mode="game" data={batterStats} />
          </CardContent>
        </Card>
      </TabsContent>
      <TabsContent value="pitcher" className="mt-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">投手成績</CardTitle>
          </CardHeader>
          <CardContent className="px-2">
            <PitcherStatsTable mode="game" data={pitcherStats} />
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  )
}
