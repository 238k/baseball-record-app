export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      at_bats: {
        Row: {
          batting_order: number
          created_at: string
          game_id: string
          id: string
          inning: number
          inning_half: string
          lineup_id: string
          pitch_count: number
          rbi: number
          recorded_by: string | null
          result: string | null
          runners_after: Json | null
        }
        Insert: {
          batting_order: number
          created_at?: string
          game_id: string
          id?: string
          inning: number
          inning_half: string
          lineup_id: string
          pitch_count?: number
          rbi?: number
          recorded_by?: string | null
          result?: string | null
          runners_after?: Json | null
        }
        Update: {
          batting_order?: number
          created_at?: string
          game_id?: string
          id?: string
          inning?: number
          inning_half?: string
          lineup_id?: string
          pitch_count?: number
          rbi?: number
          recorded_by?: string | null
          result?: string | null
          runners_after?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "at_bats_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "at_bats_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "v_scoreboard"
            referencedColumns: ["game_id"]
          },
          {
            foreignKeyName: "at_bats_lineup_id_fkey"
            columns: ["lineup_id"]
            isOneToOne: false
            referencedRelation: "lineups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "at_bats_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      base_runners: {
        Row: {
          at_bat_id: string
          base: string
          game_id: string
          id: string
          lineup_id: string
        }
        Insert: {
          at_bat_id: string
          base: string
          game_id: string
          id?: string
          lineup_id: string
        }
        Update: {
          at_bat_id?: string
          base?: string
          game_id?: string
          id?: string
          lineup_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "base_runners_at_bat_id_fkey"
            columns: ["at_bat_id"]
            isOneToOne: false
            referencedRelation: "at_bats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "base_runners_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "base_runners_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "v_scoreboard"
            referencedColumns: ["game_id"]
          },
          {
            foreignKeyName: "base_runners_lineup_id_fkey"
            columns: ["lineup_id"]
            isOneToOne: false
            referencedRelation: "lineups"
            referencedColumns: ["id"]
          },
        ]
      }
      game_input_requests: {
        Row: {
          created_at: string
          game_id: string
          id: string
          requester_id: string
          status: string
        }
        Insert: {
          created_at?: string
          game_id: string
          id?: string
          requester_id: string
          status?: string
        }
        Update: {
          created_at?: string
          game_id?: string
          id?: string
          requester_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_input_requests_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_input_requests_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "v_scoreboard"
            referencedColumns: ["game_id"]
          },
          {
            foreignKeyName: "game_input_requests_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      game_input_sessions: {
        Row: {
          created_at: string
          current_pitch_log: Json
          game_id: string
          id: string
          last_active_at: string
          profile_id: string
        }
        Insert: {
          created_at?: string
          current_pitch_log?: Json
          game_id: string
          id?: string
          last_active_at?: string
          profile_id: string
        }
        Update: {
          created_at?: string
          current_pitch_log?: Json
          game_id?: string
          id?: string
          last_active_at?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_input_sessions_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: true
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_input_sessions_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: true
            referencedRelation: "v_scoreboard"
            referencedColumns: ["game_id"]
          },
          {
            foreignKeyName: "game_input_sessions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      games: {
        Row: {
          created_at: string
          game_date: string
          id: string
          innings: number
          is_home: boolean
          location: string | null
          opponent_name: string
          status: string
          team_id: string
          use_dh: boolean
        }
        Insert: {
          created_at?: string
          game_date: string
          id?: string
          innings?: number
          is_home?: boolean
          location?: string | null
          opponent_name: string
          status?: string
          team_id: string
          use_dh?: boolean
        }
        Update: {
          created_at?: string
          game_date?: string
          id?: string
          innings?: number
          is_home?: boolean
          location?: string | null
          opponent_name?: string
          status?: string
          team_id?: string
          use_dh?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "games_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      lineups: {
        Row: {
          batting_order: number
          created_at: string
          game_id: string
          id: string
          inning_from: number
          player_id: string | null
          player_name: string | null
          position: string | null
          team_side: string
        }
        Insert: {
          batting_order: number
          created_at?: string
          game_id: string
          id?: string
          inning_from?: number
          player_id?: string | null
          player_name?: string | null
          position?: string | null
          team_side: string
        }
        Update: {
          batting_order?: number
          created_at?: string
          game_id?: string
          id?: string
          inning_from?: number
          player_id?: string | null
          player_name?: string | null
          position?: string | null
          team_side?: string
        }
        Relationships: [
          {
            foreignKeyName: "lineups_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lineups_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "v_scoreboard"
            referencedColumns: ["game_id"]
          },
          {
            foreignKeyName: "lineups_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      pitches: {
        Row: {
          at_bat_id: string
          created_at: string
          id: string
          pitch_number: number
          result: string
        }
        Insert: {
          at_bat_id: string
          created_at?: string
          id?: string
          pitch_number: number
          result: string
        }
        Update: {
          at_bat_id?: string
          created_at?: string
          id?: string
          pitch_number?: number
          result?: string
        }
        Relationships: [
          {
            foreignKeyName: "pitches_at_bat_id_fkey"
            columns: ["at_bat_id"]
            isOneToOne: false
            referencedRelation: "at_bats"
            referencedColumns: ["id"]
          },
        ]
      }
      pitching_records: {
        Row: {
          created_at: string
          earned_runs: number
          game_id: string
          hits: number
          id: string
          inning_from: number
          inning_to: number | null
          lineup_id: string
          outs_recorded: number
          runs: number
          strikeouts: number
          walks: number
        }
        Insert: {
          created_at?: string
          earned_runs?: number
          game_id: string
          hits?: number
          id?: string
          inning_from: number
          inning_to?: number | null
          lineup_id: string
          outs_recorded?: number
          runs?: number
          strikeouts?: number
          walks?: number
        }
        Update: {
          created_at?: string
          earned_runs?: number
          game_id?: string
          hits?: number
          id?: string
          inning_from?: number
          inning_to?: number | null
          lineup_id?: string
          outs_recorded?: number
          runs?: number
          strikeouts?: number
          walks?: number
        }
        Relationships: [
          {
            foreignKeyName: "pitching_records_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pitching_records_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "v_scoreboard"
            referencedColumns: ["game_id"]
          },
          {
            foreignKeyName: "pitching_records_lineup_id_fkey"
            columns: ["lineup_id"]
            isOneToOne: false
            referencedRelation: "lineups"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          number: string | null
          position: string | null
          team_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          number?: string | null
          position?: string | null
          team_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          number?: string | null
          position?: string | null
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "players_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          default_team_id: string | null
          display_name: string
          id: string
        }
        Insert: {
          created_at?: string
          default_team_id?: string | null
          display_name: string
          id: string
        }
        Update: {
          created_at?: string
          default_team_id?: string | null
          display_name?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_default_team_id_fkey"
            columns: ["default_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      runner_events: {
        Row: {
          at_bat_id: string
          created_at: string
          event_type: string
          id: string
          lineup_id: string
        }
        Insert: {
          at_bat_id: string
          created_at?: string
          event_type: string
          id?: string
          lineup_id: string
        }
        Update: {
          at_bat_id?: string
          created_at?: string
          event_type?: string
          id?: string
          lineup_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "runner_events_at_bat_id_fkey"
            columns: ["at_bat_id"]
            isOneToOne: false
            referencedRelation: "at_bats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "runner_events_lineup_id_fkey"
            columns: ["lineup_id"]
            isOneToOne: false
            referencedRelation: "lineups"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          created_at: string
          id: string
          profile_id: string
          role: string
          team_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          profile_id: string
          role?: string
          team_id: string
        }
        Update: {
          created_at?: string
          id?: string
          profile_id?: string
          role?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          id: string
          invite_code: string
          name: string
          owner_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invite_code?: string
          name: string
          owner_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invite_code?: string
          name?: string
          owner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_batter_career_stats: {
        Row: {
          at_bats: number | null
          caught_stealing: number | null
          doubles: number | null
          games: number | null
          hit_by_pitch: number | null
          hits: number | null
          home_runs: number | null
          name: string | null
          number: string | null
          plate_appearances: number | null
          player_id: string | null
          rbi: number | null
          runs: number | null
          sac_flies: number | null
          stolen_bases: number | null
          strikeouts: number | null
          team_id: string | null
          total_bases: number | null
          triples: number | null
          walks: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lineups_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "players_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      v_batter_game_stats: {
        Row: {
          at_bats: number | null
          batting_order: number | null
          caught_stealing: number | null
          doubles: number | null
          game_id: string | null
          hit_by_pitch: number | null
          hits: number | null
          home_runs: number | null
          lineup_id: string | null
          name: string | null
          number: string | null
          plate_appearances: number | null
          player_id: string | null
          player_name: string | null
          rbi: number | null
          runs: number | null
          sac_bunts: number | null
          sac_flies: number | null
          singles: number | null
          stolen_bases: number | null
          strikeouts: number | null
          total_bases: number | null
          triples: number | null
          walks: number | null
        }
        Relationships: [
          {
            foreignKeyName: "at_bats_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "at_bats_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "v_scoreboard"
            referencedColumns: ["game_id"]
          },
          {
            foreignKeyName: "at_bats_lineup_id_fkey"
            columns: ["lineup_id"]
            isOneToOne: false
            referencedRelation: "lineups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lineups_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      v_pitcher_career_stats: {
        Row: {
          earned_runs: number | null
          era: number | null
          games: number | null
          hits: number | null
          innings_pitched: string | null
          name: string | null
          number: string | null
          outs_recorded: number | null
          player_id: string | null
          runs: number | null
          strikeouts: number | null
          team_id: string | null
          walks: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lineups_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "players_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      v_pitcher_game_stats: {
        Row: {
          earned_runs: number | null
          era: number | null
          game_id: string | null
          hits: number | null
          innings_pitched: string | null
          lineup_id: string | null
          name: string | null
          number: string | null
          outs_recorded: number | null
          player_id: string | null
          runs: number | null
          strikeouts: number | null
          walks: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lineups_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pitching_records_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pitching_records_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "v_scoreboard"
            referencedColumns: ["game_id"]
          },
          {
            foreignKeyName: "pitching_records_lineup_id_fkey"
            columns: ["lineup_id"]
            isOneToOne: false
            referencedRelation: "lineups"
            referencedColumns: ["id"]
          },
        ]
      }
      v_scoreboard: {
        Row: {
          game_id: string | null
          inning: number | null
          inning_half: string | null
          runs: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      get_my_team_ids: { Args: never; Returns: string[] }
      get_team_id_by_invite_code: {
        Args: { p_invite_code: string }
        Returns: string
      }
      join_team_by_invite_code: {
        Args: { p_invite_code: string }
        Returns: string
      }
      promote_team_member: { Args: { p_member_id: string }; Returns: undefined }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

