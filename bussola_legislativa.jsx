import React, { useState, useMemo, useEffect } from "react";
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Cell, RadarChart, PolarGrid, PolarAngleAxis,
  Radar, PieChart, Pie,
} from "recharts";
import {
  Compass, Radar as RadarIcon, Activity, Vote, Sparkles, Siren,
  AlertTriangle, ArrowUpRight, Database, ShieldAlert, Search, Filter,
} from "lucide-react";

/* ============================================================================
   BÚSSOLA LEGISLATIVA · Radar Legislativo Inteligente
   Snapshot real do Supabase (projeto Bussola_Publica) — carga 13/06/2026 01:53 UTC
   Todos os números abaixo vêm de consultas SQL diretas às 6 tabelas do pipeline.
   ========================================================================== */

const SNAPSHOT = "13/06/2026 · 01:53 UTC";

const KPI = {
  proposicoes: 1550,
  deputados: 523,
  partidos: 21,
  votacoes: 100,
  despesasDocs: 28500,
  despesasTotal: 35895139.32,
  temas: 10,
  comTema: 268,
  comResumo: 300,
  comEmbedding: 300,
  comAutor: 0,
  periodoMin: "18/02/2003",
  periodoMax: "12/06/2026",
};

// Cores por tema (críticos marcados)
const TEMAS = [
  { id: 6, nome: "Segurança Pública", qtd: 50, critico: false, cor: "#9AA7C7" },
  { id: 5, nome: "Meio Ambiente",     qtd: 46, critico: false, cor: "#6FCF97" },
  { id: 2, nome: "Tributário",        qtd: 36, critico: true,  cor: "#E5B567" },
  { id: 1, nome: "Saúde",             qtd: 31, critico: true,  cor: "#FF6B81" },
  { id: 3, nome: "Trabalho",          qtd: 28, critico: true,  cor: "#7CC4FF" },
  { id: 8, nome: "Direitos Humanos",  qtd: 25, critico: false, cor: "#EB5BA0" },
  { id: 9, nome: "Infraestrutura",    qtd: 24, critico: false, cor: "#8B9DC3" },
  { id: 7, nome: "Educação",          qtd: 17, critico: false, cor: "#F2994A" },
  { id: 4, nome: "Tecnologia e IA",   qtd: 6,  critico: true,  cor: "#3BE0C9" },
  { id: 10, nome: "Economia",         qtd: 5,  critico: true,  cor: "#C792EA" },
];
const corTema = (nome) =>
  (TEMAS.find((t) => t.nome.toLowerCase().replace(/[^a-z]/g, "") ===
    nome.toLowerCase().normalize("NFD").replace(/[^a-z]/g, "")) || {}).cor || "#9AA7C7";

const SERIE_DIARIA = [
  { dia: "04/05", qtd: 2 }, { dia: "06/05", qtd: 2 }, { dia: "07/05", qtd: 1 },
  { dia: "11/05", qtd: 4 }, { dia: "13/05", qtd: 1 }, { dia: "17/05", qtd: 72 },
  { dia: "18/05", qtd: 25 }, { dia: "19/05", qtd: 7 }, { dia: "20/05", qtd: 7 },
  { dia: "21/05", qtd: 5 }, { dia: "25/05", qtd: 3 }, { dia: "26/05", qtd: 3 },
  { dia: "27/05", qtd: 61 }, { dia: "28/05", qtd: 15 }, { dia: "29/05", qtd: 93 },
  { dia: "31/05", qtd: 1 }, { dia: "01/06", qtd: 17 }, { dia: "02/06", qtd: 27 },
  { dia: "03/06", qtd: 18 }, { dia: "08/06", qtd: 54 }, { dia: "09/06", qtd: 21 },
  { dia: "10/06", qtd: 9 }, { dia: "11/06", qtd: 482 }, { dia: "12/06", qtd: 62 },
];

const TIPOS = [
  { tipo: "PL", qtd: 496 }, { tipo: "RIC", qtd: 423 }, { tipo: "PRL", qtd: 333 },
  { tipo: "INC", qtd: 70 }, { tipo: "REQ", qtd: 66 }, { tipo: "PDL", qtd: 49 },
  { tipo: "DOC", qtd: 25 }, { tipo: "SBT", qtd: 21 }, { tipo: "PAR", qtd: 13 },
  { tipo: "TVR", qtd: 9 }, { tipo: "ATA", qtd: 7 }, { tipo: "EMC-A", qtd: 7 },
];

const PARTIDOS = [
  { sigla: "PL", nome: "Partido Liberal", dep: 99 },
  { sigla: "PT", nome: "Partido dos Trabalhadores", dep: 66 },
  { sigla: "UNIÃO", nome: "União Brasil", dep: 52 },
  { sigla: "PSD", nome: "Partido Social Democrático", dep: 48 },
  { sigla: "PP", nome: "Progressistas", dep: 47 },
  { sigla: "REPUBLICANOS", nome: "Republicanos", dep: 45 },
  { sigla: "MDB", nome: "Movimento Democrático Brasileiro", dep: 38 },
  { sigla: "PODE", nome: "Podemos", dep: 27 },
  { sigla: "PSDB", nome: "Partido da Social Democracia Brasileira", dep: 19 },
  { sigla: "PSB", nome: "Partido Socialista Brasileiro", dep: 17 },
  { sigla: "PSOL", nome: "Partido Socialismo e Liberdade", dep: 13 },
  { sigla: "PCdoB", nome: "Partido Comunista do Brasil", dep: 11 },
  { sigla: "PDT", nome: "Partido Democrático Trabalhista", dep: 9 },
  { sigla: "PV", nome: "Partido Verde", dep: 6 },
  { sigla: "SOLIDARIEDADE", nome: "Solidariedade", dep: 6 },
  { sigla: "NOVO", nome: "Partido Novo", dep: 5 },
  { sigla: "AVANTE", nome: "Avante", dep: 5 },
  { sigla: "REDE", nome: "Rede Sustentabilidade", dep: 4 },
  { sigla: "PRD", nome: "Partido Renovação Democrática", dep: 3 },
  { sigla: "CIDADANIA", nome: "Cidadania", dep: 2 },
  { sigla: "MISSÃO", nome: "Partido Missão", dep: 1 },
];

const UFS = [
  { uf: "SP", dep: 70 }, { uf: "MG", dep: 54 }, { uf: "RJ", dep: 48 },
  { uf: "BA", dep: 39 }, { uf: "PR", dep: 31 }, { uf: "RS", dep: 31 },
  { uf: "PE", dep: 25 }, { uf: "CE", dep: 23 }, { uf: "MA", dep: 21 },
  { uf: "GO", dep: 17 }, { uf: "PA", dep: 17 }, { uf: "SC", dep: 16 },
  { uf: "PB", dep: 14 }, { uf: "PI", dep: 10 }, { uf: "ES", dep: 10 },
  { uf: "AL", dep: 9 }, { uf: "MS", dep: 8 }, { uf: "DF", dep: 8 },
  { uf: "RN", dep: 8 }, { uf: "AM", dep: 8 }, { uf: "AP", dep: 8 },
  { uf: "TO", dep: 8 }, { uf: "MT", dep: 8 }, { uf: "RR", dep: 8 },
  { uf: "AC", dep: 8 }, { uf: "RO", dep: 8 }, { uf: "SE", dep: 8 },
];

const VOT = { total: 100, aprovadas: 94, reprovadas: 5, semResultado: 1, orgaos: 15,
  dataMin: "13/05/2026", dataMax: "15/05/2026", comProposicao: 0 };
const VOT_ORGAO = [
  { orgao: "PLEN", qtd: 18, aprov: 14 }, { orgao: "CMULHER", qtd: 17, aprov: 17 },
  { orgao: "PLP10821", qtd: 10, aprov: 10 }, { orgao: "CIDOSO", qtd: 9, aprov: 9 },
  { orgao: "CDU", qtd: 9, aprov: 9 }, { orgao: "CCTI", qtd: 7, aprov: 7 },
  { orgao: "CLP", qtd: 5, aprov: 5 }, { orgao: "CE", qtd: 4, aprov: 4 },
  { orgao: "CCULT", qtd: 4, aprov: 4 }, { orgao: "CCJC", qtd: 4, aprov: 3 },
];

