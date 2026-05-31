/**
 * Supabase database type stubs.
 *
 * Replace this file by running:
 *   npx supabase gen types typescript --project-id <your-project-id> > src/types/supabase.ts
 *
 * Or use the Supabase CLI:
 *   supabase gen types typescript --local > src/types/supabase.ts
 */

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
      profiles: {
        Row: {
          id: string
          username: string
          display_name: string | null
          bio: string | null
          avatar_url: string | null
          banner_url: string | null
          bsv_address: string | null
          stripe_account_id: string | null
          role: 'collector' | 'artist' | 'curator' | 'admin'
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          username: string
          display_name?: string | null
          bio?: string | null
          avatar_url?: string | null
          banner_url?: string | null
          bsv_address?: string | null
          stripe_account_id?: string | null
          role?: 'collector' | 'artist' | 'curator' | 'admin'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          username?: string
          display_name?: string | null
          bio?: string | null
          avatar_url?: string | null
          banner_url?: string | null
          bsv_address?: string | null
          stripe_account_id?: string | null
          role?: 'collector' | 'artist' | 'curator' | 'admin'
          created_at?: string
          updated_at?: string
        }
      }
      artworks: {
        Row: {
          id: string
          artist_id: string
          title: string
          description: string | null
          original_path: string | null
          jpeg_path: string | null
          thumbnail_path: string | null
          printify_product_id: string | null
          ordinal_txid: string | null
          ordinal_outpoint: string | null
          price_cad: number | null
          is_published: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          artist_id: string
          title: string
          description?: string | null
          original_path?: string | null
          jpeg_path?: string | null
          thumbnail_path?: string | null
          printify_product_id?: string | null
          ordinal_txid?: string | null
          ordinal_outpoint?: string | null
          price_cad?: number | null
          is_published?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['artworks']['Insert']>
      }
      orders: {
        Row: {
          id: string
          buyer_id: string
          artwork_id: string
          printify_order_id: string | null
          stripe_payment_intent: string | null
          status: 'pending' | 'paid' | 'fulfilled' | 'cancelled'
          amount_cad: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          buyer_id: string
          artwork_id: string
          printify_order_id?: string | null
          stripe_payment_intent?: string | null
          status?: 'pending' | 'paid' | 'fulfilled' | 'cancelled'
          amount_cad: number
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['orders']['Insert']>
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}
