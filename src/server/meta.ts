import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type {
  WorkspaceMetaConnection,
  WorkspacePhoneNumber,
} from "@/lib/supabase/database.types";

export type MetaConnectionView = {
  connection: WorkspaceMetaConnection;
  phoneNumbers: WorkspacePhoneNumber[];
};

/**
 * Retorna todas as contas Meta conectadas do workspace (1 workspace pode ter
 * N WABAs), cada uma com seus próprios phone numbers.
 */
export async function getMetaConnections(workspaceId: string): Promise<MetaConnectionView[]> {
  const admin = createAdminClient();

  const { data: connections } = await admin
    .from("workspace_meta_connection")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("connected_at", { ascending: true });

  if (!connections || connections.length === 0) return [];

  const { data: phoneNumbers } = await admin
    .from("workspace_phone_number")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("display_phone_number", { ascending: true });

  return connections.map((connection) => ({
    connection,
    phoneNumbers: (phoneNumbers ?? []).filter((p) => p.connection_id === connection.id),
  }));
}

/**
 * Resolve a connection (WABA) dona de um phone_number_id específico —
 * essencial pra rotear o access_token certo no envio quando o workspace tem
 * mais de uma conta Meta conectada.
 */
export async function getConnectionForPhoneNumber(
  workspaceId: string,
  phoneNumberId: string,
): Promise<WorkspaceMetaConnection | null> {
  const admin = createAdminClient();

  const { data: phone } = await admin
    .from("workspace_phone_number")
    .select("connection_id")
    .eq("workspace_id", workspaceId)
    .eq("phone_number_id", phoneNumberId)
    .maybeSingle();
  if (!phone) return null;

  const { data: connection } = await admin
    .from("workspace_meta_connection")
    .select("*")
    .eq("id", phone.connection_id)
    .maybeSingle();
  return connection ?? null;
}
