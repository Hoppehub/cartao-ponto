# Prompt de revisão completa — Contador de horas (cartão ponto) da Fortman

> Use num **chat novo** do ChatGPT, com acesso ao repositório `Hoppehub/Fortman` no GitHub. Copie tudo a partir da
> linha abaixo. Este prompt substitui os anteriores (`PROMPT-REVISAO-CONTADOR-DE-HORAS.md` e
> `PROMPT-REVISAO-2-COMPLEMENTO.md`).

---

Você vai fazer uma **revisão técnica completa** do sistema de cartão ponto e conferência de horas da Fortman
(Fortconfecções LTDA): analisar o objetivo do sistema, conferir se a estrutura está bem feita, encontrar erros e
propor melhorias — dizendo, para cada uma, **por que** ela deve ser feita e **como** executá-la. Escreva em português
do Brasil, formal e sem gírias.

**Você não decide o que entra no sistema.** Nada do que você fizer pode ir para a branch `main` nem para as branches
dos aplicativos. Suas sugestões serão analisadas depois pelo Claude Code, que decide com o dono o que vale a pena
executar. As regras de onde gravar estão na seção 6.

## 0. PRIMEIRO PASSO OBRIGATÓRIO: confirme o local e espere a minha autorização

**Não analise, não leia o código a fundo e não grave nada antes de concluir este passo e receber a minha resposta.**

### 0.1 O local exato do trabalho

| Item | Valor exato |
|---|---|
| Plataforma | GitHub |
| Dono (organização/usuário) | `Hoppehub` |
| Repositório | **`Hoppehub/Fortman`** (privado) |
| Endereço | https://github.com/Hoppehub/Fortman |
| Branch do núcleo (somente leitura) | `leitor-afd` → https://github.com/Hoppehub/Fortman/tree/leitor-afd |
| Branch da versão desktop (somente leitura) | `main` → https://github.com/Hoppehub/Fortman/tree/main |
| Branch onde você grava o relatório | `gpt/revisao-contador-de-horas` (nova, criada a partir da `main`) |
| Branch onde você grava código proposto para o núcleo | `gpt/proposta-leitor-afd` (nova, criada a partir da `leitor-afd`) |
| Arquivo do relatório | `revisao/RELATORIO-GPT-CONTADOR-DE-HORAS.md` |

**Repositórios que NÃO são este trabalho** (não abra, não analise, não grave): `GITHUPPE/ftm`, `Hoppehub/ftm`,
`Hoppehub/Hero-cards`, `Hoppehub/Chest` e qualquer outro. O assunto aqui é **cartão ponto e conferência de horas**;
se o que você abriu fala de jogo, cartas, heróis ou outro tema, você está no lugar errado.

### 0.2 Confira estes arquivos

- Na branch `leitor-afd`: `ponto/js/afd_parser.js`, `ponto/js/leitor_afd.js`, `ponto/index.html` e
  `testes/test_afd_parser.js`.
- Na branch `main`: `complementos/ponto/relogio.php`, `complementos/ponto/js/relogio.js`,
  `complementos/ponto/js/feriados.js`, `ferramentas/montar_desktop.sh` e este prompt em
  `revisao/PROMPT-REVISAO-COMPLETA.md`.

### 0.3 Responda só com esta confirmação e pare

Sua primeira resposta deve ser **apenas** este bloco, preenchido com o que você realmente encontrou, e nada mais:

```
CONFIRMAÇÃO DO LOCAL
Repositório aberto: <nome completo que aparece no GitHub>
Branch leitor-afd encontrada: sim/não — último commit: <código curto e título>
Branch main encontrada: sim/não — último commit: <código curto e título>
Arquivos da 0.2 encontrados: <lista; marque os que faltarem>
Assunto do repositório: <uma frase>
Vou gravar somente em: gpt/revisao-contador-de-horas e, se houver código, gpt/proposta-leitor-afd
Não vou gravar em: main, leitor-afd nem em nenhuma outra branch existente
Posso criar branches e fazer commit neste repositório? sim/não
Aguardo a sua autorização para começar.
```

