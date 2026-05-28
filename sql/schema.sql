-- =============================================================================
-- Bussola Publica -- DDL do modelo dimensional
-- Sprint 2
-- =============================================================================
-- Pre-requisito no Supabase: habilitar extensao pgvector
-- CREATE EXTENSION IF NOT EXISTS vector;

-- -----------------------------------------------------------------------------
-- Dimensoes
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS dim_partidos (
    partido_id   INT         NOT NULL,
    sigla        TEXT        NOT NULL,
    nome         TEXT        NOT NULL,
    ingested_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT pk_dim_partidos PRIMARY KEY (partido_id)
);

CREATE TABLE IF NOT EXISTS dim_deputados (
    deputado_id    INT         NOT NULL,
    nome           TEXT        NOT NULL,
    partido_id     INT,
    uf             TEXT        NOT NULL,
    situacao       TEXT        NOT NULL DEFAULT 'Em exercício',
    email          TEXT,
    url_foto       TEXT,
    id_legislatura INT,
    uri_partido    TEXT,
    uri            TEXT,
    ingested_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT pk_dim_deputados   PRIMARY KEY (deputado_id),
    CONSTRAINT fk_dep_partido     FOREIGN KEY (partido_id) REFERENCES dim_partidos(partido_id)
);

CREATE TABLE IF NOT EXISTS dim_temas (
    tema_id     INT         NOT NULL,
    nome        TEXT        NOT NULL,
    descricao   TEXT,
    critico     BOOLEAN     NOT NULL DEFAULT FALSE,
    CONSTRAINT pk_dim_temas PRIMARY KEY (tema_id)
);

-- -----------------------------------------------------------------------------
-- Fatos
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS fato_proposicoes (
    proposicao_id      INT             NOT NULL,
    data_apresentacao  DATE,
    tipo               TEXT            NOT NULL,
    ementa             TEXT            NOT NULL,
    autor_id           INT,
    tema_id            INT,
    embedding          VECTOR(1536),
    resumo_executivo   TEXT,
    ingested_at        TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    CONSTRAINT pk_fato_proposicoes  PRIMARY KEY (proposicao_id),
    CONSTRAINT fk_prop_autor        FOREIGN KEY (autor_id)  REFERENCES dim_deputados(deputado_id),
    CONSTRAINT fk_prop_tema         FOREIGN KEY (tema_id)   REFERENCES dim_temas(tema_id)
);

-- fato_votacoes: cabecalho de votacao (uma linha por evento de votacao)
-- proposicao_id e nullable — nao conseguimos resolver o id a partir do texto proposicaoObjeto
-- Votos individuais (deputado x votacao) ficam para Sprint 3 via /votacoes/{id}/votos
CREATE TABLE IF NOT EXISTS fato_votacoes (
    votacao_id    TEXT        NOT NULL,
    proposicao_id INT,
    data          TIMESTAMPTZ NOT NULL,
    orgao         TEXT,
    descricao     TEXT,
    aprovacao     BOOLEAN,
    ingested_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT pk_fato_votacoes  PRIMARY KEY (votacao_id),
    CONSTRAINT fk_vot_prop       FOREIGN KEY (proposicao_id) REFERENCES fato_proposicoes(proposicao_id)
);

-- fato_despesas: CEAP — despesas declaradas por deputado
-- Chave natural composta: (cod_documento, parcela)
--   parcela = 0 para documentos simples; > 0 para parcelamentos
-- ATENCAO: codDocumento sozinho NAO e unico (confirmado por exploracao da API)
CREATE TABLE IF NOT EXISTS fato_despesas (
    cod_documento      TEXT            NOT NULL,
    parcela            INT             NOT NULL DEFAULT 0,
    deputado_id        INT             NOT NULL,
    ano                INT             NOT NULL,
    mes                INT             NOT NULL,
    tipo_despesa       TEXT            NOT NULL,
    tipo_documento     TEXT,
    num_documento      TEXT,
    data_documento     DATE,
    valor_documento    NUMERIC(12, 2)  NOT NULL,
    valor_liquido      NUMERIC(12, 2),
    valor_glosa        NUMERIC(12, 2)  NOT NULL DEFAULT 0,
    num_ressarcimento  TEXT,
    cod_lote           INT,
    fornecedor_nome    TEXT,
    fornecedor_cnpj    TEXT,
    url_documento      TEXT,
    ingested_at        TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    CONSTRAINT pk_fato_despesas   PRIMARY KEY (cod_documento, parcela),
    CONSTRAINT fk_desp_dep        FOREIGN KEY (deputado_id) REFERENCES dim_deputados(deputado_id),
    CONSTRAINT chk_valor_positivo CHECK (valor_documento > 0)
);

-- -----------------------------------------------------------------------------
-- Indices recomendados
-- -----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_prop_data       ON fato_proposicoes(data_apresentacao);
CREATE INDEX IF NOT EXISTS idx_prop_tema       ON fato_proposicoes(tema_id);
CREATE INDEX IF NOT EXISTS idx_vot_data        ON fato_votacoes(data);
CREATE INDEX IF NOT EXISTS idx_vot_prop        ON fato_votacoes(proposicao_id);
CREATE INDEX IF NOT EXISTS idx_desp_dep_data   ON fato_despesas(deputado_id, data_documento);
CREATE INDEX IF NOT EXISTS idx_desp_ano_mes    ON fato_despesas(ano, mes);

-- Indice vetorial para busca por similaridade (habilitar apos carga inicial)
-- CREATE INDEX idx_prop_embedding ON fato_proposicoes
--     USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
