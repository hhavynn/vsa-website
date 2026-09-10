// GENERATED FILE — do not hand-edit the `Database` type below.
//
// Regenerate with:
//   supabase gen types typescript --project-id sxephkrekdztmkptyzca --schema public
//
// The hand-maintained domain aliases at the bottom are NOT generated. They are
// imported across the app (constants/dataRightsRequests, admin panels, repos)
// and must be preserved across regenerations.

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
      academic_terms: {
        Row: {
          academic_year_end: number
          academic_year_start: number
          code: string
          created_at: string
          display_order: number
          ends_on: string | null
          id: string
          is_active: boolean
          label: string
          quarter: string
          starts_on: string | null
          updated_at: string
        }
        Insert: {
          academic_year_end: number
          academic_year_start: number
          code: string
          created_at?: string
          display_order?: number
          ends_on?: string | null
          id?: string
          is_active?: boolean
          label: string
          quarter: string
          starts_on?: string | null
          updated_at?: string
        }
        Update: {
          academic_year_end?: number
          academic_year_start?: number
          code?: string
          created_at?: string
          display_order?: number
          ends_on?: string | null
          id?: string
          is_active?: boolean
          label?: string
          quarter?: string
          starts_on?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      ace_families: {
        Row: {
          academic_year_end: number | null
          academic_year_start: number | null
          cover_image_url: string | null
          created_at: string
          description: string | null
          display_order: number
          id: string
          is_published: boolean
          name: string
          slug: string
          theme_color: string | null
          updated_at: string
        }
        Insert: {
          academic_year_end?: number | null
          academic_year_start?: number | null
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_published?: boolean
          name: string
          slug: string
          theme_color?: string | null
          updated_at?: string
        }
        Update: {
          academic_year_end?: number | null
          academic_year_start?: number | null
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_published?: boolean
          name?: string
          slug?: string
          theme_color?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      ace_family_members: {
        Row: {
          created_at: string
          display_order: number
          family_id: string
          id: string
          is_published: boolean
          name: string
          parent_member_id: string | null
          photo_url: string | null
          role_label: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          family_id: string
          id?: string
          is_published?: boolean
          name: string
          parent_member_id?: string | null
          photo_url?: string | null
          role_label?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          family_id?: string
          id?: string
          is_published?: boolean
          name?: string
          parent_member_id?: string | null
          photo_url?: string | null
          role_label?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ace_family_members_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "ace_families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ace_family_members_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "published_ace_families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ace_family_members_parent_member_id_fkey"
            columns: ["parent_member_id"]
            isOneToOne: false
            referencedRelation: "ace_family_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ace_family_members_parent_member_id_fkey"
            columns: ["parent_member_id"]
            isOneToOne: false
            referencedRelation: "published_ace_family_members"
            referencedColumns: ["id"]
          },
        ]
      }
      achievements: {
        Row: {
          achievement_id: string
          id: string
          unlocked_at: string | null
          user_id: string | null
        }
        Insert: {
          achievement_id: string
          id?: string
          unlocked_at?: string | null
          user_id?: string | null
        }
        Update: {
          achievement_id?: string
          id?: string
          unlocked_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      ai_chat_usage_logs: {
        Row: {
          blocked_reason: string | null
          created_at: string
          id: string
          ip_hash: string | null
          matched_knowledge_ids: string[]
          message_count: number
          metadata: Json
          session_id_hash: string
        }
        Insert: {
          blocked_reason?: string | null
          created_at?: string
          id?: string
          ip_hash?: string | null
          matched_knowledge_ids?: string[]
          message_count?: number
          metadata?: Json
          session_id_hash: string
        }
        Update: {
          blocked_reason?: string | null
          created_at?: string
          id?: string
          ip_hash?: string | null
          matched_knowledge_ids?: string[]
          message_count?: number
          metadata?: Json
          session_id_hash?: string
        }
        Relationships: []
      }
      ai_feedback: {
        Row: {
          admin_notes: string | null
          answer_excerpt: string | null
          category: string | null
          created_at: string
          feedback_text: string | null
          id: string
          page_path: string | null
          rating: string
          resolved_at: string | null
        }
        Insert: {
          admin_notes?: string | null
          answer_excerpt?: string | null
          category?: string | null
          created_at?: string
          feedback_text?: string | null
          id?: string
          page_path?: string | null
          rating: string
          resolved_at?: string | null
        }
        Update: {
          admin_notes?: string | null
          answer_excerpt?: string | null
          category?: string | null
          created_at?: string
          feedback_text?: string | null
          id?: string
          page_path?: string | null
          rating?: string
          resolved_at?: string | null
        }
        Relationships: []
      }
      ai_knowledge_base: {
        Row: {
          category: string
          content: string
          created_at: string
          id: string
          is_active: boolean
          is_public: boolean
          last_verified_at: string | null
          priority: number
          search_vector: unknown
          source_type: string
          source_url: string | null
          tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          category: string
          content: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_public?: boolean
          last_verified_at?: string | null
          priority?: number
          search_vector?: unknown
          source_type: string
          source_url?: string | null
          tags?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_public?: boolean
          last_verified_at?: string | null
          priority?: number
          search_vector?: unknown
          source_type?: string
          source_url?: string | null
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      application_links: {
        Row: {
          after_close_message: string | null
          application_key: string
          before_open_message: string | null
          button_label: string
          created_at: string
          created_by: string | null
          description: string | null
          due_at: string
          id: string
          is_enabled: boolean
          open_at: string
          sort_order: number
          target_url: string
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          after_close_message?: string | null
          application_key: string
          before_open_message?: string | null
          button_label: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_at: string
          id?: string
          is_enabled?: boolean
          open_at: string
          sort_order?: number
          target_url: string
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          after_close_message?: string | null
          application_key?: string
          before_open_message?: string | null
          button_label?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_at?: string
          id?: string
          is_enabled?: boolean
          open_at?: string
          sort_order?: number
          target_url?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      cabinet_members: {
        Row: {
          cabinet_year_id: string | null
          category: string
          college: string | null
          created_at: string
          display_order: number
          favorite_snack: string | null
          fun_fact: string | null
          id: string
          image_url: string | null
          major: string | null
          minor: string | null
          name: string
          pronouns: string | null
          role: string
          thumbnail_url: string | null
          updated_at: string
          year: string | null
        }
        Insert: {
          cabinet_year_id?: string | null
          category: string
          college?: string | null
          created_at?: string
          display_order?: number
          favorite_snack?: string | null
          fun_fact?: string | null
          id?: string
          image_url?: string | null
          major?: string | null
          minor?: string | null
          name: string
          pronouns?: string | null
          role: string
          thumbnail_url?: string | null
          updated_at?: string
          year?: string | null
        }
        Update: {
          cabinet_year_id?: string | null
          category?: string
          college?: string | null
          created_at?: string
          display_order?: number
          favorite_snack?: string | null
          fun_fact?: string | null
          id?: string
          image_url?: string | null
          major?: string | null
          minor?: string | null
          name?: string
          pronouns?: string | null
          role?: string
          thumbnail_url?: string | null
          updated_at?: string
          year?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cabinet_members_cabinet_year_id_fkey"
            columns: ["cabinet_year_id"]
            isOneToOne: false
            referencedRelation: "cabinet_years"
            referencedColumns: ["id"]
          },
        ]
      }
      cabinet_years: {
        Row: {
          created_at: string
          display_order: number
          end_year: number
          id: string
          is_active: boolean
          label: string
          slug: string
          start_year: number
          theme_name: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          end_year: number
          id?: string
          is_active?: boolean
          label: string
          slug: string
          start_year: number
          theme_name?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          end_year?: number
          id?: string
          is_active?: boolean
          label?: string
          slug?: string
          start_year?: number
          theme_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      check_in_code_usage: {
        Row: {
          code_id: string
          id: string
          used_at: string | null
          used_by: string
        }
        Insert: {
          code_id: string
          id?: string
          used_at?: string | null
          used_by: string
        }
        Update: {
          code_id?: string
          id?: string
          used_at?: string | null
          used_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "check_in_code_usage_code_id_fkey"
            columns: ["code_id"]
            isOneToOne: false
            referencedRelation: "check_in_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      check_in_codes: {
        Row: {
          code: string
          created_at: string | null
          created_by: string
          event_type: string
          expires_at: string
          id: string
          points: number
        }
        Insert: {
          code: string
          created_at?: string | null
          created_by: string
          event_type: string
          expires_at: string
          id?: string
          points: number
        }
        Update: {
          code?: string
          created_at?: string | null
          created_by?: string
          event_type?: string
          expires_at?: string
          id?: string
          points?: number
        }
        Relationships: []
      }
      check_ins: {
        Row: {
          checked_in_at: string | null
          event_id: string | null
          id: number
          user_id: string | null
        }
        Insert: {
          checked_in_at?: string | null
          event_id?: string | null
          id?: never
          user_id?: string | null
        }
        Update: {
          checked_in_at?: string | null
          event_id?: string | null
          id?: never
          user_id?: string | null
        }
        Relationships: []
      }
      data_rights_request_events: {
        Row: {
          created_at: string
          created_by: string | null
          event_summary: string
          event_type: string
          id: string
          request_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          event_summary: string
          event_type: string
          id?: string
          request_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          event_summary?: string
          event_type?: string
          id?: string
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_rights_request_events_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "data_rights_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      data_rights_requests: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          contact_channel: string | null
          contact_reference: string | null
          created_at: string
          created_by: string | null
          decision: string | null
          id: string
          internal_notes: string | null
          priority: string
          request_type: string
          reviewer_id: string | null
          status: string
          subject_auth_user_id: string | null
          subject_display_name: string | null
          subject_member_id: string | null
          summary: string | null
          updated_at: string
          updated_by: string | null
          verification_method: string | null
          verification_status: string
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          contact_channel?: string | null
          contact_reference?: string | null
          created_at?: string
          created_by?: string | null
          decision?: string | null
          id?: string
          internal_notes?: string | null
          priority?: string
          request_type: string
          reviewer_id?: string | null
          status?: string
          subject_auth_user_id?: string | null
          subject_display_name?: string | null
          subject_member_id?: string | null
          summary?: string | null
          updated_at?: string
          updated_by?: string | null
          verification_method?: string | null
          verification_status?: string
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          contact_channel?: string | null
          contact_reference?: string | null
          created_at?: string
          created_by?: string | null
          decision?: string | null
          id?: string
          internal_notes?: string | null
          priority?: string
          request_type?: string
          reviewer_id?: string | null
          status?: string
          subject_auth_user_id?: string | null
          subject_display_name?: string | null
          subject_member_id?: string | null
          summary?: string | null
          updated_at?: string
          updated_by?: string | null
          verification_method?: string | null
          verification_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_rights_requests_subject_member_id_fkey"
            columns: ["subject_member_id"]
            isOneToOne: false
            referencedRelation: "house_member_all_time_points"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "data_rights_requests_subject_member_id_fkey"
            columns: ["subject_member_id"]
            isOneToOne: false
            referencedRelation: "house_member_yearly_points"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "data_rights_requests_subject_member_id_fkey"
            columns: ["subject_member_id"]
            isOneToOne: false
            referencedRelation: "member_yearly_points"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "data_rights_requests_subject_member_id_fkey"
            columns: ["subject_member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      event_attendance: {
        Row: {
          check_in_type: string | null
          checked_in_at: string | null
          checked_in_by: string | null
          created_at: string | null
          event_id: string | null
          id: string
          points_earned: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          check_in_type?: string | null
          checked_in_at?: string | null
          checked_in_by?: string | null
          created_at?: string | null
          event_id?: string | null
          id?: string
          points_earned?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          check_in_type?: string | null
          checked_in_at?: string | null
          checked_in_by?: string | null
          created_at?: string | null
          event_id?: string | null
          id?: string
          points_earned?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_attendance_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_attendance_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "house_recent_activity"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "event_attendance_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "member_event_history"
            referencedColumns: ["event_id"]
          },
        ]
      }
      event_check_in_secrets: {
        Row: {
          check_in_code: string
          created_at: string
          event_id: string
        }
        Insert: {
          check_in_code: string
          created_at?: string
          event_id: string
        }
        Update: {
          check_in_code?: string
          created_at?: string
          event_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_check_in_secrets_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_check_in_secrets_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "house_recent_activity"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "event_check_in_secrets_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "member_event_history"
            referencedColumns: ["event_id"]
          },
        ]
      }
      event_interest_counts: {
        Row: {
          event_id: string
          going_count: number
          interested_count: number
          updated_at: string
        }
        Insert: {
          event_id: string
          going_count?: number
          interested_count?: number
          updated_at?: string
        }
        Update: {
          event_id?: string
          going_count?: number
          interested_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_interest_counts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_interest_counts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "house_recent_activity"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "event_interest_counts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "member_event_history"
            referencedColumns: ["event_id"]
          },
        ]
      }
      event_recaps: {
        Row: {
          aftersocial_notes: string | null
          attendance_notes: string | null
          budget_notes: string | null
          cabinet_roles: string | null
          created_at: string
          created_by: string | null
          drive_folder_url: string | null
          event_id: string
          gallery_event_id: string | null
          id: string
          is_public_highlight_published: boolean
          next_time_improvements: string | null
          owner_names: string | null
          planning_doc_url: string | null
          public_highlight: string | null
          risks_issues: string | null
          updated_at: string
          updated_by: string | null
          what_failed: string | null
          what_worked: string | null
        }
        Insert: {
          aftersocial_notes?: string | null
          attendance_notes?: string | null
          budget_notes?: string | null
          cabinet_roles?: string | null
          created_at?: string
          created_by?: string | null
          drive_folder_url?: string | null
          event_id: string
          gallery_event_id?: string | null
          id?: string
          is_public_highlight_published?: boolean
          next_time_improvements?: string | null
          owner_names?: string | null
          planning_doc_url?: string | null
          public_highlight?: string | null
          risks_issues?: string | null
          updated_at?: string
          updated_by?: string | null
          what_failed?: string | null
          what_worked?: string | null
        }
        Update: {
          aftersocial_notes?: string | null
          attendance_notes?: string | null
          budget_notes?: string | null
          cabinet_roles?: string | null
          created_at?: string
          created_by?: string | null
          drive_folder_url?: string | null
          event_id?: string
          gallery_event_id?: string | null
          id?: string
          is_public_highlight_published?: boolean
          next_time_improvements?: string | null
          owner_names?: string | null
          planning_doc_url?: string | null
          public_highlight?: string | null
          risks_issues?: string | null
          updated_at?: string
          updated_by?: string | null
          what_failed?: string | null
          what_worked?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_recaps_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_recaps_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "house_recent_activity"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "event_recaps_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "member_event_history"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "event_recaps_gallery_event_id_fkey"
            columns: ["gallery_event_id"]
            isOneToOne: false
            referencedRelation: "gallery_events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          academic_term_id: string | null
          check_in_form_url: string | null
          created_at: string | null
          date: string
          description: string | null
          end_date: string | null
          end_time: string | null
          event_type: string | null
          id: string
          image_url: string | null
          is_code_expired: boolean | null
          is_published: boolean
          location: string | null
          name: string
          points: number | null
          start_time: string | null
          thumbnail_url: string | null
          updated_at: string | null
        }
        Insert: {
          academic_term_id?: string | null
          check_in_form_url?: string | null
          created_at?: string | null
          date: string
          description?: string | null
          end_date?: string | null
          end_time?: string | null
          event_type?: string | null
          id?: string
          image_url?: string | null
          is_code_expired?: boolean | null
          is_published?: boolean
          location?: string | null
          name: string
          points?: number | null
          start_time?: string | null
          thumbnail_url?: string | null
          updated_at?: string | null
        }
        Update: {
          academic_term_id?: string | null
          check_in_form_url?: string | null
          created_at?: string | null
          date?: string
          description?: string | null
          end_date?: string | null
          end_time?: string | null
          event_type?: string | null
          id?: string
          image_url?: string | null
          is_code_expired?: boolean | null
          is_published?: boolean
          location?: string | null
          name?: string
          points?: number | null
          start_time?: string | null
          thumbnail_url?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_academic_term_id_fkey"
            columns: ["academic_term_id"]
            isOneToOne: false
            referencedRelation: "academic_terms"
            referencedColumns: ["id"]
          },
        ]
      }
      external_events: {
        Row: {
          academic_term_id: string | null
          confidence_level: string | null
          created_at: string | null
          date: string | null
          description: string | null
          event_type: string | null
          host_info_url: string | null
          id: string
          instagram_url: string | null
          is_featured: boolean | null
          location: string | null
          photo_album_url: string | null
          points: number | null
          recap: string | null
          ride_form_url: string | null
          ride_info: string | null
          rsvp_url: string | null
          source_notes: string | null
          status: string | null
          title: string
          updated_at: string | null
          uvsa_school_id: string | null
        }
        Insert: {
          academic_term_id?: string | null
          confidence_level?: string | null
          created_at?: string | null
          date?: string | null
          description?: string | null
          event_type?: string | null
          host_info_url?: string | null
          id?: string
          instagram_url?: string | null
          is_featured?: boolean | null
          location?: string | null
          photo_album_url?: string | null
          points?: number | null
          recap?: string | null
          ride_form_url?: string | null
          ride_info?: string | null
          rsvp_url?: string | null
          source_notes?: string | null
          status?: string | null
          title: string
          updated_at?: string | null
          uvsa_school_id?: string | null
        }
        Update: {
          academic_term_id?: string | null
          confidence_level?: string | null
          created_at?: string | null
          date?: string | null
          description?: string | null
          event_type?: string | null
          host_info_url?: string | null
          id?: string
          instagram_url?: string | null
          is_featured?: boolean | null
          location?: string | null
          photo_album_url?: string | null
          points?: number | null
          recap?: string | null
          ride_form_url?: string | null
          ride_info?: string | null
          rsvp_url?: string | null
          source_notes?: string | null
          status?: string | null
          title?: string
          updated_at?: string | null
          uvsa_school_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "external_events_academic_term_id_fkey"
            columns: ["academic_term_id"]
            isOneToOne: false
            referencedRelation: "academic_terms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_events_uvsa_school_id_fkey"
            columns: ["uvsa_school_id"]
            isOneToOne: false
            referencedRelation: "uvsa_schools"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback: {
        Row: {
          created_at: string | null
          description: string
          email: string | null
          id: string
          name: string | null
          status: string
          title: string
          type: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          description: string
          email?: string | null
          id?: string
          name?: string | null
          status?: string
          title: string
          type: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string
          email?: string | null
          id?: string
          name?: string | null
          status?: string
          title?: string
          type?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      gallery_events: {
        Row: {
          cover_image_url: string | null
          cover_thumbnail_url: string | null
          created_at: string
          date: string
          description: string | null
          event_id: string | null
          google_photos_url: string | null
          id: string
          images: string[] | null
          name: string
          title: string | null
        }
        Insert: {
          cover_image_url?: string | null
          cover_thumbnail_url?: string | null
          created_at?: string
          date: string
          description?: string | null
          event_id?: string | null
          google_photos_url?: string | null
          id?: string
          images?: string[] | null
          name: string
          title?: string | null
        }
        Update: {
          cover_image_url?: string | null
          cover_thumbnail_url?: string | null
          created_at?: string
          date?: string
          description?: string | null
          event_id?: string | null
          google_photos_url?: string | null
          id?: string
          images?: string[] | null
          name?: string
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gallery_events_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gallery_events_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "house_recent_activity"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "gallery_events_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "member_event_history"
            referencedColumns: ["event_id"]
          },
        ]
      }
      homepage_content: {
        Row: {
          created_at: string
          id: string
          presidents_message: string
          presidents_names: string
          presidents_photo_thumbnail_url: string | null
          presidents_photo_url: string | null
          presidents_role: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          presidents_message: string
          presidents_names: string
          presidents_photo_thumbnail_url?: string | null
          presidents_photo_url?: string | null
          presidents_role: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          presidents_message?: string
          presidents_names?: string
          presidents_photo_thumbnail_url?: string | null
          presidents_photo_url?: string | null
          presidents_role?: string
          updated_at?: string
        }
        Relationships: []
      }
      house_event_houses: {
        Row: {
          created_at: string | null
          house_event_id: string
          house_page_asset_id: string
        }
        Insert: {
          created_at?: string | null
          house_event_id: string
          house_page_asset_id: string
        }
        Update: {
          created_at?: string | null
          house_event_id?: string
          house_page_asset_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "house_event_houses_house_event_id_fkey"
            columns: ["house_event_id"]
            isOneToOne: false
            referencedRelation: "house_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "house_event_houses_house_page_asset_id_fkey"
            columns: ["house_page_asset_id"]
            isOneToOne: false
            referencedRelation: "house_all_time_points"
            referencedColumns: ["house_profile_id"]
          },
          {
            foreignKeyName: "house_event_houses_house_page_asset_id_fkey"
            columns: ["house_page_asset_id"]
            isOneToOne: false
            referencedRelation: "house_member_all_time_points"
            referencedColumns: ["house_profile_id"]
          },
          {
            foreignKeyName: "house_event_houses_house_page_asset_id_fkey"
            columns: ["house_page_asset_id"]
            isOneToOne: false
            referencedRelation: "house_member_yearly_points"
            referencedColumns: ["house_profile_id"]
          },
          {
            foreignKeyName: "house_event_houses_house_page_asset_id_fkey"
            columns: ["house_page_asset_id"]
            isOneToOne: false
            referencedRelation: "house_page_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "house_event_houses_house_page_asset_id_fkey"
            columns: ["house_page_asset_id"]
            isOneToOne: false
            referencedRelation: "house_recent_activity"
            referencedColumns: ["house_profile_id"]
          },
          {
            foreignKeyName: "house_event_houses_house_page_asset_id_fkey"
            columns: ["house_page_asset_id"]
            isOneToOne: false
            referencedRelation: "house_yearly_points"
            referencedColumns: ["house_profile_id"]
          },
          {
            foreignKeyName: "house_event_houses_house_page_asset_id_fkey"
            columns: ["house_page_asset_id"]
            isOneToOne: false
            referencedRelation: "published_house_page_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      house_events: {
        Row: {
          academic_year_end: number
          academic_year_start: number
          created_at: string
          description: string | null
          end_time: string | null
          event_date: string
          gallery_url: string | null
          google_calendar_enabled: boolean
          house_profile_id: string
          id: string
          image_thumbnail_url: string | null
          image_url: string | null
          is_published: boolean
          location: string | null
          recap_url: string | null
          rsvp_url: string | null
          slug: string | null
          start_time: string | null
          title: string
          updated_at: string
        }
        Insert: {
          academic_year_end: number
          academic_year_start: number
          created_at?: string
          description?: string | null
          end_time?: string | null
          event_date: string
          gallery_url?: string | null
          google_calendar_enabled?: boolean
          house_profile_id: string
          id?: string
          image_thumbnail_url?: string | null
          image_url?: string | null
          is_published?: boolean
          location?: string | null
          recap_url?: string | null
          rsvp_url?: string | null
          slug?: string | null
          start_time?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          academic_year_end?: number
          academic_year_start?: number
          created_at?: string
          description?: string | null
          end_time?: string | null
          event_date?: string
          gallery_url?: string | null
          google_calendar_enabled?: boolean
          house_profile_id?: string
          id?: string
          image_thumbnail_url?: string | null
          image_url?: string | null
          is_published?: boolean
          location?: string | null
          recap_url?: string | null
          rsvp_url?: string | null
          slug?: string | null
          start_time?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "house_events_house_profile_id_fkey"
            columns: ["house_profile_id"]
            isOneToOne: false
            referencedRelation: "house_all_time_points"
            referencedColumns: ["house_profile_id"]
          },
          {
            foreignKeyName: "house_events_house_profile_id_fkey"
            columns: ["house_profile_id"]
            isOneToOne: false
            referencedRelation: "house_member_all_time_points"
            referencedColumns: ["house_profile_id"]
          },
          {
            foreignKeyName: "house_events_house_profile_id_fkey"
            columns: ["house_profile_id"]
            isOneToOne: false
            referencedRelation: "house_member_yearly_points"
            referencedColumns: ["house_profile_id"]
          },
          {
            foreignKeyName: "house_events_house_profile_id_fkey"
            columns: ["house_profile_id"]
            isOneToOne: false
            referencedRelation: "house_page_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "house_events_house_profile_id_fkey"
            columns: ["house_profile_id"]
            isOneToOne: false
            referencedRelation: "house_recent_activity"
            referencedColumns: ["house_profile_id"]
          },
          {
            foreignKeyName: "house_events_house_profile_id_fkey"
            columns: ["house_profile_id"]
            isOneToOne: false
            referencedRelation: "house_yearly_points"
            referencedColumns: ["house_profile_id"]
          },
          {
            foreignKeyName: "house_events_house_profile_id_fkey"
            columns: ["house_profile_id"]
            isOneToOne: false
            referencedRelation: "published_house_page_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      house_memberships: {
        Row: {
          academic_year_end: number
          academic_year_start: number
          created_at: string
          created_by: string | null
          effective_end_date: string | null
          effective_start_date: string
          house_profile_id: string
          id: string
          member_id: string
          notes: string | null
          source: string | null
          source_import_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          academic_year_end: number
          academic_year_start: number
          created_at?: string
          created_by?: string | null
          effective_end_date?: string | null
          effective_start_date: string
          house_profile_id: string
          id?: string
          member_id: string
          notes?: string | null
          source?: string | null
          source_import_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          academic_year_end?: number
          academic_year_start?: number
          created_at?: string
          created_by?: string | null
          effective_end_date?: string | null
          effective_start_date?: string
          house_profile_id?: string
          id?: string
          member_id?: string
          notes?: string | null
          source?: string | null
          source_import_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "house_memberships_house_profile_id_fkey"
            columns: ["house_profile_id"]
            isOneToOne: false
            referencedRelation: "house_all_time_points"
            referencedColumns: ["house_profile_id"]
          },
          {
            foreignKeyName: "house_memberships_house_profile_id_fkey"
            columns: ["house_profile_id"]
            isOneToOne: false
            referencedRelation: "house_member_all_time_points"
            referencedColumns: ["house_profile_id"]
          },
          {
            foreignKeyName: "house_memberships_house_profile_id_fkey"
            columns: ["house_profile_id"]
            isOneToOne: false
            referencedRelation: "house_member_yearly_points"
            referencedColumns: ["house_profile_id"]
          },
          {
            foreignKeyName: "house_memberships_house_profile_id_fkey"
            columns: ["house_profile_id"]
            isOneToOne: false
            referencedRelation: "house_page_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "house_memberships_house_profile_id_fkey"
            columns: ["house_profile_id"]
            isOneToOne: false
            referencedRelation: "house_recent_activity"
            referencedColumns: ["house_profile_id"]
          },
          {
            foreignKeyName: "house_memberships_house_profile_id_fkey"
            columns: ["house_profile_id"]
            isOneToOne: false
            referencedRelation: "house_yearly_points"
            referencedColumns: ["house_profile_id"]
          },
          {
            foreignKeyName: "house_memberships_house_profile_id_fkey"
            columns: ["house_profile_id"]
            isOneToOne: false
            referencedRelation: "published_house_page_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "house_memberships_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "house_member_all_time_points"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "house_memberships_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "house_member_yearly_points"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "house_memberships_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_yearly_points"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "house_memberships_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      house_page_assets: {
        Row: {
          academic_year_end: number
          academic_year_start: number
          accent_color: string | null
          cover_image_url: string | null
          created_at: string
          description: string | null
          display_name: string
          display_order: number
          emoji: string | null
          house: string
          house_key: string
          house_parent_body: string | null
          house_parent_heading: string | null
          house_parent_image_url: string | null
          id: string
          image_alt: string | null
          image_thumbnail_url: string | null
          image_url: string | null
          internal_notes: string | null
          is_active: boolean
          source_doc_url: string | null
          updated_at: string
        }
        Insert: {
          academic_year_end: number
          academic_year_start: number
          accent_color?: string | null
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          display_name: string
          display_order?: number
          emoji?: string | null
          house: string
          house_key: string
          house_parent_body?: string | null
          house_parent_heading?: string | null
          house_parent_image_url?: string | null
          id?: string
          image_alt?: string | null
          image_thumbnail_url?: string | null
          image_url?: string | null
          internal_notes?: string | null
          is_active?: boolean
          source_doc_url?: string | null
          updated_at?: string
        }
        Update: {
          academic_year_end?: number
          academic_year_start?: number
          accent_color?: string | null
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          display_name?: string
          display_order?: number
          emoji?: string | null
          house?: string
          house_key?: string
          house_parent_body?: string | null
          house_parent_heading?: string | null
          house_parent_image_url?: string | null
          id?: string
          image_alt?: string | null
          image_thumbnail_url?: string | null
          image_url?: string | null
          internal_notes?: string | null
          is_active?: boolean
          source_doc_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      import_job_rows: {
        Row: {
          attendance_member_id: string | null
          created_at: string
          created_member_id: string | null
          csv_college: string | null
          csv_email: string | null
          csv_year: string | null
          decision: string
          display_name: string | null
          error_message: string | null
          event_id: string | null
          id: string
          import_job_id: string
          match_details: Json
          matched_member_id: string | null
          points_earned: number | null
          raw_row: Json
          score: number | null
          source_row_index: number
          status: string
        }
        Insert: {
          attendance_member_id?: string | null
          created_at?: string
          created_member_id?: string | null
          csv_college?: string | null
          csv_email?: string | null
          csv_year?: string | null
          decision: string
          display_name?: string | null
          error_message?: string | null
          event_id?: string | null
          id?: string
          import_job_id: string
          match_details?: Json
          matched_member_id?: string | null
          points_earned?: number | null
          raw_row?: Json
          score?: number | null
          source_row_index: number
          status?: string
        }
        Update: {
          attendance_member_id?: string | null
          created_at?: string
          created_member_id?: string | null
          csv_college?: string | null
          csv_email?: string | null
          csv_year?: string | null
          decision?: string
          display_name?: string | null
          error_message?: string | null
          event_id?: string | null
          id?: string
          import_job_id?: string
          match_details?: Json
          matched_member_id?: string | null
          points_earned?: number | null
          raw_row?: Json
          score?: number | null
          source_row_index?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_job_rows_attendance_member_id_fkey"
            columns: ["attendance_member_id"]
            isOneToOne: false
            referencedRelation: "house_member_all_time_points"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "import_job_rows_attendance_member_id_fkey"
            columns: ["attendance_member_id"]
            isOneToOne: false
            referencedRelation: "house_member_yearly_points"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "import_job_rows_attendance_member_id_fkey"
            columns: ["attendance_member_id"]
            isOneToOne: false
            referencedRelation: "member_yearly_points"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "import_job_rows_attendance_member_id_fkey"
            columns: ["attendance_member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_job_rows_created_member_id_fkey"
            columns: ["created_member_id"]
            isOneToOne: false
            referencedRelation: "house_member_all_time_points"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "import_job_rows_created_member_id_fkey"
            columns: ["created_member_id"]
            isOneToOne: false
            referencedRelation: "house_member_yearly_points"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "import_job_rows_created_member_id_fkey"
            columns: ["created_member_id"]
            isOneToOne: false
            referencedRelation: "member_yearly_points"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "import_job_rows_created_member_id_fkey"
            columns: ["created_member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_job_rows_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_job_rows_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "house_recent_activity"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "import_job_rows_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "member_event_history"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "import_job_rows_import_job_id_fkey"
            columns: ["import_job_id"]
            isOneToOne: false
            referencedRelation: "import_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_job_rows_matched_member_id_fkey"
            columns: ["matched_member_id"]
            isOneToOne: false
            referencedRelation: "house_member_all_time_points"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "import_job_rows_matched_member_id_fkey"
            columns: ["matched_member_id"]
            isOneToOne: false
            referencedRelation: "house_member_yearly_points"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "import_job_rows_matched_member_id_fkey"
            columns: ["matched_member_id"]
            isOneToOne: false
            referencedRelation: "member_yearly_points"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "import_job_rows_matched_member_id_fkey"
            columns: ["matched_member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      import_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          created_attendance_count: number
          created_by: string | null
          created_members: number
          error_count: number
          error_message: string | null
          event_id: string | null
          id: string
          matched_rows: number
          review_rows: number
          skipped_duplicate_rows: number
          source_type: string
          source_url: string | null
          status: string
          total_rows: number
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_attendance_count?: number
          created_by?: string | null
          created_members?: number
          error_count?: number
          error_message?: string | null
          event_id?: string | null
          id?: string
          matched_rows?: number
          review_rows?: number
          skipped_duplicate_rows?: number
          source_type?: string
          source_url?: string | null
          status?: string
          total_rows?: number
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_attendance_count?: number
          created_by?: string | null
          created_members?: number
          error_count?: number
          error_message?: string | null
          event_id?: string | null
          id?: string
          matched_rows?: number
          review_rows?: number
          skipped_duplicate_rows?: number
          source_type?: string
          source_url?: string | null
          status?: string
          total_rows?: number
        }
        Relationships: [
          {
            foreignKeyName: "import_jobs_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_jobs_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "house_recent_activity"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "import_jobs_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "member_event_history"
            referencedColumns: ["event_id"]
          },
        ]
      }
      intern_cohort_members: {
        Row: {
          academic_year_end: number
          academic_year_start: number
          caption: string | null
          created_at: string
          display_order: number
          id: string
          internal_notes: string | null
          is_published: boolean
          name: string
          photo_url: string | null
          role_or_track: string | null
          source_doc_url: string | null
          updated_at: string
        }
        Insert: {
          academic_year_end: number
          academic_year_start: number
          caption?: string | null
          created_at?: string
          display_order?: number
          id?: string
          internal_notes?: string | null
          is_published?: boolean
          name: string
          photo_url?: string | null
          role_or_track?: string | null
          source_doc_url?: string | null
          updated_at?: string
        }
        Update: {
          academic_year_end?: number
          academic_year_start?: number
          caption?: string | null
          created_at?: string
          display_order?: number
          id?: string
          internal_notes?: string | null
          is_published?: boolean
          name?: string
          photo_url?: string | null
          role_or_track?: string | null
          source_doc_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      member_event_attendance: {
        Row: {
          event_id: string
          id: string
          imported_at: string
          member_id: string
          points_earned: number
        }
        Insert: {
          event_id: string
          id?: string
          imported_at?: string
          member_id: string
          points_earned?: number
        }
        Update: {
          event_id?: string
          id?: string
          imported_at?: string
          member_id?: string
          points_earned?: number
        }
        Relationships: [
          {
            foreignKeyName: "member_event_attendance_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_event_attendance_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "house_recent_activity"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "member_event_attendance_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "member_event_history"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "member_event_attendance_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "house_member_all_time_points"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "member_event_attendance_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "house_member_yearly_points"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "member_event_attendance_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_yearly_points"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "member_event_attendance_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      member_photo_request_events: {
        Row: {
          action: string
          actor: string | null
          created_at: string
          id: string
          note: string | null
          request_id: string
        }
        Insert: {
          action: string
          actor?: string | null
          created_at?: string
          id?: string
          note?: string | null
          request_id: string
        }
        Update: {
          action?: string
          actor?: string | null
          created_at?: string
          id?: string
          note?: string | null
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_photo_request_events_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "member_photo_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_photo_request_events_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "my_member_photo_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      member_photo_requests: {
        Row: {
          admin_notes: string | null
          approved_avatar_url: string | null
          consent_confirmed: boolean
          created_at: string
          id: string
          matched_member_id: string | null
          note_to_admins: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          storage_path_approved: string | null
          storage_path_pending: string
          submitted_email: string
          submitted_name: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          admin_notes?: string | null
          approved_avatar_url?: string | null
          consent_confirmed?: boolean
          created_at?: string
          id?: string
          matched_member_id?: string | null
          note_to_admins?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          storage_path_approved?: string | null
          storage_path_pending: string
          submitted_email: string
          submitted_name: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          admin_notes?: string | null
          approved_avatar_url?: string | null
          consent_confirmed?: boolean
          created_at?: string
          id?: string
          matched_member_id?: string | null
          note_to_admins?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          storage_path_approved?: string | null
          storage_path_pending?: string
          submitted_email?: string
          submitted_name?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "member_photo_requests_matched_member_id_fkey"
            columns: ["matched_member_id"]
            isOneToOne: false
            referencedRelation: "house_member_all_time_points"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "member_photo_requests_matched_member_id_fkey"
            columns: ["matched_member_id"]
            isOneToOne: false
            referencedRelation: "house_member_yearly_points"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "member_photo_requests_matched_member_id_fkey"
            columns: ["matched_member_id"]
            isOneToOne: false
            referencedRelation: "member_yearly_points"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "member_photo_requests_matched_member_id_fkey"
            columns: ["matched_member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      members: {
        Row: {
          college: string | null
          created_at: string
          email: string | null
          events_attended: number
          first_name: string
          house: string | null
          id: string
          last_name: string
          needs_review: boolean | null
          points: number
          updated_at: string
          user_id: string | null
          year: string | null
        }
        Insert: {
          college?: string | null
          created_at?: string
          email?: string | null
          events_attended?: number
          first_name: string
          house?: string | null
          id?: string
          last_name: string
          needs_review?: boolean | null
          points?: number
          updated_at?: string
          user_id?: string | null
          year?: string | null
        }
        Update: {
          college?: string | null
          created_at?: string
          email?: string | null
          events_attended?: number
          first_name?: string
          house?: string | null
          id?: string
          last_name?: string
          needs_review?: boolean | null
          points?: number
          updated_at?: string
          user_id?: string | null
          year?: string | null
        }
        Relationships: []
      }
      merge_exclusions: {
        Row: {
          created_at: string
          source_id: string
          target_id: string
        }
        Insert: {
          created_at?: string
          source_id: string
          target_id: string
        }
        Update: {
          created_at?: string
          source_id?: string
          target_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "merge_exclusions_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "house_member_all_time_points"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "merge_exclusions_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "house_member_yearly_points"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "merge_exclusions_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "member_yearly_points"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "merge_exclusions_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merge_exclusions_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "house_member_all_time_points"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "merge_exclusions_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "house_member_yearly_points"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "merge_exclusions_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "member_yearly_points"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "merge_exclusions_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      program_content: {
        Row: {
          body: string | null
          close_at: string | null
          created_at: string
          deadline_at: string | null
          display_order: number
          event_date: string | null
          id: string
          internal_notes: string | null
          is_published: boolean
          open_at: string | null
          page_key: string
          primary_link_label: string | null
          primary_link_url: string | null
          secondary_link_label: string | null
          secondary_link_url: string | null
          section_key: string
          source_doc_url: string | null
          status: string
          title: string | null
          updated_at: string
          venue: string | null
        }
        Insert: {
          body?: string | null
          close_at?: string | null
          created_at?: string
          deadline_at?: string | null
          display_order?: number
          event_date?: string | null
          id?: string
          internal_notes?: string | null
          is_published?: boolean
          open_at?: string | null
          page_key: string
          primary_link_label?: string | null
          primary_link_url?: string | null
          secondary_link_label?: string | null
          secondary_link_url?: string | null
          section_key?: string
          source_doc_url?: string | null
          status?: string
          title?: string | null
          updated_at?: string
          venue?: string | null
        }
        Update: {
          body?: string | null
          close_at?: string | null
          created_at?: string
          deadline_at?: string | null
          display_order?: number
          event_date?: string | null
          id?: string
          internal_notes?: string | null
          is_published?: boolean
          open_at?: string | null
          page_key?: string
          primary_link_label?: string | null
          primary_link_url?: string | null
          secondary_link_label?: string | null
          secondary_link_url?: string | null
          section_key?: string
          source_doc_url?: string | null
          status?: string
          title?: string | null
          updated_at?: string
          venue?: string | null
        }
        Relationships: []
      }
      resource_links: {
        Row: {
          academic_year_end: number | null
          academic_year_start: number | null
          category: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_archived: boolean
          is_current: boolean
          last_verified_at: string | null
          owner_role: string | null
          program: string | null
          role: string | null
          title: string
          updated_at: string
          updated_by: string | null
          url: string
          visibility: string
          workflow: string | null
        }
        Insert: {
          academic_year_end?: number | null
          academic_year_start?: number | null
          category: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_archived?: boolean
          is_current?: boolean
          last_verified_at?: string | null
          owner_role?: string | null
          program?: string | null
          role?: string | null
          title: string
          updated_at?: string
          updated_by?: string | null
          url: string
          visibility?: string
          workflow?: string | null
        }
        Update: {
          academic_year_end?: number | null
          academic_year_start?: number | null
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_archived?: boolean
          is_current?: boolean
          last_verified_at?: string | null
          owner_role?: string | null
          program?: string | null
          role?: string | null
          title?: string
          updated_at?: string
          updated_by?: string | null
          url?: string
          visibility?: string
          workflow?: string | null
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          id: string
          logo_alt: string
          logo_url: string | null
          updated_at: string
        }
        Insert: {
          id: string
          logo_alt?: string
          logo_url?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          logo_alt?: string
          logo_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_points: {
        Row: {
          last_updated: string | null
          points: number
          user_id: string
        }
        Insert: {
          last_updated?: string | null
          points?: number
          user_id: string
        }
        Update: {
          last_updated?: string | null
          points?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_user_points_user_profiles"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          first_name: string | null
          id: string
          is_admin: boolean | null
          last_name: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          first_name?: string | null
          id: string
          is_admin?: boolean | null
          last_name?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          first_name?: string | null
          id?: string
          is_admin?: boolean | null
          last_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      uvsa_schools: {
        Row: {
          city: string | null
          confidence_level: string | null
          created_at: string | null
          description: string | null
          facebook_url: string | null
          id: string
          image_url: string | null
          instagram_url: string | null
          is_active: boolean | null
          known_for: string[] | null
          linktree_url: string | null
          logo_url: string | null
          recurring_events: string[] | null
          school_name: string
          short_name: string
          slug: string
          sort_order: number | null
          system_type: string
          tiktok_url: string | null
          updated_at: string | null
          verification_notes: string | null
          vsa_name: string | null
          website_url: string | null
          youtube_url: string | null
        }
        Insert: {
          city?: string | null
          confidence_level?: string | null
          created_at?: string | null
          description?: string | null
          facebook_url?: string | null
          id?: string
          image_url?: string | null
          instagram_url?: string | null
          is_active?: boolean | null
          known_for?: string[] | null
          linktree_url?: string | null
          logo_url?: string | null
          recurring_events?: string[] | null
          school_name: string
          short_name: string
          slug: string
          sort_order?: number | null
          system_type: string
          tiktok_url?: string | null
          updated_at?: string | null
          verification_notes?: string | null
          vsa_name?: string | null
          website_url?: string | null
          youtube_url?: string | null
        }
        Update: {
          city?: string | null
          confidence_level?: string | null
          created_at?: string | null
          description?: string | null
          facebook_url?: string | null
          id?: string
          image_url?: string | null
          instagram_url?: string | null
          is_active?: boolean | null
          known_for?: string[] | null
          linktree_url?: string | null
          logo_url?: string | null
          recurring_events?: string[] | null
          school_name?: string
          short_name?: string
          slug?: string
          sort_order?: number | null
          system_type?: string
          tiktok_url?: string | null
          updated_at?: string | null
          verification_notes?: string | null
          vsa_name?: string | null
          website_url?: string | null
          youtube_url?: string | null
        }
        Relationships: []
      }
      vcn_archives: {
        Row: {
          album_source: string | null
          annual_number: string | null
          cover_image_url: string | null
          cover_thumbnail_url: string | null
          created_at: string
          description: string | null
          display_order: number
          event_date: string | null
          event_time: string | null
          id: string
          internal_notes: string | null
          is_current: boolean
          is_featured: boolean
          is_published: boolean
          photo_album_url: string | null
          photo_credit: string | null
          poster_url: string | null
          source_doc_url: string | null
          theme_name: string | null
          ticket_note: string | null
          ticket_status: string
          ticket_url: string | null
          title: string | null
          trailer_url: string | null
          updated_at: string
          venue: string | null
          video_url: string | null
          year: number
        }
        Insert: {
          album_source?: string | null
          annual_number?: string | null
          cover_image_url?: string | null
          cover_thumbnail_url?: string | null
          created_at?: string
          description?: string | null
          display_order?: number
          event_date?: string | null
          event_time?: string | null
          id?: string
          internal_notes?: string | null
          is_current?: boolean
          is_featured?: boolean
          is_published?: boolean
          photo_album_url?: string | null
          photo_credit?: string | null
          poster_url?: string | null
          source_doc_url?: string | null
          theme_name?: string | null
          ticket_note?: string | null
          ticket_status?: string
          ticket_url?: string | null
          title?: string | null
          trailer_url?: string | null
          updated_at?: string
          venue?: string | null
          video_url?: string | null
          year: number
        }
        Update: {
          album_source?: string | null
          annual_number?: string | null
          cover_image_url?: string | null
          cover_thumbnail_url?: string | null
          created_at?: string
          description?: string | null
          display_order?: number
          event_date?: string | null
          event_time?: string | null
          id?: string
          internal_notes?: string | null
          is_current?: boolean
          is_featured?: boolean
          is_published?: boolean
          photo_album_url?: string | null
          photo_credit?: string | null
          poster_url?: string | null
          source_doc_url?: string | null
          theme_name?: string | null
          ticket_note?: string | null
          ticket_status?: string
          ticket_url?: string | null
          title?: string | null
          trailer_url?: string | null
          updated_at?: string
          venue?: string | null
          video_url?: string | null
          year?: number
        }
        Relationships: []
      }
    }
    Views: {
      house_all_time_points: {
        Row: {
          academic_year_end: number | null
          academic_year_start: number | null
          accent_color: string | null
          average_points_per_member: number | null
          display_name: string | null
          events_attended: number | null
          house: string | null
          house_profile_id: string | null
          image_url: string | null
          latest_activity_at: string | null
          total_points: number | null
          unique_events: number | null
          unique_members: number | null
        }
        Relationships: []
      }
      house_member_all_time_points: {
        Row: {
          academic_year_end: number | null
          academic_year_start: number | null
          accent_color: string | null
          college: string | null
          display_name: string | null
          events_attended: number | null
          first_name: string | null
          graduation_year: string | null
          house: string | null
          house_profile_id: string | null
          image_url: string | null
          last_name: string | null
          latest_activity_at: string | null
          member_id: string | null
          total_points: number | null
          unique_events: number | null
        }
        Relationships: []
      }
      house_member_yearly_points: {
        Row: {
          academic_year_end: number | null
          academic_year_start: number | null
          accent_color: string | null
          college: string | null
          display_name: string | null
          events_attended: number | null
          first_name: string | null
          graduation_year: string | null
          house: string | null
          house_profile_id: string | null
          image_url: string | null
          last_name: string | null
          latest_activity_at: string | null
          member_id: string | null
          total_points: number | null
          unique_events: number | null
        }
        Relationships: []
      }
      house_recent_activity: {
        Row: {
          academic_year_end: number | null
          academic_year_start: number | null
          accent_color: string | null
          contributing_members: number | null
          display_name: string | null
          event_date: string | null
          event_id: string | null
          event_name: string | null
          house: string | null
          house_profile_id: string | null
          image_url: string | null
          latest_activity_at: string | null
          total_points: number | null
        }
        Relationships: []
      }
      house_yearly_points: {
        Row: {
          academic_year_end: number | null
          academic_year_start: number | null
          accent_color: string | null
          average_points_per_member: number | null
          display_name: string | null
          events_attended: number | null
          house: string | null
          house_profile_id: string | null
          image_url: string | null
          latest_activity_at: string | null
          total_points: number | null
          unique_events: number | null
          unique_members: number | null
        }
        Relationships: []
      }
      member_event_history: {
        Row: {
          academic_year_end: number | null
          academic_year_start: number | null
          event_date: string | null
          event_end_date: string | null
          event_id: string | null
          event_name: string | null
          event_type: string | null
          member_id: string | null
          points_earned: number | null
        }
        Relationships: [
          {
            foreignKeyName: "member_event_attendance_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "house_member_all_time_points"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "member_event_attendance_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "house_member_yearly_points"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "member_event_attendance_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_yearly_points"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "member_event_attendance_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      member_yearly_points: {
        Row: {
          academic_year_end: number | null
          academic_year_start: number | null
          college: string | null
          events_attended: number | null
          first_name: string | null
          graduation_year: string | null
          last_name: string | null
          member_id: string | null
          total_points: number | null
        }
        Relationships: []
      }
      my_member_photo_requests: {
        Row: {
          created_at: string | null
          id: string | null
          reviewed_at: string | null
          status: string | null
          storage_path_pending: string | null
          submitted_name: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string | null
          reviewed_at?: string | null
          status?: string | null
          storage_path_pending?: string | null
          submitted_name?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string | null
          reviewed_at?: string | null
          status?: string | null
          storage_path_pending?: string | null
          submitted_name?: string | null
        }
        Relationships: []
      }
      public_application_links: {
        Row: {
          after_close_message: string | null
          application_key: string | null
          before_open_message: string | null
          button_label: string | null
          description: string | null
          due_at: string | null
          id: string | null
          is_enabled: boolean | null
          open_at: string | null
          sort_order: number | null
          status: string | null
          target_url: string | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          after_close_message?: string | null
          application_key?: string | null
          before_open_message?: string | null
          button_label?: string | null
          description?: string | null
          due_at?: string | null
          id?: string | null
          is_enabled?: boolean | null
          open_at?: string | null
          sort_order?: number | null
          status?: never
          target_url?: never
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          after_close_message?: string | null
          application_key?: string | null
          before_open_message?: string | null
          button_label?: string | null
          description?: string | null
          due_at?: string | null
          id?: string | null
          is_enabled?: boolean | null
          open_at?: string | null
          sort_order?: number | null
          status?: never
          target_url?: never
          title?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      public_member_avatars: {
        Row: {
          avatar_url: string | null
          member_id: string | null
        }
        Relationships: []
      }
      published_ace_families: {
        Row: {
          academic_year_end: number | null
          academic_year_start: number | null
          cover_image_url: string | null
          created_at: string | null
          description: string | null
          display_order: number | null
          id: string | null
          name: string | null
          slug: string | null
          theme_color: string | null
          updated_at: string | null
        }
        Insert: {
          academic_year_end?: number | null
          academic_year_start?: number | null
          cover_image_url?: string | null
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string | null
          name?: string | null
          slug?: string | null
          theme_color?: string | null
          updated_at?: string | null
        }
        Update: {
          academic_year_end?: number | null
          academic_year_start?: number | null
          cover_image_url?: string | null
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string | null
          name?: string | null
          slug?: string | null
          theme_color?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      published_ace_family_members: {
        Row: {
          created_at: string | null
          display_order: number | null
          family_id: string | null
          id: string | null
          name: string | null
          parent_member_id: string | null
          photo_url: string | null
          role_label: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ace_family_members_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "ace_families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ace_family_members_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "published_ace_families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ace_family_members_parent_member_id_fkey"
            columns: ["parent_member_id"]
            isOneToOne: false
            referencedRelation: "ace_family_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ace_family_members_parent_member_id_fkey"
            columns: ["parent_member_id"]
            isOneToOne: false
            referencedRelation: "published_ace_family_members"
            referencedColumns: ["id"]
          },
        ]
      }
      published_house_page_assets: {
        Row: {
          academic_year_end: number | null
          academic_year_start: number | null
          accent_color: string | null
          cover_image_url: string | null
          created_at: string | null
          description: string | null
          display_name: string | null
          display_order: number | null
          emoji: string | null
          house: string | null
          house_key: string | null
          house_parent_body: string | null
          house_parent_heading: string | null
          house_parent_image_url: string | null
          id: string | null
          image_alt: string | null
          image_thumbnail_url: string | null
          image_url: string | null
          is_active: boolean | null
          updated_at: string | null
        }
        Insert: {
          academic_year_end?: number | null
          academic_year_start?: number | null
          accent_color?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          description?: string | null
          display_name?: string | null
          display_order?: number | null
          emoji?: string | null
          house?: string | null
          house_key?: string | null
          house_parent_body?: string | null
          house_parent_heading?: string | null
          house_parent_image_url?: string | null
          id?: string | null
          image_alt?: string | null
          image_thumbnail_url?: string | null
          image_url?: string | null
          is_active?: boolean | null
          updated_at?: string | null
        }
        Update: {
          academic_year_end?: number | null
          academic_year_start?: number | null
          accent_color?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          description?: string | null
          display_name?: string | null
          display_order?: number | null
          emoji?: string | null
          house?: string | null
          house_key?: string | null
          house_parent_body?: string | null
          house_parent_heading?: string | null
          house_parent_image_url?: string | null
          id?: string | null
          image_alt?: string | null
          image_thumbnail_url?: string | null
          image_url?: string | null
          is_active?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
      published_intern_cohort_members: {
        Row: {
          academic_year_end: number | null
          academic_year_start: number | null
          caption: string | null
          created_at: string | null
          display_order: number | null
          id: string | null
          name: string | null
          photo_url: string | null
          role_or_track: string | null
          updated_at: string | null
        }
        Insert: {
          academic_year_end?: number | null
          academic_year_start?: number | null
          caption?: string | null
          created_at?: string | null
          display_order?: number | null
          id?: string | null
          name?: string | null
          photo_url?: string | null
          role_or_track?: string | null
          updated_at?: string | null
        }
        Update: {
          academic_year_end?: number | null
          academic_year_start?: number | null
          caption?: string | null
          created_at?: string | null
          display_order?: number | null
          id?: string | null
          name?: string | null
          photo_url?: string | null
          role_or_track?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      published_vcn_archives: {
        Row: {
          album_source: string | null
          annual_number: string | null
          cover_image_url: string | null
          cover_thumbnail_url: string | null
          created_at: string | null
          description: string | null
          display_order: number | null
          event_date: string | null
          event_time: string | null
          id: string | null
          is_current: boolean | null
          is_featured: boolean | null
          is_published: boolean | null
          photo_album_url: string | null
          photo_credit: string | null
          poster_url: string | null
          theme_name: string | null
          ticket_note: string | null
          ticket_status: string | null
          ticket_url: string | null
          title: string | null
          trailer_url: string | null
          updated_at: string | null
          venue: string | null
          video_url: string | null
          year: number | null
        }
        Insert: {
          album_source?: string | null
          annual_number?: string | null
          cover_image_url?: string | null
          cover_thumbnail_url?: string | null
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          event_date?: string | null
          event_time?: string | null
          id?: string | null
          is_current?: boolean | null
          is_featured?: boolean | null
          is_published?: boolean | null
          photo_album_url?: string | null
          photo_credit?: string | null
          poster_url?: string | null
          theme_name?: string | null
          ticket_note?: string | null
          ticket_status?: string | null
          ticket_url?: string | null
          title?: string | null
          trailer_url?: string | null
          updated_at?: string | null
          venue?: string | null
          video_url?: string | null
          year?: number | null
        }
        Update: {
          album_source?: string | null
          annual_number?: string | null
          cover_image_url?: string | null
          cover_thumbnail_url?: string | null
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          event_date?: string | null
          event_time?: string | null
          id?: string | null
          is_current?: boolean | null
          is_featured?: boolean | null
          is_published?: boolean | null
          photo_album_url?: string | null
          photo_credit?: string | null
          poster_url?: string | null
          theme_name?: string | null
          ticket_note?: string | null
          ticket_status?: string | null
          ticket_url?: string | null
          title?: string | null
          trailer_url?: string | null
          updated_at?: string | null
          venue?: string | null
          video_url?: string | null
          year?: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      approve_member_photo_request: {
        Args: {
          p_approved_path: string
          p_matched_member_id?: string
          p_public_url: string
          p_request_id: string
        }
        Returns: undefined
      }
      check_in_to_event: { Args: { p_code: string }; Returns: Json }
      generate_check_in_code: { Args: never; Returns: string }
      generate_data_rights_export: {
        Args: { p_request_id: string }
        Returns: Json
      }
      get_data_rights_dependency_preview: {
        Args: { p_request_id: string }
        Returns: Json
      }
      get_event_points: {
        Args: { event_type: Database["public"]["Enums"]["event_type"] }
        Returns: number
      }
      get_user_points: { Args: { uid: string }; Returns: number }
      is_admin_user: { Args: { p_user_id?: string }; Returns: boolean }
      match_ai_knowledge_base: {
        Args: { match_limit?: number; query_text: string }
        Returns: {
          category: string
          content: string
          id: string
          rank: number
          source_type: string
          source_url: string
          title: string
        }[]
      }
      recalculate_member_points: {
        Args: { p_member_id: string }
        Returns: undefined
      }
      record_event_interest: {
        Args: { p_event_id: string; p_signal: string }
        Returns: undefined
      }
      reject_member_photo_request: {
        Args: { p_admin_note?: string; p_request_id: string }
        Returns: undefined
      }
      remove_member_photo_request: {
        Args: { p_admin_note?: string; p_request_id: string }
        Returns: undefined
      }
      smart_merge_members: {
        Args: { p_source_id: string; p_target_id: string }
        Returns: undefined
      }
    }
    Enums: {
      event_type:
        | "general_event"
        | "wildn_culture"
        | "vcn_dance_practice"
        | "vcn_attendance"
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
      event_type: [
        "general_event",
        "wildn_culture",
        "vcn_dance_practice",
        "vcn_attendance",
      ],
    },
  },
} as const

// ---------------------------------------------------------------------------
// Hand-maintained domain aliases (preserved across regeneration).
//
// These are not emitted by `supabase gen types` — they are convenience unions
// used by the UI and constants layers. Keep them in sync with the generated
// column types above when the schema changes.
// ---------------------------------------------------------------------------

export type SiteEventType =
  | "gbm"
  | "mixer"
  | "winter_retreat"
  | "vcn"
  | "wildn_culture"
  | "external_event"
  | "other";

export type CheckInCodeEventType =
  | "general_event"
  | "wildn_culture"
  | "vcn_dance_practice"
  | "vcn_attendance";

export type AcademicQuarter = "fall" | "winter" | "spring" | "summer";
export type ProgramPageKey = "ace" | "intern" | "house" | "wnc";
export type ProgramSectionKey =
  | "current_cycle"
  | "application_cta"
  | "event_cta"
  | "notice";
export type ProgramContentStatus =
  | "hidden"
  | "coming_soon"
  | "open"
  | "closed"
  | "active";
export type ResourceLinkVisibility = "admin_only";
export type ApplicationKey =
  | "ace_application"
  | "house_fall"
  | "house_winter"
  | "house_spring"
  | "intern_application"
  | "cabinet_application"
  | "vcn_stage_ninja_interest"
  | "vcn_props_team_interest"
  | "wnc_team_form";
export type ApplicationStatus = "disabled" | "not_open" | "open" | "closed";
export type ImportJobStatus = "completed" | "failed";
export type ImportSourceType =
  | "csv_url"
  | "google_sheets_csv"
  | "manual"
  | "unknown";
export type ImportRowDecision =
  | "matched"
  | "created"
  | "skipped_duplicate"
  | "review"
  | "error";
export type ImportRowStatus = "recorded" | "error";
export type DataRightsRequestType =
  | "review"
  | "correction"
  | "export"
  | "deletion"
  | "anonymization"
  | "media_removal"
  | "analytics_browser_help"
  | "external_form"
  | "other";
export type DataRightsRequestStatus =
  | "intake"
  | "identity_verification"
  | "preview_needed"
  | "pending_review"
  | "approved_for_future_action"
  | "completed"
  | "rejected"
  | "cancelled";
export type DataRightsVerificationStatus =
  | "not_started"
  | "pending"
  | "verified"
  | "failed"
  | "not_required";
export type DataRightsRequestPriority = "low" | "normal" | "high";
export type DataRightsRequestEventType =
  | "created"
  | "status_changed"
  | "verification_changed"
  | "workflow_updated"
  | "details_updated"
  | "export_generated"
  | "anonymization_completed";
export type MemberPhotoRequestStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "removed";
export type MemberPhotoRequestEventAction =
  | "submitted"
  | "approved"
  | "rejected"
  | "removed";
