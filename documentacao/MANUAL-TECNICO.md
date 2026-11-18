# Leitor de AFD

Leitor e auditor do **Arquivo-Fonte de Dados (AFD)** do ponto eletrônico, nos leiautes da
**Portaria MTE 1.510/2009** (REP-C clássico) e da **Portaria MTP 671/2021** (REP-C, REP-A e REP-P).

Tudo roda no navegador: o arquivo é lido em memória, nenhum byte é enviado para servidor algum —
o que importa quando o AFD carrega CPF, PIS e a jornada de pessoas reais.

## Como a tela se organiza

A interface é um painel: **barra lateral** à esquerda com a navegação, **busca** no topo e o conteúdo no
centro. Ao abrir um AFD a ferramenta vai direto para o **espelho de ponto** — é o que se usa no dia a dia;
o restante fica no grupo *Números para nerd* da lateral: resumo, marcações, trabalhadores, empregador e
REP, relógio e eventos, inconsistências e arquivo bruto. O rodapé da lateral mostra o arquivo aberto, com
um botão para trocar.

Acima do conteúdo, quatro cartões resumem o período: trabalhadores, horas trabalhadas, saldo (com pílula
*a favor* / *a repor*) e auditoria do arquivo. A busca do topo vale para a seção aberta.

O tema escuro é o padrão; o claro entra pela preferência do sistema ou pelo botão no topo, e a escolha fica
guardada no navegador.

No cartão de cada pessoa, o nome aparece ao lado do documento quando o arquivo traz o cadastro (registro
tipo 5). Quando não traz — o que é comum em AFD de REP-C — fica a nota *nome não informado no arquivo*,
e aí entra a lista de nomes.

### Nomes fixos da instalação

`ponto/js/nomes_padrao.js` guarda uma lista de `documento: nome` que a ferramenta usa sozinha, sem
depender de carregar arquivo:

```js
window.LEITOR_AFD_NOMES = {
    '012341643576': 'ELIS REGINA DE BRAGA',
    '023730884359': 'AUDENIZIA RIBEIRO NUNES'
};
```

A chave pode ser PIS ou CPF, com ou sem pontuação e com ou sem zeros à esquerda. O arquivo vem vazio no
repositório: preencha na sua instalação. **O conteúdo dele vai junto com a página** — em endereço público,
nome e documento ficam legíveis por quem abrir o site. Para uso interno, proteja a pasta `/ponto` por senha
no painel da hospedagem, ou deixe a lista vazia e use o botão abaixo a cada sessão.

Cuidado ao atualizar a ferramenta: extrair um pacote novo por cima substitui esse arquivo. Guarde uma cópia
da sua lista.

### Lista de nomes carregada na hora (opcional)

*Carregar lista de nomes* aceita um arquivo que case documento com nome, para quando o AFD não traz o
cadastro dos empregados. Serve tanto o **export de usuários do REP** quanto qualquer arquivo de duas
colunas:

```
pis;nome;administrador;matricula;rfid;codigo;senha;barras;digitais
12065478502;ANA PAULA RODRIGUES SOUZA;0;53;53;53;;0000000053;SUNSUzIx...

# ou, simplesmente:
12065478502;Ana Paula Rodrigues Souza
11144477735;Carlos Eduardo Martins
```

Separador `;`, `,` ou tabulação, detectado sozinho; cabeçalho é opcional. O documento pode ser PIS ou CPF —
o casamento ignora zeros à esquerda, e **CPF que perdeu o zero no export** (10 dígitos) é recomposto.
Linhas sem documento válido são ignoradas, o que já descarta os usuários administrativos do relógio.
A mesma pessoa cadastrada duas vezes, uma por PIS e outra por CPF, é encontrada pelos dois caminhos.

A lista carregada complementa a fixa e vence em caso de conflito. O nome do próprio AFD sempre tem
prioridade sobre as duas; elas só preenchem quem ficou sem nome, e esses aparecem com
a marcação *nome vindo da lista carregada* ao passar o cursor. A lista vale enquanto a página estiver
aberta — não fica gravada no navegador, e como todo o resto, não sai do seu computador.

