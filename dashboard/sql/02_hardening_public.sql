-- ============================================================================
-- Hardening para publicacao PUBLICA do dashboard (servidor aberto a usuarios).
-- Projeto Supabase: yipwbjexekvrqgnpvjfn
--
-- Objetivo: com a anon key exposta no browser, reduzir a superficie ao minimo.
-- anon/authenticated passam a enxergar SOMENTE as views agregadas (vw_*) + a RPC.
-- A leitura direta das tabelas-base e REVOGADA -> nada de scraping de linhas
-- cruas, e-mails de deputados ou notas fiscais de fornecedores.
--
-- Por que continua funcionando: as views sao SECURITY DEFINER (owner = postgres)
-- e leem as tabelas-base como o owner; o front so precisa de SELECT nas views.
-- Escrita ja estava bloqueada (nenhuma policy de INSERT/UPDATE/DELETE p/ anon).
-- O pipeline (service_role / DATABASE_URL direta) nao e afetado.
-- ============================================================================

-- 1) tira a leitura direta das tabelas-base do anon (RLS continua habilitada)
revoke select on
  dim_partidos, dim_deputados, dim_temas,
  fato_proposicoes, fato_votacoes, fato_despesas
from anon, authenticated;

-- 2) garante leitura das views agregadas + execucao da RPC para o dashboard
grant usage on schema public to anon, authenticated;

do $$
declare v text;
begin
  for v in
    select table_name from information_schema.views
    where table_schema = 'public' and table_name like 'vw_%'
  loop
    execute format('grant select on public.%I to anon, authenticated;', v);
  end loop;
end $$;

grant execute on function fn_proposicoes_enriquecidas(text,text,text,int) to anon, authenticated;

-- Observacao: o bonus de Realtime (insert -> mutate no SWR) depende de leitura
-- direta de fato_proposicoes/fato_despesas. Como ela foi revogada acima, o
-- Realtime fica DESLIGADO por padrao no front (flag NEXT_PUBLIC_ENABLE_REALTIME).
-- O polling de 60s do SWR mantem o painel "ao vivo" sem expor as tabelas-base.
-- Para reativar Realtime (ambiente de demo controlado), rode:
--   grant select on fato_proposicoes, fato_despesas to anon;
--   alter publication supabase_realtime add table fato_proposicoes, fato_despesas;
