/*
 * Testes da página no navegador (Chromium via Playwright).
 *   node testes/test_navegador.js
 *
 * Confere que a tela, o relatório por colaborador e o CSV mostram os mesmos
 * totais de HORAS PRÁTICAS e HORA FECHADA para cada colaborador, que só a
 * última carga desenha a tela e que a API LeitorAFD.carregar aplica o período.
 * Sem o Playwright instalado, o teste é pulado (saída 0).
 */
'use strict';

var fs = require('fs');
var http = require('http');
var path = require('path');

var playwright;
try { playwright = require('playwright'); } catch (e) {
    console.log('Playwright não instalado: testes de navegador pulados.');
    process.exit(0);
}

var AFD = require('../ponto/js/afd_parser.js');
var RAIZ = path.join(__dirname, '..');
var falhas = 0;
var testes = 0;

function ok(condicao, descricao, detalhe) {
    testes += 1;
    if (condicao) { console.log('  ok   ' + descricao); } else {
        falhas += 1;
        console.log('  FALHA ' + descricao + (detalhe !== undefined ? '  ->  ' + detalhe : ''));
    }
}
function igual(a, b, descricao) { ok(a === b, descricao, 'recebido ' + JSON.stringify(a) + ', esperado ' + JSON.stringify(b)); }

/* AFD fictício de setembro/2026 no leiaute 1.510, com variações, uma batida esquecida e um sábado */
function afdDeTeste() {
    var linhas = fs.readFileSync(path.join(RAIZ, 'ponto/exemplos/afd_1510_exemplo.txt'), 'utf8').split(/\r?\n/);
    var saida = linhas.slice(0, 6);
    var trailer = linhas.filter(function (l) { return l.charAt(9) === '9'; })[0];
    var pis = ['012065478502', '020987654327', '012345678900', '010987654320'];
    var nsr = 7;
    var semente = 7;
    function sorteio(min, max) { semente = (semente * 1103515245 + 12345) % 2147483648; return min + (semente % (max - min + 1)); }
    function hhmm(min) { return ('0' + Math.floor(min / 60)).slice(-2) + ('0' + (min % 60)).slice(-2); }
    for (var dia = 1; dia <= 30; dia++) {
        var data = new Date(Date.UTC(2026, 8, dia));
        var dow = data.getUTCDay();
        pis.forEach(function (p, i) {
            if (dow === 0 || (dow === 6 && i !== 1)) { return; }
            var base = dow === 6 ? [420, 660] : [415, 715, 775, dow === 5 ? 955 : 1015];
            var horas = base.map(function (m) { return m + sorteio(-6, 6); });
            if (dia === 15 && i === 0) { horas = horas.slice(0, 3); }
            horas.forEach(function (m) {
                saida.push(('00000000' + nsr++).slice(-9) + '3' + ('0' + dia).slice(-2) + '092026' + hhmm(m) + p);
            });
        });
    }
    saida.push(trailer);
    return saida.join('\r\n') + '\r\n';
}

function servidor() {
    return new Promise(function (resolve) {
        var srv = http.createServer(function (req, res) {
            var arq = path.join(RAIZ, decodeURIComponent(req.url.split('?')[0]));
            if (arq.indexOf(RAIZ) !== 0 || !fs.existsSync(arq) || fs.statSync(arq).isDirectory()) {
                res.writeHead(404); res.end(); return;
            }
            var tipo = /\.html$/.test(arq) ? 'text/html' : (/\.js$/.test(arq) ? 'text/javascript' : 'text/plain');
            res.writeHead(200, { 'Content-Type': tipo + '; charset=utf-8' });
            fs.createReadStream(arq).pipe(res);
        });
        srv.listen(0, '127.0.0.1', function () { resolve(srv); });
    });
}

/* "+08:52 (1 para conferir fora da soma)" -> minutos */
function minutos(texto) {
    var m = /([+-]?)(\d+):(\d{2})/.exec(texto || '');
    if (!m) { return null; }
    var v = Number(m[2]) * 60 + Number(m[3]);
    return m[1] === '-' ? -v : v;
}

