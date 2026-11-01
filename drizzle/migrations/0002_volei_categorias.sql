-- Vôlei de quadra e areia, categorias e naipes, administrador "Admin".

-- Categorias e naipes: cada categoria/naipe é um torneio filho (parent_id) com equipes,
-- formato, chave e jogos próprios. O torneio principal guarda nome, local, datas,
-- identidade visual, regulamento e publicação.
alter table public.tournaments add column if not exists parent_id uuid references public.tournaments(id) on delete cascade;
alter table public.tournaments add column if not exists category text;
alter table public.tournaments add column if not exists naipe text;
create index if not exists tournaments_parent_id_idx on public.tournaments(parent_id);

-- Pontos de cada set: [{"h": 25, "a": 20}, {"h": 18, "a": 12}]. home_score/away_score = sets vencidos.
alter table public.matches add column if not exists sets jsonb not null default '[]'::jsonb;

-- Quem edita o torneio principal edita todas as categorias dele.
create or replace function public.can_edit_tournament(_tid uuid) returns boolean language sql stable security definer set search_path = public as $$
  with t as (select id, coalesce(parent_id, id) as root from public.tournaments where id = _tid)
  select exists (select 1 from public.tournaments x join t on x.id in (t.id, t.root) where x.owner_id = auth.uid())
      or exists (
        select 1 from public.tournament_members m join t on m.tournament_id in (t.id, t.root)
        where lower(m.email) = lower(coalesce(auth.jwt()->>'email', ''))
      );
$$;

-- Uma categoria é pública quando o torneio principal está publicado.
create or replace function public.is_tournament_public(_tid uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.tournaments t left join public.tournaments p on p.id = t.parent_id
    where t.id = _tid and (t.published or coalesce(p.published, false))
  );
$$;

drop policy if exists "public read published" on public.tournaments;
create policy "public read published" on public.tournaments for select to anon, authenticated
  using (public.is_tournament_public(id) or public.can_edit_tournament(id));

drop policy if exists "owner insert" on public.tournaments;
create policy "owner insert" on public.tournaments for insert to authenticated
  with check (owner_id = auth.uid() and (parent_id is null or public.can_edit_tournament(parent_id)));

drop policy if exists "owner delete" on public.tournaments;
create policy "owner delete" on public.tournaments for delete to authenticated
  using (owner_id = auth.uid() or (parent_id is not null and public.can_edit_tournament(parent_id)));

-- No vôlei o placar é calculado pela súmula a partir dos pontos de cada set;
-- o gatilho antigo somaria pontos de rali direto no número de sets.
create or replace function public.apply_event_score() returns trigger language plpgsql security definer set search_path = public as $$
declare et record; m record; sign int; target_home boolean; ev record; sp text;
begin
  if tg_op = 'INSERT' then ev := new; sign := 1; else ev := old; sign := -1; end if;
  select sport into sp from public.tournaments where id = ev.tournament_id;
  if sp like 'volei%' then return null; end if;
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

-- Administrador "Admin" (login por nome de usuário). A conta é criada no primeiro acesso
-- com a senha temporária 12345678, e o sistema exige a troca logo depois.
insert into public.app_admins (email) values ('tm776968+u-admin@gmail.com') on conflict (email) do nothing;
