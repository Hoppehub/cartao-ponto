<?php
/**
 * Relógio Control iD de mentira, para testes/test_relogio.php (php -S ... relogio_falso.php).
 * O comportamento vem do arquivo indicado em RELOGIO_FALSO_CENARIO: login ok/recusado,
 * AFD válido, JSON de erro, HTML, vazio, redirecionamento e lista de usuários em páginas.
 */
declare(strict_types=1);

$cenario = trim((string) @file_get_contents((string) getenv('RELOGIO_FALSO_CENARIO'))) ?: 'ok';
$rota = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$corpo = json_decode((string) file_get_contents('php://input'), true) ?: [];
header('Content-Type: application/json');

$afd = "0000000001112345678000195000000000000EMPRESA FICTICIA LTDA" . str_repeat(' ', 100) . "\r\n"
     . "0000000023010920260655012065478502\r\n";

switch ($rota) {
    case '/login.fcgi':
        if ($cenario === 'login-redireciona') {
            header('Location: http://10.0.0.1/roubar');
            http_response_code(302);
            echo '{}';
            break;
        }
        if (($corpo['login'] ?? '') !== 'admin' || ($corpo['password'] ?? '') !== 'segredo') {
            http_response_code(401);
            echo '{"error":"Invalid credentials"}';
            break;
        }
        echo '{"session":"abc"}';
        break;
    case '/get_afd.fcgi':
        if ($cenario === 'json-erro') { echo '{"success":false}'; break; }
        if ($cenario === 'html') { header('Content-Type: text/html'); echo '<html><body>Erro</body></html>'; break; }
        if ($cenario === 'vazio') { echo ''; break; }
        if ($cenario === 'afd-redireciona') { header('Location: /outro'); http_response_code(302); break; }
        header('Content-Type: application/octet-stream');
        echo $afd;
        break;
    case '/load_users.fcgi':
        $offset = (int) ($corpo['offset'] ?? 0);
        if ($cenario === 'nomes-falham' || ($cenario === 'nomes-incompletos' && $offset >= 100)) {
            http_response_code(500);
            echo '{"error":"falha"}';
            break;
        }
        $todos = [];
        for ($i = 0; $i < 150; $i++) { $todos[] = ['id' => $i + 10, 'name' => "Ficticio $i", 'pis' => 99000000000 + $i]; }
        $todos[] = ['id' => 1, 'name' => 'Ana Ficticia', 'pis' => 12065478502];
        echo json_encode(['users' => array_slice($todos, $offset, (int) ($corpo['limit'] ?? 1000))]);
        break;
    case '/logout.fcgi':
        echo '{}';
        break;
    default:
        http_response_code(404);
        echo '{"error":"rota"}';
}
