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
          address: string | null
          latitude: number | null
          longitude: number | null
          city: string | null
          postal_code: string | null
          profile_picture: string | null
          cuisine_style: string | null
          cuisine_style_en: string | null
          info_link_xx: string | null
          primary_dish_photo: string | null
          availability_radius_km: number
          dish_photos: string[] | null
          min_guests: number | null
          max_guests: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          slug: string
          name: string
          email: string
          phone?: string | null
          address?: string | null
          latitude?: number | null
          longitude?: number | null
          city?: string | null
          postal_code?: string | null
          profile_picture?: string | null
          cuisine_style?: string | null
          cuisine_style_en?: string | null
          info_link_xx?: string | null
          primary_dish_photo?: string | null
          availability_radius_km?: number
          dish_photos?: string[] | null
          min_guests?: number | null
          max_guests?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          slug?: string
          name?: string
          email?: string
          phone?: string | null
          address?: string | null
          latitude?: number | null
          longitude?: number | null
          city?: string | null
          postal_code?: string | null
          profile_picture?: string | null
          cuisine_style?: string | null
          cuisine_style_en?: string | null
          info_link_xx?: string | null
          primary_dish_photo?: string | null
          availability_radius_km?: number
          dish_photos?: string[] | null
          min_guests?: number | null
          max_guests?: number | null
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
          booking_date: string | null
          city: string
          postal_code: string
          guests_count: number
          children_count: number
          has_allergies: boolean
          allergies_details: string | null
          menu_id: string | null
          notes: string | null
          service_type: 'repas_domicile' | 'cours_cuisine' | 'mise_en_demeure'
          period_days: string | null
          meal_time: 'dejeuner' | 'diner' | null
          budget: number | null
          course_topic: string | null
          selected_dates: Json | null
          meal_options: string[] | null
          total_price: number | null
          is_price_custom: boolean
          menu_content: Json | null
          request_sent_at: string
          fallback_enabled: boolean
          fallback_next_chef_ids: string[]
          fallback_group_id: string | null
          fallback_timeout_at: string | null
          fallback_previous_booking_id: string | null
          status: 'pending' | 'accepted' | 'refused' | 'expired' | 'validated_by_client' | 'cancelled' | 'completed'
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
          booking_date?: string | null
          city: string
          postal_code: string
          guests_count: number
          children_count?: number
          has_allergies?: boolean
          allergies_details?: string | null
          menu_id?: string | null
          notes?: string | null
          service_type?: 'repas_domicile' | 'cours_cuisine' | 'mise_en_demeure'
          period_days?: string | null
          meal_time?: 'dejeuner' | 'diner' | null
          budget?: number | null
          course_topic?: string | null
          selected_dates?: Json | null
          meal_options?: string[] | null
          total_price?: number | null
          is_price_custom?: boolean
          menu_content?: Json | null
          request_sent_at?: string
          fallback_enabled?: boolean
          fallback_next_chef_ids?: string[]
          fallback_group_id?: string | null
          fallback_timeout_at?: string | null
          fallback_previous_booking_id?: string | null
          status?: 'pending' | 'accepted' | 'refused' | 'expired' | 'validated_by_client' | 'cancelled' | 'completed'
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
          booking_date?: string | null
          city?: string
          postal_code?: string
          guests_count?: number
          has_allergies?: boolean
          allergies_details?: string | null
          menu_id?: string | null
          notes?: string | null
          service_type?: 'repas_domicile' | 'cours_cuisine' | 'mise_en_demeure'
          period_days?: string | null
          meal_time?: 'dejeuner' | 'diner' | null
          budget?: number | null
          course_topic?: string | null
          selected_dates?: Json | null
          meal_options?: string[] | null
          total_price?: number | null
          is_price_custom?: boolean
          menu_content?: Json | null
          request_sent_at?: string
          fallback_enabled?: boolean
          fallback_next_chef_ids?: string[]
          fallback_group_id?: string | null
          fallback_timeout_at?: string | null
          fallback_previous_booking_id?: string | null
          status?: 'pending' | 'accepted' | 'refused' | 'expired' | 'validated_by_client' | 'cancelled' | 'completed'
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
