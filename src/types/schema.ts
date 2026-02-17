export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      customers: {
        Row: {
          id: string;
          name: string;
          email: string | null;
          phone: string | null;
          address: string | null;
          city: string | null;
          state: string | null;
          postal_code: string | null;
          country: string | null;
          tax_id: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          id?: string;
          name: string;
          email?: string | null;
          phone?: string | null;
          address?: string | null;
          city?: string | null;
          state?: string | null;
          postal_code?: string | null;
          country?: string | null;
          tax_id?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          id?: string;
          name?: string;
          email?: string | null;
          phone?: string | null;
          address?: string | null;
          city?: string | null;
          state?: string | null;
          postal_code?: string | null;
          country?: string | null;
          tax_id?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
          user_id?: string;
        };
      };
      currencies: {
        Row: {
          code: string;
          name: string;
          symbol: string;
          decimal_places: number;
          is_default: boolean;
          exchange_rate: number;
          last_updated: string;
          user_id: string;
        };
        Insert: {
          code: string;
          name: string;
          symbol: string;
          decimal_places?: number;
          is_default?: boolean;
          exchange_rate?: number;
          last_updated?: string;
          user_id: string;
        };
        Update: {
          code?: string;
          name?: string;
          symbol?: string;
          decimal_places?: number;
          is_default?: boolean;
          exchange_rate?: number;
          last_updated?: string;
          user_id?: string;
        };
      };
      invoice_items: {
        Row: {
          id: string;
          invoice_id: string;
          product_id: string | null;
          description: string;
          quantity: number;
          unit_price: number;
          tax_rate: number | null;
          tax_amount: number | null;
          discount_percentage: number | null;
          discount_amount: number | null;
          line_total: number;
        };
        Insert: {
          id?: string;
          invoice_id: string;
          product_id?: string | null;
          description: string;
          quantity: number;
          unit_price: number;
          tax_rate?: number | null;
          tax_amount?: number | null;
          discount_percentage?: number | null;
          discount_amount?: number | null;
          line_total: number;
        };
        Update: {
          id?: string;
          invoice_id?: string;
          product_id?: string | null;
          description?: string;
          quantity?: number;
          unit_price?: number;
          tax_rate?: number | null;
          tax_amount?: number | null;
          discount_percentage?: number | null;
          discount_amount?: number | null;
          line_total?: number;
        };
      };
      invoices: {
        Row: {
          id: string;
          invoice_number: string;
          customer_id: string | null;
          issue_date: string;
          due_date: string;
          subtotal: number;
          tax_amount: number;
          discount_amount: number;
          total_amount: number;
          currency_code: string | null;
          status: string;
          notes: string | null;
          created_at: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          id?: string;
          invoice_number: string;
          customer_id?: string | null;
          issue_date?: string;
          due_date: string;
          subtotal: number;
          tax_amount?: number;
          discount_amount?: number;
          total_amount: number;
          currency_code?: string | null;
          status?: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          id?: string;
          invoice_number?: string;
          customer_id?: string | null;
          issue_date?: string;
          due_date?: string;
          subtotal?: number;
          tax_amount?: number;
          discount_amount?: number;
          total_amount?: number;
          currency_code?: string | null;
          status?: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
          user_id?: string;
        };
      };
      payments: {
        Row: {
          id: string;
          invoice_id: string | null;
          payment_date: string;
          amount: number;
          currency_code: string | null;
          payment_method: string;
          reference_number: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          id?: string;
          invoice_id?: string | null;
          payment_date?: string;
          amount: number;
          currency_code?: string | null;
          payment_method: string;
          reference_number?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          id?: string;
          invoice_id?: string | null;
          payment_date?: string;
          amount?: number;
          currency_code?: string | null;
          payment_method?: string;
          reference_number?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
          user_id?: string;
        };
      };
      products: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          sku: string | null;
          price: number;
          currency_code: string;
          tax_rate: number | null;
          is_active: boolean | null;
          vendor_id: string | null;
          cost_price: number | null;
          created_at: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          sku?: string | null;
          price: number;
          currency_code?: string;
          tax_rate?: number | null;
          is_active?: boolean | null;
          vendor_id?: string | null;
          cost_price?: number | null;
          created_at?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          sku?: string | null;
          price?: number;
          currency_code?: string;
          tax_rate?: number | null;
          is_active?: boolean | null;
          vendor_id?: string | null;
          cost_price?: number | null;
          created_at?: string;
          updated_at?: string;
          user_id?: string;
        };
      };
      vendors: {
        Row: {
          id: string;
          name: string;
          email: string | null;
          phone: string | null;
          address: string | null;
          city: string | null;
          state: string | null;
          postal_code: string | null;
          country: string | null;
          tax_id: string | null;
          contact_person: string | null;
          notes: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          id?: string;
          name: string;
          email?: string | null;
          phone?: string | null;
          address?: string | null;
          city?: string | null;
          state?: string | null;
          postal_code?: string | null;
          country?: string | null;
          tax_id?: string | null;
          contact_person?: string | null;
          notes?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          id?: string;
          name?: string;
          email?: string | null;
          phone?: string | null;
          address?: string | null;
          city?: string | null;
          state?: string | null;
          postal_code?: string | null;
          country?: string | null;
          tax_id?: string | null;
          contact_person?: string | null;
          notes?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
          user_id?: string;
        };
      };
      purchase_orders: {
        Row: {
          id: string;
          po_number: string;
          vendor_id: string;
          customer_id: string | null;
          quotation_id: string | null;
          issue_date: string;
          expected_date: string | null;
          currency_code: string;
          status: string;
          subtotal: number;
          tax_amount: number;
          discount_amount: number;
          total_amount: number;
          notes: string | null;
          terms_conditions: string | null;
          delivery_address: string | null;
          created_at: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          id?: string;
          po_number: string;
          vendor_id: string;
          customer_id?: string | null;
          quotation_id?: string | null;
          issue_date?: string;
          expected_date?: string | null;
          currency_code?: string;
          status?: string;
          subtotal?: number;
          tax_amount?: number;
          discount_amount?: number;
          total_amount?: number;
          notes?: string | null;
          terms_conditions?: string | null;
          delivery_address?: string | null;
          created_at?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          id?: string;
          po_number?: string;
          vendor_id?: string;
          customer_id?: string | null;
          quotation_id?: string | null;
          issue_date?: string;
          expected_date?: string | null;
          currency_code?: string;
          status?: string;
          subtotal?: number;
          tax_amount?: number;
          discount_amount?: number;
          total_amount?: number;
          notes?: string | null;
          terms_conditions?: string | null;
          delivery_address?: string | null;
          created_at?: string;
          updated_at?: string;
          user_id?: string;
        };
      };
      purchase_order_items: {
        Row: {
          id: string;
          purchase_order_id: string;
          product_id: string | null;
          description: string;
          quantity: number;
          unit_price: number;
          tax_rate: number | null;
          tax_amount: number | null;
          line_total: number;
        };
        Insert: {
          id?: string;
          purchase_order_id: string;
          product_id?: string | null;
          description: string;
          quantity: number;
          unit_price: number;
          tax_rate?: number | null;
          tax_amount?: number | null;
          line_total: number;
        };
        Update: {
          id?: string;
          purchase_order_id?: string;
          product_id?: string | null;
          description?: string;
          quantity?: number;
          unit_price?: number;
          tax_rate?: number | null;
          tax_amount?: number | null;
          line_total?: number;
        };
      };
      users: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          email: string | null;
          full_name: string | null;
          id: string;
          image: string | null;
          name: string | null;
          token_identifier: string;
          updated_at: string | null;
          user_id: string | null;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          email?: string | null;
          full_name?: string | null;
          id: string;
          image?: string | null;
          name?: string | null;
          token_identifier: string;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          email?: string | null;
          full_name?: string | null;
          id?: string;
          image?: string | null;
          name?: string | null;
          token_identifier?: string;
          updated_at?: string | null;
          user_id?: string | null;
        };
      };
    };
  };
}
