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
      chat_sessions: {
        Row: {
          id: string;
          user_id: string;
          course: {
            id: string;
            universityId: string;
            code: string;
            name: string;
          };
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
          course: {
            id: string;
            universityId: string;
            code: string;
            name: string;
          };
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
          course?: {
            id: string;
            universityId: string;
            code: string;
            name: string;
          };
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
          card_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          role: 'user' | 'assistant';
          content: string;
          card_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          session_id?: string;
          role?: 'user' | 'assistant';
          content?: string;
          card_id?: string | null;
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
          created_at: string;
          metadata: Json;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          status?: 'processing' | 'ready' | 'error';
          status_message?: string | null;
          created_at?: string;
          metadata?: Json;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          status?: 'processing' | 'ready' | 'error';
          status_message?: string | null;
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
          title: string;
          questions: Json;
          responses: Json;
          score: number | null;
          total_points: number;
          current_index: number;
          status: 'in_progress' | 'completed';
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          paper_id: string;
          title: string;
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
          title?: string;
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
