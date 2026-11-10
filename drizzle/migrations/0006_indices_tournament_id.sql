-- Índices para as consultas por torneio (carga do torneio, atualização leve do placar e
-- verificações de permissão do tempo real). Todos são criados só se ainda não existirem.
create index if not exists matches_tournament_id_idx on public.matches (tournament_id);
create index if not exists match_events_tournament_id_idx on public.match_events (tournament_id);
create index if not exists teams_tournament_id_idx on public.teams (tournament_id);
create index if not exists players_tournament_id_idx on public.players (tournament_id);

-- A atualização leve busca os eventos só das partidas ao vivo (filtro por match_id).
create index if not exists match_events_match_id_idx on public.match_events (match_id);
