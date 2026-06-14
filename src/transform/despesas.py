"""
Transforma raw despesas CEAP JSON -> DataFrame pronto para fato_despesas.

Entrada:  data/raw/deputados_despesas/<timestamp>_<deputado_id>.json
          (um arquivo por deputado, gerado por fetch_all_deputados_despesas)
Saida:    DataFrame com todas as colunas de fato_despesas (exceto ingested_at)

Chave natural: (cod_documento, parcela) -- conforme PK no schema.
"""
from __future__ import annotations

import json
import logging
from pathlib import Path

import pandas as pd

from src.config import DATA_RAW_DIR
from src.utils.text import clean_text, normalize_cnpj_cpf, safe_str

log = logging.getLogger("bussola.transform")

# Mapeamento camelCase da API -> snake_case do schema
_RENAME: dict[str, str] = {
    "codDocumento":      "cod_documento",
    "parcela":           "parcela",
    "ano":               "ano",
    "mes":               "mes",
    "tipoDespesa":       "tipo_despesa",
    "tipoDocumento":     "tipo_documento",
    "numDocumento":      "num_documento",
    "dataDocumento":     "data_documento",
    "valorDocumento":    "valor_documento",
    "valorLiquido":      "valor_liquido",
    "valorGlosa":        "valor_glosa",
    "numRessarcimento":  "num_ressarcimento",
    "codLote":           "cod_lote",
    "nomeFornecedor":    "fornecedor_nome",
    "cnpjCpfFornecedor": "fornecedor_cnpj",
    "urlDocumento":      "url_documento",
}

_NUMERIC_COLS = ["valor_documento", "valor_liquido", "valor_glosa", "ano", "mes", "cod_lote"]


def transform_despesas(raw_dir: Path = DATA_RAW_DIR) -> pd.DataFrame:
    """
    Agrega todos os JSONs raw de despesas CEAP e retorna DataFrame limpo.

    Cada arquivo raw corresponde a um deputado:
        data/raw/deputados_despesas/<timestamp>_<deputado_id>.json

    O deputado_id e extraido do campo _meta.endpoint do envelope:
        "/deputados/220714/despesas" -> parts[1] = "220714"

    Validacoes aplicadas:
        - valor_documento > 0
        - cod_documento e deputado_id nao nulos
        - deduplicacao por (cod_documento, parcela)

    Colunas de saida: todas as colunas de fato_despesas exceto ingested_at.

    Raises:
        FileNotFoundError: se o diretorio deputados_despesas nao existir.
    """
    despesas_dir = raw_dir / "deputados_despesas"
    if not despesas_dir.exists():
        log.warning("Sem dados de despesas em %s — pulando (rode: python scripts/6_run_despesas.py).", despesas_dir)
        return pd.DataFrame()

    files = sorted(despesas_dir.glob("*.json"))
    if not files:
        log.warning("Nenhum raw de despesas em %s", despesas_dir)
        return pd.DataFrame()

    frames: list[pd.DataFrame] = []
    for f in files:
        envelope = json.loads(f.read_text(encoding="utf-8", errors="replace"))
        records = envelope.get("dados", [])
        if not records:
            continue

        # Extrai deputado_id de _meta.endpoint: "/deputados/220714/despesas"
        endpoint = envelope.get("_meta", {}).get("endpoint", "")
        parts = [p for p in endpoint.split("/") if p]
        dep_id = int(parts[1]) if len(parts) >= 2 and parts[1].isdigit() else None
        if dep_id is None:
            log.warning("Nao foi possivel extrair deputado_id de %s", f.name)
            continue

        frame = pd.json_normalize(records)
        frame["deputado_id"] = dep_id
        frames.append(frame)

    if not frames:
        log.warning("Nenhum registro de despesas apos leitura dos arquivos.")
        return pd.DataFrame()

    df = pd.concat(frames, ignore_index=True)

    # Renomeia apenas colunas presentes
    present = {api: schema for api, schema in _RENAME.items() if api in df.columns}
    df = df.rename(columns=present)
    final_cols = list(present.values()) + ["deputado_id"]
    df = df[[c for c in final_cols if c in df.columns]]

    # Tipos numericos
    for col in _NUMERIC_COLS:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")

    if "parcela" in df.columns:
        df["parcela"] = pd.to_numeric(df["parcela"], errors="coerce").fillna(0).astype(int)
    else:
        df["parcela"] = 0

    df["valor_glosa"] = df.get("valor_glosa", pd.Series(0.0, index=df.index)).fillna(0)

    # Parse de data
    if "data_documento" in df.columns:
        df["data_documento"] = pd.to_datetime(
            df["data_documento"], errors="coerce"
        ).dt.date

    # Limpeza de strings
    if "cod_documento" in df.columns:
        df["cod_documento"] = df["cod_documento"].apply(lambda v: safe_str(str(v)))
    if "tipo_despesa" in df.columns:
        df["tipo_despesa"] = df["tipo_despesa"].apply(lambda v: clean_text(safe_str(v)))
    if "fornecedor_nome" in df.columns:
        df["fornecedor_nome"] = df["fornecedor_nome"].apply(lambda v: clean_text(safe_str(v)))
    if "fornecedor_cnpj" in df.columns:
        df["fornecedor_cnpj"] = df["fornecedor_cnpj"].apply(normalize_cnpj_cpf)

    # Validacoes
    df = df.dropna(subset=["cod_documento", "deputado_id", "valor_documento"])
    df = df[df["valor_documento"] > 0]
    df = df.drop_duplicates(subset=["cod_documento", "parcela"])

    log.info(
        "Despesas transformadas: %d registros de %d arquivos",
        len(df), len(files),
    )
    return df.reset_index(drop=True)
