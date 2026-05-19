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