### Duas empresas no mesmo relógio (opcional)

Quando duas empresas usam o mesmo relógio, o AFD não diz de qual empresa é cada colaborador. O botão
**Carregar lista de empresas** lê uma planilha salva como CSV, com uma linha por colaborador:

```
documento;empresa;cnpj
120.65478.50-2;FORTMAN CONFECCOES LTDA;11.222.333/0001-81
209.87654.32-7;BORDAMAX BORDADOS LTDA;11.444.777/0001-61
```

O documento pode ser PIS ou CPF, com ou sem pontuação; o CNPJ é opcional e basta numa linha de cada empresa.
A lista fica guardada no navegador (ou no programa do computador) até ser descartada pelo **×**. Com ela, o
espelho ganha o filtro **Empresa**, cada cartão mostra a empresa do colaborador e o relatório sai separado por
empresa. Sem a lista, vale a empresa do cabeçalho do AFD (caso de um relógio por empresa).

### Relatório por colaborador

O botão **Relatório por colaborador**, no espelho, abre o diálogo de impressão com **um colaborador por página e
por mês**, em ordem de empresa e de nome — para imprimir ou escolher *Salvar como PDF*. Cada página traz a empresa
(nome, CNPJ e REP), o colaborador, o mês, a jornada, os dias com marcações, trabalhado, previsto, horas práticas e
situação, o total de cada semana, os totais do mês e as linhas de assinatura. Os números são os mesmos da tela (o
relatório usa o mesmo espelho e o mesmo `calcularSaldos`) e seguem os filtros em vigor (período, empresa,
trabalhador). Se o mês não couber numa folha A4, a letra da página é reduzida (até 5,5 pt) para caber.

## O que a ferramenta entrega

| Aba | Conteúdo |
|---|---|
| **Resumo** | Empregador, REP, período declarado x período com marcações, contagem por tipo de registro, gráfico de marcações por dia e placar da auditoria |
| **Marcações** | Todas as batidas (tipos 3, 7 e 8) com NSR, data, dia da semana, hora, documento, nome, CRC-16/hash |
| **Espelho de ponto** | Batidas agrupadas por trabalhador e dia, em **cartões** (documento em destaque, uma faixa por data e as batidas do dia como fichas) ou em **tabela**; com total trabalhado, **saldo de horas** do dia, fechamento por semana e por mês, e aviso de marcação ímpar |
| **Trabalhadores** | Quem aparece no arquivo, com ou sem cadastro (tipo 5), quantidade de marcações e primeira/última batida |
| **Empregador e REP** | Cabeçalho detalhado e registros tipo 2 (inclusão/alteração de empregador) |
| **Relógio e eventos** | Ajustes do relógio (tipo 4) e eventos sensíveis do REP (tipo 6) |
| **Inconsistências** | Apontamentos de auditoria classificados em erro, alerta e observação |
| **Arquivo bruto** | Linha a linha, com inspetor que abre cada registro campo a campo e mostra as posições |

No espelho, o botão **Exibição** alterna entre cartões e tabela, e a escolha fica guardada no navegador
para a próxima visita. Nas duas, cada trabalhador é separado do seguinte: na tabela, por uma faixa com o
documento, o nome e o total do período, e por um traço lateral que alterna de cor a cada pessoa; nos
cartões, pelo próprio cartão e pelo mesmo traço. Ordenar a tabela por uma coluna que embaralhe as pessoas
(total trabalhado, por exemplo) desfaz as faixas e devolve o zebrado — ordenar por trabalhador ou por
documento mantém o agrupamento. Cada ficha de horário mostra o NSR do registro ao passar o cursor, e a última ficha
de um dia com número ímpar de batidas aparece com contorno tracejado.

### Saldo de horas: HORAS PRÁTICAS e HORA FECHADA

