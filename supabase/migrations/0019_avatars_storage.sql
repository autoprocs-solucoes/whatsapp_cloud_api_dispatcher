-- =============================================================================
-- Bucket público pra foto de perfil (profile.avatar_url, já existia mas nunca
-- tinha UI/upload). Upload sempre passa pelo server action com service_role
-- (nunca direto do client), então não depende de RLS de storage.objects pra
-- escrita — só precisa ser "public" pra servir a URL depois sem assinatura.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
