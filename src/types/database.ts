export interface Database {
  public: {
    Tables: {
      events: {
        Row: {
          id: string;
          name: string;
          description: string;
          date: string;
          location: string;
          points: number;
          event_type: 'gbm' | 'mixer' | 'winter_retreat' | 'vcn' | 'wildn_culture' | 'external_event' | 'other';
          check_in_form_url: string;
          image_url?: string;
          check_in_code?: string;
          is_code_expired: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description: string;
          date: string;
          location: string;
          points: number;
          event_type: 'gbm' | 'mixer' | 'winter_retreat' | 'vcn' | 'wildn_culture' | 'external_event' | 'other';
          check_in_form_url: string;
          image_url?: string;
          check_in_code?: string;
          is_code_expired?: boolean;
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
          event_type?: 'gbm' | 'mixer' | 'winter_retreat' | 'vcn' | 'wildn_culture' | 'external_event' | 'other';
          check_in_form_url?: string;
          image_url?: string;
          check_in_code?: string;
          is_code_expired?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      event_attendance: {
        Row: {
          id: string;
          event_id: string;
          user_id: string;
          points_earned: number;
          check_in_type: 'code' | 'manual';
          checked_in_by?: string;
          checked_in_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          user_id: string;
          points_earned: number;
          check_in_type: 'code' | 'manual';
          checked_in_by?: string;
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
          checked_in_by?: string;
          checked_in_at?: string;
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
          avatar_url?: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          first_name: string;
          last_name: string;
          is_admin?: boolean;
          avatar_url?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          first_name?: string;
          last_name?: string;
          is_admin?: boolean;
          avatar_url?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      user_points: {
        Row: {
          id: string;
          user_id: string;
          total_points: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          total_points?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          total_points?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      feedback: {
        Row: {
          id: string;
          user_id: string;
          type: 'bug' | 'feature' | 'improvement' | 'event' | 'other';
          title: string;
          description: string;
          priority: 'low' | 'medium' | 'high';
          status: 'open' | 'in_progress' | 'closed';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: 'bug' | 'feature' | 'improvement' | 'event' | 'other';
          title: string;
          description: string;
          priority?: 'low' | 'medium' | 'high';
          status?: 'open' | 'in_progress' | 'closed';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          type?: 'bug' | 'feature' | 'improvement' | 'event' | 'other';
          title?: string;
          description?: string;
          priority?: 'low' | 'medium' | 'high';
          status?: 'open' | 'in_progress' | 'closed';
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
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
  };
}
