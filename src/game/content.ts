import type { BoardTile, Character, CharacterId, EventCard, PropertyGroup, ReferenceSource } from '../types'

export const MONEY = (value: number) => `R$ ${value.toLocaleString('pt-BR')} mil`

export const CHARACTERS: Record<CharacterId, Character> = {
  jair: { id: 'jair', name: 'Jair', epithet: 'O Capitão do Caixa', ability: 'Uma vez por volta, paga 20% menos em imposto.', color: '#237447', accent: '#f3cd3d', startingCash: 1500 },
  michelle: { id: 'michelle', name: 'Michelle', epithet: 'A Síndica do Close', ability: 'Começa com uma carta de saída da prisão.', color: '#a52d72', accent: '#ffabd8', startingCash: 1450 },
  flavio: { id: 'flavio', name: 'Flávio', epithet: 'O Corretor do Plenário', ability: 'Hipotecas rendem 10% a mais.', color: '#326bb8', accent: '#8dcaff', startingCash: 1550 },
  eduardo: { id: 'eduardo', name: 'Eduardo', epithet: 'O Diplomata do Churrasco', ability: 'Construções do primeiro nível custam 10% menos.', color: '#a94730', accent: '#ffae55', startingCash: 1500 },
  renan: { id: 'renan', name: 'Renan', epithet: 'O Influencer da Escritura', ability: 'Recebe R$ 30 mil extras ao completar uma volta.', color: '#6747a4', accent: '#d0a4ff', startingCash: 1450 },
}

export const GROUP_COLORS: Record<PropertyGroup, string> = {
  orla: '#55b7cc', 'zona-sul': '#efaa45', centro: '#d86650', barra: '#865fb7', poder: '#3b8b5e', midia: '#df668f',
}

const p = (index: number, id: string, name: string, district: string, group: PropertyGroup, price: number, rent: number, buildCost: number): BoardTile => ({
  id, index, type: 'property', name, district, group, price, rents: [rent, rent * 3, rent * 7, rent * 12, rent * 18], buildCost, mortgage: Math.floor(price / 2),
})

