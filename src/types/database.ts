export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type SiteEventType =
  | 'gbm'
  | 'mixer'
  | 'winter_retreat'
  | 'vcn'
  | 'wildn_culture'
  | 'external_event'
  | 'other';

export type CheckInCodeEventType =
  | 'general_event'
  | 'wildn_culture'
  | 'vcn_dance_practice'
  | 'vcn_attendance';

export type AcademicQuarter = 'fall' | 'winter' | 'spring' | 'summer';
export type ProgramPageKey = 'ace' | 'intern' | 'house' | 'wnc';
export type ProgramSectionKey = 'current_cycle' | 'application_cta' | 'event_cta' | 'notice';
export type ProgramContentStatus = 'hidden' | 'coming_soon' | 'open' | 'closed' | 'active';
export type ResourceLinkVisibility = 'admin_only';
export type ApplicationKey =
  | 'ace_application'
  | 'house_fall'
  | 'house_winter'
  | 'house_spring'
  | 'intern_application'
  | 'cabinet_application'
  | 'vcn_stage_ninja_interest'
  | 'vcn_props_team_interest'
  | 'wnc_team_form';
export type ApplicationStatus = 'disabled' | 'not_open' | 'open' | 'closed';
export type ImportJobStatus = 'completed' | 'failed';
export type ImportSourceType = 'csv_url' | 'google_sheets_csv' | 'manual' | 'unknown';
export type ImportRowDecision = 'matched' | 'created' | 'skipped_duplicate' | 'review' | 'error';
export type ImportRowStatus = 'recorded' | 'error';
export type DataRightsRequestType =
  | 'review'
  | 'correction'
  | 'export'
  | 'deletion'
  | 'anonymization'
  | 'media_removal'
  | 'analytics_browser_help'
  | 'external_form'
  | 'other';
export type DataRightsRequestStatus =
  | 'intake'
  | 'identity_verification'
  | 'preview_needed'
  | 'pending_review'
  | 'approved_for_future_action'
  | 'completed'
  | 'rejected'
  | 'cancelled';
export type DataRightsVerificationStatus =
  | 'not_started'
  | 'pending'
  | 'verified'
  | 'failed'
  | 'not_required';
export type DataRightsRequestPriority = 'low' | 'normal' | 'high';
export type DataRightsRequestEventType =
  | 'created'
  | 'status_changed'
  | 'verification_changed'
  | 'workflow_updated'
  | 'details_updated'
  | 'export_generated'
  | 'anonymization_completed';