Se algum item não bater (outro repositório, branch ou arquivo faltando), diga exatamente o que encontrou e **não
siga**. Só comece a revisão depois que eu responder **"pode começar"**. Se eu corrigir algo, refaça a confirmação.

## 1. Onde está cada coisa no Git

Repositório: **`Hoppehub/Fortman`** (privado). Não existe código compartilhado entre as branches: cada aplicativo vive
na sua.

| Branch | O que contém | Papel na revisão |
|---|---|---|
| `leitor-afd` | O contador de horas em si (versão do site, publicada em `fortman.com.br/ponto/`) | **Foco principal** |
| `main` | Menu de entrada, a **versão para o computador** (pasta `desktop/`) e os **complementos só do desktop** (`complementos/`) | **Foco principal** |
| `orcamento-bordado` | Sistema BordaMax (PHP + SQLite, roda no PHP Desktop) | Só como contexto: é ele que fornece o motor da versão desktop |
| `catalogo-fortman` | Catálogo de atacado | Fora do escopo |
| `juros-compostos`, `tiktok-downloader` | Outras ferramentas | Fora do escopo |

### 1.1 Branch `leitor-afd` (o núcleo)

```
README.md                      documentação longa: regras de saldo, jornada, etiquetas, auditoria, leiautes
ponto/index.html               interface e estilos (≈30 KB)
ponto/js/afd_parser.js         analisador do AFD e regras de cálculo (≈70 KB) — expõe window.AFD
ponto/js/leitor_afd.js         interface: carga, abas, filtros, espelho, tabelas, CSV (≈91 KB)
ponto/js/nomes_padrao.js       lista fixa documento → nome (vem vazia; aviso de privacidade no topo)
ponto/exemplos/                três AFD fictícios (1.510, 671 e um com inconsistências)
testes/test_afd_parser.js      197 verificações do analisador:  node testes/test_afd_parser.js
testes/gerar_exemplos.js       gera os arquivos de exemplo
testes/carga.js                teste de carga
```

Funções expostas por `afd_parser.js` (objeto `AFD`): `TIPOS`, `camposDoRegistro`, `OPERACOES`, `analisar`,
`criarAnalise`, `separarLinhas`, `detectarLayout`, `montarEspelho`, `calcularSaldos`, `completarDias`, `ESCALAS`,
`somaDaEscala`, `lerListaDeNomes`, `normalizarListaDeNomes`, `validarCPF`, `validarPIS`, `validarCNPJ`, formatadores
(`formatarCPF`, `formatarPIS`, `formatarCNPJ`, `formatarDocumento`, `formatarDataBR`, `formatarMinutos`,
`formatarSaldo`), utilidades de data (`inicioDaSemana`, `fimDaSemana`, `nomeDoMes`, `ehFimDeSemana`, `minutosDoDia`,
`diaDaSemana`, `lerDataHoraISO`), `mascarar`, `chavePessoa`, `lerIdentificador`.

### 1.2 Branch `main` (versão para o computador e complementos)

```
index.html                         menu de entrada do site (3 opções: BordaMax, Contador de horas, Catálogo)
README.md                          explica a montagem do desktop e os complementos
ferramentas/montar_desktop.sh      GERA a pasta desktop/ a partir das branches orcamento-bordado, leitor-afd e catalogo-fortman
complementos/ponto/relogio.php     backend: conversa com o relógio de ponto Control iD da rede local
complementos/ponto/js/relogio.js   quadro "Baixar do relógio de ponto" no contador de horas
complementos/ponto/js/feriados.js  tarja "FERIADO" nos dias de feriado do espelho
desktop/                           RESULTADO GERADO (não editar à mão): programa Windows no PHP Desktop
  settings.json                    janela "Fortman"; index_files = inicio.html, index.php, index.html
  www/inicio.html                  menu (gerado a partir do index.html da raiz)
  www/*.php                        BordaMax (cópia da branch orcamento-bordado)
  www/ponto/                       contador de horas (cópia de leitor-afd + complementos)
  www/catalogo/                    catálogo
  LEIA-ME-FORTMAN.txt              instruções de montagem para o usuário
```