Cada dia mostra **dois** saldos, lado a lado, nos cartões, nos fechamentos de semana e de mês, na tabela, no
CSV e no relatório:

- **HORAS PRÁTICAS** — o relógio puro: trabalhado − previsto, minuto a minuto, sem nenhum abono. Entrou 3
  minutos antes, +00:03.
- **HORA FECHADA** — o saldo depois da tolerância legal (CLT art. 58, §1º, com a leitura da Súmula 366 do
  TST). Cada batida é comparada com o horário previsto dela (06:55, 11:55, 12:55 e 16:55; 15:55 na sexta).
  Se **toda** batida variou até **5 minutos** e a soma das variações do dia é de até **10 minutos**, a hora
  fechada é **00:00**. Se **qualquer** batida passou de 5 minutos, ou a soma passou de 10, vale a diferença
  **inteira** (não se abate a tolerância).

| Batidas (segunda) | Horas práticas | Hora fechada |
|---|---|---|
| 06:52 11:55 12:55 16:55 | +00:03 | 00:00 |
| 06:50 11:55 12:55 17:00 | +00:10 | 00:00 |
| 06:50 11:56 12:55 17:00 | +00:11 | +00:11 |
| 06:55 11:55 12:55 17:03 | +00:08 | +00:08 (uma batida variou 8 min) |
| 07:00 11:54 12:55 16:50 | −00:11 | −00:11 |

A hora fechada só é calculada na escala que tem horários previstos por batida (a padrão). Nas outras, aparece
"—" com a explicação. Fim de semana e feriado trabalhados entram inteiros nas duas; falta desconta a jornada
inteira nas duas.

### Dias PARA CONFERIR

O sistema não inventa batida nem apaga batida. Quando o dia não permite fechar o saldo com segurança, ele fica
**PARA CONFERIR**, com o motivo escrito: marcação ímpar (batida esquecida), marcação repetida (duas batidas a 5
minutos ou menos uma da outra), data ou hora inválida (31/02, 25:00), ajuste do relógio naquele dia
(registro tipo 4) ou quantidade de batidas diferente da jornada (por exemplo 2 de 4). As horas conhecidas
continuam em HORAS PRÁTICAS; a HORA FECHADA fica vazia e o dia sai da soma fechada, que mostra quantos dias
ficaram de fora.

### Feriados e pontos facultativos

O calendário está no próprio cálculo, com as datas móveis pela Páscoa:

- **Feriado nacional** (01/01, Paixão de Cristo, 21/04, 01/05, 07/09, 12/10, 02/11, 15/11, 20/11, 25/12):
  jornada prevista **zero**. Sem batida, não há débito (etiqueta FERIADO); com batida, **todo** o tempo é
  hora extra (HORA EXTRA FERIADO).
- **Ponto facultativo** (Carnaval segunda e terça, Quarta-feira de Cinzas, Corpus Christi, 28/10, 24/12,
  31/12): **dia normal de trabalho** na Fortman, só marcado em destaque no dia. Sem batida, é FALTA.
- Feriados estaduais e municipais: `window.LEITOR_AFD_FERIADOS_LOCAIS = { '07-09': 'Nome', '2026-06-13': 'Nome' }`
  num script carregado antes do leitor.

### Alertas de jornada

Sem mexer no saldo, o dia ganha um aviso quando há mais de 12h trabalhadas, intervalo menor que 1h em jornada
de mais de 6h (ou sem intervalo registrado), intervalo menor que 15 min em jornada de 4h a 6h (CLT art. 71)
ou menos de 11h de descanso desde a saída do dia anterior (CLT art. 66).

### Jornada contratual

O limite constitucional é de 8h por dia **e 44h por semana** (CF, art. 7º, XIII), e são duas contas
diferentes: 8h em cinco dias fecham 40h, não 44h. Por isso a jornada é uma escala por dia da semana, não um
número único. As opções prontas:

