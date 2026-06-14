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

import json
import logging
from typing import Any

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
# Autoria (ponte N:N) e votos nominais -- roadmap pos V1
# =============================================================================

def _dump_json(value: Any) -> str | None:
    """Serializa dict/list para texto JSON (JSONB), preservando acentos."""
    if value is None:
        return None
    return json.dumps(value, ensure_ascii=False, default=str)


def upsert_ponte_autores(records: list[dict], engine: Engine) -> int:
    """
    Upsert idempotente em ponte_proposicao_autores.

    Chave de conflito: indice unico de expressao
        (proposicao_id, autor_tipo, nome_autor, COALESCE(uri_autor, '')).

    Espera registros no formato de src.transform.autores.map_author.
    Retorna o numero de linhas processadas.
    """
    if not records:
        return 0
    sql = text("""
        INSERT INTO ponte_proposicao_autores
            (proposicao_id, autor_id, autor_tipo, deputado_id, partido_id, nome_autor,
             cod_tipo_autor, ordem_assinatura, proponente, uri_autor, raw_payload, atualizado_em)
        VALUES
            (:proposicao_id, :autor_id, :autor_tipo, :deputado_id, :partido_id, :nome_autor,
             :cod_tipo_autor, :ordem_assinatura, :proponente, :uri_autor,
             CAST(:raw_payload AS JSONB), NOW())
        ON CONFLICT (proposicao_id, autor_tipo, nome_autor, COALESCE(uri_autor, '')) DO UPDATE SET
            autor_id         = EXCLUDED.autor_id,
            deputado_id      = EXCLUDED.deputado_id,
            partido_id       = EXCLUDED.partido_id,
            cod_tipo_autor   = EXCLUDED.cod_tipo_autor,
            ordem_assinatura = EXCLUDED.ordem_assinatura,
            proponente       = EXCLUDED.proponente,
            raw_payload      = EXCLUDED.raw_payload,
            atualizado_em    = NOW()
    """)
    params = [{**r, "raw_payload": _dump_json(r.get("raw_payload"))} for r in records]
    with engine.begin() as conn:
        conn.execute(sql, params)
    return len(params)


def update_proposicao_autoria_flags(
    engine: Engine,
    proposicao_id: int,
    qtd_autores: int,
    principal: dict | None,
) -> None:
    """
    Marca a proposicao como processada e grava a desnormalizacao do autor principal.
    `principal` e um registro da ponte (ou None se a proposicao nao tem autores).
    """
    sql = text("""
        UPDATE fato_proposicoes SET
            autores_carregados          = TRUE,
            qtd_autores                 = :qtd_autores,
            autor_principal_nome        = :nome,
            autor_principal_tipo        = :tipo,
            autor_principal_deputado_id = :deputado_id,
            autor_principal_partido_id  = :partido_id
        WHERE proposicao_id = :proposicao_id
    """)
    p = principal or {}
    with engine.begin() as conn:
        conn.execute(sql, {
            "proposicao_id": proposicao_id,
            "qtd_autores": qtd_autores,
            "nome": p.get("nome_autor"),
            "tipo": p.get("autor_tipo"),
            "deputado_id": p.get("deputado_id"),
            "partido_id": p.get("partido_id"),
        })


def upsert_votos(records: list[dict], engine: Engine) -> int:
    """
    Upsert idempotente em fato_votacao_votos.

    Chave de conflito: (votacao_id, deputado_id).
    Preserva sigla_partido_voto (partido no momento do voto).
    Espera registros no formato de src.transform.votos.map_vote.
    """
    if not records:
        return 0
    sql = text("""
        INSERT INTO fato_votacao_votos
            (votacao_id, deputado_id, tipo_voto, sigla_partido_voto, sigla_uf_voto,
             data_registro_voto, raw_payload, atualizado_em)
        VALUES
            (:votacao_id, :deputado_id, :tipo_voto, :sigla_partido_voto, :sigla_uf_voto,
             CAST(:data_registro_voto AS TIMESTAMPTZ), CAST(:raw_payload AS JSONB), NOW())
        ON CONFLICT (votacao_id, deputado_id) DO UPDATE SET
            tipo_voto          = EXCLUDED.tipo_voto,
            sigla_partido_voto = EXCLUDED.sigla_partido_voto,
            sigla_uf_voto      = EXCLUDED.sigla_uf_voto,
            data_registro_voto = EXCLUDED.data_registro_voto,
            raw_payload        = EXCLUDED.raw_payload,
            atualizado_em      = NOW()
    """)
    params = [{**r, "raw_payload": _dump_json(r.get("raw_payload"))} for r in records]
    with engine.begin() as conn:
        conn.execute(sql, params)
    return len(params)


