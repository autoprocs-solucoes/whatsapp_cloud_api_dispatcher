// =============================================================================
// Tipos do schema Supabase — espelha supabase/migrations/*
// Gerar automaticamente no futuro: `supabase gen types typescript --linked`
// Mantém formato canônico do Supabase para inferência completa em supabase-js.
// =============================================================================

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type WorkspaceRole = "owner" | "member";

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "12.2.3";
  };
  public: {
    Tables: {
      profile: {
        Row: {
          user_id: string;
          full_name: string;
          avatar_url: string | null;
          is_superadmin: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          full_name?: string;
          avatar_url?: string | null;
          is_superadmin?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          full_name?: string;
          avatar_url?: string | null;
          is_superadmin?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      workspace: {
        Row: {
          id: string;
          name: string;
          slug: string;
          logo_url: string | null;
          owner_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          logo_url?: string | null;
          owner_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          logo_url?: string | null;
          owner_id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workspace_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profile";
            referencedColumns: ["user_id"];
          },
        ];
      };
      workspace_member: {
        Row: {
          workspace_id: string;
          user_id: string;
          role: WorkspaceRole;
          created_at: string;
        };
        Insert: {
          workspace_id: string;
          user_id: string;
          role?: WorkspaceRole;
          created_at?: string;
        };
        Update: {
          workspace_id?: string;
          user_id?: string;
          role?: WorkspaceRole;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workspace_member_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspace";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workspace_member_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profile";
            referencedColumns: ["user_id"];
          },
        ];
      };
      workspace_meta_connection: {
        Row: {
          workspace_id: string;
          waba_id: string;
          business_id: string | null;
          business_name: string | null;
          access_token: string;
          connected_at: string;
          connected_by: string | null;
          updated_at: string;
        };
        Insert: {
          workspace_id: string;
          waba_id: string;
          business_id?: string | null;
          business_name?: string | null;
          access_token: string;
          connected_at?: string;
          connected_by?: string | null;
          updated_at?: string;
        };
        Update: {
          workspace_id?: string;
          waba_id?: string;
          business_id?: string | null;
          business_name?: string | null;
          access_token?: string;
          connected_at?: string;
          connected_by?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workspace_meta_connection_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: true;
            referencedRelation: "workspace";
            referencedColumns: ["id"];
          },
        ];
      };
      workspace_phone_number: {
        Row: {
          id: string;
          workspace_id: string;
          phone_number_id: string;
          display_phone_number: string;
          verified_name: string | null;
          quality_rating: string | null;
          code_verification_status: string | null;
          is_registered: boolean;
          last_synced_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          phone_number_id: string;
          display_phone_number: string;
          verified_name?: string | null;
          quality_rating?: string | null;
          code_verification_status?: string | null;
          is_registered?: boolean;
          last_synced_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          phone_number_id?: string;
          display_phone_number?: string;
          verified_name?: string | null;
          quality_rating?: string | null;
          code_verification_status?: string | null;
          is_registered?: boolean;
          last_synced_at?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workspace_phone_number_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspace";
            referencedColumns: ["id"];
          },
        ];
      };
      contact: {
        Row: {
          id: string;
          workspace_id: string;
          phone_e164: string;
          full_name: string | null;
          custom_fields: Json;
          opt_out: boolean;
          opt_out_at: string | null;
          tags: string[];
          created_at: string;
          updated_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          phone_e164: string;
          full_name?: string | null;
          custom_fields?: Json;
          opt_out?: boolean;
          opt_out_at?: string | null;
          tags?: string[];
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          phone_e164?: string;
          full_name?: string | null;
          custom_fields?: Json;
          opt_out?: boolean;
          opt_out_at?: string | null;
          tags?: string[];
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "contact_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspace";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contact_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profile";
            referencedColumns: ["user_id"];
          },
        ];
      };
      template: {
        Row: {
          id: string;
          workspace_id: string;
          meta_template_id: string;
          name: string;
          language: string;
          category: string;
          status: string;
          header_text: string | null;
          body_text: string | null;
          footer_text: string | null;
          buttons: Json;
          components_raw: Json | null;
          last_synced_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          meta_template_id: string;
          name: string;
          language: string;
          category: string;
          status: string;
          header_text?: string | null;
          body_text?: string | null;
          footer_text?: string | null;
          buttons?: Json;
          components_raw?: Json | null;
          last_synced_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          meta_template_id?: string;
          name?: string;
          language?: string;
          category?: string;
          status?: string;
          header_text?: string | null;
          body_text?: string | null;
          footer_text?: string | null;
          buttons?: Json;
          components_raw?: Json | null;
          last_synced_at?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "template_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspace";
            referencedColumns: ["id"];
          },
        ];
      };
      contact_import: {
        Row: {
          id: string;
          workspace_id: string;
          filename: string | null;
          mapping: Json;
          stats: Json;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          filename?: string | null;
          mapping: Json;
          stats: Json;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          filename?: string | null;
          mapping?: Json;
          stats?: Json;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "contact_import_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspace";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contact_import_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profile";
            referencedColumns: ["user_id"];
          },
        ];
      };
      segment: {
        Row: {
          id: string;
          workspace_id: string;
          name: string;
          rules: Json;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          name: string;
          rules: Json;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          name?: string;
          rules?: Json;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "segment_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspace";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "segment_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profile";
            referencedColumns: ["user_id"];
          },
        ];
      };
      dispatch: {
        Row: {
          id: string;
          workspace_id: string;
          template_id: string;
          phone_number_id: string;
          segment_id: string | null;
          recipient_source: "segment" | "manual";
          manual_phones: string[];
          variable_mapping: Json;
          status: "draft" | "queued" | "running" | "done" | "failed" | "canceled";
          total_recipients: number;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          started_at: string | null;
          finished_at: string | null;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          template_id: string;
          phone_number_id: string;
          segment_id?: string | null;
          recipient_source: "segment" | "manual";
          manual_phones?: string[];
          variable_mapping?: Json;
          status?: "draft" | "queued" | "running" | "done" | "failed" | "canceled";
          total_recipients?: number;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          started_at?: string | null;
          finished_at?: string | null;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          template_id?: string;
          phone_number_id?: string;
          segment_id?: string | null;
          recipient_source?: "segment" | "manual";
          manual_phones?: string[];
          variable_mapping?: Json;
          status?: "draft" | "queued" | "running" | "done" | "failed" | "canceled";
          total_recipients?: number;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          started_at?: string | null;
          finished_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "dispatch_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspace";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "dispatch_template_id_fkey";
            columns: ["template_id"];
            isOneToOne: false;
            referencedRelation: "template";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "dispatch_segment_id_fkey";
            columns: ["segment_id"];
            isOneToOne: false;
            referencedRelation: "segment";
            referencedColumns: ["id"];
          },
        ];
      };
      dispatch_recipient: {
        Row: {
          id: string;
          dispatch_id: string;
          contact_id: string | null;
          phone_e164: string;
          payload: Json;
          status: "queued" | "sent" | "delivered" | "read" | "failed";
          meta_message_id: string | null;
          error_code: string | null;
          error_message: string | null;
          sent_at: string | null;
          delivered_at: string | null;
          read_at: string | null;
          failed_at: string | null;
          claimed_at: string | null;
          attempts: number;
          reaction_emoji: string | null;
          reaction_at: string | null;
        };
        Insert: {
          id?: string;
          dispatch_id: string;
          contact_id?: string | null;
          phone_e164: string;
          payload?: Json;
          status?: "queued" | "sent" | "delivered" | "read" | "failed";
          meta_message_id?: string | null;
          error_code?: string | null;
          error_message?: string | null;
          sent_at?: string | null;
          delivered_at?: string | null;
          read_at?: string | null;
          failed_at?: string | null;
          claimed_at?: string | null;
          attempts?: number;
          reaction_emoji?: string | null;
          reaction_at?: string | null;
        };
        Update: {
          id?: string;
          dispatch_id?: string;
          contact_id?: string | null;
          phone_e164?: string;
          payload?: Json;
          status?: "queued" | "sent" | "delivered" | "read" | "failed";
          meta_message_id?: string | null;
          error_code?: string | null;
          error_message?: string | null;
          sent_at?: string | null;
          delivered_at?: string | null;
          read_at?: string | null;
          failed_at?: string | null;
          claimed_at?: string | null;
          attempts?: number;
          reaction_emoji?: string | null;
          reaction_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "dispatch_recipient_dispatch_id_fkey";
            columns: ["dispatch_id"];
            isOneToOne: false;
            referencedRelation: "dispatch";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "dispatch_recipient_contact_id_fkey";
            columns: ["contact_id"];
            isOneToOne: false;
            referencedRelation: "contact";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      is_workspace_member: {
        Args: { p_workspace_id: string };
        Returns: boolean;
      };
      is_workspace_owner: {
        Args: { p_workspace_id: string };
        Returns: boolean;
      };
      claim_dispatch_recipients: {
        Args: {
          p_dispatch_id: string;
          p_limit: number;
          p_stale_after?: string;
        };
        Returns: Database["public"]["Tables"]["dispatch_recipient"]["Row"][];
      };
    };
    Enums: {
      workspace_role: WorkspaceRole;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

// Convenience aliases
export type Profile = Database["public"]["Tables"]["profile"]["Row"];
export type Workspace = Database["public"]["Tables"]["workspace"]["Row"];
export type WorkspaceMember = Database["public"]["Tables"]["workspace_member"]["Row"];
export type WorkspaceMetaConnection =
  Database["public"]["Tables"]["workspace_meta_connection"]["Row"];
export type WorkspacePhoneNumber =
  Database["public"]["Tables"]["workspace_phone_number"]["Row"];
export type Contact = Database["public"]["Tables"]["contact"]["Row"];
export type ContactInsert = Database["public"]["Tables"]["contact"]["Insert"];
export type ContactImport = Database["public"]["Tables"]["contact_import"]["Row"];
export type Template = Database["public"]["Tables"]["template"]["Row"];
export type Segment = Database["public"]["Tables"]["segment"]["Row"];
export type SegmentInsert = Database["public"]["Tables"]["segment"]["Insert"];
export type Dispatch = Database["public"]["Tables"]["dispatch"]["Row"];
export type DispatchInsert = Database["public"]["Tables"]["dispatch"]["Insert"];
export type DispatchRecipient = Database["public"]["Tables"]["dispatch_recipient"]["Row"];
export type DispatchRecipientInsert = Database["public"]["Tables"]["dispatch_recipient"]["Insert"];
export type DispatchStatus = Dispatch["status"];
export type DispatchRecipientStatus = DispatchRecipient["status"];
