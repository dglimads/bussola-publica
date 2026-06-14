"""
Bridges de enriquecimento relacional (roadmap pos V1).

Orquestram fetch (com persistencia de raw) + transform + load + flags para as
relacoes que a listagem da API nao entrega de imediato:

  - autores: ponte N:N proposicao <-> autor   (/proposicoes/{id}/autores)
  - votos:   voto nominal por deputado          (/votacoes/{id}/votos)

Sao idempotentes (upsert) e resumiveis (processam apenas o que falta).
"""