def update_votacao_votos_flags(engine: Engine, votacao_id: str, qtd_votos: int) -> None:
    """Marca a votacao como tendo votos nominais carregados."""
    sql = text("""
        UPDATE fato_votacoes
        SET votos_carregados = TRUE, qtd_votos = :qtd_votos
        WHERE votacao_id = :votacao_id
    """)
    with engine.begin() as conn:
        conn.execute(sql, {"votacao_id": str(votacao_id), "qtd_votos": qtd_votos})


def update_votacao_proposicao(
    engine: Engine,
    votacao_id: str,
    proposicao_id: int | None,
    uri_proposicao: str | None = None,
    objeto_votacao: str | None = None,
    cod_tipo_votacao: int | None = None,
) -> None:
    """
    Vincula a votacao a uma proposicao (e metadados).

    SEGURANCA DE FK: proposicao_id so e gravado se a proposicao existir em
    fato_proposicoes (a votacao pode referenciar proposicao fora da base
    carregada). uri/objeto sao gravados sempre, pois nao tem FK.
    """
    sql = text("""
        UPDATE fato_votacoes SET
            proposicao_id    = COALESCE(
                (SELECT proposicao_id FROM fato_proposicoes WHERE proposicao_id = :proposicao_id),
                proposicao_id),
            uri_proposicao   = COALESCE(:uri_proposicao, uri_proposicao),
            objeto_votacao   = COALESCE(:objeto_votacao, objeto_votacao),
            cod_tipo_votacao = COALESCE(:cod_tipo_votacao, cod_tipo_votacao)
        WHERE votacao_id = :votacao_id
    """)
    with engine.begin() as conn:
        conn.execute(sql, {
            "votacao_id": str(votacao_id),
            "proposicao_id": proposicao_id,
            "uri_proposicao": uri_proposicao,
            "objeto_votacao": objeto_votacao,
            "cod_tipo_votacao": cod_tipo_votacao,
        })


def log_pipeline_erro(
    engine: Engine,
    etapa: str,
    *,
    entidade_tipo: str | None = None,
    entidade_id: str | None = None,
    mensagem: str | None = None,
    payload: Any = None,
) -> None:
    """
    Registra uma divergencia nao bloqueante em pipeline_erros.

    Falhas ao registrar o proprio erro sao engolidas (nunca derrubam o bridge).
    """
    sql = text("""
        INSERT INTO pipeline_erros (etapa, entidade_tipo, entidade_id, mensagem, payload)
        VALUES (:etapa, :entidade_tipo, :entidade_id, :mensagem, CAST(:payload AS JSONB))
    """)
    try:
        with engine.begin() as conn:
            conn.execute(sql, {
                "etapa": etapa,
                "entidade_tipo": entidade_tipo,
                "entidade_id": str(entidade_id) if entidade_id is not None else None,
                "mensagem": (mensagem or "")[:2000],
                "payload": _dump_json(payload),
            })
    except Exception as exc:  # pragma: no cover - log de erro nunca deve quebrar o fluxo
        log.debug("Falha ao registrar pipeline_erro (%s): %s", etapa, exc)


# =============================================================================
# Pipeline completo de carga
# =============================================================================

def upsert_all(
    engine: Engine | None = None,
    *,
    incluir_despesas: bool = False,
) -> dict[str, int]:
    """
    Executa a carga das entidades do nucleo do Radar Legislativo, na ordem de FK:
      1. dim_partidos
      2. dim_deputados    (FK -> partidos)
      3. fato_proposicoes (FK -> deputados)
      4. fato_votacoes    (FK -> proposicoes, nullable)

    Cada etapa chama o modulo de transform correspondente,
    transforma os JSONs raw e faz upsert na tabela alvo.

    DESPESAS CEAP (~145k linhas) NAO entram aqui por padrao: sao a etapa mais
    lenta e nao fazem parte do escopo do Radar Legislativo. Rode-as isoladas via
    scripts/6_run_despesas.py (que chama upsert_despesas direto). Para incluir na
    carga mesmo assim, passe incluir_despesas=True.

    Returns:
        Dict com contagem de registros por tabela.
        Ex: {'partidos': 30, 'deputados': 513, 'proposicoes': 200, ...}
    """
    from src.transform.partidos    import transform_partidos
    from src.transform.deputados   import transform_deputados
    from src.transform.proposicoes import transform_proposicoes
    from src.transform.votacoes    import transform_votacoes

    engine = engine or get_engine()
    counts: dict[str, int] = {}

    log.info("Iniciando carga no banco de dados...")

    counts["partidos"]    = upsert_partidos(transform_partidos(), engine)
    counts["deputados"]   = upsert_deputados(transform_deputados(), engine)
    counts["proposicoes"] = upsert_proposicoes(transform_proposicoes(), engine)
    counts["votacoes"]    = upsert_votacoes(transform_votacoes(), engine)

    if incluir_despesas:
        from src.transform.despesas import transform_despesas
        counts["despesas"] = upsert_despesas(transform_despesas(), engine)

    total = sum(counts.values())
    log.info("Carga concluida: %d registros no total | %s", total, counts)
    return counts
