"use client";

import { motion } from "framer-motion";
import type { BaseRunners } from "@/hooks/useGameState";
import { BaseballFieldSvg } from "./BaseballFieldSvg";
import { BASE_POSITIONS, BASE_SIZE } from "./constants";

interface FieldRunnerDisplayProps {
  baseRunners: BaseRunners;
  className?: string;
}

/** Scoreboard-style base size — slightly larger than field default for visibility */
const HIGHLIGHT_SIZE = BASE_SIZE + 4;

const bases = [
  { key: "first" as const, pos: BASE_POSITIONS.first },
  { key: "second" as const, pos: BASE_POSITIONS.second },
  { key: "third" as const, pos: BASE_POSITIONS.third },
] as const;

export function FieldRunnerDisplay({
  baseRunners,
  className,
}: FieldRunnerDisplayProps) {
  return (
    <BaseballFieldSvg variant="diamond" className={className}>
      {/* Base highlights — bright yellow when occupied, translucent white when empty */}
      {bases.map(({ key, pos }) => {
        const occupied = !!baseRunners[key];
        return (
          <motion.rect
            key={`highlight-${key}`}
            data-testid={`base-highlight-${key}`}
            x={pos.x - HIGHLIGHT_SIZE}
            y={pos.y - HIGHLIGHT_SIZE}
            width={HIGHLIGHT_SIZE * 2}
            height={HIGHLIGHT_SIZE * 2}
            transform={`rotate(45 ${pos.x} ${pos.y})`}
            animate={{
              fill: occupied ? "#eab308" : "white",
              opacity: occupied ? 1 : 0.5,
              stroke: occupied ? "#ca8a04" : "transparent",
              strokeWidth: occupied ? 2 : 0,
            }}
            transition={{ duration: 0.2 }}
          />
        );
      })}
    </BaseballFieldSvg>
  );
}
