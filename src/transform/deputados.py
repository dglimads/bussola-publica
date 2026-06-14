"""
Transforma raw deputados JSON -> DataFrame pronto para dim_deputados.

Entrada:  data/raw/deputados/<timestamp>.json  (arquivos de lista, sem '_' no stem)
Saida:    DataFrame com colunas deputado_id, nome, sigla_partido, uf, situacao, email

Nota: sigla_partido e mantido para resolucao do FK partido_id no modulo de carga
      (src/load/upsert.py upsert_deputados faz lookup em dim_partidos).
"""
from __future__ import annotations

import json
import logging
from pathlib import Path

import pandas as pd

from src.config import DATA_RAW_DIR
from src.utils.text import clean_text, safe_str

log = logging.getLogger("bussola.transform")


def transform_deputados(raw_dir: Path = DATA_RAW_DIR) -> pd.DataFrame:
    """
    Le o JSON raw mais recente da listagem /deputados e retorna DataFrame limpo.

    Arquivos de detalhe individual (stem com '_') sao ignorados -- so listas.

    Colunas de saida:
        deputado_id (int), nome (str), sigla_partido (str),
        uf (str), situacao (str), email (str | None)

    Raises:
        FileNotFoundError: se nao houver nenhum raw de lista de deputados.
    """
    deputados_dir = raw_dir / "deputados"
    list_files = sorted(
        f for f in deputados_dir.glob("*.json")
        if "_" not in f.stem
    ) if deputados_dir.exists() else []

    if not list_files:
        raise FileNotFoundError(
            f"Nenhum raw de lista de deputados em {deputados_dir}. "
            "Execute scripts/1_run_extraction.py primeiro."
        )

    envelope = json.loads(list_files[-1].read_text(encoding="utf-8", errors="replace"))
    records = envelope.get("dados", [])

    df = pd.json_normalize(records)

    rename = {
        "id":           "deputado_id",
        "nome":         "nome",
        "siglaPartido": "sigla_partido",
        "siglaUf":      "uf",
        "email":        "email",
        "urlFoto":      "url_foto",
        "idLegislatura": "id_legislatura",
        "uriPartido":   "uri_partido",
        "uri":          "uri",
    }
    df = df.rename(columns=rename)[[*rename.values()]]

    df["deputado_id"]    = pd.to_numeric(df["deputado_id"], errors="coerce").astype("Int64")
    df["nome"]           = df["nome"].apply(lambda v: clean_text(safe_str(v)))
    df["sigla_partido"]  = df["sigla_partido"].apply(lambda v: safe_str(v))
    df["uf"]             = df["uf"].apply(lambda v: safe_str(v))
    df["email"]          = df["email"].apply(lambda v: safe_str(v))
    df["url_foto"]       = df["url_foto"].apply(lambda v: safe_str(v))
    df["id_legislatura"] = pd.to_numeric(df["id_legislatura"], errors="coerce").astype("Int64")
    df["uri_partido"]    = df["uri_partido"].apply(lambda v: safe_str(v))
    df["uri"]            = df["uri"].apply(lambda v: safe_str(v))
    df["situacao"]       = "Em exercicio"

    df = df.dropna(subset=["deputado_id", "nome", "uf"])
    df = df.drop_duplicates(subset=["deputado_id"])

    log.info("Deputados transformados: %d registros", len(df))
    return df.reset_index(drop=True)