| Escala | Distribuição | Semana |
|---|---|---|
| **44h — 06:55 às 16:55, sexta até 15:55 (1h de almoço)** (padrão, com horários por batida) | 9h × 4 + 8h | 44:00 |
| **44h — 8h48 de segunda a sexta** | 8h48 × 5 | 44:00 |
| **44h — 8h de segunda a sexta e 4h no sábado** | 8h × 5 + 4h | 44:00 |
| 40h — 8h de segunda a sexta | 8h × 5 | 40:00 |
| 36h — 7h12 de segunda a sexta | 7h12 × 5 | 36:00 |
| 30h — 6h de segunda a sexta | 6h × 5 | 30:00 |
| Mesma jornada de segunda a sexta | valor único | — |
| Personalizada por dia da semana | sete campos | soma exibida |

A escala padrão corresponde à jornada de entrada às 06:55 com saída às 16:55 (e 15:55 na sexta), com uma
hora de intervalo: 9h trabalhadas de segunda a quinta e 8h na sexta, fechando as 44h nos cinco dias.

O total semanal da escala escolhida aparece ao lado do seletor, então dá para conferir de imediato se ela
fecha as 44h. Dia sem jornada prevista na escala (domingo, ou sábado nas escalas de segunda a sexta)
aparece como *sem jornada prevista* e o que for trabalhado entra inteiro como saldo positivo.

### Cada dia recebe uma etiqueta

O AFD só registra quem bateu, então o dia vazio não existe no arquivo. A ferramenta completa o período e
classifica cada dia pela escala:

| Situação | Etiqueta | Saldo |
|---|---|---|
| Dia com jornada prevista e marcação | — (as batidas) | trabalhado − previsto |
| Dia com jornada prevista e **sem** marcação | **FALTA** | desconta a jornada inteira |
| Dia **sem** jornada prevista e sem marcação | **SÁBADO** / **DOMINGO** (o nome do dia) | zero |
| Dia **sem** jornada prevista **com** marcação | **HORA EXTRA SÁBADO** / **DOMINGO** | tudo entra como saldo positivo |

A regra segue a escala e o calendário: se você escolher a escala *8h de segunda a sexta e 4h no sábado*, o
sábado passa a ter jornada prevista — aí sábado vazio vira FALTA e sábado trabalhado é dia normal. Feriado
nacional nunca tem jornada prevista (etiqueta FERIADO ou HORA EXTRA FERIADO).

O campo *Dias sem marcação* controla a varredura:

| Opção | O que faz |
|---|---|
| **Entre a 1ª e a última marcação** (padrão) | Completa só a janela em que a pessoa aparece no arquivo. Quem foi admitido no meio do mês não acumula falta antes de entrar — e quem parou de bater antes do fim do período também não. |
| Em todo o período do arquivo | Varre o período declarado no cabeçalho para todo mundo. Use quando o quadro está estável no mês inteiro. |
| Não completar os dias | Volta ao comportamento anterior: só os dias com marcação. |

### Fechamento de semana e de mês

Ao fim de cada semana e de cada mês entra um bloco com as métricas do período — trabalhadas, esperadas,
dias trabalhados, faltas, dias extras — e o **saldo** em destaque, com moldura verde ou vermelha.

Como o AFD **não distingue falta de folga, férias ou atestado**, tudo isso aparece como falta. Trate a
marcação como ponto de partida da conferência, não como veredito: a justificativa está fora do arquivo.

O que o AFD **não** informa e que por isso fica de fora da conta:
- **A escala não conhece acordo de compensação nem banco de horas.** O intervalo mínimo vira alerta, não
  desconto.
- **A escala vale para todo mundo.** Quem cumpre horário diferente do restante da equipe é comparado com a
  mesma jornada; nesse caso, filtre por trabalhador e troque a escala antes de olhar o saldo dele.

O cálculo pareia as batidas do dia na ordem (1ª com 2ª, 3ª com 4ª...). Não calcula adicional noturno nem
jornada que vira o dia, nem percentuais de hora extra ou DSR — é conferência, não folha.

### Conferência do cálculo