export const BOARD: BoardTile[] = [
  { id: 'largada', index: 0, type: 'start', name: 'Praça da Posse' },
  p(1, 'kitnet-vivendas', 'Kitnet das Vivendas', 'Barra da Tijuca', 'barra', 100, 10, 50),
  { id: 'acontecimento-1', index: 2, type: 'event', name: 'Diário Oficial' },
  p(3, 'condominio-familia', 'Condomínio da Família', 'Barra da Tijuca', 'barra', 120, 12, 50),
  { id: 'iptu', index: 4, type: 'tax', name: 'IPTU Retroativo', amount: 120 },
  p(5, 'studio-live', 'Estúdio da Live sem Prova', 'Zona Sul', 'midia', 140, 14, 70),
  p(6, 'podcast-cercadinho', 'Podcast do Cercadinho Vazio', 'Zona Sul', 'midia', 160, 16, 70),
  { id: 'acontecimento-2', index: 7, type: 'event', name: 'Quebra de Sigilo' },
  p(8, 'ilha-fiscal-digital', 'Ilha Fiscal Digital', 'Baía', 'barra', 180, 18, 80),
  p(9, 'motociata-garage', 'Garagem da Motociata', 'Barra da Tijuca', 'barra', 200, 20, 80),
  { id: 'prisao', index: 10, type: 'jail', name: 'Visita à Papuda' },
  p(11, 'quiosque-cloro', 'Quiosque do Kit sem Comprovação', 'Copacabana', 'orla', 220, 22, 90),
  p(12, 'terminal-motociata', 'Terminal da Motociata', 'Copacabana', 'orla', 240, 24, 90),
  { id: 'acontecimento-3', index: 13, type: 'event', name: 'Comissão Parlamentar' },
  p(14, 'cobertura-atlantica', 'Cobertura Atlântica', 'Copacabana', 'orla', 260, 26, 100),
  { id: 'taxa-advogado', index: 15, type: 'tax', name: 'Honorários de Recurso', amount: 180 },
  p(16, 'triplex-churrasco', 'Tríplex da Churrasqueira', 'Urca', 'zona-sul', 280, 28, 110),
  p(17, 'forte-selfie', 'Forte da Selfie', 'Urca', 'zona-sul', 300, 30, 110),
  { id: 'acontecimento-4', index: 18, type: 'event', name: 'Plantão do Judiciário' },
  p(19, 'resort-rachadura', 'Resort da Rachadura', 'Urca', 'zona-sul', 320, 32, 120),
  { id: 'descanso', index: 20, type: 'rest', name: 'Recesso Parlamentar' },
  p(21, 'cartorio-pix', 'Cartório do PIX', 'Centro', 'centro', 340, 34, 130),
  p(22, 'companhia-sigilo', 'Companhia do Sigilo de Cem Anos', 'Centro', 'centro', 360, 36, 130),
  { id: 'acontecimento-5', index: 23, type: 'event', name: 'Coletiva de Imprensa' },
  p(24, 'loja-joias', 'Joalheria do Acervo Público', 'Centro', 'centro', 380, 38, 140),
  { id: 'imposto-renda', index: 25, type: 'tax', name: 'Malha Fina do Patrimônio', amount: 220 },
  p(26, 'gabinete-paralelo', 'Gabinete Paralelo', 'Centro', 'centro', 400, 40, 140),
  p(27, 'instituto-patriota', 'Instituto Patriota Premium', 'Lapa', 'midia', 420, 42, 150),
  { id: 'acontecimento-6', index: 28, type: 'event', name: 'Plantão da Live' },
  p(29, 'arcade-gabinete', 'Arcade do Gabinete', 'Lapa', 'midia', 440, 44, 150),
  { id: 'va-para-prisao', index: 30, type: 'go-to-jail', name: 'Encaminhamento à Papuda' },
  p(31, 'mansao-alvorada', 'Mansão do Alvorada', 'Distrito do Poder', 'poder', 460, 46, 170),
  p(32, 'aeroporto-comitiva', 'Aeroporto da Comitiva', 'Distrito do Poder', 'poder', 480, 48, 170),
  { id: 'acontecimento-7', index: 33, type: 'event', name: 'Diário Extraordinário' },
  p(34, 'embaixada-condominio', 'Embaixada do Condomínio', 'Distrito do Poder', 'poder', 500, 50, 180),
  { id: 'taxa-condominio', index: 35, type: 'tax', name: 'Taxa do Condomínio', amount: 240 },
  p(36, 'palacio-das-emendas', 'Palácio das Emendas', 'Distrito do Poder', 'poder', 520, 52, 180),
  p(37, 'torre-narrativa', 'Torre da Narrativa', 'Baía', 'orla', 540, 54, 200),
  { id: 'acontecimento-8', index: 38, type: 'event', name: 'Nota Oficial' },
  p(39, 'residencial-telegram', 'Residencial Celular em Modo Avião', 'Baía', 'zona-sul', 560, 56, 200),
]

export const PROPERTIES = BOARD.filter((tile): tile is Extract<BoardTile, { type: 'property' }> => tile.type === 'property')
export const BOARD_LABELS = BOARD.map(tile => tile.name)

