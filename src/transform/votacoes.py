"""
Transforma raw votacoes JSON -> DataFrame pronto para fato_votacoes.

Entrada:  data/raw/votacoes/<timestamp>.json  (todos os arquivos de lista)
Saida:    DataFrame com colunas votacao_id, proposicao_id (None), data,
          orgao, descricao, aprovacao

Nota: proposicao_id fica NULL nesta etapa. A API retorna proposicaoObjeto como
texto livre ("PL 1234/2025"), nao como ID numerico. Resolucao fica para Sprint 3.
"""
from __future__ import annotations

import json
import logging
from pathlib import Path

import pandas as pd

from src.config import DATA_RAW_DIR
from src.utils.text import clean_text, safe_str

log = logging.getLogger("bussola.transform")


def transform_votacoes(raw_dir: Path = DATA_RAW_DIR) -> pd.DataFrame:
    """
    Agrega todos os JSONs raw de /votacoes e retorna DataFrame limpo.

    Colunas de saida:
        votacao_id (str), proposicao_id (None),
        data (datetime), orgao (str | None),
        descricao (str | None), aprovacao (bool | None)

    Raises:
        FileNotFoundError: se nao houver nenhum raw de votacoes.
    """
    vot_dir = raw_dir / "votacoes"
    list_files = sorted(
        f for f in vot_dir.glob("*.json")
        if "_" not in f.stem
    ) if vot_dir.exists() else []

    if not list_files:
        raise FileNotFoundError(
            f"Nenhum raw de votacoes em {vot_dir}. "
            "Execute scripts/run_extraction.py primeiro."
        )

    all_records: list[dict] = []
    for f in list_files:
        envelope = json.loads(f.read_text(encoding="utf-8", errors="replace"))
        all_records.extend(envelope.get("dados", []))

    if not all_records:
        log.warning("Raw de votacoes encontrado mas sem registros.")
        return pd.DataFrame()

    df = pd.json_normalize(all_records)

    rename = {
        "id":         "votacao_id",
        "data":       "data",
        "siglaOrgao": "orgao",
        "descricao":  "descricao",
        "aprovacao":  "aprovacao",
    }
    for col in rename:
        if col not in df.columns:
            df[col] = None

    df = df.rename(columns=rename)[[*rename.values()]]

    df["votacao_id"]   = df["votacao_id"].astype(str)
    df["data"]         = pd.to_datetime(df["data"], errors="coerce")
    df["orgao"]        = df["orgao"].apply(lambda v: safe_str(v))
    df["descricao"]    = df["descricao"].apply(lambda v: clean_text(safe_str(v)))
    df["aprovacao"]    = pd.to_numeric(df["aprovacao"], errors="coerce").map(
        {1: True, 0: False}
    )
    df["proposicao_id"] = None

    df = df.dropna(subset=["votacao_id", "data"])
    df = df.drop_duplicates(subset=["votacao_id"])

    log.info(
        "Votacoes transformadas: %d registros de %d arquivos",
        len(df), len(list_files),
    )
    return df.reset_index(drop=True)
