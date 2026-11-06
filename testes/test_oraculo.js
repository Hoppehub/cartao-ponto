/*
 * Conferência independente do cálculo ("oráculo").
 *   node testes/test_oraculo.js [quantidade de meses] [semente]
 *
 * Gera meses aleatórios de AFD (leiaute 1.510) com atrasos, saídas tardias,
 * batidas esquecidas, repetidas, meio período, fim de semana e feriados, passa
 * cada um pelo caminho completo do programa (analisar -> montarEspelho ->
 * completarDias -> calcularSaldos) e compara, dia a dia e minuto a minuto, com
 * uma segunda calculadora escrita aqui do zero, de propósito simples e sem
 * reaproveitar nada do afd_parser.js (nem o cálculo da Páscoa: os feriados
 * móveis estão digitados numa tabela).
 *
 * Regras (decisões do dono, revisao/PROMPT-IMPLEMENTACAO-FASE-1.md):
 *  - jornada seg-qui 06:55-11:55 / 12:55-16:55, sexta até 15:55; sáb/dom sem jornada;
 *  - feriado nacional: jornada zero; ponto facultativo: dia normal;
 *  - horas práticas = trabalhado - previsto;
 *  - hora fechada = 0 se toda batida variou até 5 min e a soma até 10 min;
 *    senão, igual às horas práticas; dia para conferir fica sem hora fechada;
 *  - para conferir: batida ímpar, batidas a 5 min ou menos uma da outra, ou
 *    quantidade diferente de 4 em dia com jornada.
 */
'use strict';

var fs = require('fs');
var path = require('path');
var AFD = require('../ponto/js/afd_parser.js');

var MESES = Number(process.argv[2]) || 300;
var semente = Number(process.argv[3]) || 20261106;

/* ------------------------------------------------------------------ *
 * Calculadora independente
 * ------------------------------------------------------------------ */

var FERIADOS = {
    '2024-01-01': 1, '2024-03-29': 1, '2024-04-21': 1, '2024-05-01': 1, '2024-09-07': 1, '2024-10-12': 1,
    '2024-11-02': 1, '2024-11-15': 1, '2024-11-20': 1, '2024-12-25': 1,
    '2028-01-01': 1, '2028-04-14': 1, '2028-04-21': 1, '2028-05-01': 1, '2028-09-07': 1, '2028-10-12': 1,
    '2028-11-02': 1, '2028-11-15': 1, '2028-11-20': 1, '2028-12-25': 1,
    '2025-01-01': 1, '2025-04-18': 1, '2025-04-21': 1, '2025-05-01': 1, '2025-09-07': 1, '2025-10-12': 1,
    '2025-11-02': 1, '2025-11-15': 1, '2025-11-20': 1, '2025-12-25': 1,
    '2026-01-01': 1, '2026-04-03': 1, '2026-04-21': 1, '2026-05-01': 1, '2026-09-07': 1, '2026-10-12': 1,
    '2026-11-02': 1, '2026-11-15': 1, '2026-11-20': 1, '2026-12-25': 1,
    '2027-01-01': 1, '2027-03-26': 1, '2027-04-21': 1, '2027-05-01': 1, '2027-09-07': 1, '2027-10-12': 1,
    '2027-11-02': 1, '2027-11-15': 1, '2027-11-20': 1, '2027-12-25': 1
};
var FACULTATIVOS = {
    '2024-02-12': 1, '2024-02-13': 1, '2024-02-14': 1, '2024-05-30': 1, '2024-10-28': 1, '2024-12-24': 1, '2024-12-31': 1,
    '2028-02-28': 1, '2028-02-29': 1, '2028-03-01': 1, '2028-06-15': 1, '2028-10-28': 1, '2028-12-24': 1, '2028-12-31': 1,
    '2025-03-03': 1, '2025-03-04': 1, '2025-03-05': 1, '2025-06-19': 1, '2025-10-28': 1, '2025-12-24': 1, '2025-12-31': 1,
    '2026-02-16': 1, '2026-02-17': 1, '2026-02-18': 1, '2026-06-04': 1, '2026-10-28': 1, '2026-12-24': 1, '2026-12-31': 1,
    '2027-02-08': 1, '2027-02-09': 1, '2027-02-10': 1, '2027-05-27': 1, '2027-10-28': 1, '2027-12-24': 1, '2027-12-31': 1
};

