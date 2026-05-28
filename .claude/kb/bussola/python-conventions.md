# Convencoes Python — Bussola Publica

Regras especificas deste projeto. Complementam o KB geral de Python.

---

## Idioma e Encoding

- **Codigo Python:** pt-BR sem acentos (comments, docstrings, logs, nomes de variaveis)
- **Dados de negocio:** preservam acentos (nomes de deputados, ementas, partidos)
- **Encoding:** UTF-8 em todos os arquivos (`open(..., encoding="utf-8")`)
- **JSON:** sempre `ensure_ascii=False` para preservar acentos nos dados

```python
# CERTO: sem acentos no codigo
def carregar_deputados(caminho: Path) -> pd.DataFrame:
    """Carrega deputados do arquivo raw."""  # sem acentos

# ERRADO: acentos em codigo
def carregar_deputados(caminho: Path) -> pd.DataFrame:
    """Carrega députados do arquivo raw."""  # COM acento — proibido
```

---

## Type Hints

Obrigatorio em todas as funcoes publicas:

```python
from __future__ import annotations
from pathlib import Path
import pandas as pd

def transform_partidos(raw: list[dict]) -> pd.DataFrame:
    ...

def fetch_deputados(self, limite: int = 100) -> list[dict]:
    ...
```

---

## Logging

Nunca `print()`. Sempre `log.info/warning/error`:

```python
import logging
log = logging.getLogger(__name__)

# CERTO
log.info("Deputados transformados: %d registros", len(df))
log.warning("Partido nao encontrado: sigla=%s", sigla)
log.error("Falha no upsert: %s", str(e))

# ERRADO
print(f"Deputados: {len(df)}")  # proibido em producao
```

---

## Tipos Pandas

| Dado | Tipo correto | Por que |
|------|-------------|---------|
| IDs inteiros | `Int64` | Nullable (suporta None/NaN da API) |
| Valores monetarios | `float64` via `pd.to_numeric(errors="coerce")` | Converte string para float |
| Datas | `pd.to_datetime(..., errors="coerce").dt.date` | Aceita None sem levantar |
| Strings | via `safe_str()` | Trata None, NaN, 'nan', '' |
| Booleanos | via mapa `{1: True, 0: False}` | API retorna 0/1 |

---

## Utilitarios de Texto

Sempre importar de `src/utils/text.py`:

```python
from src.utils.text import safe_str, clean_text, strip_accents, normalize_cnpj_cpf

# safe_str: toda string que pode ser None/NaN
nome = safe_str(row.get("nome"))  # retorna None se vazio

# clean_text: texto longo (ementas, descricoes)
ementa = clean_text(safe_str(row.get("ementa")), max_len=2000)

# strip_accents: APENAS em chaves/slugs — NUNCA em dados
slug = strip_accents("Saude Publica")  # "Saude Publica" — ok para chaves

# normalize_cnpj_cpf: fornecedor_cnpj
cnpj = normalize_cnpj_cpf(row.get("cnpjCpfFornecedor"))  # remove . - /
```

---

## Segredos

Nunca em codigo. Sempre via `.env`:

```python
# CERTO
from src.config import config
engine = create_engine(config.database_url)

# ERRADO
engine = create_engine("postgresql://postgres:senha@host/db")  # proibido
```

---

## Imports

Ordem: stdlib → third-party → src. Sem circular imports.

```python
from __future__ import annotations
import logging
from pathlib import Path

import pandas as pd
from sqlalchemy import create_engine

from src.config import config
from src.utils.text import safe_str
```

---

## Instalacao de Dependencias

```bash
# OBRIGATORIO no Windows com Python 3.14 + caminho com acentos
pip install --only-binary :all: -r requirements.txt

# Se adicionar nova dependencia:
pip install --only-binary :all: <pacote>
# Depois: pip freeze > requirements.txt (verificar versoes)
```

---

## Variaveis de Ambiente Criticas

```python
# src/config.py — fail-fast se DATABASE_URL ausente
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL nao configurada. Copie .env.example para .env.")

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")  # opcional ate Sprint 3
```
