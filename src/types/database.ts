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
          role: 'user' | 'agent' | 'institution_admin' | 'admin' | 'super_admin';
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
          role?: 'user' | 'agent' | 'institution_admin' | 'admin' | 'super_admin';
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
          role?: 'user' | 'agent' | 'institution_admin' | 'admin' | 'super_admin';
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
          is_published: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          short_name: string;
          logo_url?: string | null;
          is_published?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          short_name?: string;
          logo_url?: string | null;
          is_published?: boolean;
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
          is_published: boolean;
          created_at: string;
          updated_at: string;
          knowledge_outline: Json | null;
        };
        Insert: {
          id?: string;
          university_id: string;
          code: string;
          name: string;
          is_published?: boolean;
          created_at?: string;
          updated_at?: string;
          knowledge_outline?: Json | null;
        };
        Update: {
          id?: string;
          university_id?: string;
          code?: string;
          name?: string;
          is_published?: boolean;
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
          active_leaf_id: string | null;
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
          active_leaf_id?: string | null;
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
          active_leaf_id?: string | null;
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
          parent_message_id: string | null;
        };
        Insert: {
          id?: string;
          session_id: string;
          role: 'user' | 'assistant';
          content: string;
          created_at?: string;
          parent_message_id?: string | null;
        };
        Update: {
          id?: string;
          session_id?: string;
          role?: 'user' | 'assistant';
          content?: string;
          created_at?: string;
          parent_message_id?: string | null;
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
          question_types: string[];
          status: 'draft' | 'ready';
          metadata: Json;
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
          metadata?: Json;
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
          metadata?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      exam_questions: {
        Row: {
          id: string;
          paper_id: string;
          parent_question_id: string | null;
          order_num: number;
          type: string;
          content: string;
          options: Json;
          answer: string;
          explanation: string;
          points: number;
          metadata: Json;
          embedding: number[] | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          paper_id: string;
          parent_question_id?: string | null;
          order_num: number;
          type: string;
          content: string;
          options?: Json;
          answer: string;
          explanation: string;
          points?: number;
          metadata?: Json;
          embedding?: number[] | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          paper_id?: string;
          parent_question_id?: string | null;
          order_num?: number;
          type?: string;
          content?: string;
          options?: Json;
          answer?: string;
          explanation?: string;
          points?: number;
          metadata?: Json;
          embedding?: number[] | null;
          created_at?: string;
        };
        Relationships: [];
      };
      mock_exams: {
        Row: {
          id: string;
          user_id: string;
          session_id: string | null;
          title: string;
          questions: Json;
          responses: Json;
          score: number | null;
          total_points: number;
          current_index: number;
          status: 'in_progress' | 'completed';
          mode: 'practice' | 'exam';
          retake_of: string | null;
          course_code: string | null;
          course_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          session_id?: string | null;
          title: string;
          mode?: 'practice' | 'exam';
          questions?: Json;
          responses?: Json;
          score?: number | null;
          total_points?: number;
          current_index?: number;
          status?: 'in_progress' | 'completed';
          retake_of?: string | null;
          course_code?: string | null;
          course_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          session_id?: string | null;
          title?: string;
          mode?: 'practice' | 'exam';
          questions?: Json;
          responses?: Json;
          score?: number | null;
          total_points?: number;
          current_index?: number;
          status?: 'in_progress' | 'completed';
          retake_of?: string | null;
          course_code?: string | null;
          course_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      bookmarked_papers: {
        Row: {
          id: string;
          user_id: string;
          paper_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          paper_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          paper_id?: string;
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
          metadata: Json;
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
          metadata?: Json;
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
          metadata?: Json;
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
          warnings: string[];
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
          warnings?: string[];
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
          warnings?: string[];
          created_at?: string;
          parent_item_id?: string | null;
        };
        Relationships: [];
      };
      llm_call_logs: {
        Row: {
          id: string;
          user_id: string | null;
          call_type: string;
          provider: string;
          model: string;
          status: string;
          error_message: string | null;
          latency_ms: number;
          input_tokens: number | null;
          output_tokens: number | null;
          cost_estimate: number | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          call_type: string;
          provider: string;
          model: string;
          status?: string;
          error_message?: string | null;
          latency_ms: number;
          input_tokens?: number | null;
          output_tokens?: number | null;
          cost_estimate?: number | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          call_type?: string;
          provider?: string;
          model?: string;
          status?: string;
          error_message?: string | null;
          latency_ms?: number;
          input_tokens?: number | null;
          output_tokens?: number | null;
          cost_estimate?: number | null;
          metadata?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      institutions: {
        Row: {
          id: string;
          name: string;
          admin_id: string;
          commission_rate: number;
          contact_info: Json;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          name: string;
          admin_id: string;
          commission_rate?: number;
          contact_info?: Json;
          is_active?: boolean;
        };
        Update: {
          name?: string;
          commission_rate?: number;
          contact_info?: Json;
          is_active?: boolean;
        };
        Relationships: [];
      };
      institution_members: {
        Row: {
          id: string;
          institution_id: string;
          user_id: string;
          status: string;
          invited_at: string;
          joined_at: string | null;
        };
        Insert: {
          institution_id: string;
          user_id: string;
          status?: string;
        };
        Update: {
          status?: string;
          joined_at?: string;
        };
        Relationships: [];
      };
      institution_invites: {
        Row: {
          id: string;
          institution_id: string;
          invite_code: string;
          created_by: string;
          max_uses: number | null;
          used_count: number;
          expires_at: string | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          institution_id: string;
          invite_code: string;
          created_by: string;
          max_uses?: number;
          expires_at?: string;
        };
        Update: {
          is_active?: boolean;
          used_count?: number;
        };
        Relationships: [];
      };
      referral_codes: {
        Row: {
          id: string;
          user_id: string;
          code: string;
          type: string;
          stripe_promotion_code_id: string | null;
          institution_id: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          code: string;
          type: string;
          stripe_promotion_code_id?: string | null;
          institution_id?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          code?: string;
          type?: string;
          stripe_promotion_code_id?: string | null;
          institution_id?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      referrals: {
        Row: {
          id: string;
          referrer_id: string;
          referee_id: string;
          referral_code_id: string;
          status: string;
          stripe_subscription_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          referrer_id: string;
          referee_id: string;
          referral_code_id: string;
          status?: string;
          stripe_subscription_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          referrer_id?: string;
          referee_id?: string;
          referral_code_id?: string;
          status?: string;
          stripe_subscription_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      commissions: {
        Row: {
          id: string;
          referral_id: string;
          beneficiary_id: string;
          type: string;
          amount: number;
          currency: string;
          status: string;
          stripe_invoice_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          referral_id: string;
          beneficiary_id: string;
          type: string;
          amount: number;
          currency?: string;
          status?: string;
          stripe_invoice_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          referral_id?: string;
          beneficiary_id?: string;
          type?: string;
          amount?: number;
          currency?: string;
          status?: string;
          stripe_invoice_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      agent_applications: {
        Row: {
          id: string;
          user_id: string;
          full_name: string;
          university: string;
          contact_info: Json;
          motivation: string;
          status: string;
          reviewed_by: string | null;
          reviewed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          full_name: string;
          university: string;
          contact_info?: Json;
          motivation?: string;
          status?: string;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          full_name?: string;
          university?: string;
          contact_info?: Json;
          motivation?: string;
          status?: string;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      agent_wallets: {
        Row: {
          id: string;
          user_id: string;
          balance: number;
          total_earned: number;
          total_withdrawn: number;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          balance?: number;
          total_earned?: number;
          total_withdrawn?: number;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          balance?: number;
          total_earned?: number;
          total_withdrawn?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      withdrawal_requests: {
        Row: {
          id: string;
          wallet_id: string;
          user_id: string;
          amount: number;
          payment_method: Json;
          status: string;
          reviewed_by: string | null;
          reviewed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          wallet_id: string;
          user_id: string;
          amount: number;
          payment_method?: Json;
          status?: string;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          wallet_id?: string;
          user_id?: string;
          amount?: number;
          payment_method?: Json;
          status?: string;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      referral_config: {
        Row: {
          key: string;
          value: Json;
          updated_at: string;
        };
        Insert: {
          key: string;
          value: Json;
          updated_at?: string;
        };
        Update: {
          key?: string;
          value?: Json;
          updated_at?: string;
        };
        Relationships: [];
      };
      stripe_events: {
        Row: {
          id: string;
          event_id: string;
          event_type: string;
          processed_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          event_type: string;
          processed_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          event_type?: string;
          processed_at?: string;
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
      match_exam_questions: {
        Args: {
          query_embedding: number[];
          match_count?: number;
          filter_course_id?: string | null;
        };
        Returns: {
          id: string;
          paper_id: string;
          order_num: number;
          content: string;
          answer: string;
          explanation: string;
          points: number;
          similarity: number;
        }[];
      };
      get_llm_log_stats: {
        Args: {
          start_time: string;
        };
        Returns: {
          total_count: number;
          error_count: number;
          avg_latency: number;
          total_cost: number;
        }[];
      };
      get_user_llm_cost_summary: {
        Args: {
          start_time: string;
          end_time?: string;
        };
        Returns: {
          user_id: string;
          email: string | null;
          full_name: string | null;
          total_calls: number;
          error_calls: number;
          input_tokens: number;
          output_tokens: number;
          total_cost: number;
        }[];
      };
      process_referral_payment: {
        Args: {
          p_referee_id: string;
          p_stripe_subscription_id: string;
          p_payment_amount?: number | null;
        };
        Returns: undefined;
      };
      increment_wallet_balance: {
        Args: {
          p_user_id: string;
          p_amount: number;
        };
        Returns: undefined;
      };
      reject_withdrawal_with_refund: {
        Args: {
          p_withdrawal_id: string;
          p_admin_id: string;
        };
        Returns: undefined;
      };
      get_referral_daily_trend: {
        Args: {
          p_user_id: string;
          p_days?: number;
        };
        Returns: {
          date: string;
          count: number;
        }[];
      };
      complete_withdrawal_atomic: {
        Args: {
          p_withdrawal_id: string;
          p_admin_id: string;
        };
        Returns: undefined;
      };
      request_withdrawal_atomic: {
        Args: {
          p_user_id: string;
          p_amount: number;
          p_payment_method: Json;
        };
        Returns: string;
      };
      approve_agent_application: {
        Args: {
          p_application_id: string;
          p_admin_id: string;
        };
        Returns: string;
      };
      clawback_referral_commission: {
        Args: {
          p_referee_id: string;
          p_stripe_subscription_id: string;
        };
        Returns: undefined;
      };
      create_institution: {
        Args: {
          p_name: string;
          p_admin_id: string;
          p_commission_rate?: number;
          p_contact_info?: Json;
        };
        Returns: string;
      };
      accept_institution_invite: {
        Args: {
          p_invite_code: string;
        };
        Returns: string;
      };
      remove_institution_member: {
        Args: {
          p_institution_id: string;
          p_user_id: string;
        };
        Returns: undefined;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
