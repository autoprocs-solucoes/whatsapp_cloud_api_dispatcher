-- =============================================================================
-- Rename contact.phone_number_id -> contact.user_id
-- =============================================================================

alter table public.contact
  rename column phone_number_id to user_id;

alter index if exists contact_workspace_phone_number_id_idx
  rename to contact_workspace_user_id_idx;