export const REFERENCES: ReferenceSource[] = [
  { id: 'tse-embaixadores', title: 'TSE declara Bolsonaro inelegível por 8 anos', institution: 'Tribunal Superior Eleitoral', kind: 'decision', url: 'https://www.tse.jus.br/comunicacao/noticias/2023/Junho/por-maioria-de-votos-tse-declara-bolsonaro-inelegivel-por-8-anos', accessedAt: '2026-10-30', context: 'Decisão que reconheceu abuso de poder político e uso indevido dos meios de comunicação na reunião com embaixadores.' },
  { id: 'tcu-joias', title: 'TCU determina devolução de presentes em cinco dias úteis', institution: 'Tribunal de Contas da União', kind: 'decision', url: 'https://portal.tcu.gov.br/imprensa/noticias/tcu-determina-devolucao-de-presentes-em-cinco-dias-uteis', accessedAt: '2026-10-30', context: 'Decisão cautelar sobre joias sauditas, armas e as condições para incorporar presentes de uso personalíssimo e baixo valor.' },
  { id: 'stf-celulares', title: 'Nota sobre pedido de apreensão de aparelhos celulares', institution: 'Supremo Tribunal Federal', kind: 'official-clarification', url: 'https://portal.stf.jus.br/noticias/verNoticiaDetalhe.asp?idConteudo=443982&ori=1', accessedAt: '2026-10-30', context: 'O STF esclareceu que não ordenou a apreensão dos celulares citados: o relator encaminhou a notícia-crime e o pedido à Procuradoria-Geral da República.' },
  { id: 'senado-cpi-relatorio', title: 'CPI da Pandemia: principais pontos do relatório', institution: 'Senado Federal', kind: 'report', url: 'https://www12.senado.leg.br/noticias/materias/2021/10/20/cpi-da-pandemia-principais-pontos-do-relatorio', accessedAt: '2026-10-30', context: 'Síntese oficial do relatório da CPI. As conclusões e recomendações de indiciamento são do colegiado e não equivalem, por si, a condenação judicial.' },
  { id: 'senado-cpi-final', title: 'Relatório final apreciado pela CPI da Pandemia', institution: 'Senado Federal', kind: 'report', url: 'https://legis.senado.leg.br/atividade/comissoes/comissao/2441/mna/relatorios', accessedAt: '2026-10-30', context: 'Arquivo legislativo oficial que identifica a versão do relatório final apreciada e aprovada pela CPI em 26 de outubro de 2021.' },
  { id: 'senado-cpi-revisao', title: 'CPI da Pandemia: o que mudou na versão final do relatório', institution: 'Senado Federal', kind: 'report', url: 'https://www12.senado.leg.br/noticias/materias/2021/10/26/cpi-da-pandemia-o-que-mudou-na-nova-versao-do-relatorio', accessedAt: '2026-10-30', context: 'Registro oficial das alterações finais, incluindo a menção à live que associou vacinas contra covid-19 e aids sem base científica e o pedido de retratação.' },
  { id: 'tse-bicentenario', title: 'TSE declara inelegíveis Bolsonaro e Braga Netto no caso do Bicentenário', institution: 'Tribunal Superior Eleitoral', kind: 'decision', url: 'https://www.tse.jus.br/comunicacao/noticias/2023/Outubro/tse-declara-inelegiveis-bolsonaro-e-braga-netto-por-abuso-de-poder-no-bicentenario-da-independencia', accessedAt: '2026-10-30', context: 'Decisão sobre abuso de poder político e econômico nas comemorações oficiais do Bicentenário da Independência em 2022.' },
  { id: 'stf-rodovias', title: 'STF referenda determinação de desbloqueio de rodovias', institution: 'Supremo Tribunal Federal', kind: 'decision', url: 'https://portal.stf.jus.br/noticias/verNoticiaDetalhe.asp?idConteudo=496689&ori=1', accessedAt: '2026-10-30', context: 'Decisão que confirmou a desobstrução imediata de rodovias e vias públicas bloqueadas após o resultado das eleições de 2022. A miniatura do para-brisa é uma caricatura ficcional do contexto, não uma reconstrução do processo.' },
]

