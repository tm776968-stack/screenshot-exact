-- Administradores do sistema (identificados pelo e-mail).
create table if not exists public.app_admins (
  email text primary key,
  created_at timestamptz not null default now()
);
grant select on public.app_admins to authenticated;
grant all on public.app_admins to service_role;
alter table public.app_admins enable row level security;
create policy "admin reads own row" on public.app_admins for select to authenticated
  using (lower(email) = lower(coalesce(auth.jwt()->>'email', '')));

insert into public.app_admins (email) values ('tm776968@gmail.com') on conflict (email) do nothing;

create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.app_admins a where lower(a.email) = lower(coalesce(auth.jwt()->>'email', '')));
$$;

-- Tentativas de login erradas por e-mail. Só o servidor (service role) lê e escreve.
create table if not exists public.login_attempts (
  email text primary key,
  failed int not null default 0,
  locked boolean not null default false,
  last_attempt_at timestamptz not null default now()
);
grant all on public.login_attempts to service_role;
alter table public.login_attempts enable row level security;

-- Cadastro só pelo administrador: contas novas precisam vir da API administrativa
-- (app_metadata.created_by_admin = true), que só o servidor consegue chamar.
create or replace function public.block_self_signup() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(new.raw_app_meta_data->>'created_by_admin', '') <> 'true' then
    raise exception 'Cadastro desabilitado: peça ao administrador para criar sua conta.';
  end if;
  return new;
end $$;
drop trigger if exists block_self_signup on auth.users;
create trigger block_self_signup before insert on auth.users for each row execute function public.block_self_signup();
