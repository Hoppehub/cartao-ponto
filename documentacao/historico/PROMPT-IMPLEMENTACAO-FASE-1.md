# Prompt de implementação — Fase 1 do contador de horas da Fortman

> Copie tudo a partir da linha abaixo e cole no ChatGPT (ambiente com acesso a `Hoppehub/Fortman`).
> Pode ser na mesma conversa da revisão ou numa nova.

---

Você vai **implementar** a primeira fase de correções do contador de horas da Fortman, com base no seu relatório
`revisao/RELATORIO-GPT-CONTADOR-DE-HORAS.md` (branch `gpt/revisao-contador-de-horas`) e nas **decisões do dono**
listadas na seção 2. Escreva em português do Brasil, formal e sem gírias.

**Você não decide o que entra no produto.** Todo o código vai para branches `gpt/...` separadas. O Claude Code vai
revisar, rodar os testes e só então, com aprovação do dono, levar para a `main` e a `leitor-afd`. Nunca grave nessas
duas nem em outra branch que já exista.

## 0. PRIMEIRO PASSO OBRIGATÓRIO: confirme o local e espere a autorização

| Item | Valor exato |
|---|---|
| Repositório | **`Hoppehub/Fortman`** — https://github.com/Hoppehub/Fortman |
| Núcleo do contador (somente leitura) | `leitor-afd`, commit `44c9e22` |
| Versão desktop (somente leitura) | `main`, commit `69accc8` ou posterior |
| Seu relatório | `gpt/revisao-contador-de-horas`, commit `6e91b5b`, `revisao/RELATORIO-GPT-CONTADOR-DE-HORAS.md` |
| Onde gravar o núcleo | **`gpt/proposta-leitor-afd`** (nova, a partir da `leitor-afd`) |
| Onde gravar o desktop | **`gpt/proposta-desktop`** (nova, a partir da `main`) |

Repositórios que **não** são este trabalho: `GITHUPPE/ftm`, `Hoppehub/ftm`, `Hoppehub/Hero-cards`, `Hoppehub/Chest`.

Sua primeira resposta deve ser só este bloco, preenchido, e depois **pare**:

```
CONFIRMAÇÃO DO LOCAL — FASE 1
Repositório aberto: <nome completo>
leitor-afd: <commit curto e título>
main: <commit curto e título>
Relatório encontrado em gpt/revisao-contador-de-horas: sim/não — <commit>
Vou gravar somente em: gpt/proposta-leitor-afd e gpt/proposta-desktop
Não vou gravar em: main, leitor-afd, gpt/revisao-contador-de-horas nem em outra branch existente
Posso criar branches e fazer commit? sim/não
Aguardo o "pode começar".
```

Só comece depois de receber **"pode começar"**. Se algo não bater, diga o que encontrou e não siga.

## 1. Onde fica cada coisa

- **Núcleo** (branch `leitor-afd`, publicado também no site `fortman.com.br/ponto/`):
  `ponto/js/afd_parser.js` (regras e cálculo, objeto `AFD`), `ponto/js/leitor_afd.js` (tela), `ponto/index.html`,
  `testes/test_afd_parser.js` (197 verificações: `node testes/test_afd_parser.js`), `README.md`.
- **Desktop** (branch `main`): `complementos/ponto/relogio.php`, `complementos/ponto/js/relogio.js`,
  `complementos/ponto/js/feriados.js`, `ferramentas/montar_desktop.sh`, `README.md`.
  A pasta `desktop/` é **gerada** pelo script: não edite à mão e não a remonte nesta fase.
- As referências P01–P29 e M1–M14 abaixo são as do seu relatório.

## 2. Decisões do dono (valem como regra; não reabra)

| # | Decisão |
|---|---|
| D-A | **Todos os empregados têm a mesma jornada**: segunda a quinta 06:55–11:55 e 12:55–16:55 (9h); sexta 06:55–11:55 e 12:55–15:55 (8h). Total 44h. **Sábado e domingo não são dias de trabalho.** **Não há trabalho noturno.** |
| D-B | **Feriado nacional**: jornada prevista **zero**. Sem batida, não há débito. Com batida, **todo o tempo trabalhado é hora extra** do dia. |
| D-C | **Pontos facultativos** (Carnaval segunda e terça, Quarta-feira de Cinzas, Corpus Christi, 28/10, 24/12 e 31/12): **não são folga** na Fortman. São **dias normais de trabalho**, com a jornada da D-A, mas precisam aparecer **muito bem marcados** no dia, do mesmo jeito que hoje aparecem SÁBADO e DOMINGO. |
| D-D | **Batida esquecida** (número ímpar) ou **batida duplicada suspeita**: o dia fica **"PARA CONFERIR"**. Mostra as horas conhecidas, mas **não fecha saldo** até alguém conferir. Nunca inventar horário e nunca apagar batida. |
| D-E | **Duas informações de horas, sempre, em cada dia**: **HORAS PRÁTICAS** e **HORA FECHADA** (seção 3). |
| D-F | A opção **"Mesma jornada em todo dia com marcação"** nunca pode gerar FALTA em sábado ou domingo. Ela vale para os dias de segunda a sexta; fim de semana segue a D-A (dia sem jornada; se trabalhado, tudo é extra). |

