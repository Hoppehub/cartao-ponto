# Revisão técnica — Contador de horas da Fortman

Data: 28/10/2026. Escopo: conferência de jornada, leitura/auditoria do AFD e integração desktop. Este documento é uma proposta para avaliação do dono e do Claude Code; não autoriza mudanças no produto nem substitui validação com a contabilidade.

## 1. Confirmação do local e autorização

```text
CONFIRMAÇÃO DO LOCAL
Repositório aberto: Hoppehub/Fortman
Branch leitor-afd encontrada: sim — último commit: 44c9e22 — Otimiza a leitura do AFD e corrige falhas achadas na revisao
Branch main encontrada: sim — último commit: 69accc8 — Prompt de revisão: local exato e confirmação obrigatória antes de começar
Arquivos da 0.2 encontrados:
  leitor-afd:
    ponto/js/afd_parser.js
    ponto/js/leitor_afd.js
    ponto/index.html
    testes/test_afd_parser.js
  main:
    complementos/ponto/relogio.php
    complementos/ponto/js/relogio.js
    complementos/ponto/js/feriados.js
    ferramentas/montar_desktop.sh
    revisao/PROMPT-REVISAO-COMPLETA.md
  Nenhum arquivo solicitado está faltando.
Assunto do repositório: leitura e auditoria de AFD do ponto eletrônico e conferência de jornada.
Vou gravar somente em: gpt/revisao-contador-de-horas e, se houver código, gpt/proposta-leitor-afd
Não vou gravar em: main, leitor-afd nem em nenhuma outra branch existente
Posso criar branches e fazer commit neste repositório? sim — criação da branch confirmada; publicação deste relatório será verificada antes da entrega.
Autorização recebida do dono nesta conversa: “pode começar”.
```

Bases exatas, usadas em todas as referências deste relatório:

