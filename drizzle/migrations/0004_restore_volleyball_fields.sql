alter table public.tournaments add column if not exists parent_id uuid references public.tournaments(id) on delete cascade;
alter table public.tournaments add column if not exists category text;
alter table public.tournaments add column if not exists naipe text;
create index if not exists tournaments_parent_id_idx on public.tournaments(parent_id);
alter table public.matches add column if not exists sets jsonb not null default '[]'::jsonb;