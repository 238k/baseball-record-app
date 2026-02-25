"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { LineupEntry } from "@/components/game/LineupEditor";
import { BaseballFieldSvg } from "./BaseballFieldSvg";
import {
  DEFENSIVE_POSITIONS,
  POSITION_CIRCLE_RADIUS,
  type PositionKey,
} from "./constants";

interface FieldPositionSelectorProps {
  lineup: LineupEntry[];
  useDh: boolean;
  onPositionSwap: (posA: string, posB: string) => void;
}

const ALL_POSITIONS: PositionKey[] = [
  "投", "捕", "一", "二", "三", "遊", "左", "中", "右",
];
const DH_POSITIONS: PositionKey[] = [
  "DH", "捕", "一", "二", "三", "遊", "左", "中", "右",
];

export function FieldPositionSelector({
  lineup,
  useDh,
  onPositionSwap,
}: FieldPositionSelectorProps) {
  const [selectedPosition, setSelectedPosition] = useState<string | null>(null);

  const positions = useDh ? DH_POSITIONS : ALL_POSITIONS;

  const getPlayerForPosition = useCallback(
    (pos: string) => lineup.find((e) => e.position === pos),
    [lineup]
  );

  const handleTap = useCallback(
    (pos: string) => {
      if (selectedPosition === null) {
        setSelectedPosition(pos);
      } else if (selectedPosition === pos) {
        // Deselect
        setSelectedPosition(null);
      } else {
        // Swap the two positions
        onPositionSwap(selectedPosition, pos);
        setSelectedPosition(null);
      }
    },
    [selectedPosition, onPositionSwap]
  );

  return (
    <BaseballFieldSvg className="w-full max-w-md mx-auto">
      <AnimatePresence>
        {positions.map((pos) => {
          const coord = DEFENSIVE_POSITIONS[pos];
          const player = getPlayerForPosition(pos);
          const isSelected = selectedPosition === pos;
          const isSwapTarget = selectedPosition !== null && selectedPosition !== pos;
          const r = POSITION_CIRCLE_RADIUS;

          return (
            <motion.g
              key={pos}
              data-testid={`position-${pos}`}
              layoutId={`pos-${pos}`}
              style={{ cursor: "pointer" }}
              animate={{
                scale: isSelected ? 1.1 : 1,
              }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              onClick={() => handleTap(pos)}
              role="button"
              aria-label={`${pos}${player?.playerName ? ` - ${player.playerName}` : ""}`}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleTap(pos);
                }
              }}
            >
              {/* Selection ring */}
              {isSelected && (
                <motion.circle
                  cx={coord.x}
                  cy={coord.y}
                  r={r + 4}
                  fill="none"
                  stroke="#2563eb"
                  strokeWidth={3}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                />
              )}

              {/* Swap target indicator */}
              {isSwapTarget && (
                <circle
                  cx={coord.x}
                  cy={coord.y}
                  r={r + 3}
                  fill="none"
                  stroke="#2563eb"
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                  opacity={0.5}
                />
              )}

              {/* Position circle background */}
              <circle
                cx={coord.x}
                cy={coord.y}
                r={r}
                fill={player?.playerName ? "#1e40af" : "#6b7280"}
                opacity={isSelected ? 1 : 0.9}
              />

              {/* Position label */}
              <foreignObject
                x={coord.x - r}
                y={coord.y - r}
                width={r * 2}
                height={r * 2}
              >
                <div className="flex flex-col items-center justify-center h-full w-full text-white leading-none">
                  <span className="text-[11px] font-bold">{pos}</span>
                </div>
              </foreignObject>

              {/* Player name below circle */}
              <foreignObject
                x={coord.x - 40}
                y={coord.y + r + 2}
                width={80}
                height={28}
              >
                <div className="text-[10px] text-center font-medium leading-tight truncate">
                  {player?.playerName ?? "未設定"}
                </div>
              </foreignObject>
            </motion.g>
          );
        })}
      </AnimatePresence>
    </BaseballFieldSvg>
  );
}
