-- Corrige a trava de cadastro: ela conferia app_metadata.created_by_admin no momento do INSERT,
-- mas o Supabase só grava o app_metadata depois. Resultado: nenhuma conta podia ser criada
-- ("Database error creating new user"), nem pelo administrador.
-- Agora o servidor envia uma chave secreta guardada no banco; o cadastro só passa com ela,
-- e a chave é apagada dos dados do usuário antes de gravar. Pode rodar mais de uma vez.

create table if not exists public.app_secrets (
  key text primary key,
  value text not null
);
alter table public.app_secrets enable row level security;
revoke all on public.app_secrets from anon, authenticated;
grant all on public.app_secrets to service_role;
insert into public.app_secrets (key, value)
values ('signup_token', md5(random()::text || clock_timestamp()::text) || md5(random()::text || clock_timestamp()::text))
on conflict (key) do nothing;

create or replace function public.block_self_signup() returns trigger language plpgsql security definer set search_path = public as $$
declare tok text;
begin
  if coalesce(new.raw_app_meta_data->>'created_by_admin', '') = 'true' then
    return new;
  end if;
  select value into tok from public.app_secrets where key = 'signup_token';
  if tok is not null and new.raw_user_meta_data->>'signup_token' = tok then
    new.raw_user_meta_data := new.raw_user_meta_data - 'signup_token';
    return new;
  end if;
  raise exception 'Cadastro desabilitado: peça ao administrador para criar sua conta.';
end $$;

drop trigger if exists block_self_signup on auth.users;
create trigger block_self_signup before insert on auth.users for each row execute function public.block_self_signup();

insert into public.app_admins (email) values ('tm776968+u-admin@gmail.com') on conflict (email) do nothing;
