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
      activity_logs: {
        Row: {
          action: string
          created_at: string
          feature: string
          id: string
          user_id: string
        }
        Insert: {
          action?: string
          created_at?: string
          feature: string
          id?: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          feature?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      contractor_accounts: {
        Row: {
          branding: Json
          company_name: string | null
          contractor_id: string | null
          created_at: string
          id: string
          logo_url: string | null
          onboarded_at: string | null
          portfolio_links: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          branding?: Json
          company_name?: string | null
          contractor_id?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          onboarded_at?: string | null
          portfolio_links?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          branding?: Json
          company_name?: string | null
          contractor_id?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          onboarded_at?: string | null
          portfolio_links?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contractor_accounts_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
        ]
      }
      contractor_license_cache: {
        Row: {
          bond_status: string | null
          business_name: string | null
          classifications: string[] | null
          created_at: string
          disciplinary_notes: string | null
          expiration_date: string | null
          has_disciplinary_action: boolean | null
          id: string
          issue_date: string | null
          last_checked_at: string
          license_number: string
          raw_response: Json | null
          scrape_succeeded: boolean
          status: string | null
          updated_at: string
          workers_comp_status: string | null
        }
        Insert: {
          bond_status?: string | null
          business_name?: string | null
          classifications?: string[] | null
          created_at?: string
          disciplinary_notes?: string | null
          expiration_date?: string | null
          has_disciplinary_action?: boolean | null
          id?: string
          issue_date?: string | null
          last_checked_at?: string
          license_number: string
          raw_response?: Json | null
          scrape_succeeded?: boolean
          status?: string | null
          updated_at?: string
          workers_comp_status?: string | null
        }
        Update: {
          bond_status?: string | null
          business_name?: string | null
          classifications?: string[] | null
          created_at?: string
          disciplinary_notes?: string | null
          expiration_date?: string | null
          has_disciplinary_action?: boolean | null
          id?: string
          issue_date?: string | null
          last_checked_at?: string
          license_number?: string
          raw_response?: Json | null
          scrape_succeeded?: boolean
          status?: string | null
          updated_at?: string
          workers_comp_status?: string | null
        }
        Relationships: []
      }
      contractor_permits: {
        Row: {
          address: string | null
          city: string | null
          completed_date: string | null
          contractor_id: string
          created_at: string
          description: string | null
          id: string
          issued_date: string | null
          lat: number | null
          lng: number | null
          permit_number: string
          raw_data: Json | null
          source: string
          status: string | null
          valuation: number | null
          work_type: string | null
          zip: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          completed_date?: string | null
          contractor_id: string
          created_at?: string
          description?: string | null
          id?: string
          issued_date?: string | null
          lat?: number | null
          lng?: number | null
          permit_number: string
          raw_data?: Json | null
          source?: string
          status?: string | null
          valuation?: number | null
          work_type?: string | null
          zip?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          completed_date?: string | null
          contractor_id?: string
          created_at?: string
          description?: string | null
          id?: string
          issued_date?: string | null
          lat?: number | null
          lng?: number | null
          permit_number?: string
          raw_data?: Json | null
          source?: string
          status?: string | null
          valuation?: number | null
          work_type?: string | null
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contractor_permits_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
        ]
      }
      contractors: {
        Row: {
          city: string | null
          company: string | null
          created_at: string
          email: string | null
          id: string
          last_permit_date: string | null
          lat: number | null
          license_number: string
          lng: number | null
          name: string
          permit_count: number
          phone: string | null
          specialty: string | null
          state: string | null
          updated_at: string
          website: string | null
          zip: string | null
        }
        Insert: {
          city?: string | null
          company?: string | null
          created_at?: string
          email?: string | null
          id?: string
          last_permit_date?: string | null
          lat?: number | null
          license_number: string
          lng?: number | null
          name: string
          permit_count?: number
          phone?: string | null
          specialty?: string | null
          state?: string | null
          updated_at?: string
          website?: string | null
          zip?: string | null
        }
        Update: {
          city?: string | null
          company?: string | null
          created_at?: string
          email?: string | null
          id?: string
          last_permit_date?: string | null
          lat?: number | null
          license_number?: string
          lng?: number | null
          name?: string
          permit_count?: number
          phone?: string | null
          specialty?: string | null
          state?: string | null
          updated_at?: string
          website?: string | null
          zip?: string | null
        }
        Relationships: []
      }
      cslb_import_runs: {
        Row: {
          errors: string | null
          finished_at: string | null
          id: string
          records_inserted: number
          records_seen: number
          records_updated: number
          source_url: string | null
          started_at: string
          status: string
          status_changes: number
        }
        Insert: {
          errors?: string | null
          finished_at?: string | null
          id?: string
          records_inserted?: number
          records_seen?: number
          records_updated?: number
          source_url?: string | null
          started_at?: string
          status?: string
          status_changes?: number
        }
        Update: {
          errors?: string | null
          finished_at?: string | null
          id?: string
          records_inserted?: number
          records_seen?: number
          records_updated?: number
          source_url?: string | null
          started_at?: string
          status?: string
          status_changes?: number
        }
        Relationships: []
      }
      cslb_licenses: {
        Row: {
          bond_amount: number | null
          bond_status: string | null
          business_name: string | null
          classifications: string[] | null
          created_at: string
          data_source: string
          disciplinary_notes: string | null
          expiration_date: string | null
          has_disciplinary_action: boolean | null
          issue_date: string | null
          last_verified_at: string | null
          license_number: string
          license_status: string | null
          licensee_name: string | null
          raw_data: Json | null
          updated_at: string
          workers_comp_status: string | null
        }
        Insert: {
          bond_amount?: number | null
          bond_status?: string | null
          business_name?: string | null
          classifications?: string[] | null
          created_at?: string
          data_source?: string
          disciplinary_notes?: string | null
          expiration_date?: string | null
          has_disciplinary_action?: boolean | null
          issue_date?: string | null
          last_verified_at?: string | null
          license_number: string
          license_status?: string | null
          licensee_name?: string | null
          raw_data?: Json | null
          updated_at?: string
          workers_comp_status?: string | null
        }
        Update: {
          bond_amount?: number | null
          bond_status?: string | null
          business_name?: string | null
          classifications?: string[] | null
          created_at?: string
          data_source?: string
          disciplinary_notes?: string | null
          expiration_date?: string | null
          has_disciplinary_action?: boolean | null
          issue_date?: string | null
          last_verified_at?: string | null
          license_number?: string
          license_status?: string | null
          licensee_name?: string | null
          raw_data?: Json | null
          updated_at?: string
          workers_comp_status?: string | null
        }
        Relationships: []
      }
      cslb_status_alerts: {
        Row: {
          acknowledged: boolean
          contractor_id: string | null
          created_at: string
          detected_via: string
          id: string
          license_number: string
          new_status: string | null
          previous_status: string | null
        }
        Insert: {
          acknowledged?: boolean
          contractor_id?: string | null
          created_at?: string
          detected_via?: string
          id?: string
          license_number: string
          new_status?: string | null
          previous_status?: string | null
        }
        Update: {
          acknowledged?: boolean
          contractor_id?: string | null
          created_at?: string
          detected_via?: string
          id?: string
          license_number?: string
          new_status?: string | null
          previous_status?: string | null
        }
        Relationships: []
      }
      outreach_batches: {
        Row: {
          brief_snapshot: Json
          created_at: string
          homeowner_email: string | null
          homeowner_name: string | null
          id: string
          neighborhood: string | null
          recipient_count: number
          session_id: string
        }
        Insert: {
          brief_snapshot: Json
          created_at?: string
          homeowner_email?: string | null
          homeowner_name?: string | null
          id?: string
          neighborhood?: string | null
          recipient_count?: number
          session_id: string
        }
        Update: {
          brief_snapshot?: Json
          created_at?: string
          homeowner_email?: string | null
          homeowner_name?: string | null
          id?: string
          neighborhood?: string | null
          recipient_count?: number
          session_id?: string
        }
        Relationships: []
      }
      outreach_sends: {
        Row: {
          batch_id: string
          contractor_email: string | null
          contractor_id: string
          contractor_name: string | null
          created_at: string
          homeowner_approved_at: string | null
          homeowner_viewed_at: string | null
          id: string
          is_simulated: boolean
          opened_at: string | null
          personal_note: string | null
          proposal_analysis_id: string | null
          proposal_pdf_url: string | null
          proposal_source: string | null
          proposal_structured: Json | null
          proposal_submitted_at: string | null
          responded_at: string | null
          sent_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          batch_id: string
          contractor_email?: string | null
          contractor_id: string
          contractor_name?: string | null
          created_at?: string
          homeowner_approved_at?: string | null
          homeowner_viewed_at?: string | null
          id?: string
          is_simulated?: boolean
          opened_at?: string | null
          personal_note?: string | null
          proposal_analysis_id?: string | null
          proposal_pdf_url?: string | null
          proposal_source?: string | null
          proposal_structured?: Json | null
          proposal_submitted_at?: string | null
          responded_at?: string | null
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          batch_id?: string
          contractor_email?: string | null
          contractor_id?: string
          contractor_name?: string | null
          created_at?: string
          homeowner_approved_at?: string | null
          homeowner_viewed_at?: string | null
          id?: string
          is_simulated?: boolean
          opened_at?: string | null
          personal_note?: string | null
          proposal_analysis_id?: string | null
          proposal_pdf_url?: string | null
          proposal_source?: string | null
          proposal_structured?: Json | null
          proposal_submitted_at?: string | null
          responded_at?: string | null
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "outreach_sends_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "outreach_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_sends_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
        ]
      }
      pilot_users: {
        Row: {
          created_at: string
          email: string
          expires_at: string | null
          id: string
          is_active: boolean
          name: string | null
          notes: string | null
          pass_type: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          name?: string | null
          notes?: string | null
          pass_type?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          name?: string | null
          notes?: string | null
          pass_type?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      proposal_analyses: {
        Row: {
          analysis_jsonb: Json | null
          brief_id: string | null
          contractor_id: string | null
          contractor_name: string | null
          created_at: string
          extracted_data: Json | null
          file_path: string | null
          id: string
          license_data: Json | null
          next_actions: Json | null
          outreach_send_id: string | null
          permit_data: Json | null
          pricing_data: Json | null
          pushback_language: Json | null
          red_flags: Json | null
          risk_breakdown: Json | null
          risk_score: number | null
          roadmap: Json | null
          session_token: string | null
          space_type: string | null
          status: string
          tier: string | null
          total_cost: number | null
          updated_at: string
          user_id: string | null
          verdict: string | null
        }
        Insert: {
          analysis_jsonb?: Json | null
          brief_id?: string | null
          contractor_id?: string | null
          contractor_name?: string | null
          created_at?: string
          extracted_data?: Json | null
          file_path?: string | null
          id?: string
          license_data?: Json | null
          next_actions?: Json | null
          outreach_send_id?: string | null
          permit_data?: Json | null
          pricing_data?: Json | null
          pushback_language?: Json | null
          red_flags?: Json | null
          risk_breakdown?: Json | null
          risk_score?: number | null
          roadmap?: Json | null
          session_token?: string | null
          space_type?: string | null
          status?: string
          tier?: string | null
          total_cost?: number | null
          updated_at?: string
          user_id?: string | null
          verdict?: string | null
        }
        Update: {
          analysis_jsonb?: Json | null
          brief_id?: string | null
          contractor_id?: string | null
          contractor_name?: string | null
          created_at?: string
          extracted_data?: Json | null
          file_path?: string | null
          id?: string
          license_data?: Json | null
          next_actions?: Json | null
          outreach_send_id?: string | null
          permit_data?: Json | null
          pricing_data?: Json | null
          pushback_language?: Json | null
          red_flags?: Json | null
          risk_breakdown?: Json | null
          risk_score?: number | null
          roadmap?: Json | null
          session_token?: string | null
          space_type?: string | null
          status?: string
          tier?: string | null
          total_cost?: number | null
          updated_at?: string
          user_id?: string | null
          verdict?: string | null
        }
        Relationships: []
      }
      space_analyses: {
        Row: {
          created_at: string
          error: string | null
          id: string
          intake: Json
          media_urls: Json
          model: string | null
          result: Json | null
          session_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          id?: string
          intake: Json
          media_urls?: Json
          model?: string | null
          result?: Json | null
          session_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          error?: string | null
          id?: string
          intake?: Json
          media_urls?: Json
          model?: string | null
          result?: Json | null
          session_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_projects: {
        Row: {
          brief: Json | null
          created_at: string
          id: string
          intake: Json
          room: string | null
          status: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          brief?: Json | null
          created_at?: string
          id?: string
          intake?: Json
          room?: string | null
          status?: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          brief?: Json | null
          created_at?: string
          id?: string
          intake?: Json
          room?: string | null
          status?: string
          title?: string | null
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
      waitlist: {
        Row: {
          created_at: string
          email: string
          id: string
          message: string | null
          name: string | null
          project_type: string | null
          status: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          message?: string | null
          name?: string | null
          project_type?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          message?: string | null
          name?: string | null
          project_type?: string | null
          status?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_user_email: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user" | "contractor"
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
      app_role: ["admin", "moderator", "user", "contractor"],
    },
  },
} as const
