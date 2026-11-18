<?php
/**
 * Testes do complementos/ponto/relogio.php contra um relógio falso local.
 *   php testes/test_relogio.php
 * Roda os cenários com cURL e com streams (os dois transportes do PHP Desktop).
 */
declare(strict_types=1);

define('RELOGIO_SEM_ROTEADOR', true);
$temporaria = sys_get_temp_dir() . '/relogio_teste_' . getmypid();
@mkdir($temporaria);
define('RELOGIO_CONFIG', $temporaria . '/relogio.json');
if (in_array('--streams', $argv, true)) { define('RELOGIO_FORCAR_STREAMS', true); }
require __DIR__ . '/../programa/relogio.php';

$falhas = 0;
$testes = 0;
function ok(bool $condicao, string $descricao, string $detalhe = ''): void
{
    global $falhas, $testes;
    $testes++;
    if ($condicao) { echo "  ok   $descricao\n"; } else { $falhas++; echo "  FALHA $descricao" . ($detalhe ? "  ->  $detalhe" : '') . "\n"; }
}

$cenario = $temporaria . '/cenario.txt';
file_put_contents($cenario, 'ok');
$porta = 18000 + getmypid() % 1000;
$servidor = proc_open(
    [PHP_BINARY, '-S', "127.0.0.1:$porta", __DIR__ . '/relogio_falso.php'],
    [1 => ['file', '/dev/null', 'w'], 2 => ['file', '/dev/null', 'w']],
    $canos, null, ['RELOGIO_FALSO_CENARIO' => $cenario] + getenv()
);
usleep(400000);

function tentar(array $config): array
{
    try {
        return ['ok' => true, 'r' => baixar_afd($config, 2026, 9)];
    } catch (ErroRelogio $e) {
        return ['ok' => false, 'erro' => $e->getMessage(), 'status' => $e->status];
    }
}
function cenario(string $nome): void { global $cenario; file_put_contents($cenario, $nome); }

$base = ['ip' => "127.0.0.1:$porta", 'usuario' => 'admin', 'senha' => 'segredo', 'modo' => ''];
$comHttp = $base + ['permitirHttp' => true];
$semHttp = $base + ['permitirHttp' => false];

echo "\nTransporte: " . (defined('RELOGIO_FORCAR_STREAMS') ? 'streams' : 'cURL') . "\n";

ok(!ip_interno('127.0.0.1') && !ip_interno('8.8.8.8') && ip_interno('192.168.1.99') && ip_interno('10.0.0.5:8443'),
    'só aceita IP de rede interna');
ok(parece_afd("0000000001112345678000195\r\n") && !parece_afd('{"success":false}') && !parece_afd('<html>') && !parece_afd(''),
    'reconhece o cabeçalho do AFD e recusa JSON, HTML e vazio');

cenario('ok');
$r = tentar($semHttp);
ok(!$r['ok'] && strpos($r['erro'], 'HTTPS') !== false, 'sem HTTPS e sem permissão: não cai para HTTP', $r['erro'] ?? 'baixou');

$r = tentar($comHttp);
ok($r['ok'] && parece_afd($r['r']['afd']), 'com HTTP permitido: baixa o AFD', $r['erro'] ?? '');
ok($r['ok'] && count($r['r']['nomes']) === 151 && $r['r']['avisoNomes'] === '', 'lê os 151 usuários em duas páginas, sem aviso');

$r = tentar(['senha' => 'errada'] + $comHttp);
ok(!$r['ok'] && $r['status'] === 401, 'senha errada: recusa com mensagem clara', $r['erro'] ?? '');

foreach (['json-erro' => 'JSON de erro', 'html' => 'página HTML', 'vazio' => 'resposta vazia'] as $c => $rotulo) {
    cenario($c);
    $r = tentar($comHttp);
    ok(!$r['ok'] && strpos($r['erro'], 'não é um AFD') !== false, "$rotulo com HTTP 200 não vira AFD", $r['erro'] ?? 'aceitou');
}

cenario('login-redireciona');
$r = tentar($comHttp);
ok(!$r['ok'] && strpos($r['erro'], 'redirecion') !== false, 'login redirecionado: não segue o redirecionamento', $r['erro'] ?? 'seguiu');

cenario('afd-redireciona');
$r = tentar($comHttp);
ok(!$r['ok'] && strpos($r['erro'], '302') !== false, 'AFD redirecionado: não segue', $r['erro'] ?? 'seguiu');

cenario('nomes-incompletos');
$r = tentar($comHttp);
ok($r['ok'] && strpos($r['r']['avisoNomes'], 'incompleta') !== false, 'lista de usuários interrompida: avisa', $r['r']['avisoNomes'] ?? '');

cenario('nomes-falham');
$r = tentar($comHttp);
ok($r['ok'] && strpos($r['r']['avisoNomes'], 'Não consegui ler') !== false, 'lista de usuários indisponível: AFD sai com aviso');

gravar_config(['ip' => '192.168.1.99', 'usuario' => 'u', 'senha' => 's', 'modo' => '', 'permitirHttp' => false]);
$c = ler_config();
ok($c['usuario'] === 'u' && !file_exists(RELOGIO_CONFIG . '.tmp'), 'grava a configuração sem deixar arquivo temporário');

proc_terminate($servidor);
@unlink(RELOGIO_CONFIG);
@unlink($cenario);
@rmdir($temporaria);
echo "\n" . ($falhas === 0 ? 'TODOS OS TESTES DO RELÓGIO PASSARAM' : "FALHAS: $falhas") . "  ($testes verificacoes)\n";
exit($falhas === 0 ? 0 : 1);
