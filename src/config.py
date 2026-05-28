"""
Configuracao central do projeto Bussola Publica.

Carrega variaveis do `.env` e expoe constantes tipadas para os demais modulos.
Falha cedo (fail-fast) se variaveis obrigatorias estiverem ausentes.

Variaveis de ambiente suportadas:
  DATABASE_URL               -> PostgreSQL connection string (obrigatorio Sprint 2+)
  CAMARA_API_BASE_URL        -> URL base da API (tem default)
  CAMARA_API_TIMEOUT_SECONDS -> timeout HTTP em segundos (default: 30)
  CAMARA_API_PAGE_SIZE       -> itens por pagina (default: 100, max da API)
  CAMARA_API_USER_AGENT      -> User-Agent HTTP identificavel
  DATA_RAW_DIR               -> pasta de JSONs brutos (default: ./data/raw)
  DATA_PROCESSED_DIR         -> pasta de dados processados (default: ./data/processed)
  LOG_LEVEL                  -> nivel de log (default: INFO)
"""
from __future__ import annotations

import logging
import os
from pathlib import Path

from dotenv import load_dotenv

# Carrega .env da raiz do projeto
PROJECT_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(PROJECT_ROOT / ".env")


def _get(key: str, default: str | None = None, required: bool = False) -> str:
    """Lê variavel de ambiente. Falha rapido se required=True e ausente."""
    value = os.getenv(key, default)
    if required and not value:
        raise RuntimeError(
            f"Variavel de ambiente obrigatoria ausente: {key}\n"
            f"  1. Execute: copy .env.example .env\n"
            f"  2. Preencha o valor de {key} no arquivo .env\n"
            f"  3. Para DATABASE_URL: use a connection string do Supabase"
        )
    return value or ""


# --- API Camara dos Deputados ------------------------------------------------
CAMARA_API_BASE_URL: str = _get(
    "CAMARA_API_BASE_URL",
    "https://dadosabertos.camara.leg.br/api/v2",
)
CAMARA_API_TIMEOUT_SECONDS: int = int(_get("CAMARA_API_TIMEOUT_SECONDS", "30"))
CAMARA_API_PAGE_SIZE: int = int(_get("CAMARA_API_PAGE_SIZE", "100"))
CAMARA_API_USER_AGENT: str = _get(
    "CAMARA_API_USER_AGENT",
    "BussolaPublica/1.0",
)

# --- PostgreSQL / Supabase (Sprint 2+) --------------------------------------
# Nao valida aqui — falha apenas quando get_engine() for chamado
DATABASE_URL: str = _get("DATABASE_URL", required=False)

# --- Diretorios -------------------------------------------------------------
DATA_RAW_DIR: Path = Path(_get("DATA_RAW_DIR", "./data/raw"))
DATA_PROCESSED_DIR: Path = Path(_get("DATA_PROCESSED_DIR", "./data/processed"))

DATA_RAW_DIR.mkdir(parents=True, exist_ok=True)
DATA_PROCESSED_DIR.mkdir(parents=True, exist_ok=True)

# --- Logging ----------------------------------------------------------------
LOG_LEVEL: str = _get("LOG_LEVEL", "INFO").upper()


def setup_logging() -> logging.Logger:
    """Configura logging com rich (se disponivel) ou stdlib como fallback."""
    try:
        from rich.logging import RichHandler

        logging.basicConfig(
            level=LOG_LEVEL,
            format="%(message)s",
            datefmt="[%H:%M:%S]",
            # markup=False: paths como '/deputados' nao sao interpretados como tags
            handlers=[RichHandler(rich_tracebacks=True, markup=False)],
        )
    except ImportError:
        logging.basicConfig(
            level=LOG_LEVEL,
            format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
            datefmt="%H:%M:%S",
        )
    return logging.getLogger("bussola")
