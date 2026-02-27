import { z } from "zod/v4";

// ---- Constants ----

export const VALID_RESULTS = [
  "1B", "2B", "3B", "HR",
  "BB", "IBB", "HBP",
  "K", "KK",
  "GO", "FO", "LO", "DP", "SF", "SH", "FC", "E",
] as const;

export const VALID_POSITIONS = ["投", "捕", "一", "二", "三", "遊", "左", "中", "右", "DH"] as const;

const VALID_PITCH_RESULTS = ["ball", "swinging", "looking", "foul"] as const;

// DB enforces UUID format, so we just check non-empty strings here
const idString = z.string().min(1);

// ---- Schemas ----

export const createGameSchema = z.object({
  teamId: idString,
  opponentName: z.string().min(1, "相手チーム名を入力してください"),
  gameDate: z.string().min(1, "試合日を入力してください"),
  location: z.string(),
  isHome: z.boolean(),
  innings: z.number().int().min(1).max(30),
  useDh: z.boolean(),
});

export const updateGameSchema = z.object({
  gameId: idString,
  opponentName: z.string().min(1, "相手チーム名を入力してください"),
  gameDate: z.string().min(1, "試合日を入力してください"),
  location: z.string(),
  isHome: z.boolean(),
  innings: z.number().int().min(1).max(30),
  useDh: z.boolean(),
});

export const createFreeGameSchema = z.object({
  homeTeamName: z.string().min(1, "ホームチーム名を入力してください"),
  visitorTeamName: z.string().min(1, "ビジターチーム名を入力してください"),
  gameDate: z.string().min(1, "試合日を入力してください"),
  location: z.string(),
  innings: z.number().int().min(1).max(30),
  useDh: z.boolean(),
});

export const updateFreeGameSchema = z.object({
  gameId: idString,
  homeTeamName: z.string().min(1, "ホームチーム名を入力してください"),
  visitorTeamName: z.string().min(1, "ビジターチーム名を入力してください"),
  gameDate: z.string().min(1, "試合日を入力してください"),
  location: z.string(),
  innings: z.number().int().min(1).max(30),
  useDh: z.boolean(),
});

const lineupEntrySchema = z.object({
  battingOrder: z.number().int().min(1).max(9),
  playerId: z.string().nullable(),
  playerName: z.string().nullable(),
  position: z.string().nullable(),
});

const dhPitcherSchema = z.object({
  playerId: z.string().nullable(),
  playerName: z.string().min(1),
});

export const saveLineupSchema = z.object({
  gameId: idString,
  homeLineup: z.array(lineupEntrySchema),
  visitorLineup: z.array(lineupEntrySchema),
  homePitcherOrder: z.number().int().min(1).max(9),
  visitorPitcherOrder: z.number().int().min(1).max(9),
  homeDhPitcher: dhPitcherSchema.optional(),
  visitorDhPitcher: dhPitcherSchema.optional(),
});

const runnerDestinationSchema = z.object({
  lineupId: idString,
  event: z.enum(["scored", "out", "stay"]),
  toBase: z.enum(["1st", "2nd", "3rd"]).optional(),
});

export const recordAtBatSchema = z.object({
  gameId: idString,
  inning: z.number().int().min(1),
  inningHalf: z.enum(["top", "bottom"]),
  battingOrder: z.number().int().min(1).max(9),
  lineupId: idString,
  result: z.enum(VALID_RESULTS),
  rbi: z.number().int().min(0),
  pitchCount: z.number().int().min(0),
  pitches: z.array(z.enum(VALID_PITCH_RESULTS)),
  baseRunnersBefore: z.array(
    z.object({
      base: z.string(),
      lineupId: idString,
    })
  ),
  runnerDestinations: z.array(runnerDestinationSchema),
  runnersAfter: z
    .array(z.object({ base: z.string(), lineupId: idString }))
    .optional(),
});

export const changePitcherSchema = z.object({
  gameId: idString,
  currentInning: z.number().int().min(1),
  newPitcherLineupId: idString,
  fieldingTeamSide: z.enum(["home", "visitor"]),
});

export const recordStealSchema = z.object({
  gameId: idString,
  lineupId: idString,
  eventType: z.enum(["stolen_base", "caught_stealing"]),
  fromBase: z.enum(["1st", "2nd", "3rd"]),
});

export const substitutePlayerSchema = z.object({
  gameId: idString,
  battingOrder: z.number().int().min(1).max(9),
  teamSide: z.enum(["home", "visitor"]),
  newPlayerId: z.string().nullable(),
  newPlayerName: z.string().refine((val) => val.trim().length > 0, "交代選手の名前を入力してください"),
  newPosition: z.string(),
  currentInning: z.number().int().min(1),
  type: z.enum(["pinch_hitter", "pinch_runner"]),
  replacedLineupId: z.string().optional(),
});

export const changePositionSchema = z.object({
  gameId: idString,
  changes: z
    .array(
      z.object({
        lineupId: idString,
        newPosition: z.string().min(1),
      })
    )
    .min(1, "変更する守備位置を選択してください"),
});

export const recordRunnerAdvanceSchema = z.object({
  gameId: idString,
  eventType: z.enum(["wild_pitch", "passed_ball", "balk"]),
  advances: z
    .array(
      z.object({
        lineupId: idString,
        fromBase: z.enum(["1st", "2nd", "3rd"]),
        toBase: z.enum(["2nd", "3rd", "home"]),
      })
    )
    .min(1, "進塁する走者を選択してください"),
});

// ---- Helper ----

export function parseOrError<T>(
  schema: z.ZodType<T>,
  data: unknown
): { data: T; error?: never } | { data?: never; error: string } {
  const result = schema.safeParse(data);
  if (!result.success) {
    const firstIssue = result.error.issues[0];
    return { error: firstIssue?.message ?? "入力が不正です" };
  }
  return { data: result.data };
}
