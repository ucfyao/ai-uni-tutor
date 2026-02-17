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
          role: string;
          created_at: string;
          updated_at: string;
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
          role?: string;
          created_at?: string;
          updated_at?: string;
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
          role?: string;
          created_at?: string;
          updated_at?: string;
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
        };
        Insert: {
          id?: string;
          university_id: string;
          code: string;
          name: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          university_id?: string;
          code?: string;
          name?: string;
          created_at?: string;
          updated_at?: string;
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
          document_id: string | null;
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
          document_id?: string | null;
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
          document_id?: string | null;
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
      documents: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          status: 'processing' | 'ready' | 'error';
          status_message: string | null;
          doc_type: 'lecture' | 'exam' | 'assignment';
          course_id: string | null;
          created_at: string;
          metadata: Json;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          status?: 'processing' | 'ready' | 'error';
          status_message?: string | null;
          doc_type?: 'lecture' | 'exam' | 'assignment';
          course_id?: string | null;
          created_at?: string;
          metadata?: Json;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          status?: 'processing' | 'ready' | 'error';
          status_message?: string | null;
          doc_type?: 'lecture' | 'exam' | 'assignment';
          course_id?: string | null;
          created_at?: string;
          metadata?: Json;
        };
        Relationships: [];
      };
      document_chunks: {
        Row: {
          id: string;
          document_id: string;
          content: string;
          embedding: number[] | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          document_id: string;
          content: string;
          embedding?: number[] | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          document_id?: string;
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
          document_id: string | null;
          title: string;
          visibility: 'public' | 'private';
          school: string | null;
          course: string | null;
          year: string | null;
          question_types: string[];
          status: 'parsing' | 'ready' | 'error';
          status_message: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          document_id?: string | null;
          title: string;
          visibility?: 'public' | 'private';
          school?: string | null;
          course?: string | null;
          year?: string | null;
          question_types?: string[];
          status?: 'parsing' | 'ready' | 'error';
          status_message?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          document_id?: string | null;
          title?: string;
          visibility?: 'public' | 'private';
          school?: string | null;
          course?: string | null;
          year?: string | null;
          question_types?: string[];
          status?: 'parsing' | 'ready' | 'error';
          status_message?: string | null;
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
          status: string;
          status_message: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          school?: string | null;
          course?: string | null;
          status?: string;
          status_message?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          school?: string | null;
          course?: string | null;
          status?: string;
          status_message?: string | null;
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
          created_at: string;
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
          created_at?: string;
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
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      match_documents: {
        Args: {
          query_embedding: number[];
          match_threshold: number;
          match_count: number;
          filter?: Json;
        };
        Returns: {
          id: string;
          content: string;
          similarity: number;
          metadata: Json;
        }[];
      };
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
          document_id: string | null;
          created_at: string;
          updated_at: string;
          similarity: number;
        }[];
      };
      hybrid_search: {
        Args: {
          query_text: string;
          query_embedding: number[];
          match_threshold: number;
          match_count: number;
          rrf_k?: number;
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
