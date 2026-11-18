#!/usr/bin/env bash
# Confere o programa montado por ferramentas/montar_pacote.sh.
#   bash testes/test_pacote.sh [pasta-do-pacote]   (padrão: dist/CartaoPonto)
set -euo pipefail
P="${1:-dist/CartaoPonto}"
falhas=0
ok() { if eval "$1"; then echo "  ok   $2"; else echo "  FALHA $2"; falhas=$((falhas + 1)); fi; }

echo
echo "Programa pronto em $P"
ok '[ -f "$P/CartaoPonto.exe" ]' 'CartaoPonto.exe presente'
ok '[ ! -e "$P/phpdesktop-chrome.exe" ]' 'sem o nome antigo do executável'
ok '[ -f "$P/libcef.dll" ] && [ -d "$P/locales" ] && [ -f "$P/resources.pak" ]' 'motor do Chromium completo'
ok '[ -f "$P/php/php-cgi.exe" ]' 'PHP presente'
ok 'grep -q "^extension=php_curl.dll" "$P/php/php.ini" && grep -q "^extension=php_openssl.dll" "$P/php/php.ini"' 'cURL e OpenSSL ligados (download do relógio)'
ok 'grep -q "^date.timezone=America/Sao_Paulo" "$P/php/php.ini"' 'fuso de Brasília'
ok 'python3 -c "import json,sys; d=json.load(open(sys.argv[1])); assert d[\"web_server\"][\"www_directory\"]==\"www\"; assert d[\"web_server\"][\"cgi_interpreter\"]==\"php/php-cgi.exe\"; assert \"Cartão Ponto\" in d[\"main_window\"][\"title\"]" "$P/settings.json"' 'settings.json do Cartão Ponto'
ok '[ -f "$P/www/index.html" ] && grep -q "ponto/index.html" "$P/www/index.html"' 'abre direto no contador de horas'
ok '[ ! -e "$P/www/phpinfo.php" ] && [ ! -e "$P/www/index.php" ]' 'sem as páginas de demonstração do PHP Desktop'
ok '[ -f "$P/www/ponto/relogio.php" ] && [ -f "$P/www/ponto/js/relogio.js" ]' 'download do relógio incluído'
ok 'grep -q "js/relogio.js" "$P/www/ponto/index.html" && grep -q "js/versao.js" "$P/www/ponto/index.html"' 'scripts do relógio e da versão na página'
ok 'grep -q "LEITOR_AFD_MONTAGEM" "$P/www/ponto/js/versao.js"' 'versão do programa no rodapé do relatório'
ok '[ -f "$P/www/ponto/js/relatorio.js" ] && [ -f "$P/www/ponto/js/afd_parser.js" ]' 'relatório e cálculo incluídos'
ok '[ -f "$P/licencas/PHP-Desktop-licenca.txt" ] && [ -f "$P/licencas/PHP-licenca.txt" ]' 'licenças do motor incluídas'
ok '[ -f "$P/LEIA-ME.txt" ] && [ -f "$P/VERSAO.txt" ]' 'LEIA-ME e VERSAO'
ok '[ ! -e "$P/dados" ]' 'nenhum dado de usuário no pacote'
ok 'php -l "$P/www/ponto/relogio.php" > /dev/null' 'relogio.php sem erro de sintaxe'

echo
if [ "$falhas" -eq 0 ]; then echo 'TODOS OS TESTES DO PACOTE PASSARAM'; else echo "FALHAS: $falhas"; exit 1; fi