export const EVENTS: EventCard[] = [
  { id: 'joias-acervo', title: 'ACERVO OU COBERTURA?', satire: 'A joalheria manda o carnê ao patrimônio público. Fiscalização só é “comunista” até a vitrine pedir recibo.', fact: 'Em 15/03/2023, o TCU determinou cautelarmente a entrega de joias sauditas e armas e registrou os critérios aplicáveis a presentes oficiais.', fictionalEffect: 'No jogo, a avaliação independente encontra diamantes no fluxo de caixa e cobra a catalogação.', sourceIds: ['tcu-joias'], cash: -120 },
  { id: 'reuniao-embaixadores', title: 'CONDOMÍNIO INTERNACIONAL', satire: 'A assembleia ganhou tradução simultânea para explicar a urna e saiu sem conseguir explicar o síndico.', fact: 'O TSE declarou Jair Bolsonaro inelegível por oito anos, contados das eleições de 2022, no julgamento sobre a reunião com embaixadores.', fictionalEffect: 'No jogo, o salão diplomático vira prisão cenográfica por uma rodada.', sourceIds: ['tse-embaixadores'], cash: 0, jail: true },
  { id: 'celular-encaminhado', title: 'CELULAR NO MODO “ENCAMINHE-SE”', satire: 'O aparelho vibrou, o grupo gritou “petistas!”, e a decisão dizia apenas: encaminhe à PGR.', fact: 'Em 22/05/2020, o STF esclareceu que não havia ordenado a apreensão dos celulares citados; o relator apenas encaminhou o pedido à Procuradoria-Geral da República.', fictionalEffect: 'No jogo, a leitura apressada exige retratação e consome caixa de assessoria.', sourceIds: ['stf-celulares'], cash: -60 },
  { id: 'gabinete-paralelo', title: 'CONSULTORIA PARALELA, BOLETO OFICIAL', satire: 'O grupo paralelo combate os “comunistas” com reunião, palpite e nenhuma janela aberta na planilha.', fact: 'O relatório final da CPI da Pandemia descreveu um “gabinete paralelo” e recomendou encaminhamentos; trata-se da conclusão da CPI, não de condenação judicial.', fictionalEffect: 'No jogo, o privilégio improvisado transfere R$ 20 mil de cada rival para a sua consultoria fictícia.', sourceIds: ['senado-cpi-relatorio', 'senado-cpi-final'], cash: 0, collectFromEach: 20 },
  { id: 'live-vacina', title: 'LIVE SEM BULA, CONTA COM JUROS', satire: 'A transmissão culpa comunistas, algoritmo e tomada. A evidência segue sem convite.', fact: 'A versão final do relatório da CPI incluiu menção à live de 21/10/2021 que associou, sem base científica, vacinas contra covid-19 e aids, e registrou pedido de retratação.', fictionalEffect: 'No jogo, a plataforma fictícia remove o anúncio e cobra a devolução da publicidade.', sourceIds: ['senado-cpi-revisao'], cash: -100 },
  { id: 'presente-baixo-valor', title: 'LEMBRANCINHA DE “BAIXO VALOR”', satire: 'O chaveiro pesa três quilos, brilha no raio-X e veio escoltado. Deve ser bijuteria patriótica.', fact: 'Ao decidir sobre os presentes, o TCU registrou que a incorporação pessoal exige uso personalíssimo e baixo valor.', fictionalEffect: 'No jogo, a perícia não aceita avaliação por enquete e cobra uma taxa.', sourceIds: ['tcu-joias'], cash: -80 },
  { id: 'bicentenario-campanha', title: 'FESTA OFICIAL, PALANQUE PARTICULAR', satire: 'A verba é da cerimônia, o microfone é da campanha e a separação ficou presa no trânsito da motociata.', fact: 'Em 31/10/2023, o TSE condenou Jair Bolsonaro e Braga Netto por abuso de poder político e econômico nas comemorações do Bicentenário da Independência de 2022.', fictionalEffect: 'No jogo, o condomínio cobra a taxa extraordinária do evento.', sourceIds: ['tse-bicentenario'], cash: -140 },
  { id: 'kit-sem-comprovacao', title: 'KIT MILAGROSO, ALUGUEL REAL', satire: 'O corretor promete tratamento precoce para a dívida: duas cápsulas de bordão e um áudio do grupo no vencimento.', fact: 'O relatório da CPI da Pandemia criticou a promoção de tratamento precoce sem comprovação científica e recomendou responsabilizações, sem equivaler a sentença judicial.', fictionalEffect: 'No jogo, a propaganda vende rápido: avance ao Recesso, mas pague a auditoria antes.', sourceIds: ['senado-cpi-relatorio', 'senado-cpi-final'], cash: -50, moveTo: 20 },
  { id: 'parabrisa-patriotico', title: 'PATRIOTA DO PARA-BRISA', satire: 'O caminhão tenta seguir; o passageiro externo insiste que gravidade, trânsito e resultado eleitoral são opiniões.', fact: 'Em 01/11/2022, o STF referendou a determinação de desbloqueio das rodovias ocupadas após o resultado eleitoral e registrou riscos à circulação e ao abastecimento.', fictionalEffect: 'No jogo, a mudança cobra frete, multa cenográfica e uma nova ventosa.', sourceIds: ['stf-rodovias'], cash: -70 },
]
