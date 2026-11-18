<?php
/**
 * relogio.php — Busca o AFD direto no relógio de ponto Control iD da rede local.
 *
 * Só existe na versão para o computador (PHP Desktop). O navegador não conversa
 * com o relógio sozinho: o certificado dele é autoassinado e ele não libera
 * pedidos de outras páginas. Quem conversa é este arquivo, e devolve o AFD.
 *
 * Ações (?acao=...):
 *   config  GET   endereço, leiaute e se há acesso salvo (usuário e senha nunca voltam)
 *   salvar  POST  {ip, usuario, senha, modo, permitirHttp}; campo vazio mantém o anterior
 *   baixar  POST  {ano, mes}; devolve {afd (base64), nomes: [{doc, nome}], avisoNomes}: o AFD
 *                 a partir do dia 1 daquele mês e os nomes cadastrados no relógio, que o AFD
 *                 do REP-C costuma não trazer
 *
 * Segurança: só IP de rede interna; HTTPS por padrão (HTTP só se marcado na configuração);
 * nunca segue redirecionamento; só aceita como AFD um conteúdo que começa com o cabeçalho
 * do AFD. A configuração fica em dados/relogio.json, na mesma pasta de dados do BordaMax.
 *
 * Para testes, defina RELOGIO_SEM_ROTEADOR antes de incluir: só as funções são carregadas.
 */

declare(strict_types=1);

if (!defined('RELOGIO_CONFIG')) {
    define('RELOGIO_CONFIG', __DIR__ . '/../../dados/relogio.json');
}

/** Erro com mensagem para a pessoa e status HTTP da resposta. */
final class ErroRelogio extends RuntimeException
{
    public int $status;

    public function __construct(string $mensagem, int $status = 400)
    {
        parent::__construct($mensagem);
        $this->status = $status;
    }
}

function falhar(string $mensagem, int $status = 400): void
{
    throw new ErroRelogio($mensagem, $status);
}

function ler_config(): array
{
    $padrao = ['ip' => '192.168.1.99', 'usuario' => '', 'senha' => '', 'modo' => '', 'permitirHttp' => false];
    if (!is_file(RELOGIO_CONFIG)) {
        return $padrao;
    }
    $lido = json_decode((string) file_get_contents(RELOGIO_CONFIG), true);
    return is_array($lido) ? array_merge($padrao, array_intersect_key($lido, $padrao)) : $padrao;
}

