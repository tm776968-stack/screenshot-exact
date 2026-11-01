-- Categorias de volei: faixas de idade por torneio, atleta pode ter mais de uma
-- categoria, e cada jogo registra a categoria disputada.

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  name text not null,
  short_name text,
  birth_year_min int,
  birth_year_max int,
  sort int not null default 0,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tournament_id, name),
  unique (id, tournament_id)
);

comment on table public.categories is 'Categorias de faixa etaria do torneio (ex.: Sub-16).';
comment on column public.categories.birth_year_min is 'Ano de nascimento mais antigo permitido (null = sem limite).';
comment on column public.categories.birth_year_max is 'Ano de nascimento mais recente permitido (null = sem limite).';

create index categories_tournament_idx on public.categories (tournament_id);

grant select on public.categories to anon;
grant select, insert, update, delete on public.categories to authenticated;
grant all on public.categories to service_role;
alter table public.categories enable row level security;
create policy "read categories" on public.categories for select to anon, authenticated using (public.is_tournament_public(tournament_id) or public.can_edit_tournament(tournament_id));
create policy "insert categories" on public.categories for insert to authenticated with check (public.can_edit_tournament(tournament_id));
create policy "update categories" on public.categories for update to authenticated using (public.can_edit_tournament(tournament_id));
create policy "delete categories" on public.categories for delete to authenticated using (public.can_edit_tournament(tournament_id));

-- data de nascimento do atleta, para a faixa etaria poder ser conferida
alter table public.players add column birth_date date;
comment on column public.players.birth_date is 'Nascimento do atleta, usado para conferir a faixa etaria da categoria.';

alter table public.players add constraint players_id_tournament_key unique (id, tournament_id);

-- atleta pode pertencer a mais de uma categoria
create table public.player_categories (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  player_id uuid not null,
  category_id uuid not null,
  created_at timestamptz not null default now(),
  unique (player_id, category_id),
  constraint player_categories_player_fkey foreign key (player_id, tournament_id)
    references public.players(id, tournament_id) on delete cascade,
  constraint player_categories_category_fkey foreign key (category_id, tournament_id)
    references public.categories(id, tournament_id) on delete cascade
);

create index player_categories_category_idx on public.player_categories (category_id);
create index player_categories_player_idx on public.player_categories (player_id);

grant select on public.player_categories to anon;
grant select, insert, update, delete on public.player_categories to authenticated;
grant all on public.player_categories to service_role;
alter table public.player_categories enable row level security;
create policy "read player_categories" on public.player_categories for select to anon, authenticated using (public.is_tournament_public(tournament_id) or public.can_edit_tournament(tournament_id));
create policy "insert player_categories" on public.player_categories for insert to authenticated with check (public.can_edit_tournament(tournament_id));
create policy "update player_categories" on public.player_categories for update to authenticated using (public.can_edit_tournament(tournament_id));
create policy "delete player_categories" on public.player_categories for delete to authenticated using (public.can_edit_tournament(tournament_id));

-- cada jogo registra a categoria disputada
alter table public.matches add column category_id uuid;
comment on column public.matches.category_id is 'Categoria disputada nesta partida (null = torneio sem divisao por categoria).';

alter table public.matches add constraint matches_category_fkey
  foreign key (category_id, tournament_id) references public.categories(id, tournament_id) on delete restrict;

create index matches_category_idx on public.matches (category_id);

-- conferencia de faixa etaria: atleta esta na categoria e dentro do limite de idade
create or replace function public.is_player_eligible(_player_id uuid, _category_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.player_categories pc
    join public.categories c on c.id = pc.category_id
    join public.players p on p.id = pc.player_id
    where pc.player_id = _player_id
      and pc.category_id = _category_id
      and c.enabled
      and (
        p.birth_date is null
        or (
          (c.birth_year_min is null or extract(year from p.birth_date) >= c.birth_year_min)
          and (c.birth_year_max is null or extract(year from p.birth_date) <= c.birth_year_max)
        )
      )
  );
$$;

grant execute on function public.is_player_eligible(uuid, uuid) to anon, authenticated;
