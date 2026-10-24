
create type public.tournament_status as enum ('rascunho','inscricoes','andamento','finalizado');
create type public.match_status as enum ('agendado','ao_vivo','intervalo','encerrado','adiado','wo');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  email text,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "own profile read" on public.profiles for select to authenticated using (id = auth.uid());
create policy "own profile update" on public.profiles for update to authenticated using (id = auth.uid());
create policy "own profile insert" on public.profiles for insert to authenticated with check (id = auth.uid());

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email,'@',1)), new.email)
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create table public.tournaments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  slug text not null unique,
  name text not null,
  sport text not null default 'futebol',
  location text,
  start_date date,
  end_date date,
  logo_url text,
  banner_url text,
  rules text,
  status public.tournament_status not null default 'rascunho',
  published boolean not null default false,
  format text not null default 'pontos_corridos',
  settings jsonb not null default '{}'::jsonb,
  primary_color text,
  created_at timestamptz not null default now()
);

create table public.tournament_members (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now(),
  unique (tournament_id, email)
);

create or replace function public.can_edit_tournament(_tid uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.tournaments t where t.id = _tid and t.owner_id = auth.uid())
      or exists (select 1 from public.tournament_members m where m.tournament_id = _tid and lower(m.email) = lower(coalesce(auth.jwt()->>'email','')));
$$;
create or replace function public.is_tournament_public(_tid uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.tournaments t where t.id = _tid and t.published);
$$;

grant select on public.tournaments to anon;
grant select, insert, update, delete on public.tournaments to authenticated;
grant all on public.tournaments to service_role;
alter table public.tournaments enable row level security;
create policy "public read published" on public.tournaments for select to anon, authenticated using (published or public.can_edit_tournament(id));
create policy "owner insert" on public.tournaments for insert to authenticated with check (owner_id = auth.uid());
create policy "editors update" on public.tournaments for update to authenticated using (public.can_edit_tournament(id));
create policy "owner delete" on public.tournaments for delete to authenticated using (owner_id = auth.uid());

grant select, insert, delete on public.tournament_members to authenticated;
grant all on public.tournament_members to service_role;
alter table public.tournament_members enable row level security;
create policy "editors read members" on public.tournament_members for select to authenticated using (public.can_edit_tournament(tournament_id));
create policy "owner manages members ins" on public.tournament_members for insert to authenticated with check (exists (select 1 from public.tournaments t where t.id = tournament_id and t.owner_id = auth.uid()));
create policy "owner manages members del" on public.tournament_members for delete to authenticated using (exists (select 1 from public.tournaments t where t.id = tournament_id and t.owner_id = auth.uid()));

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  name text not null,
  logo_url text,
  color text,
  manager text,
  contact text,
  seed int,
  group_name text,
  created_at timestamptz not null default now()
);
create table public.players (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  name text not null,
  nickname text,
  number int,
  position text,
  photo_url text,
  created_at timestamptz not null default now()
);
create table public.venues (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  name text not null
);
create table public.matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  stage text not null default 'liga',
  round int not null default 1,
  group_name text,
  bracket_pos int,
  home_team_id uuid references public.teams(id) on delete set null,
  away_team_id uuid references public.teams(id) on delete set null,
  home_score int not null default 0,
  away_score int not null default 0,
  home_pens int,
  away_pens int,
  status public.match_status not null default 'agendado',
  scheduled_at timestamptz,
  venue_id uuid references public.venues(id) on delete set null,
  period int not null default 1,
  clock_started_at timestamptz,
  clock_elapsed int not null default 0,
  next_match_id uuid references public.matches(id) on delete set null,
  next_slot text,
  winner_team_id uuid references public.teams(id) on delete set null,
  created_at timestamptz not null default now()
);
create table public.event_types (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  key text not null,
  name text not null,
  icon text not null default '⚡',
  points int not null default 0,
  score_target text not null default 'own',
  enabled boolean not null default true,
  sort int not null default 0
);
create table public.match_events (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  match_id uuid not null references public.matches(id) on delete cascade,
  team_id uuid references public.teams(id) on delete set null,
  player_id uuid references public.players(id) on delete set null,
  event_type_id uuid not null references public.event_types(id) on delete cascade,
  minute int,
  period int,
  created_at timestamptz not null default now()
);

do $$ declare t text; begin
  foreach t in array array['teams','players','venues','matches','event_types','match_events'] loop
    execute format('grant select on public.%I to anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "read %1$s" on public.%1$I for select to anon, authenticated using (public.is_tournament_public(tournament_id) or public.can_edit_tournament(tournament_id))', t);
    execute format('create policy "insert %1$s" on public.%1$I for insert to authenticated with check (public.can_edit_tournament(tournament_id))', t);
    execute format('create policy "update %1$s" on public.%1$I for update to authenticated using (public.can_edit_tournament(tournament_id))', t);
    execute format('create policy "delete %1$s" on public.%1$I for delete to authenticated using (public.can_edit_tournament(tournament_id))', t);
  end loop;
end $$;

-- score from events
create or replace function public.apply_event_score() returns trigger language plpgsql security definer set search_path = public as $$
declare et record; m record; sign int; target_home boolean; ev record;
begin
  if tg_op = 'INSERT' then ev := new; sign := 1; else ev := old; sign := -1; end if;
  select * into et from public.event_types where id = ev.event_type_id;
  if et is null or et.points = 0 or ev.team_id is null then return null; end if;
  select * into m from public.matches where id = ev.match_id;
  if m is null then return null; end if;
  target_home := (ev.team_id = m.home_team_id);
  if et.score_target = 'opponent' then target_home := not target_home; end if;
  if target_home then
    update public.matches set home_score = greatest(0, home_score + sign*et.points) where id = m.id;
  else
    update public.matches set away_score = greatest(0, away_score + sign*et.points) where id = m.id;
  end if;
  return null;
end $$;
create trigger match_events_score after insert or delete on public.match_events for each row execute function public.apply_event_score();

-- auto-advance winner
create or replace function public.advance_winner() returns trigger language plpgsql security definer set search_path = public as $$
declare w uuid;
begin
  if new.status in ('encerrado','wo') and new.home_team_id is not null and new.away_team_id is not null then
    if new.home_score > new.away_score then w := new.home_team_id;
    elsif new.away_score > new.home_score then w := new.away_team_id;
    elsif coalesce(new.home_pens,0) > coalesce(new.away_pens,0) then w := new.home_team_id;
    elsif coalesce(new.away_pens,0) > coalesce(new.home_pens,0) then w := new.away_team_id;
    end if;
    if new.winner_team_id is distinct from w then
      new.winner_team_id := w;
    end if;
    if w is not null and new.next_match_id is not null then
      if new.next_slot = 'home' then update public.matches set home_team_id = w where id = new.next_match_id;
      else update public.matches set away_team_id = w where id = new.next_match_id; end if;
    end if;
    -- loser to 3rd place match
    if w is not null and new.stage = 'semi' then
      update public.matches set
        home_team_id = case when new.bracket_pos % 2 = 0 then (case when w = new.home_team_id then new.away_team_id else new.home_team_id end) else home_team_id end,
        away_team_id = case when new.bracket_pos % 2 = 1 then (case when w = new.home_team_id then new.away_team_id else new.home_team_id end) else away_team_id end
      where tournament_id = new.tournament_id and stage = 'terceiro';
    end if;
  end if;
  return new;
end $$;
create trigger matches_advance before update on public.matches for each row execute function public.advance_winner();

alter publication supabase_realtime add table public.matches;
alter publication supabase_realtime add table public.match_events;
alter table public.matches replica identity full;
alter table public.match_events replica identity full;
