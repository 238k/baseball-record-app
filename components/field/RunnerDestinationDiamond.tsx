"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { RunnerDest, RunnerRow } from "@/app/(main)/games/[id]/input/types";
import { BaseballFieldSvg } from "./BaseballFieldSvg";
import { BASE_POSITIONS, DEST_ZONES } from "./constants";

interface RunnerDestinationDiamondProps {
  runnerRows: RunnerRow[];
  batter: { lineupId: string; playerName: string; destination: RunnerDest };
  getDestOptions: (fromBase: "batter" | "1st" | "2nd" | "3rd") => RunnerDest[];
  onRunnerDestChange: (lineupId: string, dest: RunnerDest) => void;
  onBatterDestChange: (dest: RunnerDest) => void;
  className?: string;
}

const RUNNER_RADIUS = 16;

// Map RunnerDest to SVG coordinates
const DEST_COORDS: Record<Exclude<RunnerDest, "stay">, { x: number; y: number }> = {
  "1st": { x: BASE_POSITIONS.first.x, y: BASE_POSITIONS.first.y },
  "2nd": { x: BASE_POSITIONS.second.x, y: BASE_POSITIONS.second.y },
  "3rd": { x: BASE_POSITIONS.third.x, y: BASE_POSITIONS.third.y },
  scored: { x: BASE_POSITIONS.home.x, y: BASE_POSITIONS.home.y },
  out: DEST_ZONES.out,
};

// Map fromBase to origin coordinates
const ORIGIN_COORDS: Record<"batter" | "1st" | "2nd" | "3rd", { x: number; y: number }> = {
  batter: { x: BASE_POSITIONS.home.x, y: BASE_POSITIONS.home.y },
  "1st": { x: BASE_POSITIONS.first.x, y: BASE_POSITIONS.first.y },
  "2nd": { x: BASE_POSITIONS.second.x, y: BASE_POSITIONS.second.y },
  "3rd": { x: BASE_POSITIONS.third.x, y: BASE_POSITIONS.third.y },
};

type SelectedEntity = { type: "runner"; lineupId: string } | { type: "batter" };

// Offset stacked items in a zone horizontally
function computeStackOffset(index: number, total: number): number {
  if (total <= 1) return 0;
  const spacing = 30;
  const start = -((total - 1) * spacing) / 2;
  return start + index * spacing;
}