## 3. HORAS PRÁTICAS e HORA FECHADA (o ponto mais importante)

O dono precisa ver **a soma real** e **a soma que a lei manda**, lado a lado, sem que uma substitua a outra.

### 3.1 Definições

- **HORAS PRÁTICAS** = o relógio puro. Trabalhado − previsto, **minuto a minuto**, sem nenhum abono. Exemplo: entrou
  3 minutos antes → **+0:03**. É o saldo que o sistema calcula hoje (campo `saldo`); **não mude esse cálculo**.
- **HORA FECHADA** = o saldo depois da regra legal de tolerância (CLT art. 58, §1º, com a leitura da Súmula 366 do
  TST). É o número "que a lei manda".

### 3.2 Regra da HORA FECHADA (implemente exatamente assim)

Para cada dia útil (segunda a sexta, que não seja feriado) com **número par de batidas e sem pendência**:

1. Compare cada batida com o horário previsto correspondente (1ª com 06:55, 2ª com 11:55, 3ª com 12:55, 4ª com 16:55,
   ou 15:55 na sexta). **Variação** de cada batida = diferença em minutos, **em valor absoluto**, entre a batida e o
   horário previsto (06:52 contra 06:55 = 3; 17:00 contra 16:55 = 5). A soma do dia é a soma dessas variações
   absolutas, para que um atraso não "apague" uma saída tardia.
2. Se **todas** as variações forem de **até 5 minutos** **e** a soma das variações do dia for de **até 10 minutos**:
   **HORA FECHADA = 0:00** (nem desconto nem extra).
3. Se **qualquer** batida variar **mais de 5 minutos**, **ou** a soma passar de **10 minutos**: **HORA FECHADA =
   HORAS PRÁTICAS do dia, inteira** (não se abate a "franquia" de 10 minutos).
4. Dia com batidas em quantidade diferente de 4: aplicar a mesma lógica se for possível associar cada batida a um
   horário previsto sem ambiguidade; se não for, o dia fica **PARA CONFERIR** (D-D).

Casos especiais:

| Situação | HORAS PRÁTICAS | HORA FECHADA |
|---|---|---|
| Feriado sem batida | 0:00 | 0:00 |
| Feriado com batida | + todo o tempo trabalhado | + todo o tempo trabalhado (é extra; sem tolerância, não há horário previsto) |
| Sábado/domingo com batida | + todo o tempo trabalhado | + todo o tempo trabalhado |
| Sábado/domingo sem batida | 0:00 (etiqueta SÁBADO/DOMINGO) | 0:00 |
| Dia útil sem batida (inclusive ponto facultativo) | − jornada do dia (FALTA) | − jornada do dia (FALTA) |
| Dia PARA CONFERIR | horas conhecidas e saldo bruto, com aviso | **vazio ("—")**, não entra na soma fechada; contador de dias pendentes |

### 3.3 Casos que precisam passar (do seu relatório, seção 5.2)

Segunda-feira, previsto 06:55/11:55/12:55/16:55:

