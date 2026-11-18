# Cartão Ponto — Fortman

Programa que lê o arquivo do relógio de ponto (AFD), calcula as horas de cada colaborador e gera o
relatório por colaborador. **Tudo o que é do cartão ponto está neste repositório**: o programa, o
cálculo, os testes e a documentação.

---

## Baixar e instalar (Windows)

1. Baixe o programa pronto: **[CartaoPonto-Windows.zip](https://github.com/Hoppehub/cartao-ponto/releases/latest/download/CartaoPonto-Windows.zip)**
   (também fica no quadro **Releases**, à direita desta página). São cerca de 170 MB.
2. Clique com o botão direito no arquivo baixado → **Extrair tudo**.
3. Leve a pasta **`CartaoPonto`** para a **Área de Trabalho** ou para **Documentos**
   (não para `C:\Arquivos de Programas`, onde o Windows não deixa o programa gravar).
4. Dê dois cliques em **`CartaoPonto.exe`**.
   Se aparecer *"O Windows protegeu o computador"*: **Mais informações → Executar assim mesmo**.

Não precisa baixar mais nada: o motor do programa já vem dentro.

**Primeiro uso:** em *Baixar do relógio de ponto* → **Configurar relógio**, informe o endereço
(`192.168.1.99`), o usuário e a senha do relógio e clique em **Salvar**. Depois escolha o mês e clique em
**Baixar e abrir**.

## Atualizar

Sempre que o programa muda, uma versão nova aparece sozinha em **Releases**.

1. Feche o programa.
2. Baixe o zip novo pelo mesmo link acima e extraia.
3. Da versão nova, copie a pasta **`www`** e o arquivo **`VERSAO.txt`** para a sua pasta `CartaoPonto`,
   substituindo.
4. **Nunca apague a pasta `dados`**: é onde fica a configuração do relógio.

## O que o programa mostra

- **HORAS PRÁTICAS** — o relógio puro, minuto a minuto.
- **HORA FECHADA** — depois da tolerância legal: até 5 minutos por batida e 10 no dia não contam;
  passou disso, vale a diferença inteira (CLT art. 58, §1º).
- **FERIADO** sem jornada prevista; **PONTO FACULTATIVO** é dia normal, só marcado.
- **PARA CONFERIR** — batida esquecida, repetida ou inválida: fica fora da hora fechada até alguém conferir.
- **Relatório por colaborador** — uma página por colaborador e por mês, para imprimir ou salvar em PDF.

---

## Para quem vai mexer no código

Este repositório tem uma única versão (a `main`) e quatro partes:

| Pasta | O que é |
|---|---|
| `ponto/` | O contador de horas (HTML e JavaScript). É também o que vai para o site `fortman.com.br/ponto/`. |
| `programa/` | O que só existe no programa de Windows: download do relógio Control iD (`relogio.php`, `js/relogio.js`) e a configuração da janela. |
| `ferramentas/montar_pacote.sh` | Junta o motor **PHP Desktop** (código aberto, baixado da página oficial e conferido pelo SHA-256) com `ponto/` e `programa/`, formando o programa pronto. |
| `testes/` | Testes do cálculo, de uma calculadora independente, do navegador, do relógio e do programa montado. |

Por que o motor não fica nas pastas do repositório: o arquivo principal dele (`libcef.dll`) tem 220 MB, e o
GitHub não aceita arquivo com mais de 100 MB dentro do repositório. Por isso, a cada envio para a `main`, o
GitHub (`.github/workflows/programa.yml`) roda os testes, baixa o motor oficial, monta o programa e publica o
`CartaoPonto-Windows.zip` em **Releases**, que aceita arquivos grandes.

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