O script de montagem **não altera o código dos aplicativos**: copia as branches, troca o título da janela, põe o menu
como primeira tela, injeta um botão "← Menu" em cada aplicativo, copia `complementos/ponto/` para `desktop/www/ponto/`
e acrescenta `<script src="js/relogio.js">` e `<script src="js/feriados.js">` depois de `leitor_afd.js`.

## 2. Objetivo do sistema (o que ele precisa resolver)

A Fortman tem um **relógio de ponto Control iD** na rede interna, acessado hoje pelo Chrome em
`https://192.168.1.99`. Pela página do relógio a pessoa faz login e baixa o **AFD** (Arquivo-Fonte de Dados,
Portaria MTE 1.510/2009 e Portaria MTP 671/2021). O contador de horas existe para:

1. **Ler o AFD** e mostrar, por trabalhador, o **espelho de ponto**: batidas de cada dia, horas trabalhadas,
   jornada esperada e **saldo** (positivo = a favor do empregado; negativo = a repor), com fechamento por semana e
   por mês.
2. **Auditar o arquivo**: leiaute, NSR, CRC, CPF/PIS/CNPJ, períodos, registros inconsistentes.
3. Na **versão para o computador**, dispensar o Chrome: o quadro "Baixar do relógio de ponto" escolhe o **mês**, baixa
   o AFD direto do relógio, traz os **nomes** dos empregados e abre o espelho já filtrado naquele mês.
4. Marcar com a tarja **FERIADO** os dias de feriado nacional e ponto facultativo.

Tudo roda localmente: no site, o arquivo é lido no navegador e nada sobe para servidor; no desktop, o único tráfego
de rede é entre o computador e o relógio.

### 2.1 Regras de negócio implementadas (confirme no código)

- **Jornada contratual por dia da semana** (`AFD.ESCALAS`). Padrão: 44h — 9h de segunda a quinta e 8h na sexta
  (entrada 06:55, saída 16:55 e 15:55 na sexta, 1h de intervalo). Há escalas de 44h, 40h, 36h, 30h, "mesma jornada
  em todo dia" e personalizada.
- **Saldo do dia** = trabalhado − previsto. Pareamento das batidas na ordem (1ª com 2ª, 3ª com 4ª...).
- **Dias sem marcação** são completados (`completarDias`) e classificados: FALTA (dia com jornada e sem batida,
  desconta a jornada inteira); SÁBADO/DOMINGO (sem jornada e sem batida, saldo zero); HORA EXTRA SÁBADO/DOMINGO (sem
  jornada e com batida, tudo vira saldo positivo). Opções: entre a 1ª e a última marcação (padrão), período todo do
  arquivo, ou não completar.
- **Limitações documentadas no README da branch `leitor-afd`**: não aplica a tolerância de 5/10 minutos da Portaria
  671, não calcula adicional noturno, não trata jornada que vira o dia, não conhece banco de horas nem acordo de
  compensação, não distingue falta de folga, férias ou atestado, e a escala vale para todos os trabalhadores.

### 2.2 Complemento `relogio.php` + `relogio.js` (só no desktop)

- `relogio.php` (ações `?acao=config`, `salvar`, `baixar`):
  - Faz login em `POST /login.fcgi` com `{login, password}`, recebe `session`.
  - Baixa o AFD em `POST /get_afd.fcgi?session=...` com `{"initial_date": {"day": 1, "month": M, "year": A}}`;
    opcionalmente `&mode=671`.
  - Lê os usuários do relógio em `POST /load_users.fcgi?session=...`, em páginas `{"limit": 100, "offset": N}`,
    pegando `name`, `pis` e `cpf` (a mesma lista da página `https://192.168.1.99/#page=users`, com NOME e PIS).
  - Sai em `POST /logout.fcgi`.
  - Responde `{afd: base64, nomes: [{doc, nome}]}`.
  - Tenta HTTPS e depois HTTP; desliga a verificação do certificado (o relógio usa certificado autoassinado).
  - Só aceita IP de rede privada (porta opcional), para não virar ponte para a internet.
  - Exige o cabeçalho `X-Relogio: 1` nos POST.
  - Guarda IP, usuário, senha e leiaute em `dados/relogio.json` (pasta de dados do programa), **em texto puro**.
  - Usuário e senha **nunca voltam para a tela**; campo em branco ao salvar mantém o valor guardado.
