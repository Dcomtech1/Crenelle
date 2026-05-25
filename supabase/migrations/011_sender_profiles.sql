-- ============================================================
-- GateKeep — Sender Profiles
-- Allows organizers to manage multiple branded email identities.
-- Each profile has a display name (From: header) and reply-to email.
-- An event can be linked to a specific profile; if none is set,
-- the organizer's default profile is used as a fallback.
-- ============================================================

-- Sender profiles table
create table public.sender_profiles (
  id            uuid        default gen_random_uuid() primary key,
  organizer_id  uuid        not null references auth.users(id) on delete cascade,
  display_name  text        not null,   -- shown in the "From:" header, e.g. "Acme Foundation"
  reply_to      text        not null,   -- organizer's contact email for this brand
  is_default    boolean     not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Enforce at most one default per organizer
-- (partial unique index — only one row where is_default = true per organizer)
create unique index sender_profiles_one_default_per_organizer
  on public.sender_profiles (organizer_id)
  where is_default = true;

-- Fast lookup by organizer
create index sender_profiles_organizer_id_idx
  on public.sender_profiles (organizer_id);

-- ── Row Level Security ──────────────────────────────────────────
alter table public.sender_profiles enable row level security;

create policy "Organizers manage their own sender profiles"
  on public.sender_profiles for all
  using (auth.uid() = organizer_id);

-- ── Link events to a sender profile ────────────────────────────
-- Nullable: null means "use default profile or auth user fallback"
alter table public.events
  add column sender_profile_id uuid
  references public.sender_profiles(id) on delete set null;

-- ── Updated-at trigger ──────────────────────────────────────────
create trigger sender_profiles_updated_at
  before update on public.sender_profiles
  for each row execute procedure public.handle_updated_at();
