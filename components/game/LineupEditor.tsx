"use client";

import { useState, useId } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GripVertical } from "lucide-react";

const UNREGISTERED_PLAYER = "__unregistered__";

interface Player {
  id: string;
  name: string;
  number: string | null;
  position: string | null;
}

export interface LineupEntry {
  battingOrder: number;
  playerId: string | null;
  playerName: string | null;
  position: string | null;
}

interface LineupEditorProps {
  title: string;
  players?: Player[];
  lineup: LineupEntry[];
  onChange: (lineup: LineupEntry[]) => void;
  allowUnregistered?: boolean;
}

interface SortableLineupRowProps {
  entry: LineupEntry;
  index: number;
  sortedPlayers?: Player[];
  allowUnregistered: boolean;
  customName: string;
  onPlayerSelect: (order: number, value: string) => void;
  onCustomNameChange: (order: number, name: string) => void;
  onDirectNameChange: (order: number, name: string | null) => void;
  isUnregistered: boolean;
}

function SortableLineupRow({
  entry,
  index,
  sortedPlayers,
  allowUnregistered,
  customName,
  onPlayerSelect,
  onCustomNameChange,
  onDirectNameChange,
  isUnregistered,
}: SortableLineupRowProps) {
  const sortableId = `lineup-${entry.position}-${index}`;
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: sortableId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 border-b pb-3 last:border-0 last:pb-0 ${
        isDragging ? "opacity-50 bg-muted rounded" : ""
      }`}
    >
      <button
        type="button"
        className="touch-none cursor-grab active:cursor-grabbing p-1 text-muted-foreground hover:text-foreground shrink-0"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-5 w-5" />
      </button>

      <Badge
        variant="outline"
        className="text-base min-w-8 justify-center shrink-0"
      >
        {index + 1}
      </Badge>

      <div className="flex-1 min-w-0 space-y-1">
        {sortedPlayers ? (
          <>
            <Select
              value={
                entry.playerId ??
                (isUnregistered ? UNREGISTERED_PLAYER : "")
              }
              onValueChange={(v) => onPlayerSelect(entry.battingOrder, v)}
            >
              <SelectTrigger className="text-base h-12">
                <SelectValue placeholder="選手を選択" />
              </SelectTrigger>
              <SelectContent>
                {sortedPlayers.map((p) => (
                  <SelectItem
                    key={p.id}
                    value={p.id}
                    className="text-base"
                  >
                    {p.number ? `#${p.number} ` : ""}
                    {p.name}
                  </SelectItem>
                ))}
                {allowUnregistered && (
                  <SelectItem
                    value={UNREGISTERED_PLAYER}
                    className="text-base"
                  >
                    未登録選手
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
            {isUnregistered && (
              <Input
                value={customName ?? entry.playerName ?? ""}
                onChange={(e) =>
                  onCustomNameChange(entry.battingOrder, e.target.value)
                }
                placeholder="選手名を入力"
                className="text-base h-10"
              />
            )}
          </>
        ) : (
          <Input
            value={entry.playerName ?? ""}
            onChange={(e) =>
              onDirectNameChange(
                entry.battingOrder,
                e.target.value || null
              )
            }
            placeholder={`相手選手${index + 1}`}
            className="text-base h-12"
          />
        )}
      </div>

      <div className="w-16 shrink-0 text-center">
        <span className="text-base font-medium text-muted-foreground">
          {entry.position}
        </span>
      </div>
    </div>
  );
}

export function LineupEditor({
  title,
  players,
  lineup,
  onChange,
  allowUnregistered = false,
}: LineupEditorProps) {
  const dndId = useId();
  const [customNames, setCustomNames] = useState<Record<number, string>>({});

  const sortedPlayers = players
    ? [...players].sort((a, b) => {
        const na = parseInt(a.number ?? "", 10);
        const nb = parseInt(b.number ?? "", 10);
        if (!isNaN(na) && !isNaN(nb)) return na - nb;
        if (isNaN(na) && !isNaN(nb)) return 1;
        if (!isNaN(na) && isNaN(nb)) return -1;
        return (a.number ?? "").localeCompare(b.number ?? "");
      })
    : undefined;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const sortableIds = lineup.map(
    (entry, i) => `lineup-${entry.position}-${i}`
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = sortableIds.indexOf(active.id as string);
    const newIndex = sortableIds.indexOf(over.id as string);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(lineup, oldIndex, newIndex).map(
      (entry, i) => ({ ...entry, battingOrder: i + 1 })
    );
    onChange(reordered);
  };

  const updateEntry = (order: number, partial: Partial<LineupEntry>) => {
    const next = lineup.map((e) =>
      e.battingOrder === order ? { ...e, ...partial } : e
    );
    onChange(next);
  };

  const handlePlayerSelect = (order: number, value: string) => {
    if (value === UNREGISTERED_PLAYER) {
      const name = customNames[order] ?? "";
      updateEntry(order, { playerId: null, playerName: name });
    } else if (sortedPlayers) {
      const p = sortedPlayers.find((pl) => pl.id === value);
      if (p) {
        updateEntry(order, { playerId: p.id, playerName: p.name });
      }
    }
  };

  const handleCustomNameChange = (order: number, name: string) => {
    setCustomNames((prev) => ({ ...prev, [order]: name }));
    updateEntry(order, { playerId: null, playerName: name || null });
  };

  const handleDirectNameChange = (order: number, name: string | null) => {
    updateEntry(order, { playerName: name });
  };

  const isUnregisteredSelected = (entry: LineupEntry) => {
    // Only treat as "unregistered" when user explicitly selected it
    // (playerName is non-null but playerId is null).
    // Initial state (both null) shows placeholder.
    return !entry.playerId && entry.playerName !== null && players !== undefined;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <DndContext
          id={dndId}
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={sortableIds}
            strategy={verticalListSortingStrategy}
          >
            {lineup.map((entry, index) => {
              // Filter out players already selected in other rows
              const availablePlayers = sortedPlayers?.filter(
                (p) =>
                  p.id === entry.playerId ||
                  !lineup.some(
                    (other) =>
                      other.battingOrder !== entry.battingOrder &&
                      other.playerId === p.id
                  )
              );
              return (
                <SortableLineupRow
                  key={sortableIds[index]}
                  entry={entry}
                  index={index}
                  sortedPlayers={availablePlayers}
                  allowUnregistered={allowUnregistered}
                  customName={customNames[entry.battingOrder] ?? ""}
                  onPlayerSelect={handlePlayerSelect}
                  onCustomNameChange={handleCustomNameChange}
                  onDirectNameChange={handleDirectNameChange}
                  isUnregistered={isUnregisteredSelected(entry)}
                />
              );
            })}
          </SortableContext>
        </DndContext>
      </CardContent>
    </Card>
  );
}
