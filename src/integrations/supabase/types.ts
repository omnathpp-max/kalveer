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
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity_id: string | null
          id: string
          module: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          id?: string
          module: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          id?: string
          module?: string
          user_id?: string | null
        }
        Relationships: []
      }
      petty_cash_denominations: {
        Row: {
          coins: number
          created_at: string
          entered_by: string
          entry_date: string
          expected_closing: number | null
          id: string
          mismatch_note: string | null
          notes_10: number
          notes_100: number
          notes_20: number
          notes_200: number
          notes_50: number
          notes_500: number
          total: number
          updated_at: string
        }
        Insert: {
          coins?: number
          created_at?: string
          entered_by: string
          entry_date: string
          expected_closing?: number | null
          id?: string
          mismatch_note?: string | null
          notes_10?: number
          notes_100?: number
          notes_20?: number
          notes_200?: number
          notes_50?: number
          notes_500?: number
          total?: number
          updated_at?: string
        }
        Update: {
          coins?: number
          created_at?: string
          entered_by?: string
          entry_date?: string
          expected_closing?: number | null
          id?: string
          mismatch_note?: string | null
          notes_10?: number
          notes_100?: number
          notes_20?: number
          notes_200?: number
          notes_50?: number
          notes_500?: number
          total?: number
          updated_at?: string
        }
        Relationships: []
      }
      petty_cash_ledger: {
        Row: {
          amount: number
          attachment_url: string | null
          category: string
          created_at: string
          description: string | null
          entered_by: string
          entry_date: string
          id: string
          linked_request_id: string | null
          party: string | null
          type: Database["public"]["Enums"]["cash_flow_type"]
          updated_at: string
          voucher_no: string | null
        }
        Insert: {
          amount: number
          attachment_url?: string | null
          category: string
          created_at?: string
          description?: string | null
          entered_by: string
          entry_date: string
          id?: string
          linked_request_id?: string | null
          party?: string | null
          type: Database["public"]["Enums"]["cash_flow_type"]
          updated_at?: string
          voucher_no?: string | null
        }
        Update: {
          amount?: number
          attachment_url?: string | null
          category?: string
          created_at?: string
          description?: string | null
          entered_by?: string
          entry_date?: string
          id?: string
          linked_request_id?: string | null
          party?: string | null
          type?: Database["public"]["Enums"]["cash_flow_type"]
          updated_at?: string
          voucher_no?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "petty_cash_ledger_linked_request_id_fkey"
            columns: ["linked_request_id"]
            isOneToOne: false
            referencedRelation: "petty_cash_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      petty_cash_requests: {
        Row: {
          amount: number
          approval_notes: string | null
          approved_at: string | null
          approver_id: string | null
          attachment_url: string | null
          created_at: string
          id: string
          notes: string | null
          paid_at: string | null
          payer_id: string | null
          payment_mode: string | null
          payment_notes: string | null
          payment_proof_url: string | null
          payment_reference: string | null
          purpose: string
          rejected_reason: string | null
          request_no: string
          requester_id: string
          required_date: string
          status: Database["public"]["Enums"]["petty_cash_status"]
          updated_at: string
        }
        Insert: {
          amount: number
          approval_notes?: string | null
          approved_at?: string | null
          approver_id?: string | null
          attachment_url?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          payer_id?: string | null
          payment_mode?: string | null
          payment_notes?: string | null
          payment_proof_url?: string | null
          payment_reference?: string | null
          purpose: string
          rejected_reason?: string | null
          request_no: string
          requester_id: string
          required_date: string
          status?: Database["public"]["Enums"]["petty_cash_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          approval_notes?: string | null
          approved_at?: string | null
          approver_id?: string | null
          attachment_url?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          payer_id?: string | null
          payment_mode?: string | null
          payment_notes?: string | null
          payment_proof_url?: string | null
          payment_reference?: string | null
          purpose?: string
          rejected_reason?: string | null
          request_no?: string
          requester_id?: string
          required_date?: string
          status?: Database["public"]["Enums"]["petty_cash_status"]
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          created_by: string | null
          department: string | null
          email: string | null
          full_name: string
          id: string
          is_active: boolean
          last_login_at: string | null
          phone: string | null
          site: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          department?: string | null
          email?: string | null
          full_name?: string
          id: string
          is_active?: boolean
          last_login_at?: string | null
          phone?: string | null
          site?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          department?: string | null
          email?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          last_login_at?: string | null
          phone?: string | null
          site?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_permissions: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          permission: Database["public"]["Enums"]["permission_key"]
          user_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          permission: Database["public"]["Enums"]["permission_key"]
          user_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          permission?: Database["public"]["Enums"]["permission_key"]
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
      has_any_admin_role: { Args: { _user_id: string }; Returns: boolean }
      has_permission: {
        Args: {
          _perm: Database["public"]["Enums"]["permission_key"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "super_admin" | "admin" | "accounts_admin" | "worker"
      cash_flow_type: "in" | "out"
      permission_key:
        | "raise_petty_cash_request"
        | "add_petty_cash_ledger"
        | "approve_petty_cash"
        | "process_petty_cash_payment"
        | "raise_payment_requirement"
        | "approve_payment_requirement"
        | "process_payment_requirement"
        | "manage_diesel_entries"
        | "approve_diesel_report"
        | "view_reports"
        | "export_reports"
        | "manage_users"
      petty_cash_status:
        | "submitted"
        | "approved"
        | "rejected"
        | "processing"
        | "paid"
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
      app_role: ["super_admin", "admin", "accounts_admin", "worker"],
      cash_flow_type: ["in", "out"],
      permission_key: [
        "raise_petty_cash_request",
        "add_petty_cash_ledger",
        "approve_petty_cash",
        "process_petty_cash_payment",
        "raise_payment_requirement",
        "approve_payment_requirement",
        "process_payment_requirement",
        "manage_diesel_entries",
        "approve_diesel_report",
        "view_reports",
        "export_reports",
        "manage_users",
      ],
      petty_cash_status: [
        "submitted",
        "approved",
        "rejected",
        "processing",
        "paid",
      ],
    },
  },
} as const