- `relogio.js` monta o quadro no topo da área de carga (`#secaoCarga .zona-acoes`), entrega a lista de nomes ao campo
  `#entradaNomes` e o AFD ao campo `#entradaArquivo` (via `DataTransfer` + evento `change`, como se a pessoa tivesse
  escolhido os arquivos) e, quando o espelho aparece, preenche os filtros `#fDataIni`/`#fDataFim` com o mês
  (tentando por até 10 segundos). O relógio entrega do dia 1 do mês **em diante**; quem corta o resto é o filtro.
- **Importante:** essa integração depende de IDs e classes internas do leitor (`entradaArquivo`, `entradaNomes`,
  `fDataIni`, `fDataFim`, `secaoCarga`, `conteudo`, `.dia-faixa`, `.dia-semana`). Não há API pública entre o leitor e
  os complementos.
- A integração foi testada apenas contra um **relógio simulado**, não contra o aparelho real. A existência de
  `mode=671` e a paginação de `load_users.fcgi` no firmware da Fortman **não foram confirmadas**.

### 2.3 Complemento `feriados.js` (só no desktop)

- Lista fixa: 01/01, 21/04, 01/05, 07/09, 12/10, 28/10 (facultativo), 02/11, 15/11, 20/11 (Lei 14.759/23), 24/12
  (facultativo), 25/12, 31/12 (facultativo).
- Móveis pela Páscoa (algoritmo de Meeus/Jones/Butcher): Carnaval (−48 e −47, facultativo), Cinzas (−46, facultativo
  até 12h), Paixão de Cristo (−2), Corpus Christi (+60, facultativo).
- Pós-processa o DOM com `MutationObserver` em `#conteudo`: acrescenta a tarja nas `.dia-faixa` e nas células `<td>`
  que contêm só a data.
- **Só marca o dia: não muda saldo nem jornada.** Um feriado continua esperando a jornada normal, então feriado sem
  batida aparece como FALTA e feriado trabalhado não vira hora extra. Não há feriados estaduais nem municipais.

### 2.4 O que já foi verificado e os riscos conhecidos

Uma análise anterior, feita pelo Claude Code, chegou às conclusões abaixo. **Confirme ou corrija cada uma no código**;
não as aceite por estarem escritas aqui.

- **A aritmética do dia está correta.** Exemplo conferido à mão: batidas 07:58, 12:04, 13:03 e 17:05 dão
  4:06 + 4:02 = 8:08 trabalhadas; contra 9:00 previstas, saldo −0:52, que é o que a tela mostra.
- **O pareamento é o mesmo de uma biblioteca de referência.** A biblioteca pública `convenia/afd-reader` (PHP,
  https://github.com/convenia/afd-reader) foi lida para comparação: ela **não calcula horas** (só lê o arquivo, agrupa
  por PIS e por dia e rotula as batidas em Entrada/Saída alternadas, em `getByUserAfd()` de `src/AfdReader.php`) e
  só lê o leiaute 1.510. A única regra em comum, o pareamento 1ª com 2ª, 3ª com 4ª, dá o mesmo resultado nas duas;
  a diferença é que o nosso leitor ordena as batidas por horário (`montarEspelho()` em `afd_parser.js`) e a dela segue
  a ordem do arquivo. Portanto, **não existe uma segunda opinião automática sobre o saldo**: a revisão das regras
  precisa ser sua.