const DESP_CAT = [
  { cat: "Divulgação da atividade parlamentar", total: 13585727.56, docs: 2044 },
  { cat: "Passagem aérea (SIGEPA)", total: 6907129.89, docs: 5275 },
  { cat: "Manutenção de escritório de apoio", total: 5029149.87, docs: 3271 },
  { cat: "Locação/fretamento de veículos", total: 4954317.52, docs: 840 },
  { cat: "Combustíveis e lubrificantes", total: 3000413.36, docs: 10383 },
  { cat: "Locação/fretamento de aeronaves", total: 616300.0, docs: 24 },
  { cat: "Hospedagem", total: 534736.44, docs: 1286 },
  { cat: "Telefonia", total: 362882.56, docs: 841 },
];
const DESP_PARTIDO = [
  { sigla: "PL", total: 6826671.07 }, { sigla: "PP", total: 5585733.81 },
  { sigla: "PT", total: 5095347.01 }, { sigla: "MDB", total: 3837473.99 },
  { sigla: "REPUBLICANOS", total: 3093848.51 }, { sigla: "PSDB", total: 2151952.38 },
  { sigla: "PV", total: 1608831.09 }, { sigla: "UNIÃO", total: 1390732.47 },
  { sigla: "PSD", total: 1188692.51 }, { sigla: "PDT", total: 1132622.93 },
  { sigla: "CIDADANIA", total: 1029454.48 }, { sigla: "PODE", total: 976731.12 },
];
const DESP_DEP = [
  { nome: "Antonio Brito", partido: "PSD", uf: "BA", total: 645942.64 },
  { nome: "Cabo Gilberto Silva", partido: "PL", uf: "PB", total: 640737.09 },
  { nome: "Alceu Moreira", partido: "MDB", uf: "RS", total: 624781.09 },
  { nome: "Benes Leocádio", partido: "UNIÃO", uf: "RN", total: 614904.75 },
  { nome: "Aluisio Mendes", partido: "REPUBLICANOS", uf: "MA", total: 610705.20 },
  { nome: "Afonso Hamm", partido: "PP", uf: "RS", total: 607063.67 },
  { nome: "Albuquerque", partido: "REPUBLICANOS", uf: "RR", total: 605731.60 },
  { nome: "Beto Pereira", partido: "REPUBLICANOS", uf: "MS", total: 602960.81 },
  { nome: "Adail Filho", partido: "MDB", uf: "AM", total: 599362.18 },
  { nome: "Aguinaldo Ribeiro", partido: "PP", uf: "PB", total: 592156.09 },
];

// Explorador de IA: proposições enriquecidas (tema + resumo) — amostra real diversificada
const ENRIQUECIDAS = [
  { id: 1738685, tipo: "PL", data: "2015-09-23", tema: "Direitos Humanos", critico: false, ementa: "Altera o Estatuto da Igualdade Racial para acrescentar a 'Violência Racial'.", resumo: "Modifica o Estatuto da Igualdade Racial para incluir o conceito de \"Violência Racial\", ampliando a proteção contra discriminação racial." },
  { id: 1228863, tipo: "PEC", data: "2015-05-05", tema: "Direitos Humanos", critico: false, ementa: "Altera os artigos 14 e 228 da CF para estabelecer maioridade civil e penal aos 16 anos.", resumo: "PEC que estabelece a maioridade civil e penal aos dezesseis anos de idade, alterando a Constituição Federal." },
  { id: 553778, tipo: "PL", data: "2012-08-22", tema: "Direitos Humanos", critico: false, ementa: "Obriga locadoras a ofertarem veículos adaptados (acessibilidade).", resumo: "Impõe às locadoras a obrigação de disponibilizar veículos adaptados para pessoas com deficiência." },
  { id: 310391, tipo: "PL", data: "2005-12-14", tema: "Direitos Humanos", critico: false, ementa: "Define crimes resultantes de discriminação e preconceito de raça, cor, etnia, religião ou origem.", resumo: "Estabelece definições para crimes de discriminação e preconceito por raça, cor, etnia, religião ou origem." },
  { id: 2075519, tipo: "PL", data: "2015-12-16", tema: "Economia", critico: true, ementa: "Aprimora governança, gestão de riscos e controles internos de empresas públicas e sociedades de economia mista da União.", resumo: "Estabelece diretrizes para melhorar governança, gestão de riscos e controles internos em estatais controladas pela União." },
  { id: 1554257, tipo: "PL", data: "2015-07-07", tema: "Economia", critico: true, ementa: "Regulamenta o art. 173, §1º da CF (estatuto jurídico das empresas estatais).", resumo: "Define o estatuto jurídico das estatais que atuam na produção, comercialização de bens ou prestação de serviços." },
  { id: 1295753, tipo: "PL", data: "2015-05-26", tema: "Economia", critico: true, ementa: "Destina às mídias regionais parcela dos recursos de publicidade institucional dos órgãos públicos.", resumo: "Direciona parte dos recursos de publicidade pública para mídias regionais nas três esferas de governo." },
  { id: 493660, tipo: "PL", data: "2011-03-01", tema: "Economia", critico: true, ementa: "Institui o estatuto jurídico da empresa pública e da sociedade de economia mista (art. 173 CF).", resumo: "Cria estatuto jurídico específico para empresas públicas, sociedades de economia mista e suas subsidiárias." },
  { id: 1513953, tipo: "PL", data: "2015-06-18", tema: "Educação", critico: false, ementa: "Autoriza transporte intermunicipal/interestadual de estudantes por veículos dos entes federados.", resumo: "Autoriza transporte de estudantes de cursos técnicos e superiores via veículos adquiridos por programas federais (PNATE, Caminho da Escola)." },
  { id: 955602, tipo: "PL", data: "2015-03-03", tema: "Educação", critico: false, ementa: "Altera a LDB (Lei 9.394/1996).", resumo: "Modifica a Lei de Diretrizes e Bases da Educação Nacional para atualizar suas disposições." },
  { id: 949156, tipo: "PL", data: "2015-02-26", tema: "Educação", critico: false, ementa: "Altera a LDB para dispor sobre educação em tempo integral.", resumo: "Inclui disposições sobre educação em tempo integral, ampliando carga horária e qualidade do ensino." },
  { id: 616539, tipo: "PL", data: "2014-05-21", tema: "Educação", critico: false, ementa: "Autoriza criação de campus da UFFS em Caçador/SC.", resumo: "Autoriza a criação de um campus da Universidade Federal da Fronteira Sul em Caçador, Santa Catarina." },
  { id: 760175, tipo: "PL", data: "2014-11-12", tema: "Infraestrutura", critico: false, ementa: "Obriga pontos de conexão elétrica nos ônibus do transporte público (Política Nacional de Mobilidade Urbana).", resumo: "Exige que ônibus do transporte público coletivo tenham pontos de conexão elétrica." },
  { id: 601008, tipo: "PL", data: "2013-11-14", tema: "Infraestrutura", critico: false, ementa: "Obriga asfaltamento de ruas onde residem pessoas com deficiência e mobilidade reduzida.", resumo: "Torna obrigatório o asfaltamento de ruas onde residem pessoas com deficiência, melhorando acessibilidade." },
  { id: 504195, tipo: "PL", data: "2011-05-26", tema: "Infraestrutura", critico: false, ementa: "Instalações de distribuição de energia subterrâneas em setores históricos.", resumo: "Exige instalações elétricas subterrâneas em ruas de cidades com setores de valor histórico (IPHAN)." },
  { id: 2075835, tipo: "PL", data: "2015-12-17", tema: "Meio Ambiente", critico: false, ementa: "Inclui consciência ecológica e consumo responsável como princípios da educação nacional.", resumo: "Inclui consciência ecológica/ambiental e consumo responsável como princípios da educação nacional na LDB." },
  { id: 2057079, tipo: "PL", data: "2015-12-01", tema: "Meio Ambiente", critico: false, ementa: "Inclui Educação Ambiental a partir do 6º ano do Ensino Fundamental.", resumo: "Inclui o ensino de Educação Ambiental a partir do 6º ano até o fim da Educação Básica, alterando a LDB." },
  { id: 534699, tipo: "PL", data: "2012-02-15", tema: "Meio Ambiente", critico: false, ementa: "Proíbe uso de ftalato em brinquedos.", resumo: "Proíbe o uso de ftalatos na fabricação de brinquedos, visando a segurança de produtos infantis." },
  { id: 580663, tipo: "PL", data: "2013-06-12", tema: "Meio Ambiente", critico: false, ementa: "Dispõe sobre jornada, condições de trabalho e piso salarial dos biólogos.", resumo: "Estabelece jornada, condições laborais e piso salarial para biólogos, regulamentando a profissão." },
  { id: 582806, tipo: "PL", data: "2013-07-02", tema: "Saúde", critico: true, ementa: "Cria o cartão de identificação do usuário do SUS (art. 47-A da Lei 8.080/1990).", resumo: "Cria cartão de identificação para usuários do SUS, facilitando acesso e identificação dos beneficiários." },
  { id: 578374, tipo: "PL", data: "2013-05-23", tema: "Saúde", critico: true, ementa: "Institui prevenção da Dengue junto aos beneficiários do Bolsa Família.", resumo: "Estabelece ações de prevenção à dengue direcionadas a beneficiários do programa Bolsa Família." },
  { id: 559135, tipo: "PL", data: "2012-11-08", tema: "Saúde", critico: true, ementa: "Ressarcimento ao SUS de despesas com tratamento de usuários de tabaco.", resumo: "Estabelece regras de ressarcimento ao SUS pelas despesas com tratamento de usuários de cigarro e tabaco." },
  { id: 551791, tipo: "PL", data: "2012-07-11", tema: "Saúde", critico: true, ementa: "Altera a Lei dos Planos de Saúde: reajuste de contratos coletivos depende de autorização da ANS.", resumo: "Exige autorização da ANS para reajuste de planos coletivos e limita rescisão a fraude/inadimplência >60 dias." },
  { id: 2025606, tipo: "PL", data: "2015-10-28", tema: "Segurança Pública", critico: false, ementa: "Benefício assistencial a instituições de tratamento de dependentes químicos.", resumo: "Cria benefício assistencial para apoiar instituições que tratam dependentes químicos." },
  { id: 1672289, tipo: "PL", data: "2015-08-19", tema: "Segurança Pública", critico: false, ementa: "Institui o Programa Nacional de Recuperação de Dependentes Químicos.", resumo: "Cria o Programa Nacional de Recuperação de Dependentes Químicos, oferecendo suporte e tratamento." },
  { id: 1567797, tipo: "PL", data: "2015-07-08", tema: "Segurança Pública", critico: false, ementa: "Causa de aumento de pena para o crime de roubo.", resumo: "Estabelece causa de aumento de pena para o crime de roubo, endurecendo as sanções." },
  { id: 1515753, tipo: "PL", data: "2015-06-24", tema: "Trabalho", critico: true, ementa: "Altera a Lei 8.213/1991: cálculo do salário de benefício de atividade concomitante.", resumo: "Modifica o cálculo do salário de benefício para segurados que exercem atividades simultâneas." },
  { id: 1194323, tipo: "PL", data: "2015-03-27", tema: "Trabalho", critico: true, ementa: "Cria Varas do Trabalho na jurisdição do TRT da 4ª Região.", resumo: "Cria Varas do Trabalho na área do TRT da 4ª Região, melhorando a estrutura da Justiça do Trabalho." },
  { id: 866002, tipo: "PL", data: "2015-01-26", tema: "Trabalho", critico: true, ementa: "Cria cargos de Juiz do Trabalho Substituto no TRT da 7ª Região.", resumo: "Prevê criação de cargos de Juiz do Trabalho Substituto e efetivos no TRT da 7ª Região." },
  { id: 2024822, tipo: "PL", data: "2015-10-27", tema: "Tributário", critico: true, ementa: "Incentivos fiscais para produção de veículos elétricos/híbridos e pontos de abastecimento.", resumo: "Cria incentivos fiscais para produção de veículos elétricos e híbridos e instalação de pontos de recarga." },
  { id: 1806144, tipo: "PL", data: "2015-09-30", tema: "Tributário", critico: true, ementa: "Benefícios fiscais de IRPF e IPI para quem assume guarda, tutela ou adoção.", resumo: "Concede benefícios de IR e IPI a pessoas físicas que assumem guarda, tutela ou adoção de crianças/adolescentes." },
  { id: 1734326, tipo: "PL", data: "2015-09-16", tema: "Tributário", critico: true, ementa: "CSLL sobre lucro de empresas de tabaco e bebidas (altera a Lei 7.689/1988).", resumo: "Estabelece regras de CSLL para empresas que produzem charutos, cigarros e bebidas alcoólicas." },
  { id: 1229804, tipo: "PL", data: "2015-05-06", tema: "Tributário", critico: true, ementa: "Incentivos fiscais para produção e comercialização de veículos elétricos/híbridos.", resumo: "Estabelece incentivos fiscais para produção e venda de veículos elétricos e híbridos." },
  { id: 1212659, tipo: "PL", data: "2015-04-16", tema: "Tributário", critico: true, ementa: "Estatuto jurídico das empresas estatais (art. 173 e 177 da CF).", resumo: "Define o estatuto jurídico das estatais conforme a Constituição, incluindo as do art. 177." },
];

