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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      dragons: {
        Row: {
          atk: number
          created_at: string
          created_by: string | null
          def: number
          element: string
          exp: number
          id: string
          image_url: string | null
          is_seed: boolean
          level: number
          lore: string | null
          max_hp: number
          mp: number
          name: string
          stat_points: number
          updated_at: string
        }
        Insert: {
          atk?: number
          created_at?: string
          created_by?: string | null
          def?: number
          element: string
          exp?: number
          id?: string
          image_url?: string | null
          is_seed?: boolean
          level?: number
          lore?: string | null
          max_hp?: number
          mp?: number
          name: string
          stat_points?: number
          updated_at?: string
        }
        Update: {
          atk?: number
          created_at?: string
          created_by?: string | null
          def?: number
          element?: string
          exp?: number
          id?: string
          image_url?: string | null
          is_seed?: boolean
          level?: number
          lore?: string | null
          max_hp?: number
          mp?: number
          name?: string
          stat_points?: number
          updated_at?: string
        }
        Relationships: []
      }
      owned_dragons: {
        Row: {
          acquired_at: string
          bonus_stat_points: number
          dragon_id: string
          id: string
          user_id: string
        }
        Insert: {
          acquired_at?: string
          bonus_stat_points?: number
          dragon_id: string
          id?: string
          user_id: string
        }
        Update: {
          acquired_at?: string
          bonus_stat_points?: number
          dragon_id?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          gold: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          gold?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          gold?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      quizzes: {
        Row: {
          answer_index: number
          category: string
          choices: Json
          created_at: string
          created_by: string | null
          id: string
          question: string
          updated_at: string
        }
        Insert: {
          answer_index: number
          category?: string
          choices: Json
          created_at?: string
          created_by?: string | null
          id?: string
          question: string
          updated_at?: string
        }
        Update: {
          answer_index?: number
          category?: string
          choices?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          question?: string
          updated_at?: string
        }
        Relationships: []
      }
      scanned_cards: {
        Row: {
          atk: number
          confidence: number | null
          created_at: string
          def: number
          element: string
          hp: number
          id: string
          image_url: string | null
          max_hp: number
          mp: number
          name: string
          user_id: string
        }
        Insert: {
          atk?: number
          confidence?: number | null
          created_at?: string
          def?: number
          element: string
          hp?: number
          id?: string
          image_url?: string | null
          max_hp?: number
          mp?: number
          name: string
          user_id: string
        }
        Update: {
          atk?: number
          confidence?: number | null
          created_at?: string
          def?: number
          element?: string
          hp?: number
          id?: string
          image_url?: string | null
          max_hp?: number
          mp?: number
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      user_inventory: {
        Row: {
          id: string
          item_key: string
          quantity: number
          updated_at: string
          user_id: string
        }
        Insert: {
          id?: string
          item_key: string
          quantity?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          id?: string
          item_key?: string
          quantity?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      award_battle_reward: {
        Args: { _dragon_uuid: string; _outcome: string }
        Returns: Json
      }
      bond_with_dragon: { Args: { _dragon_uuid: string }; Returns: Json }
      claim_quiz_reward: { Args: { _correct: number }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      purchase_shop_item: {
        Args: { _dragon_uuid: string; _item_key: string }
        Returns: Json
      }
      recruit_dragon: { Args: { _dragon_uuid: string }; Returns: Json }
      spend_stat_point: {
        Args: { _dragon_uuid: string; _stat: string }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