Além dos testes do analisador, `testes/test_oraculo.js` gera meses aleatórios de AFD e compara, dia a dia, o
resultado do programa com uma segunda calculadora escrita do zero (com os feriados digitados numa tabela, sem
reaproveitar o código do núcleo). Ela detectou todos os 17 erros plantados de propósito para testá-la (um
minuto a mais na tolerância, um feriado deslocado um dia, a batida repetida com limite de 4 ou 6 minutos...).
`testes/test_navegador.js` confere que tela, relatório e CSV mostram os mesmos totais. Os três rodam no GitHub
a cada envio.

Além disso: busca e filtros (período, trabalhador, tipo de registro, gravidade), ordenação por coluna,
exportação em CSV (separador `;`, com BOM, abre direto no Excel pt-BR), cópia para a área de transferência,
máscara de documentos para compartilhar relatório sem expor CPF/PIS, tema claro/escuro e impressão.

## Auditoria: o que é verificado

| Código | Gravidade | Verificação |
|---|---|---|
| `CABECALHO_AUSENTE` / `CABECALHO_DUPLICADO` / `CABECALHO_FORA_DO_INICIO` | erro/alerta | Registro tipo 1 presente, único e na primeira linha |
| `CABECALHO_NSR` | alerta | NSR do cabeçalho igual a `000000000` |
| `DOC_EMPREGADOR_INVALIDO` | alerta | Dígito verificador do CNPJ/CPF do empregador (aceita CNPJ alfanumérico) |
| `REP_SEM_NUMERO` | alerta | Número de fabricação do REP preenchido |
| `PERIODO_INVERTIDO` | erro | Data inicial posterior à data final |
| `TAMANHO_INVALIDO` | erro | Tamanho fixo por tipo de registro (leiaute 1.510) |
| `TIPO_DESCONHECIDO` / `LINHA_CURTA` | erro | Linhas fora de qualquer leiaute do AFD |
| `NSR_DUPLICADO` / `NSR_FORA_DE_ORDEM` / `NSR_LACUNA` | erro/alerta | Sequência do NSR — lacuna indica registro removido |
| `DATA_INVALIDA` | erro | Data/hora inexistente (31/02, hora 25 etc.) |
| `DOC_MARCACAO_INVALIDO` / `DOC_EMPREGADO_INVALIDO` | alerta | Dígito verificador do PIS/CPF |
| `MARCACAO_DUPLICADA` | alerta | Mesma pessoa, mesmo instante |
| `RETROCESSO_TEMPORAL` | alerta | Marcação anterior à precedente **sem** ajuste de relógio declarado |
| `RETROCESSO_APOS_AJUSTE` | observação | O mesmo, logo após um registro tipo 4 (comportamento esperado) |
| `FORA_DO_PERIODO` | alerta | Marcações fora do período declarado no cabeçalho |
| `OPERACAO_INVALIDA` | alerta | Operação do tipo 5 diferente de I, A ou E |
| `SEM_CADASTRO` | observação | Trabalhador com marcação e sem registro tipo 5 |
| `TRAILER_AUSENTE` / `TRAILER_DUPLICADO` / `TRAILER_DIVERGENTE` | erro | Trailer presente, único e com contagens batendo com o arquivo |

## Arquivos

```
ponto/                       o contador de horas (é também a pasta publicada no site)
  index.html                 página da ferramenta (interface e estilos)
  js/afd_parser.js           analisador do AFD e regras de cálculo — sem dependências, roda no navegador e no Node
  js/leitor_afd.js           interface: carga do arquivo, abas, filtros, exportação
  js/relatorio.js            relatório por colaborador (uma página por colaborador e mês)
  js/nomes_padrao.js         lista fixa de documento/nome da sua instalação (vem vazia)
  exemplos/                  arquivos AFD fictícios para teste
programa/                    só para o programa de Windows
  relogio.php, js/relogio.js baixar o AFD direto do relógio Control iD da rede
  settings.json              janela "Cartão Ponto" do PHP Desktop
  inicio.html                página inicial (abre o contador de horas)
  LEIA-ME.txt                instruções que vão dentro do programa
ferramentas/montar_pacote.sh monta o programa pronto (motor PHP Desktop + ponto/ + programa/)
licencas/                    licença do PHP Desktop (vai dentro do programa)
testes/                      testes do cálculo, do navegador, do relógio e do pacote
documentacao/                este manual e o histórico das revisões
.github/workflows/           testes a cada envio e montagem do programa em Releases
```

