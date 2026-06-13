-- ============================================================================
-- Bussola Legislativa - Views/RPC/RLS do dashboard em tempo real
-- Projeto Supabase: yipwbjexekvrqgnpvjfn (schema public)
-- Toda a agregacao roda no Postgres; o front so consome (read-only via anon).
-- Idempotente: create or replace + drop policy if exists.
-- ============================================================================

-- ============ KPIs globais ============
create or replace view vw_kpis as
select
  (select count(*) from fato_proposicoes) as proposicoes,
  (select count(*) from fato_proposicoes where tema_id is not null) as com_tema,
  (select count(*) from fato_proposicoes where resumo_executivo is not null) as com_resumo,
  (select count(*) from fato_proposicoes where embedding is not null) as com_embedding,
  (select count(*) from fato_proposicoes where autor_id is not null) as com_autor,
  (select count(*) from dim_deputados) as deputados,
  (select count(distinct uf) from dim_deputados) as ufs,
  (select count(*) from dim_partidos) as partidos,
  (select count(*) from dim_temas) as temas,
  (select count(*) from fato_votacoes) as votacoes,
  (select count(*) from fato_despesas) as despesas_docs,
  (select coalesce(sum(valor_liquido),0) from fato_despesas) as despesas_total,
  (select min(data_apresentacao) from fato_proposicoes) as data_min,
  (select max(data_apresentacao) from fato_proposicoes) as data_max,
  (select max(ingested_at) from fato_proposicoes) as ultima_carga;

-- ============ Proposicoes ============
create or replace view vw_proposicoes_por_tipo as
select tipo, count(*) as qtd from fato_proposicoes group by tipo order by qtd desc;

create or replace view vw_proposicoes_por_tema as
select t.tema_id, t.nome as tema, t.critico, count(p.proposicao_id) as qtd
from dim_temas t
left join fato_proposicoes p on p.tema_id = t.tema_id
group by t.tema_id, t.nome, t.critico
order by qtd desc;

create or replace view vw_proposicoes_serie_diaria as
select data_apresentacao as dia, count(*) as qtd
from fato_proposicoes
where data_apresentacao is not null
group by data_apresentacao order by data_apresentacao;

create or replace view vw_proposicoes_serie_semanal as
select date_trunc('week', data_apresentacao)::date as semana, count(*) as qtd
from fato_proposicoes
where data_apresentacao is not null
group by 1 order by 1;

-- por ano (entender dispersao temporal)
create or replace view vw_proposicoes_por_ano as
select extract(year from data_apresentacao)::int as ano, count(*) as qtd
from fato_proposicoes where data_apresentacao is not null
group by 1 order by 1;

-- ============ Score de relevancia (auto-ativa peso_votacao quando houver vinculo) ============
create or replace view vw_proposicoes_score as
select p.proposicao_id, p.tipo, p.data_apresentacao, p.ementa, p.resumo_executivo,
       t.nome as tema, coalesce(t.critico,false) as critico,
       (case when p.tipo in ('PL','PLP','PEC','MPV') then 3
             when p.tipo in ('PDL','PLV') then 2 else 1 end)
     + (case when t.critico then 3 else 1 end)
     + (case when extract(year from p.data_apresentacao) >= 2026 then 4
             when extract(year from p.data_apresentacao) = 2025 then 3
             when extract(year from p.data_apresentacao) = 2024 then 2
             when extract(year from p.data_apresentacao) >= 2022 then 1 else 0.5 end)
     + (case when exists (select 1 from fato_votacoes v where v.proposicao_id = p.proposicao_id) then 2 else 0 end)
       as score_relevancia
from fato_proposicoes p
left join dim_temas t on t.tema_id = p.tema_id;

-- Explorador filtravel (tema / tipo / busca textual) - usado na secao IA
create or replace function fn_proposicoes_enriquecidas(
  p_tema text default null,
  p_tipo text default null,
  p_busca text default null,
  p_limit int default 80
)
returns table(
  proposicao_id int, tipo text, data_apresentacao date,
  tema text, critico bool, ementa text, resumo_executivo text, score numeric
)
language sql stable as $$
  select s.proposicao_id, s.tipo, s.data_apresentacao, s.tema, s.critico,
         s.ementa, s.resumo_executivo, s.score_relevancia
  from vw_proposicoes_score s
  where s.resumo_executivo is not null
    and (p_tema is null or s.tema = p_tema)
    and (p_tipo is null or s.tipo = p_tipo)
    and (p_busca is null or (s.ementa ilike '%'||p_busca||'%' or s.resumo_executivo ilike '%'||p_busca||'%'))
  order by s.score_relevancia desc, s.data_apresentacao desc
  limit p_limit;
$$;

-- ============ Deputados / Partidos ============
create or replace view vw_deputados_por_partido as
select p.partido_id, p.sigla, p.nome, count(d.deputado_id) as deputados
from dim_partidos p
left join dim_deputados d on d.partido_id = p.partido_id
group by p.partido_id, p.sigla, p.nome order by deputados desc;

create or replace view vw_deputados_por_uf as
select uf, count(*) as deputados from dim_deputados group by uf order by deputados desc;

-- autoria (vazio hoje; preenche sozinho quando autor_id existir)
create or replace view vw_proposicoes_por_partido_autor as
select p2.sigla, count(*) as qtd
from fato_proposicoes pr
join dim_deputados d on d.deputado_id = pr.autor_id
left join dim_partidos p2 on p2.partido_id = d.partido_id
group by p2.sigla order by qtd desc;

