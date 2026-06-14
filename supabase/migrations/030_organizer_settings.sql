-- ============================================================
-- Crenelle — Organizer Settings
-- One row per organizer storing global defaults used across
-- all events: org name, timezone, currency, formats, email footer.
-- Completely separate from sender_profiles (which controls
-- email From:/Reply-To headers per branded identity).
-- ============================================================

create table public.organizer_settings (
  id                uuid        default gen_random_uuid() primary key,
  organizer_id      uuid        not null references auth.users(id) on delete cascade,
  org_name          text,                          -- master brand / organisation name
  default_timezone  text        not null default 'Africa/Lagos',
  default_currency  text        not null default 'NGN',
  date_format       text        not null default 'DD/MM/YYYY'
                    check (date_format in ('DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD')),
  clock_format      text        not null default '12h'
                    check (clock_format in ('12h', '24h')),
  email_footer      text,                          -- plain-text footer appended to all guest emails
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  -- One settings row per organizer
  unique (organizer_id)
);

-- Fast lookup by organizer
create index organizer_settings_organizer_id_idx
  on public.organizer_settings (organizer_id);

-- ── Row Level Security ───────────────────────────────────────────
alter table public.organizer_settings enable row level security;

create policy "Organizers manage their own settings"
  on public.organizer_settings for all
  using (auth.uid() = organizer_id)
  with check (auth.uid() = organizer_id);

-- ── Updated-at trigger ──────────────────────────────────────────
create trigger organizer_settings_updated_at
  before update on public.organizer_settings
  for each row execute procedure public.handle_updated_at();
