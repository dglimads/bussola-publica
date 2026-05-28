"""
Carrega DataFrames transformados no PostgreSQL via upsert idempotente.

Padrao: INSERT ... ON CONFLICT DO UPDATE SET
  - Re-execucoes nao duplicam registros.
  - Ordem de FK: partidos -> deputados -> proposicoes -> votacoes -> despesas.

Uso rapido (pipeline completo):
  from src.load.upsert import get_engine, upsert_all
  upsert_all()

Uso granular (por entidade):
  engine = get_engine()
  upsert_partidos(df_partidos, engine)
  upsert_deputados(df_deputados, engine)
  upsert_despesas(df_despesas, engine)
"""
from __future__ import annotations

import logging

import pandas as pd
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine

from src.config import DATABASE_URL

log = logging.getLogger("bussola.load")


def get_engine(url: str = DATABASE_URL) -> Engine:
    """
    Cria e retorna engine SQLAlchemy com pool_pre_ping.

    Raises:
        RuntimeError: se DATABASE_URL nao estiver configurada no .env
    """
    if not url:
        raise RuntimeError(
            "DATABASE_URL nao configurada.\n"
            "  1. Execute: copy .env.example .env\n"
            "  2. Preencha DATABASE_URL com a connection string do Supabase:\n"
            "     DATABASE_URL=postgresql://postgres:SUA_SENHA@db.SEU_PROJETO.supabase.co:5432/postgres"
        )
    engine = create_engine(url, pool_pre_ping=True)
    safe = url.split("@")[-1] if "@" in url else url
    log.debug("Engine pronta: %s", safe)
    return engine


# =============================================================================
# Helpers internos
# =============================================================================

def _to_records(df: pd.DataFrame, cols: list[str]) -> list[dict]:
    """Garante colunas ausentes como None e converte para lista de dicts."""
    import math
    df = df.copy()
    for c in cols:
        if c not in df.columns:
            df[c] = None
    records = df[cols].where(df[cols].notna(), other=None).to_dict("records")
    # segunda passagem: float nan remanescente em colunas object
    return [
        {k: (None if isinstance(v, float) and math.isnan(v) else v) for k, v in r.items()}
        for r in records
    ]


# =============================================================================
# Upsert por entidade
# =============================================================================

def upsert_partidos(df: pd.DataFrame, engine: Engine) -> int:
    """
    Upsert em dim_partidos.

    Colunas esperadas: partido_id (int), sigla (str), nome (str)
    Retorna: numero de linhas processadas
    """
    if df.empty:
        return 0
    sql = text("""
        INSERT INTO dim_partidos (partido_id, sigla, nome, ingested_at)
        VALUES (:partido_id, :sigla, :nome, NOW())
        ON CONFLICT (partido_id) DO UPDATE SET
            sigla       = EXCLUDED.sigla,
            nome        = EXCLUDED.nome,
            ingested_at = NOW()
    """)
    records = _to_records(df, ["partido_id", "sigla", "nome"])
    with engine.begin() as conn:
        conn.execute(sql, records)
    log.info("dim_partidos: %d registros upsertados", len(records))
    return len(records)