create or replace view vw_top_deputados_autoria as
select d.deputado_id, d.nome, p.sigla as partido, d.uf, count(*) as proposicoes
from fato_proposicoes pr
join dim_deputados d on d.deputado_id = pr.autor_id
left join dim_partidos p on p.partido_id = d.partido_id
group by d.deputado_id, d.nome, p.sigla, d.uf order by proposicoes desc;

-- ============ Despesas (CEAP) ============
create or replace view vw_despesas_por_partido as
select p.sigla, coalesce(sum(f.valor_liquido),0) as total, count(*) as docs
from fato_despesas f
join dim_deputados d on d.deputado_id = f.deputado_id
left join dim_partidos p on p.partido_id = d.partido_id
group by p.sigla order by total desc;

create or replace view vw_despesas_por_categoria as
select tipo_despesa as categoria, coalesce(sum(valor_liquido),0) as total, count(*) as docs
from fato_despesas group by tipo_despesa order by total desc;

create or replace view vw_top_deputados_despesa as
select d.deputado_id, d.nome, p.sigla as partido, d.uf,
       coalesce(sum(f.valor_liquido),0) as total, count(*) as docs
from fato_despesas f
join dim_deputados d on d.deputado_id = f.deputado_id
left join dim_partidos p on p.partido_id = d.partido_id
group by d.deputado_id, d.nome, p.sigla, d.uf order by total desc;

create or replace view vw_despesas_serie_mensal as
select ano, mes, coalesce(sum(valor_liquido),0) as total, count(*) as docs
from fato_despesas group by ano, mes order by ano, mes;

create or replace view vw_top_fornecedores as
select fornecedor_nome, fornecedor_cnpj,
       coalesce(sum(valor_liquido),0) as total, count(*) as docs
from fato_despesas where fornecedor_nome is not null
group by fornecedor_nome, fornecedor_cnpj order by total desc limit 50;

-- ============ Votacoes ============
create or replace view vw_votacoes_resumo as
select count(*) as total,
       count(*) filter (where aprovacao is true) as aprovadas,
       count(*) filter (where aprovacao is false) as reprovadas,
       count(*) filter (where aprovacao is null) as sem_resultado,
       count(distinct orgao) as orgaos,
       count(*) filter (where proposicao_id is not null) as com_proposicao,
       min(data)::date as data_min, max(data)::date as data_max
from fato_votacoes;

create or replace view vw_votacoes_por_orgao as
select orgao, count(*) as qtd, count(*) filter (where aprovacao) as aprovadas
from fato_votacoes group by orgao order by qtd desc;

create or replace view vw_votacoes_serie as
select data::date as dia, count(*) as qtd
from fato_votacoes group by 1 order by 1;

-- ============ Alertas ============
create or replace view vw_alertas_criticas_recentes as
select p.proposicao_id, p.tipo, p.data_apresentacao, t.nome as tema, p.ementa
from fato_proposicoes p
join dim_temas t on t.tema_id = p.tema_id
where t.critico and p.data_apresentacao >= current_date - interval '30 days'
order by p.data_apresentacao desc;

create or replace view vw_criticas_classificadas_recentes as
select p.proposicao_id, p.tipo, p.data_apresentacao, t.nome as tema, p.ementa
from fato_proposicoes p
join dim_temas t on t.tema_id = p.tema_id
where t.critico
order by p.data_apresentacao desc
limit 12;

-- ============ Observabilidade / qualidade ============
create or replace view vw_data_quality as
select 'proposicoes_sem_tema' as metrica,
       count(*) filter (where tema_id is null) as valor, count(*) as total from fato_proposicoes
union all select 'proposicoes_sem_resumo',
       count(*) filter (where resumo_executivo is null), count(*) from fato_proposicoes
union all select 'proposicoes_sem_autor',
       count(*) filter (where autor_id is null), count(*) from fato_proposicoes
union all select 'votacoes_sem_proposicao',
       count(*) filter (where proposicao_id is null), count(*) from fato_votacoes;

-- ============ RLS de leitura publica + grants ============
alter table dim_partidos     enable row level security;
alter table dim_deputados    enable row level security;
alter table dim_temas        enable row level security;
alter table fato_proposicoes enable row level security;
alter table fato_votacoes    enable row level security;
alter table fato_despesas    enable row level security;

do $$
declare t text;
begin
  foreach t in array array['dim_partidos','dim_deputados','dim_temas','fato_proposicoes','fato_votacoes','fato_despesas']
  loop
    execute format('drop policy if exists leitura_publica on %I;', t);
    execute format('create policy leitura_publica on %I for select using (true);', t);
  end loop;
end $$;

grant usage on schema public to anon, authenticated;
grant select on all tables in schema public to anon, authenticated;
grant execute on function fn_proposicoes_enriquecidas(text,text,text,int) to anon, authenticated;

-- ============ (OPCIONAL) Realtime para contadores ao vivo ============
-- Descomente para o bonus de Supabase Realtime (insert -> mutate no SWR).
-- E seguro: apenas adiciona as tabelas a publicacao; nao afeta o pipeline.
-- alter publication supabase_realtime add table fato_proposicoes;
-- alter publication supabase_realtime add table fato_despesas;