A pasta `ponto/` é o site: o que está dentro dela é exatamente o que fica em
`fortman.com.br/ponto/`. Não há build, bundler nem dependência de servidor.

## Como abrir para testar

Três caminhos, do mais rápido ao definitivo:

1. **Direto do disco.** Baixe o repositório e abra `ponto/index.html` com dois cliques. Funciona em `file://`,
   sem servidor — os botões de exemplo montam um AFD fictício na hora.
   ```bash
   git clone https://github.com/Hoppehub/cartao-ponto.git
   ```
2. **Servidor local**, para ver igual ao que vai ao ar:
   ```bash
   npx http-server .    # depois abra http://127.0.0.1:8080/ponto/
   ```
3. **No ar**, seguindo a publicação abaixo.

## Como usar

Abra `leitor_afd.html` no navegador e arraste o AFD, ou clique para selecionar.
Os botões **Exemplo 1.510/2009** e **Exemplo 671/2021** montam um arquivo fictício na hora,
útil para conhecer a ferramenta sem expor dados reais.

## Publicar em fortman.com.br/ponto

O domínio está na Hostinger (nameservers `dns-parking.com`), então a publicação é uma cópia de pasta
para dentro de `public_html` — sem build e sem configuração de servidor.

### Pelo Gerenciador de Arquivos (caminho mais curto)

1. hPanel → **Arquivos → Gerenciador de arquivos** e entre em `public_html`.
2. Envie o `ponto.zip` (a pasta `ponto/` deste repositório, compactada) para dentro de `public_html`.
3. Clique com o botão direito no `.zip` → **Extrair**. Você deve ficar com `public_html/ponto/index.html`.
4. Apague o `.zip` e acesse **https://fortman.com.br/ponto**.

### Por FTP

hPanel → **Arquivos → Contas de FTP** para pegar servidor, usuário e senha; no FileZilla, arraste a pasta
`ponto` inteira para dentro de `public_html`. O resultado precisa ser `public_html/ponto/index.html`.

### Conferir depois de publicar

- `https://fortman.com.br/ponto` abre a ferramenta (o servidor acrescenta a barra final sozinho).
- Os botões **Exemplo 1.510/2009** e **Exemplo 671/2021** carregam o resumo — se carregarem, os dois
  arquivos de `js/` subiram certo. Página em branco quase sempre é `js/` faltando ou fora de lugar.
- O cadeado do HTTPS aparece sem aviso de conteúdo misto.

### Atualizar depois

Substitua os arquivos alterados (normalmente `ponto/js/*.js`). O navegador guarda cache: recarregue com
**Ctrl+F5**, e se precisar forçar para todo mundo, mude a versão na chamada do script dentro do
`index.html`, por exemplo `js/leitor_afd.js?v=2`.

### Observações

- Se `fortman.com.br` roda WordPress, a pasta `/ponto` continua funcionando: a regra padrão do WordPress
  só reescreve o que **não** existe em disco, e uma pasta real tem precedência.
- A pasta `exemplos/` só serve para teste. Pode apagar do servidor sem afetar a ferramenta — os botões de
  exemplo geram o arquivo na hora, dentro do navegador.

## Publicar também dentro do Ahtools

Copie `ponto/index.html` como `leitor_afd.html` para a raiz do Ahtools, junto com `js/afd_parser.js` e
`js/leitor_afd.js`, e acrescente o item ao menu (por exemplo no bloco *Validador* do `index.html`):

