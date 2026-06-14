"""
Transforma raw proposicoes JSON -> DataFrame pronto para fato_proposicoes.

Entrada:  data/raw/proposicoes/<timestamp>.json  (todos os arquivos de lista)
Saida:    DataFrame com colunas proposicao_id, data_apresentacao, tipo, ementa,
          autor_id (None), tema_id (None)

Campos autor_id, tema_id e embedding serao preenchidos no Sprint 3 via IA.
"""
from __future__ import annotations

import json
import logging
from pathlib import Path

import pandas as pd

from src.config import DATA_RAW_DIR
from src.utils.text import clean_text, safe_str

log = logging.getLogger("bussola.transform")


def transform_proposicoes(raw_dir: Path = DATA_RAW_DIR) -> pd.DataFrame:
    """
    Agrega todos os JSONs raw de /proposicoes e retorna DataFrame limpo.

    Campos disponiveis na listagem:
        id, siglaTipo, ementa, dataApresentacao

    Campos preenchidos no Sprint 3:
        autor_id  -> /proposicoes/{id}/autores
        tema_id   -> classificador IA
        embedding -> embedder OpenAI

    Colunas de saida:
        proposicao_id (int), data_apresentacao (date | NaT),
        tipo (str), ementa (str),
        autor_id (None), tema_id (None)

    Raises:
        FileNotFoundError: se nao houver nenhum raw de proposicoes.
    """
    prop_dir = raw_dir / "proposicoes"
    list_files = sorted(
        f for f in prop_dir.glob("*.json")
        if "_" not in f.stem
    ) if prop_dir.exists() else []

    if not list_files:
        raise FileNotFoundError(
            f"Nenhum raw de proposicoes em {prop_dir}. "
            "Execute scripts/1_run_extraction.py primeiro."
        )

    all_records: list[dict] = []
    for f in list_files:
        envelope = json.loads(f.read_text(encoding="utf-8", errors="replace"))
        all_records.extend(envelope.get("dados", []))

    if not all_records:
        log.warning("Raw de proposicoes encontrado mas sem registros.")
        return pd.DataFrame()

    df = pd.json_normalize(all_records)

    rename = {
        "id":               "proposicao_id",
        "siglaTipo":        "tipo",
        "ementa":           "ementa",
        "dataApresentacao": "data_apresentacao",
    }
    for col in rename:
        if col not in df.columns:
            df[col] = None

    df = df.rename(columns=rename)[[*rename.values()]]

    df["proposicao_id"] = pd.to_numeric(df["proposicao_id"], errors="coerce").astype("Int64")
    df["data_apresentacao"] = pd.to_datetime(
        df["data_apresentacao"], errors="coerce"
    ).dt.date
    df["tipo"]   = df["tipo"].apply(lambda v: safe_str(v) or "")
    df["ementa"] = df["ementa"].apply(lambda v: clean_text(safe_str(v)) or "")

    df["autor_id"] = None
    df["tema_id"]  = None

    df = df.dropna(subset=["proposicao_id"])
    df = df[df["ementa"].str.len() > 0]
    df = df.drop_duplicates(subset=["proposicao_id"])

    log.info(
        "Proposicoes transformadas: %d registros de %d arquivos",
        len(df), len(list_files),
    )
    return df.reset_index(drop=True)
