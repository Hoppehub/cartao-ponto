/*
 * Gera arquivos AFD ficticios para teste do leitor.
 *   node testes/gerar_exemplos.js
 *
 * Empresa, pessoas e documentos sao ficticios; os digitos verificadores sao
 * calculados para que os exemplos passem nas validacoes do leitor.
 */
'use strict';

var fs = require('fs');
var path = require('path');
var crypto = require('crypto');

var DIR = path.join(__dirname, '..', 'exemplos');

/* ---------- documentos ---------- */

function dvCPF(base9) {
    var c = base9, i, soma, dv, saida = base9;
    for (var rodada = 0; rodada < 2; rodada++) {
        soma = 0;
        c = saida;
        for (i = 0; i < c.length; i++) { soma += Number(c[i]) * (c.length + 1 - i); }
        dv = (soma * 10) % 11;
        if (dv === 10) { dv = 0; }
        saida += String(dv);
    }
    return saida;
}

function dvPIS(base10) {
    var pesos = [3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    var soma = 0;
    for (var i = 0; i < 10; i++) { soma += Number(base10[i]) * pesos[i]; }
    var dv = 11 - (soma % 11);
    if (dv === 10 || dv === 11) { dv = 0; }
    return base10 + String(dv);
}

function dvCNPJ(base12) {
    var p1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    var p2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    var soma = 0, i, dv, saida = base12;
    for (i = 0; i < 12; i++) { soma += Number(base12[i]) * p1[i]; }
    dv = soma % 11; dv = dv < 2 ? 0 : 11 - dv;
    saida += String(dv);
    soma = 0;
    for (i = 0; i < 13; i++) { soma += Number(saida[i]) * p2[i]; }
    dv = soma % 11; dv = dv < 2 ? 0 : 11 - dv;
    return saida + String(dv);
}

/* ---------- formatacao ---------- */

function num(v, tam) {
    var s = String(v).replace(/\D/g, '');
    while (s.length < tam) { s = '0' + s; }
    return s.slice(-tam);
}

function txt(v, tam) {
    var s = String(v == null ? '' : v);
    if (s.length > tam) { return s.slice(0, tam); }
    while (s.length < tam) { s += ' '; }
    return s;
}

function crc16(texto) {
    var crc = 0xFFFF;
    for (var i = 0; i < texto.length; i++) {
        crc ^= (texto.charCodeAt(i) & 0xFF) << 8;
        for (var b = 0; b < 8; b++) {
            crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xFFFF : (crc << 1) & 0xFFFF;
        }
    }
    return num(crc, 4).slice(-4) === '' ? '0000' : ('000' + crc.toString(16).toUpperCase()).slice(-4);
}

function hash256(texto) {
    return crypto.createHash('sha256').update(texto).digest('hex').toUpperCase();
}

function ddmmaaaa(iso) {
    var p = iso.split('-');
    return p[2] + p[1] + p[0];
}

function isoTz(data, hora) {
    return data + 'T' + hora + ':00-0300';
}

/* ---------- dados ficticios ---------- */

var EMPRESA = {
    cnpj: dvCNPJ('123456780001'),
    razao: 'AHTOOLS SERVICOS EMPRESARIAIS LTDA',
    local: 'AV BRASIL, 1500 - CENTRO - BELO HORIZONTE/MG',
    rep: 'REPP000000000012345'.slice(0, 17)
};

var PESSOAS = [
    { nome: 'ANA PAULA RODRIGUES SOUZA', cpf: dvCPF('111444777'), pis: dvPIS('1206547850') },
    { nome: 'CARLOS EDUARDO MARTINS', cpf: dvCPF('529982247'), pis: dvPIS('2098765432') },
    { nome: 'FERNANDA LIMA DE OLIVEIRA', cpf: dvCPF('390533447'), pis: dvPIS('1234567890') },
    { nome: 'JOAO PEDRO ALVES DA CONCEICAO', cpf: dvCPF('168995569'), pis: dvPIS('1098765432') }
];

var DIAS = ['2026-08-03', '2026-08-04', '2026-08-05', '2026-08-06', '2026-08-07'];
var BATIDAS = [
    ['07:58', '12:03', '13:01', '17:05'],
    ['08:01', '12:00', '13:04', '17:02'],
    ['07:55', '11:58', '12:58', '18:10'],
    ['08:12', '12:05', '13:07', '17:00']
];


/*
 * Monta a lista de eventos (marcacoes + ajuste de relogio) em ordem
 * cronologica: no AFD real o NSR acompanha a ordem de coleta.
 */
function eventosCronologicos() {
    var eventos = [];
    DIAS.forEach(function (dia, iDia) {
        PESSOAS.forEach(function (p, iP) {
            BATIDAS[iP].forEach(function (hora, iH) {
                var min = Number(hora.slice(3)) + ((iDia + iH) % 3);
                var h = hora.slice(0, 2);
                if (min > 59) { min -= 60; h = num(Number(h) + 1, 2); }
                eventos.push({ tipo: '3', data: dia, hora: h + ':' + num(min, 2), pessoa: p, indice: iP });
            });
        });
        if (iDia === 2) {
            eventos.push({ tipo: '4', data: dia, hora: '20:00', indice: -1 });
        }
    });
    eventos.sort(function (a, b) {
        var ca = a.data + 'T' + a.hora;
        var cb = b.data + 'T' + b.hora;
        return ca < cb ? -1 : (ca > cb ? 1 : 0);
    });
    return eventos;
}

/* ------------------------------------------------------------------ *
 * AFD - Portaria 1.510/2009
 * ------------------------------------------------------------------ */

function gerar1510() {
    var linhas = [];
    var nsr = 0;

    linhas.push(
        num(0, 9) + '1' + '1' + num(EMPRESA.cnpj, 14) + num('', 12) +
        txt(EMPRESA.razao, 150) + txt(EMPRESA.rep, 17) +
        ddmmaaaa(DIAS[0]) + ddmmaaaa(DIAS[DIAS.length - 1]) + ddmmaaaa('2026-08-28') + '1930'
    );

    nsr += 1;
    linhas.push(
        num(nsr, 9) + '2' + ddmmaaaa(DIAS[0]) + '0700' + '1' + num(EMPRESA.cnpj, 14) +
        num('', 12) + txt(EMPRESA.razao, 150) + txt(EMPRESA.local, 100)
    );

    PESSOAS.forEach(function (p) {
        nsr += 1;
        linhas.push(
            num(nsr, 9) + '5' + ddmmaaaa(DIAS[0]) + '0705' + 'I' + num(p.pis, 12) + txt(p.nome, 52)
        );
    });

    eventosCronologicos().forEach(function (e) {
        nsr += 1;
        if (e.tipo === '4') {
            linhas.push(num(nsr, 9) + '4' + ddmmaaaa(e.data) + '2000' + ddmmaaaa(e.data) + '1958');
        } else {
            linhas.push(num(nsr, 9) + '3' + ddmmaaaa(e.data) + e.hora.replace(':', '') + num(e.pessoa.pis, 12));
        }
    });

    var cont = { '2': 0, '3': 0, '4': 0, '5': 0 };
    linhas.forEach(function (l, i) {
        if (i === 0) { return; }
        var t = l.charAt(9);
        if (cont[t] !== undefined) { cont[t] += 1; }
    });
    linhas.push(num(cont['2'], 9) + num(cont['3'], 9) + num(cont['4'], 9) + num(cont['5'], 9) + '9');

    return linhas.join('\r\n') + '\r\n';
}

/* ------------------------------------------------------------------ *
 * AFD - Portaria 671/2021 (REP-C tipo 3 + REP-P tipo 7)
 * ------------------------------------------------------------------ */

function gerar671() {
    var linhas = [];
    var nsr = 0;

    linhas.push(
        num(0, 9) + '1' + '1' + num(EMPRESA.cnpj, 14) + num('', 14) +
        txt(EMPRESA.razao, 150) + txt(EMPRESA.rep, 17) +
        DIAS[0] + DIAS[DIAS.length - 1] + isoTz('2026-08-28', '19:30') + '003'
    );

    nsr += 1;
    linhas.push(
        num(nsr, 9) + '2' + isoTz(DIAS[0], '07:00') + '1' + num(EMPRESA.cnpj, 14) +
        num('', 14) + txt(EMPRESA.razao, 150) + txt(EMPRESA.local, 100)
    );

    PESSOAS.forEach(function (p) {
        nsr += 1;
        var corpo = num(nsr, 9) + '5' + isoTz(DIAS[0], '07:05') + 'I' + num(p.cpf, 11) + txt(p.nome, 52);
        linhas.push(corpo + crc16(corpo));
    });

    nsr += 1;
    linhas.push(num(nsr, 9) + '6' + isoTz(DIAS[0], '06:55') + 'Interrupcao no fornecimento de energia eletrica');

    eventosCronologicos().forEach(function (e) {
        nsr += 1;
        if (e.tipo === '4') {
            var corpo4 = num(nsr, 9) + '4' + isoTz(e.data, '20:00') + isoTz(e.data, '19:58');
            linhas.push(corpo4 + crc16(corpo4));
            return;
        }
        var marcada = isoTz(e.data, e.hora);
        if (e.indice % 2 === 0) {
            /* REP-C / REP-A: tipo 3 com CRC-16 */
            var corpo3 = num(nsr, 9) + '3' + marcada + num(e.pessoa.cpf, 11);
            linhas.push(corpo3 + crc16(corpo3));
        } else {
            /* REP-P: tipo 7 com data/hora de gravacao, indicador de coleta e hash */
            var corpo7 = num(nsr, 9) + '7' + marcada + num(e.pessoa.cpf, 11) + marcada + 'O';
            linhas.push(corpo7 + hash256(corpo7));
        }
    });

    var cont = { '2': 0, '3': 0, '4': 0, '5': 0, '6': 0, '7': 0 };
    linhas.forEach(function (l, i) {
        if (i === 0) { return; }
        var t = l.charAt(9);
        if (cont[t] !== undefined) { cont[t] += 1; }
    });
    linhas.push(
        num(cont['2'], 9) + num(cont['3'], 9) + num(cont['4'], 9) +
        num(cont['5'], 9) + num(cont['6'], 9) + num(cont['7'], 9) + '9'
    );

    return linhas.join('\r\n') + '\r\n';
}

/* ------------------------------------------------------------------ *
 * AFD com inconsistencias propositais (para demonstrar a auditoria)
 * ------------------------------------------------------------------ */

function gerarComErros() {
    var p = PESSOAS[0];
    var q = PESSOAS[1];
    var linhas = [];

    linhas.push(
        num(0, 9) + '1' + '1' + num('12345678000199', 14) + num('', 12) +
        txt(EMPRESA.razao, 150) + txt(EMPRESA.rep, 17) +
        ddmmaaaa('2026-08-03') + ddmmaaaa('2026-08-05') + ddmmaaaa('2026-08-28') + '1930'
    );
    linhas.push(num(1, 9) + '5' + ddmmaaaa('2026-08-03') + '0700' + 'I' + num(p.pis, 12) + txt(p.nome, 52));
    linhas.push(num(2, 9) + '3' + ddmmaaaa('2026-08-03') + '0800' + num(p.pis, 12));
    /* NSR repetido */
    linhas.push(num(2, 9) + '3' + ddmmaaaa('2026-08-03') + '1200' + num(p.pis, 12));
    /* salto de NSR */
    linhas.push(num(8, 9) + '3' + ddmmaaaa('2026-08-03') + '1300' + num(p.pis, 12));
    /* marcacao duplicada (mesma pessoa, mesmo instante) */
    linhas.push(num(9, 9) + '3' + ddmmaaaa('2026-08-03') + '1300' + num(p.pis, 12));
    /* retrocesso de horario sem ajuste de relogio */
    linhas.push(num(10, 9) + '3' + ddmmaaaa('2026-08-03') + '0930' + num(p.pis, 12));
    /* data invalida (31 de fevereiro) */
    linhas.push(num(11, 9) + '3' + '31022026' + '0800' + num(p.pis, 12));
    /* PIS com digito verificador incorreto */
    linhas.push(num(12, 9) + '3' + ddmmaaaa('2026-08-04') + '0800' + num('012345678901', 12));
    /* marcacao fora do periodo declarado no cabecalho */
    linhas.push(num(13, 9) + '3' + ddmmaaaa('2026-08-20') + '0800' + num(p.pis, 12));
    /* trabalhador sem cadastro tipo 5 */
    linhas.push(num(14, 9) + '3' + ddmmaaaa('2026-08-04') + '0805' + num(q.pis, 12));
    /* registro com tamanho errado */
    linhas.push(num(15, 9) + '3' + ddmmaaaa('2026-08-04') + '0810' + num(p.pis, 11));
    /* trailer com contagens divergentes */
    linhas.push(num(0, 9) + num(3, 9) + num(0, 9) + num(1, 9) + '9');

    return linhas.join('\r\n') + '\r\n';
}

/* ---------- escrita ---------- */

if (!fs.existsSync(DIR)) { fs.mkdirSync(DIR, { recursive: true }); }

/* O exemplo da 1.510 sai em ISO-8859-1, como a maioria dos REPs antigos */
fs.writeFileSync(path.join(DIR, 'afd_1510_exemplo.txt'), Buffer.from(gerar1510(), 'latin1'));
fs.writeFileSync(path.join(DIR, 'afd_671_exemplo.txt'), gerar671(), 'utf8');
fs.writeFileSync(path.join(DIR, 'afd_com_inconsistencias.txt'), Buffer.from(gerarComErros(), 'latin1'));

console.log('Exemplos gerados em', DIR);
console.log('  CNPJ ficticio:', EMPRESA.cnpj);
PESSOAS.forEach(function (p) { console.log('  ' + p.nome + ' | CPF ' + p.cpf + ' | PIS ' + p.pis); });
