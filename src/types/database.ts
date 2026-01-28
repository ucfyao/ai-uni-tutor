export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export interface Database {
    public: {
        Tables: {
            documents: {
                Row: {
                    id: string
                    user_id: string
                    name: string
                    status: 'processing' | 'ready' | 'error'
                    status_message: string | null
                    created_at: string
                    metadata: Json
                }
                Insert: {
                    id?: string
                    user_id: string
                    name: string
                    status?: 'processing' | 'ready' | 'error'
                    status_message?: string | null
                    created_at?: string
                    metadata?: Json
                }
                Update: {
                    id?: string
                    user_id?: string
                    name?: string
                    status?: 'processing' | 'ready' | 'error'
                    status_message?: string | null
                    created_at?: string
                    metadata?: Json
                }
            }
            document_chunks: {
                Row: {
                    id: string
                    document_id: string
                    content: string
                    embedding: string | null // pgvector returns string representation usually or we handle it specially
                    metadata: Json
                    created_at: string
                }
                Insert: {
                    id?: string
                    document_id: string
                    content: string
                    embedding?: string | null
                    metadata?: Json
                    created_at?: string
                }
                Update: {
                    id?: string
                    document_id?: string
                    content?: string
                    embedding?: string | null
                    metadata?: Json
                    created_at?: string
                }
            }
        }
        Functions: {
            match_documents: {
                Args: {
                    query_embedding: string
                    match_threshold: number
                    match_count: number
                }
                Returns: {
                    id: string
                    content: string
                    similarity: number
                    metadata: Json
                }[]
            }
            hybrid_search: {
                Args: {
                    query_text: string
                    query_embedding: string
                    match_threshold: number
                    match_count: number
                    rrf_k?: number
                }
                Returns: {
                    id: string
                    content: string
                    similarity: number
                    metadata: Json
                }[]
            }
        }
        Enums: {
            [_ in never]: never
        }
    }
}
