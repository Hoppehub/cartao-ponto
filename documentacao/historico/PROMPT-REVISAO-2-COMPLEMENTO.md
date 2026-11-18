# Prompt 2 — Complemento da revisão do contador de horas

> Envie no **mesmo chat** em que o ChatGPT está fazendo a primeira revisão. Copie tudo a partir da linha abaixo.

---

**Complemento à revisão que você está fazendo do contador de horas da Fortman (repositório `Hoppehub/Fortman`).**
Continue o trabalho do primeiro pedido e acrescente o que está abaixo. As regras continuam as mesmas: é só revisão
(não altere código, não faça commit, não abra pull request), em português do Brasil formal, citando arquivo e função
ou linha em cada afirmação e separando fato de suposição. Se você já entregou parte do relatório, não repita: entregue
apenas o que este complemento acrescenta e corrija o que ele contradizer.

## 1. Por que esta revisão importa

O saldo de horas deste sistema é usado na conferência que chega ao **salário das pessoas**. Um erro de regra que some
ou desconte minutos todos os dias, para todos os empregados, vira dinheiro pago a mais ou a menos e risco trabalhista.
Trate todo erro que muda o saldo como **crítico** e priorize o que afeta o valor das horas antes de estética,
organização de código ou desempenho. Se a sua primeira ordem de prioridades não seguia esse critério, refaça-a.

## 2. O que já foi verificado e os riscos conhecidos

Uma análise feita em paralelo pelo Claude Code chegou às conclusões abaixo. **Confirme ou corrija cada uma no código**;
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

## 3. Verificação independente dos números

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

## 4. Perguntas para o dono

Inclua no relatório, cada uma com o impacto de cada resposta possível no saldo:

- Feriado deve esperar zero hora, com o que for trabalhado contado como hora extra?
- Os pontos facultativos (Carnaval, Cinzas, Corpus Christi, 24/12, 31/12) são folga na Fortman?
- A tolerância de 5/10 minutos deve ser aplicada?
- Dia com batida esquecida deve ficar marcado "para conferir" em vez de entrar como saldo negativo?
- Há banco de horas ou acordo de compensação? Há empregados com escala diferente ou trabalho noturno?

## 5. O que entregar agora

1. **Confirmação ou correção** de cada conclusão da seção 2, uma por uma, com a referência no código.
2. A **tabela dos 9 casos** da seção 3 (batidas, resultado do sistema, resultado correto, diferença) e os testes
   automatizados sugeridos para cada divergência.
3. O **protocolo de validação com dados reais**.
4. A **lista de prioridades refeita** pelo critério da seção 1, mantendo para cada melhoria os campos Melhoria,
   Por que, Como executar e Esforço e risco.
5. As **perguntas para o dono** da seção 4.
