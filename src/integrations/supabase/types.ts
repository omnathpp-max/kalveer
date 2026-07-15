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
          address: string | null
          company_name: string
          currency: string
          email: string | null
          gstin: string | null
          id: string
          phone: string | null
          singleton: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          address?: string | null
          company_name?: string
          currency?: string
          email?: string | null
          gstin?: string | null
          id?: string
          phone?: string | null
          singleton?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          address?: string | null
          company_name?: string
          currency?: string
          email?: string | null
          gstin?: string | null
          id?: string
          phone?: string | null
          singleton?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
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
      categories: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          kind: Database["public"]["Enums"]["category_kind"]
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          kind: Database["public"]["Enums"]["category_kind"]
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          kind?: Database["public"]["Enums"]["category_kind"]
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      diesel_daily_reports: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          closing_litres: number
          consumption_litres: number
          created_at: string
          created_by: string | null
          id: string
          opening_litres: number
          prepared_by: string | null
          received_litres: number
          rejection_reason: string | null
          remarks: string | null
          report_date: string
          shift: string
          status: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          closing_litres?: number
          consumption_litres?: number
          created_at?: string
          created_by?: string | null
          id?: string
          opening_litres?: number
          prepared_by?: string | null
          received_litres?: number
          rejection_reason?: string | null
          remarks?: string | null
          report_date: string
          shift: string
          status?: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          closing_litres?: number
          consumption_litres?: number
          created_at?: string
          created_by?: string | null
          id?: string
          opening_litres?: number
          prepared_by?: string | null
          received_litres?: number
          rejection_reason?: string | null
          remarks?: string | null
          report_date?: string
          shift?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      diesel_machine_entries: {
        Row: {
          average_lph: number | null
          category: string
          consumption_litres: number
          created_at: string
          created_by: string | null
          daily_report_id: string
          hour_close: number | null
          hour_start: number | null
          id: string
          machine_id: string | null
          machine_name: string
          nature_of_work: string | null
          operator_id: string | null
          operator_name: string | null
          remarks: string | null
          service_hours: number | null
          tank_capacity: number | null
          tank_details: string | null
          total_hours: number | null
          updated_at: string
        }
        Insert: {
          average_lph?: number | null
          category: string
          consumption_litres?: number
          created_at?: string
          created_by?: string | null
          daily_report_id: string
          hour_close?: number | null
          hour_start?: number | null
          id?: string
          machine_id?: string | null
          machine_name: string
          nature_of_work?: string | null
          operator_id?: string | null
          operator_name?: string | null
          remarks?: string | null
          service_hours?: number | null
          tank_capacity?: number | null
          tank_details?: string | null
          total_hours?: number | null
          updated_at?: string
        }
        Update: {
          average_lph?: number | null
          category?: string
          consumption_litres?: number
          created_at?: string
          created_by?: string | null
          daily_report_id?: string
          hour_close?: number | null
          hour_start?: number | null
          id?: string
          machine_id?: string | null
          machine_name?: string
          nature_of_work?: string | null
          operator_id?: string | null
          operator_name?: string | null
          remarks?: string | null
          service_hours?: number | null
          tank_capacity?: number | null
          tank_details?: string | null
          total_hours?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "diesel_machine_entries_daily_report_id_fkey"
            columns: ["daily_report_id"]
            isOneToOne: false
            referencedRelation: "diesel_daily_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diesel_machine_entries_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diesel_machine_entries_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_heads: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
          tracks_inventory: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          tracks_inventory?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          tracks_inventory?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      inventory_items: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          notes: string | null
          reorder_level: number
          unit: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          reorder_level?: number
          unit?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          reorder_level?: number
          unit?: string
          updated_at?: string
        }
        Relationships: []
      }
      inventory_movements: {
        Row: {
          created_at: string
          created_by: string
          entry_id: string | null
          id: string
          item_id: string
          movement_type: Database["public"]["Enums"]["inventory_movement_type"]
          notes: string | null
          qty: number
          request_id: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          entry_id?: string | null
          id?: string
          item_id: string
          movement_type: Database["public"]["Enums"]["inventory_movement_type"]
          notes?: string | null
          qty: number
          request_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          entry_id?: string | null
          id?: string
          item_id?: string
          movement_type?: Database["public"]["Enums"]["inventory_movement_type"]
          notes?: string | null
          qty?: number
          request_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "petty_cash_wallet_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_balances"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "inventory_movements_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "payment_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      machines: {
        Row: {
          active: boolean
          category: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          notes: string | null
          service_hours_interval: number | null
          tank_capacity: number | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          category: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          notes?: string | null
          service_hours_interval?: number | null
          tank_capacity?: number | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          notes?: string | null
          service_hours_interval?: number | null
          tank_capacity?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          actor_id: string | null
          body: string | null
          created_at: string
          entity_id: string | null
          id: string
          link: string | null
          module: string | null
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          actor_id?: string | null
          body?: string | null
          created_at?: string
          entity_id?: string | null
          id?: string
          link?: string | null
          module?: string | null
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          actor_id?: string | null
          body?: string | null
          created_at?: string
          entity_id?: string | null
          id?: string
          link?: string | null
          module?: string | null
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      operators: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      payment_requests: {
        Row: {
          amount: number
          approval_notes: string | null
          approved_amount: number | null
          approved_at: string | null
          approver_id: string | null
          attachment_url: string | null
          bank_account_no: string | null
          bank_ifsc: string | null
          bank_name: string | null
          category: Database["public"]["Enums"]["payment_request_category"]
          created_at: string
          id: string
          invoice_date: string | null
          invoice_no: string | null
          invoice_url: string | null
          notes: string | null
          paid_amount: number | null
          paid_at: string | null
          payer_id: string | null
          payment_mode: string | null
          payment_notes: string | null
          payment_proof_url: string | null
          payment_reference: string | null
          payment_type: string | null
          priority: string
          purpose: string
          rejected_reason: string | null
          request_no: string
          requester_id: string
          required_date: string
          status: Database["public"]["Enums"]["payment_request_status"]
          updated_at: string
          upi_id: string | null
          vendor_category: string | null
          vendor_name: string | null
        }
        Insert: {
          amount: number
          approval_notes?: string | null
          approved_amount?: number | null
          approved_at?: string | null
          approver_id?: string | null
          attachment_url?: string | null
          bank_account_no?: string | null
          bank_ifsc?: string | null
          bank_name?: string | null
          category: Database["public"]["Enums"]["payment_request_category"]
          created_at?: string
          id?: string
          invoice_date?: string | null
          invoice_no?: string | null
          invoice_url?: string | null
          notes?: string | null
          paid_amount?: number | null
          paid_at?: string | null
          payer_id?: string | null
          payment_mode?: string | null
          payment_notes?: string | null
          payment_proof_url?: string | null
          payment_reference?: string | null
          payment_type?: string | null
          priority?: string
          purpose: string
          rejected_reason?: string | null
          request_no: string
          requester_id: string
          required_date: string
          status?: Database["public"]["Enums"]["payment_request_status"]
          updated_at?: string
          upi_id?: string | null
          vendor_category?: string | null
          vendor_name?: string | null
        }
        Update: {
          amount?: number
          approval_notes?: string | null
          approved_amount?: number | null
          approved_at?: string | null
          approver_id?: string | null
          attachment_url?: string | null
          bank_account_no?: string | null
          bank_ifsc?: string | null
          bank_name?: string | null
          category?: Database["public"]["Enums"]["payment_request_category"]
          created_at?: string
          id?: string
          invoice_date?: string | null
          invoice_no?: string | null
          invoice_url?: string | null
          notes?: string | null
          paid_amount?: number | null
          paid_at?: string | null
          payer_id?: string | null
          payment_mode?: string | null
          payment_notes?: string | null
          payment_proof_url?: string | null
          payment_reference?: string | null
          payment_type?: string | null
          priority?: string
          purpose?: string
          rejected_reason?: string | null
          request_no?: string
          requester_id?: string
          required_date?: string
          status?: Database["public"]["Enums"]["payment_request_status"]
          updated_at?: string
          upi_id?: string | null
          vendor_category?: string | null
          vendor_name?: string | null
        }
        Relationships: []
      }
      petty_cash_wallet_entries: {
        Row: {
          amount: number
          attachment_url: string | null
          created_at: string
          created_by: string
          direction: string
          entry_date: string
          entry_type: Database["public"]["Enums"]["wallet_entry_type"]
          expense_head_id: string | null
          id: string
          inventory_item_id: string | null
          is_voided: boolean
          qty: number | null
          remarks: string | null
          request_id: string | null
          updated_at: string
          user_id: string
          vendor_or_person: string | null
        }
        Insert: {
          amount: number
          attachment_url?: string | null
          created_at?: string
          created_by: string
          direction: string
          entry_date?: string
          entry_type: Database["public"]["Enums"]["wallet_entry_type"]
          expense_head_id?: string | null
          id?: string
          inventory_item_id?: string | null
          is_voided?: boolean
          qty?: number | null
          remarks?: string | null
          request_id?: string | null
          updated_at?: string
          user_id: string
          vendor_or_person?: string | null
        }
        Update: {
          amount?: number
          attachment_url?: string | null
          created_at?: string
          created_by?: string
          direction?: string
          entry_date?: string
          entry_type?: Database["public"]["Enums"]["wallet_entry_type"]
          expense_head_id?: string | null
          id?: string
          inventory_item_id?: string | null
          is_voided?: boolean
          qty?: number | null
          remarks?: string | null
          request_id?: string | null
          updated_at?: string
          user_id?: string
          vendor_or_person?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "petty_cash_wallet_entries_expense_head_id_fkey"
            columns: ["expense_head_id"]
            isOneToOne: false
            referencedRelation: "expense_heads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "petty_cash_wallet_entries_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_balances"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "petty_cash_wallet_entries_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "petty_cash_wallet_entries_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "payment_requests"
            referencedColumns: ["id"]
          },
        ]
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
      inventory_balances: {
        Row: {
          balance: number | null
          is_active: boolean | null
          item_id: string | null
          name: string | null
          reorder_level: number | null
          unit: string | null
        }
        Relationships: []
      }
      petty_cash_wallet_balances: {
        Row: {
          balance: number | null
          email: string | null
          full_name: string | null
          last_activity: string | null
          user_id: string | null
        }
        Relationships: []
      }
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
      notify_role: {
        Args: {
          _body: string
          _entity_id: string
          _link: string
          _module: string
          _role: Database["public"]["Enums"]["app_role"]
          _title: string
          _type: string
        }
        Returns: number
      }
    }
    Enums: {
      app_role: "super_admin" | "admin" | "accounts_admin" | "worker"
      cash_flow_type: "in" | "out"
      category_kind: "petty_cash" | "payment"
      inventory_movement_type: "purchase" | "consumption" | "adjustment"
      payment_request_category:
        | "petty_cash"
        | "vendor_payment"
        | "diesel"
        | "other"
      payment_request_status:
        | "submitted"
        | "approved"
        | "rejected"
        | "processing"
        | "paid"
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
        | "raise_request"
        | "approve_request"
        | "process_payment"
        | "manage_petty_cash_wallets"
      wallet_entry_type: "auto_top_up" | "manual_top_up" | "expense"
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
      category_kind: ["petty_cash", "payment"],
      inventory_movement_type: ["purchase", "consumption", "adjustment"],
      payment_request_category: [
        "petty_cash",
        "vendor_payment",
        "diesel",
        "other",
      ],
      payment_request_status: [
        "submitted",
        "approved",
        "rejected",
        "processing",
        "paid",
      ],
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
        "raise_request",
        "approve_request",
        "process_payment",
        "manage_petty_cash_wallets",
      ],
      wallet_entry_type: ["auto_top_up", "manual_top_up", "expense"],
    },
  },
} as const
