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
 * Retorna conexão Meta + phone numbers do workspace, ou null se não conectado.
 */
export async function getMetaConnection(workspaceId: string): Promise<MetaConnectionView | null> {
  const admin = createAdminClient();

  const { data: connection } = await admin
    .from("workspace_meta_connection")
    .select("*")
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (!connection) return null;

  const { data: phoneNumbers } = await admin
    .from("workspace_phone_number")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("display_phone_number", { ascending: true });

  return {
    connection,
    phoneNumbers: phoneNumbers ?? [],
  };
}
