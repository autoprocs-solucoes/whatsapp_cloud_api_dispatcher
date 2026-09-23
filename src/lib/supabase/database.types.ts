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
          id: string;
          workspace_id: string;
          waba_id: string;
          business_id: string | null;
          business_name: string | null;
          access_token: string;
          connected_at: string;
          connected_by: string | null;
          updated_at: string;
          connection_method: string;
          health_status: Json | null;
          health_synced_at: string | null;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          waba_id: string;
          business_id?: string | null;
          business_name?: string | null;
          access_token: string;
          connected_at?: string;
          connected_by?: string | null;
          updated_at?: string;
          connection_method?: string;
          health_status?: Json | null;
          health_synced_at?: string | null;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          waba_id?: string;
          business_id?: string | null;
          business_name?: string | null;
          access_token?: string;
          connected_at?: string;
          connected_by?: string | null;
          updated_at?: string;
          connection_method?: string;
          health_status?: Json | null;
          health_synced_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "workspace_meta_connection_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspace";
            referencedColumns: ["id"];
          },
        ];
      };
      workspace_phone_number: {
        Row: {
          id: string;
          workspace_id: string;
          connection_id: string;
          phone_number_id: string;
          display_phone_number: string;
          verified_name: string | null;
          quality_rating: string | null;
          code_verification_status: string | null;
          meta_status: string | null;
          platform_type: string | null;
          is_on_biz_app: boolean | null;
          messaging_limit_tier: string | null;
          is_registered: boolean;
          pin: string | null;
          last_synced_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          connection_id: string;
          phone_number_id: string;
          display_phone_number: string;
          verified_name?: string | null;
          quality_rating?: string | null;
          code_verification_status?: string | null;
          meta_status?: string | null;
          platform_type?: string | null;
          is_on_biz_app?: boolean | null;
          messaging_limit_tier?: string | null;
          is_registered?: boolean;
          pin?: string | null;
          last_synced_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          connection_id?: string;
          phone_number_id?: string;
          display_phone_number?: string;
          verified_name?: string | null;
          quality_rating?: string | null;
          code_verification_status?: string | null;
          meta_status?: string | null;
          platform_type?: string | null;
          is_on_biz_app?: boolean | null;
          messaging_limit_tier?: string | null;
          is_registered?: boolean;
          pin?: string | null;
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
          {
            foreignKeyName: "workspace_phone_number_connection_id_fkey";
            columns: ["connection_id"];
            isOneToOne: false;
            referencedRelation: "workspace_meta_connection";
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
          connection_id: string;
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
          active: boolean;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          connection_id: string;
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
          active?: boolean;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          connection_id?: string;
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
          active?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "template_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspace";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "template_connection_id_fkey";
            columns: ["connection_id"];
            isOneToOne: false;
            referencedRelation: "workspace_meta_connection";
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
      flow_folder: {
        Row: {
          id: string;
          workspace_id: string;
          name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          name: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          name?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "flow_folder_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspace";
            referencedColumns: ["id"];
          },
        ];
      };
      flow: {
        Row: {
          id: string;
          workspace_id: string;
          folder_id: string | null;
          name: string;
          description: string | null;
          status: "draft" | "published";
          graph: Json;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          published_at: string | null;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          folder_id?: string | null;
          name: string;
          description?: string | null;
          status?: "draft" | "published";
          graph?: Json;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          published_at?: string | null;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          folder_id?: string | null;
          name?: string;
          description?: string | null;
          status?: "draft" | "published";
          graph?: Json;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          published_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "flow_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspace";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "flow_folder_id_fkey";
            columns: ["folder_id"];
            isOneToOne: false;
            referencedRelation: "flow_folder";
            referencedColumns: ["id"];
          },
        ];
      };
      flow_run: {
        Row: {
          id: string;
          workspace_id: string;
          flow_id: string;
          campaign_id: string | null;
          dispatch_id: string | null;
          contact_id: string | null;
          phone_e164: string;
          phone_number_id: string;
          connection_id: string;
          current_node_id: string | null;
          status:
            | "active"
            | "waiting_reply"
            | "waiting_time"
            | "done"
            | "canceled"
            | "failed";
          resume_at: string | null;
          last_error: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          flow_id: string;
          campaign_id?: string | null;
          dispatch_id?: string | null;
          contact_id?: string | null;
          phone_e164: string;
          phone_number_id: string;
          connection_id: string;
          current_node_id?: string | null;
          status?:
            | "active"
            | "waiting_reply"
            | "waiting_time"
            | "done"
            | "canceled"
            | "failed";
          resume_at?: string | null;
          last_error?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          flow_id?: string;
          campaign_id?: string | null;
          dispatch_id?: string | null;
          contact_id?: string | null;
          phone_e164?: string;
          phone_number_id?: string;
          connection_id?: string;
          current_node_id?: string | null;
          status?:
            | "active"
            | "waiting_reply"
            | "waiting_time"
            | "done"
            | "canceled"
            | "failed";
          resume_at?: string | null;
          last_error?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "flow_run_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspace";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "flow_run_flow_id_fkey";
            columns: ["flow_id"];
            isOneToOne: false;
            referencedRelation: "flow";
            referencedColumns: ["id"];
          },
        ];
      };
      push_log: {
        Row: {
          id: number;
          created_at: string;
          title: string;
          tag: string | null;
          targets: number;
          sent: number;
          failed: number;
          detail: Json | null;
        };
        Insert: {
          id?: number;
          created_at?: string;
          title: string;
          tag?: string | null;
          targets?: number;
          sent?: number;
          failed?: number;
          detail?: Json | null;
        };
        Update: {
          id?: number;
          created_at?: string;
          title?: string;
          tag?: string | null;
          targets?: number;
          sent?: number;
          failed?: number;
          detail?: Json | null;
        };
        Relationships: [];
      };
      webhook_unmatched: {
        Row: {
          id: number;
          created_at: string;
          waba_id: string | null;
          phone_number_id: string | null;
          from_phone: string | null;
          kind: string | null;
          payload: Json | null;
        };
        Insert: {
          id?: number;
          created_at?: string;
          waba_id?: string | null;
          phone_number_id?: string | null;
          from_phone?: string | null;
          kind?: string | null;
          payload?: Json | null;
        };
        Update: {
          id?: number;
          created_at?: string;
          waba_id?: string | null;
          phone_number_id?: string | null;
          from_phone?: string | null;
          kind?: string | null;
          payload?: Json | null;
        };
        Relationships: [];
      };
      meta_signup_attempt: {
        Row: {
          id: number;
          created_at: string;
          workspace_id: string | null;
          user_id: string | null;
          stage: string;
          method: string | null;
          waba_id: string | null;
          phone_number_id: string | null;
          error: string | null;
          detail: Json | null;
        };
        Insert: {
          id?: number;
          created_at?: string;
          workspace_id?: string | null;
          user_id?: string | null;
          stage: string;
          method?: string | null;
          waba_id?: string | null;
          phone_number_id?: string | null;
          error?: string | null;
          detail?: Json | null;
        };
        Update: {
          id?: number;
          created_at?: string;
          workspace_id?: string | null;
          user_id?: string | null;
          stage?: string;
          method?: string | null;
          waba_id?: string | null;
          phone_number_id?: string | null;
          error?: string | null;
          detail?: Json | null;
        };
        Relationships: [];
      };
      campaign: {
        Row: {
          id: string;
          workspace_id: string;
          name: string;
          description: string | null;
          flow_id: string | null;
          status: "active" | "archived";
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          name: string;
          description?: string | null;
          flow_id?: string | null;
          status?: "active" | "archived";
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          name?: string;
          description?: string | null;
          flow_id?: string | null;
          status?: "active" | "archived";
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "campaign_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspace";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaign_flow_id_fkey";
            columns: ["flow_id"];
            isOneToOne: false;
            referencedRelation: "flow";
            referencedColumns: ["id"];
          },
        ];
      };
      dispatch: {
        Row: {
          id: string;
          workspace_id: string;
          campaign_id: string | null;
          name: string | null;
          scheduled_at: string | null;
          template_id: string;
          phone_number_id: string;
          segment_id: string | null;
          recipient_source: "segment" | "manual";
          manual_phones: string[];
          variable_mapping: Json;
          status:
            | "draft"
            | "scheduled"
            | "queued"
            | "running"
            | "paused"
            | "done"
            | "failed"
            | "canceled";
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
          campaign_id?: string | null;
          name?: string | null;
          scheduled_at?: string | null;
          template_id: string;
          phone_number_id: string;
          segment_id?: string | null;
          recipient_source: "segment" | "manual";
          manual_phones?: string[];
          variable_mapping?: Json;
          status?:
            | "draft"
            | "scheduled"
            | "queued"
            | "running"
            | "paused"
            | "done"
            | "failed"
            | "canceled";
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
          campaign_id?: string | null;
          name?: string | null;
          scheduled_at?: string | null;
          template_id?: string;
          phone_number_id?: string;
          segment_id?: string | null;
          recipient_source?: "segment" | "manual";
          manual_phones?: string[];
          variable_mapping?: Json;
          status?:
            | "draft"
            | "scheduled"
            | "queued"
            | "running"
            | "paused"
            | "done"
            | "failed"
            | "canceled";
          total_recipients?: number;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          started_at?: string | null;
          finished_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "dispatch_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "campaign";
            referencedColumns: ["id"];
          },
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
          next_attempt_at: string | null;
          last_error_at: string | null;
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
          next_attempt_at?: string | null;
          last_error_at?: string | null;
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
          next_attempt_at?: string | null;
          last_error_at?: string | null;
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
      push_subscription: {
        Row: {
          id: string;
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          user_agent: string | null;
          created_at: string;
          last_used_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          user_agent?: string | null;
          created_at?: string;
          last_used_at?: string | null;
        };
        Update: {
          p256dh?: string;
          auth?: string;
          user_agent?: string | null;
          last_used_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "push_subscription_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profile";
            referencedColumns: ["user_id"];
          },
        ];
      };
      whatsapp_message: {
        Row: {
          id: string;
          workspace_id: string;
          connection_id: string;
          phone_number_id: string;
          contact_phone_e164: string;
          contact_id: string | null;
          contact_name: string | null;
          direction: "in" | "out";
          type: string;
          body: string | null;
          media_id: string | null;
          media_mime: string | null;
          meta_message_id: string | null;
          status: "sent" | "delivered" | "read" | "failed" | null;
          error_message: string | null;
          read_internally: boolean;
          sent_at: string;
          raw: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          connection_id: string;
          phone_number_id: string;
          contact_phone_e164: string;
          contact_id?: string | null;
          contact_name?: string | null;
          direction: "in" | "out";
          type?: string;
          body?: string | null;
          media_id?: string | null;
          media_mime?: string | null;
          meta_message_id?: string | null;
          status?: "sent" | "delivered" | "read" | "failed" | null;
          error_message?: string | null;
          read_internally?: boolean;
          sent_at?: string;
          raw?: Json | null;
          created_at?: string;
        };
        Update: {
          contact_id?: string | null;
          contact_name?: string | null;
          body?: string | null;
          status?: "sent" | "delivered" | "read" | "failed" | null;
          error_message?: string | null;
          read_internally?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "whatsapp_message_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspace";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "whatsapp_message_connection_id_fkey";
            columns: ["connection_id"];
            isOneToOne: false;
            referencedRelation: "workspace_meta_connection";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      dispatch_status_counts: {
        Args: { p_dispatch_ids: string[] };
        Returns: {
          dispatch_id: string;
          status: string;
          n: number;
        }[];
      };
      dispatch_daily_counts: {
        Args: { p_dispatch_ids: string[]; p_days?: number };
        Returns: {
          day: string;
          status: string;
          n: number;
        }[];
      };
      list_whatsapp_conversations: {
        Args: {
          p_workspace_id: string;
          p_limit?: number;
          p_offset?: number;
          p_search?: string | null;
        };
        Returns: {
          contact_phone_e164: string;
          contact_id: string | null;
          contact_name: string | null;
          connection_id: string;
          last_body: string | null;
          last_type: string;
          last_direction: "in" | "out";
          last_at: string;
          unread: number;
          last_inbound_at: string | null;
        }[];
      };
      reschedule_dispatch_recipient: {
        Args: {
          p_id: string;
          p_delay_seconds: number;
          p_error_code: string;
          p_error_message: string;
        };
        Returns: undefined;
      };
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
export type WhatsappMessage = Database["public"]["Tables"]["whatsapp_message"]["Row"];
export type WhatsappConversation =
  Database["public"]["Functions"]["list_whatsapp_conversations"]["Returns"][number];
export type Contact = Database["public"]["Tables"]["contact"]["Row"];
export type ContactInsert = Database["public"]["Tables"]["contact"]["Insert"];
export type ContactImport = Database["public"]["Tables"]["contact_import"]["Row"];
export type Template = Database["public"]["Tables"]["template"]["Row"];
export type Segment = Database["public"]["Tables"]["segment"]["Row"];
export type Flow = Database["public"]["Tables"]["flow"]["Row"];
export type Campaign = Database["public"]["Tables"]["campaign"]["Row"];
export type FlowRun = Database["public"]["Tables"]["flow_run"]["Row"];
export type FlowFolder = Database["public"]["Tables"]["flow_folder"]["Row"];
export type SegmentInsert = Database["public"]["Tables"]["segment"]["Insert"];
export type Dispatch = Database["public"]["Tables"]["dispatch"]["Row"];
export type DispatchInsert = Database["public"]["Tables"]["dispatch"]["Insert"];
export type DispatchRecipient = Database["public"]["Tables"]["dispatch_recipient"]["Row"];
export type DispatchRecipientInsert = Database["public"]["Tables"]["dispatch_recipient"]["Insert"];
export type DispatchStatus = Dispatch["status"];
export type DispatchRecipientStatus = DispatchRecipient["status"];