| Batidas | HORAS PRÁTICAS | HORA FECHADA |
|---|---|---|
| 06:52, 11:55, 12:55, 16:55 | +0:03 | 0:00 |
| 06:51, 11:55, 12:55, 16:59 | +0:08 | 0:00 |
| 06:50, 11:55, 12:55, 17:00 | +0:10 | 0:00 |
| 06:50, 11:56, 12:55, 17:00 | +0:11 | +0:11 |
| 06:58, 11:55, 12:55, 16:55 | −0:03 | 0:00 |
| 06:59, 11:55, 12:55, 16:51 | −0:08 | 0:00 |
| 07:00, 11:55, 12:55, 16:50 | −0:10 | 0:00 |
| 07:00, 11:54, 12:55, 16:50 | −0:11 | −0:11 |
| 06:55, 11:55, 12:55, 17:03 | +0:08 | +0:08 (uma batida variou 8 min) |
| 07:58, 12:04, 13:03, 17:05 | −0:52 | −0:52 |
| 06:55, 11:55, 12:55 (esqueceu a saída) | 5:00 conhecidas, aviso | — (PARA CONFERIR) |
| 06:55, 06:56, 11:55, 12:55, 16:55 | aviso de duplicata | — (PARA CONFERIR) |
| 07/09/2026 sem batida | 0:00 | 0:00, etiqueta FERIADO |
| 07/09/2026: 06:55, 11:55, 12:55, 16:55 | +9:00 | +9:00 |
| 16/02/2026 (Carnaval) sem batida | −9:00 (FALTA) | −9:00, etiqueta PONTO FACULTATIVO |

Também precisa ficar correto: a mesma tabela na sexta (saída prevista 15:55) e um caso de sexta com 06:55–15:55 = 0:00.

### 3.4 Como mostrar

- **Em cada dia** (cartões do espelho), dois valores lado a lado, com estes rótulos exatos: **HORAS PRÁTICAS** e
  **HORA FECHADA**. Quando forem iguais, mostrar os dois mesmo assim. Quando forem diferentes, destacar a diferença
  (por exemplo, "tolerância aplicada").
- **No fechamento da semana e do mês** e nos cartões de resumo do topo: as duas somas, também lado a lado
  (**soma real** = HORAS PRÁTICAS; **soma legal** = HORA FECHADA), mais a quantidade de dias PARA CONFERIR.
- **Na Tabela e no CSV**: duas colunas separadas, `Horas práticas` e `Hora fechada`, e uma coluna `Situação`
  (normal, falta, feriado, ponto facultativo, sábado, domingo, para conferir).