export function RunnerDestinationDiamond({
  runnerRows,
  batter,
  getDestOptions,
  onRunnerDestChange,
  onBatterDestChange,
  className,
}: RunnerDestinationDiamondProps) {
  const [selected, setSelected] = useState<SelectedEntity | null>(null);

  const handleSelect = useCallback(
    (entity: SelectedEntity) => {
      setSelected((prev) => {
        if (!prev) return entity;
        if (prev.type === entity.type) {
          if (prev.type === "batter" && entity.type === "batter") return null;
          if (
            prev.type === "runner" &&
            entity.type === "runner" &&
            prev.lineupId === entity.lineupId
          )
            return null;
        }
        return entity;
      });
    },
    []
  );

  const handleZoneTap = useCallback(
    (dest: RunnerDest) => {
      if (!selected) return;
      if (selected.type === "batter") {
        onBatterDestChange(dest);
      } else {
        onRunnerDestChange(selected.lineupId, dest);
      }
      setSelected(null);
    },
    [selected, onBatterDestChange, onRunnerDestChange]
  );

  const handleBackgroundTap = useCallback(() => {
    setSelected(null);
  }, []);

  // Base order for passing / collision checks (higher = further advanced)
  const BASE_ORDER: Record<string, number> = {
    batter: 0,
    "1st": 1,
    "2nd": 2,
    "3rd": 3,
    scored: 4,
  };

  // Compute valid destinations for the selected entity
  const validDests: RunnerDest[] = (() => {
    if (!selected) return [];

    let selectedFromBase: "batter" | "1st" | "2nd" | "3rd";
    let selectedLineupId: string;
    let rawDests: RunnerDest[];

    if (selected.type === "batter") {
      selectedFromBase = "batter";
      selectedLineupId = batter.lineupId;
      rawDests = getDestOptions("batter");
    } else {
      const row = runnerRows.find((r) => r.lineupId === selected.lineupId);
      if (!row) return [];
      selectedFromBase = row.fromBase;
      selectedLineupId = row.lineupId;
      rawDests = getDestOptions(row.fromBase);
    }

    // --- Collision check: bases (1st/2nd/3rd) occupied by OTHER entities ---
    const othersOccupied = new Set<RunnerDest>();
    for (const row of runnerRows) {
      if (row.lineupId === selectedLineupId) continue;
      const pos = row.destination === "stay" ? row.fromBase : row.destination;
      if (pos === "1st" || pos === "2nd" || pos === "3rd") {
        othersOccupied.add(pos);
      }
    }
    if (selected.type !== "batter") {
      const bPos = batter.destination;
      if (bPos === "1st" || bPos === "2nd" || bPos === "3rd") {
        othersOccupied.add(bPos);
      }
    }

    // --- No-passing check: cannot advance past a runner who started ahead ---
    const selectedOrder = BASE_ORDER[selectedFromBase] ?? 0;
    let maxAllowedOrder = BASE_ORDER["scored"]; // 4 by default

    // Check runners ahead
    for (const row of runnerRows) {
      if (row.lineupId === selectedLineupId) continue;
      const rowStartOrder = BASE_ORDER[row.fromBase] ?? 0;
      if (rowStartOrder <= selectedOrder) continue; // not ahead
      const rowDest = row.destination === "stay" ? row.fromBase : row.destination;
      if (rowDest === "out" || rowDest === "scored") continue; // left basepaths, no blocking
      const rowDestOrder = BASE_ORDER[rowDest] ?? 0;
      maxAllowedOrder = Math.min(maxAllowedOrder, rowDestOrder - 1);
    }
    // Check batter (only relevant if selected is somehow behind batter — never in practice)
    // No need: batter is always the furthest behind (order 0)

    return rawDests.filter((dest) => {
      // "out" is always available
      if (dest === "out") return true;

      // Compute the order of this destination
      const destOrder =
        dest === "stay" ? (BASE_ORDER[selectedFromBase] ?? 0) : (BASE_ORDER[dest] ?? 0);

      // No-passing: cannot exceed maxAllowedOrder
      if (destOrder > maxAllowedOrder) return false;

      // Collision: bases can only hold one entity
      if (dest === "scored") return true;
      if (dest === "stay") {
        return !othersOccupied.has(selectedFromBase as RunnerDest);
      }
      return !othersOccupied.has(dest);
    });
  })();

  // Build all entities with their current positions for stacking
  type Entity = {
    key: string;
    isBatter: boolean;
    lineupId: string;
    playerName: string;
    fromBase: "batter" | "1st" | "2nd" | "3rd";
    destination: RunnerDest;
  };

  const entities: Entity[] = [
    ...runnerRows.map((r) => ({
      key: `runner-${r.lineupId}`,
      isBatter: false,
      lineupId: r.lineupId,
      playerName: r.playerName,
      fromBase: r.fromBase,
      destination: r.destination,
    })),
    {
      key: "batter",
      isBatter: true,
      lineupId: batter.lineupId,
      playerName: batter.playerName,
      fromBase: "batter" as const,
      destination: batter.destination,
    },
  ];

  // Group entities by destination zone for stacking
  const destGroups: Record<string, Entity[]> = {};
  for (const e of entities) {
    const destKey = e.destination === "stay" ? `origin-${e.fromBase}` : e.destination;
    if (!destGroups[destKey]) destGroups[destKey] = [];
    destGroups[destKey].push(e);
  }

  function getEntityPosition(entity: Entity): { x: number; y: number } {
    const dest = entity.destination;
    const baseCoords =
      dest === "stay" ? ORIGIN_COORDS[entity.fromBase] : DEST_COORDS[dest];
    const destKey = dest === "stay" ? `origin-${entity.fromBase}` : dest;
    const group = destGroups[destKey] ?? [];
    const index = group.indexOf(entity);
    const offset = computeStackOffset(index, group.length);
    return { x: baseCoords.x + offset, y: baseCoords.y };
  }

  const isSelected = (entity: Entity) => {
    if (!selected) return false;
    if (selected.type === "batter") return entity.isBatter;
    return !entity.isBatter && entity.lineupId === selected.lineupId;
  };

  // Determine which zones to show as tappable targets
  const showZones = selected !== null;

  return (
    <BaseballFieldSvg variant="diamond" className={className}>
      {/* Background tap catcher */}
      <rect
        x={0}
        y={0}
        width={400}
        height={400}
        fill="transparent"
        onClick={handleBackgroundTap}
        data-testid="diamond-background"
      />

      {/* Scored zone */}
      {showZones && validDests.includes("scored") && (
        <g
          data-testid="zone-scored"
          onClick={(e) => {
            e.stopPropagation();
            handleZoneTap("scored");
          }}
          style={{ cursor: "pointer" }}
        >
          <circle
            cx={DEST_ZONES.scored.x}
            cy={DEST_ZONES.scored.y}
            r={28}
            fill="#22c55e"
            opacity={0.3}
            stroke="#16a34a"
            strokeWidth={2}
          />
          <text
            x={DEST_ZONES.scored.x}
            y={DEST_ZONES.scored.y + 4}
            textAnchor="middle"
            fontSize={11}
            fontWeight="bold"
            fill="#15803d"
          >
            得点
          </text>
        </g>
      )}

      {/* Out zone */}
      {showZones && validDests.includes("out") && (
        <g
          data-testid="zone-out"
          onClick={(e) => {
            e.stopPropagation();
            handleZoneTap("out");
          }}
          style={{ cursor: "pointer" }}
        >
          <circle
            cx={DEST_ZONES.out.x}
            cy={DEST_ZONES.out.y}
            r={28}
            fill="#ef4444"
            opacity={0.3}
            stroke="#dc2626"
            strokeWidth={2}
          />
          <text
            x={DEST_ZONES.out.x}
            y={DEST_ZONES.out.y + 4}
            textAnchor="middle"
            fontSize={11}
            fontWeight="bold"
            fill="#dc2626"
          >
            OUT
          </text>
        </g>
      )}

      {/* Base tap targets (only shown when entity is selected) */}
      {showZones &&
        (["1st", "2nd", "3rd"] as const).map((base) => {
          const isValid = validDests.includes(base);
          if (!isValid) return null;
          const pos = BASE_POSITIONS[base === "1st" ? "first" : base === "2nd" ? "second" : "third"];
          return (
            <circle
              key={`target-${base}`}
              data-testid={`zone-${base}`}
              cx={pos.x}
              cy={pos.y}
              r={24}
              fill="#3b82f6"
              opacity={0.2}
              stroke="#2563eb"
              strokeWidth={2}
              style={{ cursor: "pointer" }}
              onClick={(e) => {
                e.stopPropagation();
                handleZoneTap(base);
              }}
            />
          );
        })}

      {/* Ghost dots at origin when entity has moved */}
      <AnimatePresence>
        {entities.map((entity) => {
          if (entity.destination === "stay") return null;
          const origin = ORIGIN_COORDS[entity.fromBase];
          return (
            <circle
              key={`ghost-${entity.key}`}
              data-testid={`ghost-${entity.key}`}
              cx={origin.x}
              cy={origin.y}
              r={RUNNER_RADIUS - 2}
              fill="none"
              stroke={entity.isBatter ? "#d97706" : "#3b82f6"}
              strokeWidth={1.5}
              strokeDasharray="4 3"
              opacity={0.4}
            />
          );
        })}
      </AnimatePresence>

      {/* Entity dots */}
      <AnimatePresence>
        {entities.map((entity) => {
          const pos = getEntityPosition(entity);
          const entitySelected = isSelected(entity);
          const fillColor = entity.isBatter ? "#d97706" : "#2563eb";

          return (
            <motion.g
              key={entity.key}
              data-testid={`dot-${entity.key}`}
              initial={false}
              animate={{ x: pos.x, y: pos.y }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              onClick={(e) => {
                e.stopPropagation();
                handleSelect(
                  entity.isBatter
                    ? { type: "batter" }
                    : { type: "runner", lineupId: entity.lineupId }
                );
              }}
              style={{ cursor: "pointer" }}
            >
              {/* Pulse ring when selected */}
              {entitySelected && (
                <motion.circle
                  cx={0}
                  cy={0}
                  r={RUNNER_RADIUS + 6}
                  fill="none"
                  stroke={fillColor}
                  strokeWidth={2}
                  initial={{ opacity: 0.8, scale: 0.9 }}
                  animate={{ opacity: [0.8, 0.3, 0.8], scale: [0.9, 1.1, 0.9] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  data-testid={`pulse-${entity.key}`}
                />
              )}

              {/* Main dot */}
              <circle
                cx={0}
                cy={0}
                r={RUNNER_RADIUS}
                fill={fillColor}
                stroke="white"
                strokeWidth={2}
              />

              {/* Player name */}
              <foreignObject
                x={-RUNNER_RADIUS}
                y={-RUNNER_RADIUS}
                width={RUNNER_RADIUS * 2}
                height={RUNNER_RADIUS * 2}
              >
                <div className="flex items-center justify-center h-full w-full text-[9px] font-bold text-white leading-none text-center">
                  {entity.playerName.length > 3
                    ? entity.playerName.slice(0, 3)
                    : entity.playerName}
                </div>
              </foreignObject>

              {/* Destination label below */}
              <foreignObject
                x={-30}
                y={RUNNER_RADIUS + 2}
                width={60}
                height={16}
              >
                <div className="text-[9px] text-center font-medium text-muted-foreground truncate">
                  {entity.destination === "stay"
                    ? ""
                    : entity.destination === "scored"
                      ? "得点"
                      : entity.destination === "out"
                        ? "OUT"
                        : `→${entity.destination.replace("st", "塁").replace("nd", "塁").replace("rd", "塁")}`}
                </div>
              </foreignObject>
            </motion.g>
          );
        })}
      </AnimatePresence>
    </BaseballFieldSvg>
  );
}