function hm(texto) { return Number(texto.slice(0, 2)) * 60 + Number(texto.slice(3, 5)); }

function diaDaSemana(iso) {
    return new Date(Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)))).getUTCDay();
}

function proximoDia(iso) {
    var d = new Date(Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)) + 1));
    return d.toISOString().slice(0, 10);
}

function previstos(dow) {
    if (dow >= 1 && dow <= 4) { return [415, 715, 775, 1015]; }
    if (dow === 5) { return [415, 715, 775, 955]; }
    return null;
}

/* batidas: { 'AAAA-MM-DD': ['HH:MM', ...] } de uma pessoa -> { data: resultado } */
function oraculo(batidas) {
    var datas = Object.keys(batidas).sort();
    var saida = {};
    if (!datas.length) { return saida; }
    for (var data = datas[0]; data <= datas[datas.length - 1]; data = proximoDia(data)) {
        var dow = diaDaSemana(data);
        var feriado = !!FERIADOS[data];
        var horario = feriado ? null : previstos(dow);
        var previsto = 0;
        if (horario) { previsto = horario[3] - horario[0] - (horario[2] - horario[1]); }
        var h = (batidas[data] || []).map(hm).sort(function (a, b) { return a - b; });

        var trabalhado = 0;
        for (var i = 0; i + 1 < h.length; i += 2) { trabalhado += h[i + 1] - h[i]; }

        var pendente = h.length % 2 === 1;
        for (i = 1; i < h.length; i++) { if (h[i] - h[i - 1] <= 5) { pendente = true; } }
        if (previsto > 0 && h.length > 0 && !pendente && h.length !== 4) { pendente = true; }

        var praticas = trabalhado - previsto;
        var fechada;
        if (pendente) {
            fechada = null;
        } else if (previsto === 0 || h.length === 0) {
            fechada = praticas;
        } else {
            var soma = 0, dentro = true;
            for (i = 0; i < 4; i++) {
                var v = Math.abs(h[i] - horario[i]);
                soma += v;
                if (v > 5) { dentro = false; }
            }
            fechada = dentro && soma <= 10 ? 0 : praticas;
        }
        saida[data] = {
            previsto: previsto, trabalhado: trabalhado, praticas: praticas, fechada: fechada,
            pendente: pendente, feriado: feriado, facultativo: !!FACULTATIVOS[data]
        };
    }
    return saida;
}

/* ------------------------------------------------------------------ *
 * Gerador de meses aleatórios (determinístico pela semente)
 * ------------------------------------------------------------------ */

function sorteio(min, max) {
    semente = (semente * 1103515245 + 12345) % 2147483648;
    return min + (semente % (max - min + 1));
}
function chance(percentual) { return sorteio(1, 100) <= percentual; }
function texto(min) { return ('0' + Math.floor(min / 60)).slice(-2) + ':' + ('0' + (min % 60)).slice(-2); }

var CABECALHO = fs.readFileSync(path.join(__dirname, '..', 'ponto', 'exemplos', 'afd_1510_exemplo.txt'), 'utf8')
    .split(/\r?\n/).slice(0, 6);
var PIS = ['012065478502', '020987654327', '012345678900', '010987654320'];

/* datas-alvo dos meses gerados (2025 a 2027); 2024 e 2028 ficam na tabela para meses que transbordam */
var DATAS_CALENDARIO = Object.keys(FERIADOS).concat(Object.keys(FACULTATIVOS)).filter(function (d) {
    return d >= '2025' && d < '2028';
}).sort();