export interface Database {
  public: {
    Tables: {
      academic_terms: {
        Row: {
          id: string;
          code: string;
          label: string;
          academic_year_start: number;
          academic_year_end: number;
          quarter: AcademicQuarter;
          starts_on: string | null;
          ends_on: string | null;
          is_active: boolean;
          display_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          label: string;
          academic_year_start: number;
          academic_year_end: number;
          quarter: AcademicQuarter;
          starts_on?: string | null;
          ends_on?: string | null;
          is_active?: boolean;
          display_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          label?: string;
          academic_year_start?: number;
          academic_year_end?: number;
          quarter?: AcademicQuarter;
          starts_on?: string | null;
          ends_on?: string | null;
          is_active?: boolean;
          display_order?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      cabinet_years: {
        Row: {
          id: string;
          label: string;
          slug: string;
          start_year: number;
          end_year: number;
          theme_name: string | null;
          is_active: boolean;
          display_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          label: string;
          slug: string;
          start_year: number;
          end_year: number;
          theme_name?: string | null;
          is_active?: boolean;
          display_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          label?: string;
          slug?: string;
          start_year?: number;
          end_year?: number;
          theme_name?: string | null;
          is_active?: boolean;
          display_order?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      cabinet_members: {
        Row: {
          id: string;
          name: string;
          role: string;
          category: string;
          display_order: number;
          image_url: string | null;
          thumbnail_url: string | null;
          year: string | null;
          college: string | null;
          major: string | null;
          minor: string | null;
          pronouns: string | null;
          favorite_snack: string | null;
          fun_fact: string | null;
          cabinet_year_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          role: string;
          category: string;
          display_order?: number;
          image_url?: string | null;
          thumbnail_url?: string | null;
          year?: string | null;
          college?: string | null;
          major?: string | null;
          minor?: string | null;
          pronouns?: string | null;
          favorite_snack?: string | null;
          fun_fact?: string | null;
          cabinet_year_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          role?: string;
          category?: string;
          display_order?: number;
          image_url?: string | null;
          thumbnail_url?: string | null;
          year?: string | null;
          college?: string | null;
          major?: string | null;
          minor?: string | null;
          pronouns?: string | null;
          favorite_snack?: string | null;
          fun_fact?: string | null;
          cabinet_year_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      chat_logs: {
        Row: {
          id: string;
          user_id: string;
          user_message: string;
          assistant_response: string;
          conversation_length: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          user_message: string;
          assistant_response: string;
          conversation_length?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          user_message?: string;
          assistant_response?: string;
          conversation_length?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      check_in_codes: {
        Row: {
          id: string;
          code: string;
          event_id: string | null;
          event_type: CheckInCodeEventType | null;
          points: number | null;
          is_used: boolean | null;
          used_by: string | null;
          used_at: string | null;
          created_by: string | null;
          created_at: string;
          expires_at: string | null;
        };
        Insert: {
          id?: string;
          code: string;
          event_id?: string | null;
          event_type?: CheckInCodeEventType | null;
          points?: number | null;
          is_used?: boolean | null;
          used_by?: string | null;
          used_at?: string | null;
          created_by?: string | null;
          created_at?: string;
          expires_at?: string | null;
        };
        Update: {
          id?: string;
          code?: string;
          event_id?: string | null;
          event_type?: CheckInCodeEventType | null;
          points?: number | null;
          is_used?: boolean | null;
          used_by?: string | null;
          used_at?: string | null;
          created_by?: string | null;
          created_at?: string;
          expires_at?: string | null;
        };
      };
      event_attendance: {
        Row: {
          id: string;
          event_id: string;
          user_id: string;
          points_earned: number;
          check_in_type: 'code' | 'manual';
          checked_in_by: string | null;
          checked_in_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          user_id: string;
          points_earned?: number;
          check_in_type?: 'code' | 'manual';
          checked_in_by?: string | null;
          checked_in_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          user_id?: string;
          points_earned?: number;
          check_in_type?: 'code' | 'manual';
          checked_in_by?: string | null;
          checked_in_at?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      event_recaps: {
        Row: {
          id: string;
          event_id: string;
          owner_names: string | null;
          cabinet_roles: string | null;
          attendance_notes: string | null;
          what_worked: string | null;
          what_failed: string | null;
          next_time_improvements: string | null;
          budget_notes: string | null;
          aftersocial_notes: string | null;
          risks_issues: string | null;
          drive_folder_url: string | null;
          planning_doc_url: string | null;
          gallery_event_id: string | null;
          public_highlight: string | null;
          is_public_highlight_published: boolean;
          created_by: string | null;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          owner_names?: string | null;
          cabinet_roles?: string | null;
          attendance_notes?: string | null;
          what_worked?: string | null;
          what_failed?: string | null;
          next_time_improvements?: string | null;
          budget_notes?: string | null;
          aftersocial_notes?: string | null;
          risks_issues?: string | null;
          drive_folder_url?: string | null;
          planning_doc_url?: string | null;
          gallery_event_id?: string | null;
          public_highlight?: string | null;
          is_public_highlight_published?: boolean;
          created_by?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          owner_names?: string | null;
          cabinet_roles?: string | null;
          attendance_notes?: string | null;
          what_worked?: string | null;
          what_failed?: string | null;
          next_time_improvements?: string | null;
          budget_notes?: string | null;
          aftersocial_notes?: string | null;
          risks_issues?: string | null;
          drive_folder_url?: string | null;
          planning_doc_url?: string | null;
          gallery_event_id?: string | null;
          public_highlight?: string | null;
          is_public_highlight_published?: boolean;
          created_by?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      events: {
        Row: {
          id: string;
          name: string;
          description: string;
          date: string;
          location: string;
          points: number;
          event_type: SiteEventType;
          check_in_form_url: string;
          image_url: string | null;
          thumbnail_url: string | null;
          is_code_expired: boolean;
          is_published: boolean;
          academic_term_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description: string;
          date: string;
          location: string;
          points?: number;
          event_type?: SiteEventType;
          check_in_form_url?: string;
          image_url?: string | null;
          thumbnail_url?: string | null;
          is_code_expired?: boolean;
          is_published?: boolean;
          academic_term_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string;
          date?: string;
          location?: string;
          points?: number;
          event_type?: SiteEventType;
          check_in_form_url?: string;
          image_url?: string | null;
          thumbnail_url?: string | null;
          is_code_expired?: boolean;
          is_published?: boolean;
          academic_term_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      event_check_in_secrets: {
        Row: {
          event_id: string;
          check_in_code: string;
          created_at: string;
        };
        Insert: {
          event_id: string;
          check_in_code: string;
          created_at?: string;
        };
        Update: {
          event_id?: string;
          check_in_code?: string;
          created_at?: string;
        };
      };
      feedback: {
        Row: {
          id: string;
          user_id: string | null;
          name: string | null;
          email: string | null;
          type: 'bug' | 'feature' | 'improvement' | 'event' | 'other';
          title: string;
          description: string;
          priority: 'low' | 'medium' | 'high';
          status: 'open' | 'pending' | 'in_progress' | 'closed';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          name?: string | null;
          email?: string | null;
          type: 'bug' | 'feature' | 'improvement' | 'event' | 'other';
          title: string;
          description: string;
          priority?: 'low' | 'medium' | 'high';
          status?: 'open' | 'pending' | 'in_progress' | 'closed';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          name?: string | null;
          email?: string | null;
          type?: 'bug' | 'feature' | 'improvement' | 'event' | 'other';
          title?: string;
          description?: string;
          priority?: 'low' | 'medium' | 'high';
          status?: 'open' | 'pending' | 'in_progress' | 'closed';
          created_at?: string;
          updated_at?: string;
        };
      };
      gallery_events: {
        Row: {
          id: string;
          name: string;
          title: string;
          description: string | null;
          date: string;
          images: string[];
          google_photos_url: string | null;
          cover_image_url: string | null;
          cover_thumbnail_url: string | null;
          event_id: string | null;
          created_at: string;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          title?: string;
          description?: string | null;
          date: string;
          images?: string[];
          google_photos_url?: string | null;
          cover_image_url?: string | null;
          cover_thumbnail_url?: string | null;
          event_id?: string | null;
          created_at?: string;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          title?: string;
          description?: string | null;
          date?: string;
          images?: string[];
          google_photos_url?: string | null;
          cover_image_url?: string | null;
          cover_thumbnail_url?: string | null;
          event_id?: string | null;
          created_at?: string;
          updated_at?: string | null;
        };
      };
      vcn_archives: {
        Row: {
          id: string;
          year: number;
          title: string | null;
          annual_number: string | null;
          theme_name: string | null;
          event_date: string | null;
          event_time: string | null;
          venue: string | null;
          description: string | null;
          video_url: string | null;
          photo_album_url: string | null;
          album_source: string | null;
          cover_image_url: string | null;
          cover_thumbnail_url: string | null;
          poster_url: string | null;
          trailer_url: string | null;
          photo_credit: string | null;
          is_published: boolean;
          is_featured: boolean;
          is_current: boolean;
          ticket_status: ProgramContentStatus;
          ticket_url: string | null;
          ticket_note: string | null;
          display_order: number;
          source_doc_url: string | null;
          internal_notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          year: number;
          title?: string | null;
          annual_number?: string | null;
          theme_name?: string | null;
          event_date?: string | null;
          event_time?: string | null;
          venue?: string | null;
          description?: string | null;
          video_url?: string | null;
          photo_album_url?: string | null;
          album_source?: string | null;
          cover_image_url?: string | null;
          cover_thumbnail_url?: string | null;
          poster_url?: string | null;
          trailer_url?: string | null;
          photo_credit?: string | null;
          is_published?: boolean;
          is_featured?: boolean;
          is_current?: boolean;
          ticket_status?: ProgramContentStatus;
          ticket_url?: string | null;
          ticket_note?: string | null;
          display_order?: number;
          source_doc_url?: string | null;
          internal_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          year?: number;
          title?: string | null;
          annual_number?: string | null;
          theme_name?: string | null;
          event_date?: string | null;
          event_time?: string | null;
          venue?: string | null;
          description?: string | null;
          video_url?: string | null;
          photo_album_url?: string | null;
          album_source?: string | null;
          cover_image_url?: string | null;
          cover_thumbnail_url?: string | null;
          poster_url?: string | null;
          trailer_url?: string | null;
          photo_credit?: string | null;
          is_published?: boolean;
          is_featured?: boolean;
          is_current?: boolean;
          ticket_status?: ProgramContentStatus;
          ticket_url?: string | null;
          ticket_note?: string | null;
          display_order?: number;
          source_doc_url?: string | null;
          internal_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      program_content: {
        Row: {
          id: string;
          page_key: ProgramPageKey;
          section_key: ProgramSectionKey;
          title: string | null;
          body: string | null;
          status: ProgramContentStatus;
          primary_link_label: string | null;
          primary_link_url: string | null;
          secondary_link_label: string | null;
          secondary_link_url: string | null;
          open_at: string | null;
          close_at: string | null;
          deadline_at: string | null;
          event_date: string | null;
          venue: string | null;
          is_published: boolean;
          display_order: number;
          source_doc_url: string | null;
          internal_notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          page_key: ProgramPageKey;
          section_key?: ProgramSectionKey;
          title?: string | null;
          body?: string | null;
          status?: ProgramContentStatus;
          primary_link_label?: string | null;
          primary_link_url?: string | null;
          secondary_link_label?: string | null;
          secondary_link_url?: string | null;
          open_at?: string | null;
          close_at?: string | null;
          deadline_at?: string | null;
          event_date?: string | null;
          venue?: string | null;
          is_published?: boolean;
          display_order?: number;
          source_doc_url?: string | null;
          internal_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          page_key?: ProgramPageKey;
          section_key?: ProgramSectionKey;
          title?: string | null;
          body?: string | null;
          status?: ProgramContentStatus;
          primary_link_label?: string | null;
          primary_link_url?: string | null;
          secondary_link_label?: string | null;
          secondary_link_url?: string | null;
          open_at?: string | null;
          close_at?: string | null;
          deadline_at?: string | null;
          event_date?: string | null;
          venue?: string | null;
          is_published?: boolean;
          display_order?: number;
          source_doc_url?: string | null;
          internal_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      data_rights_requests: {
        Row: {
          id: string;
          request_type: DataRightsRequestType;
          status: DataRightsRequestStatus;
          subject_auth_user_id: string | null;
          subject_member_id: string | null;
          subject_display_name: string | null;
          contact_channel: string | null;
          contact_reference: string | null;
          verification_status: DataRightsVerificationStatus;
          verification_method: string | null;
          assigned_to: string | null;
          reviewer_id: string | null;
          priority: DataRightsRequestPriority;
          summary: string | null;
          internal_notes: string | null;
          decision: string | null;
          completed_at: string | null;
          created_by: string | null;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          request_type: DataRightsRequestType;
          status?: DataRightsRequestStatus;
          subject_auth_user_id?: string | null;
          subject_member_id?: string | null;
          subject_display_name?: string | null;
          contact_channel?: string | null;
          contact_reference?: string | null;
          verification_status?: DataRightsVerificationStatus;
          verification_method?: string | null;
          assigned_to?: string | null;
          reviewer_id?: string | null;
          priority?: DataRightsRequestPriority;
          summary?: string | null;
          internal_notes?: string | null;
          decision?: string | null;
          completed_at?: string | null;
          created_by?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          request_type?: DataRightsRequestType;
          status?: DataRightsRequestStatus;
          subject_auth_user_id?: string | null;
          subject_member_id?: string | null;
          subject_display_name?: string | null;
          contact_channel?: string | null;
          contact_reference?: string | null;
          verification_status?: DataRightsVerificationStatus;
          verification_method?: string | null;
          assigned_to?: string | null;
          reviewer_id?: string | null;
          priority?: DataRightsRequestPriority;
          summary?: string | null;
          internal_notes?: string | null;
          decision?: string | null;
          completed_at?: string | null;
          created_by?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      data_rights_request_events: {
        Row: {
          id: string;
          request_id: string;
          event_type: DataRightsRequestEventType;
          event_summary: string;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          request_id: string;
          event_type: DataRightsRequestEventType;
          event_summary: string;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          request_id?: string;
          event_type?: DataRightsRequestEventType;
          event_summary?: string;
          created_by?: string | null;
          created_at?: string;
        };
      };
      application_links: {
        Row: {
          id: string;
          application_key: ApplicationKey;
          title: string;
          description: string | null;
          button_label: string;
          target_url: string;
          open_at: string;
          due_at: string;
          is_enabled: boolean;
          before_open_message: string | null;
          after_close_message: string | null;
          sort_order: number;
          created_by: string | null;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          application_key: ApplicationKey;
          title: string;
          description?: string | null;
          button_label: string;
          target_url: string;
          open_at: string;
          due_at: string;
          is_enabled?: boolean;
          before_open_message?: string | null;
          after_close_message?: string | null;
          sort_order?: number;
          created_by?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          application_key?: ApplicationKey;
          title?: string;
          description?: string | null;
          button_label?: string;
          target_url?: string;
          open_at?: string;
          due_at?: string;
          is_enabled?: boolean;
          before_open_message?: string | null;
          after_close_message?: string | null;
          sort_order?: number;
          created_by?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      resource_links: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          url: string;
          category: string;
          role: string | null;
          program: string | null;
          workflow: string | null;
          academic_year_start: number | null;
          academic_year_end: number | null;
          is_current: boolean;
          is_archived: boolean;
          visibility: ResourceLinkVisibility;
          owner_role: string | null;
          last_verified_at: string | null;
          created_by: string | null;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          description?: string | null;
          url: string;
          category: string;
          role?: string | null;
          program?: string | null;
          workflow?: string | null;
          academic_year_start?: number | null;
          academic_year_end?: number | null;
          is_current?: boolean;
          is_archived?: boolean;
          visibility?: ResourceLinkVisibility;
          owner_role?: string | null;
          last_verified_at?: string | null;
          created_by?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          description?: string | null;
          url?: string;
          category?: string;
          role?: string | null;
          program?: string | null;
          workflow?: string | null;
          academic_year_start?: number | null;
          academic_year_end?: number | null;
          is_current?: boolean;
          is_archived?: boolean;
          visibility?: ResourceLinkVisibility;
          owner_role?: string | null;
          last_verified_at?: string | null;
          created_by?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      ace_families: {
        Row: {
          id: string;
          academic_year_start: number | null;
          academic_year_end: number | null;
          name: string;
          slug: string;
          cover_image_url: string | null;
          theme_color: string | null;
          description: string | null;
          display_order: number;
          is_published: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          academic_year_start?: number | null;
          academic_year_end?: number | null;
          name: string;
          slug: string;
          cover_image_url?: string | null;
          theme_color?: string | null;
          description?: string | null;
          display_order?: number;
          is_published?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          academic_year_start?: number | null;
          academic_year_end?: number | null;
          name?: string;
          slug?: string;
          cover_image_url?: string | null;
          theme_color?: string | null;
          description?: string | null;
          display_order?: number;
          is_published?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      ace_family_members: {
        Row: {
          id: string;
          family_id: string;
          name: string;
          role_label: string | null;
          photo_url: string | null;
          parent_member_id: string | null;
          display_order: number;
          is_published: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          family_id: string;
          name: string;
          role_label?: string | null;
          photo_url?: string | null;
          parent_member_id?: string | null;
          display_order?: number;
          is_published?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          family_id?: string;
          name?: string;
          role_label?: string | null;
          photo_url?: string | null;
          parent_member_id?: string | null;
          display_order?: number;
          is_published?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      house_page_assets: {
        Row: {
          id: string;
          academic_year_start: number;
          academic_year_end: number;
          house: string;
          house_key: string;
          display_name: string;
          description: string | null;
          image_url: string | null;
          image_thumbnail_url: string | null;
          image_alt: string | null;
          cover_image_url: string | null;
          accent_color: string | null;
          emoji: string | null;
          display_order: number;
          is_active: boolean;
          house_parent_image_url: string | null;
          house_parent_heading: string | null;
          house_parent_body: string | null;
          source_doc_url: string | null;
          internal_notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          academic_year_start: number;
          academic_year_end: number;
          house: string;
          house_key?: string;
          display_name?: string;
          description?: string | null;
          image_url?: string | null;
          image_thumbnail_url?: string | null;
          image_alt?: string | null;
          cover_image_url?: string | null;
          accent_color?: string | null;
          display_order?: number;
          is_active?: boolean;
          house_parent_image_url?: string | null;
          house_parent_heading?: string | null;
          house_parent_body?: string | null;
          source_doc_url?: string | null;
          internal_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          academic_year_start?: number;
          academic_year_end?: number;
          house?: string;
          house_key?: string;
          display_name?: string;
          description?: string | null;
          image_url?: string | null;
          image_thumbnail_url?: string | null;
          image_alt?: string | null;
          cover_image_url?: string | null;
          accent_color?: string | null;
          display_order?: number;
          is_active?: boolean;
          house_parent_image_url?: string | null;
          house_parent_heading?: string | null;
          house_parent_body?: string | null;
          source_doc_url?: string | null;
          internal_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      house_memberships: {
        Row: {
          id: string;
          member_id: string;
          house_profile_id: string;
          academic_year_start: number;
          academic_year_end: number;
          effective_start_date: string;
          effective_end_date: string | null;
          source: string | null;
          source_import_id: string | null;
          notes: string | null;
          created_by: string | null;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          member_id: string;
          house_profile_id: string;
          academic_year_start: number;
          academic_year_end: number;
          effective_start_date: string;
          effective_end_date?: string | null;
          source?: string | null;
          source_import_id?: string | null;
          notes?: string | null;
          created_by?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          member_id?: string;
          house_profile_id?: string;
          academic_year_start?: number;
          academic_year_end?: number;
          effective_start_date?: string;
          effective_end_date?: string | null;
          source?: string | null;
          source_import_id?: string | null;
          notes?: string | null;
          created_by?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      house_events: {
        Row: {
          id: string;
          house_profile_id: string;
          academic_year_start: number;
          academic_year_end: number;
          title: string;
          slug: string | null;
          description: string | null;
          event_date: string;
          start_time: string | null;
          end_time: string | null;
          location: string | null;
          image_url: string | null;
          image_thumbnail_url: string | null;
          gallery_url: string | null;
          recap_url: string | null;
          rsvp_url: string | null;
          google_calendar_enabled: boolean;
          is_published: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          house_profile_id: string;
          academic_year_start: number;
          academic_year_end: number;
          title: string;
          slug?: string | null;
          description?: string | null;
          event_date: string;
          start_time?: string | null;
          end_time?: string | null;
          location?: string | null;
          image_url?: string | null;
          image_thumbnail_url?: string | null;
          gallery_url?: string | null;
          recap_url?: string | null;
          rsvp_url?: string | null;
          google_calendar_enabled?: boolean;
          is_published?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          house_profile_id?: string;
          academic_year_start?: number;
          academic_year_end?: number;
          title?: string;
          slug?: string | null;
          description?: string | null;
          event_date?: string;
          start_time?: string | null;
          end_time?: string | null;
          location?: string | null;
          image_url?: string | null;
          image_thumbnail_url?: string | null;
          gallery_url?: string | null;
          recap_url?: string | null;
          rsvp_url?: string | null;
          google_calendar_enabled?: boolean;
          is_published?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      homepage_content: {
        Row: {
          id: string;
          presidents_names: string;
          presidents_role: string;
          presidents_message: string;
          presidents_photo_url: string | null;
          presidents_photo_thumbnail_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          presidents_names: string;
          presidents_role: string;
          presidents_message: string;
          presidents_photo_url?: string | null;
          presidents_photo_thumbnail_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          presidents_names?: string;
          presidents_role?: string;
          presidents_message?: string;
          presidents_photo_url?: string | null;
          presidents_photo_thumbnail_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      import_jobs: {
        Row: {
          id: string;
          event_id: string | null;
          source_url: string | null;
          source_type: ImportSourceType;
          total_rows: number;
          matched_rows: number;
          created_members: number;
          created_attendance_count: number;
          skipped_duplicate_rows: number;
          review_rows: number;
          error_count: number;
          error_message: string | null;
          created_by: string | null;
          created_at: string;
          completed_at: string | null;
          status: ImportJobStatus;
        };
        Insert: {
          id?: string;
          event_id?: string | null;
          source_url?: string | null;
          source_type?: ImportSourceType;
          total_rows?: number;
          matched_rows?: number;
          created_members?: number;
          created_attendance_count?: number;
          skipped_duplicate_rows?: number;
          review_rows?: number;
          error_count?: number;
          error_message?: string | null;
          created_by?: string | null;
          created_at?: string;
          completed_at?: string | null;
          status?: ImportJobStatus;
        };
        Update: {
          id?: string;
          event_id?: string | null;
          source_url?: string | null;
          source_type?: ImportSourceType;
          total_rows?: number;
          matched_rows?: number;
          created_members?: number;
          created_attendance_count?: number;
          skipped_duplicate_rows?: number;
          review_rows?: number;
          error_count?: number;
          error_message?: string | null;
          created_by?: string | null;
          created_at?: string;
          completed_at?: string | null;
          status?: ImportJobStatus;
        };
      };
      import_job_rows: {
        Row: {
          id: string;
          import_job_id: string;
          source_row_index: number;
          raw_row: Json;
          display_name: string | null;
          csv_email: string | null;
          csv_college: string | null;
          csv_year: string | null;
          matched_member_id: string | null;
          created_member_id: string | null;
          event_id: string | null;
          attendance_member_id: string | null;
          points_earned: number | null;
          decision: ImportRowDecision;
          status: ImportRowStatus;
          score: number | null;
          match_details: Json;
          error_message: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          import_job_id: string;
          source_row_index: number;
          raw_row?: Json;
          display_name?: string | null;
          csv_email?: string | null;
          csv_college?: string | null;
          csv_year?: string | null;
          matched_member_id?: string | null;
          created_member_id?: string | null;
          event_id?: string | null;
          attendance_member_id?: string | null;
          points_earned?: number | null;
          decision: ImportRowDecision;
          status?: ImportRowStatus;
          score?: number | null;
          match_details?: Json;
          error_message?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          import_job_id?: string;
          source_row_index?: number;
          raw_row?: Json;
          display_name?: string | null;
          csv_email?: string | null;
          csv_college?: string | null;
          csv_year?: string | null;
          matched_member_id?: string | null;
          created_member_id?: string | null;
          event_id?: string | null;
          attendance_member_id?: string | null;
          points_earned?: number | null;
          decision?: ImportRowDecision;
          status?: ImportRowStatus;
          score?: number | null;
          match_details?: Json;
          error_message?: string | null;
          created_at?: string;
        };
      };
      member_event_attendance: {
        Row: {
          id: string;
          member_id: string;
          event_id: string;
          points_earned: number;
          imported_at: string;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          member_id: string;
          event_id: string;
          points_earned?: number;
          imported_at?: string;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          member_id?: string;
          event_id?: string;
          points_earned?: number;
          imported_at?: string;
          created_at?: string | null;
        };
      };
      members: {
        Row: {
          id: string;
          first_name: string;
          last_name: string;
          college: string | null;
          year: string | null;
          house: string | null;
          email: string | null;
          points: number;
          events_attended: number;
          user_id: string | null;
          needs_review: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          first_name: string;
          last_name: string;
          college?: string | null;
          year?: string | null;
          house?: string | null;
          email?: string | null;
          points?: number;
          events_attended?: number;
          user_id?: string | null;
          needs_review?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          first_name?: string;
          last_name?: string;
          college?: string | null;
          year?: string | null;
          house?: string | null;
          email?: string | null;
          points?: number;
          events_attended?: number;
          user_id?: string | null;
          needs_review?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      merge_exclusions: {
        Row: {
          target_id: string;
          source_id: string;
          created_at: string;
        };
        Insert: {
          target_id: string;
          source_id: string;
          created_at?: string;
        };
        Update: {
          target_id?: string;
          source_id?: string;
          created_at?: string;
        };
      };
      site_settings: {
        Row: {
          id: string;
          logo_url: string | null;
          logo_alt: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          logo_url?: string | null;
          logo_alt?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          logo_url?: string | null;
          logo_alt?: string;
          updated_at?: string;
        };
      };
      user_points: {
        Row: {
          id: string;
          user_id: string;
          total_points: number;
          points: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          total_points?: number;
          points?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          total_points?: number;
          points?: number | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      user_profiles: {
        Row: {
          id: string;
          email: string;
          first_name: string;
          last_name: string;
          is_admin: boolean;
          avatar_url: string | null;
          college: string | null;
          year: string | null;
          discord_user_id: string | null;
          discord_username: string | null;
          discord_avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          first_name?: string;
          last_name?: string;
          is_admin?: boolean;
          avatar_url?: string | null;
          college?: string | null;
          year?: string | null;
          discord_user_id?: string | null;
          discord_username?: string | null;
          discord_avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          first_name?: string;
          last_name?: string;
          is_admin?: boolean;
          avatar_url?: string | null;
          college?: string | null;
          year?: string | null;
          discord_user_id?: string | null;
          discord_username?: string | null;
          discord_avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Views: {
      public_application_links: {
        Row: {
          id: string;
          application_key: ApplicationKey;
          title: string;
          description: string | null;
          button_label: string;
          target_url: string | null;
          status: ApplicationStatus;
          open_at: string;
          due_at: string;
          is_enabled: boolean;
          before_open_message: string | null;
          after_close_message: string | null;
          sort_order: number;
          updated_at: string;
        };
      };
      published_ace_families: {
        Row: {
          id: string;
          academic_year_start: number | null;
          academic_year_end: number | null;
          name: string;
          slug: string;
          cover_image_url: string | null;
          theme_color: string | null;
          description: string | null;
          display_order: number;
          created_at: string;
          updated_at: string;
        };
      };
      published_ace_family_members: {
        Row: {
          id: string;
          family_id: string;
          name: string;
          role_label: string | null;
          photo_url: string | null;
          parent_member_id: string | null;
          display_order: number;
          created_at: string;
          updated_at: string;
        };
      };
      published_house_page_assets: {
        Row: {
          id: string;
          academic_year_start: number;
          academic_year_end: number;
          house: string;
          house_key: string;
          display_name: string;
          description: string | null;
          image_url: string | null;
          image_thumbnail_url: string | null;
          image_alt: string | null;
          cover_image_url: string | null;
          accent_color: string | null;
          emoji: string | null;
          display_order: number;
          is_active: boolean;
          house_parent_image_url: string | null;
          house_parent_heading: string | null;
          house_parent_body: string | null;
          created_at: string;
          updated_at: string;
        };
      };
      published_vcn_archives: {
        Row: {
          id: string;
          year: number;
          title: string | null;
          annual_number: string | null;
          theme_name: string | null;
          event_date: string | null;
          event_time: string | null;
          venue: string | null;
          description: string | null;
          video_url: string | null;
          photo_album_url: string | null;
          album_source: string | null;
          cover_image_url: string | null;
          cover_thumbnail_url: string | null;
          poster_url: string | null;
          trailer_url: string | null;
          photo_credit: string | null;
          is_published: boolean;
          is_featured: boolean;
          is_current: boolean;
          ticket_status: ProgramContentStatus;
          ticket_url: string | null;
          ticket_note: string | null;
          display_order: number;
          created_at: string;
          updated_at: string;
        };
      };
      member_yearly_points: {
        Row: {
          member_id: string;
          first_name: string;
          last_name: string;
          college: string | null;
          graduation_year: string | null;
          user_id: string | null;
          academic_year_start: number;
          academic_year_end: number;
          total_points: number;
          events_attended: number;
        };
      };
      house_yearly_points: {
        Row: {
          house: string;
          house_profile_id: string;
          display_name: string;
          image_url: string | null;
          accent_color: string | null;
          academic_year_start: number;
          academic_year_end: number;
          total_points: number;
          events_attended: number;
          unique_events: number;
          unique_members: number;
          average_points_per_member: number | null;
          latest_activity_at: string | null;
        };
      };
      house_all_time_points: {
        Row: {
          house: string;
          house_profile_id: string;
          display_name: string;
          image_url: string | null;
          accent_color: string | null;
          academic_year_start: number;
          academic_year_end: number;
          total_points: number;
          events_attended: number;
          unique_events: number;
          unique_members: number;
          average_points_per_member: number | null;
          latest_activity_at: string | null;
        };
      };
      house_recent_activity: {
        Row: {
          house: string;
          house_profile_id: string;
          display_name: string;
          image_url: string | null;
          accent_color: string | null;
          event_id: string;
          event_name: string;
          event_date: string;
          academic_year_start: number;
          academic_year_end: number;
          total_points: number;
          contributing_members: number;
          latest_activity_at: string | null;
        };
      };
    };
    Functions: {
      create_events_table: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      get_event_points: {
        Args: {
          event_type: CheckInCodeEventType;
        };
        Returns: number;
      };
      get_data_rights_dependency_preview: {
        Args: {
          p_request_id: string;
        };
        Returns: Json;
      };
      generate_data_rights_export: {
        Args: {
          p_request_id: string;
        };
        Returns: Json;
      };
      preview_data_rights_anonymization: {
        Args: {
          p_request_id: string;
          p_subject_auth_user_id: string | null;
          p_subject_member_id: string | null;
        };
        Returns: Json;
      };
      anonymize_data_rights_subject: {
        Args: {
          p_request_id: string;
          p_subject_auth_user_id: string | null;
          p_subject_member_id: string | null;
        };
        Returns: Json;
      };
      smart_merge_members: {
        Args: {
          p_source_id: string;
          p_target_id: string;
        };
        Returns: void;
      };
    };
    Enums: {
      [_ in never]: never;
    };
  };
}
