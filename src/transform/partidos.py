"""
Transforma raw partidos JSON -> DataFrame pronto para dim_partidos.

Entrada:  data/raw/partidos/<timestamp>.json  (arquivos de lista, sem '_' no stem)
Saida:    DataFrame com colunas partido_id (int), sigla (str), nome (str)
"""
from __future__ import annotations

import json
import logging
from pathlib import Path

import pandas as pd

from src.config import DATA_RAW_DIR
from src.utils.text import clean_text, safe_str

log = logging.getLogger("bussola.transform")


def transform_partidos(raw_dir: Path = DATA_RAW_DIR) -> pd.DataFrame:
    """
    Le o JSON raw mais recente de /partidos e retorna DataFrame limpo.

    Colunas de saida: partido_id (int), sigla (str), nome (str)

    Raises:
        FileNotFoundError: se nao houver nenhum raw de partidos.
    """
    partidos_dir = raw_dir / "partidos"
    list_files = sorted(
        f for f in partidos_dir.glob("*.json")
        if "_" not in f.stem
    ) if partidos_dir.exists() else []

    if not list_files:
        raise FileNotFoundError(
            f"Nenhum raw de partidos em {partidos_dir}. "
            "Execute scripts/1_run_extraction.py primeiro."
        )

    envelope = json.loads(list_files[-1].read_text(encoding="utf-8", errors="replace"))
    records = envelope.get("dados", [])

    df = pd.json_normalize(records)
    df = df.rename(columns={"id": "partido_id"})[["partido_id", "sigla", "nome"]]
    df["partido_id"] = pd.to_numeric(df["partido_id"], errors="coerce").astype("Int64")

    df["sigla"] = df["sigla"].apply(lambda v: safe_str(v))
    df["nome"]  = df["nome"].apply(lambda v: clean_text(safe_str(v)))

    df = df.dropna(subset=["partido_id", "sigla"])
    df = df.drop_duplicates(subset=["partido_id"])

    log.info("Partidos transformados: %d registros", len(df))
    return df.reset_index(drop=True)
