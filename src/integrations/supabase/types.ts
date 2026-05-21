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
      address_code_violations: {
        Row: {
          address: string
          created_at: string
          id: string
          last_checked_at: string
          most_recent_open_date: string | null
          open_case_count: number
          raw_cases: Json | null
          violation_types: string[] | null
        }
        Insert: {
          address: string
          created_at?: string
          id?: string
          last_checked_at?: string
          most_recent_open_date?: string | null
          open_case_count?: number
          raw_cases?: Json | null
          violation_types?: string[] | null
        }
        Update: {
          address?: string
          created_at?: string
          id?: string
          last_checked_at?: string
          most_recent_open_date?: string | null
          open_case_count?: number
          raw_cases?: Json | null
          violation_types?: string[] | null
        }
        Relationships: []
      }
      brief_annotations: {
        Row: {
          content: string
          contractor_id: string
          created_at: string
          id: string
          outreach_send_id: string
          section_key: string
          updated_at: string
        }
        Insert: {
          content: string
          contractor_id: string
          created_at?: string
          id?: string
          outreach_send_id: string
          section_key: string
          updated_at?: string
        }
        Update: {
          content?: string
          contractor_id?: string
          created_at?: string
          id?: string
          outreach_send_id?: string
          section_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      brief_clarifications: {
        Row: {
          contractor_id: string
          created_at: string
          homeowner_user_id: string
          id: string
          message: string
          outreach_send_id: string
          sender_role: string
        }
        Insert: {
          contractor_id: string
          created_at?: string
          homeowner_user_id: string
          id?: string
          message: string
          outreach_send_id: string
          sender_role: string
        }
        Update: {
          contractor_id?: string
          created_at?: string
          homeowner_user_id?: string
          id?: string
          message?: string
          outreach_send_id?: string
          sender_role?: string
        }
        Relationships: []
      }
      contractor_accounts: {
        Row: {
          bio: string | null
          branding: Json
          company_name: string | null
          contractor_id: string | null
          created_at: string
          facebook: string | null
          gallery_urls: Json
          houzz: string | null
          id: string
          instagram: string | null
          logo_url: string | null
          onboarded_at: string | null
          phone: string | null
          portfolio_links: Json
          promo_text: string | null
          public_email: string | null
          service_areas: string | null
          specialties: string | null
          tagline: string | null
          tiktok: string | null
          updated_at: string
          user_id: string
          website: string | null
          years_in_business: number | null
          yelp: string | null
        }
        Insert: {
          bio?: string | null
          branding?: Json
          company_name?: string | null
          contractor_id?: string | null
          created_at?: string
          facebook?: string | null
          gallery_urls?: Json
          houzz?: string | null
          id?: string
          instagram?: string | null
          logo_url?: string | null
          onboarded_at?: string | null
          phone?: string | null
          portfolio_links?: Json
          promo_text?: string | null
          public_email?: string | null
          service_areas?: string | null
          specialties?: string | null
          tagline?: string | null
          tiktok?: string | null
          updated_at?: string
          user_id: string
          website?: string | null
          years_in_business?: number | null
          yelp?: string | null
        }
        Update: {
          bio?: string | null
          branding?: Json
          company_name?: string | null
          contractor_id?: string | null
          created_at?: string
          facebook?: string | null
          gallery_urls?: Json
          houzz?: string | null
          id?: string
          instagram?: string | null
          logo_url?: string | null
          onboarded_at?: string | null
          phone?: string | null
          portfolio_links?: Json
          promo_text?: string | null
          public_email?: string | null
          service_areas?: string | null
          specialties?: string | null
          tagline?: string | null
          tiktok?: string | null
          updated_at?: string
          user_id?: string
          website?: string | null
          years_in_business?: number | null
          yelp?: string | null
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
      contractor_notifications: {
        Row: {
          body: string
          contractor_id: string
          created_at: string
          id: string
          outreach_send_id: string | null
          read: boolean
          read_at: string | null
          title: string
          type: string
        }
        Insert: {
          body: string
          contractor_id: string
          created_at?: string
          id?: string
          outreach_send_id?: string | null
          read?: boolean
          read_at?: string | null
          title: string
          type?: string
        }
        Update: {
          body?: string
          contractor_id?: string
          created_at?: string
          id?: string
          outreach_send_id?: string | null
          read?: boolean
          read_at?: string | null
          title?: string
          type?: string
        }
        Relationships: []
      }
      contractor_payments: {
        Row: {
          amount: number
          contractor_id: string
          created_at: string
          currency: string
          error_message: string | null
          id: string
          outreach_send_id: string
          paid_at: string | null
          status: string
          stripe_payment_intent_id: string | null
          stripe_status: string | null
        }
        Insert: {
          amount: number
          contractor_id: string
          created_at?: string
          currency?: string
          error_message?: string | null
          id?: string
          outreach_send_id: string
          paid_at?: string | null
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_status?: string | null
        }
        Update: {
          amount?: number
          contractor_id?: string
          created_at?: string
          currency?: string
          error_message?: string | null
          id?: string
          outreach_send_id?: string
          paid_at?: string | null
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_status?: string | null
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
      contractor_push_subscriptions: {
        Row: {
          active: boolean
          auth: string
          contractor_id: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_agent: string | null
        }
        Insert: {
          active?: boolean
          auth: string
          contractor_id: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_agent?: string | null
        }
        Update: {
          active?: boolean
          auth?: string
          contractor_id?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      contractor_trust_signals: {
        Row: {
          addresses_checked: number
          addresses_with_violations: number
          contractor_id: string
          created_at: string
          expired_without_final: number
          id: string
          last_calculated_at: string
          open_code_violations: number
          permits_old_enough: number
          updated_at: string
        }
        Insert: {
          addresses_checked?: number
          addresses_with_violations?: number
          contractor_id: string
          created_at?: string
          expired_without_final?: number
          id?: string
          last_calculated_at?: string
          open_code_violations?: number
          permits_old_enough?: number
          updated_at?: string
        }
        Update: {
          addresses_checked?: number
          addresses_with_violations?: number
          contractor_id?: string
          created_at?: string
          expired_without_final?: number
          id?: string
          last_calculated_at?: string
          open_code_violations?: number
          permits_old_enough?: number
          updated_at?: string
        }
        Relationships: []
      }
      contractors: {
        Row: {
          city: string | null
          claim_completed_at: string | null
          claim_started_at: string | null
          claimed: boolean
          claimed_at: string | null
          company: string | null
          created_at: string
          email: string | null
          first_brief_received_at: string | null
          first_brief_unlocked_at: string | null
          id: string
          invitation_source: string | null
          invited_at: string | null
          last_permit_date: string | null
          lat: number | null
          license_number: string
          lng: number | null
          name: string
          notification_email: string | null
          notification_phone: string | null
          notification_preference: string | null
          permit_count: number
          phone: string | null
          profile_viewed_at: string | null
          push_permission_deferred: boolean
          slug: string
          specialty: string | null
          state: string | null
          updated_at: string
          website: string | null
          zip: string | null
        }
        Insert: {
          city?: string | null
          claim_completed_at?: string | null
          claim_started_at?: string | null
          claimed?: boolean
          claimed_at?: string | null
          company?: string | null
          created_at?: string
          email?: string | null
          first_brief_received_at?: string | null
          first_brief_unlocked_at?: string | null
          id?: string
          invitation_source?: string | null
          invited_at?: string | null
          last_permit_date?: string | null
          lat?: number | null
          license_number: string
          lng?: number | null
          name: string
          notification_email?: string | null
          notification_phone?: string | null
          notification_preference?: string | null
          permit_count?: number
          phone?: string | null
          profile_viewed_at?: string | null
          push_permission_deferred?: boolean
          slug: string
          specialty?: string | null
          state?: string | null
          updated_at?: string
          website?: string | null
          zip?: string | null
        }
        Update: {
          city?: string | null
          claim_completed_at?: string | null
          claim_started_at?: string | null
          claimed?: boolean
          claimed_at?: string | null
          company?: string | null
          created_at?: string
          email?: string | null
          first_brief_received_at?: string | null
          first_brief_unlocked_at?: string | null
          id?: string
          invitation_source?: string | null
          invited_at?: string | null
          last_permit_date?: string | null
          lat?: number | null
          license_number?: string
          lng?: number | null
          name?: string
          notification_email?: string | null
          notification_phone?: string | null
          notification_preference?: string | null
          permit_count?: number
          phone?: string | null
          profile_viewed_at?: string | null
          push_permission_deferred?: boolean
          slug?: string
          specialty?: string | null
          state?: string | null
          updated_at?: string
          website?: string | null
          zip?: string | null
        }
        Relationships: []
      }
      cost_guide_cache: {
        Row: {
          average: number
          created_at: string
          fetched_at: string
          high: number
          id: string
          low: number
          scope: string
          source_count: number
          sources: Json
          space_type: string
          zip_code: string
        }
        Insert: {
          average: number
          created_at?: string
          fetched_at?: string
          high: number
          id?: string
          low: number
          scope: string
          source_count?: number
          sources?: Json
          space_type: string
          zip_code: string
        }
        Update: {
          average?: number
          created_at?: string
          fetched_at?: string
          high?: number
          id?: string
          low?: number
          scope?: string
          source_count?: number
          sources?: Json
          space_type?: string
          zip_code?: string
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
      homeowner_notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          outreach_send_id: string | null
          read: boolean
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          outreach_send_id?: string | null
          read?: boolean
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          outreach_send_id?: string | null
          read?: boolean
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      outreach_batches: {
        Row: {
          brief_snapshot: Json
          created_at: string
          homeowner_email: string | null
          homeowner_name: string | null
          homeowner_user_id: string | null
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
          homeowner_user_id?: string | null
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
          homeowner_user_id?: string | null
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
          passed_at: string | null
          personal_note: string | null
          proposal_analysis_id: string | null
          proposal_pdf_url: string | null
          proposal_source: string | null
          proposal_structured: Json | null
          proposal_submitted_at: string | null
          responded_at: string | null
          sent_at: string | null
          status: string
          unlocked_at: string | null
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
          passed_at?: string | null
          personal_note?: string | null
          proposal_analysis_id?: string | null
          proposal_pdf_url?: string | null
          proposal_source?: string | null
          proposal_structured?: Json | null
          proposal_submitted_at?: string | null
          responded_at?: string | null
          sent_at?: string | null
          status?: string
          unlocked_at?: string | null
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
          passed_at?: string | null
          personal_note?: string | null
          proposal_analysis_id?: string | null
          proposal_pdf_url?: string | null
          proposal_source?: string | null
          proposal_structured?: Json | null
          proposal_submitted_at?: string | null
          responded_at?: string | null
          sent_at?: string | null
          status?: string
          unlocked_at?: string | null
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
          comparison_group_id: string | null
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
          comparison_group_id?: string | null
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
          comparison_group_id?: string | null
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
      proposal_benchmarks: {
        Row: {
          contractor_name_hash: string | null
          created_at: string
          id: string
          line_items: Json
          scope: string
          space_type: string
          square_footage: number | null
          total_cost: number
          zip_code: string | null
        }
        Insert: {
          contractor_name_hash?: string | null
          created_at?: string
          id?: string
          line_items?: Json
          scope: string
          space_type: string
          square_footage?: number | null
          total_cost: number
          zip_code?: string | null
        }
        Update: {
          contractor_name_hash?: string | null
          created_at?: string
          id?: string
          line_items?: Json
          scope?: string
          space_type?: string
          square_footage?: number | null
          total_cost?: number
          zip_code?: string | null
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
      contractor_profiles_public: {
        Row: {
          bio: string | null
          company_name: string | null
          contractor_id: string | null
          facebook: string | null
          gallery_urls: Json | null
          houzz: string | null
          instagram: string | null
          logo_url: string | null
          promo_text: string | null
          public_email: string | null
          service_areas: string | null
          specialties: string | null
          tagline: string | null
          tiktok: string | null
          updated_at: string | null
          website: string | null
          years_in_business: number | null
          yelp: string | null
        }
        Insert: {
          bio?: string | null
          company_name?: string | null
          contractor_id?: string | null
          facebook?: string | null
          gallery_urls?: Json | null
          houzz?: string | null
          instagram?: string | null
          logo_url?: string | null
          promo_text?: string | null
          public_email?: string | null
          service_areas?: string | null
          specialties?: string | null
          tagline?: string | null
          tiktok?: string | null
          updated_at?: string | null
          website?: string | null
          years_in_business?: number | null
          yelp?: string | null
        }
        Update: {
          bio?: string | null
          company_name?: string | null
          contractor_id?: string | null
          facebook?: string | null
          gallery_urls?: Json | null
          houzz?: string | null
          instagram?: string | null
          logo_url?: string | null
          promo_text?: string | null
          public_email?: string | null
          service_areas?: string | null
          specialties?: string | null
          tagline?: string | null
          tiktok?: string | null
          updated_at?: string | null
          website?: string | null
          years_in_business?: number | null
          yelp?: string | null
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
    }
    Functions: {
      current_user_email: { Args: never; Returns: string }
      generate_contractor_slug: {
        Args: { _license: string; _name: string }
        Returns: string
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
