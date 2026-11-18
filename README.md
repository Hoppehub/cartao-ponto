# Cartão Ponto — Fortman

Programa que lê o arquivo do relógio de ponto (AFD), calcula as horas de cada colaborador e gera o
relatório por colaborador. **Tudo o que é do cartão ponto está neste repositório**: o programa, o
cálculo, os testes, a documentação e a história do projeto.

---

## Baixar e instalar (Windows)

1. Com o GitHub aberto e logado, clique: **[CartaoPonto-Windows.zip](https://github.com/Hoppehub/cartao-ponto/releases/latest/download/CartaoPonto-Windows.zip)**
   (também fica no quadro **Releases**, à direita desta página). São cerca de 170 MB.
2. Clique com o botão direito no arquivo baixado → **Extrair tudo**.
3. Leve a pasta **`CartaoPonto`** para a **Área de Trabalho** ou para **Documentos**
   (não para `C:\Arquivos de Programas`, onde o Windows não deixa o programa gravar).
4. Dê dois cliques em **`CartaoPonto.exe`**.
   Se aparecer *"O Windows protegeu o computador"*: **Mais informações → Executar assim mesmo**.

Não precisa baixar mais nada: o motor do programa já vem dentro.

**Primeiro uso:** em *Baixar do relógio de ponto* → **Configurar relógio**, informe o endereço
(`192.168.1.99`), o usuário e a senha do relógio e clique em **Salvar**. Depois escolha o mês e clique em
**Baixar e abrir**. Também dá para abrir um arquivo AFD baixado pelo Chrome.

## Atualizar

Sempre que o programa muda, uma versão nova aparece sozinha em **Releases**, e o link acima passa a baixar
a nova.

1. Feche o programa.
2. Baixe o zip novo pelo mesmo link e extraia.
3. Da versão nova, copie a pasta **`www`** e o arquivo **`VERSAO.txt`** para a sua pasta `CartaoPonto`,
   substituindo.
4. **Nunca apague a pasta `dados`**: é onde fica a configuração do relógio.

## O que o programa mostra

- **TRABALHADO** — as horas que a pessoa bateu no relógio.
- **HORA FECHADA** — depois da tolerância legal: se toda batida variou até 5 minutos do horário previsto e
  a soma do dia ficou em até 10 minutos, o dia fecha em 00:00; passou disso, vale a diferença inteira
  (CLT art. 58, §1º; Súmula 366 do TST).
- **FERIADO** — feriado nacional, sem jornada prevista; trabalhado, tudo é hora extra.
- **PONTO FACULTATIVO** — dia normal de trabalho na Fortman, só marcado em destaque.
- **PARA CONFERIR** — batida esquecida, repetida, inválida ou com ajuste do relógio: as horas conhecidas
  aparecem, mas o dia fica fora da hora fechada até alguém conferir.
- **Alertas** — mais de 12h no dia, intervalo menor que 1h (CLT art. 71), descanso menor que 11h entre
  jornadas (CLT art. 66). Não mudam o saldo.
- **Relatório por colaborador** — uma página por colaborador e por mês, com as horas trabalhadas e a hora fechada, para imprimir ou
  salvar em PDF. Duas empresas no mesmo relógio são separadas pela lista de empresas.

---

## História do projeto

### De onde veio a ideia

A Fortman (Fortconfecções LTDA) tem um relógio de ponto Control iD na rede interna (`192.168.1.99`). Todo mês
alguém entrava pelo Chrome na página do relógio, baixava o **AFD** (Arquivo-Fonte de Dados, o arquivo oficial
do ponto eletrônico, definido pelas Portarias 1.510/2009 e 671/2021) e precisava conferir as horas de cada
pessoa — o que chega direto no **salário** e nas **horas extras**. A ideia foi ter uma ferramenta que lesse
esse arquivo sozinha, mostrasse o espelho de ponto de cada colaborador e fizesse a conta certa, sem enviar os
dados de ninguém para a internet.

### Linha do tempo

**23 a 29 de agosto de 2026 — nasce o Leitor de AFD.**
A primeira versão foi feita com o Claude Code, primeiro no repositório `GITHUPPE/ftm` e depois na branch
`leitor-afd` do repositório `Hoppehub/Fortman`, publicada no site em `fortman.com.br/ponto`. Em uma semana a
ferramenta ganhou: leitura e auditoria dos dois leiautes do AFD, espelho de ponto em cartões, saldo por dia,
semana e mês, lista de nomes (o AFD do relógio costuma vir sem o cadastro), jornada por dia da semana com a
escala da empresa (9h de segunda a quinta e 8h na sexta, entrada às 06:55), faltas em dia útil e fechamento de
semana e de mês.

**28 de outubro de 2026 — o programa para o computador e o relógio.**
O dono procurou "o negócio de hora extra" e ele foi encontrado na branch `leitor-afd`. No mesmo dia:
- foi criado um **menu de entrada** com os três aplicativos da empresa (BordaMax, contador de horas e catálogo);
- foi criada a **versão para Windows**, usando o **PHP Desktop** (programa de código aberto que transforma
  páginas em programa de computador) — na época, montada à mão: baixar o motor, copiar os arquivos para dentro;
- o contador de horas passou a **baixar o AFD direto do relógio**, mês a mês, sem o Chrome (`login.fcgi`,
  `get_afd.fcgi` da Control iD);
- os **nomes** passaram a vir da página *Usuários* do relógio (NOME e PIS, `load_users.fcgi`);
- usuário e senha do relógio passaram a abrir em branco;
- os dias de **feriado** passaram a ser marcados, conforme a tabela oficial de 2026.

**28 de outubro de 2026 — a revisão.**
Por ser um cálculo que afeta salário, o dono pediu uma conferência independente:
- o código foi comparado com a biblioteca pública **convenia/afd-reader**: ela só lê o arquivo e não calcula
  horas; a única regra em comum (o pareamento das batidas) dá o mesmo resultado;
- o **ChatGPT** recebeu um pedido de revisão completo. A primeira tentativa abriu o repositório errado; a
  segunda passou a exigir a confirmação do local antes de começar. O relatório dele apontou **29 achados e 14
  melhorias**, entre eles: batida esquecida virando débito, feriado esperando jornada cheia, falta de
  tolerância, filtro do segundo download do relógio errado e montagem que podia apagar dados.
  Os pedidos e o relatório estão em [`documentacao/historico/`](documentacao/historico/).

**As decisões do dono** (a base das regras de hoje):
- Todos têm a mesma jornada: 06:55–11:55 e 12:55–16:55 de segunda a quinta; sexta até 15:55. Sábado e domingo
  não são dias de trabalho. Não há trabalho noturno.
- Feriado nacional tem jornada zero; o que for trabalhado é hora extra.
- Ponto facultativo **não é folga** na Fortman: é dia normal, só marcado.
- Batida esquecida ou repetida deixa o dia **para conferir**, sem inventar horário.
- Sempre duas informações: **horas trabalhadas** (o que foi batido) e **hora fechada** (soma que a lei manda).

**6 de novembro de 2026 — o relatório e a fase 1.**
- **Relatório por colaborador**: uma página por colaborador e por mês, com separação por **empresa** (duas
  empresas usam o mesmo relógio) e linhas com mais contraste.
- **Fase 1** (feita pelo Claude Code, já que a do ChatGPT não chegou): hora fechada, dias para conferir,
  calendário de feriados dentro do cálculo, alertas da CLT, CSV sem fórmulas, proteção contra cargas
  sobrepostas, impressão digital (SHA-256) do arquivo e versão do cálculo no rodapé do relatório.
- **Conferência do cálculo**: testes automáticos no GitHub a cada envio, um teste no navegador (tela =
  relatório = CSV) e uma **segunda calculadora escrita do zero**, comparada dia a dia com o programa em
  milhares de meses aleatórios. Para provar que ela pega erros, 17 erros foram plantados de propósito — os 17
  foram detectados.

**18 de novembro de 2026 — aprovação e repositório próprio.**
A fase 1 foi aprovada e juntada às versões oficiais. Na reinstalação, ficou claro que o programa em duas partes
(motor + arquivos da Fortman) e o repositório `Fortman` com vários programas misturados confundiam. Por isso:
- foi criado este repositório, **só para o cartão ponto**, com o histórico preservado desde agosto;
- o GitHub passou a **montar o programa sozinho**: a cada mudança, roda os testes, baixa o motor oficial do
  PHP Desktop (conferido pela impressão digital), junta com o contador de horas e publica o
  `CartaoPonto-Windows.zip` em **Releases**. Baixar, extrair e dar dois cliques.

**18 de novembro de 2026 — tela mais simples e relatório legível.**
- A coluna "horas práticas" saiu, porque confundia: a tela e o relatório mostram as horas que a pessoa bateu
  (**Trabalhado**) e a **hora fechada**.
- Com o relógio configurado, o título e os botões de carregar arquivo, colar conteúdo e listas de nomes e de
  empresas só aparecem em **Números para nerd**.
- O relatório passou a sair sempre nas cores aprovadas (branco e cinza, feriado em pêssego, para conferir em
  amarelo), mesmo com o programa no tema escuro.

### Quem fez o quê

- **Dono (Fortman):** a necessidade, as regras da empresa, os testes no computador e as aprovações.
- **Claude Code:** o desenvolvimento, os testes, a montagem automática e a documentação.
- **ChatGPT:** a revisão independente de outubro.

### O que ainda está pendente

- Confirmar com a contabilidade a regra da **hora fechada**.
- Nomes e CNPJs das **duas empresas** e se usam um ou dois relógios (para a planilha de empresas).
- O primeiro download pelo **relógio real** e o uso no Windows no dia a dia.
- Opinião sobre o alerta **"Intervalo < 1h"** depois de ver com dados reais.

---

## Para quem vai mexer no código

Este repositório tem uma única versão (a `main`) e quatro partes:

| Pasta | O que é |
|---|---|
| `ponto/` | O contador de horas (HTML e JavaScript). É também o que vai para o site `fortman.com.br/ponto/`. |
| `programa/` | O que só existe no programa de Windows: download do relógio Control iD (`relogio.php`, `js/relogio.js`), a janela "Cartão Ponto" (`settings.json`), a página inicial e o `LEIA-ME.txt`. |
| `ferramentas/montar_pacote.sh` | Junta o motor **PHP Desktop** (baixado da página oficial e conferido pelo SHA-256) com `ponto/` e `programa/`, formando o programa pronto. |
| `testes/` | Testes do cálculo, da calculadora independente, do navegador, do relógio e do programa montado. |

Por que o motor não fica nas pastas do repositório: o arquivo principal dele (`libcef.dll`) tem 220 MB, e o
GitHub não aceita arquivo com mais de 100 MB dentro do repositório. Por isso, a cada envio para a `main`, o
GitHub (`.github/workflows/programa.yml`) roda os testes, baixa o motor oficial, monta o programa e publica o
`CartaoPonto-Windows.zip` em **Releases**, que aceita arquivos grandes. As 5 versões mais novas ficam guardadas.

Rodar os testes:

```
node testes/test_afd_parser.js     # cálculo e leitura do AFD
node testes/test_oraculo.js 2000   # 2000 meses aleatórios contra uma calculadora independente
node testes/test_navegador.js      # tela = relatório = CSV (precisa do Playwright)
php testes/test_relogio.php        # download do relógio contra um relógio falso
bash ferramentas/montar_pacote.sh && bash testes/test_pacote.sh   # monta e confere o programa
```

Manual completo (regras de cálculo, leiautes do AFD, publicação no site): [`documentacao/MANUAL-TECNICO.md`](documentacao/MANUAL-TECNICO.md).
Histórico das revisões: [`documentacao/historico/`](documentacao/historico/).

O motor PHP Desktop é de Czarek Tomczak, distribuído sob licença BSD (cópia em `licencas/`).
