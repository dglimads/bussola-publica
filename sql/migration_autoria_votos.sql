-- =============================================================================
-- Bussola Publica -- Migration: Autoria (N:N) + Votos nominais
-- Roadmap pos V1: ponte proposicao<->autor, votacao<->proposicao, voto por deputado
-- =============================================================================
-- COMO RODAR (Supabase > SQL Editor, ou psql apontando para DATABASE_URL):
--   Cole este arquivo inteiro e execute. E IDEMPOTENTE -- pode rodar varias vezes.
--
-- PRE-REQUISITO: schema base ja aplicado (sql/schema.sql) e dados carregados.
-- NAO destrutivo: so adiciona tabelas/colunas/views (IF NOT EXISTS / OR REPLACE).
--
-- DECISAO DE MODELAGEM
--   A relacao proposicao<->autor e N:N (coautoria). O endpoint /proposicoes NAO
--   traz o autor; ele vem de /proposicoes/{id}/autores. Por isso a coluna legada
--   fato_proposicoes.autor_id e abandonada como base analitica e a verdade passa
--   a ser a tabela ponte_proposicao_autores.
--
--   A ponte NAO tem FK rigida para dim_deputados/dim_partidos de proposito: um
--   autor pode ser deputado de legislatura anterior (fora das 523 linhas atuais),
--   comissao, Senado, Poder Executivo ou orgao. Resolvemos o vinculo por LEFT JOIN
--   nas views e registramos divergencias em pipeline_erros, sem bloquear a carga.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Tabela ponte: proposicao <-> autor (N:N)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ponte_proposicao_autores (
    id                BIGSERIAL    PRIMARY KEY,
    proposicao_id     INTEGER      NOT NULL,
    autor_id          INTEGER,                       -- id cru extraido da uri (pode ser deputado, partido, orgao)
    autor_tipo        TEXT         NOT NULL,          -- string crua da API: 'Deputado(a)', 'COMISSAO PERMANENTE', 'Orgao do Poder Executivo', ...
    deputado_id       INTEGER,                        -- preenchido quando a uri e /deputados/{id}
    partido_id        INTEGER,                        -- preenchido quando a uri e /partidos/{id}
    nome_autor        TEXT         NOT NULL,
    cod_tipo_autor    INTEGER,
    ordem_assinatura  INTEGER,
    proponente        BOOLEAN      NOT NULL DEFAULT FALSE,
    uri_autor         TEXT,
    raw_payload       JSONB,
    criado_em         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    atualizado_em     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Chave de idempotencia (upsert). UNIQUE com expressao exige indice unico, nao
-- constraint -- por isso COALESCE(uri_autor,'') vai aqui e nao numa CONSTRAINT.
CREATE UNIQUE INDEX IF NOT EXISTS uq_ponte_proposicao_autores
    ON public.ponte_proposicao_autores (proposicao_id, autor_tipo, nome_autor, COALESCE(uri_autor, ''));

CREATE INDEX IF NOT EXISTS idx_ppa_proposicao_id ON public.ponte_proposicao_autores (proposicao_id);
CREATE INDEX IF NOT EXISTS idx_ppa_deputado_id   ON public.ponte_proposicao_autores (deputado_id);
CREATE INDEX IF NOT EXISTS idx_ppa_partido_id    ON public.ponte_proposicao_autores (partido_id);
CREATE INDEX IF NOT EXISTS idx_ppa_autor_tipo    ON public.ponte_proposicao_autores (autor_tipo);
CREATE INDEX IF NOT EXISTS idx_ppa_proponente    ON public.ponte_proposicao_autores (proponente);

-- -----------------------------------------------------------------------------
-- 2. Colunas auxiliares em fato_proposicoes (desnormalizacao p/ cards/filtros)
--    A relacao oficial continua sendo a ponte; estes campos so aceleram leituras.
-- -----------------------------------------------------------------------------
ALTER TABLE public.fato_proposicoes
    ADD COLUMN IF NOT EXISTS autores_carregados          BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS qtd_autores                 INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS autor_principal_nome        TEXT,
    ADD COLUMN IF NOT EXISTS autor_principal_tipo        TEXT,
    ADD COLUMN IF NOT EXISTS autor_principal_deputado_id INTEGER,
    ADD COLUMN IF NOT EXISTS autor_principal_partido_id  INTEGER;

-- -----------------------------------------------------------------------------
-- 3. Votos nominais por deputado (uma linha por deputado x votacao)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fato_votacao_votos (
    id                  BIGSERIAL   PRIMARY KEY,
    votacao_id          TEXT        NOT NULL,
    deputado_id         INTEGER     NOT NULL,
    tipo_voto           TEXT,                         -- 'Sim', 'Nao', 'Obstrucao', 'Abstencao', ...
    sigla_partido_voto  TEXT,                         -- partido NO MOMENTO do voto (pode diferir do atual)
    sigla_uf_voto       TEXT,
    data_registro_voto  TIMESTAMPTZ,
    raw_payload         JSONB,
    criado_em           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_fato_votacao_votos UNIQUE (votacao_id, deputado_id),
    CONSTRAINT fk_fvv_votacao FOREIGN KEY (votacao_id)
        REFERENCES public.fato_votacoes (votacao_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_fvv_votacao_id    ON public.fato_votacao_votos (votacao_id);
CREATE INDEX IF NOT EXISTS idx_fvv_deputado_id   ON public.fato_votacao_votos (deputado_id);
CREATE INDEX IF NOT EXISTS idx_fvv_tipo_voto     ON public.fato_votacao_votos (tipo_voto);
CREATE INDEX IF NOT EXISTS idx_fvv_partido_voto  ON public.fato_votacao_votos (sigla_partido_voto);

-- -----------------------------------------------------------------------------
-- 4. Colunas auxiliares em fato_votacoes (proposicao_id ja existe no schema base)
-- -----------------------------------------------------------------------------
ALTER TABLE public.fato_votacoes
    ADD COLUMN IF NOT EXISTS uri_proposicao    TEXT,
    ADD COLUMN IF NOT EXISTS objeto_votacao    TEXT,
    ADD COLUMN IF NOT EXISTS cod_tipo_votacao  INTEGER,
    ADD COLUMN IF NOT EXISTS votos_carregados  BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS qtd_votos         INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_fato_votacoes_proposicao_id
    ON public.fato_votacoes (proposicao_id);

-- -----------------------------------------------------------------------------
-- 5. Log de erros do pipeline (nao bloqueante)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pipeline_erros (
    id            BIGSERIAL   PRIMARY KEY,
    etapa         TEXT        NOT NULL,   -- 'autores' | 'votos' | 'vinculo_votacao'
    entidade_tipo TEXT,                   -- 'proposicao' | 'votacao' | 'autor' | 'voto'
    entidade_id   TEXT,
    mensagem      TEXT,
    payload       JSONB,
    criado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pipeline_erros_etapa ON public.pipeline_erros (etapa);

-- =============================================================================
-- 6. VIEWS AGREGADAS (consumidas pelo dashboard via PostgREST)
-- =============================================================================
-- Nota de schema: dim_deputados resolve o partido por FK (partido_id), nao por
-- uma coluna sigla_partido. Por isso as views fazem JOIN em dim_partidos para
-- obter a sigla -- adaptacao ao schema real do projeto.

-- 6.1 Heatmap tema x partido (autoria real via ponte) ------------------------
CREATE OR REPLACE VIEW public.vw_heatmap_tema_partido AS
SELECT
    COALESCE(dp_part.sigla, dp_dep.sigla, 'N/I')         AS sigla_partido,
    COALESCE(dt.nome, 'Sem tema')                        AS tema,
    fp.tema_id                                           AS tema_id,
    COALESCE(dt.critico, FALSE)                          AS critico,
    COUNT(DISTINCT fp.proposicao_id)                     AS qtd_proposicoes,
    COUNT(DISTINCT ppa.deputado_id)                      AS qtd_deputados_autores
FROM public.fato_proposicoes fp
JOIN public.ponte_proposicao_autores ppa ON ppa.proposicao_id = fp.proposicao_id
LEFT JOIN public.dim_deputados dd        ON dd.deputado_id = ppa.deputado_id
LEFT JOIN public.dim_partidos dp_dep     ON dp_dep.partido_id = dd.partido_id   -- partido do deputado autor
LEFT JOIN public.dim_partidos dp_part    ON dp_part.partido_id = ppa.partido_id -- quando o autor e o proprio partido
LEFT JOIN public.dim_temas dt            ON dt.tema_id = fp.tema_id
WHERE COALESCE(dp_part.sigla, dp_dep.sigla) IS NOT NULL  -- so partidos resolviveis (exclui comissao/executivo)
GROUP BY COALESCE(dp_part.sigla, dp_dep.sigla, 'N/I'), COALESCE(dt.nome, 'Sem tema'), fp.tema_id, dt.critico;

-- 6.2 Proposicoes por deputado (autoria) -------------------------------------
CREATE OR REPLACE VIEW public.vw_proposicoes_por_deputado AS
SELECT
    dd.deputado_id,
    dd.nome                                       AS deputado,
    dp.sigla                                      AS sigla_partido,
    dd.uf,
    COUNT(DISTINCT fp.proposicao_id)              AS qtd_proposicoes,
    COUNT(DISTINCT fp.tema_id)                    AS qtd_temas,
    SUM(CASE WHEN ppa.proponente THEN 1 ELSE 0 END) AS qtd_como_proponente
FROM public.ponte_proposicao_autores ppa
JOIN public.fato_proposicoes fp ON fp.proposicao_id = ppa.proposicao_id
JOIN public.dim_deputados dd    ON dd.deputado_id = ppa.deputado_id
LEFT JOIN public.dim_partidos dp ON dp.partido_id = dd.partido_id
WHERE ppa.deputado_id IS NOT NULL
GROUP BY dd.deputado_id, dd.nome, dp.sigla, dd.uf;

-- 6.3 Proposicoes por partido (autoria) --------------------------------------
CREATE OR REPLACE VIEW public.vw_proposicoes_por_partido AS
SELECT
    COALESCE(dp_part.partido_id, dp_dep.partido_id)      AS partido_id,
    COALESCE(dp_part.sigla, dp_dep.sigla, 'N/I')         AS sigla_partido,
    COUNT(DISTINCT fp.proposicao_id)                     AS qtd_proposicoes,
    COUNT(DISTINCT ppa.deputado_id)                      AS qtd_deputados_autores,
    SUM(CASE WHEN ppa.proponente THEN 1 ELSE 0 END)      AS qtd_proponente
FROM public.ponte_proposicao_autores ppa
JOIN public.fato_proposicoes fp ON fp.proposicao_id = ppa.proposicao_id
LEFT JOIN public.dim_deputados dd     ON dd.deputado_id = ppa.deputado_id
LEFT JOIN public.dim_partidos dp_dep  ON dp_dep.partido_id = dd.partido_id
LEFT JOIN public.dim_partidos dp_part ON dp_part.partido_id = ppa.partido_id
WHERE COALESCE(dp_part.sigla, dp_dep.sigla) IS NOT NULL
GROUP BY COALESCE(dp_part.partido_id, dp_dep.partido_id), COALESCE(dp_part.sigla, dp_dep.sigla, 'N/I');

-- 6.4 Votos por partido x tema -----------------------------------------------
CREATE OR REPLACE VIEW public.vw_votos_partido_tema AS
SELECT
    COALESCE(fvv.sigla_partido_voto, dp.sigla, 'N/I')    AS sigla_partido,
    COALESCE(dt.nome, 'Sem tema')                        AS tema,
    fvv.tipo_voto,
    COUNT(*)                                             AS qtd_votos,
    COUNT(DISTINCT fvv.deputado_id)                      AS qtd_deputados,
    COUNT(DISTINCT fv.votacao_id)                        AS qtd_votacoes
FROM public.fato_votacao_votos fvv
JOIN public.fato_votacoes fv      ON fv.votacao_id = fvv.votacao_id
LEFT JOIN public.fato_proposicoes fp ON fp.proposicao_id = fv.proposicao_id
LEFT JOIN public.dim_temas dt        ON dt.tema_id = fp.tema_id
LEFT JOIN public.dim_deputados dd    ON dd.deputado_id = fvv.deputado_id
LEFT JOIN public.dim_partidos dp     ON dp.partido_id = dd.partido_id
GROUP BY COALESCE(fvv.sigla_partido_voto, dp.sigla, 'N/I'), COALESCE(dt.nome, 'Sem tema'), fvv.tipo_voto;

-- 6.5 Votos por partido (agregado simples p/ grafico de barras) --------------
CREATE OR REPLACE VIEW public.vw_votos_por_partido AS
SELECT
    COALESCE(fvv.sigla_partido_voto, 'N/I') AS sigla,
    COUNT(*)                                AS qtd_votos,
    COUNT(*) FILTER (WHERE fvv.tipo_voto ILIKE 'sim%')                               AS sim,
    COUNT(*) FILTER (WHERE fvv.tipo_voto ILIKE 'nao%' OR fvv.tipo_voto ILIKE 'não%') AS nao,
    COUNT(DISTINCT fvv.deputado_id)         AS qtd_deputados
FROM public.fato_votacao_votos fvv
GROUP BY COALESCE(fvv.sigla_partido_voto, 'N/I')
ORDER BY COUNT(*) DESC;

-- -----------------------------------------------------------------------------
-- 6.6 REESCRITA das views de autoria que hoje dependem de fato_proposicoes.autor_id
--     (passam a ler a ponte). Mantem o MESMO contrato de colunas do dashboard.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.vw_proposicoes_por_partido_autor AS
SELECT
    COALESCE(dp_part.sigla, dp_dep.sigla, 'N/I') AS sigla,
    COUNT(DISTINCT ppa.proposicao_id)            AS qtd
FROM public.ponte_proposicao_autores ppa
LEFT JOIN public.dim_deputados dd     ON dd.deputado_id = ppa.deputado_id
LEFT JOIN public.dim_partidos dp_dep  ON dp_dep.partido_id = dd.partido_id
LEFT JOIN public.dim_partidos dp_part ON dp_part.partido_id = ppa.partido_id
WHERE COALESCE(dp_part.sigla, dp_dep.sigla) IS NOT NULL
GROUP BY COALESCE(dp_part.sigla, dp_dep.sigla, 'N/I')
ORDER BY COUNT(DISTINCT ppa.proposicao_id) DESC;

CREATE OR REPLACE VIEW public.vw_top_deputados_autoria AS
SELECT
    dd.deputado_id,
    dd.nome,
    dp.sigla                          AS partido,
    dd.uf,
    COUNT(DISTINCT ppa.proposicao_id) AS proposicoes
FROM public.ponte_proposicao_autores ppa
JOIN public.dim_deputados dd     ON dd.deputado_id = ppa.deputado_id
LEFT JOIN public.dim_partidos dp ON dp.partido_id = dd.partido_id
WHERE ppa.deputado_id IS NOT NULL
GROUP BY dd.deputado_id, dd.nome, dp.sigla, dd.uf
ORDER BY COUNT(DISTINCT ppa.proposicao_id) DESC;

-- -----------------------------------------------------------------------------
-- 6.7 KPIs: com_autor passa a refletir a ponte (autores_carregados).
--     Adiciona votos_nominais e votacoes_com_votos (cobertura de votacoes).
-- -----------------------------------------------------------------------------
-- IMPORTANTE: a ordem das 15 primeiras colunas espelha a view existente. As 2
-- colunas novas (votacoes_com_votos, votos_nominais) vao no FINAL -- requisito do
-- CREATE OR REPLACE VIEW (que so permite acrescentar colunas, nao reordenar).
CREATE OR REPLACE VIEW public.vw_kpis AS
SELECT
    (SELECT count(*) FROM fato_proposicoes)                                          AS proposicoes,
    (SELECT count(*) FROM fato_proposicoes WHERE tema_id IS NOT NULL)                AS com_tema,
    (SELECT count(*) FROM fato_proposicoes WHERE resumo_executivo IS NOT NULL)       AS com_resumo,
    (SELECT count(*) FROM fato_proposicoes WHERE embedding IS NOT NULL)              AS com_embedding,
    (SELECT count(*) FROM fato_proposicoes WHERE autores_carregados IS TRUE)         AS com_autor,
    (SELECT count(*) FROM dim_deputados)                                             AS deputados,
    (SELECT count(DISTINCT uf) FROM dim_deputados)                                   AS ufs,
    (SELECT count(*) FROM dim_partidos)                                              AS partidos,
    (SELECT count(*) FROM dim_temas)                                                 AS temas,
    (SELECT count(*) FROM fato_votacoes)                                             AS votacoes,
    (SELECT count(*) FROM fato_despesas)                                             AS despesas_docs,
    (SELECT COALESCE(sum(valor_liquido), 0::numeric) FROM fato_despesas)             AS despesas_total,
    (SELECT min(data_apresentacao) FROM fato_proposicoes)                            AS data_min,
    (SELECT max(data_apresentacao) FROM fato_proposicoes)                            AS data_max,
    (SELECT max(ingested_at) FROM fato_proposicoes)                                  AS ultima_carga,
    (SELECT count(*) FROM fato_votacoes WHERE votos_carregados IS TRUE)              AS votacoes_com_votos,
    (SELECT count(*) FROM fato_votacao_votos)                                        AS votos_nominais;

-- -----------------------------------------------------------------------------
-- 6.8 Qualidade de dados: usa as flags novas e cobre votos nominais.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.vw_data_quality AS
         SELECT 'proposicoes_sem_tema'::text   AS metrica, count(*) FILTER (WHERE tema_id IS NULL)            AS valor, count(*) AS total FROM fato_proposicoes
UNION ALL SELECT 'proposicoes_sem_resumo'::text,           count(*) FILTER (WHERE resumo_executivo IS NULL),         count(*)          FROM fato_proposicoes
UNION ALL SELECT 'proposicoes_sem_autor'::text,            count(*) FILTER (WHERE NOT autores_carregados),           count(*)          FROM fato_proposicoes
UNION ALL SELECT 'votacoes_sem_proposicao'::text,          count(*) FILTER (WHERE proposicao_id IS NULL),            count(*)          FROM fato_votacoes
UNION ALL SELECT 'votacoes_sem_votos'::text,               count(*) FILTER (WHERE NOT votos_carregados),             count(*)          FROM fato_votacoes;

-- -----------------------------------------------------------------------------
-- 6.9 Resumo de votacoes: acrescenta cobertura de votos nominais.
-- -----------------------------------------------------------------------------
-- com_votos e votos_nominais vao no FINAL (CREATE OR REPLACE so acrescenta colunas).
CREATE OR REPLACE VIEW public.vw_votacoes_resumo AS
SELECT
    count(*)                                          AS total,
    count(*) FILTER (WHERE aprovacao IS TRUE)         AS aprovadas,
    count(*) FILTER (WHERE aprovacao IS FALSE)        AS reprovadas,
    count(*) FILTER (WHERE aprovacao IS NULL)         AS sem_resultado,
    count(DISTINCT orgao)                             AS orgaos,
    count(*) FILTER (WHERE proposicao_id IS NOT NULL) AS com_proposicao,
    min(data)::date                                   AS data_min,
    max(data)::date                                   AS data_max,
    count(*) FILTER (WHERE votos_carregados IS TRUE)  AS com_votos,
    COALESCE(sum(qtd_votos), 0)                       AS votos_nominais
FROM fato_votacoes;

-- =============================================================================
-- 7. VALIDACOES (rode apos o backfill -- todas devem fazer sentido)
-- =============================================================================
-- Cobertura de autoria:
--   SELECT count(*) total, count(*) FILTER (WHERE autores_carregados) com_autores,
--          round(100.0*count(*) FILTER (WHERE autores_carregados)/NULLIF(count(*),0),2) pct
--   FROM fato_proposicoes;
--
-- Ponte preenchida:
--   SELECT count(*) linhas, count(DISTINCT proposicao_id) props,
--          count(DISTINCT deputado_id) FILTER (WHERE deputado_id IS NOT NULL) deps,
--          count(DISTINCT partido_id)  FILTER (WHERE partido_id  IS NOT NULL) parts
--   FROM ponte_proposicao_autores;
--
-- Heatmap (amostra):
--   SELECT sigla_partido, tema, qtd_proposicoes FROM vw_heatmap_tema_partido
--   ORDER BY qtd_proposicoes DESC LIMIT 50;
--
-- Cobertura de votos:
--   SELECT count(*) total, count(*) FILTER (WHERE votos_carregados) com_votos
--   FROM fato_votacoes;
-- =============================================================================