- **Riscos conhecidos que mudam o saldo**, em ordem de impacto no salário:
  1. **Feriado espera jornada cheia.** Feriado sem batida vira FALTA e desconta o dia inteiro; feriado trabalhado
     conta como dia comum, sem o tratamento de hora extra (normalmente 100%). A tarja de `feriados.js` só marca o dia.
  2. **Sem tolerância.** CLT art. 58 §1º: variações de até 5 minutos por marcação, no máximo 10 minutos por dia, não
     são descontadas nem computadas como extra; passando de 10 minutos, conta a diferença inteira (TST, Súmula 366).
     O sistema conta todo minuto: quem trabalhou 8:57 aparece com −0:03 quando o certo seria zero.
  3. **Batida esquecida apaga horas trabalhadas.** Com número ímpar de batidas, a última fica sem par e o trecho
     conta **zero** (`montarEspelho()`: o laço `for (i = 0; i + 1 < horarios.length; i += 2)`). Quem esqueceu de
     bater a saída da tarde perde a tarde inteira no saldo; a etiqueta "marcação ímpar" avisa, mas o saldo já saiu
     negativo.
  4. **Batida duplicada desloca todos os pares do dia.** Se a pessoa bate duas vezes seguidas, a saída vira entrada
     e o resto do dia é pareado errado. Verifique se há algum filtro de batidas repetidas em poucos minutos.
  5. **Jornada que passa da meia-noite** é partida em dois dias, e os dois perdem horas.
  6. **Atestado, férias e folga combinada aparecem como FALTA** (o AFD não traz essa informação).
  7. **Uma escala só para todos os empregados.**
  8. **O saldo é minuto bruto, não dinheiro**: não há percentual de hora extra (50%/100%), adicional noturno nem
     reflexo no DSR.
  9. **Registros de ajuste de relógio** (tipo 4 no leiaute 1.510) e marcações com horário fora de ordem: confirme se
     podem alterar a ordenação e o pareamento.

## 3. Como rodar e conferir

1. Testes do analisador (branch `leitor-afd`): `node testes/test_afd_parser.js` (devem passar 197 verificações).
2. Leitor no navegador: abra `ponto/index.html` direto do disco, ou `npx http-server .` e acesse `/ponto/`. Os botões
   "Exemplo 1.510/2009" e "Exemplo 671/2021" carregam AFD fictícios.
3. Versão desktop (branch `main`): `bash ferramentas/montar_desktop.sh` regenera `desktop/`. Para simular o programa,
   rode `php -S 127.0.0.1:8080` dentro de `desktop/www` e abra `/inicio.html`. Sem um relógio na rede, o quadro de
   download mostra o erro de conexão — para exercitá-lo, crie um servidor falso que responda `login.fcgi`,
   `get_afd.fcgi`, `load_users.fcgi` e `logout.fcgi`. Note que `relogio.php` recusa `127.0.0.1` por não ser IP de rede
   privada.
4. Não há testes automatizados para `relogio.php`, `relogio.js` nem `feriados.js`.

## 4. O que você deve analisar

Faça a análise nesta ordem e cubra todos os itens. Em cada um, diga o que está bom, o que está errado e o que falta.

### 4.1 Objetivo

- O sistema cumpre o objetivo da seção 2? Onde ele não cumpre ou cumpre só em parte?
- O resultado (saldo, faltas, horas extras) é confiável para a conferência que a Fortman faz? Em que situações reais ele
  daria um número enganoso? (Exemplos a considerar: feriado, folga, férias, atestado, troca de escala no meio do mês,
  batida esquecida, batida duplicada, jornada que passa da meia-noite, empregado admitido ou demitido no mês.)
- Compare com o que a legislação trabalhista brasileira pede para controle de jornada: Portaria MTP 671/2021
  (tolerância de até 5 minutos por marcação e 10 minutos por dia; leiaute do AFD), CLT art. 58 §1º, art. 59 (horas
  extras e banco de horas), art. 66 (interjornada de 11h), art. 71 (intervalo intrajornada), art. 73 (adicional
  noturno), art. 70 e Lei 605/1949 (feriados e DSR). Diga o que o sistema deveria considerar e não considera. Deixe
  claro que é conferência, não folha de pagamento, e não invente obrigações.

### 4.2 Estrutura e qualidade do código

- Organização em `afd_parser.js` (regras) e `leitor_afd.js` (tela): a separação está respeitada? Há regra de negócio
  na camada de tela?
- Leitura dos dois leiautes (1.510 e 671): tamanhos de campo, CRC, detecção automática de leiaute, codificação
  (UTF-8 × Windows-1252), linhas malformadas, arquivo grande (desempenho com dezenas de milhares de linhas).
- Cálculo do saldo: pareamento das batidas, número ímpar de batidas, fechamento de semana (qual dia começa a semana?)
  e de mês, fuso e horário de verão nas datas ISO do leiaute 671.
