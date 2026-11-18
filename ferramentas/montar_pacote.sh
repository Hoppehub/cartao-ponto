#!/usr/bin/env bash
# Monta o programa pronto para Windows: o motor PHP Desktop (oficial, conferido pelo
# SHA-256) com o contador de horas por dentro. O resultado é a pasta CartaoPonto/,
# que vira o CartaoPonto-Windows.zip publicado em "Releases".
#
# Uso, na raiz do repositório:
#   bash ferramentas/montar_pacote.sh [arquivo-do-motor.zip] [pasta-de-saída]
# Sem o arquivo do motor, ele é baixado da página oficial do PHP Desktop.
#
# O que vai para dentro:
#   CartaoPonto.exe            o phpdesktop-chrome.exe, só com outro nome
#   settings.json              programa/settings.json (janela "Cartão Ponto")
#   www/index.html             programa/inicio.html (abre o contador de horas)
#   www/ponto/                 o contador de horas (pasta ponto/) + relogio.php e relogio.js
#   php/, locales/, .dll, ...  o motor, sem alteração (só o fuso do php.ini)
#   licencas/, LEIA-ME.txt, VERSAO.txt
# Nada de "dados" vai no pacote: a pasta é criada no computador de quem usa.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

MOTOR_VERSAO="chrome-v130.1"
MOTOR_ARQUIVO="phpdesktop-chrome-130.1-php-8.3.zip"
MOTOR_PASTA="phpdesktop-chrome-130.1-php-8.3"
MOTOR_URL="https://github.com/cztomczak/phpdesktop/releases/download/$MOTOR_VERSAO/$MOTOR_ARQUIVO"
MOTOR_SHA256="50d1f26f0e268aa85862b3a5943e3e04de30d8ce4ee2b0ce920feccf8d96d0b4"

MOTOR_ZIP="${1:-}"
SAIDA="${2:-dist}"
OBRA=$(mktemp -d)
trap 'rm -rf "$OBRA"' EXIT

if [ -z "$MOTOR_ZIP" ]; then
    MOTOR_ZIP="$OBRA/$MOTOR_ARQUIVO"
    echo "Baixando o motor PHP Desktop ($MOTOR_VERSAO)..."
    curl -sSfL -o "$MOTOR_ZIP" "$MOTOR_URL"
fi

# O motor só entra se for exatamente o arquivo oficial conferido.
echo "$MOTOR_SHA256  $MOTOR_ZIP" | sha256sum -c --quiet - || {
    echo "O arquivo do motor não confere com o SHA-256 esperado. Montagem cancelada." >&2
    exit 1
}

unzip -q "$MOTOR_ZIP" -d "$OBRA"
MOTOR="$OBRA/$MOTOR_PASTA"
[ -f "$MOTOR/phpdesktop-chrome.exe" ] || { echo "Estrutura do motor inesperada." >&2; exit 1; }

PACOTE="$SAIDA/CartaoPonto"
rm -rf "$PACOTE"
mkdir -p "$PACOTE"

# Motor, sem a página de demonstração (www) e sem a configuração de exemplo.
cp -r "$MOTOR/." "$PACOTE/"
rm -rf "$PACOTE/www" "$PACOTE/settings.json"
mv "$PACOTE/phpdesktop-chrome.exe" "$PACOTE/CartaoPonto.exe"
sed -i 's#^date.timezone=.*#date.timezone=America/Sao_Paulo#' "$PACOTE/php/php.ini"

# Contador de horas e o download do relógio.
mkdir -p "$PACOTE/www"
cp -r ponto "$PACOTE/www/ponto"
cp programa/relogio.php "$PACOTE/www/ponto/relogio.php"
cp programa/js/relogio.js "$PACOTE/www/ponto/js/relogio.js"
cp programa/inicio.html "$PACOTE/www/index.html"
INDICE="$PACOTE/www/ponto/index.html"
grep -q '<script src="js/leitor_afd.js"></script>' "$INDICE"
sed -i 's|<script src="js/leitor_afd.js"></script>|<script src="js/versao.js"></script>\n&\n<script src="js/relogio.js"></script>|' "$INDICE"

VERSAO_CALCULO=$(sed -n "s/^ *var VERSAO = '\([^']*\)';.*/\1/p" ponto/js/afd_parser.js | head -1)
COMMIT=$(git rev-parse --short HEAD)
printf "window.LEITOR_AFD_MONTAGEM = 'programa %s';\n" "$COMMIT" > "$PACOTE/www/ponto/js/versao.js"

cp programa/settings.json "$PACOTE/settings.json"
cp programa/LEIA-ME.txt "$PACOTE/LEIA-ME.txt"
mkdir -p "$PACOTE/licencas"
cp licencas/* "$PACOTE/licencas/"
cp "$PACOTE/php/license.txt" "$PACOTE/licencas/PHP-licenca.txt"

cat > "$PACOTE/VERSAO.txt" <<TXT
Cartão Ponto - Fortman
Versão do cálculo: $VERSAO_CALCULO
Código: Hoppehub/cartao-ponto, commit $COMMIT
Motor: PHP Desktop $MOTOR_VERSAO ($MOTOR_ARQUIVO, SHA-256 $MOTOR_SHA256)
Montado em: $(date -u +%Y-%m-%dT%H:%MZ)
TXT

echo "Programa montado em $PACOTE (cálculo $VERSAO_CALCULO, commit $COMMIT)."
