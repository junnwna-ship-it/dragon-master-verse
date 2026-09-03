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
      game_settings: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_published: boolean
          key: string
          updated_at: string
          value: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_published?: boolean
          key: string
          updated_at?: string
          value?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_published?: boolean
          key?: string
          updated_at?: string
          value?: string | null
        }
        Relationships: []
      }
      gold_packages: {
        Row: {
          created_at: string
          gold_amount: number
          price_external_id: string
        }
        Insert: {
          created_at?: string
          gold_amount: number
          price_external_id: string
        }
        Update: {
          created_at?: string
          gold_amount?: number
          price_external_id?: string
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
      processed_payments: {
        Row: {
          created_at: string
          environment: string
          gold_credited: number
          paddle_transaction_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          environment: string
          gold_credited: number
          paddle_transaction_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          environment?: string
          gold_credited?: number
          paddle_transaction_id?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          current_stage: number
          gold: number
          nickname: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_stage?: number
          gold?: number
          nickname?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_stage?: number
          gold?: number
          nickname?: string | null
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
      store_items: {
        Row: {
          created_at: string
          gold_reward: number
          id: string
          image_url: string | null
          is_published: boolean
          item_type: string
          name: string
          price_usd: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          gold_reward?: number
          id?: string
          image_url?: string | null
          is_published?: boolean
          item_type?: string
          name: string
          price_usd?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          gold_reward?: number
          id?: string
          image_url?: string | null
          is_published?: boolean
          item_type?: string
          name?: string
          price_usd?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      story_nodes: {
        Row: {
          background_image_url: string | null
          body_text: string | null
          chapter_id: string
          created_at: string
          description: string | null
          id: string
          is_published: boolean
          is_start: boolean
          node_key: string | null
          node_type: string
          options: Json
          quiz_ids: string[]
          speaker: string | null
          stage_number: number
          state_changes: Json
          title: string
          updated_at: string
        }
        Insert: {
          background_image_url?: string | null
          body_text?: string | null
          chapter_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_published?: boolean
          is_start?: boolean
          node_key?: string | null
          node_type?: string
          options?: Json
          quiz_ids?: string[]
          speaker?: string | null
          stage_number?: number
          state_changes?: Json
          title: string
          updated_at?: string
        }
        Update: {
          background_image_url?: string | null
          body_text?: string | null
          chapter_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_published?: boolean
          is_start?: boolean
          node_key?: string | null
          node_type?: string
          options?: Json
          quiz_ids?: string[]
          speaker?: string | null
          stage_number?: number
          state_changes?: Json
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      story_saves: {
        Row: {
          created_at: string
          current_node_id: number
          dragon_name: string | null
          dragon_uuid: string | null
          player_hp: number
          player_mp: number
          updated_at: string
          user_id: string
          visited: number[]
          vn_applied: string[]
          vn_chapter_id: string | null
          vn_finished: boolean
          vn_node_key: string | null
          vn_stats: Json
          vn_visited: string[]
        }
        Insert: {
          created_at?: string
          current_node_id?: number
          dragon_name?: string | null
          dragon_uuid?: string | null
          player_hp?: number
          player_mp?: number
          updated_at?: string
          user_id: string
          visited?: number[]
          vn_applied?: string[]
          vn_chapter_id?: string | null
          vn_finished?: boolean
          vn_node_key?: string | null
          vn_stats?: Json
          vn_visited?: string[]
        }
        Update: {
          created_at?: string
          current_node_id?: number
          dragon_name?: string | null
          dragon_uuid?: string | null
          player_hp?: number
          player_mp?: number
          updated_at?: string
          user_id?: string
          visited?: number[]
          vn_applied?: string[]
          vn_chapter_id?: string | null
          vn_finished?: boolean
          vn_node_key?: string | null
          vn_stats?: Json
          vn_visited?: string[]
        }
        Relationships: []
      }
      training_stats: {
        Row: {
          base_cost: number
          created_at: string
          icon_url: string | null
          id: string
          is_published: boolean
          sort_order: number
          stat_code: string
          stat_increase: number
          stat_name: string
          updated_at: string
        }
        Insert: {
          base_cost?: number
          created_at?: string
          icon_url?: string | null
          id?: string
          is_published?: boolean
          sort_order?: number
          stat_code: string
          stat_increase?: number
          stat_name: string
          updated_at?: string
        }
        Update: {
          base_cost?: number
          created_at?: string
          icon_url?: string | null
          id?: string
          is_published?: boolean
          sort_order?: number
          stat_code?: string
          stat_increase?: number
          stat_name?: string
          updated_at?: string
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
      user_stories: {
        Row: {
          body: string | null
          cover_image_url: string | null
          created_at: string
          id: string
          is_published: boolean
          summary: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body?: string | null
          cover_image_url?: string | null
          created_at?: string
          id?: string
          is_published?: boolean
          summary?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string | null
          cover_image_url?: string | null
          created_at?: string
          id?: string
          is_published?: boolean
          summary?: string | null
          title?: string
          updated_at?: string
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
      credit_gold_from_purchase: {
        Args: { _env: string; _gold: number; _txn_id: string; _user_id: string }
        Returns: Json
      }
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
      app_role: ["admin", "user"],
    },
  },
} as const
