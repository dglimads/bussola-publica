-- =============================================================================
-- Bussola Publica -- Carga inicial de dim_temas
-- Rodar uma unica vez apos aplicar schema.sql
-- =============================================================================

INSERT INTO dim_temas (tema_id, nome, descricao, critico) VALUES
(1,  'Saude',            'Proposicoes sobre sistema de saude publica, SUS, planos de saude, medicamentos, vigilancia sanitaria e epidemiologica.', TRUE),
(2,  'Tributario',       'Impostos, contribuicoes, reforma tributaria, incentivos fiscais, desoneracao, ICMS, IR, IOF e legislacao fiscal em geral.', TRUE),
(3,  'Trabalho',         'Relacoes trabalhistas, CLT, terceirizacao, salario minimo, previdencia, reforma trabalhista e direitos do trabalhador.', TRUE),
(4,  'Tecnologia e IA',  'Inteligencia artificial, regulacao de plataformas digitais, ciberseguranca, protecao de dados (LGPD), economia digital e inovacao.', TRUE),
(5,  'Meio Ambiente',    'Legislacao ambiental, codigo florestal, licenciamento, mudancas climaticas, agrotoxicos e recursos hidricos.', FALSE),
(6,  'Seguranca Publica','Legislacao penal, policia, presidiarios, armas de fogo, trafico de drogas, violencia e seguranca no transito.', FALSE),
(7,  'Educacao',         'Ensino basico, superior, tecnico, FUNDEB, ENEM, cotas, financiamento estudantil e politicas pedagogicas.', FALSE),
(8,  'Direitos Humanos', 'Protecao de minorias, igualdade racial, genero, criancas e adolescentes, pessoas com deficiencia e povos indigenas.', FALSE),
(9,  'Infraestrutura',   'Obras publicas, transporte, saneamento basico, habitacao, energia eletrica, telecomunicacoes e mobilidade urbana.', FALSE),
(10, 'Economia',         'Politica economica, orcamento, divida publica, exportacoes, industria, comercio exterior e regulacao financeira.', TRUE)
ON CONFLICT (tema_id) DO UPDATE
    SET nome      = EXCLUDED.nome,
        descricao = EXCLUDED.descricao,
        critico   = EXCLUDED.critico;