def upsert_deputados(df: pd.DataFrame, engine: Engine) -> int:
    """
    Upsert em dim_deputados.

    Se o DataFrame tiver coluna 'sigla_partido' (sem 'partido_id'), resolve
    o FK fazendo lookup em dim_partidos antes de inserir.

    Colunas esperadas: deputado_id, nome, sigla_partido (ou partido_id), uf, situacao, email,
                       url_foto, id_legislatura, uri_partido, uri
    """
    if df.empty:
        return 0
    df = df.copy()

    # Resolve FK partido_id a partir de sigla_partido se necessario
    if "partido_id" not in df.columns or df["partido_id"].isna().all():
        if "sigla_partido" in df.columns:
            with engine.connect() as conn:
                rows = conn.execute(text("SELECT sigla, partido_id FROM dim_partidos"))
                partido_map: dict[str, int] = {r.sigla: r.partido_id for r in rows}
            df["partido_id"] = df["sigla_partido"].map(partido_map)

    sql = text("""
        INSERT INTO dim_deputados
            (deputado_id, nome, partido_id, uf, situacao, email,
             url_foto, id_legislatura, uri_partido, uri, ingested_at)
        VALUES
            (:deputado_id, :nome, :partido_id, :uf, :situacao, :email,
             :url_foto, :id_legislatura, :uri_partido, :uri, NOW())
        ON CONFLICT (deputado_id) DO UPDATE SET
            nome           = EXCLUDED.nome,
            partido_id     = EXCLUDED.partido_id,
            uf             = EXCLUDED.uf,
            situacao       = EXCLUDED.situacao,
            email          = EXCLUDED.email,
            url_foto       = EXCLUDED.url_foto,
            id_legislatura = EXCLUDED.id_legislatura,
            uri_partido    = EXCLUDED.uri_partido,
            uri            = EXCLUDED.uri,
            ingested_at    = NOW()
    """)
    records = _to_records(
        df,
        ["deputado_id", "nome", "partido_id", "uf", "situacao", "email",
         "url_foto", "id_legislatura", "uri_partido", "uri"],
    )
    with engine.begin() as conn:
        conn.execute(sql, records)
    log.info("dim_deputados: %d registros upsertados", len(records))
    return len(records)


def upsert_proposicoes(df: pd.DataFrame, engine: Engine) -> int:
    """
    Upsert em fato_proposicoes.

    Em conflito, preserva tema_id e embedding ja existentes no banco
    (COALESCE) para nao sobrescrever classificacoes de IA feitas no Sprint 3.

    Colunas esperadas: proposicao_id, data_apresentacao, tipo, ementa, autor_id, tema_id
    """
    if df.empty:
        return 0
    sql = text("""
        INSERT INTO fato_proposicoes
            (proposicao_id, data_apresentacao, tipo, ementa,
             autor_id, tema_id, ingested_at)
        VALUES
            (:proposicao_id, :data_apresentacao, :tipo, :ementa,
             :autor_id, :tema_id, NOW())
        ON CONFLICT (proposicao_id) DO UPDATE SET
            data_apresentacao = EXCLUDED.data_apresentacao,
            tipo              = EXCLUDED.tipo,
            ementa            = EXCLUDED.ementa,
            autor_id          = COALESCE(EXCLUDED.autor_id,   fato_proposicoes.autor_id),
            tema_id           = COALESCE(fato_proposicoes.tema_id, EXCLUDED.tema_id),
            ingested_at       = NOW()
    """)
    cols = ["proposicao_id", "data_apresentacao", "tipo", "ementa", "autor_id", "tema_id"]
    records = _to_records(df, cols)
    with engine.begin() as conn:
        conn.execute(sql, records)
    log.info("fato_proposicoes: %d registros upsertados", len(records))
    return len(records)


def upsert_votacoes(df: pd.DataFrame, engine: Engine) -> int:
    """
    Upsert em fato_votacoes (cabecalho de votacao).

    proposicao_id e preservado se ja existir no banco.

    Colunas esperadas: votacao_id, proposicao_id, data, orgao, descricao, aprovacao
    """
    if df.empty:
        return 0
    sql = text("""
        INSERT INTO fato_votacoes
            (votacao_id, proposicao_id, data, orgao, descricao, aprovacao, ingested_at)
        VALUES
            (:votacao_id, :proposicao_id, :data, :orgao, :descricao, :aprovacao, NOW())
        ON CONFLICT (votacao_id) DO UPDATE SET
            proposicao_id = COALESCE(fato_votacoes.proposicao_id, EXCLUDED.proposicao_id),
            data          = EXCLUDED.data,
            orgao         = EXCLUDED.orgao,
            descricao     = EXCLUDED.descricao,
            aprovacao     = EXCLUDED.aprovacao,
            ingested_at   = NOW()
    """)
    cols = ["votacao_id", "proposicao_id", "data", "orgao", "descricao", "aprovacao"]
    records = _to_records(df, cols)
    with engine.begin() as conn:
        conn.execute(sql, records)
    log.info("fato_votacoes: %d registros upsertados", len(records))
    return len(records)