- Núcleo **N**: `leitor-afd`, `44c9e22db6830694ea503762041b55230591dde7`. [Código do analisador](https://github.com/Hoppehub/Fortman/blob/44c9e22db6830694ea503762041b55230591dde7/ponto/js/afd_parser.js), [interface](https://github.com/Hoppehub/Fortman/blob/44c9e22db6830694ea503762041b55230591dde7/ponto/js/leitor_afd.js), [testes](https://github.com/Hoppehub/Fortman/blob/44c9e22db6830694ea503762041b55230591dde7/testes/test_afd_parser.js).
- Desktop **D**: `main`, `69accc8319917404f41a5904d3ad5e9c970cd65c`. [Backend](https://github.com/Hoppehub/Fortman/blob/69accc8319917404f41a5904d3ad5e9c970cd65c/complementos/ponto/relogio.php), [download](https://github.com/Hoppehub/Fortman/blob/69accc8319917404f41a5904d3ad5e9c970cd65c/complementos/ponto/js/relogio.js), [feriados](https://github.com/Hoppehub/Fortman/blob/69accc8319917404f41a5904d3ad5e9c970cd65c/complementos/ponto/js/feriados.js), [montagem](https://github.com/Hoppehub/Fortman/blob/69accc8319917404f41a5904d3ad5e9c970cd65c/ferramentas/montar_desktop.sh).
- Destino exclusivo desta entrega: `gpt/revisao-contador-de-horas`, criada a partir da `main`, arquivo `revisao/RELATORIO-GPT-CONTADOR-DE-HORAS.md`.
- **Nenhuma melhoria foi implementada.** Os trechos de testes abaixo são propostas dentro do relatório. Não foi criada a branch `gpt/proposta-leitor-afd`; não foi aberto PR. Não foram alterados aplicativos, testes existentes ou a pasta gerada `desktop/`.

## 2. Resumo executivo

O leitor cumpre parte importante do objetivo: leitura local, agrupamento, aritmética dos pares completos e saldos brutos por dia, semana e mês.
Os 197 testes existentes passaram; isso não comprova conformidade do AFD nem confiabilidade de todos os saldos trabalhistas.
Os três riscos mais importantes para a conferência são: **dias incompletos/duplicados/noturnos gerarem débito aparentemente definitivo; feriados/afastamentos receberem jornada normal; e batidas inválidas/ajustes de relógio alterarem horas**.
A tolerância também está ausente e exige horários contratuais por marcação, não apenas duração diária.
O desktop possui falha reproduzida no filtro mensal e uma montagem destrutiva que pode apagar a pasta de dados local.
É adequado continuar como ferramenta de conferência assistida, com pendências visíveis; não usar seu saldo bruto isoladamente para descontos ou pagamento.
As propostas preservam a tecnologia e o processamento local, com mudanças graduais e testes.
A documentação oficial da Control iD, o calendário federal de 2026 e a redação oficial consolidada da legislação ficaram bloqueados pela rede; os limites estão discriminados abaixo.
Não houve teste contra o relógio real, nem validação do executável Windows/PHP Desktop.

## 3. Confirmação ou correção das conclusões anteriores

### 3.1 A aritmética do dia normal

**Confirmada.** `N:afd_parser.js:1288–1293` soma pares completos. Para 07:58, 12:04, 13:03 e 17:05: primeiro par = 246 minutos, segundo = 242; total **488 = 08:08**. Contra 540 = 09:00, saldo **−52 minutos**. `N:testes/test_afd_parser.js:185–192` já verifica a duração; a revisão também executou o cálculo completo com a escala de 9h.

Isso prova a aritmética nesse caso; não prova que a jornada contratual, a tolerância ou os registros sejam adequados para todos os empregados.

### 3.2 Comparação com `convenia/afd-reader`

**Confirmada apenas a regra comum de alternância; corrigido o alcance da comparação.** Foi consultado `src/AfdReader.php` no commit público `03c183b7fdd9ad29664ca5a3fcc1893d7d180a3f`: [fonte permanente](https://github.com/convenia/afd-reader/blob/03c183b7fdd9ad29664ca5a3fcc1893d7d180a3f/src/AfdReader.php).

`readLines():140–145` mantém a ordem lida; `getByUserAfd():245–282` agrupa por documento/data e alterna Entrada/Saída. Não calcula duração, jornada ou saldo. O Fortman ordena pelo horário antes de parear (`N:1280–1288`). Em um dia regular, ambas as alternâncias coincidem; em arquivo fora de ordem ou com ajuste, isso não basta para validar as horas.

A classe externa também tem ramos AFDT/ACJEF; dizer que a biblioteca inteira “só lê 1.510” é excessivo. O ramo AFD consultado segue o modelo clássico; suporte 671 não foi comprovado por essa leitura limitada. A biblioteca **não é um segundo calculador independente de saldo**.

### 3.3 Riscos conhecidos, um por um

| Item da seção 2.4 do prompt | Resultado da revisão e referência |
|---|---|
| 1. Feriado espera jornada cheia | **Confirmado.** `N:calcularSaldos():1484–1491` só consulta escala/dia da semana. `D:feriados.js:87–107` apenas insere tarjas. Em 07/09/2026 sem batida entre dias com registros, aparece FALTA −09:00. Trabalho de 09:00 nesse feriado fica com saldo zero. Corrigir o saldo do feriado depende do calendário e da política aplicável; pagamento em dobro não se confunde com minutos de saldo. |
| 2. Sem tolerância | **Confirmado, com correção jurídica.** `N:1491` subtrai minuto bruto. A referência principal é **CLT art. 58, §1º**, com interpretação pela Súmula 366 do TST, e não uma regra implementável só a partir da Portaria 671. Um saldo de −3 minutos não é automaticamente tolerável sem saber quais marcações variaram. `ESCALAS:1433–1439` guarda apenas duração por dia. |
| 3. Batida esquecida apaga horas | **Efeito confirmado; descrição ajustada.** A última batida sem par não produz duração; os pares anteriores permanecem. 06:55/11:55/12:55 dão 05:00 conhecidas e saldo bruto −04:00. A tarde é **desconhecida**, não necessariamente zero trabalho ou falta. Há aviso de ímpar, mas o subtotal participa normalmente do saldo (`N:1288–1297;1491`). Não inventar uma saída para “corrigir”. |
| 4. Batida duplicada desloca pares | **Confirmado.** `N:1072–1082` alerta duplicidade no mesmo instante, mas não a remove; não existe filtro para proximidade de um minuto. 06:55/06:56/11:55/12:55/16:55 passam a somar 01:01, não 09:00. Não excluir automaticamente toda batida próxima: pode ser legítima. |
| 5. Jornada pela meia-noite | **Confirmado.** `N:1258` agrupa por pessoa e data civil, não por jornada. 22:00 em um dia e 06:00 no seguinte ficam como dois dias ímpares, com zero minuto pareado. |
| 6. Atestado/férias/folga viram falta | **Confirmado como limitação do modelo.** `N:1398–1401` cria FALTA quando a escala prevê minutos e não há marcação. AFD não informa os motivos. O sistema precisa dados complementares aprovados, não adivinhação. |
| 7. Uma escala para todos | **Confirmado.** `N:1446–1455` recebe uma escala; a UI fornece uma única configuração (`N:leitor_afd.js:85–96`). Não há vigência individual de escala/admissão/demissão. |
| 8. Saldo bruto, sem dinheiro | **Confirmado.** `N:1491–1507` soma minutos. Não aplica percentuais de extra, hora noturna reduzida, pagamento nem reflexo em DSR. Isso é compatível com um conferidor se os limites estiverem claros. Não transformar o produto em folha por obrigação presumida. |
| 9. Ajuste do relógio/ordem | **Risco confirmado e reproduzido.** Tipo 4 é registrado, mas a ordenação por hora em `N:1280–1283` pode trocar os pares. 08:00/12:00, ajuste 12:00→11:00, 11:05/17:00: os pares conhecidos somam 09:55; a ordenação produz 08:05, diferença **−01:50**. Dia afetado deve ficar para conferência; não aplicar correção automática universal. |

## 4. Problemas encontrados, estrutura e limites da validação

### 4.1 Tabela de problemas

Prefixos **N/D** remetem aos commits da seção 1. Números de linha são desses snapshots. “Limitação” identifica capacidade ausente/documentada; não significa uma obrigação nova de folha. Gravidade mede impacto potencial, não afirma que houve prejuízo real a empregados.

| # | Gravidade | Onde (arquivo:linha ou função) | O que acontece | Como reproduzir |
|---|---|---|---|---|
| P01 | Alta | N:afd_parser.js:1288–1297;1491 | Dia ímpar tem saldo negativo numérico sem um estado de fechamento pendente. | 03/08: 06:55/11:55/12:55, escala 09h: subtotal 05h, saldo −04h. A saída desconhecida não prova esse débito. |
| P02 | Alta | N:afd_parser.js:1072–1082;1280–1297 | Duplicata exata só avisa; batida próxima não recebe tratamento específico. Os pares seguintes mudam. | Acrescentar 06:56 ao dia normal 06:55/11:55/12:55/16:55: 61 minutos, −479 de saldo. |
| P03 — limitação | Alta | N:afd_parser.js:1258 | Jornada noturna é quebrada na data civil e não pareada. | Entrada 14/09 22:00, saída 15/09 06:00: duas linhas ímpares, zero hora conhecida pelo sistema. |
| P04 — limitação | Alta | N:afd_parser.js:1398–1401;1484–1491; D:feriados.js | Tarja de feriado não altera a previsão; feriado pode virar FALTA. | Completar 04–08/09/2026 com batidas só na sexta e terça: 07/09 desconta 09h. |
| P05 — limitação | Alta | N:afd_parser.js:1433–1439;1491 | Não há tolerância e faltam horários previstos por marcação para calculá-la corretamente. | Dia normal com entrada 3min antes: saldo bruto +3min; política de tolerância aplicável poderia produzir zero. Ver tabela controlada da seção 5. |
| P06 | Alta | N:afd_parser.js:285–288;316–319;1054–1075;1257 | Datas/horas inválidas sinalizadas ainda geram horas e chaves de período incoerentes. | Tipo 3 1.510 com 25:00 e 26:00: 01h trabalhada apesar de DATA_INVALIDA. 31/02/2026 08–17: 09h, “Terça”, semana 02/03 e mês fevereiro. |
| P07 | Alta | N:afd_parser.js:706–743;951–955 | Estrutura obrigatória 671 e integridade não são comprovadas pela auditoria. CRC é apenas guardado. | No exemplo 671, trocar CRC tipo 3 por `ZZZZ`: zero erros/alertas. Com cabeçalho válido, linha `00000000132026-08-03` e trailer coerente: 1 marcação sem hora/documento, zero inconsistências. |
| P08 | Média | N:afd_parser.js:532–535;747–759;980–1002 | Flags de validade de cabeçalho e outros registros não viram inconsistências; ajuste 671 só verifica presença da data. | Cabeçalho inicial 31/02: zero inconsistências; mês 99 no ajuste tipo 4 671: `dataValida:true`. |
| P09 | Alta, condicional a ajuste | N:afd_parser.js:1008–1010;1280–1283 | Ordenar por hora local muda o pareamento conhecido depois de relógio atrasado. | 08/12, ajuste 12→11, 11:05/17: pares conhecidos 09:55, sistema 08:05. |
| P10 | Média | N:afd_parser.js:271;280–288;1280–1293 | Fuso é lido, mas ignorado na duração; segundos também são descartados sem política explícita. | 17/02/2018 23:30−0200→23:45−0300: 75min reais, sistema 15min. Offset `+9961` é aceito. |
| P11 — limitação | Alta | N:afd_parser.js:1350–1401;1446–1455 | Ausência, afastamento e vigência contratual não são distinguíveis; uma escala vale para todos. | Pessoa de 6h e outra de 9h recebem a mesma escala; dia de férias vazio entre batidas vira falta. |
| P12 | Média | N:leitor_afd.js:85–88; opção diária no index.html | “Mesma jornada em todo dia com marcação” se torna escala de 7 dias e gera faltas no fim de semana sem marcação. | Batidas 03 e 10/08, diária 08h, completar padrão: 08 e 09/08 aparecem como FALTA −08h cada. |
| P13 | Alta | N:leitor_afd.js:183–224;326–340 | Análises concorrentes não têm identificador/cancelamento; arquivo antigo pode substituir o último escolhido. | Carregar A com 300 mil linhas inválidas e imediatamente B com 8 marcações válidas. B aparece e depois A sobrescreve a tela com zero cartões. |
| P14 | Alta | D:relogio.js:105–120;154–157; N:leitor_afd.js:340 | Segundo download filtra os campos da análise antiga; a conclusão nova zera os filtros. A tela anuncia o mês sem garanti-lo. | Abrir um AFD; baixar outro mês; acompanhar o reset de filtros depois do FileReader. Também há saída silenciosa após ~10s se os campos não aparecerem. |
| P15 | Média | D:relogio.php:129–132;217–227 | HTTP 200 não vazio sem campo `error` pode ser devolvido como AFD mesmo sendo JSON de falha ou HTML. | Mock HTTP local retorna `{"success":false}` ao get_afd: o PHP real aceita o corpo como AFD nos dois transportes. |
| P16 | Alta, depende da rede local | D:relogio.php:94–95;114;194–195 | TLS sem autenticação do servidor e queda automática para HTTP expõem credenciais/AFD a interceptação local. | Inspeção dos dois transportes; ao falhar conexão HTTPS, o laço tenta login HTTP. Não foi atacado nenhum equipamento real. |
| P17 | Alta | D:ferramentas/montar_desktop.sh:24; desktop/www/config.php:89 | `rm -rf desktop` remove também dados e runtime colocados na pasta de execução. | Em fixture descartável, criar `desktop/dados/SENTINELA-SEM-DADOS-REAIS.txt` e executar o script original com fontes simuladas: exit 0 e sentinela removida. |
| P18 | Média | N:leitor_afd.js:1479–1486;1523–1527 | CSV/cópia não neutralizam células de texto interpretáveis como fórmula. Aspas CSV não resolvem isso. | Nome fictício `=1+1` é exportado como `"=1+1"`; uma planilha pode interpretá-lo. Foi conferido o arquivo, não executada fórmula em Excel. |
| P19 | Alta para sigilo, condicionada ao caminho streams | D:relogio.php:106–126 | O fallback streams segue redirecionamentos sem revalidar destino; um307 preserva o corpo POST, que no login contém credenciais. | Em PHP real, dois endpoints locais: streams segue302 como GET e307 como POST com JSON fictício; cURL não segue. `postar()` foi chamado diretamente para isolar o transporte; o handler corretamente recusa127. Nenhum destino externo foi acessado por esse caminho. |
| P20 | Média | D:feriados.js:12–35;73–81 | Pontos facultativos recebem a mesma tarja FERIADO; calendário não registra aplicabilidade à empresa, localidade ou vigência. | 28/10 e 24/12 recebem FERIADO; Cinzas diz “até 12h”. Não há configuração da Fortman nem comparação oficial de 2026 concluída. |
| P21 | Baixa/média | D:feriados.js:84–101;115–121 | Observer revarre todo conteúdo; qualquer célula de data pode receber tarja, inclusive fora do espelho. | Renderizar uma tabela de eventos/auditoria com `<td>07/09/2026</td>`: o seletor alcança a célula. O debounce evita tempestade imediata, mas não limita a região semântica. |
| P22 | Baixa | N:index.html:175;757 | Grade de filtros transborda em tela móvel após carga. | Chromium, viewport 390px: documento 626px; tela desktop 1366px permanece com largura 1366px. |
| P23 | Baixa/média | N:leitor_afd.js:677;1377–1407 | Cabeçalhos ordenáveis não têm interação equivalente por teclado/aria-sort; modal não recebe/contém foco. | TH tem tabIndex −1, sem role/aria-sort; abrir detalhes mantém foco em botão fora do modal. |
| P24 | Baixa para mês; média para arquivo longo | N:afd_parser.js:1346;1375–1376 | Completar dias para silenciosamente ao atingir 400 iterações por pessoa. | Intervalo 01/01/2025–31/12/2026: parte dos dias intermediários desaparece sem indicação de truncamento. |
| P25 — limitação | Média | N:afd_parser.js:1251–1258;1350–1361 | Cadastrado sem qualquer batida não entra no espelho, mesmo ao completar todo o período. | Cadastro tipo 5 sem tipo 3/7/8: pode constar em Trabalhadores, mas não recebe dias de conferência no espelho. Não concluir falta sem quadro ativo. |
| P26 | Média | D:relogio.php:145–165;263; D:relogio.js:16–26 | Limites por requisição não são um prazo global confiável; sessão expirada/nome incompleto não têm recuperação estruturada. | Até 200 páginas de 30s podem exceder 240s; não há AbortController no fetch. Páginas repetidas são deduplicadas e interrompidas, mas perda parcial de nomes não é sinalizada. |
| P27 | Média, depende do computador | D:relogio.php:21;46–55;231–240 | Senha está em texto puro; header fixo dificulta CSRF de formulários, mas não autentica pessoa/processo local. | Ler código de gravação/GET config: senha não volta ao navegador, mas permanece no arquivo; POST usa apenas `X-Relogio:1`. Não foram lidas credenciais reais. |
| P28 | Baixa/média | N:afd_parser.js:1095–1097 | Auditoria mantém máximo antigo após ajuste e pode alertar retrocesso falso no segmento novo. | 12:00, ajuste para 10:00, 11:00 e 11:30: a segunda marcação após ajuste recebe RETROCESSO_TEMPORAL indevido. |
| P29 | Média, privacidade | N:leitor_afd.js:1365;1377–1403;1470–1471; README:170–171 | “Ocultar documentos” não mascara a linha bruta em modal/aba Arquivo/exportação dessa aba, embora a documentação sugira compartilhamento sem expor CPF/PIS. | Ativar a máscara e abrir o inspetor/Arquivo: o PIS fictício permanece visível no conteúdo bruto; a tabela formatada fica mascarada. Não compartilhar a tela/CSV supondo anonimização global. |

Não foi identificado um caso confirmado de execução de HTML por nome no teste de XSS realizado. Isso é um resultado positivo e limitado ao caminho testado, não uma garantia universal.

### 4.2 Estrutura do núcleo e qualidade

**O que está bem feito.** O analisador funciona em Node e navegador, sem dependências externas. O modelo de registros, inconsistências e origem por linha é útil para uma conferência auditável. NSR, documentos, contagem de trailer, duplicidade exata e retrocesso têm verificações existentes. `Object.create(null)` em mapas de entrada reduz colisões de chaves de protótipo. Há testes para BOM, quebras de linha, processamento em lotes e limites de inconsistências. O `Intl.Collator` reutilizado e o cálculo de campos detalhados sob demanda evitam custos repetidos. A aritmética comum, as seis escalas prontas e os acumulados separam-se razoavelmente da renderização.

**Separação regras/tela é parcial.** O parser concentra pareamento e saldo, mas a UI decide escala ativa (`85–96`), período/política de completar dias e qual conjunto de linhas alimenta totais. A classificação de feriados só existe em um pós-processador visual do desktop. Não existe uma entidade compartilhada de “jornada conferida”, com status, vigência e justificativa. Mover primeiro decisões de apuração para uma função pura com opções explícitas é suficiente; não há motivo demonstrado para trocar framework ou tecnologia.

**Leiaute e detecção.** A tabela 1.510 declara comprimentos por tipo (232/299/34/34/87/37), testados com exemplos do projeto. O modo 671 é permissivo: reconhece variantes e extrai datas/identificador/resto, mas reconhecimento não equivale a comprovar os campos obrigatórios de todos os perfis REP-C/REP-A/REP-P. A detecção automática pode ser alterada pelo seletor; arquivos desconhecidos têm aviso. Ainda faltam fixtures externas oficiais/de fabricante por perfil, leiaute e versão. Não emitir selo de conformidade apenas porque o arquivo foi reconhecido e tem zero inconsistências.

**CRC e hash.** Estão presentes como dados extraídos, não como integridade validada. O exemplo local e seu gerador têm CRC/hash, mas os testes conferem sobretudo presença/comprimento; alterar o CRC demonstra a lacuna. Implementar CRC exige parâmetros e bytes exatos definidos no leiaute. Hash extraído de um registro, sozinho, não comprova autenticidade, assinatura ou cadeia de confiança.

**Codificação.** `N:leitor_afd.js:169–180` tenta ASCII/UTF-8 com erro fatal e depois Windows-1252; o rótulo dessa última é “ISO-8859-1”, apesar de não serem idênticas nos códigos 0x80–0x9F. É uma estratégia prática, mas heurística. O parser recebe string, sem preservar necessariamente os bytes usados por uma futura verificação de CRC. Acrescentar fixture Windows-1252 com acentos/caracteres de 0x80–0x9F, UTF-8 e bytes inválidos; mostrar codificação real e permitir correção explícita se necessária. Não regravar o AFD original.

**Datas, semana e mês.** Semana começa na segunda e termina no domingo (`inicioDaSemana/fimDaSemana`); mês é civil, conforme a data agrupada. Utilidades de calendário em UTC ajudam a evitar mudança pelo fuso do computador. As batidas 671 preservam o offset na leitura, mas cálculo e ordenação o descartam. Datas inexistentes e horas fora da faixa podem continuar no espelho. Segundos são ignorados na duração: deve-se documentar truncamento/arredondamento e não acumular erro por par sem política. Ajustes de relógio precisam de segmentos e conferência, não apenas ordenar pelo texto HH:MM.

**Desempenho medido.** `node --expose-gc testes/carga.js 120000`, Node 24/Linux: 120.000 marcações, 200 pessoas e 30.000 linhas de espelho; análise 786ms, espelho 136ms, completar 49ms, saldos 21ms; heap final aproximadamente 126MB. É uma execução sintética de referência, não SLA do navegador nem medição no Windows da empresa. A UI usa lotes de4.000 linhas (`leitor_afd.js:8`), tabelas de200 linhas e cartões de12 trabalhadores; ainda mantém texto, linhas e modelo em memória, e não cancela análise substituída. A lista de dias de cada trabalhador não é paginada individualmente. Corrigir concorrência e medir renderização real antes de introduzir Web Worker/virtualização por hipótese.

**Manutenção.** Nomes em português e funções puras ajudam, mas os dois arquivos grandes misturam muitas responsabilidades. Extrair módulos pequenos por responsabilidade, se necessário, preservando a API `AFD`, é menos arriscado que reescrever. O tratamento de erro precisa distinguir arquivo inválido, dado pendente, saldo conferido e falha de integração. Acessibilidade e grade móvel têm reproduções específicas em P22/P23, não uma crítica genérica à aparência.

### 4.3 Testes executados e lacunas

| Verificação | Resultado e alcance |
|---|---|
| `node testes/test_afd_parser.js`, N | **197 verificações passaram, zero falhas**, exit 0. Nenhum teste existente foi alterado. |
| Carga de 120.000 marcações | Executada; números acima. Não mede a rede nem o hardware Windows. |
| Casos aritméticos da seção 5 | Executados diretamente nas três funções públicas, com fixtures fictícias e oráculo aritmético separado. |
| Reproduções de inválidos/CRC/truncamento/ajuste/fuso | Executadas; confirmam comportamentos da tabela, mesmo com a suíte principal verde. |
| Chromium, HTTP local | Exemplos 1.510/671 abriram; transições, exportação, carga concorrente, tela 390/1366px, nome HTML, mascaramento e modal exercitados. Sem erro JavaScript nos cenários verificados. Requisições externas bloqueadas no teste. |
| Integração de mês/feriados em VM Node | Corrida do segundo download e esgotamento das tentativas reproduzidos; datas móveis de 2026 calculadas. Não é teste contra relógio real. |
| `node --check` nos complementos; `bash -n` montagem | Aprovados. Apenas sintaxe. |
| PHP local | PHP 8.4.24 preparado fora do repositório, com cURL/OpenSSL e variante streams; `php -l complementos/ponto/relogio.php` aprovado. Não comprova a versão/extensões do PHP Desktop instalado na empresa. |
| Backend PHP com mocks locais | Nos dois transportes: validação de IP/porta, config sem usuário/senha, POST sem header recusado, páginas repetidas interrompidas em2pedidos e logout tentado; comportamento de JSON não-AFD aceito confirmado. Streams seguiu302/307 para outro endpoint local;307 preservou POST/corpo, enquanto cURL não seguiu. Testes offline com dados fictícios e cópias isoladas; não homologam firmware ou TLS do relógio. |
| Montagem destrutiva | Script original exercitado em fixture descartável com fontes Git simuladas e dados-sentinela; perda da sentinela confirmada. Não foi remontado o `desktop/` do checkout. |
| Executável Windows, aparelho real, folha real | **Não executados.** Dependem de equipamento e dados sob controle da Fortman. |
| Fontes oficiais externas | **Bloqueadas por política de rede.** Ver seção 4.6. |

Os 197 testes cobrem: documentos; algumas datas ISO; CPF/PIS; exemplos dos dois leiautes; inconsistências básicas; pareamento normal/ímpar; escalas e agregados; completar faltas/folgas; listas de nomes; campos sob demanda; limite de inconsistências; BOM/quebras/lotes e chaves especiais.

Não cobrem adequadamente: integridade adulterada; estrutura 671 truncada; datas inválidas ainda usadas no saldo; validade de cabeçalhos e ajustes; offsets/segundos; duplicata próxima; fechamento pendente; jornada atravessando data; feriados e afastamentos; escala por pessoa/vigência; pessoa sem batidas; truncamento de 400 dias; concorrência de cargas; filtro do download; backend e integração desktop. Fixtures geradas pelo próprio projeto são úteis, mas não constituem validação independente do leiaute oficial.

### 4.4 Desktop, montagem e compatibilidade

A estratégia de gerar um pacote a partir das branches é razoável para manter uma única fonte de cada aplicativo. Na comparação byte a byte realizada, o parser/UI gerados no desktop coincidem com o snapshot N, e os três complementos coincidem com as fontes D. Isso **não assegura a próxima montagem**: o script busca pontas móveis e não grava manifesto de SHAs; substituições por `sed` dependem de texto exato. Os dois `grep` só verificam scripts injetados, não o contrato com o leitor nem a preservação dos dados.

P17 merece correção antes de usar a montagem sobre uma pasta em que o programa já rodou. Não executar o script original sobre uma instalação com dados reais para confirmar o problema. Construir em staging e preservar dados/runtime resolve sem trocar tecnologia.

O contrato de integração deve parar de ser “encontrar IDs e disparar change”. O encadeamento atual não espera a conclusão de `FileReader` nem da análise; `DataTransfer` exige suporte do Chromium empacotado, e uma mudança nos IDs pode falhar silenciosamente. Uma API pequena, versionada e baseada em Promise permite `carregar({bytes, nomes, periodo})`, que só resolve depois de aplicar o filtro à análise correspondente. Manter os inputs como adaptador para uso manual preserva compatibilidade.

**Backend: pontos positivos.** Não devolve usuário/senha no `config`; campo vazio conserva o valor; restringe host literal IPv4 privado e porta 1–65535, sem aceitar nome DNS ou URL arbitrária; pede header de POST; tem limites por chamada; tenta logout no caminho normal. O loop de nomes deduplica páginas e interrompe quando não chegam usuários novos, o que reduz o risco de firmware ignorar offset. A pasta `desktop/dados` está ignorada pelo Git.

**Limites de segurança/robustez.** Rede privada não autentica o servidor. Desligar validação TLS e enviar automaticamente HTTP são riscos concretos, mesmo dentro da LAN. Não foi necessário executar esses caminhos contra um servidor HTTPS inseguro nesta revisão. O header fixo é uma barreira útil a formulário cross-origin, não login/autorização; não há checagem estruturada de Origin/Host/token de instalação. Salvar JSON sem escrita atômica/lock pode corromper config com interrupção ou gravações concorrentes; senha vazia também não permite “apagar credenciais”, exigindo ação própria. Uma falha na lista de nomes é silenciosa e pode devolver identificação incompleta. Não há garantia de prazo global, limite de tamanho de resposta, repetição controlada por sessão expirada ou logout em `finally` para toda exceção.

**PHP Desktop.** A presença de `str_starts_with` e tipos modernos exige PHP 8; a documentação do pacote pede PHP Desktop 130.1 ou mais novo. Para cURL são necessários cURL e suporte TLS correspondente; fallback HTTPS exige OpenSSL e streams HTTP habilitados (`allow_url_fopen`). OpenSSL sozinho não substitui cURL em todas as configurações. Conferir no executável real: versão PHP, extensões, leitura/gravação de dados, timeouts, `File`/`DataTransfer` e navegador empacotado. PHP Linux 8.4 não valida essa distribuição Windows. Não publicar `phpinfo()` nem credenciais para fazer essa conferência.

### 4.5 Segurança e privacidade (LGPD)

O núcleo não contém upload do AFD: usa FileReader/memória. Nos cenários Chromium, os pedidos externos observados foram CSS de `fonts.googleapis.com` e ícones de `cdnjs.cloudflare.com`, não o conteúdo do arquivo. Esses terceiros ainda recebem metadados de acesso (por exemplo IP/cliente e possivelmente referência), e o desktop deixa de ser estritamente sem tráfego externo. Hospedar fontes/ícones localmente, com licenças preservadas, evita essa dependência. Não há evidência de envio de CPF/AFD nesses pedidos; não afirmar vazamento desses dados sem prova.

`nomes_padrao.js` está **vazio**, com exemplos comentados e aviso correto de que é público. Não foi encontrado cadastro real nesse arquivo. A recomendação é manter assim e carregar a lista local. A leitura de nomes na tela não os envia ao servidor; localStorage guarda preferências de tema, escala, jornada, escala personalizada, completar faltas e visão, não o AFD nem a lista de nomes nos caminhos inspecionados (`leitor_afd.js:137;1781–1800;1832;1855–1867`). Arquivos baixados, CSV, área de transferência, downloads, backups e a memória da sessão continuam exigindo controle local de acesso e retenção. O desktop guarda credenciais em `dados/relogio.json`; não foram lidas credenciais reais.

O escape de HTML em `N:leitor_afd.js:44–47` protege o caminho testado: nome fictício `<img src=x onerror=globalThis.__xss=1>` apareceu como texto, sem nó IMG nem execução. O modal/aba bruta continuam exibindo a linha original, inclusive documento completo, mesmo ao ativar mascaramento em outras tabelas. Mascaramento visual **não é anonimização**. Antes de print/exportação, a tela deve esclarecer o alcance, e o modo bruto precisa de confirmação consciente para compartilhamento.

CSV exige proteção própria: escapar aspas não neutraliza fórmulas. Nomes/textos começando com `=`, `+`, `-`, `@` ou controles precisam tratamento de exportação para planilha; não alterar indiscriminadamente campos numéricos de saldo. Preservar também uma exportação bruta técnica explicitamente rotulada, quando necessária. Validar o resultado no Excel/LibreOffice usados pela empresa com fórmulas inofensivas; a revisão verificou os bytes exportados, sem executar planilhas.

Aplicar minimização, finalidade, controle de acesso e segurança conforme LGPD, especialmente arts. 6º e 46, com retenção definida pela empresa e sua orientação jurídica. Não colocar AFD, nomes ou credenciais reais em testes, logs ou Git. Não propor enviar dados de ponto a serviços externos.

### 4.6 Legislação, documentação Control iD e calendário: fato, referência e pendência

**Bloqueio documental exato.** As tentativas HTTPS a seguir falharam no proxy com `curl: (56) CONNECT tunnel failed, response 403`; o curl informou HTTP `000`. Não foi um erro de senha do relógio e não se tentou contornar a política:

- `https://www.controlid.com.br/docs/idclass/pt/`
- `https://www.planalto.gov.br/ccivil_03/decreto-lei/del5452.htm`
- `https://www.gov.br/gestao/pt-br/assuntos/noticias/2025/dezembro/governo-divulga-calendario-de-feriados-e-pontos-facultativos-de-2026`
- `https://www.tst.jus.br/web/guest/sumulas`

A URL de notícia é uma rota candidata; o bloqueio ocorreu antes de validar sua existência. Foram salvas no rascunho do ambiente as adições de domínio `www.controlid.com.br`, `www.planalto.gov.br`, `www.gov.br`, `www.tst.jus.br`, `www.in.gov.br` e `in.gov.br`. Salvar rascunho **não aplicou** acesso nem publicação. Revisão/salvamento/publicação nas configurações do ambiente permanecem necessários para reconsultar as fontes; nenhuma política foi contornada.

As referências jurídicas abaixo identificam os temas a conferir e orientar com a contabilidade. **A redação oficial consolidada e eventuais mudanças posteriores não foram reconsultadas nesta execução.** Não são certificado de conformidade nem parecer jurídico.

| Base | O que o conferidor deveria considerar | Limite de aplicação |
|---|---|---|
| CLT art. 58, §1º; referência interpretativa TST Súmula 366 | Variação até 5min por marcação, observado máximo de 10min diário; separar bruto de tratamento autorizado. | Não zerar `abs(saldo)<=10` sem horários previstos e variações por batida. Confirmar instrumentos/regime e orientação atual antes de implantar. |
| CLT art. 59 e §§; art. 611-A quando pertinente | Duração extraordinária, compensação e banco por regime/vigência. | Saldo positivo bruto não significa automaticamente hora pagável; 9h seg–qui pressupõem compensação válida, não regularidade apenas pela soma de 44h. |
| CLT art. 66 | Sinalizar intervalo entre jornadas inferior a 11h. | Requer jornadas corretamente ligadas; não descontar/pagar automaticamente. |
| CLT art. 71; art. 611-A, III | Alertar intervalo intrajornada: regra geral 1h para mais de 6h e 15min para mais de 4h até 6h; considerar negociação aplicável. | Não presumir intervalo não registrado nem transformar o alerta em valor indenizatório. Negociação pode prever mínimo de 30min para jornada superior a 6h nos termos legais. |
| CLT art. 73 | Trabalho noturno urbano: período 22h–5h, adicional e hora de 52min30s; avaliar prorrogação/regime. | Não usar simplesmente horas de relógio como horas remuneratórias; outras categorias e acordos podem mudar o tratamento. |
| CLT arts. 67 e 70; Lei 605/1949, especialmente art. 9º | DSR/feriados, descanso compensatório e trabalho prestado. | Domingo trabalhado não é automaticamente descanso suprimido. Feriado pode ter pagamento em dobro salvo folga compensatória; não multiplicar minutos do saldo por dois por padrão. |
| Lei 9.093/1995, art. 2º; normas estaduais/municipais | Classificação local de feriados religiosos e calendário aplicável. | Paixão de Cristo e outras datas requerem enquadramento local; ponto facultativo federal não é folga automática na empresa privada. |
| Portaria MTP 671/2021 e anexos aplicáveis | Perfil e campos do AFD, integridade e distinção entre arquivo-fonte e tratamento posterior. | Um conferidor local que lê AFD não se torna automaticamente sistema completo de tratamento/folha nem prova atendimento a todas as exigências de outros documentos. Preservar arquivo-fonte e trilha dos tratamentos propostos. |

**API Control iD — conferência do que existe, sem homologação documental:**

| Tema | Uso confirmado no código D | O que ainda não se pode afirmar |
|---|---|---|
| Login | `POST /login.fcgi`, JSON `login/password`, lê `session` (`195–206`). | Contrato oficial e compatibilidade com o modelo/firmware da Fortman não confrontados. |
| AFD | `POST /get_afd.fcgi?session=...`; `initial_date:{day:1,month,year}` (`217–219`). | Correção exata desse formato, comportamento de períodos sem registro e eventual data final dependem da documentação/firmware. O código não envia data final. |
| Leiaute | Acrescenta `&mode=671` quando selecionado (`217`). | Não foi confirmado que esse parâmetro exista/funcione no aparelho. Detectar o leiaute recebido e avisar divergência. |
| Usuários | `POST /load_users.fcgi`, `limit:100,offset:N` (`145–165`). | Sintaxe/semântica oficial da paginação não comprovada. O código mitiga repetição, mas não prova que recebeu todos. |
| Identificação | Lê `name`, `pis`, `cpf`; usa `id` para deduplicar (`154–176`). | `registration` não é lido. Não tratá-lo como CPF/PIS sem contrato explícito. Campos e formatos reais precisam amostra anonimizada. |
| Logout/sessão | Chama `/logout.fcgi` no caminho normal (`221`). | Expiração, erro intermediário e necessidade de renovação não foram homologados; usar cleanup estruturado e repetição limitada. |

Não afirmar que esses endpoints estão certos ou errados apenas pela semelhança com outra linha de produtos Control iD. O teste simulado confirma o programa contra o simulador, não o simulador contra o firmware.

**Calendário efetivamente calculado em 2026:** Páscoa 05/04; Carnaval 16/17 de fevereiro; Cinzas 18/02 (“até 12h” no texto atual); Paixão 03/04; Corpus Christi 04/06. As datas móveis são coerentes com o algoritmo e o ano. Fixos codificados: 01/01, 21/04, 01/05, 07/09, 12/10, 28/10 facultativo, 02/11, 15/11, 20/11, 24/12 facultativo, 25/12 e 31/12 facultativo. O código não marca 20/04 nem 05/06.

A comparação com a tabela oficial federal de 2026 está **pendente**, não aprovada. Em particular, conferir a possível Portaria MGI nº 11.460/2025, os recortes horários de Cinzas e das vésperas, e eventuais pontes. Número/teor/abrangência dessa portaria não foram confirmados no DOU. Não apresentar “até 14h”, “após 13h” ou as pontes como diferenças oficiais comprovadas nesta revisão. Mesmo depois de conferidas, decisões de folga da Fortman e feriados locais continuam necessárias.

## 5. Verificação independente dos números

### 5.1 Premissas e método

Fixtures exclusivamente fictícias, sem empregados reais. As batidas foram fornecidas a `AFD.montarEspelho`, seguidas de `AFD.completarDias` quando indicado e `AFD.calcularSaldos`. O oráculo aritmético foi obtido separadamente por diferença entre horários, não chamando a mesma função para calcular o esperado.

Salvo indicação, jornada em 03/08/2026 (segunda-feira) = **06:55–11:55 / 12:55–16:55**, 300+240=540min. Escala `[0,540,540,540,540,480,0]`. “Diferença” é **saldo do sistema menos saldo esperado**. Uma política ainda não definida não produz um número “legalmente correto” universal: nesses casos a coluna correta registra a condição ou a pendência.

### 5.2 Casos calculados à mão e confrontados

| Caso | Batidas/período | Resultado do sistema | Resultado correto ou condicionado | Diferença |
|---|---|---|---|---|
| 1a — normal positivo | 03/08: 06:55,11:55,12:55,17:25 | 300+270=570min =09:30; saldo +00:30. | Mesma aritmética, antes de remuneração/compensação. | 0. |
| 1b — normal negativo | 03/08: 06:55,11:55,12:55,16:25 | 300+210=510min =08:30; saldo −00:30. | Mesma aritmética; causa da saída antecipada ainda pode requerer conferência. | 0 aritmético. |
| Exemplo anterior | 03/08: 07:58,12:04,13:03,17:05 | 246+242=488min; saldo −00:52. | 08:08 brutas contra09h =−00:52. | 0. |
| 2a — +3 | 06:52,11:55,12:55,16:55 | 543min; +00:03. | Com os horários previstos acima e tolerância aplicável: variação3 numa marcação, soma3 → saldo tratado0. | +3min. |
| 2b — +8 | 06:51,11:55,12:55,16:59 | 548min; +00:08. | Variações4+4, cada≤5 e soma8: tratado0 nas premissas. | +8min. |
| 2c — +10 | 06:50,11:55,12:55,17:00 | 550min; +00:10. | Variações5+5, soma10: tratado0 nas premissas. | +10min. |
| 2d — +11 | 06:50,11:56,12:55,17:00 | 551min; +00:11. | Variações5+1+5, soma11: ultrapassado limite diário, não abater os10 como franquia; diferença integral +11 nas premissas. | 0. |
| 2e — −3 | 06:58,11:55,12:55,16:55 | 537min; −00:03. | Variação3: tratado0 nas premissas. | −3min. |
| 2f — −8 | 06:59,11:55,12:55,16:51 | 532min; −00:08. | Variações4+4: tratado0 nas premissas. | −8min. |
| 2g — −10 | 07:00,11:55,12:55,16:50 | 530min; −00:10. | Variações5+5: tratado0 nas premissas. | −10min. |
| 2h — −11 | 07:00,11:54,12:55,16:50 | 529min; −00:11. | Variações5+1+5: diferença integral −11 nas premissas. | 0. |
| 2i — contraprova | 06:55,11:55,12:55,17:03 | 548min; +00:08. | **Uma** marcação varia8, excedendo5: não zerar só porque líquido≤10. Tratado +8 nas premissas. | 0; impede correção ingênua. |
| 3 — saída esquecida | 06:55,11:55,12:55 | 300min conhecidos; saldo −240=−04:00; ímpar. | Conhecem-se05h; restante e saldo final **pendentes**. Se saída fosse16:55, total seria09h/saldo0, mas essa saída não pode ser inventada. | Não determinável sem conferência; no cenário confirmado16:55, débito aparente de4h. |
| 4 — duplicata próxima | 06:55,06:56,11:55,12:55,16:55 | 1+60=61min; saldo−479=−07:59; ímpar. | Se06:56 for confirmada como duplicata, pares normais somam540/saldo0. Antes disso: pendente, mantendo ambas na origem. | −479min sob a hipótese confirmada. |
| 5 — atravessa meia-noite | 14/09 22:00 →15/09 06:00; para o ensaio, escala8h de seg a sex | 0min em duas linhas ímpares; esperado960; saldo−960=−16:00. Com escala padrão9h seria−18h. | Uma jornada contém480min físicos. Para contrato de480min e antes de regras noturnas/intervalo, saldo físico0; o tratamento legal noturno não se reduz a esse zero. | −960min na comparação física do ensaio; remuneração não calculada. |
| 6a — feriado sem batida | Batidas normais04/09 (480) e08/09 (540); completar04–08/09 inclui07/09 vazio | Total1020, previsto1560;07/09 FALTA−540; total−09h. | Se07/09 é feriado não trabalhado sem jornada exigível: previsto do dia0; total esperado1020; saldo0. | −540min. |
| 6b — feriado trabalhado | 07/09:06:55,11:55,12:55,16:55 | 540min; esperado540; saldo0. | Na política de jornada prevista0 em feriado,540min trabalhados destacados, saldo de conferência+09h. Pagamento/folga separados. | −540min nessa política; não dizer “perdeu18h”. |
| 7 — sábado/domingo | 08 e09/08, cada06:55,11:55,12:55,15:55 | 480+480=960min; previsto0; extras+16h no total. | +08h brutas por dia fora da escala; compensação, DSR e pagamento dependem do regime. | 0 no saldo bruto. |
| 8 — começa no dia15 | Batidas normais15 e16/09; início/fim selecionados01–30/09, completar entre primeira/última | Só15 e16,1080min/1080 previstos, saldo0. Não cria01–14 nem17–30. | Se admissão15 e arquivo só até16: comportamento adequado para não inventar faltas. Não comprova fechamento mensal completo; se empregado já era ativo antes, pode esconder ausências. | 0 no intervalo comprovado; restante não determinável. |
| 9 — semana entre meses |31/08:540;01/09:570;02/09:510;03/09:540;04/09:480 | Semana chave31/08:2640=44h, esperado44h, saldo0; agosto09h/0saldo; setembro35h/0saldo. | Mesma soma. Setembro tem +30 em01/09 e−30 em02/09; semana cruza mês sem duplicação. | 0. Ao filtrar só setembro, semana é **parcial**, não44h. |
| 10 — opção diária da UI |03 e10/08, cada06:55/11:55/12:55/16:55; diária08h; completar padrão |18h trabalhadas,64h previstas (8dias×8h), saldo−46h; seis dias vazios viram faltas, inclusive sábado/domingo. | Pelo rótulo “em todo dia com marcação”, seriam16h previstas nos dois dias com batidas e saldo+02h. Se o objetivo era contrato de7dias, precisa outro rótulo e decisão explícita. |−48h em relação à descrição da opção. Testado no navegador, não inferido só da escala. |

**No caso noturno**, a comparação física de 8h apenas demonstra a perda dos pares. Para trabalho urbano, hora reduzida, intervalo, adicional e eventual prorrogação precisam de regra própria. Uma jornada de22–06 sem intervalo não está sendo apresentada como escala legal aprovada. Não existe número único de pagamento correto sem contrato/instrumento e marcações completas.

**Férias/atestado/folga/troca de escala/admissão/demissão:** a ausência de metadados não permite inferência segura. Todo dia entre duas batidas pode ser criado como falta pela escala atual; dias antes da primeira/depois da última podem desaparecer. O relatório mensal deve mostrar cobertura e pendências, não afirmar contrato ativo ou falta apenas com base no AFD.

### 5.3 Testes automatizados sugeridos, sem alterar os existentes

O bloco seguinte é uma **especificação proposta**, para acrescentar após aprovação em `testes/test_afd_parser.js`, usando `grupo/igual/ok` do arquivo atual. **Não foi incorporado nem descrito como passando.** As opções e os campos `politica`, `saldoConferido`, `statusSaldo`, `diasPendentes` e `jornadasConferidas` são um contrato novo proposto em M1–M6; hoje não existem. Preservar `totalMinutos` e `saldo` brutos e o teste existente de04h para dia ímpar. Assim, não é preciso enfraquecer teste antigo para esconder o problema.

```js
/* CONTRATO FUTURO PROPOSTO: não é uma API já implementada. */
grupo('Revisão Fortman: bruto, pendência e saldo conferido');
var escRevisao = [0, 540, 540, 540, 540, 480, 0];
function espRevisao(agenda) {
    var marcas = [], nsr = 1;
    agenda.forEach(function (a) {
        a[1].forEach(function (h) {
            marcas.push({ chave: 'FICTICIO', identificador: 'FICTICIO',
                data: a[0], hora: h + ':00', nsr: nsr++, tipo: '3' });
        });
    });
    return AFD.montarEspelho(marcas, []);
}
function apurarRevisao(agenda, politica, preencher, escala) {
    var dias = espRevisao(agenda), e = escala || escRevisao;
    if (preencher) dias = AFD.completarDias(dias, preencher);
    return { dias: dias, totais: AFD.calcularSaldos(dias,
        { escala: e, politica: politica }) };
}
var politicaBase = {
    versao: 1,
    horariosPrevistos: ['06:55', '11:55', '12:55', '16:55'],
    tolerancia: { porMarcacao: 5, porDia: 10 },
    incompleto: 'pendente', duplicataProxima: 'pendente'
};
[
    [['06:52','11:55','12:55','16:55'], 3, 0],
    [['06:51','11:55','12:55','16:59'], 8, 0],
    [['06:50','11:55','12:55','17:00'],10, 0],
    [['06:50','11:56','12:55','17:00'],11,11],
    [['06:58','11:55','12:55','16:55'],-3, 0],
    [['06:59','11:55','12:55','16:51'],-8, 0],
    [['07:00','11:55','12:55','16:50'],-10,0],
    [['07:00','11:54','12:55','16:50'],-11,-11],
    [['06:55','11:55','12:55','17:03'],8,8]
].forEach(function (c, i) {
    var a = apurarRevisao([['2026-08-03', c[0]]], politicaBase);
    igual(a.dias[0].saldo, c[1], 'M4 mantém saldo bruto do caso ' + i);
    igual(a.dias[0].saldoConferido, c[2], 'M4 tolerância por batida e dia ' + i);
});
var incompleto = apurarRevisao([
    ['2026-08-03',['06:55','11:55','12:55']]
], politicaBase);
igual(incompleto.dias[0].totalMinutos, 300, 'M1 mantém horas conhecidas');
igual(incompleto.dias[0].saldo, -240, 'M1 conserva bruto para compatibilidade');
igual(incompleto.dias[0].saldoConferido, null, 'M1 não fecha débito desconhecido');
igual(incompleto.dias[0].statusSaldo, 'pendente', 'M1 pendência explícita');
igual(incompleto.totais.total.diasPendentes, 1, 'M1 total informa incompletude');
var dup = apurarRevisao([
    ['2026-08-03',['06:55','06:56','11:55','12:55','16:55']]
], politicaBase);
igual(dup.dias[0].quantidade, 5, 'M1 não apaga batida original');
igual(dup.dias[0].saldo, -479, 'M1 bruto reproduz a divergência');
igual(dup.dias[0].saldoConferido, null, 'M1 duplicata suspeita pede conferência');
/* Após excluir06:56 mediante anotação separada e aprovada, conferir540min,
   saldoConferido0, origem preservada e justificativa no tratamento. */

var noite = apurarRevisao([
    ['2026-09-14',['22:00']], ['2026-09-15',['06:00']]
], { versao:1, jornadaNoturna:{inicio:'22:00',fim:'06:00'},
     unidade:'minutos-fisicos', tolerancia:null }, null,
   [0,480,480,480,480,480,0]);
igual(noite.totais.jornadasConferidas.length,1,'M5 une uma jornada física');
igual(noite.totais.jornadasConferidas[0].minutos,480,'M5 não perde oito horas');
/* Testes separados para hora reduzida/adicional, sem misturar dinheiro aqui. */

var feriadoPolitica = { versao:1,
    calendario:{'2026-09-07':{tipo:'feriado',jornadaEsperada:0}},
    incompleto:'pendente' };
var feriado = apurarRevisao([
    ['2026-09-04',['06:55','11:55','12:55','15:55']],
    ['2026-09-08',['06:55','11:55','12:55','16:55']]
], feriadoPolitica, {escala:escRevisao});
var dia7 = feriado.dias.filter(function(d){return d.data==='2026-09-07';})[0];
igual(dia7.saldoConferido,0,'M3 feriado não trabalhado não vira débito');
var ferTrab = apurarRevisao([
    ['2026-09-07',['06:55','11:55','12:55','16:55']]
],feriadoPolitica);
igual(ferTrab.dias[0].saldoConferido,540,'M3 destaca horas de feriado');
/* Não multiplicar540 por2 como se fosse duração. */

var semana = apurarRevisao([
    ['2026-08-31',['06:55','11:55','12:55','16:55']],
    ['2026-09-01',['06:55','11:55','12:55','17:25']],
    ['2026-09-02',['06:55','11:55','12:55','16:25']],
    ['2026-09-03',['06:55','11:55','12:55','16:55']],
    ['2026-09-04',['06:55','11:55','12:55','15:55']]
], null);
igual(semana.totais.semanas['2026-08-31'].minutos,2640,
      'Semana cruza mês com44h e sem duplicação');
igual(semana.totais.meses['2026-08'].minutos,540,'Agosto recebe9h');
igual(semana.totais.meses['2026-09'].minutos,2100,'Setembro recebe35h');
```

Acrescentar, no mesmo estilo, os seguintes testes de regressão. Não copiar uma saída atual errada como valor “correto”; cada linha declara a expectativa desejada e a condição de aprovação:

| Teste sugerido | Entrada/ação | Assertivas e ligação com divergência |
|---|---|---|
| T01 — inválidos | AFD fictício com31/02,25:00,26:00 e offset+9961 | Cada campo inválido produz inconsistência com linha/posição; dia afetado não fecha saldo; registro bruto permanece; não remover marcação e reencadear silenciosamente. M2/P06/P08/P10. |
| T02 — integridade | Alterar um byte do AFD671 sem atualizar CRC; omitir CRC/documento/hora na linha curta | Inconsistência de estrutura/CRC quando o perfil exige; estado “não verificado” quando algoritmo/perfil não homologado. Um hash extraído não vira “autenticado”. M10/P07. |
| T03 — relógio volta | NSR08:00/12:00, ajuste12→11,11:05/17:00 | Bruto de origem preservado, dia pendente; tratamento confirmado por pares resulta595min, não485; não emitir retrocesso falso em11:30 após11:00 no segmento novo. M5/P09/P28. |
| T04 — fuso/segundos |23:30−0200→23:45−0300; pares com segundos | Duração física75min no caso histórico; arredondamento explicitamente configurado e testado, sem depender do TZ da máquina. M5/P10. |
| T05 — cobertura/contrato | Primeiro registro15/09, admissão15; empregado sem batidas; demissão16 | Não cria falta antes/depois do vínculo; sem vínculo informado mostra “cobertura desconhecida”; cadastrado ativo sem batidas aparece como pendência, não desaparece nem recebe desconto automático. M6/P11/P25. |
| T06 — calendário/afastamento | Mesmo feriado com decisão de trabalhar ou folgar; férias/atestado aprovado; ponto facultativo não adotado | Apuração usa política vigente e decisão explícita; não aplica automaticamente portaria federal à empresa; fonte/vigência/justificativa preservadas. M3/M6. |
| T07 — escala diária | UI “só com marcação”, batidas03 e10/08, completar padrão | Fim de semana vazio não vira falta na opção descrita; se o objetivo for7dias de contrato, mudar rótulo/aviso e ter teste próprio, mediante decisão do dono. M6/P12. |
| T08 — período longo | Intervalo maior400dias | Resultado acusa truncamento/recusa período ou processa por recorte explícito; não omite dias silenciosamente. M12/P24. |
| T09 — concorrência | Carregar A grande e depois B pequeno | Apenas B pode atualizar modelo, nome, progresso e tela; término tardio de A é ignorado. M7/P13. Teste de integração, não só parser. |
| T10 — filtro e importação | Dois downloads sucessivos e análise com duração maior10s | Segunda importação recebe período correto depois da conclusão; falha/cancelamento é visível; nomes e arquivo pertencem ao mesmo pedido. M7/P14. |
| T11 — backend |401/403, sessão expirada,200comJSON/HTML,AFDvazio, falha de nomes, paginação repetida/sem offset | JSON/HTML não são sucesso AFD; repetição e prazo limitados; nomes incompletos sinalizados; logout garantido; UI não anuncia sucesso sem resultado. M8/P15/P26. |
| T12 — transporte/config | IP público/loopback/URL inválidos, privado válido, porta inválida, header ausente, redirect, cert diferente | Destinos não autorizados rejeitados; redirect não sai da regra; credenciais não retornam/logam; gravação atômica; TLS mantém verificação; HTTP exige decisão explícita local. M9/P16/P19/P27. |
| T13 — montagem | Fixtures de branches e sentinelas em dados/runtime; falha no meio | Dados/runtime preservados e versão anterior utilizável; manifesto registra SHAs; ausência de alvo de injeção falha antes da troca. M11/P17. |
| T14 — saída/privacidade/DOM | NomeHTML, texto=fórmula, mascaramento, teclado, viewport390 | HTML permanece texto; CSV tratado não executável como fórmula de texto; exportação não finge anonimização; foco/modal/ordenação acessíveis; largura do documento≤viewport. M13/M14/P18/P22/P23. |

Esses testes devem coexistir com os197 atuais e fixtures do fabricante anonimizadas. Casos de sábado/domingo e semana entre meses já corretos precisam ser mantidos para evitar regressão ao adicionar calendário. Não “corrigir” uma divergência apagando teste ou mudando indiscriminadamente a expectativa do bruto.

### 5.4 Protocolo de validação com dados reais

1. Escolher **um mês fechado** e2–3 empregados: um regular, um com exceção conhecida (feriado/férias/batida ausente) e, se existir, um de escala diferente/noturna. Confirmar contrato, vigência, admissão/demissão, feriados locais e acordo aplicável com a pessoa responsável. Não usar dados reais em Git ou serviços externos.
2. Guardar localmente o AFD original em pasta restrita, com hash SHA-256 local e backup. Registrar modelo/firmware, leiaute, horário do equipamento e forma de extração. Trabalhar sobre cópia; não modificar o arquivo-fonte nem o relógio.
3. Obter da contabilidade ou do relógio **o espelho detalhado e a política de tratamento**, não apenas um total mensal. Distinguir relatório bruto do REP de relatório já tratado. Anonimizar os documentos que forem compartilhados para diagnóstico.
4. Comparar primeiro NSR/data/hora/identificador; depois pares e duração; depois jornada prevista por dia; por último saldo, tolerância, afastamentos e compensações. Conferir manualmente pelo menos cinco dias e todos os dias com pendência. Comparar semana e mês, marcando semanas parciais.
5. Classificar cada diferença: **leitura/identidade** (registro faltou ou mudou pessoa), **pareamento/tempo** (duplicata, madrugada, ajuste, offset), **jornada/calendário** (feriado, escala, admissão), **política** (tolerância/abono/banco), **remuneração** (percentual, noturno, DSR) ou **filtro/cobertura**. Diferença de dinheiro não prova erro no minuto bruto; igualdade de total pode esconder erros que se anulam.
6. Não aceitar divergência inexplicada: manter o dia pendente, registrar origem/valor esperado/valor obtido e criar fixture fictícia mínima que reproduza o caso. Horas desconhecidas não viram débito confirmado. Aprovação do tratamento deve ter responsável/data/justificativa, sem reescrever o AFD.
7. Critério de aceite: registros íntegros lidos conforme perfil, aritmética bruta conferida, todas as diferenças explicadas/assinadas, calendário/escala aprovados e zero pendência ocultada. Só então comparar o fechamento tratado com a contabilidade. Validar restauração de backup e atualização do desktop antes de substituir a ferramenta corrente.
8. Para Control iD, em sessão acompanhada pelo responsável: conferir primeira/segunda/última página de usuários, mês passado sem misturar meses seguintes, AFD vazio, leiaute pedido/recebido e comportamento de sessão expirada. Não testar carga ou comandos de alteração no equipamento de produção.

## 6. Melhorias sugeridas

Cada proposta é independente de autorização de implementação. Estruturas novas abaixo são sugestões de contrato; não descrevem campos já existentes.

### M1 — Saldo bruto separado de fechamento e pendências

- **Melhoria:** conservar pares conhecidos, acrescentar status de conferência e impedir que incompletos/suspeitos pareçam débito final.
- **Por que:** P01/P02: três batidas geram−04h e a duplicata de1min gera−07:59, sem prova do trabalho restante. Aviso visual não basta quando o mesmo saldo entra no total/CSV.
- **Como executar:** em `afd_parser.js`, manter `totalMinutos`/`saldo` legados; produzir separadamente `statusSaldo`, `motivos`, `saldoConferido:null` enquanto houver pendência, mais contadores/totais conhecidos. Registrar tratamentos fora do AFD, com marcação referenciada por NSR/linha, justificativa e responsável. Na UI, exibir “subtotal conhecido”, “N dias pendentes” e bloquear rótulo de fechamento definitivo/exportação tratada até conferência. Nunca deduplicar automaticamente só por proximidade. Testar ímpar, duplicata exata/próxima, aprovação/rejeição e total mensal com pendências, preservando o teste antigo de04h.
- **Esforço e risco:** médio; altera semântica de apresentação e exportação. Compatibilidade exige bruto intacto e campos novos optativos.
- **Depende de decisão do dono?** Sim: D4 e D9 — quem confere, como aprova e o que pode aparecer no fechamento.

### M2 — Validar campos antes da apuração sem apagar a origem

- **Melhoria:** data/hora/offset inválidos bloqueiam fechamento do dia afetado; validar também cabeçalhos, empregados, empregadores e ajustes.
- **Por que:** P06/P08:31/02 e25h ainda produzem saldo; o período pode cair em mês e semana incompatíveis.
- **Como executar:** centralizar validadores estritos em `afd_parser.js`; reaproveitar `valido` em todos os tipos, validar offset e faixas, guardar campo/posição/linha e estado de elegibilidade. `montarEspelho` deve receber sinalização de dia suspeito, não remover uma batida e unir outras por acidente. Em `calcularSaldos`, manter bruto explicável e impedir saldo conferido. Acrescentar T01/T04 e regressões por registro, incluindo data impossível no cabeçalho, NSR malformado e horário vazio.
- **Esforço e risco:** médio; pode expor arquivos de fabricante antes aceitos. Separar modo compatível documentado de validação estrita e explicar o diagnóstico ao usuário.
- **Depende de decisão do dono?** Não para rejeitar validade impossível; sim D9 para fluxo de exceção e compatibilidade de fabricante.

### M3 — Calendário aplicável na apuração, com origem e vigência

- **Melhoria:** definir feriados/folgas da Fortman no modelo de jornada; a tarja passa a refletir a mesma classificação.
- **Por que:** P04/P20:07/09 sem batida vira−09h; portaria de ponto facultativo federal não decide folga privada. Tarja igual para situações diferentes induz interpretação errada.
- **Como executar:** criar calendário local `{data,tipo,abrangencia,fonte,vigencia,jornadaEsperada,decisaoEmpresa}`; cobrir União/UF/município e decisões aprovadas. Aplicar antes do saldo; manter minutos trabalhados e adicionais/remuneração separados. `feriados.js` vira adaptador visual, sem regra própria divergente; tabelas/cartões usam identificadores semânticos de dia. Reconsultar calendário oficial2026, horários parciais e lei local antes de preencher. Testar07/09 vazio/trabalhado, ponto facultativo adotado/não adotado, feriado local e data parcial sem arredondar a folga para dia inteiro.
- **Esforço e risco:** médio; afeta previsão e totais. Precisa importação/configuração simples e histórico para reproduzir um fechamento antigo.
- **Depende de decisão do dono?** Sim: D1/D2/D3 — calendário local e decisões de folga/compensação.

### M4 — Tolerância baseada em horários previstos por marcação

- **Melhoria:** adicionar horários contratuais e política aprovada de tratamento, preservando saldo bruto.
- **Por que:** CLT58§1º e casos2:4+4 e8 numa só marcação têm o mesmo saldo líquido+8, mas não o mesmo enquadramento. `abs(saldo)<=10` erraria.
- **Como executar:** armazenar horários previstos/intervalos por pessoa e vigência; comparar cada marcação válida/confirmada com seu evento esperado, acumular variações conforme regra homologada com contabilidade e não aplicar tolerância em dia ambíguo. Separar `variacoes`, `minutosTratados` e bruto; não descontar10min como franquia quando limite for ultrapassado. UI mostra regra/versionamento e impacto. Testar ±3/±8/±10/±11,8 numa marcação, saldo líquido pequeno com grandes variações opostas, ímpar, troca de escala e limite por batida. Reconsultar fonte jurídica vigente antes de implementar.
- **Esforço e risco:** médio/grande; depende do modelo de horários. Alto risco de regra aparentemente simples mudar salário; implantação com paralelo de conferência.
- **Depende de decisão do dono?** Sim: D5/D6 — aplicação e horários/regimes; não perguntar ao dono se quer ignorar obrigação aplicável, e sim como confirmar o enquadramento com a contabilidade.

### M5 — Jornada que atravessa data, ajustes e tempo físico

- **Melhoria:** criar jornadas vinculadas por janela/escala, com ordem e instantes auditáveis; tratar ajustes como segmentos.
- **Por que:** P03/P09/P10/P28:22–06 perde8h; atraso do relógio altera pares em1h50; offset histórico perde1h. São problemas diferentes que a mera ordenação HH:MM não resolve.
- **Como executar:** preservar data/hora/offset/NSR originais; normalizar instante quando houver offset válido; organizar janela de jornada e segmentos de ajuste. Associações ambíguas ficam pendentes; nunca unir qualquer batida distante sem limite. Manter legado por data para inspeção. Definir segundos/arredondamento uma vez ao final da apuração. Só depois acrescentar alertas CLT66/71 e eventual tratamento noturno CLT73, separado da duração física. Testar22–06, virada de mês/ano, duas jornadas no mesmo dia, offset−02→−03, ajuste12→11, sequência após ajuste e ausência de offset histórico.
- **Esforço e risco:** grande; muda agrupamento. Entregar em etapas e comparar meses anonimizados antes de ativar para fechamento.
- **Depende de decisão do dono?** Sim: D6/D7 — existência de trabalho noturno, regimes e janelas reais.

### M6 — Contrato por pessoa/vigência e cobertura explícita

- **Melhoria:** escala individual, admissão/demissão, afastamentos aprovados e indicação de período completo/parcial; corrigir o rótulo da opção diária.
- **Por que:** P11/P12/P25: mesma escala para todos, sábado vazio descontado apesar do rótulo e empregado sem batidas fora do espelho. Primeiro/último registro não provam início/fim de vínculo.
- **Como executar:** modelo local de pessoa com intervalos de vigência, escala/horários, vínculo e exceções justificadas. `completarDias` recebe quadro ativo e política explícita; sem informação, marca cobertura desconhecida. Não atribuir automaticamente faltas ao mês todo. Definir se “diária” vale só para dias com registro ou para7dias contratuais e alinhar rótulo/cálculo. Mostrar total conhecido, datas cobertas, semanas parciais e pessoas sem registros. Testar T05–T07, troca de escala no meio do mês e férias entre batidas. Manter armazenamento local com backup e sem nomes no Git.
- **Esforço e risco:** médio/grande; depende de cadastro simples e histórico consistente.
- **Depende de decisão do dono?** Sim: D6/D7/D8 — escalas, vínculo/afastamentos, cobertura e significado da opção diária.

### M7 — Importação com identidade, cancelamento e contrato entre complementos

- **Melhoria:** uma operação de carga identifica bytes, nomes e período; só a carga atual pode concluir e anunciar sucesso.
- **Por que:** P13/P14: arquivo antigo substitui o novo; o mês se perde no segundo download enquanto a mensagem afirma estar filtrado.
- **Como executar:** `leitor_afd.js` mantém contador/token de carga e aborta FileReader/trabalho anterior ou ignora callbacks obsoletos; expor API versionada mínima, por exemplo `carregar({bytes,nomes,periodo}) -> Promise<resultado>`. Inputs manuais chamam essa mesma API. `relogio.js` espera conclusão, aplica período no modelo correspondente e só então mostra sucesso. Substituir polling de IDs/10s por Promise/evento com id; tratar cancelamento/erro/timeout e incompatibilidade de versão. Testar cargas A/B, dois meses, nomes lentos, análise>10s, IDs alterados e recurso File/DataTransfer ausente no runtime alvo.
- **Esforço e risco:** médio; contrato entre branches e gerador precisa ser versionado para implantação coordenada.
- **Depende de decisão do dono?** Não para eliminar corridas; sim D10 para homologação no computador/relógio.

### M8 — Contrato Control iD e robustez de respostas/sessões

- **Melhoria:** validar AFD recebido, sinalizar lista parcial e homologar endpoints por modelo/firmware, com prazo total e cleanup.
- **Por que:** P15/P26:200comJSON pode parecer AFD; paginação conhecida só pelo simulador não prova cobertura; requisições sucessivas podem exceder prazo.
- **Como executar:** em `relogio.php`, validar status/tipo/assinatura mínima e leiaute do conteúdo, distinguir resposta de erro JSON/HTML e AFD vazio. Não tratar toda falha como “senha errada”; usar categorias de conexão, autorização, sessão, conteúdo e nomes incompletos sem expor detalhes sensíveis. Prazo absoluto com tempo restante por chamada; limite de bytes/páginas configurado; uma renovação de sessão apenas se contrato permitir; logout em `finally`. Matriz de modelo/firmware/regra de initial_date/data final/mode/paginação/campos; não reutilizar API de outro produto por suposição. Testes T11 e sessão acompanhada no equipamento, sem alterar registros do relógio.
- **Esforço e risco:** médio; maior incerteza é firmware, não sintaxe PHP. Manter opção de carregar AFD manualmente.
- **Depende de decisão do dono?** Sim: D10 — modelo/firmware e disponibilidade para homologação segura.

### M9 — Autenticar transporte e proteger configuração local

- **Melhoria:** TLS verificado com confiança/pin aprovado, sem downgrade automático; destino fixo também em redirecionamentos; proteção local de credenciais e escrita atômica.
- **Por que:** P16/P19/P27: senha e ponto podem ser interceptados na LAN, arquivo puro pode ser copiado e IP privado não garante identidade. Não é preciso expor internet para existir risco.
- **Como executar:** cadastrar certificado/CA ou impressão digital aprovada por canal independente e detectar troca; usar verificação TLS suportada pelo runtime. Desligar redirects em ambos transportes, ou validar cada destino antes de seguir. Não repetir login HTTP automaticamente; caso legado exija HTTP, decisão expressa e aviso local, com plano de atualização, mantendo opção manual de importação. Restringir acesso a loopback/Host/Origin e usar token imprevisível por instalação para operações, sem confundir header fixo com login. Arquivo fora do webroot, ACL Windows mínima, escrita temporária+rename/lock e ação de apagar acesso; avaliar DPAPI/Windows Credential Manager em etapa separada, sem chave de criptografia ao lado do JSON. Testar T12 sem desligar TLS para fazer teste passar; não logar senha/session/AFD.
- **Esforço e risco:** médio; pin/certificado pode exigir suporte ao renovar, por isso documentar recuperação. DPAPI é esforço adicional, não pré-requisito para corrigir redirects/downgrade.
- **Depende de decisão do dono?** Sim: D10/D11 — capacidade do aparelho, usuário do PC e proteção do backup; medidas básicas independem de escolha estética.

### M10 — Auditoria estrutural por perfil e integridade verificável

- **Melhoria:** distinguir “reconhecido”, “estruturalmente válido”, “integridade verificada” e “não verificado”.
- **Por que:** P07:CRC `ZZZZ` passa com zero inconsistências; linha671 sem hora/CPF também. O nome “Auditoria” pode sugerir garantia maior que a existente.
- **Como executar:** tabelas por perfil/versão REP-C/A/P com campos, comprimentos, caracteres, obrigatoriedade e parâmetros oficiais de CRC. Preservar bytes e codificação; validar checksum nos perfis homologados; assinatura/hash só com procedimento e confiança definidos, nunca pelo comprimento. Registrar compatibilidade de fabricante como exceção explícita. Testar T01/T02, mutação de byte, Unicode/Windows-1252, tipo desconhecido/truncado e fixtures anonimizadas externas independentes do gerador local. Atualizar a UI para não dizer “íntegro” quando somente decodificou.
- **Esforço e risco:** médio/grande; homologação documental é requisito externo. Pode rejeitar arquivos antes aceitos; oferecer diagnóstico e modo de inspeção, não saldo final silencioso.
- **Depende de decisão do dono?** Não para rotular corretamente a capacidade atual; sim D10 para amostras/modelos a suportar primeiro.

### M11 — Montagem não destrutiva, manifestos e teste de integração

- **Melhoria:** gerar pacote em staging com SHAs explícitos e preservar dados/runtime da instalação.
- **Por que:** P17 reproduzido: remontar apaga `desktop/dados`; pontas móveis e substituições textuais podem gerar pacote incoerente ou parcial.
- **Como executar:** alterar apenas fonte `ferramentas/montar_desktop.sh` após aprovação, nunca corrigir gerado à mão. Resolver/registrar SHAs de todas as entradas; montar em diretório temporário; validar árvore/âncoras/contrato e executar smoke antes de trocar só o código. Manter dados fora da área descartável, backup verificado, runtime/downloads locais preservados e rollback. Falha deixa versão anterior intacta. Testar T13 com sentinelas fictícias e falhas de fetch/archive/injeção. Confirmar que executar novamente é seguro.
- **Esforço e risco:** médio; instalação/atualização afetam usuário Windows. Solução deve continuar sendo copiar pacote e abrir, sem exigir Git ou ferramentas do usuário final.
- **Depende de decisão do dono?** Não para preservar dados; sim D11 para localização/backup e procedimento operacional.

### M12 — Cobertura de período, desempenho e diagnóstico claros

- **Melhoria:** avisar truncamentos e medir o fluxo real antes de otimizações maiores.
- **Por que:** P24 e carga: teto400dias evita trabalho ilimitado, mas omite dias sem aviso; parser rápido em Node não garante renderização leve no PC.
- **Como executar:** retornar metadados `truncado/limite/intervaloCoberto`; permitir recorte mensal explícito e marcar semana parcial. Medir tempo/memória de leitura, análise, completar, render/exportar com arquivos fictícios representativos no Windows. Evitar cópias desnecessárias e callback obsoleto primeiro; introduzir worker/virtualização só se o perfil justificar. Testar T08, intervalo absurdo e arquivos grandes válidos/inválidos, sem remover proteções.
- **Esforço e risco:** pequeno para aviso/diagnóstico; médio para otimização medida. Não definir SLA com uma única execução sintética.
- **Depende de decisão do dono?** Sim: D8/D12 — períodos/tamanhos reais e tempo aceitável; aviso de truncamento independe disso.

### M13 — Exportações e privacidade explícitas

- **Melhoria:** exportação segura para planilha, alcance claro do mascaramento e dependências visuais locais.
- **Por que:** P18/P29 e seção4.5: nome=fórmula continua ativo em CSV; modal/bruto podem revelar documento apesar da máscara; CSS externo contradiz operação estritamente offline.
- **Como executar:** centralizar serialização CSV/clipboard por tipo de campo; neutralizar texto perigoso sem estragar número/saldo. Opções separadas para exportação de conferência, dados brutos e compartilhamento mascarado, com aviso e testes. Manter `nomes_padrao.js` vazio, evitar persistência de AFD/nomes no navegador e instruir retenção/limpeza/backup local. Copiar fontes/ícones com licenças, remover requests externos e testar offline. Testar fórmulas benignas, aspas/separadores/quebras/controles, máscara em cartões/tabelas/modal/arquivo bruto/exportação e nenhum envio externo de dados.
- **Esforço e risco:** pequeno/médio; compatibilidade CSV/Excel deve ser validada na planilha usada pela empresa.
- **Depende de decisão do dono?** Sim: D9/D11 — quais saídas serão compartilhadas e política de acesso/retenção. Escape e aviso correto não dependem de adiar essa decisão.

### M14 — Acessibilidade, tela pequena e decoração sem varredura geral

- **Melhoria:** corrigir grade móvel, foco/teclado e escopo das tarjas, sem redesenho geral.
- **Por que:** P21–P23:390px vira626px; modal não captura foco; feriado em qualquer célula de data pode rotular evento que não é jornada.
- **Como executar:** CSS com colunas adaptáveis e `min-width:0`; botões reais de ordenação com aria-sort, foco inicial/retorno/containment do modal e Escape; renderizar tarja a partir do modelo ou usar `data-dia/data-tipo` em regiões próprias. Enquanto existir observer, observar só região relevante, tratar nós adicionados e garantir idempotência/desconexão. Testar T14, teclado sem mouse, zoom200%,390/1366px e tabela de eventos com data de feriado. Medir observer em espelho grande antes de alegar travamento.
- **Esforço e risco:** pequeno/médio; baixo risco no cálculo, mas exige teste visual/teclado e preservar uso desktop.
- **Depende de decisão do dono?** Não para defeitos de interação; eventual reformulação visual fica fora do escopo.

## 7. Prioridade recomendada

### Fazer já, após avaliação e autorização de implementação

1. **M1 — pendências e bruto separado:** impede que horas desconhecidas virem débito final aparente; efeito direto na conferência salarial.
2. **M2 — inválidos não fecham saldo:** evita números baseados em31/02 ou25h e pareamento silencioso depois de rejeitar entrada.
3. **M7 — carga atual e filtro confiáveis:** a pessoa precisa estar conferindo o arquivo e o mês que escolheu, antes de discutir qualquer total.
4. **M3 + levantamento mínimo M6 — calendário e vínculo/escala vigentes:** resolve débitos inteiros em feriado/afastamento; exige decisões do dono/contabilidade antes de ativar tratamento.
5. **M4 — tolerância com horários previstos:** impacto recorrente em minutos de todos os dias; não lançar correção simplificada por saldo líquido.
6. **M11 — preservar dados na montagem:** impede perda da instalação/dados antes de distribuir qualquer atualização. Pode avançar em paralelo às regras de apuração.
7. **M9 — parar downgrade/redirecionamento inseguro e proteger acesso local; M10 — rotular auditoria não verificada:** risco de credenciais e falsa confiança, com parte das correções independentes da homologação completa.

### Fazer depois, ou antecipar conforme o uso real

8. **M5 — jornadas, ajustes e instantes:** antecipar para o primeiro grupo se existir turno noturno/ajuste relevante; até lá sinalizar como não suportado/pendente, sem saldo tratado.
9. **Restante M6 — cadastro histórico e cobertura:** necessário para fechamento confiável de todos os empregados; iniciar simples com2–3 pessoas validadas.
10. **M8 + homologação completa M10 — equipamento/AFD real:** executar assim que houver documentação e sessão acompanhada; manter carregamento manual enquanto integração não for comprovada.
11. **M13 — exportação e privacidade:** neutralização de fórmula e aviso de máscara podem ser correções pequenas antecipadas; demais controles seguem fluxo real de compartilhamento.
12. **M14 e M12 — interação, truncamento e medição:** aviso de limite e teclado são pequenos; otimização só com perfil. Antecipar móvel se o uso no celular for frequente.

### Não vale a pena agora

- Reescrever em framework, trocar linguagem ou introduzir servidor de ponto: não há ganho mensurado que compense migração e risco de enviar dados para fora.
- Implementar folha completa, dinheiro/encargos/DSR automático ou banco de horas universal: o objetivo é conferência; depende de regimes e decisões que não estão no AFD.
- Apagar duplicatas próximas, completar saídas ou zerar todo saldo até10min automaticamente: esconderia ambiguidade e criaria novos erros.
- Construir infraestrutura pesada de worker/virtualização sem medir: o ensaio de120mil marcações não mostra gargalo suficiente para justificar essa decisão isoladamente.

## 8. Dúvidas para o dono e decisões necessárias

| ID | Pergunta | Impacto de cada resposta |
|---|---|---|
| D1 | Nos feriados aplicáveis, jornada prevista deve ser0 e trabalho deve ser destacado como extra? Há folga compensatória/acordo aplicável? | Se0,07/09 deixa de gerar−09h e trabalho fica destacado. Se houver escala/compensação específica, ela precisa regra e vigência; não decidir pagamento em dobro apenas pela tarja. |
| D2 | Carnaval, Cinzas, Corpus Christi,24/12 e31/12 são folga total/parcial na Fortman? E28/10 é dia comum? | Adotar reduz previsão nas datas/horários aprovados; não adotar conserva jornada. Portaria federal não determina sozinha a folga da empresa. |
| D3 | Qual UF/município de cada estabelecimento e quais feriados locais/instrumentos coletivos se aplicam? | Sem isso, calendário é incompleto; com isso, é possível versionar fontes e evitar chamar facultativo de feriado obrigatório. |
| D4 | Dia com batida esquecida deve ficar “para conferir”, mantendo horas conhecidas e sem débito final? Quem aprova e justifica o tratamento? | Recomendado: pendência até comprovação. Exibir apenas bruto mantém compatibilidade, mas requer destaque e não pode ser confundido com desconto definitivo. Não inventar horário. |
| D5 | A contabilidade confirma a aplicação da tolerância CLT58§1º ao regime dos empregados e quais horários por marcação devem ser usados? | Aplicar exige horários/intervalos e regra homologada; manter bruto exige rótulo explícito. O sistema não deve oferecer ignorar obrigação aplicável como mera preferência. |
| D6 | Há banco de horas/acordo de compensação? Existem escalas diferentes, mudança no mês ou trabalho noturno? | Se sim, modelo por pessoa/vigência e jornadas é prioridade; se não, começar com calendário/escala comum confirmados, sem construir banco universal. |
| D7 | Quem fornece admissão/demissão, férias, atestados e folgas aprovadas? Há registros de intervalo e turnos pela madrugada? | Sem dados, ausência não pode virar falta confirmada; com dados, completar período fica mais confiável e auditável. |
| D8 | O fechamento é por mês civil/semana/intervalo de corte? Como interpretar “Entre primeira e última” e “Mesma jornada em todo dia com marcação”? | Definir cobertura evita meses parcialmente fechados e fins de semana debitados contra o rótulo. Semana que cruza mês precisa indicação de parcialidade no filtro. |
| D9 | Quais relatórios/CSV são usados pela contabilidade e quem pode conferir, aprovar e compartilhar dados brutos/mascarados? | Define exportação, trilha de tratamento e bloqueio de fechamento; máscara visual não pode prometer anonimização do AFD bruto. |
| D10 | Qual modelo/firmware Control iD e versão do PHP Desktop/Windows? É possível uma sessão acompanhada para homologar leitura, certificado, leiaute e paginação sem alterar o aparelho? | Permite confirmar API e confiança TLS. Sem isso, integração deve continuar marcada como não homologada e importação manual disponível. Não enviar senha na conversa. |
| D11 | O PC é compartilhado? Onde ficam instalação, dados e backups, quem acessa e qual prazo de retenção autorizado? | Define ACL/proteção local e recuperação. Atualização deve preservar dados em qualquer resposta; backup contém também acesso ao relógio e deve ser restrito. |
| D12 | Qual tamanho/período típico do AFD e qual maior arquivo real? Há uso no celular? | Orienta limites, avisos e otimização medida; não muda a necessidade de impedir truncamento silencioso e análise concorrente. |

### Situação desta entrega e próximos passos

Esta entrega contém **somente o relatório e propostas de testes dentro dele**. Não foram implantadas melhorias nem recalculados dados reais. A branch de proposta de núcleo não foi criada. O dono e o Claude Code podem escolher a ordem, confirmar as decisões e implementar em tarefa separada.

Restam verificações externas explicitamente pendentes: consulta direta às fontes oficiais após liberação da rede, documentação/modelo/firmware Control iD, pacote PHP Desktop Windows e validação acompanhada de um mês real. Esses itens não foram transformados em conclusões afirmativas por falta de acesso. As falhas reproduzidas de código permanecem demonstráveis sem essas dependências.
