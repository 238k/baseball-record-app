"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { BaseRunners } from "@/hooks/useGameState";
import { BaseballFieldSvg } from "./BaseballFieldSvg";
import { BASE_POSITIONS, BASE_SIZE } from "./constants";

interface FieldRunnerDisplayProps {
  baseRunners: BaseRunners;
  className?: string;
}

const RUNNER_RADIUS = 14;

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
      {/* Base highlights when occupied */}
      {bases.map(({ key, pos }) => {
        const runner = baseRunners[key];
        return (
          <motion.rect
            key={`highlight-${key}`}
            data-testid={`base-highlight-${key}`}
            x={pos.x - BASE_SIZE}
            y={pos.y - BASE_SIZE}
            width={BASE_SIZE * 2}
            height={BASE_SIZE * 2}
            transform={`rotate(45 ${pos.x} ${pos.y})`}
            animate={{
              fill: runner ? "#f59e0b" : "white",
              opacity: runner ? 1 : 0.6,
            }}
            transition={{ duration: 0.3 }}
          />
        );
      })}

      {/* Runner dots with animation */}
      <AnimatePresence>
        {bases.map(({ key, pos }) => {
          const runner = baseRunners[key];
          if (!runner) return null;

          // Offset runner dot slightly above the base
          const offsetY = -20;

          return (
            <motion.g
              key={`runner-${runner.id}`}
              data-testid={`runner-${key}`}
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
            >
              <circle
                cx={pos.x}
                cy={pos.y + offsetY}
                r={RUNNER_RADIUS}
                fill="#2563eb"
                stroke="white"
                strokeWidth={2}
              />
              <foreignObject
                x={pos.x - RUNNER_RADIUS}
                y={pos.y + offsetY - RUNNER_RADIUS}
                width={RUNNER_RADIUS * 2}
                height={RUNNER_RADIUS * 2}
              >
                <div
                  className="flex items-center justify-center h-full w-full text-[10px] font-bold text-white leading-none text-center"
                >
                  {runner.player_number ?? ""}
                </div>
              </foreignObject>
            </motion.g>
          );
        })}
      </AnimatePresence>

      {/* Runner name labels below bases */}
      {bases.map(({ key, pos }) => {
        const runner = baseRunners[key];
        if (!runner) return null;

        return (
          <foreignObject
            key={`label-${key}`}
            x={pos.x - 40}
            y={pos.y + 10}
            width={80}
            height={20}
          >
            <div className="text-[10px] text-center font-medium truncate">
              {runner.player_name ?? ""}
            </div>
          </foreignObject>
        );
      })}
    </BaseballFieldSvg>
  );
}