function gravar_config(array $config): void
{
    $pasta = dirname(RELOGIO_CONFIG);
    if (!is_dir($pasta) && !@mkdir($pasta, 0775, true)) {
        falhar('Não consegui criar a pasta "dados" ao lado do programa.', 500);
    }
    // grava num temporário e troca: uma queda no meio não deixa o arquivo pela metade
    $temporario = RELOGIO_CONFIG . '.tmp';
    $json = json_encode($config, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    if (@file_put_contents($temporario, $json) === false || !@rename($temporario, RELOGIO_CONFIG)) {
        @unlink($temporario);
        falhar('Não consegui gravar dados/relogio.json. Confira se a pasta do programa permite gravação.', 500);
    }
}

/**
 * Só aceita IP de rede interna, com porta opcional (192.168.1.99 ou 192.168.1.99:8443):
 * este arquivo não pode virar ponte para a internet.
 */
function ip_interno(string $endereco): bool
{
    if (!preg_match('/^([0-9.]+)(?::(\d{1,5}))?$/', $endereco, $m)) {
        return false;
    }
    if (isset($m[2]) && ((int) $m[2] < 1 || (int) $m[2] > 65535)) {
        return false;
    }
    if (!filter_var($m[1], FILTER_VALIDATE_IP, FILTER_FLAG_IPV4)) {
        return false;
    }
    return !filter_var($m[1], FILTER_VALIDATE_IP, FILTER_FLAG_IPV4 | FILTER_FLAG_NO_PRIV_RANGE);
}

/**
 * POST com corpo JSON. O relógio usa certificado autoassinado, por isso a
 * verificação do certificado fica desligada — e só para IPs da rede interna.
 * Redirecionamentos nunca são seguidos (o pedido de login leva a senha).
 *
 * @return array{0:int,1:string} status HTTP e corpo; status 0 = não conectou
 */
function postar(string $url, array $corpo, int $limite): array
{
    $json = json_encode($corpo === [] ? new stdClass() : $corpo);

    if (function_exists('curl_init') && !defined('RELOGIO_FORCAR_STREAMS')) {
        $c = curl_init($url);
        curl_setopt_array($c, [
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => $json,
            CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_CONNECTTIMEOUT => 8,
            CURLOPT_TIMEOUT        => $limite,
            CURLOPT_SSL_VERIFYPEER => false,
            CURLOPT_SSL_VERIFYHOST => 0,
        ]);
        $resposta = curl_exec($c);
        $status = (int) curl_getinfo($c, CURLINFO_HTTP_CODE);
        curl_close($c);
        return [$resposta === false ? 0 : $status, $resposta === false ? '' : (string) $resposta];
    }

    if (str_starts_with($url, 'https:') && !extension_loaded('openssl')) {
        return [0, ''];
    }
    $contexto = stream_context_create([
        'http' => [
            'method'          => 'POST',
            'header'          => "Content-Type: application/json\r\n",
            'content'         => $json,
            'timeout'         => $limite,
            'ignore_errors'   => true,
            'follow_location' => 0,
            'max_redirects'   => 1,
        ],
        'ssl' => ['verify_peer' => false, 'verify_peer_name' => false, 'allow_self_signed' => true],
    ]);
    $resposta = @file_get_contents($url, false, $contexto);
    if ($resposta === false) {
        return [0, ''];
    }
    $status = 0;
    foreach ($http_response_header ?? [] as $linha) {
        if (preg_match('#^HTTP/\S+\s+(\d{3})#', $linha, $m)) {
            $status = (int) $m[1];
        }
    }
    return [$status, $resposta];
}

function mensagem_do_relogio(string $corpo): string
{
    $j = json_decode($corpo, true);
    return is_array($j) && isset($j['error']) ? (string) $j['error'] : '';
}

/**
 * Limpa o que o relógio mandou antes de conferir: tira a marca BOM e, se o
 * texto veio em UTF-16 (um byte zero entre as letras), volta para texto simples.
 */
function normalizar_afd(string $conteudo): string
{
    if (strncmp($conteudo, "\xFF\xFE", 2) === 0 || strncmp($conteudo, "\xFE\xFF", 2) === 0) {
        $conteudo = substr($conteudo, 2);
    }
    if (strpos(substr($conteudo, 0, 200), "\0") !== false) {
        $conteudo = str_replace("\0", '', $conteudo);
    }
    return (string) preg_replace('/^\xEF\xBB\xBF/', '', $conteudo);
}

/**
 * O conteúdo parece um AFD? A primeira linha útil precisa começar como um registro
 * do AFD: NSR de 9 dígitos seguido do tipo do registro (1 a 9). Com o filtro por data,
 * alguns relógios mandam só os registros do período, sem o cabeçalho (tipo 1); por isso
 * qualquer tipo é aceito. JSON de erro, página HTML ou resposta vazia não passam.
 */
function parece_afd(string $conteudo): bool
{
    foreach (preg_split('/\r\n|\n|\r/', normalizar_afd($conteudo)) as $linha) {
        if (trim($linha) === '') {
            continue;
        }
        return (bool) preg_match('/^\d{9}[1-9]/', ltrim($linha));
    }
    return false;
}

/**
 * Guarda a resposta que não foi reconhecida, para diagnóstico, em dados/resposta-do-relogio.txt
 * (no computador de quem usa). Devolve um resumo seguro: tamanho e começo, com os dígitos
 * depois do décimo trocados por # (não expõe CPF nem PIS na tela).
 */
function guardar_resposta_estranha(string $conteudo): string
{
    $pasta = dirname(RELOGIO_CONFIG);
    if (is_dir($pasta) || @mkdir($pasta, 0775, true)) {
        @file_put_contents($pasta . '/resposta-do-relogio.txt', $conteudo);
    }
    $inicio = substr(preg_replace('/\s+/', ' ', $conteudo), 0, 40);
    $contador = 0;
    $inicio = preg_replace_callback('/\d/', function ($m) use (&$contador) {
        return ++$contador > 10 ? '#' : $m[0];
    }, $inicio);
    $inicio = preg_replace('/[^\x20-\x7E]/', '?', $inicio);
    return strlen($conteudo) . ' bytes, começando com "' . $inicio . '"';
}

/**
 * Nomes cadastrados no relógio — a mesma lista da página Usuários (#page=users), com
 * NOME e PIS —, lida por load_users.fcgi em páginas de 100. Sai por PIS e por CPF.
 * Falhar aqui não impede o AFD, mas vira aviso para a pessoa.
 *
 * @return array{nomes:list<array{doc:string,nome:string}>,aviso:string}
 */
function nomes_do_relogio(string $base, string $sessao): array
{
    $usuarios = [];
    $vistos = [];
    $aviso = '';
    for ($offset = 0; $offset < 20000; $offset += 100) {
        [$status, $corpo] = postar("$base/load_users.fcgi?session=" . rawurlencode($sessao),
            ['limit' => 100, 'offset' => $offset], 30);
        $lido = $status === 200 ? json_decode($corpo, true) : null;
        $pagina = is_array($lido) ? ($lido['users'] ?? null) : null;
        if (!is_array($pagina)) {
            $aviso = $offset === 0
                ? 'Não consegui ler a lista de usuários do relógio; os nomes podem faltar.'
                : 'A lista de usuários do relógio veio incompleta (parou em ' . count($usuarios) . '); alguns nomes podem faltar.';
            break;
        }
        if ($pagina === []) {
            break;
        }
        $novos = 0;
        foreach ($pagina as $u) {
            $chave = (string) ($u['id'] ?? json_encode($u));
            if (!isset($vistos[$chave])) {
                $vistos[$chave] = true;
                $usuarios[] = $u;
                $novos++;
            }
        }
        // Relógio que ignora limit/offset devolve tudo de uma vez: a página seguinte não traz ninguém novo.
        if ($novos === 0 || count($pagina) < 100) {
            break;
        }
    }
    $nomes = [];
    foreach ($usuarios as $u) {
        $nome = trim((string) ($u['name'] ?? ''));
        if ($nome === '') {
            continue;
        }
        foreach (['pis', 'cpf'] as $campo) {
            $doc = preg_replace('/\D/', '', (string) ($u[$campo] ?? ''));
            if ($doc !== '' && (int) $doc !== 0) {
                $nomes[] = ['doc' => $doc, 'nome' => $nome];
            }
        }
    }
    return ['nomes' => $nomes, 'aviso' => $aviso];
}

/** @return array{afd:string,nomes:list<array{doc:string,nome:string}>,avisoNomes:string,semCabecalho:bool} */
function baixar_afd(array $config, int $ano, int $mes): array
{
    if (!function_exists('curl_init') && !extension_loaded('openssl')) {
        falhar('O PHP do programa está sem as extensões curl e openssl. Abra a pasta "php", edite o '
            . 'php.ini com o Bloco de Notas, apague o ponto e vírgula do começo das linhas '
            . ';extension=curl e ;extension=openssl, salve e abra o programa de novo.', 500);
    }

    $credenciais = ['login' => $config['usuario'], 'password' => $config['senha']];
    $esquemas = !empty($config['permitirHttp']) ? ['https', 'http'] : ['https'];
    $base = null;
    $status = 0;
    $corpo = '';
    foreach ($esquemas as $esquema) {
        [$status, $corpo] = postar("$esquema://{$config['ip']}/login.fcgi", $credenciais, 15);
        if ($status !== 0) {
            $base = "$esquema://{$config['ip']}";
            break;
        }
    }
    if ($base === null) {
        falhar("Não consegui falar com o relógio em {$config['ip']} por conexão segura (HTTPS). Confira se este "
            . 'computador está na mesma rede do relógio e se o endereço é o mesmo que você abre no Chrome.'
            . (empty($config['permitirHttp']) ? ' Se o relógio só aceitar HTTP, marque essa opção em Configurar relógio.' : ''), 502);
    }
    if ($status >= 300 && $status < 400) {
        falhar("O relógio em {$config['ip']} pediu para redirecionar a conexão (HTTP $status). Por segurança, o "
            . 'programa não segue redirecionamentos: confira o endereço.', 502);
    }

    $sessao = (string) ((json_decode($corpo, true) ?: [])['session'] ?? '');
    if ($sessao === '') {
        $detalhe = mensagem_do_relogio($corpo);
        if ($status === 401 || $status === 403 || $detalhe !== '') {
            falhar('O relógio recusou o usuário ou a senha' . ($detalhe !== '' ? " ($detalhe)" : '')
                . '. Use os mesmos que você digita no Chrome.', 401);
        }
        falhar("O endereço {$config['ip']} respondeu, mas não como um relógio Control iD (HTTP $status). "
            . 'Confira o endereço.', 502);
    }

    $consulta = 'session=' . rawurlencode($sessao) . ($config['modo'] === '671' ? '&mode=671' : '');
    [$statusAfd, $afd] = postar("$base/get_afd.fcgi?$consulta",
        ['initial_date' => ['day' => 1, 'month' => $mes, 'year' => $ano]], 180);
    $nomes = ['nomes' => [], 'aviso' => ''];
    if ($statusAfd === 200 && parece_afd($afd)) {
        $nomes = nomes_do_relogio($base, $sessao);
    }
    postar("$base/logout.fcgi?session=" . rawurlencode($sessao), [], 5);

    if ($statusAfd !== 200) {
        $detalhe = mensagem_do_relogio($afd);
        falhar('O relógio não entregou o AFD' . ($detalhe !== '' ? ": $detalhe" : " (resposta HTTP $statusAfd)") . '.', 502);
    }
    if (!parece_afd($afd)) {
        $detalhe = mensagem_do_relogio($afd);
        $resumo = guardar_resposta_estranha($afd);
        falhar('O relógio respondeu, mas o conteúdo não é um AFD' . ($detalhe !== '' ? " ($detalhe)" : '')
            . ". Recebido: $resumo. A resposta completa foi guardada em dados\\resposta-do-relogio.txt, na pasta do programa."
            . ' Enquanto isso, baixe pelo Chrome e abra o arquivo no contador.', 502);
    }
    $afd = normalizar_afd($afd);
    return ['afd' => $afd, 'nomes' => $nomes['nomes'], 'avisoNomes' => $nomes['aviso'],
        'semCabecalho' => !preg_match('/^\s*\d{9}1/', $afd)];
}

/** Atende o pedido da página (?acao=...). */
function atender(): void
{
    $acao = $_GET['acao'] ?? '';
    // Pedidos de gravação e download só valem vindos da própria página (fetch com este cabeçalho).
    if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_SERVER['HTTP_X_RELOGIO'] ?? '') !== '1') {
        falhar('Pedido recusado.', 403);
    }
    $entrada = json_decode((string) file_get_contents('php://input'), true) ?: [];

    if ($acao === 'config') {
        $c = ler_config();
        // Usuário e senha nunca voltam para a tela: os campos abrem em branco.
        responder(200, ['ip' => $c['ip'], 'tem_acesso' => $c['usuario'] !== '' && $c['senha'] !== '',
            'modo' => $c['modo'], 'permitirHttp' => !empty($c['permitirHttp'])]);
        return;
    }

    if ($acao === 'salvar' && $_SERVER['REQUEST_METHOD'] === 'POST') {
        $c = ler_config();
        $ip = trim((string) ($entrada['ip'] ?? ''));
        if (!ip_interno($ip)) {
            falhar('Informe o IP do relógio na rede interna, como 192.168.1.99 (sem https:// e sem barra; porta opcional, como 192.168.1.99:8443).');
        }
        $c['ip'] = $ip;
        // Campo deixado em branco mantém o que já estava salvo.
        if (trim((string) ($entrada['usuario'] ?? '')) !== '') {
            $c['usuario'] = trim((string) $entrada['usuario']);
        }
        if ((string) ($entrada['senha'] ?? '') !== '') {
            $c['senha'] = (string) $entrada['senha'];
        }
        $c['modo'] = ($entrada['modo'] ?? '') === '671' ? '671' : '';
        $c['permitirHttp'] = !empty($entrada['permitirHttp']);
        gravar_config($c);
        responder(200, ['ok' => true]);
        return;
    }

    if ($acao === 'baixar' && $_SERVER['REQUEST_METHOD'] === 'POST') {
        @set_time_limit(240);
        $ano = (int) ($entrada['ano'] ?? 0);
        $mes = (int) ($entrada['mes'] ?? 0);
        if ($ano < 2000 || $ano > 2100 || $mes < 1 || $mes > 12) {
            falhar('Escolha um mês válido.');
        }
        $c = ler_config();
        if (!ip_interno($c['ip'])) {
            falhar('Configure primeiro o endereço do relógio.');
        }
        $r = baixar_afd($c, $ano, $mes);
        responder(200, ['afd' => base64_encode($r['afd']), 'nomes' => $r['nomes'], 'avisoNomes' => $r['avisoNomes'],
            'semCabecalho' => $r['semCabecalho']]);
        return;
    }

    falhar('Ação desconhecida.', 404);
}

function responder(int $status, array $dados): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($dados, JSON_UNESCAPED_UNICODE);
}

if (!defined('RELOGIO_SEM_ROTEADOR')) {
    try {
        atender();
    } catch (ErroRelogio $e) {
        responder($e->status, ['erro' => $e->getMessage()]);
    }
}
