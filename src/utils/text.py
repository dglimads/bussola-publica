"""
Utilidades de tratamento de texto para o pipeline ETL.

Regras do projeto:
  - Dados vindos da API (nomes, ementas, descricoes) preservam acentos — sao dados reais.
  - Codigo Python (comments, docstrings, logs) usa pt-BR sem acentos — compatibilidade ASCII.
  - Normalizacao de chaves/codigos: lowercase sem acentos sem espacos.
  - Limpeza de conteudo: remove caracteres de controle, normaliza espacos, preserva acentos.
"""
from __future__ import annotations

import re
import unicodedata


def strip_accents(text: str) -> str:
    """
    Remove acentos e diacriticos de uma string.

    Exemplos:
        strip_accents('Joao Sao Paulo') -> 'Joao Sao Paulo'
        strip_accents('Proposicao e valida') -> 'Proposicao e valida'
    """
    nfkd = unicodedata.normalize("NFKD", text)
    return "".join(c for c in nfkd if not unicodedata.combining(c))


def normalize_key(text: str) -> str:
    """
    Normaliza uma string para uso como chave, codigo ou slug:
      - Converte para lowercase
      - Remove acentos
      - Substitui espacos e caracteres especiais por underscore
      - Remove underscores duplicados nas bordas

    Exemplos:
        normalize_key('Saude Publica') -> 'saude_publica'
        normalize_key('Tributario / Fiscal') -> 'tributario_fiscal'
    """
    s = strip_accents(text.strip().lower())
    s = re.sub(r"[^a-z0-9]+", "_", s)
    return s.strip("_")


def clean_text(text: str | None, max_len: int | None = None) -> str | None:
    """
    Limpa texto de conteudo preservando acentos (dados reais em pt-BR).

    Operacoes:
      1. Remove caracteres de controle (exceto newline e tab)
      2. Normaliza espacos multiplos para um unico espaco
      3. Strip nas bordas
      4. Trunca se max_len informado
      5. Retorna None se resultado for vazio

    Exemplos:
        clean_text('  Ementa da  proposicao  ') -> 'Ementa da proposicao'
        clean_text(None) -> None
        clean_text('') -> None
    """
    if text is None:
        return None
    text = str(text)
    # Remove control characters (keep \t and \n)
    text = re.sub(r"[\x00-\x08\x0b-\x0c\x0e-\x1f\x7f]", "", text)
    # Normalize whitespace
    text = " ".join(text.split())
    if max_len and len(text) > max_len:
        text = text[:max_len]
    return text or None


def safe_str(value: object) -> str | None:
    """
    Converte qualquer valor para string limpa.

    Retorna None para: None, strings vazias, 'nan', 'none', 'null'.
    Remove espacos nas bordas.

    Exemplos:
        safe_str(None)    -> None
        safe_str('nan')   -> None
        safe_str('  SP ') -> 'SP'
        safe_str(123)     -> '123'
    """
    if value is None:
        return None
    s = str(value).strip()
    return s if s and s.lower() not in ("nan", "none", "null", "") else None


def normalize_cnpj_cpf(doc: str | None) -> str | None:
    """
    Normaliza CNPJ/CPF: remove pontos, barras, hifens e espacos.

    Exemplos:
        normalize_cnpj_cpf('00.360.305/0001-04') -> '00360305000104'
        normalize_cnpj_cpf('003605970031112')    -> '003605970031112'
    """
    raw = safe_str(doc)
    if raw is None:
        return None
    cleaned = re.sub(r"[.\-/\s]", "", raw)
    return cleaned or None