```html
<div class="flyout-item" data-tab="tab50" data-src="leitor_afd.html" data-title="Leitor de AFD">
    <i class="fas fa-file-lines"></i> Leitor de AFD
</div>
```

### Testes

```bash
node testes/gerar_exemplos.js    # regenera exemplos/
node testes/test_afd_parser.js   # verificações do analisador e do cálculo
node testes/test_navegador.js    # tela = relatório = CSV, carga concorrente (precisa do Playwright)
node testes/test_oraculo.js 2000 # 2000 meses aleatórios contra uma calculadora independente
```

## Leiautes implementados

Posições contadas a partir de 1, como nos anexos das portarias.

### Portaria 1.510/2009 (tamanho fixo por tipo)

| Tipo | Tam. | Campos |
|---|---|---|
| 1 — Cabeçalho | 232 | NSR 1‑9 · tipo 10 · tipo do identificador 11 · CNPJ/CPF 12‑25 · CEI 26‑37 · razão social 38‑187 · nº de fabricação 188‑204 · data inicial 205‑212 · data final 213‑220 · data de geração 221‑228 · hora 229‑232 (datas em DDMMAAAA) |
| 2 — Empregador | 299 | NSR · tipo · data 11‑18 · hora 19‑22 · tipo do identificador 23 · CNPJ/CPF 24‑37 · CEI 38‑49 · razão social 50‑199 · local de prestação 200‑299 |
| 3 — Marcação | 34 | NSR · tipo · data 11‑18 · hora 19‑22 · PIS 23‑34 |
| 4 — Ajuste do relógio | 34 | NSR · tipo · data/hora antes 11‑22 · data/hora depois 23‑34 |
| 5 — Empregado | 87 | NSR · tipo · data 11‑18 · hora 19‑22 · operação 23 · PIS 24‑35 · nome 36‑87 |
| 9 — Trailer | 37 | contagens dos tipos 2, 3, 4 e 5 (9 posições cada) + `9` |

### Portaria 671/2021

Datas em `AAAA-MM-DD` e horários em ISO 8601 (`AAAA-MM-DDThh:mm:ss-0300`). O cabeçalho tem prefixo fixo
— tipo do identificador, CNPJ/CPF (14), CNO/CAEPF (14), razão social (150), nº de fabricação (17) —
seguido de data inicial, data final e data/hora de geração. Os demais registros começam pela data/hora e
seguem com os campos do tipo: identificação por **CPF** nas marcações (tipo 3 com CRC‑16, tipo 7 do REP‑P
com data/hora de gravação e hash), tipo 6 para eventos sensíveis do REP e trailer com as contagens dos
tipos 2 a 7.

**Sobre variações entre fabricantes.** O texto da 671 deixa margem no carimbo de geração e nos campos
complementares, e os REPs no mercado divergem em detalhes. Por isso o leitor não trabalha só com posições
fixas: reconhece os campos de data/hora por padrão ISO (com ou sem `T`, com ou sem separadores, com ou sem
fuso), decide entre CPF (11) e PIS (12) pelo dígito verificador e mostra o que sobrou como *complemento*,
em vez de descartar. Se algum campo do seu REP cair em posição diferente, a aba **Arquivo bruto** abre o
registro campo a campo com as posições — dá para conferir e me dizer o que ajustar.

## Observações

- Leitura de arquivos em ISO‑8859‑1/Windows‑1252 (comum nos REPs antigos) e UTF‑8, com detecção automática.
- Arquivos exportados sem quebra de linha são reconstituídos no leiaute 1.510 (tamanhos fixos).
- Arquivos grandes são processados em lotes, com barra de progresso, sem travar a aba do navegador.
- O total trabalhado e o saldo do espelho são apoio de conferência, não cálculo de folha: veja as
  ressalvas em *Saldo de horas*.
- Empresa, pessoas e documentos dos exemplos são fictícios; os dígitos verificadores foram calculados
  apenas para os arquivos passarem nas validações.
