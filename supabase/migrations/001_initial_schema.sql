-- ============================================================
-- Crenelle — Initial Database Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- Events table
create table public.events (
  id uuid default gen_random_uuid() primary key,
  organizer_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  date date not null,
  time time,
  venue text not null,
  description text,
  capacity integer,
  status text default 'active' check (status in ('draft', 'active', 'ended')),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Guests table
create table public.guests (
  id uuid default gen_random_uuid() primary key,
  event_id uuid references public.events(id) on delete cascade not null,
  name text not null,
  phone text,
  email text,
  created_at timestamptz default now() not null
);

-- Invitations table (each row = one unique QR code)
-- The invitation ID *is* the QR code value
create table public.invitations (
  id uuid default gen_random_uuid() primary key,
  event_id uuid references public.events(id) on delete cascade not null,
  guest_id uuid references public.guests(id) on delete cascade not null,
  party_size integer default 1 not null check (party_size >= 1 and party_size <= 20),
  seat_info text,
  status text default 'pending' check (status in ('pending', 'cancelled')),
  created_at timestamptz default now() not null
);

-- Scanner links table (shareable usher links — no login needed)
create table public.scanner_links (
  id uuid default gen_random_uuid() primary key,
  event_id uuid references public.events(id) on delete cascade not null,
  token text unique not null default encode(gen_random_bytes(16), 'hex'),
  label text not null default 'Main Entrance',
  is_active boolean default true not null,
  created_at timestamptz default now() not null
);

-- Entry logs table (written on every successful scan)
create table public.entry_logs (
  id uuid default gen_random_uuid() primary key,
  invitation_id uuid references public.invitations(id) on delete cascade not null unique,
  scanner_link_id uuid references public.scanner_links(id) on delete set null,
  scanned_at timestamptz default now() not null,
  notes text
);

-- ============================================================
-- Row Level Security
-- ============================================================

-- EVENTS
alter table public.events enable row level security;

create policy "Organizers manage their own events"
  on public.events for all
  using (auth.uid() = organizer_id);

-- GUESTS
alter table public.guests enable row level security;

create policy "Organizers manage guests for their events"
  on public.guests for all
  using (
    exists (
      select 1 from public.events
      where events.id = guests.event_id
      and events.organizer_id = auth.uid()
    )
  );

-- INVITATIONS
alter table public.invitations enable row level security;

create policy "Organizers manage invitations for their events"
  on public.invitations for all
  using (
    exists (
      select 1 from public.events
      where events.id = invitations.event_id
      and events.organizer_id = auth.uid()
    )
  );

-- Scanners can read any invitation (validated by token in API route)
create policy "Public can read invitations"
  on public.invitations for select
  using (true);

-- SCANNER LINKS
alter table public.scanner_links enable row level security;

create policy "Organizers manage scanner links for their events"
  on public.scanner_links for all
  using (
    exists (
      select 1 from public.events
      where events.id = scanner_links.event_id
      and events.organizer_id = auth.uid()
    )
  );

-- Ushers can read active scanner links to validate their token
create policy "Public can read active scanner links"
  on public.scanner_links for select
  using (is_active = true);

-- ENTRY LOGS
alter table public.entry_logs enable row level security;

create policy "Organizers can view entry logs for their events"
  on public.entry_logs for select
  using (
    exists (
      select 1 from public.invitations
      join public.events on events.id = invitations.event_id
      where invitations.id = entry_logs.invitation_id
      and events.organizer_id = auth.uid()
    )
  );

-- Scanner inserts entry logs (validated server-side via admin client)
create policy "Public can insert entry logs"
  on public.entry_logs for insert
  with check (true);

-- ============================================================
-- Updated-at trigger
-- ============================================================

create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger events_updated_at
  before update on public.events
  for each row execute procedure public.handle_updated_at();
