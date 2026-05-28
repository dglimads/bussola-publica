# Specs — Bussola Publica

Especificacoes formais do projeto seguindo **SDD (Spec-Driven Development)**
para desenvolvimento assistido por IA.

---

## O que e SDD neste projeto

Specs sao a **fonte da verdade** — nao o codigo, nao os comentarios.
Qualquer mudanca comeca aqui; o codigo segue a spec.

```
Pedido de mudanca
      |
      v
[Atualiza / cria spec]  <-- comeca aqui, sempre
      |
      v
[Claude le a spec + codigo atual]  <-- agente le spec antes de tocar em codigo
      |
      v
[Gera / modifica codigo]
      |
      v
[Testa e valida]
      |
      v
[Atualiza status / changelog da spec]
```

---

## Specs disponiveis

| Spec | Descricao | Status |
|------|-----------|--------|
| [data-model.md](data-model.md) | Schema estrela: tabelas, colunas, PKs, FKs, constraints | active |
| [extract.md](extract.md) | Regras de extracao da API da Camara dos Deputados | active |
| [transform.md](transform.md) | Regras de transformacao Pandas e carga PostgreSQL | active |
| [ai-enrichment.md](ai-enrichment.md) | Pipeline IA: embedding, classificacao tematica, resumo | active |
| [orchestration.md](orchestration.md) | Workflow n8n: cron diario, alertas, monitoramento | active |

---

## Como usar com Claude (exemplos de prompts)

```
# Adicionar novo endpoint
"Claude, leia specs/extract.md e docs/AGENT_INGESTOR.md, depois adicione
 extracao de orgaos ao CamaraAPIClient."

# Debugar transformacao
"Claude, o transform de deputados nao esta seguindo specs/transform.md
 (secao dim_deputados). Leia o arquivo e corrija src/transform/deputados.py."

# Validar alinhamento codigo x spec
"Claude, verifique se src/ai/ esta alinhado com specs/ai-enrichment.md
 e liste qualquer divergencia."

# Adicionar nova entidade
"Claude, leia specs/data-model.md e specs/extract.md para entender os
 padroes, depois adicione suporte a orgaos (comissoes) no pipeline."
```

---

## Como criar uma nova spec

Copie a estrutura de qualquer spec existente e preencha:

```markdown
# Spec: <Nome>

**Status:** draft
**Versao:** 0.1
**Ultima atualizacao:** YYYY-MM-DD
**Implementacao:** <arquivo(s) que implementam esta spec>

## Contexto
Por que esta spec existe.

## Requisitos
- R1: Must ...
- R2: Should ...
- R3: Must not ...

## Contrato de Dados / Interface
Inputs, outputs, efeitos colaterais.

## Regras
Regras de negocio e transformacao.

## Restricoes
Performance, custo, compatibilidade.

## Open Questions
- [ ] Decisoes ainda abertas

## Changelog
- 0.1 (YYYY-MM-DD): Versao inicial
```

Depois de criar, adicione uma linha na tabela acima com status `draft`.
Mude para `active` apos primeira implementacao validada.

---

## Relacao com outros documentos

| Documento | Papel |
|-----------|-------|
| `docs/PRD.md` | Requisitos de produto (escopo amplo, inclui negocio e UI) |
| `docs/AGENT_INGESTOR.md` | System prompt completo para copiloto da camada Extract |
| `docs/AGENT_TRANSFORM.md` | System prompt completo para copiloto da camada Transform |
| `docs/decisoes_ia.md` | ADR (Architecture Decision Record) das escolhas de IA |
| `sql/schema.sql` | DDL executavel — fonte da verdade do banco |
| `specs/*.md` | **Esta pasta** — contratos formais para desenvolvimento com IA |

> **Regra de ouro:** se a spec e o codigo divergem, o codigo esta errado (ou a spec precisa
> ser atualizada consciente e deliberadamente, com changelog).
