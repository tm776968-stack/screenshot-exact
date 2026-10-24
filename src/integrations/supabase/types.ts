export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      event_types: {
        Row: {
          enabled: boolean
          icon: string
          id: string
          key: string
          name: string
          points: number
          score_target: string
          sort: number
          tournament_id: string
        }
        Insert: {
          enabled?: boolean
          icon?: string
          id?: string
          key: string
          name: string
          points?: number
          score_target?: string
          sort?: number
          tournament_id: string
        }
        Update: {
          enabled?: boolean
          icon?: string
          id?: string
          key?: string
          name?: string
          points?: number
          score_target?: string
          sort?: number
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_types_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      match_events: {
        Row: {
          created_at: string
          event_type_id: string
          id: string
          match_id: string
          minute: number | null
          period: number | null
          player_id: string | null
          team_id: string | null
          tournament_id: string
        }
        Insert: {
          created_at?: string
          event_type_id: string
          id?: string
          match_id: string
          minute?: number | null
          period?: number | null
          player_id?: string | null
          team_id?: string | null
          tournament_id: string
        }
        Update: {
          created_at?: string
          event_type_id?: string
          id?: string
          match_id?: string
          minute?: number | null
          period?: number | null
          player_id?: string | null
          team_id?: string | null
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_events_event_type_id_fkey"
            columns: ["event_type_id"]
            isOneToOne: false
            referencedRelation: "event_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_events_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_events_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_events_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_events_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          away_pens: number | null
          away_score: number
          away_team_id: string | null
          bracket_pos: number | null
          clock_elapsed: number
          clock_started_at: string | null
          created_at: string
          group_name: string | null
          home_pens: number | null
          home_score: number
          home_team_id: string | null
          id: string
          next_match_id: string | null
          next_slot: string | null
          period: number
          round: number
          scheduled_at: string | null
          stage: string
          status: Database["public"]["Enums"]["match_status"]
          tournament_id: string
          venue_id: string | null
          winner_team_id: string | null
        }
        Insert: {
          away_pens?: number | null
          away_score?: number
          away_team_id?: string | null
          bracket_pos?: number | null
          clock_elapsed?: number
          clock_started_at?: string | null
          created_at?: string
          group_name?: string | null
          home_pens?: number | null
          home_score?: number
          home_team_id?: string | null
          id?: string
          next_match_id?: string | null
          next_slot?: string | null
          period?: number
          round?: number
          scheduled_at?: string | null
          stage?: string
          status?: Database["public"]["Enums"]["match_status"]
          tournament_id: string
          venue_id?: string | null
          winner_team_id?: string | null
        }
        Update: {
          away_pens?: number | null
          away_score?: number
          away_team_id?: string | null
          bracket_pos?: number | null
          clock_elapsed?: number
          clock_started_at?: string | null
          created_at?: string
          group_name?: string | null
          home_pens?: number | null
          home_score?: number
          home_team_id?: string | null
          id?: string
          next_match_id?: string | null
          next_slot?: string | null
          period?: number
          round?: number
          scheduled_at?: string | null
          stage?: string
          status?: Database["public"]["Enums"]["match_status"]
          tournament_id?: string
          venue_id?: string | null
          winner_team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_away_team_id_fkey"
            columns: ["away_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_home_team_id_fkey"
            columns: ["home_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_next_match_id_fkey"
            columns: ["next_match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_winner_team_id_fkey"
            columns: ["winner_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          created_at: string
          id: string
          name: string
          nickname: string | null
          number: number | null
          photo_url: string | null
          position: string | null
          team_id: string
          tournament_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          nickname?: string | null
          number?: number | null
          photo_url?: string | null
          position?: string | null
          team_id: string
          tournament_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          nickname?: string | null
          number?: number | null
          photo_url?: string | null
          position?: string | null
          team_id?: string
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "players_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "players_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
        }
        Relationships: []
      }
      teams: {
        Row: {
          color: string | null
          contact: string | null
          created_at: string
          group_name: string | null
          id: string
          logo_url: string | null
          manager: string | null
          name: string
          seed: number | null
          tournament_id: string
        }
        Insert: {
          color?: string | null
          contact?: string | null
          created_at?: string
          group_name?: string | null
          id?: string
          logo_url?: string | null
          manager?: string | null
          name: string
          seed?: number | null
          tournament_id: string
        }
        Update: {
          color?: string | null
          contact?: string | null
          created_at?: string
          group_name?: string | null
          id?: string
          logo_url?: string | null
          manager?: string | null
          name?: string
          seed?: number | null
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_members: {
        Row: {
          created_at: string
          email: string
          id: string
          tournament_id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          tournament_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_members_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournaments: {
        Row: {
          banner_url: string | null
          created_at: string
          end_date: string | null
          format: string
          id: string
          location: string | null
          logo_url: string | null
          name: string
          owner_id: string
          primary_color: string | null
          published: boolean
          rules: string | null
          settings: Json
          slug: string
          sport: string
          start_date: string | null
          status: Database["public"]["Enums"]["tournament_status"]
        }
        Insert: {
          banner_url?: string | null
          created_at?: string
          end_date?: string | null
          format?: string
          id?: string
          location?: string | null
          logo_url?: string | null
          name: string
          owner_id?: string
          primary_color?: string | null
          published?: boolean
          rules?: string | null
          settings?: Json
          slug: string
          sport?: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["tournament_status"]
        }
        Update: {
          banner_url?: string | null
          created_at?: string
          end_date?: string | null
          format?: string
          id?: string
          location?: string | null
          logo_url?: string | null
          name?: string
          owner_id?: string
          primary_color?: string | null
          published?: boolean
          rules?: string | null
          settings?: Json
          slug?: string
          sport?: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["tournament_status"]
        }
        Relationships: []
      }
      venues: {
        Row: {
          id: string
          name: string
          tournament_id: string
        }
        Insert: {
          id?: string
          name: string
          tournament_id: string
        }
        Update: {
          id?: string
          name?: string
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venues_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_edit_tournament: { Args: { _tid: string }; Returns: boolean }
      is_tournament_public: { Args: { _tid: string }; Returns: boolean }
    }
    Enums: {
      match_status:
        | "agendado"
        | "ao_vivo"
        | "intervalo"
        | "encerrado"
        | "adiado"
        | "wo"
      tournament_status: "rascunho" | "inscricoes" | "andamento" | "finalizado"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      match_status: [
        "agendado",
        "ao_vivo",
        "intervalo",
        "encerrado",
        "adiado",
        "wo",
      ],
      tournament_status: ["rascunho", "inscricoes", "andamento", "finalizado"],
    },
  },
} as const
