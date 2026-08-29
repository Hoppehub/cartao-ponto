/*
 * Teste de carga do analisador de AFD.
 *   node testes/carga.js [marcacoes]
 *
 * Gera um AFD grande em memoria e mede tempo e memoria de cada etapa.
 * Serve para comparar antes e depois de uma otimizacao.
 */
'use strict';

var AFD = require('../ponto/js/afd_parser.js');

var ALVO = Number(process.argv[2]) || 120000;

function num(v, t) {
    var s = String(v).replace(/\D/g, '');
    while (s.length < t) { s = '0' + s; }
    return s.slice(-t);
}

function txt(v, t) {
    var s = String(v);
    return s.length > t ? s.slice(0, t) : s + new Array(t - s.length + 1).join(' ');
}

function dvPIS(base10) {
    var pesos = [3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    var soma = 0;
    for (var i = 0; i < 10; i++) { soma += Number(base10[i]) * pesos[i]; }
    var dv = 11 - (soma % 11);
    if (dv === 10 || dv === 11) { dv = 0; }
    return base10 + String(dv);
}

function gerar(marcacoesAlvo) {
    var pessoas = [];
    for (var i = 0; i < 200; i++) { pessoas.push(dvPIS(num(1200000000 + i * 7, 10))); }

    var linhas = [];
    linhas.push(num(0, 9) + '1' + '1' + num('12345678000195', 14) + num('', 12) +
        txt('EMPRESA DE CARGA LTDA', 150) + txt('REPP0000000000123', 17) +
        '01012026' + '31122026' + '01012027' + '0800');

    var nsr = 0;
    var cont = { '3': 0, '5': 0 };
    pessoas.forEach(function (pis) {
        nsr += 1;
        linhas.push(num(nsr, 9) + '5' + '01012026' + '0700' + 'I' + num(pis, 12) + txt('TRABALHADOR ' + pis, 52));
        cont['5'] += 1;
    });

    var dia = 1;
    var mes = 1;
    var horas = ['0700', '1200', '1300', '1700'];
    while (cont['3'] < marcacoesAlvo) {
        for (var p = 0; p < pessoas.length && cont['3'] < marcacoesAlvo; p++) {
            for (var h = 0; h < horas.length && cont['3'] < marcacoesAlvo; h++) {
                nsr += 1;
                linhas.push(num(nsr, 9) + '3' + num(dia, 2) + num(mes, 2) + '2026' + horas[h] + num(pessoas[p], 12));
                cont['3'] += 1;
            }
        }
        dia += 1;
        if (dia > 28) { dia = 1; mes += 1; }
        if (mes > 12) { mes = 1; }
    }

    linhas.push(num(0, 9) + num(cont['3'], 9) + num(0, 9) + num(cont['5'], 9) + '9');
    return linhas.join('\r\n') + '\r\n';
}

function medir(rotulo, fn) {
    if (global.gc) { global.gc(); }
    var antes = process.memoryUsage().heapUsed;
    var t = process.hrtime.bigint();
    var saida = fn();
    var ms = Number(process.hrtime.bigint() - t) / 1e6;
    var mb = (process.memoryUsage().heapUsed - antes) / 1048576;
    console.log('  ' + rotulo.padEnd(34) + ms.toFixed(0).padStart(7) + ' ms' +
        (mb > 0.5 ? ('   +' + mb.toFixed(0) + ' MB') : ''));
    return saida;
}

console.log('Gerando AFD com ~' + ALVO.toLocaleString('pt-BR') + ' marcacoes...');
var texto = gerar(ALVO);
console.log('  ' + (texto.length / 1048576).toFixed(1) + ' MB, ' +
    texto.split('\r\n').length.toLocaleString('pt-BR') + ' linhas\n');

console.log('Etapas:');
var resultado = medir('analisar (leitura completa)', function () { return AFD.analisar(texto); });
var espelho = medir('montarEspelho', function () {
    return AFD.montarEspelho(resultado.marcacoes, resultado.pessoas);
});
var escala = AFD.ESCALAS.sem44_9h_sex8h.dias;
var completo = medir('completarDias', function () {
    return AFD.completarDias(espelho, { escala: escala });
});
medir('calcularSaldos', function () { return AFD.calcularSaldos(completo, { escala: escala }); });

console.log('\nResultado: ' + resultado.resumo.totalMarcacoes.toLocaleString('pt-BR') + ' marcacoes, ' +
    resultado.resumo.totalPessoas + ' pessoas, ' + espelho.length.toLocaleString('pt-BR') + ' dias de espelho, ' +
    resultado.inconsistencias.length.toLocaleString('pt-BR') + ' inconsistencias');
console.log('Heap final: ' + (process.memoryUsage().heapUsed / 1048576).toFixed(0) + ' MB');