// Lista de monitoramento: críticas classificadas mais recentes (real)
const MONITORAMENTO = [
  { id: 2485099, tipo: "PL", data: "2025-02-20", tema: "Trabalho", ementa: "Dispensa de multa por rescisão antecipada de aluguel a mulheres em situação de violência doméstica." },
  { id: 2482178, tipo: "PL", data: "2025-02-03", tema: "Tributário", ementa: "Declara as Folias do Divino Espírito Santo (TO) como manifestação da cultura nacional." },
  { id: 2480975, tipo: "PL", data: "2024-12-18", tema: "Tributário", ementa: "Reconhece o Ticumbi como manifestação cultural e patrimônio imaterial do Brasil." },
  { id: 2468146, tipo: "PL", data: "2024-11-12", tema: "Trabalho", ementa: "Altera a jornada de trabalho dos profissionais do magistério da educação básica (Lei 11.738/2008)." },
  { id: 2466388, tipo: "PL", data: "2024-10-31", tema: "Saúde", ementa: "Institui a Política Nacional de Atenção à Gagueira e à Pessoa que Gagueja." },
  { id: 2464156, tipo: "PL", data: "2024-10-24", tema: "Tributário", ementa: "Destina a Cide-Combustíveis ao pagamento de subsídios a tarifas (altera a Lei 10.336/2001)." },
];