(async function () {
    var srv = await servidor();
    var url = 'http://127.0.0.1:' + srv.address().port + '/ponto/index.html';
    var navegador = await playwright.chromium.launch();
    var pagina = await navegador.newPage({ viewport: { width: 1300, height: 900 }, acceptDownloads: true });
    var errosJs = [];
    pagina.on('pageerror', function (e) { errosJs.push(e.message); });
    await pagina.route(/^https?:\/\/(?!127\.0\.0\.1)/, function (rota) { rota.abort(); });
    await pagina.goto(url);
    await pagina.evaluate(function () { window.print = function () {}; });

    var texto = afdDeTeste();
    var bytes = Array.from(Buffer.from(texto, 'latin1'));

    console.log('\nAPI de carga');
    var r = await pagina.evaluate(function (b) {
        return window.LeitorAFD.carregar({ bytes: new Uint8Array(b), nomeArquivo: 'setembro.txt',
            periodo: { inicio: '2026-09-01', fim: '2026-09-30' } });
    }, bytes);
    igual(r.trabalhadores, 4, 'carregar: quatro colaboradores');
    igual(r.periodo.inicio, '2026-09-01', 'carregar: período aplicado na mesma carga');
    igual(await pagina.inputValue('#fDataIni'), '2026-09-01', 'carregar: filtro De preenchido na tela');

    console.log('\nTela = relatório = CSV');
    var tela = await pagina.$$eval('.cartao-doc', function (cartoes) {
        return cartoes.map(function (c) {
            var t = c.querySelector('.resumo-doc').textContent;
            return { nome: c.querySelector('.nome-doc').textContent,
                praticas: t.split('horas práticas')[1].split('·')[0], fechada: t.split('hora fechada')[1] };
        });
    });
    var download = await Promise.all([pagina.waitForEvent('download'), pagina.click('#btnCsv')]);
    var csv = fs.readFileSync(await download[0].path(), 'utf8').replace(/^﻿/, '').split('\r\n')
        .map(function (l) { return l.slice(1, -1).split('";"'); });
    var cab = csv[0];
    var iNome = cab.indexOf('Trabalhador'), iPrat = cab.indexOf('Horas praticas'), iFech = cab.indexOf('Hora fechada');
    await pagina.click('#btnRelatorio');
    var relatorio = await pagina.$$eval('#relatorioImpressao .rel-pagina', function (pags) {
        return pags.map(function (p) {
            var d = p.querySelectorAll('.totais .destaque b');
            return { nome: p.querySelector('.rel-pessoa b').textContent, praticas: d[0].textContent, fechada: d[1] ? d[1].textContent : '' };
        });
    });
    igual(relatorio.length, 4, 'relatório: uma página por colaborador no mês');
    tela.forEach(function (t) {
        var rel = relatorio.filter(function (x) { return x.nome === t.nome; })[0] || {};
        var linhas = csv.slice(1).filter(function (l) { return l[iNome] === t.nome; });
        var somaPrat = linhas.reduce(function (s, l) { return s + minutos(l[iPrat]); }, 0);
        var somaFech = linhas.reduce(function (s, l) { return s + (l[iFech] ? minutos(l[iFech]) : 0); }, 0);
        igual(minutos(rel.praticas), minutos(t.praticas), t.nome + ': horas práticas iguais na tela e no relatório');
        igual(minutos(rel.fechada), minutos(t.fechada), t.nome + ': hora fechada igual na tela e no relatório');
        igual(somaPrat, minutos(t.praticas), t.nome + ': soma das horas práticas do CSV igual à tela');
        igual(somaFech, minutos(t.fechada), t.nome + ': soma da hora fechada do CSV igual à tela');
    });

    console.log('\nConferência independente do total (Node x página)');
    var resultado = AFD.analisar(texto);
    var esp = AFD.montarEspelho(resultado.marcacoes, resultado.pessoas);
    var escala = AFD.ESCALAS.sem44_9h_sex8h;
    esp = AFD.completarDias(esp, { escala: escala.dias, calendario: true });
    var saldos = AFD.calcularSaldos(esp, { escala: escala.dias, horarios: escala.horarios, calendario: true });
    var somaNode = Object.keys(saldos.pessoas).reduce(function (s, k) { return s + saldos.pessoas[k].saldo; }, 0);
    var somaTela = tela.reduce(function (s, t) { return s + minutos(t.praticas); }, 0);
    igual(somaTela, somaNode, 'soma das horas práticas da tela igual ao cálculo direto no Node');

    console.log('\nCarga concorrente');
    var grande = '';
    for (var i = 0; i < 300000; i++) { grande += 'LINHA INVALIDA ' + i + '\r\n'; }
    await pagina.evaluate(function (dados) {
        window.__resultados = [];
        window.LeitorAFD.carregar({ bytes: new TextEncoder().encode(dados.a), nomeArquivo: 'grande.txt' })
            .then(function () { window.__resultados.push('A concluiu'); }, function () { window.__resultados.push('A rejeitada'); });
        window.LeitorAFD.carregar({ bytes: new Uint8Array(dados.b), nomeArquivo: 'pequeno.txt' })
            .then(function () { window.__resultados.push('B concluiu'); });
    }, { a: grande, b: bytes });
    await pagina.waitForFunction(function () { return window.__resultados.length >= 2; }, null, { timeout: 30000 });
    await pagina.waitForTimeout(1500);
    var res = await pagina.evaluate(function () { return window.__resultados; });
    ok(res.indexOf('A rejeitada') >= 0 && res.indexOf('B concluiu') >= 0, 'a carga antiga é descartada e só a nova termina', res.join(', '));
    igual(await pagina.locator('.cartao-doc').count(), 4, 'a tela mostra a última carga');

    igual(errosJs.length, 0, 'nenhum erro de JavaScript na página');
    await navegador.close();
    srv.close();
    console.log('\n' + (falhas === 0 ? 'TODOS OS TESTES DE NAVEGADOR PASSARAM' : 'FALHAS: ' + falhas) + '  (' + testes + ' verificacoes)');
    process.exit(falhas === 0 ? 0 : 1);
})().catch(function (e) { console.error(e); process.exit(1); });