/* meses pares começam perto de um feriado ou ponto facultativo, percorrendo todos */
function gerarMes(indice) {
    var pessoas = PIS.slice(0, sorteio(1, 4));
    var inicio = new Date(Date.UTC(sorteio(2025, 2027), sorteio(0, 11), sorteio(1, 28)));
    if (indice % 2 === 0) {
        var alvo = DATAS_CALENDARIO[(indice / 2) % DATAS_CALENDARIO.length];
        inicio = new Date(Date.UTC(Number(alvo.slice(0, 4)), Number(alvo.slice(5, 7)) - 1, Number(alvo.slice(8, 10)) - sorteio(0, 15)));
    }
    var dias = sorteio(20, 45);
    var batidas = {};
    pessoas.forEach(function (p) { batidas[p] = {}; });
    for (var n = 0; n < dias; n++) {
        var d = new Date(inicio.getTime() + n * 86400000);
        var iso = d.toISOString().slice(0, 10);
        var dow = d.getUTCDay();
        pessoas.forEach(function (p) {
            var util = dow >= 1 && dow <= 5;
            if (!util && !chance(12)) { return; }
            if (util && chance(7)) { return; }
            var base = util ? (previstos(dow) || []).slice() : [420, 660, 720, 840];
            if (!util && chance(50)) { base = [420, 660]; }
            var folga = chance(70) ? 6 : 25;
            var h = base.map(function (m) {
                /* um em cada cinco: variação exatamente na fronteira da tolerância */
                return m + (chance(20) ? [-6, -5, 5, 6][sorteio(0, 3)] : sorteio(-folga, folga));
            });
            if (chance(4)) { h = [h[0], h[1]]; }
            if (chance(5)) { h.splice(sorteio(0, h.length - 1), 1); }
            if (chance(5)) { var j = sorteio(0, h.length - 1); h.push(h[j] + sorteio(0, 8)); }
            if (chance(2)) { h.push(1080, 1140); }
            h = h.filter(function (m) { return m >= 0 && m < 1440; });
            if (h.length) { batidas[p][iso] = h.map(texto); }
        });
    }
    return batidas;
}

function afdDoMes(batidas) {
    var eventos = [];
    Object.keys(batidas).forEach(function (p) {
        Object.keys(batidas[p]).forEach(function (data) {
            batidas[p][data].forEach(function (h) { eventos.push({ p: p, data: data, h: h }); });
        });
    });
    eventos.sort(function (a, b) { return (a.data + a.h) < (b.data + b.h) ? -1 : ((a.data + a.h) > (b.data + b.h) ? 1 : 0); });
    var linhas = CABECALHO.slice();
    eventos.forEach(function (e, i) {
        linhas.push(('00000000' + (i + 7)).slice(-9) + '3' + e.data.slice(8, 10) + e.data.slice(5, 7) + e.data.slice(0, 4) +
            e.h.replace(':', '') + e.p);
    });
    return linhas.join('\r\n') + '\r\n';
}

/* ------------------------------------------------------------------ *
 * Comparação
 * ------------------------------------------------------------------ */

var diferencas = 0;
var diasComparados = 0;
var exemplos = [];
var cobertas = {};
var contagem = { pendentes: 0, feriados: 0, facultativos: 0, tolerancia: 0, faltas: 0, fimDeSemana: 0 };

function registrar(msg) {
    diferencas += 1;
    if (exemplos.length < 15) { exemplos.push(msg); }
}

