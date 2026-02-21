export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          email: string | null;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          stripe_price_id: string | null;
          subscription_status: string | null;
          current_period_end: string | null;
          role: 'user' | 'admin' | 'super_admin';
          created_at: string;
          updated_at: string;
          is_active: boolean;
        };
        Insert: {
          id?: string;
          full_name?: string | null;
          email?: string | null;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          stripe_price_id?: string | null;
          subscription_status?: string | null;
          current_period_end?: string | null;
          role?: 'user' | 'admin' | 'super_admin';
          created_at?: string;
          updated_at?: string;
          is_active?: boolean;
        };
        Update: {
          id?: string;
          full_name?: string | null;
          email?: string | null;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          stripe_price_id?: string | null;
          subscription_status?: string | null;
          current_period_end?: string | null;
          role?: 'user' | 'admin' | 'super_admin';
          created_at?: string;
          updated_at?: string;
          is_active?: boolean;
        };
        Relationships: [];
      };
      universities: {
        Row: {
          id: string;
          name: string;
          short_name: string;
          logo_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          short_name: string;
          logo_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          short_name?: string;
          logo_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      courses: {
        Row: {
          id: string;
          university_id: string;
          code: string;
          name: string;
          created_at: string;
          updated_at: string;
          knowledge_outline: Json | null;
        };
        Insert: {
          id?: string;
          university_id: string;
          code: string;
          name: string;
          created_at?: string;
          updated_at?: string;
          knowledge_outline?: Json | null;
        };
        Update: {
          id?: string;
          university_id?: string;
          code?: string;
          name?: string;
          created_at?: string;
          updated_at?: string;
          knowledge_outline?: Json | null;
        };
        Relationships: [];
      };
      chat_sessions: {
        Row: {
          id: string;
          user_id: string;
          course_id: string | null;
          mode: string | null;
          title: string;
          is_pinned: boolean;
          is_shared: boolean;
          share_expires_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          course_id?: string | null;
          mode?: string | null;
          title: string;
          is_pinned?: boolean;
          is_shared?: boolean;
          share_expires_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          course_id?: string | null;
          mode?: string | null;
          title?: string;
          is_pinned?: boolean;
          is_shared?: boolean;
          share_expires_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      chat_messages: {
        Row: {
          id: string;
          session_id: string;
          role: 'user' | 'assistant';
          content: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          role: 'user' | 'assistant';
          content: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          session_id?: string;
          role?: 'user' | 'assistant';
          content?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      knowledge_cards: {
        Row: {
          id: string;
          title: string;
          definition: string;
          key_formulas: string[];
          key_concepts: string[];
          examples: string[];
          source_pages: number[];
          embedding: number[] | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          definition: string;
          key_formulas?: string[];
          key_concepts?: string[];
          examples?: string[];
          source_pages?: number[];
          embedding?: number[] | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          definition?: string;
          key_formulas?: string[];
          key_concepts?: string[];
          examples?: string[];
          source_pages?: number[];
          embedding?: number[] | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_cards: {
        Row: {
          id: string;
          user_id: string;
          session_id: string | null;
          title: string;
          content: string;
          excerpt: string;
          source_message_id: string | null;
          source_role: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          session_id?: string | null;
          title: string;
          content?: string;
          excerpt?: string;
          source_message_id?: string | null;
          source_role?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          session_id?: string | null;
          title?: string;
          content?: string;
          excerpt?: string;
          source_message_id?: string | null;
          source_role?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      card_conversations: {
        Row: {
          id: string;
          card_id: string;
          card_type: 'knowledge' | 'user';
          user_id: string;
          session_id: string | null;
          course_code: string | null;
          role: 'user' | 'assistant';
          content: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          card_id: string;
          card_type: 'knowledge' | 'user';
          user_id: string;
          session_id?: string | null;
          course_code?: string | null;
          role: 'user' | 'assistant';
          content: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          card_id?: string;
          card_type?: 'knowledge' | 'user';
          user_id?: string;
          session_id?: string | null;
          course_code?: string | null;
          role?: 'user' | 'assistant';
          content?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      lecture_documents: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          status: 'draft' | 'ready';
          course_id: string | null;
          created_at: string;
          metadata: Json;
          outline: Json | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          status?: 'draft' | 'ready';
          course_id?: string | null;
          created_at?: string;
          metadata?: Json;
          outline?: Json | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          status?: 'draft' | 'ready';
          course_id?: string | null;
          created_at?: string;
          metadata?: Json;
          outline?: Json | null;
        };
        Relationships: [];
      };
      lecture_chunks: {
        Row: {
          id: string;
          lecture_document_id: string;
          content: string;
          embedding: number[] | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          lecture_document_id: string;
          content: string;
          embedding?: number[] | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          lecture_document_id?: string;
          content?: string;
          embedding?: number[] | null;
          metadata?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      exam_papers: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          visibility: 'public' | 'private';
          school: string | null;
          course: string | null;
          course_id: string | null;
          year: string | null;
          question_types: string[];
          status: 'draft' | 'ready';
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          visibility?: 'public' | 'private';
          school?: string | null;
          course?: string | null;
          course_id?: string | null;
          year?: string | null;
          question_types?: string[];
          status?: 'draft' | 'ready';
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          visibility?: 'public' | 'private';
          school?: string | null;
          course?: string | null;
          course_id?: string | null;
          year?: string | null;
          question_types?: string[];
          status?: 'draft' | 'ready';
          created_at?: string;
        };
        Relationships: [];
      };
      exam_questions: {
        Row: {
          id: string;
          paper_id: string;
          order_num: number;
          type: string;
          content: string;
          options: Json;
          answer: string;
          explanation: string;
          points: number;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          paper_id: string;
          order_num: number;
          type: string;
          content: string;
          options?: Json;
          answer: string;
          explanation: string;
          points?: number;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          paper_id?: string;
          order_num?: number;
          type?: string;
          content?: string;
          options?: Json;
          answer?: string;
          explanation?: string;
          points?: number;
          metadata?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      mock_exams: {
        Row: {
          id: string;
          user_id: string;
          paper_id: string;
          session_id: string | null;
          title: string;
          questions: Json;
          responses: Json;
          score: number | null;
          total_points: number;
          current_index: number;
          status: 'in_progress' | 'completed';
          mode: 'practice' | 'exam';
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          paper_id: string;
          session_id?: string | null;
          title: string;
          mode?: 'practice' | 'exam';
          questions?: Json;
          responses?: Json;
          score?: number | null;
          total_points?: number;
          current_index?: number;
          status?: 'in_progress' | 'completed';
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          paper_id?: string;
          session_id?: string | null;
          title?: string;
          mode?: 'practice' | 'exam';
          questions?: Json;
          responses?: Json;
          score?: number | null;
          total_points?: number;
          current_index?: number;
          status?: 'in_progress' | 'completed';
          created_at?: string;
        };
        Relationships: [];
      };
      assignments: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          school: string | null;
          course: string | null;
          course_id: string | null;
          status: 'draft' | 'ready';
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          school?: string | null;
          course?: string | null;
          course_id?: string | null;
          status?: 'draft' | 'ready';
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          school?: string | null;
          course?: string | null;
          course_id?: string | null;
          status?: 'draft' | 'ready';
          created_at?: string;
        };
        Relationships: [];
      };
      admin_course_assignments: {
        Row: {
          id: string;
          admin_id: string;
          course_id: string;
          assigned_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          admin_id: string;
          course_id: string;
          assigned_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          admin_id?: string;
          course_id?: string;
          assigned_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      assignment_items: {
        Row: {
          id: string;
          assignment_id: string;
          order_num: number;
          type: string;
          content: string;
          reference_answer: string;
          explanation: string;
          points: number;
          difficulty: string;
          metadata: Json;
          embedding: number[] | null;
          created_at: string;
          parent_item_id: string | null;
        };
        Insert: {
          id?: string;
          assignment_id: string;
          order_num: number;
          type?: string;
          content: string;
          reference_answer?: string;
          explanation?: string;
          points?: number;
          difficulty?: string;
          metadata?: Json;
          embedding?: number[] | null;
          created_at?: string;
          parent_item_id?: string | null;
        };
        Update: {
          id?: string;
          assignment_id?: string;
          order_num?: number;
          type?: string;
          content?: string;
          reference_answer?: string;
          explanation?: string;
          points?: number;
          difficulty?: string;
          metadata?: Json;
          embedding?: number[] | null;
          created_at?: string;
          parent_item_id?: string | null;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      match_knowledge_cards: {
        Args: {
          query_embedding: number[];
          match_count: number;
        };
        Returns: {
          id: string;
          title: string;
          definition: string;
          key_formulas: string[];
          key_concepts: string[];
          examples: string[];
          source_pages: number[];
          created_at: string;
          updated_at: string;
          similarity: number;
        }[];
      };
      match_assignment_items: {
        Args: {
          query_embedding: number[];
          match_count?: number;
          filter_course_id?: string | null;
        };
        Returns: {
          id: string;
          assignment_id: string;
          order_num: number;
          content: string;
          reference_answer: string;
          explanation: string;
          points: number;
          difficulty: string;
          similarity: number;
        }[];
      };
      set_admin_courses: {
        Args: {
          p_admin_id: string;
          p_course_ids: string[];
          p_assigned_by: string;
        };
        Returns: undefined;
      };
      hybrid_search: {
        Args: {
          query_text: string;
          query_embedding: number[];
          match_threshold: number;
          match_count: number;
          rrf_k?: number;
          search_course_id?: string | null;
          filter?: Json;
        };
        Returns: {
          id: string;
          content: string;
          similarity: number;
          metadata: Json;
        }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
