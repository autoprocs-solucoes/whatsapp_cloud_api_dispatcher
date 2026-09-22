-- =============================================================================
-- Bucket público pra mídia de fluxo (imagem, vídeo e arquivo dos blocos).
--
-- Precisa ser público porque quem baixa é a Meta: o envio manda um link e o
-- servidor dela busca o arquivo sem credencial nenhuma. O upload em si passa
-- sempre por server action com service_role, nunca direto do navegador.
--
-- Limites seguem os da Cloud API: imagem 5MB, vídeo 16MB, documento 100MB —
-- o teto do bucket fica no maior deles, e a validação por tipo é feita no
-- server action.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'flow-media',
  'flow-media',
  true,
  104857600,
  array[
    'image/png', 'image/jpeg', 'image/webp',
    'video/mp4', 'video/3gpp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