/* ---------- helpers ---------- */
const fmtInt = (n) => n.toLocaleString("pt-BR");
const fmtBRL = (n) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const fmtMi = (n) => "R$ " + (n / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + " mi";
const pct = (a, b) => ((a / b) * 100).toFixed(1) + "%";
const linkCamara = (id) =>
  `https://www.camara.leg.br/proposicoesWeb/fichadetramitacao?idProposicao=${id}`;

/* ---------- score de relevância (sugestão de métrica, calculada em dados reais) ---------- */
const pesoTipo = (t) => (["PL", "PLP", "PEC", "MPV"].includes(t) ? 3 : ["PDL", "PLV"].includes(t) ? 2 : 1);
const pesoRecencia = (data) => {
  const ano = +data.slice(0, 4);
  if (ano >= 2026) return 4; if (ano === 2025) return 3; if (ano === 2024) return 2;
  if (ano >= 2022) return 1; return 0.5;
};
const scoreRelevancia = (p) =>
  pesoTipo(p.tipo) + (p.critico ? 3 : 1) + pesoRecencia(p.data) + 0; // peso_votacao=0 (pendência)

/* ============================ UI PRIMITIVES ============================ */
const Eyebrow = ({ children, color }) => (
  <span className="eyebrow" style={color ? { color } : undefined}>{children}</span>
);
const Panel = ({ children, className = "", style }) => (
  <div className={`panel ${className}`} style={style}>{children}</div>
);
const Note = ({ children, icon: Icon = AlertTriangle, tone = "amber" }) => (
  <div className={`note note-${tone}`}>
    <Icon size={14} strokeWidth={2.2} />
    <span>{children}</span>
  </div>
);

const KpiCard = ({ label, value, sub, accent, icon: Icon }) => (
  <Panel className="kpi">
    <div className="kpi-top">
      <span className="eyebrow">{label}</span>
      {Icon && <Icon size={15} style={{ color: accent || "var(--dim)" }} strokeWidth={2} />}
    </div>
    <div className="kpi-value" style={accent ? { color: accent } : undefined}>{value}</div>
    {sub && <div className="kpi-sub">{sub}</div>}
  </Panel>
);

const chartTooltip = {
  contentStyle: {
    background: "#0c1424", border: "1px solid rgba(148,163,184,.22)",
    borderRadius: 10, fontSize: 12, color: "#EAF0FB",
    boxShadow: "0 8px 24px rgba(0,0,0,.45)", fontFamily: "var(--mono)",
  },
  labelStyle: { color: "#93A4C0", fontWeight: 600 },
  cursor: { fill: "rgba(148,163,184,.06)" },
};

/* ============================ RADAR SIGNATURE ============================ */
function RadarSignature({ reduced }) {
  const top = TEMAS.slice(0, 8);
  const max = Math.max(...top.map((t) => t.qtd));
  const cx = 130, cy = 130, R = 112;
  return (
    <svg viewBox="0 0 260 260" className="radar-sig" aria-hidden="true">
      <defs>
        <radialGradient id="rg" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#16314a" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#0a0f1c" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="sweep" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#3BE0C9" stopOpacity="0" />
          <stop offset="100%" stopColor="#3BE0C9" stopOpacity="0.5" />
        </linearGradient>
      </defs>
      <circle cx={cx} cy={cy} r={R} fill="url(#rg)" />
      {[0.33, 0.66, 1].map((f, i) => (
        <circle key={i} cx={cx} cy={cy} r={R * f} fill="none"
          stroke="rgba(148,163,184,.16)" strokeWidth="1" />
      ))}
      {top.map((_, i) => {
        const a = (Math.PI * 2 * i) / top.length - Math.PI / 2;
        return <line key={i} x1={cx} y1={cy} x2={cx + R * Math.cos(a)} y2={cy + R * Math.sin(a)}
          stroke="rgba(148,163,184,.10)" strokeWidth="1" />;
      })}
      {!reduced && (
        <g className="sweep-rot" style={{ transformOrigin: `${cx}px ${cy}px` }}>
          <path d={`M${cx} ${cy} L${cx + R} ${cy} A${R} ${R} 0 0 0 ${cx + R * Math.cos(-0.5)} ${cy + R * Math.sin(-0.5)} Z`}
            fill="url(#sweep)" />
          <line x1={cx} y1={cy} x2={cx + R} y2={cy} stroke="#3BE0C9" strokeWidth="1.5" />
        </g>
      )}
      {top.map((t, i) => {
        const a = (Math.PI * 2 * i) / top.length - Math.PI / 2;
        const r = 22 + (R - 28) * (t.qtd / max);
        const x = cx + r * Math.cos(a), y = cy + r * Math.sin(a);
        return (
          <g key={t.id}>
            <circle cx={x} cy={y} r={t.critico ? 5.5 : 4} fill={t.cor}
              stroke={t.critico ? "#FF5C6C" : "none"} strokeWidth={t.critico ? 1.5 : 0} />
            {t.critico && <circle cx={x} cy={y} r="9" fill="none" stroke={t.cor} strokeOpacity="0.4" strokeWidth="1" />}
          </g>
        );
      })}
      <circle cx={cx} cy={cy} r="3.5" fill="#E5B567" />
    </svg>
  );
}

/* ============================ SECTIONS ============================ */
function VisaoGeral() {
  const coberturaIA = [
    { name: "Enriquecidas", value: KPI.comResumo, cor: "#3BE0C9" },
    { name: "Pendentes", value: KPI.proposicoes - KPI.comResumo, cor: "#283449" },
  ];
  return (
    <div className="stack">
      <div className="kpi-grid">
        <KpiCard label="Proposições" value={fmtInt(KPI.proposicoes)} sub="monitoradas na base" icon={Database} accent="#EAF0FB" />
        <KpiCard label="Deputados" value={fmtInt(KPI.deputados)} sub="523 em exercício · 27 UFs" icon={Activity} />
        <KpiCard label="Partidos" value={KPI.partidos} sub="legendas com bancada" icon={Compass} />
        <KpiCard label="Votações" value={KPI.votacoes} sub="13–15/mai · 15 órgãos" icon={Vote} />
        <KpiCard label="Despesas (CEAP)" value={fmtMi(KPI.despesasTotal)} sub={`${fmtInt(KPI.despesasDocs)} documentos`} icon={ArrowUpRight} accent="#E5B567" />
        <KpiCard label="Classificadas por IA" value={fmtInt(KPI.comTema)} sub={`${pct(KPI.comTema, KPI.proposicoes)} do acervo`} icon={Sparkles} accent="#3BE0C9" />
        <KpiCard label="Resumos executivos" value={fmtInt(KPI.comResumo)} sub={`${pct(KPI.comResumo, KPI.proposicoes)} gerados`} icon={Sparkles} accent="#3BE0C9" />
        <KpiCard label="Última varredura" value="01:53" sub="13/06/2026 (UTC)" icon={RadarIcon} />
      </div>

      <div className="grid-2">
        <Panel>
          <div className="panel-head">
            <div><Eyebrow color="#7CC4FF">Fluxo legislativo</Eyebrow><h3>Evolução diária de proposições</h3></div>
            <span className="muted-tag">desde 01/mai</span>
          </div>
          <ResponsiveContainer width="100%" height={230}>
            <AreaChart data={SERIE_DIARIA} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id="gd" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#7CC4FF" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#7CC4FF" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,.08)" />
              <XAxis dataKey="dia" tick={{ fontSize: 10, fill: "#5C6E8C" }} interval={2} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#5C6E8C" }} tickLine={false} axisLine={false} />
              <Tooltip {...chartTooltip} />
              <Area type="monotone" dataKey="qtd" name="Proposições" stroke="#7CC4FF" strokeWidth={2} fill="url(#gd)" />
            </AreaChart>
          </ResponsiveContainer>
          <p className="caption">Pico em 11/jun (482) corresponde a uma carga de backfill do pipeline; quartas-feiras concentram a pauta.</p>
        </Panel>

        <Panel>
          <div className="panel-head">
            <div><Eyebrow color="#3BE0C9">Maturidade da IA</Eyebrow><h3>Cobertura de enriquecimento</h3></div>
          </div>
          <div className="donut-wrap">
            <ResponsiveContainer width="100%" height={230}>
              <PieChart>
                <Pie data={coberturaIA} dataKey="value" innerRadius={62} outerRadius={92} paddingAngle={2} stroke="none">
                  {coberturaIA.map((d, i) => <Cell key={i} fill={d.cor} />)}
                </Pie>
                <Tooltip {...chartTooltip} />
              </PieChart>
            </ResponsiveContainer>
            <div className="donut-center">
              <div className="donut-big">{pct(KPI.comResumo, KPI.proposicoes)}</div>
              <div className="donut-label">enriquecidas</div>
            </div>
          </div>
          <p className="caption"><b style={{ color: "#3BE0C9" }}>{fmtInt(KPI.comResumo)}</b> com resumo + embedding · <b>{fmtInt(KPI.proposicoes - KPI.comResumo)}</b> aguardando processamento.</p>
        </Panel>
      </div>

      <div className="grid-2">
        <Panel>
          <div className="panel-head"><div><Eyebrow>Composição do acervo</Eyebrow><h3>Proposições por tipo</h3></div></div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={TIPOS} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,.08)" vertical={false} />
              <XAxis dataKey="tipo" tick={{ fontSize: 10, fill: "#5C6E8C" }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#5C6E8C" }} tickLine={false} axisLine={false} />
              <Tooltip {...chartTooltip} />
              <Bar dataKey="qtd" name="Qtd" radius={[3, 3, 0, 0]} fill="#7CC4FF" />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
        <Panel>
          <div className="panel-head"><div><Eyebrow color="#E5B567">Classificação por IA</Eyebrow><h3>Proposições por tema</h3></div></div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={TEMAS} layout="vertical" margin={{ top: 0, right: 12, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,.08)" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: "#5C6E8C" }} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="nome" width={108} tick={{ fontSize: 10, fill: "#93A4C0" }} tickLine={false} axisLine={false} />
              <Tooltip {...chartTooltip} />
              <Bar dataKey="qtd" name="Proposições" radius={[0, 3, 3, 0]}>
                {TEMAS.map((t, i) => <Cell key={i} fill={t.cor} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      </div>
    </div>
  );
}

function RadarTematico() {
  const [soCriticos, setSoCriticos] = useState(false);
  const dados = soCriticos ? TEMAS.filter((t) => t.critico) : TEMAS;
  const radarData = TEMAS.map((t) => ({ tema: t.nome.split(" ")[0], qtd: t.qtd }));
  const criticasTotal = TEMAS.filter((t) => t.critico).reduce((s, t) => s + t.qtd, 0);
  return (
    <div className="stack">
      <div className="kpi-grid four">
        <KpiCard label="Tema dominante" value="Segurança Púb." sub="50 proposições" accent="#9AA7C7" />
        <KpiCard label="Temas críticos" value={`${criticasTotal}`} sub={`${pct(criticasTotal, KPI.comTema)} das classificadas`} accent="#FF5C6C" icon={Siren} />
        <KpiCard label="Tema crítico líder" value="Tributário" sub="36 proposições" accent="#E5B567" />
        <KpiCard label="Sem classificação" value={fmtInt(KPI.proposicoes - KPI.comTema)} sub="pendência de enriquecimento" accent="#F5A524" icon={AlertTriangle} />
      </div>

      <div className="grid-2">
        <Panel>
          <div className="panel-head">
            <div><Eyebrow color="#E5B567">Pauta</Eyebrow><h3>Ranking de temas</h3></div>
            <button className={`toggle ${soCriticos ? "on" : ""}`} onClick={() => setSoCriticos((v) => !v)}>
              <Filter size={12} /> {soCriticos ? "Só críticos" : "Todos"}
            </button>
          </div>
          <div className="rank">
            {dados.map((t) => (
              <div key={t.id} className="rank-row">
                <div className="rank-name">
                  <span className="dot" style={{ background: t.cor }} />
                  {t.nome}{t.critico && <span className="crit-tag">crítico</span>}
                </div>
                <div className="rank-bar-wrap">
                  <div className="rank-bar" style={{ width: `${(t.qtd / 50) * 100}%`, background: t.cor }} />
                </div>
                <span className="rank-val">{t.qtd}</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel>
          <div className="panel-head"><div><Eyebrow color="#3BE0C9">Distribuição</Eyebrow><h3>Radar temático</h3></div></div>
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={radarData} outerRadius={110}>
              <PolarGrid stroke="rgba(148,163,184,.18)" />
              <PolarAngleAxis dataKey="tema" tick={{ fontSize: 10, fill: "#93A4C0" }} />
              <Radar dataKey="qtd" stroke="#3BE0C9" fill="#3BE0C9" fillOpacity={0.28} strokeWidth={2} />
              <Tooltip {...chartTooltip} />
            </RadarChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      <Note tone="cyan" icon={Sparkles}>
        Heatmap <b>tema × partido</b> e <b>autor</b> dependem de <code>autor_id</code> na <code>fato_proposicoes</code>, hoje 100% nulo
        (relação proposição-autor é N:N e exige a ponte <code>ponte_proposicao_autores</code>). Mapeado como próximo passo do pipeline.
      </Note>
    </div>
  );
}

function Atividade() {
  return (
    <div className="stack">
      <Note tone="amber">
        A API não traz o autor diretamente em <code>/proposicoes</code> — por isso <b>“proposições por deputado/partido”</b> ainda não é mensurável
        (<code>autor_id</code> nulo). Esta seção usa os sinais <b>reais já carregados</b>: composição das bancadas e <b>cota parlamentar (CEAP)</b>, que liga deputado → partido.
      </Note>

      <div className="grid-2">
        <Panel>
          <div className="panel-head"><div><Eyebrow>Composição</Eyebrow><h3>Bancada por partido</h3></div><span className="muted-tag">523 deputados</span></div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={PARTIDOS.slice(0, 14)} margin={{ top: 4, right: 8, left: -20, bottom: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,.08)" vertical={false} />
              <XAxis dataKey="sigla" tick={{ fontSize: 9, fill: "#5C6E8C" }} angle={-45} textAnchor="end" height={40} tickLine={false} axisLine={false} interval={0} />
              <YAxis tick={{ fontSize: 10, fill: "#5C6E8C" }} tickLine={false} axisLine={false} />
              <Tooltip {...chartTooltip} />
              <Bar dataKey="dep" name="Deputados" radius={[3, 3, 0, 0]} fill="#7CC4FF" />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
        <Panel>
          <div className="panel-head"><div><Eyebrow>Distribuição federativa</Eyebrow><h3>Deputados por UF</h3></div></div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={UFS.slice(0, 16)} margin={{ top: 4, right: 8, left: -20, bottom: 24 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,.08)" vertical={false} />
              <XAxis dataKey="uf" tick={{ fontSize: 9, fill: "#5C6E8C" }} tickLine={false} axisLine={false} interval={0} />
              <YAxis tick={{ fontSize: 10, fill: "#5C6E8C" }} tickLine={false} axisLine={false} />
              <Tooltip {...chartTooltip} />
              <Bar dataKey="dep" name="Deputados" radius={[3, 3, 0, 0]} fill="#6FCF97" />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      <div className="grid-2">
        <Panel>
          <div className="panel-head"><div><Eyebrow color="#E5B567">Cota parlamentar</Eyebrow><h3>Despesa líquida por partido</h3></div><span className="muted-tag">amostra: 77 deputados · 2025</span></div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={DESP_PARTIDO} layout="vertical" margin={{ top: 0, right: 12, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,.08)" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 9, fill: "#5C6E8C" }} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1e6).toFixed(0)}M`} />
              <YAxis type="category" dataKey="sigla" width={92} tick={{ fontSize: 10, fill: "#93A4C0" }} tickLine={false} axisLine={false} />
              <Tooltip {...chartTooltip} formatter={(v) => fmtBRL(v)} />
              <Bar dataKey="total" name="Despesa" radius={[0, 3, 3, 0]} fill="#E5B567" />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
        <Panel>
          <div className="panel-head"><div><Eyebrow color="#E5B567">Cota parlamentar</Eyebrow><h3>Top deputados por despesa</h3></div></div>
          <div className="table">
            <div className="trow thead"><span>Deputado</span><span>Part.</span><span>UF</span><span className="ta-r">Despesa líq.</span></div>
            {DESP_DEP.map((d) => (
              <div key={d.nome} className="trow">
                <span className="td-strong">{d.nome}</span>
                <span><span className="part-chip">{d.partido}</span></span>
                <span className="td-dim">{d.uf}</span>
                <span className="ta-r td-mono">{fmtBRL(d.total)}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function Votacoes() {
  const aprov = [
    { name: "Aprovadas", value: VOT.aprovadas, cor: "#6FCF97" },
    { name: "Reprovadas", value: VOT.reprovadas, cor: "#FF5C6C" },
    { name: "Sem resultado", value: VOT.semResultado, cor: "#5C6E8C" },
  ];
  return (
    <div className="stack">
      <div className="kpi-grid four">
        <KpiCard label="Votações" value={VOT.total} sub={`${VOT.dataMin} – ${VOT.dataMax}`} icon={Vote} />
        <KpiCard label="Aprovadas" value={VOT.aprovadas} sub={pct(VOT.aprovadas, VOT.total)} accent="#6FCF97" />
        <KpiCard label="Reprovadas" value={VOT.reprovadas} sub={pct(VOT.reprovadas, VOT.total)} accent="#FF5C6C" />
        <KpiCard label="Órgãos" value={VOT.orgaos} sub="comissões + plenário" />
      </div>
      <div className="grid-2">
        <Panel>
          <div className="panel-head"><div><Eyebrow>Onde se decide</Eyebrow><h3>Votações por órgão</h3></div></div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={VOT_ORGAO} layout="vertical" margin={{ top: 0, right: 12, left: 12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,.08)" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: "#5C6E8C" }} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="orgao" width={84} tick={{ fontSize: 10, fill: "#93A4C0" }} tickLine={false} axisLine={false} />
              <Tooltip {...chartTooltip} />
              <Bar dataKey="qtd" name="Votações" radius={[0, 3, 3, 0]} fill="#7CC4FF" />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
        <Panel>
          <div className="panel-head"><div><Eyebrow color="#6FCF97">Resultado</Eyebrow><h3>Aprovação</h3></div></div>
          <div className="donut-wrap">
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={aprov} dataKey="value" innerRadius={66} outerRadius={98} paddingAngle={2} stroke="none">
                  {aprov.map((d, i) => <Cell key={i} fill={d.cor} />)}
                </Pie>
                <Tooltip {...chartTooltip} />
              </PieChart>
            </ResponsiveContainer>
            <div className="donut-center">
              <div className="donut-big" style={{ color: "#6FCF97" }}>{pct(VOT.aprovadas, VOT.total)}</div>
              <div className="donut-label">aprovadas</div>
            </div>
          </div>
        </Panel>
      </div>
      <Note tone="slate" icon={Vote}>
        Os eventos de votação ainda <b>não estão ligados às proposições</b> (<code>proposicao_id</code> nulo) nem há voto nominal por deputado —
        por isso “votações por partido / distribuição de votos” fica <b>preparado para evolução</b>. Disponíveis hoje: órgão, data e aprovação.
      </Note>
    </div>
  );
}

function IALegislativa() {
  const [tema, setTema] = useState("Todos");
  const [tipo, setTipo] = useState("Todos");
  const [busca, setBusca] = useState("");
  const temasOpt = ["Todos", ...Array.from(new Set(ENRIQUECIDAS.map((p) => p.tema)))];
  const tiposOpt = ["Todos", ...Array.from(new Set(ENRIQUECIDAS.map((p) => p.tipo)))];

  const filtradas = useMemo(() => {
    return ENRIQUECIDAS
      .filter((p) => tema === "Todos" || p.tema === tema)
      .filter((p) => tipo === "Todos" || p.tipo === tipo)
      .filter((p) => !busca || (p.ementa + p.resumo).toLowerCase().includes(busca.toLowerCase()))
      .map((p) => ({ ...p, score: scoreRelevancia(p) }))
      .sort((a, b) => b.score - a.score);
  }, [tema, tipo, busca]);

  const cob = [
    { name: "Classificadas", value: KPI.comTema, cor: "#3BE0C9" },
    { name: "Resumidas (sem tema)", value: KPI.comResumo - KPI.comTema, cor: "#7CC4FF" },
    { name: "Pendentes", value: KPI.proposicoes - KPI.comResumo, cor: "#283449" },
  ];

  return (
    <div className="stack">
      <Panel className="hero-ia">
        <Eyebrow color="#3BE0C9">A camada que diferencia o produto</Eyebrow>
        <h2 className="ia-title">Cada proposição vira <span className="grad">tema + resumo executivo</span> sem leitura humana.</h2>
        <p className="ia-sub">
          Embeddings <code>text-embedding-3-small</code> classificam a ementa por similaridade de cosseno contra 10 temas;
          o <code>gpt-4o-mini</code> gera o resumo de 3 linhas. Persistidos em <code>tema_id</code>, <code>resumo_executivo</code> e <code>embedding (pgvector)</code>.
        </p>
        <div className="ia-stats">
          <div><b style={{ color: "#3BE0C9" }}>{fmtInt(KPI.comTema)}</b><span>classificadas</span></div>
          <div><b style={{ color: "#7CC4FF" }}>{fmtInt(KPI.comResumo)}</b><span>resumos</span></div>
          <div><b style={{ color: "#7CC4FF" }}>{fmtInt(KPI.comEmbedding)}</b><span>embeddings</span></div>
          <div><b style={{ color: "#F5A524" }}>{fmtInt(KPI.proposicoes - KPI.comResumo)}</b><span>na fila</span></div>
        </div>
      </Panel>

      <div className="grid-2">
        <Panel>
          <div className="panel-head"><div><Eyebrow color="#3BE0C9">Funil de enriquecimento</Eyebrow><h3>Estado da camada de IA</h3></div></div>
          <div className="donut-wrap">
            <ResponsiveContainer width="100%" height={230}>
              <PieChart>
                <Pie data={cob} dataKey="value" innerRadius={60} outerRadius={90} paddingAngle={2} stroke="none">
                  {cob.map((d, i) => <Cell key={i} fill={d.cor} />)}
                </Pie>
                <Tooltip {...chartTooltip} />
              </PieChart>
            </ResponsiveContainer>
            <div className="donut-center">
              <div className="donut-big" style={{ color: "#3BE0C9" }}>{KPI.comTema}</div>
              <div className="donut-label">com tema</div>
            </div>
          </div>
          <div className="legend">
            {cob.map((d) => <span key={d.name}><i style={{ background: d.cor }} />{d.name}: <b>{fmtInt(d.value)}</b></span>)}
          </div>
        </Panel>

        <Panel className="score-card">
          <div className="panel-head"><div><Eyebrow color="#E5B567">Métrica proposta</Eyebrow><h3>Score de relevância executiva</h3></div></div>
          <p className="caption" style={{ marginTop: 0 }}>
            Sinal simples calculado <b>sobre campos reais</b> para priorizar o que merece atenção:
          </p>
          <div className="formula">
            <span>score</span> = <em style={{ color: "#7CC4FF" }}>peso_tipo</em>
            + <em style={{ color: "#FF5C6C" }}>peso_tema_crítico</em>
            + <em style={{ color: "#6FCF97" }}>peso_recência</em>
            + <em style={{ color: "#5C6E8C" }}>peso_votação</em>
          </div>
          <ul className="score-legend">
            <li><b>tipo</b> — PL/PEC/PLP = 3 · PDL = 2 · demais = 1</li>
            <li><b>crítico</b> — tema crítico = 3 · senão 1</li>
            <li><b>recência</b> — 2026 = 4 → ≤2021 = 0,5</li>
            <li><b>votação</b> — 0 por ora (depende do vínculo proposição↔votação)</li>
          </ul>
        </Panel>
      </div>

      <Panel>
        <div className="panel-head">
          <div><Eyebrow color="#3BE0C9">Explorador</Eyebrow><h3>Proposições enriquecidas pela IA</h3></div>
          <span className="muted-tag">{filtradas.length} de {ENRIQUECIDAS.length}</span>
        </div>
        <div className="filters">
          <div className="search">
            <Search size={14} />
            <input placeholder="Buscar na ementa ou resumo…" value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
          <select value={tema} onChange={(e) => setTema(e.target.value)}>
            {temasOpt.map((t) => <option key={t}>{t}</option>)}
          </select>
          <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
            {tiposOpt.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div className="ia-cards">
          {filtradas.map((p) => (
            <a key={p.id} className="ia-card" href={linkCamara(p.id)} target="_blank" rel="noreferrer">
              <div className="ia-card-head">
                <span className="tema-chip" style={{ background: corTema(p.tema) + "22", color: corTema(p.tema), borderColor: corTema(p.tema) + "55" }}>
                  {p.tema}{p.critico && " ●"}
                </span>
                <span className="ia-meta">{p.tipo} · {p.data.split("-").reverse().join("/")}</span>
                <span className="score-pill" title="score de relevância">{p.score.toFixed(1)}</span>
              </div>
              <div className="ia-ementa">{p.ementa}</div>
              <div className="ia-resumo"><Sparkles size={11} /> {p.resumo}</div>
            </a>
          ))}
          {filtradas.length === 0 && <div className="empty">Nenhuma proposição enriquecida bate com os filtros. Ajuste a busca para ver os resumos da IA.</div>}
        </div>
      </Panel>
    </div>
  );
}

function Alertas() {
  const pendentes2026 = 1116;
  return (
    <div className="stack">
      <Panel className="alert-hero">
        <div className="alert-hero-icon"><Siren size={22} /></div>
        <div>
          <Eyebrow color="#F5A524">Alerta de pipeline · prioridade alta</Eyebrow>
          <h3 style={{ margin: "4px 0 6px" }}>{fmtInt(KPI.proposicoes - KPI.comTema)} proposições aguardam classificação de IA</h3>
          <p className="caption" style={{ margin: 0 }}>
            O enriquecimento cobre um lote inicial (2003–fev/2025). As <b>{fmtInt(pendentes2026)} proposições de 2026</b> — incluindo as 482 de 11/jun —
            ainda estão sem tema e sem resumo. Rodar <code>3_run_ai_enrichment.py</code> no backlog recente fecha a lacuna e ativa os alertas de tema crítico em tempo real.
          </p>
        </div>
      </Panel>

      <div className="grid-2">
        <Panel>
          <div className="panel-head"><div><Eyebrow color="#FF5C6C">Temas críticos na base</Eyebrow><h3>Sinais que disparam alerta</h3></div></div>
          <div className="crit-grid">
            {TEMAS.filter((t) => t.critico).map((t) => (
              <div key={t.id} className="crit-cell" style={{ borderColor: t.cor + "44" }}>
                <span className="dot" style={{ background: t.cor }} />
                <div className="crit-cell-body">
                  <span className="crit-cell-name">{t.nome}</span>
                  <span className="crit-cell-val">{t.qtd} <em>proposições</em></span>
                </div>
              </div>
            ))}
          </div>
          <p className="caption">
            Temas marcados <code>critico = true</code> em <code>dim_temas</code> priorizam as proposições no e-mail semanal da equipe (Top 5), enviado pelo n8n toda segunda 08h.
          </p>
        </Panel>

        <Panel>
          <div className="panel-head"><div><Eyebrow>Monitoramento</Eyebrow><h3>Últimas críticas classificadas</h3></div></div>
          <div className="mon-list">
            {MONITORAMENTO.map((p) => (
              <a key={p.id} className="mon-row" href={linkCamara(p.id)} target="_blank" rel="noreferrer">
                <span className="tema-chip sm" style={{ background: corTema(p.tema) + "22", color: corTema(p.tema), borderColor: corTema(p.tema) + "55" }}>{p.tema}</span>
                <div className="mon-body">
                  <span className="mon-ementa">{p.ementa}</span>
                  <span className="mon-meta">{p.tipo} {p.id} · {p.data.split("-").reverse().join("/")}</span>
                </div>
                <ArrowUpRight size={14} className="mon-arrow" />
              </a>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

/* ============================ APP SHELL ============================ */
const TABS = [
  { id: "geral", label: "Visão Geral", icon: Compass, comp: VisaoGeral },
  { id: "radar", label: "Radar Temático", icon: RadarIcon, comp: RadarTematico },
  { id: "atividade", label: "Atividade Parlamentar", icon: Activity, comp: Atividade },
  { id: "votacoes", label: "Votações", icon: Vote, comp: Votacoes },
  { id: "ia", label: "IA Legislativa", icon: Sparkles, comp: IALegislativa },
  { id: "alertas", label: "Alertas", icon: Siren, comp: Alertas },
];

export default function App() {
  const [tab, setTab] = useState("geral");
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(m.matches);
  }, []);
  const Active = TABS.find((t) => t.id === tab).comp;

  return (
    <div className="bl-root">
      <style>{CSS}</style>

      <header className="topbar">
        <div className="brand">
          <span className="brand-mark"><Compass size={20} strokeWidth={2.2} /></span>
          <div className="brand-text">
            <div className="brand-name">Bússola Legislativa</div>
            <div className="brand-sub">Radar Legislativo Inteligente</div>
          </div>
        </div>
        <div className="topbar-right">
          <span className="live"><i /> Última varredura {SNAPSHOT}</span>
          <span className="src">Supabase · 6 tabelas · API Câmara dos Deputados</span>
        </div>
      </header>

      {tab === "geral" && (
        <section className="hero">
          <div className="hero-copy">
            <Eyebrow color="#3BE0C9">Inteligência legislativa automatizada</Eyebrow>
            <h1>O oceano de dados da Câmara,<br />destilado em <span className="grad">sinal acionável</span>.</h1>
            <p>
              Captura, organiza e enriquece com IA o fluxo diário de proposições, votações e despesas dos
              513 deputados — pipeline Python/Pandas → Supabase/PostgreSQL → OpenAI → n8n.
            </p>
            <div className="hero-pills">
              <span><b>{fmtInt(KPI.proposicoes)}</b> proposições</span>
              <span><b>{fmtInt(KPI.deputados)}</b> deputados</span>
              <span><b>{fmtMi(KPI.despesasTotal)}</b> em despesas</span>
              <span className="cyan"><b>{fmtInt(KPI.comResumo)}</b> enriquecidas por IA</span>
            </div>
          </div>
          <div className="hero-radar">
            <RadarSignature reduced={reduced} />
            <span className="hero-radar-cap">Radar de temas · críticos em destaque</span>
          </div>
        </section>
      )}

      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t.id} className={`tab ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}>
            <t.icon size={15} strokeWidth={2} /> {t.label}
          </button>
        ))}
      </nav>

      <main className="content"><Active /></main>

      <footer className="foot">
        <div className="foot-intro">
          Este painel consolida dados capturados da <b>API de Dados Abertos da Câmara dos Deputados</b>,
          tratados pelo pipeline <b>Python/Pandas</b>, carregados no <b>Supabase/PostgreSQL</b> e enriquecidos com
          <b> IA</b> para classificação temática e geração de insights executivos.
        </div>
        <div className="foot-note">
          <ShieldAlert size={13} /> Snapshot de leitura — números congelados da carga de {SNAPSHOT}.
          Para tempo real, conecte a este mesmo banco via Supabase client (RLS recomendado).
        </div>
      </footer>
    </div>
  );
}

/* ============================ STYLES ============================ */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
:root{
  --ink:#0A0F1C; --panel:#111A2E; --panel2:#0E1626; --hair:rgba(148,163,184,.14);
  --text:#EAF0FB; --dim:#93A4C0; --faint:#5C6E8C; --teal:#3BE0C9; --gold:#E5B567;
  --amber:#F5A524; --red:#FF5C6C; --blue:#7CC4FF; --green:#6FCF97;
  --mono:'IBM Plex Mono',ui-monospace,'JetBrains Mono',Menlo,monospace;
  --disp:'Space Grotesk','Segoe UI',system-ui,sans-serif;
  --body:'Space Grotesk',-apple-system,'Segoe UI',system-ui,sans-serif;
}
*{box-sizing:border-box}
.bl-root{background:
   radial-gradient(1100px 480px at 78% -10%, rgba(59,224,201,.10), transparent 60%),
   radial-gradient(900px 500px at 8% 0%, rgba(124,196,255,.08), transparent 55%),
   var(--ink);
  color:var(--text); font-family:var(--body); min-height:100%; padding:0 0 36px;
  -webkit-font-smoothing:antialiased; font-feature-settings:'tnum' 1;}
.bl-root h1,.bl-root h2,.bl-root h3{font-family:var(--disp); margin:0; letter-spacing:-.01em;}
.eyebrow{font-family:var(--mono); font-size:10.5px; letter-spacing:.16em; text-transform:uppercase; color:var(--faint); font-weight:600;}
code{font-family:var(--mono); font-size:.86em; color:var(--blue); background:rgba(124,196,255,.08); padding:1px 5px; border-radius:5px;}

/* topbar */
.topbar{display:flex; align-items:center; justify-content:space-between; gap:16px;
  padding:16px clamp(16px,4vw,40px); border-bottom:1px solid var(--hair);
  position:sticky; top:0; z-index:20; backdrop-filter:blur(14px);
  background:rgba(10,15,28,.78);}
.brand{display:flex; align-items:center; gap:12px;}
.brand-mark{width:42px;height:42px;border-radius:12px;display:grid;place-items:center;
  background:linear-gradient(135deg,rgba(59,224,201,.22),rgba(124,196,255,.12));
  border:1px solid rgba(59,224,201,.35); color:var(--teal);}
.brand-name{font-family:var(--disp); font-weight:700; font-size:17px; letter-spacing:-.02em;}
.brand-sub{font-family:var(--mono); font-size:10px; letter-spacing:.16em; text-transform:uppercase; color:var(--faint);}
.topbar-right{display:flex; flex-direction:column; align-items:flex-end; gap:3px;}
.live{font-family:var(--mono); font-size:11px; color:var(--dim); display:flex; align-items:center; gap:7px;}
.live i{width:7px;height:7px;border-radius:50%;background:var(--teal);box-shadow:0 0 0 0 rgba(59,224,201,.6);animation:pulse 2.4s infinite;}
@keyframes pulse{0%{box-shadow:0 0 0 0 rgba(59,224,201,.5)}70%{box-shadow:0 0 0 7px rgba(59,224,201,0)}100%{box-shadow:0 0 0 0 rgba(59,224,201,0)}}
.src{font-family:var(--mono); font-size:9.5px; color:var(--faint); letter-spacing:.04em;}

/* hero */
.hero{display:grid; grid-template-columns:1.4fr .9fr; gap:28px; align-items:center;
  padding:clamp(24px,4vw,46px) clamp(16px,4vw,40px) 8px;}
.hero-copy h1{font-size:clamp(28px,3.4vw,44px); line-height:1.04; font-weight:700; margin:12px 0 14px;}
.hero-copy p{color:var(--dim); font-size:14.5px; line-height:1.6; max-width:54ch; margin:0;}
.grad{background:linear-gradient(100deg,var(--teal),var(--blue)); -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent;}
.hero-pills{display:flex; flex-wrap:wrap; gap:10px; margin-top:20px;}
.hero-pills span{font-family:var(--mono); font-size:11.5px; color:var(--dim);
  border:1px solid var(--hair); border-radius:999px; padding:7px 13px; background:rgba(255,255,255,.02);}
.hero-pills b{color:var(--text); font-weight:600;}
.hero-pills .cyan{border-color:rgba(59,224,201,.4); background:rgba(59,224,201,.07);}
.hero-pills .cyan b{color:var(--teal);}
.hero-radar{display:flex; flex-direction:column; align-items:center; gap:10px;}
.radar-sig{width:min(300px,72vw); height:auto; filter:drop-shadow(0 10px 40px rgba(59,224,201,.12));}
.sweep-rot{animation:sweep 6s linear infinite;}
@keyframes sweep{from{transform:rotate(0)}to{transform:rotate(360deg)}}
.hero-radar-cap{font-family:var(--mono); font-size:10px; letter-spacing:.12em; text-transform:uppercase; color:var(--faint);}

/* tabs */
.tabs{display:flex; gap:6px; overflow-x:auto; padding:10px clamp(16px,4vw,40px);
  border-bottom:1px solid var(--hair); position:sticky; top:73px; z-index:15;
  background:rgba(10,15,28,.82); backdrop-filter:blur(12px); scrollbar-width:none;}
.tabs::-webkit-scrollbar{display:none;}
.tab{display:flex; align-items:center; gap:7px; white-space:nowrap; cursor:pointer;
  font-family:var(--mono); font-size:12px; font-weight:500; color:var(--dim);
  background:transparent; border:1px solid transparent; border-radius:9px; padding:8px 13px; transition:.15s;}
.tab:hover{color:var(--text); background:rgba(255,255,255,.03);}
.tab.active{color:var(--ink); background:linear-gradient(120deg,var(--teal),var(--blue)); border-color:transparent; font-weight:600;}

/* content */
.content{padding:24px clamp(16px,4vw,40px) 0;}
.stack{display:flex; flex-direction:column; gap:18px;}
.grid-2{display:grid; grid-template-columns:1fr 1fr; gap:18px;}
.panel{background:linear-gradient(180deg,var(--panel),var(--panel2)); border:1px solid var(--hair);
  border-radius:16px; padding:18px 18px 16px; box-shadow:0 1px 0 rgba(255,255,255,.02) inset;}
.panel-head{display:flex; align-items:flex-start; justify-content:space-between; gap:12px; margin-bottom:14px;}
.panel-head h3{font-size:15px; font-weight:600; margin-top:3px;}
.muted-tag{font-family:var(--mono); font-size:10px; color:var(--faint); border:1px solid var(--hair); padding:3px 8px; border-radius:7px; white-space:nowrap;}
.caption{color:var(--faint); font-size:11.5px; line-height:1.55; margin:12px 0 0;}
.caption b{color:var(--dim);}

/* kpis */
.kpi-grid{display:grid; grid-template-columns:repeat(4,1fr); gap:14px;}
.kpi-grid.four{grid-template-columns:repeat(4,1fr);}
.kpi{padding:15px 16px;}
.kpi-top{display:flex; align-items:center; justify-content:space-between; margin-bottom:10px;}
.kpi-value{font-family:var(--disp); font-size:26px; font-weight:700; line-height:1; letter-spacing:-.02em;}
.kpi-sub{font-family:var(--mono); font-size:10.5px; color:var(--faint); margin-top:7px;}

/* donut */
.donut-wrap{position:relative;}
.donut-center{position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; pointer-events:none;}
.donut-big{font-family:var(--disp); font-size:30px; font-weight:700; letter-spacing:-.02em;}
.donut-label{font-family:var(--mono); font-size:10px; letter-spacing:.12em; text-transform:uppercase; color:var(--faint); margin-top:2px;}
.legend{display:flex; flex-wrap:wrap; gap:14px; margin-top:12px; font-family:var(--mono); font-size:11px; color:var(--dim);}
.legend i{width:9px;height:9px;border-radius:3px;display:inline-block;margin-right:6px;vertical-align:middle;}
.legend b{color:var(--text);}

/* ranking */
.rank{display:flex; flex-direction:column; gap:9px;}
.rank-row{display:grid; grid-template-columns:158px 1fr 34px; align-items:center; gap:12px;}
.rank-name{font-size:12.5px; color:var(--dim); display:flex; align-items:center; gap:8px;}
.dot{width:9px;height:9px;border-radius:50%;flex:none;}
.crit-tag{font-family:var(--mono); font-size:8.5px; text-transform:uppercase; letter-spacing:.08em; color:var(--red); border:1px solid rgba(255,92,108,.4); border-radius:5px; padding:1px 5px; margin-left:6px;}
.rank-bar-wrap{height:9px; background:rgba(148,163,184,.08); border-radius:6px; overflow:hidden;}
.rank-bar{height:100%; border-radius:6px; transition:width .5s;}
.rank-val{font-family:var(--mono); font-size:12px; text-align:right; color:var(--text); font-weight:600;}
.toggle{display:flex; align-items:center; gap:6px; cursor:pointer; font-family:var(--mono); font-size:11px;
  color:var(--dim); background:rgba(255,255,255,.03); border:1px solid var(--hair); border-radius:8px; padding:6px 11px;}
.toggle.on{color:var(--red); border-color:rgba(255,92,108,.4);}

/* tables */
.table{display:flex; flex-direction:column;}
.trow{display:grid; grid-template-columns:1fr 64px 42px 110px; gap:10px; align-items:center;
  padding:9px 4px; border-bottom:1px solid var(--hair); font-size:12.5px;}
.trow.thead{font-family:var(--mono); font-size:10px; text-transform:uppercase; letter-spacing:.08em; color:var(--faint); border-bottom:1px solid var(--hair);}
.trow:last-child{border-bottom:none;}
.td-strong{color:var(--text); font-weight:500;}
.td-dim{color:var(--dim);}
.td-mono{font-family:var(--mono); color:var(--gold);}
.ta-r{text-align:right;}
.part-chip{font-family:var(--mono); font-size:9.5px; color:var(--dim); border:1px solid var(--hair); border-radius:5px; padding:2px 6px;}

/* notes */
.note{display:flex; gap:10px; align-items:flex-start; font-size:12.5px; line-height:1.55;
  border-radius:12px; padding:12px 15px; border:1px solid;}
.note svg{flex:none; margin-top:2px;}
.note-amber{background:rgba(245,165,36,.07); border-color:rgba(245,165,36,.28); color:#f3d9a7;}
.note-amber b{color:var(--amber);}
.note-cyan{background:rgba(59,224,201,.06); border-color:rgba(59,224,201,.26); color:#bfeee5;}
.note-cyan b{color:var(--teal);}
.note-slate{background:rgba(148,163,184,.06); border-color:var(--hair); color:var(--dim);}
.note-slate b{color:var(--text);}
.note code{font-size:.82em;}

/* IA hero */
.hero-ia{background:
   radial-gradient(700px 300px at 100% 0%, rgba(59,224,201,.12), transparent 60%),
   linear-gradient(180deg,var(--panel),var(--panel2));}
.ia-title{font-size:clamp(20px,2.6vw,30px); font-weight:700; line-height:1.12; margin:10px 0 12px; max-width:22ch;}
.ia-sub{color:var(--dim); font-size:13.5px; line-height:1.6; max-width:70ch; margin:0;}
.ia-stats{display:flex; flex-wrap:wrap; gap:26px; margin-top:18px;}
.ia-stats div{display:flex; flex-direction:column;}
.ia-stats b{font-family:var(--disp); font-size:24px; font-weight:700; line-height:1;}
.ia-stats span{font-family:var(--mono); font-size:10px; text-transform:uppercase; letter-spacing:.1em; color:var(--faint); margin-top:5px;}

/* score */
.formula{font-family:var(--mono); font-size:13px; background:rgba(124,196,255,.05); border:1px solid var(--hair);
  border-radius:10px; padding:12px 14px; margin:12px 0; line-height:1.7;}
.formula span{color:var(--gold); font-weight:600;}
.formula em{font-style:normal; font-weight:600;}
.score-legend{list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:7px;}
.score-legend li{font-size:12px; color:var(--dim); padding-left:14px; position:relative;}
.score-legend li::before{content:''; position:absolute; left:0; top:7px; width:5px; height:5px; border-radius:50%; background:var(--teal);}
.score-legend b{color:var(--text); font-family:var(--mono); font-size:11px;}

/* filters + IA cards */
.filters{display:flex; gap:10px; margin-bottom:14px; flex-wrap:wrap;}
.search{display:flex; align-items:center; gap:8px; flex:1; min-width:200px; background:rgba(255,255,255,.03);
  border:1px solid var(--hair); border-radius:9px; padding:0 12px; color:var(--faint);}
.search input{flex:1; background:transparent; border:none; outline:none; color:var(--text);
  font-family:var(--body); font-size:13px; padding:10px 0;}
.filters select{font-family:var(--mono); font-size:12px; color:var(--dim); background:rgba(255,255,255,.03);
  border:1px solid var(--hair); border-radius:9px; padding:9px 12px; outline:none; cursor:pointer;}
.ia-cards{display:grid; grid-template-columns:repeat(2,1fr); gap:12px;}
.ia-card{display:flex; flex-direction:column; gap:8px; text-decoration:none; background:rgba(255,255,255,.015);
  border:1px solid var(--hair); border-radius:12px; padding:13px 14px; transition:.15s;}
.ia-card:hover{border-color:rgba(59,224,201,.4); background:rgba(59,224,201,.04); transform:translateY(-1px);}
.ia-card-head{display:flex; align-items:center; gap:8px;}
.tema-chip{font-family:var(--mono); font-size:9.5px; font-weight:600; letter-spacing:.04em; border:1px solid;
  border-radius:6px; padding:3px 8px; white-space:nowrap;}
.tema-chip.sm{font-size:9px; padding:2px 6px;}
.ia-meta{font-family:var(--mono); font-size:10px; color:var(--faint);}
.score-pill{margin-left:auto; font-family:var(--mono); font-size:11px; font-weight:600; color:var(--gold);
  border:1px solid rgba(229,181,103,.4); border-radius:7px; padding:2px 8px; background:rgba(229,181,103,.08);}
.ia-ementa{font-size:12.5px; color:var(--text); line-height:1.45;}
.ia-resumo{font-size:11.5px; color:var(--teal); line-height:1.5; display:flex; gap:6px; align-items:flex-start;
  border-top:1px dashed var(--hair); padding-top:8px;}
.ia-resumo svg{flex:none; margin-top:2px;}
.empty{grid-column:1/-1; text-align:center; padding:28px; color:var(--faint); font-family:var(--mono); font-size:12px;}

/* alertas */
.alert-hero{display:flex; gap:16px; align-items:flex-start;
  background:radial-gradient(500px 200px at 0% 0%, rgba(245,165,36,.12), transparent 60%), linear-gradient(180deg,var(--panel),var(--panel2));
  border-color:rgba(245,165,36,.3);}
.alert-hero-icon{width:46px;height:46px;border-radius:13px;flex:none;display:grid;place-items:center;
  background:rgba(245,165,36,.14); border:1px solid rgba(245,165,36,.4); color:var(--amber);}
.crit-grid{display:grid; grid-template-columns:repeat(2,1fr); gap:10px;}
.crit-cell{display:flex; align-items:center; gap:11px; border:1px solid; border-radius:11px; padding:11px 13px; background:rgba(255,255,255,.015);}
.crit-cell-body{display:flex; flex-direction:column;}
.crit-cell-name{font-size:13px; color:var(--text); font-weight:500;}
.crit-cell-val{font-family:var(--mono); font-size:11px; color:var(--dim); margin-top:2px;}
.crit-cell-val em{font-style:normal; color:var(--faint);}
.mon-list{display:flex; flex-direction:column;}
.mon-row{display:flex; align-items:center; gap:12px; text-decoration:none; padding:11px 4px; border-bottom:1px solid var(--hair); transition:.15s;}
.mon-row:last-child{border-bottom:none;}
.mon-row:hover{background:rgba(255,255,255,.02);}
.mon-body{display:flex; flex-direction:column; gap:3px; flex:1; min-width:0;}
.mon-ementa{font-size:12.5px; color:var(--text); line-height:1.4;}
.mon-meta{font-family:var(--mono); font-size:10px; color:var(--faint);}
.mon-arrow{color:var(--faint); flex:none;}
.mon-row:hover .mon-arrow{color:var(--teal);}

/* footer */
.foot{margin:34px clamp(16px,4vw,40px) 0; padding-top:20px; border-top:1px solid var(--hair); display:flex; flex-direction:column; gap:10px;}
.foot-intro{font-size:12.5px; color:var(--dim); line-height:1.65; max-width:90ch;}
.foot-intro b{color:var(--text); font-weight:600;}
.foot-note{font-family:var(--mono); font-size:10.5px; color:var(--faint); display:flex; align-items:center; gap:7px;}

@media (max-width:880px){
  .hero{grid-template-columns:1fr;} .hero-radar{order:-1;}
  .grid-2{grid-template-columns:1fr;} .kpi-grid,.kpi-grid.four{grid-template-columns:repeat(2,1fr);}
  .ia-cards{grid-template-columns:1fr;} .crit-grid{grid-template-columns:1fr;}
  .rank-row{grid-template-columns:120px 1fr 30px;} .topbar-right{display:none;}
}
@media (prefers-reduced-motion: reduce){ .sweep-rot,.live i{animation:none;} }
`;
