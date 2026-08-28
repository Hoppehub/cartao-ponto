# Leitor de AFD

Leitor e auditor do **Arquivo-Fonte de Dados (AFD)** do ponto eletrônico, nos leiautes da
**Portaria MTE 1.510/2009** (REP-C clássico) e da **Portaria MTP 671/2021** (REP-C, REP-A e REP-P).

Tudo roda no navegador: o arquivo é lido em memória, nenhum byte é enviado para servidor algum —
o que importa quando o AFD carrega CPF, PIS e a jornada de pessoas reais.

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

### Saldo de horas

O saldo compara o trabalhado no dia com a **jornada diária esperada** — 08:00 por padrão, ajustável no
campo *Jornada diária*. Acima disso o saldo sai positivo (verde), abaixo sai negativo (vermelho). Nos
cartões, cada dia mostra o próprio saldo ao lado das batidas, e ao fim de cada semana e de cada mês entra
uma faixa de fechamento com trabalhado, esperado e saldo do período. Na tabela, o saldo é uma coluna, e a
faixa do trabalhador traz o total do período filtrado. A exportação em CSV leva jornada esperada e saldo.

Duas coisas que o AFD **não** informa e que por isso ficam de fora da conta:

- **Dias sem marcação não entram.** O arquivo não distingue falta, folga, férias, atestado ou feriado, e
  descontar 08:00 de todo dia sem batida produziria um saldo negativo falso. Só entram os dias que têm
  marcação.
- **Sábado, domingo e feriado** contam como dia normal por padrão. Se na sua regra o fim de semana é saldo
  integral, marque *Jornada só em dias úteis*: sábado e domingo passam a ter jornada esperada zero.

O cálculo pareia as batidas do dia na ordem (1ª com 2ª, 3ª com 4ª...). Não aplica tolerância da
Portaria 671, intervalo mínimo, adicional noturno nem jornada que vira o dia — é conferência, não folha.

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
ponto/                    pasta publicada — sobe inteira para o servidor
  index.html              página da ferramenta (interface e estilos)
  js/afd_parser.js        analisador do AFD — sem dependências, roda no navegador e no Node
  js/leitor_afd.js        interface: carga do arquivo, abas, filtros, exportação
  exemplos/               arquivos AFD fictícios para teste
testes/gerar_exemplos.js  gera os arquivos de exemplo
testes/test_afd_parser.js testes do analisador
```

A pasta `ponto/` é o site: o que está dentro dela é exatamente o que fica em
`fortman.com.br/ponto/`. Não há build, bundler nem dependência de servidor —
são três arquivos estáticos.

## Como abrir para testar

Três caminhos, do mais rápido ao definitivo:

1. **Direto do disco.** Baixe a branch e abra `ponto/index.html` com dois cliques. Funciona em `file://`,
   sem servidor — os botões de exemplo montam um AFD fictício na hora.
   ```bash
   git clone -b claude/afd-reader-z3q16c https://github.com/GITHUPPE/ftm.git
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
node testes/test_afd_parser.js   # 100 verificações do analisador
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
