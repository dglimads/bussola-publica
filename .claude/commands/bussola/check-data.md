---
description: Valida a qualidade dos dados no Supabase — contagens, NULLs, IA, consistencia
---

Valide a qualidade dos dados carregados no Supabase seguindo o modelo em `specs/data-model.md`.

## Contexto

Banco: Supabase projeto `yipwbjexekvrqgnpvjfn`
Spec: `specs/data-model.md`
Acesso: use o MCP do Supabase ou gere as queries para o usuario executar no SQL Editor

## Checks a executar

### 1. Contagens por tabela

```sql
SELECT 'dim_partidos' AS tabela, COUNT(*) AS registros FROM dim_partidos
UNION ALL
SELECT 'dim_deputados', COUNT(*) FROM dim_deputados
UNION ALL
SELECT 'dim_temas', COUNT(*) FROM dim_temas
UNION ALL
SELECT 'fato_proposicoes', COUNT(*) FROM fato_proposicoes
UNION ALL
SELECT 'fato_votacoes', COUNT(*) FROM fato_votacoes
UNION ALL
SELECT 'fato_despesas', COUNT(*) FROM fato_despesas
ORDER BY 1;
```

Esperado: ~21 partidos, 513 deputados, 10 temas, >100 proposicoes, >100 votacoes, >100k despesas

### 2. Cobertura de IA (Sprint 3)

```sql
SELECT
    COUNT(*) AS total_proposicoes,
    COUNT(embedding) AS com_embedding,
    COUNT(tema_id) AS com_tema,
    COUNT(resumo_executivo) AS com_resumo,
    ROUND(COUNT(embedding)::numeric / COUNT(*) * 100, 1) AS pct_embedding,
    ROUND(COUNT(tema_id)::numeric / COUNT(*) * 100, 1) AS pct_tema,
    ROUND(COUNT(resumo_executivo)::numeric / COUNT(*) * 100, 1) AS pct_resumo
FROM fato_proposicoes;
```

Meta Sprint 3: >= 80% com embedding, >= 70% com tema, >= 80% com resumo

### 3. Distribuicao por tema

```sql
SELECT
    t.nome AS tema,
    t.critico,
    COUNT(p.proposicao_id) AS proposicoes,
    ROUND(COUNT(p.proposicao_id)::numeric / SUM(COUNT(*)) OVER () * 100, 1) AS pct
FROM dim_temas t
LEFT JOIN fato_proposicoes p ON t.tema_id = p.tema_id
GROUP BY t.tema_id, t.nome, t.critico
ORDER BY proposicoes DESC;
```

### 4. Integridade de FKs

```sql
-- Deputados sem partido valido
SELECT COUNT(*) AS deputados_sem_partido
FROM dim_deputados d
LEFT JOIN dim_partidos p ON d.partido_id = p.partido_id
WHERE p.partido_id IS NULL;

-- Despesas sem deputado valido
SELECT COUNT(*) AS despesas_sem_deputado
FROM fato_despesas de
LEFT JOIN dim_deputados d ON de.deputado_id = d.deputado_id
WHERE d.deputado_id IS NULL;
```

Esperado: 0 em todos.

### 5. Proposicoes recentes (ultimas 7 dias)

```sql
SELECT
    data_apresentacao,
    tipo,
    LEFT(ementa, 80) AS ementa_resumida,
    t.nome AS tema
FROM fato_proposicoes p
LEFT JOIN dim_temas t ON p.tema_id = t.tema_id
WHERE data_apresentacao >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY data_apresentacao DESC
LIMIT 20;
```

## Como executar

1. Via MCP Supabase (se configurado): use a tool `mcp__supabase__*` para executar as queries
2. Via SQL Editor do Supabase: acesse o projeto `yipwbjexekvrqgnpvjfn` e execute manualmente

## Relatorio esperado

Ao final, reporte:
- Contagens por tabela
- Cobertura de IA (% embedding, tema, resumo)
- Status dos checks de integridade (0 erros = OK)
- Lista de proposicoes criticas recentes (se houver)
