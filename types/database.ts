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
      chefs: {
        Row: {
          id: string
          slug: string
          name: string
          email: string
          phone: string | null
          city: string | null
          postal_code: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          slug: string
          name: string
          email: string
          phone?: string | null
          city?: string | null
          postal_code?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          slug?: string
          name?: string
          email?: string
          phone?: string | null
          city?: string | null
          postal_code?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      menus: {
        Row: {
          id: string
          chef_id: string
          name: string
          description: string | null
          price: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          chef_id: string
          name: string
          description?: string | null
          price?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          chef_id?: string
          name?: string
          description?: string | null
          price?: number | null
          created_at?: string
          updated_at?: string
        }
      }
      booking_requests: {
        Row: {
          id: string
          chef_id: string
          conversation_id: string | null
          first_name: string
          last_name: string
          email: string
          phone: string
          booking_date: string
          city: string
          postal_code: string
          guests_count: number
          has_allergies: boolean
          allergies_details: string | null
          menu_id: string | null
          notes: string | null
          status: 'pending' | 'accepted' | 'refused'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          chef_id: string
          conversation_id?: string | null
          first_name: string
          last_name: string
          email: string
          phone: string
          booking_date: string
          city: string
          postal_code: string
          guests_count: number
          has_allergies?: boolean
          allergies_details?: string | null
          menu_id?: string | null
          notes?: string | null
          status?: 'pending' | 'accepted' | 'refused'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          chef_id?: string
          conversation_id?: string | null
          first_name?: string
          last_name?: string
          email?: string
          phone?: string
          booking_date?: string
          city?: string
          postal_code?: string
          guests_count?: number
          has_allergies?: boolean
          allergies_details?: string | null
          menu_id?: string | null
          notes?: string | null
          status?: 'pending' | 'accepted' | 'refused'
          created_at?: string
          updated_at?: string
        }
      }
      conversations: {
        Row: {
          id: string
          booking_request_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          booking_request_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          booking_request_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      participants: {
        Row: {
          id: string
          conversation_id: string
          user_id: string | null
          email: string
          role: 'client' | 'chef'
          created_at: string
        }
        Insert: {
          id?: string
          conversation_id: string
          user_id?: string | null
          email: string
          role: 'client' | 'chef'
          created_at?: string
        }
        Update: {
          id?: string
          conversation_id?: string
          user_id?: string | null
          email?: string
          role?: 'client' | 'chef'
          created_at?: string
        }
      }
      messages: {
        Row: {
          id: string
          conversation_id: string
          sender_email: string
          content: string
          created_at: string
        }
        Insert: {
          id?: string
          conversation_id: string
          sender_email: string
          content: string
          created_at?: string
        }
        Update: {
          id?: string
          conversation_id?: string
          sender_email?: string
          content?: string
          created_at?: string
        }
      }
      decision_tokens: {
        Row: {
          id: string
          booking_request_id: string
          token_hash: string
          action: 'accept' | 'refuse'
          expires_at: string
          used: boolean
          created_at: string
        }
        Insert: {
          id?: string
          booking_request_id: string
          token_hash: string
          action: 'accept' | 'refuse'
          expires_at: string
          used?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          booking_request_id?: string
          token_hash?: string
          action?: 'accept' | 'refuse'
          expires_at?: string
          used?: boolean
          created_at?: string
        }
      }
    }
  }
}