def upsert_despesas(df: pd.DataFrame, engine: Engine) -> int:
    """
    Upsert em fato_despesas.

    Chave natural: (cod_documento, parcela).
    Em conflito, atualiza apenas valores financeiros; preserva dados de fornecedor.

    Colunas esperadas: cod_documento, parcela, deputado_id, ano, mes,
                       tipo_despesa, tipo_documento, num_documento, data_documento,
                       valor_documento, valor_liquido, valor_glosa,
                       num_ressarcimento, cod_lote,
                       fornecedor_nome, fornecedor_cnpj, url_documento
    """
    if df.empty:
        return 0
    sql = text("""
        INSERT INTO fato_despesas (
            cod_documento, parcela, deputado_id, ano, mes,
            tipo_despesa, tipo_documento, num_documento, data_documento,
            valor_documento, valor_liquido, valor_glosa,
            num_ressarcimento, cod_lote,
            fornecedor_nome, fornecedor_cnpj, url_documento,
            ingested_at
        ) VALUES (
            :cod_documento, :parcela, :deputado_id, :ano, :mes,
            :tipo_despesa, :tipo_documento, :num_documento, :data_documento,
            :valor_documento, :valor_liquido, :valor_glosa,
            :num_ressarcimento, :cod_lote,
            :fornecedor_nome, :fornecedor_cnpj, :url_documento,
            NOW()
        )
        ON CONFLICT (cod_documento, parcela) DO UPDATE SET
            valor_documento = EXCLUDED.valor_documento,
            valor_liquido   = EXCLUDED.valor_liquido,
            valor_glosa     = EXCLUDED.valor_glosa,
            tipo_despesa    = EXCLUDED.tipo_despesa,
            ingested_at     = NOW()
    """)
    cols = [
        "cod_documento", "parcela", "deputado_id", "ano", "mes",
        "tipo_despesa", "tipo_documento", "num_documento", "data_documento",
        "valor_documento", "valor_liquido", "valor_glosa",
        "num_ressarcimento", "cod_lote",
        "fornecedor_nome", "fornecedor_cnpj", "url_documento",
    ]
    records = _to_records(df, cols)
    # Supabase free tier tem statement_timeout ~30s; desabilita para carga bulk
    bulk_engine = create_engine(
        engine.url,
        pool_pre_ping=True,
        connect_args={"options": "-c statement_timeout=0"},
    )
    BATCH = 500
    total = 0
    for i in range(0, len(records), BATCH):
        batch = records[i: i + BATCH]
        with bulk_engine.begin() as conn:
            conn.execute(sql, batch)
        total += len(batch)
        if total % 10_000 == 0 or total == len(records):
            log.info("fato_despesas: %d/%d registros upsertados", total, len(records))
    bulk_engine.dispose()
    return total


# =============================================================================
# Pipeline completo de carga
# =============================================================================

def upsert_all(engine: Engine | None = None) -> dict[str, int]:
    """
    Executa a carga completa na ordem correta de FK:
      1. dim_partidos
      2. dim_deputados    (FK -> partidos)
      3. fato_proposicoes (FK -> deputados)
      4. fato_votacoes    (FK -> proposicoes, nullable)
      5. fato_despesas    (FK -> deputados)

    Cada etapa chama o modulo de transform correspondente,
    transforma os JSONs raw e faz upsert na tabela alvo.

    Returns:
        Dict com contagem de registros por tabela.
        Ex: {'partidos': 30, 'deputados': 513, 'proposicoes': 200, ...}
    """
    from src.transform.partidos    import transform_partidos
    from src.transform.deputados   import transform_deputados
    from src.transform.proposicoes import transform_proposicoes
    from src.transform.votacoes    import transform_votacoes
    from src.transform.despesas    import transform_despesas

    engine = engine or get_engine()
    counts: dict[str, int] = {}

    log.info("Iniciando carga no banco de dados...")

    counts["partidos"]    = upsert_partidos(transform_partidos(), engine)
    counts["deputados"]   = upsert_deputados(transform_deputados(), engine)
    counts["proposicoes"] = upsert_proposicoes(transform_proposicoes(), engine)
    counts["votacoes"]    = upsert_votacoes(transform_votacoes(), engine)
    counts["despesas"]    = upsert_despesas(transform_despesas(), engine)

    total = sum(counts.values())
    log.info("Carga concluida: %d registros no total | %s", total, counts)
    return counts