- Qualidade geral: nomes, duplicação, funções longas, tratamento de erro, acessibilidade, comportamento em tela de
  celular.
- Testes: o que os 197 testes cobrem e quais regras importantes **não** estão cobertas.

### 4.3 Versão desktop e complementos

- A estratégia de **gerar** `desktop/` por script, copiando branches e injetando scripts, é sustentável? Quais riscos
  (por exemplo, uma mudança de ID ou classe no leitor quebrar `relogio.js` e `feriados.js` sem aviso)? Qual seria uma
  integração mais robusta?
- `relogio.php`: confira a segurança (validação de IP, cabeçalho `X-Relogio`, verificação TLS desligada, senha em
  texto puro em `dados/relogio.json`, mensagens de erro, tempo limite), a robustez (relógio desligado, sessão
  expirada, AFD vazio, resposta em JSON de erro, firmware que ignora `limit/offset`) e a compatibilidade com o PHP do
  PHP Desktop (extensões `curl`/`openssl`).
- Confira a **API Control iD** contra a documentação oficial da Control iD para REP (iDClass): nomes dos endpoints,
  formato de `initial_date`, existência de data final, parâmetro do leiaute 671, campos de `load_users` (`name`,
  `pis`, `cpf`, `registration`), paginação. Aponte o que está certo, o que está errado e o que não dá para afirmar.
- `relogio.js`: a espera de até 10 s pelos filtros, o uso de `DataTransfer`, o que acontece se o leitor mudar.
- `feriados.js`: confira as datas de 2026 contra a tabela oficial, o cálculo da Páscoa, o desempenho do
  `MutationObserver` em espelhos grandes, e se marcar `<td>` só pelo texto da data pode marcar coisas erradas.

### 4.4 Verificação independente dos números

Não confie só no código: **recalcule à mão**. Monte pelo menos estes casos (com o AFD de exemplo ou com linhas
fictícias no leiaute 1.510), calcule o resultado correto segundo a lei e compare com o que o sistema produz
(`AFD.montarEspelho`, `AFD.completarDias` e `AFD.calcularSaldos`, ou a tela):

1. Dia normal com 4 batidas, saldo positivo e negativo.
2. Diferença de 3, 8, 10 e 11 minutos no dia (tolerância).
3. Três batidas no dia (saída esquecida).
4. Batida duplicada com 1 minuto de diferença.
5. Entrada às 22:00 e saída às 06:00 do dia seguinte.
6. Feriado sem batida e feriado trabalhado (por exemplo, 07/09/2026, segunda-feira).
7. Sábado e domingo trabalhados na escala padrão.
8. Empregado que começa a bater no dia 15 do mês (opção "Entre a 1ª e a última marcação").
9. Fechamento de semana que cruza a virada do mês.

Para cada caso, mostre: as batidas, o resultado do sistema, o resultado correto e a diferença. Transforme cada
divergência em um **teste automatizado** sugerido para `testes/test_afd_parser.js`, no mesmo estilo dos existentes.

Proponha também um **protocolo de validação com dados reais**: um mês fechado, dois ou três empregados, comparando o
total do sistema com o cálculo da contabilidade ou com o relatório do próprio relógio, e como interpretar cada tipo de
diferença.

### 4.5 Segurança e privacidade

- O AFD e a lista de nomes trazem CPF, PIS e nome de pessoas reais (LGPD). Confira onde esses dados ficam, o que é
  publicado no site (`nomes_padrao.js`), o que fica gravado no computador e se algo vaza para terceiros (fontes e
  ícones carregados de `fonts.googleapis.com` e `cdnjs.cloudflare.com`).
- Riscos de injeção de HTML nas telas (nomes e campos do AFD inseridos no DOM).

## 5. Formato do relatório

Entregue, nesta ordem:

1. **Confirmação do local** (o bloco da seção 0.3, já autorizado).
2. **Resumo executivo** (até 10 linhas): o sistema cumpre o objetivo? Quais são os 3 problemas mais importantes para o
   salário das pessoas?