for (var k = 0; k < MESES; k++) {
    var batidas = gerarMes(k);
    var resultado = AFD.analisar(afdDoMes(batidas));
    var escala = AFD.ESCALAS.sem44_9h_sex8h;
    var espelho = AFD.montarEspelho(resultado.marcacoes, resultado.pessoas);
    espelho = AFD.completarDias(espelho, { escala: escala.dias, calendario: true });
    var saldos = AFD.calcularSaldos(espelho, { escala: escala.dias, horarios: escala.horarios, calendario: true });

    Object.keys(batidas).forEach(function (p) {
        var chave = AFD.chavePessoa(p);
        var esperado = oraculo(batidas[p]);
        var obtidos = {};
        espelho.filter(function (d) { return d.chave === chave; }).forEach(function (d) { obtidos[d.data] = d; });
        var totalPrat = 0, totalFech = 0;
        Object.keys(esperado).forEach(function (data) {
            var o = esperado[data];
            var d = obtidos[data];
            diasComparados += 1;
            if (o.pendente) { contagem.pendentes += 1; }
            if (o.feriado) { contagem.feriados += 1; }
            if (o.facultativo) { contagem.facultativos += 1; }
            if (o.feriado || o.facultativo) { cobertas[data] = true; }
            if (!o.pendente && o.fechada === 0 && o.praticas !== 0) { contagem.tolerancia += 1; }
            if (o.previsto > 0 && o.trabalhado === 0 && !(batidas[p][data] || []).length) { contagem.faltas += 1; }
            if (o.previsto === 0 && !o.feriado && (batidas[p][data] || []).length) { contagem.fimDeSemana += 1; }
            totalPrat += o.praticas;
            if (o.fechada !== null) { totalFech += o.fechada; }
            var rotulo = 'mês ' + (k + 1) + ', ' + p + ', ' + data + ' [' + (batidas[p][data] || []).join(' ') + ']';
            if (!d) { registrar(rotulo + ': dia ausente no programa'); return; }
            if (d.jornadaEsperada !== o.previsto) { registrar(rotulo + ': previsto ' + d.jornadaEsperada + ' x ' + o.previsto); }
            if (d.totalMinutos !== o.trabalhado) { registrar(rotulo + ': trabalhado ' + d.totalMinutos + ' x ' + o.trabalhado); }
            if (d.saldo !== o.praticas) { registrar(rotulo + ': horas práticas ' + d.saldo + ' x ' + o.praticas); }
            if (d.saldoFechado !== o.fechada) { registrar(rotulo + ': hora fechada ' + d.saldoFechado + ' x ' + o.fechada); }
            if ((d.statusSaldo === 'pendente') !== o.pendente) { registrar(rotulo + ': para conferir ' + d.statusSaldo + ' x ' + o.pendente); }
            var tipoCal = o.feriado ? 'feriado' : (o.facultativo ? 'facultativo' : null);
            if ((d.calendario ? d.calendario.tipo : null) !== tipoCal) {
                registrar(rotulo + ': calendário ' + (d.calendario ? d.calendario.tipo : 'comum') + ' x ' + (tipoCal || 'comum'));
            }
        });
        Object.keys(obtidos).forEach(function (data) {
            if (!esperado[data]) { registrar('mês ' + (k + 1) + ', ' + p + ', ' + data + ': dia a mais no programa'); }
        });
        var pessoa = saldos.pessoas[chave];
        if (pessoa.saldo !== totalPrat) { registrar('mês ' + (k + 1) + ', ' + p + ': total de horas práticas ' + pessoa.saldo + ' x ' + totalPrat); }
        if (pessoa.saldoFechado !== totalFech) { registrar('mês ' + (k + 1) + ', ' + p + ': total da hora fechada ' + pessoa.saldoFechado + ' x ' + totalFech); }
    });
}

console.log('\nConferência independente do cálculo');
console.log('  meses aleatórios: ' + MESES + ' · dias comparados: ' + diasComparados);
console.log('  casos cobertos: ' + contagem.pendentes + ' para conferir, ' + contagem.faltas + ' faltas, ' +
    contagem.fimDeSemana + ' fins de semana trabalhados, ' + contagem.feriados + ' feriados, ' +
    contagem.facultativos + ' pontos facultativos, ' + contagem.tolerancia + ' com tolerância aplicada');
var naoCobertas = DATAS_CALENDARIO.filter(function (d) { return !cobertas[d]; });
console.log('  datas do calendário cobertas: ' + (DATAS_CALENDARIO.length - naoCobertas.length) + ' de ' + DATAS_CALENDARIO.length +
    (naoCobertas.length ? ' (faltaram ' + naoCobertas.join(', ') + ')' : ''));
exemplos.forEach(function (e) { console.log('  DIFERENÇA ' + e); });
console.log('\n' + (diferencas === 0 ? 'CÁLCULO IGUAL AO DO ORÁCULO EM TODOS OS DIAS' : 'DIFERENÇAS: ' + diferencas));
process.exit(diferencas === 0 ? 0 : 1);
