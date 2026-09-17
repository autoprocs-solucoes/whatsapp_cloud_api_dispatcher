"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/server/auth";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const MAX_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];
const EXT_BY_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

/**
 * Upload de foto de perfil — funciona igual pra qualquer usuário (cliente ou
 * admin master), já que é uma configuração pessoal (profile), não do
 * workspace. Sempre via admin client (service_role): storage.objects não tem
 * policy de client-side pra esse bucket, upload só acontece por aqui.
 */
export async function updateAvatarAction(formData: FormData): Promise<ActionResult<{ avatarUrl: string }>> {
  const user = await requireUser();

  const file = formData.get("avatar");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Selecione uma imagem" };
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { ok: false, error: "Formato inválido — use PNG, JPEG ou WebP" };
  }
  if (file.size > MAX_SIZE_BYTES) {
    return { ok: false, error: "Imagem muito grande (máx. 5MB)" };
  }

  const admin = createAdminClient();
  const ext = EXT_BY_TYPE[file.type] ?? "png";
  // Nome fixo por usuário (não timestamp) — upsert substitui a anterior e
  // evita acumular lixo órfão no bucket a cada troca de foto.
  const path = `${user.id}/avatar.${ext}`;

  const { error: uploadError } = await admin.storage.from("avatars").upload(path, file, {
    upsert: true,
    contentType: file.type,
    cacheControl: "3600",
  });
  if (uploadError) {
    return { ok: false, error: `Falha no upload: ${uploadError.message}` };
  }

  const {
    data: { publicUrl },
  } = admin.storage.from("avatars").getPublicUrl(path);
  // Cache-bust — mesmo path, senão o navegador/CDN mantém a imagem antiga.
  const bustedUrl = `${publicUrl}?v=${Date.now()}`;

  const { error: updateError } = await admin
    .from("profile")
    .update({ avatar_url: bustedUrl })
    .eq("user_id", user.id);
  if (updateError) {
    return { ok: false, error: `Falha ao salvar perfil: ${updateError.message}` };
  }

  // "layout" a partir da raiz — o avatar aparece no header em todo o app,
  // não só em /configuracoes.
  revalidatePath("/", "layout");
  return { ok: true, data: { avatarUrl: bustedUrl } };
}

export async function removeAvatarAction(): Promise<ActionResult> {
  const user = await requireUser();
  const admin = createAdminClient();

  const { error } = await admin.from("profile").update({ avatar_url: null }).eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}

/** Nome exibido do usuário (sidebar, time master, menus). */
export async function updateProfileNameAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();

  const fullName = String(formData.get("fullName") ?? "").trim();
  if (fullName.length < 2) {
    return { ok: false, error: "Informe um nome com pelo menos 2 caracteres" };
  }
  if (fullName.length > 80) {
    return { ok: false, error: "Nome muito longo (máx. 80 caracteres)" };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("profile")
    .update({ full_name: fullName })
    .eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}