- Uma frase curta na tela explicando as duas (por exemplo: "Horas práticas: minuto a minuto do relógio. Hora fechada:
  após a tolerância de 5 minutos por batida e 10 minutos por dia, CLT art. 58, §1º.").

## 4. O que implementar nesta fase

### 4.1 Núcleo — branch `gpt/proposta-leitor-afd`

1. **Horários previstos por batida** (base da D-A e da seção 3). Hoje `AFD.ESCALAS` guarda só a duração por dia.
   Acrescente a escala com horários (segunda a quinta 06:55/11:55/12:55/16:55; sexta 06:55/11:55/12:55/15:55;
   sábado e domingo sem jornada) sem quebrar as escalas existentes.
2. **HORA FECHADA** (seção 3), em função pura testável no `afd_parser.js`, preservando `saldo` e `totalMinutos`.
   Novos campos sugeridos: `saldoFechado`, `variacoes`, `toleranciaAplicada`, `statusSaldo`, `motivos`.
3. **PARA CONFERIR** (M1, P01, P02, D-D): dia ímpar, duplicata exata ou batida a 5 minutos ou menos da anterior ficam
   pendentes. Não apagar nenhuma batida. Totais informam dias pendentes.
4. **Datas e horas inválidas** (M2, P06, P08): 31/02, 25:00 etc. geram inconsistência e deixam o dia PARA CONFERIR;
   não entram no saldo fechado.
5. **Calendário no núcleo** (M3, D-B, D-C): feriados nacionais (fixos e móveis pela Páscoa: 01/01, Paixão de Cristo,
   21/04, 01/05, 07/09, 12/10, 02/11, 15/11, 20/11, 25/12) com jornada zero; pontos facultativos (Carnaval segunda e
   terça, Cinzas, Corpus Christi, 28/10, 24/12, 31/12) com jornada normal e etiqueta própria. Etiquetas **FERIADO** e
   **PONTO FACULTATIVO** no dia, no mesmo estilo de SÁBADO/DOMINGO, com o nome da data. Deixe uma lista configurável
   para feriados estaduais/municipais (vem vazia).
6. **Opção diária** (P12, D-F): nunca gerar FALTA em sábado ou domingo.
7. **Carga concorrente** (M7, P13): só a última carga pode atualizar a tela. E exponha uma API mínima, documentada,
   para o desktop: por exemplo `window.LeitorAFD.carregar({ bytes, nomeArquivo, nomes, periodo })`, que devolve uma
   Promise resolvida **só depois** que a análise terminou e o período foi aplicado.
8. **CSV seguro** (M13, P18): texto que começa com `=`, `+`, `-`, `@`, tabulação ou retorno não pode virar fórmula no
   Excel; saldos numéricos continuam números.
9. **Aviso de máscara** (P29): "Ocultar documentos" precisa avisar que a linha bruta (modal e aba Arquivo) não é
   mascarada, ou mascará-la também.
10. **Rótulo honesto da auditoria** (M10, só o rótulo): onde o CRC não é verificado, dizer "não verificado", não
    "íntegro".
11. **README** da branch: explicar HORAS PRÁTICAS e HORA FECHADA, o calendário e o PARA CONFERIR.

### 4.2 Desktop — branch `gpt/proposta-desktop`

1. **Filtro do segundo download** (P14): `relogio.js` deve usar a API do item 4.1.7 e só anunciar "Mostrando MM/AAAA"
   depois que a análise nova terminou e o filtro foi aplicado nela. Remover a espera de 10 segundos por IDs.
2. **Validar a resposta do relógio** (P15): só aceitar como AFD um conteúdo que pareça AFD (linhas no leiaute,
   cabeçalho tipo 1). JSON, HTML ou vazio viram erro claro.
3. **Sem queda automática para HTTP e sem seguir redirecionamentos** (P16, P19): tentar HTTPS; se falhar, mostrar o
   erro e **não** tentar HTTP sozinho (permitir HTTP só se o usuário marcar essa opção na configuração, com aviso). Em
   cURL e em streams, não seguir redirecionamentos. **Não** implemente fixação de certificado (pin) nesta fase.
4. **Lista de nomes incompleta** (P26): avisar quando a leitura de usuários falhar ou parar no meio.
5. **Montagem sem apagar dados** (M11, P17): `montar_desktop.sh` deve montar numa pasta temporária e trocar só o
   código, preservando `desktop/dados`, `desktop/php`, `desktop/locales`, `.exe`, `.dll`, `.pak`, `webcache` e
   `debug.log`. Registrar num arquivo os commits de cada branch usada.
6. **`feriados.js`**: com o calendário no núcleo, deixa de ter regra própria. Remova-o da montagem ou transforme-o num
   adaptador sem regra, para não haver duas listas de feriados.

## 5. Fora desta fase (não implemente)

M5 (jornadas que viram o dia e ajustes de relógio), M6 completo (cadastro por pessoa e vigência), M8 (homologação com
o relógio real), M9 com pin de certificado e proteção avançada da senha, M10 completo (CRC por perfil), M12, M14,
folha de pagamento, percentuais de hora extra, DSR e banco de horas. Se algo desta fase depender de um desses, pare e
pergunte.

## 6. Testes obrigatórios

- Os **197 testes existentes** continuam passando, **sem alterar nem enfraquecer nenhum**.
- Acrescente em `testes/test_afd_parser.js`, no estilo existente (`grupo`, `igual`, `ok`), no mínimo: todos os casos
  da seção 3.3 (segunda e sexta), feriado com e sem batida, ponto facultativo com e sem batida, sábado e domingo com e
  sem batida, opção diária sem FALTA no fim de semana, data inválida, duplicata, dia ímpar, totais da semana e do mês
  com as duas somas e a contagem de pendentes, CSV com nome `=1+1`.
- Para o desktop: um teste do `relogio.php` com servidor simulado local (JSON de erro, HTML, AFD vazio, AFD válido,
  redirecionamento, falha de HTTPS sem cair para HTTP) e um teste da montagem com pastas-sentinela fictícias.
- Rode `node testes/test_afd_parser.js` antes de **cada** commit no núcleo. Nenhum dado real (AFD, nome, CPF, PIS)
  no repositório.

## 7. Como entregar

- Commits pequenos, um por item, com a referência no título (ex.: `M4: hora fechada com tolerância por batida`).
- Ao final, grave em `gpt/proposta-desktop` o arquivo **`revisao/IMPLEMENTACAO-GPT-FASE-1.md`** com:
  1. lista de commits de cada branch (código e título);
  2. para cada item da seção 4: o que foi feito, arquivos e funções alterados, testes acrescentados;
  3. a saída final de `node testes/test_afd_parser.js` (quantidade de verificações e resultado);
  4. a tabela da seção 3.3 com o resultado **obtido** pelo sistema em cada caso;
  5. o que ficou pendente ou diferente do pedido, e por quê;
  6. capturas ou descrição de como ficaram o dia, o fechamento e o CSV.
- **Não** abra pull request, **não** faça merge e **não** grave em `main`, `leitor-afd` ou `gpt/revisao-contador-de-horas`.
- Responda no chat com o resumo e os links das duas branches.