3. **Confirmação ou correção** de cada conclusão da seção 2.4, uma por uma, com a referência no código.
4. **Problemas encontrados** (erros que produzem resultado errado ou quebram o uso), em uma tabela:
   `# | Gravidade (crítica/alta/média/baixa) | Onde (arquivo:linha ou função) | O que acontece | Como reproduzir`.
5. **Verificação independente** (seção 4.4): a tabela dos casos calculados à mão (batidas, resultado do sistema,
   resultado correto, diferença), os testes automatizados sugeridos e o protocolo de validação com dados reais.
6. **Melhorias sugeridas**, uma por bloco, numeradas (M1, M2...), sempre com os cinco campos:
   - **Melhoria:** o que mudar.
   - **Por que:** o problema real que ela resolve, com exemplo concreto (de preferência um caso com datas e horas) e,
     quando couber, a base legal.
   - **Como executar:** passo a passo técnico — quais arquivos e funções mudar, a estrutura de dados nova (se
     houver), como manter a compatibilidade e **quais testes acrescentar**.
   - **Esforço e risco:** pequeno/médio/grande, e o que pode quebrar.
   - **Depende de decisão do dono?** Sim/não; se sim, qual pergunta da lista do item 8.
7. **Prioridade**: as melhorias em ordem recomendada, separando "fazer já", "fazer depois" e "não vale a pena agora",
   com uma frase de justificativa cada. O critério principal é o impacto no saldo de horas, e portanto no salário.
8. **Dúvidas para o dono**: decisões que dependem da empresa, cada uma com o impacto de cada resposta. No mínimo:
   - Feriado deve esperar zero hora, com o que for trabalhado contado como hora extra?
   - Os pontos facultativos (Carnaval, Cinzas, Corpus Christi, 24/12, 31/12) são folga na Fortman?
   - A tolerância de 5/10 minutos deve ser aplicada?
   - Dia com batida esquecida deve ficar marcado "para conferir" em vez de entrar como saldo negativo?
   - Há banco de horas ou acordo de compensação? Há empregados com escala diferente ou trabalho noturno?

## 6. Onde gravar o que você fizer (regras obrigatórias)

- **Nunca** faça commit, push ou merge na `main`, na `leitor-afd` nem em nenhuma outra branch que já exista. Não abra
  pull request e não aprove nada.
- Crie a branch **`gpt/revisao-contador-de-horas`** a partir da `main` e grave nela o relatório completo em
  **`revisao/RELATORIO-GPT-CONTADOR-DE-HORAS.md`**. Se não tiver permissão para criar branch, entregue o relatório
  inteiro na conversa.
- Código é **opcional** e serve só como proposta. Se quiser mostrar uma melhoria em código:
  - para o núcleo do leitor (`ponto/...`, `testes/...`), crie a branch **`gpt/proposta-leitor-afd`** a partir da
    `leitor-afd`;
  - para a versão desktop e os complementos (`complementos/...`, `ferramentas/...`), use a própria
    `gpt/revisao-contador-de-horas`;
  - nunca edite a pasta `desktop/` (ela é gerada pelo script);
  - cada commit deve citar a melhoria (por exemplo, `M3: aplica a tolerância de 5/10 minutos`);
  - rode `node testes/test_afd_parser.js` antes de cada commit na `gpt/proposta-leitor-afd`; nunca apague nem
    enfraqueça um teste existente para ele passar;
  - informe no relatório quais melhorias têm código proposto e em qual branch.
- Não mexa nos dados de ninguém: não grave AFD real, nomes, CPF ou PIS no repositório.

## 7. Regras para a revisão

- Não proponha reescrever tudo nem trocar de tecnologia sem um motivo concreto e mensurável.
- Separe fato (confirmado no código ou na documentação) de opinião e de suposição.
- Não sugira enviar dados de ponto para servidores externos: tudo deve continuar rodando localmente.
- Considere o usuário real: uma empresa de confecção, sem equipe de TI, usando Windows; o programa precisa continuar
  simples de instalar e de usar.
- Quando citar a legislação, cite o artigo; quando não tiver certeza, diga.
- Lembre que é conferência de jornada, não folha de pagamento: não invente obrigações legais.
