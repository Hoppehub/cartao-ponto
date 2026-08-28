/*
 * Testes do analisador de AFD (sem dependencias externas).
 *   node testes/test_afd_parser.js
 */
'use strict';

var fs = require('fs');
var path = require('path');
var AFD = require('../ponto/js/afd_parser.js');

var EXEMPLOS = path.join(__dirname, '..', 'ponto', 'exemplos');
var falhas = 0;
var testes = 0;

function ok(condicao, descricao, detalhe) {
    testes += 1;
    if (condicao) {
        console.log('  ok   ' + descricao);
    } else {
        falhas += 1;
        console.log('  FALHA ' + descricao + (detalhe !== undefined ? '  ->  ' + detalhe : ''));
    }
}

function igual(recebido, esperado, descricao) {
    ok(recebido === esperado, descricao, 'recebido ' + JSON.stringify(recebido) + ', esperado ' + JSON.stringify(esperado));
}

function grupo(nome) { console.log('\n' + nome); }

function ler(arquivo, codificacao) {
    return fs.readFileSync(path.join(EXEMPLOS, arquivo), codificacao || 'utf8');
}

function codigos(resultado) {
    return resultado.inconsistencias.map(function (i) { return i.codigo; });
}

/* ------------------------------------------------------------------ */
grupo('Validacao de documentos');

ok(AFD.validarCPF('11144477735'), 'CPF valido e aceito');
ok(!AFD.validarCPF('11144477734'), 'CPF com DV errado e rejeitado');
ok(!AFD.validarCPF('11111111111'), 'CPF com digitos repetidos e rejeitado');
ok(AFD.validarCPF('011144477735'), 'CPF com zero a esquerda (12 posicoes) e aceito');
ok(AFD.validarPIS('12065478502'), 'PIS valido e aceito');
ok(AFD.validarPIS('012065478502'), 'PIS em 12 posicoes e aceito');
ok(!AFD.validarPIS('012345678901'), 'PIS com DV errado e rejeitado');
ok(AFD.validarCNPJ('12345678000195'), 'CNPJ numerico valido e aceito');
ok(!AFD.validarCNPJ('12345678000199'), 'CNPJ com DV errado e rejeitado');
ok(AFD.validarCNPJ('12ABC34501DE35'), 'CNPJ alfanumerico valido e aceito');
igual(AFD.formatarCPF('11144477735'), '111.444.777-35', 'CPF formatado');
igual(AFD.formatarPIS('012065478502'), '120.65478.50-2', 'PIS formatado');
igual(AFD.formatarCNPJ('12345678000195'), '12.345.678/0001-95', 'CNPJ formatado');

/* ------------------------------------------------------------------ */
grupo('Leitura de data/hora do leiaute 671');

var dh = AFD.lerDataHoraISO('2026-08-03T07:58:00-0300', 0);
igual(dh.data, '2026-08-03', 'data ISO com fuso');
igual(dh.hora, '07:58:00', 'hora ISO com fuso');
igual(dh.fuso, '-0300', 'fuso preservado');

igual(AFD.lerDataHoraISO('2026-08-03T0758', 0).hora, '07:58:00', 'hora sem separador apos o T');
igual(AFD.lerDataHoraISO('2026-08-030758', 0).hora, '07:58:00', 'hora colada na data');
igual(AFD.lerDataHoraISO('2026-08-03 07:58:12', 0).hora, '07:58:12', 'data e hora separadas por espaco');
ok(!AFD.lerDataHoraISO('2026-02-30T07:58:00', 0).valido, '30 de fevereiro e recusado');
ok(!AFD.lerDataHoraISO('2026-08-03T25:10:00', 0).valido, 'hora 25 e recusada');

/* duas datas coladas (periodo do cabecalho) nao podem virar data + hora */
var duasDatas = AFD.lerDataHoraISO('2026-08-032026-08-07', 0);
igual(duasDatas.hora, '', 'data seguida de outra data nao gera hora falsa');

/* ------------------------------------------------------------------ */
grupo('Identificacao de CPF x PIS');

var idCPF = AFD.lerIdentificador('11144477735FE73', 0, 'CPF');
igual(idCPF.tipo, 'CPF', 'CPF seguido de CRC-16 e reconhecido');
igual(idCPF.valor, '11144477735', 'valor do CPF');

var idPIS = AFD.lerIdentificador('012065478502', 0, 'PIS');
igual(idPIS.tipo, 'PIS', 'PIS de 12 posicoes e reconhecido');

/* ------------------------------------------------------------------ */
grupo('AFD da Portaria 1.510/2009');

var texto1510 = ler('afd_1510_exemplo.txt', 'latin1');
var r1510 = AFD.analisar(texto1510);

igual(r1510.layout, '1510', 'leiaute detectado');
igual(r1510.cabecalho.razaoSocial, 'AHTOOLS SERVICOS EMPRESARIAIS LTDA', 'razao social do cabecalho');
igual(r1510.cabecalho.identificadorEmpregador, '12345678000195', 'CNPJ do empregador');
igual(r1510.cabecalho.tipoDocumentoEmpregador, 'CNPJ', 'tipo do documento do empregador');
igual(r1510.cabecalho.dataInicial, '2026-08-03', 'data inicial do periodo');
igual(r1510.cabecalho.dataFinal, '2026-08-07', 'data final do periodo');
igual(r1510.cabecalho.dataGeracao, '2026-08-28', 'data de geracao');
igual(r1510.cabecalho.horaGeracao, '19:30:00', 'hora de geracao');
igual(r1510.cabecalho.numeroFabricacao, 'REPP0000000000123', 'numero de fabricacao do REP');
igual(r1510.resumo.totalMarcacoes, 80, '80 marcacoes (5 dias x 4 pessoas x 4 batidas)');
igual(r1510.resumo.totalPessoas, 4, '4 trabalhadores');
igual(r1510.empregados.length, 4, '4 registros tipo 5');
igual(r1510.ajustes.length, 1, '1 ajuste de relogio');
igual(r1510.resumo.contagens['3'], 80, 'contagem de registros tipo 3');
igual(r1510.resumo.niveis.erro, 0, 'nenhum erro no arquivo integro');
igual(r1510.resumo.niveis.alerta, 0, 'nenhum alerta no arquivo integro');
igual(r1510.marcacoes[0].tipoIdentificador, 'PIS', 'marcacao da 1.510 identifica por PIS');
ok(r1510.marcacoes[0].identificadorValido, 'PIS da primeira marcacao e valido');
igual(r1510.trailer.contagens['3'], 80, 'trailer confere com as marcacoes lidas');

var ana = r1510.pessoas.filter(function (p) { return /ANA PAULA/.test(p.nome); })[0];
ok(!!ana, 'trabalhadora ANA PAULA localizada pelo nome');
igual(ana.marcacoes, 20, 'ANA PAULA com 20 marcacoes');

/* ------------------------------------------------------------------ */
grupo('AFD da Portaria 671/2021');

var texto671 = ler('afd_671_exemplo.txt');
var r671 = AFD.analisar(texto671);

igual(r671.layout, '671', 'leiaute detectado');
igual(r671.cabecalho.razaoSocial, 'AHTOOLS SERVICOS EMPRESARIAIS LTDA', 'razao social do cabecalho');
igual(r671.cabecalho.dataInicial, '2026-08-03', 'data inicial do periodo');
igual(r671.cabecalho.dataFinal, '2026-08-07', 'data final do periodo');
igual(r671.cabecalho.dataGeracao, '2026-08-28', 'data de geracao');
igual(r671.cabecalho.horaGeracao, '19:30:00', 'hora de geracao');
igual(r671.cabecalho.complemento, '003', 'complemento do cabecalho (versao do leiaute)');
igual(r671.resumo.totalMarcacoes, 80, '80 marcacoes somando tipos 3 e 7');
igual(r671.resumo.contagens['3'], 40, '40 marcacoes REP-C (tipo 3)');
igual(r671.resumo.contagens['7'], 40, '40 marcacoes REP-P (tipo 7)');
igual(r671.eventos.length, 1, '1 evento sensivel (tipo 6)');
igual(r671.resumo.niveis.erro, 0, 'nenhum erro no arquivo integro');
igual(r671.resumo.niveis.alerta, 0, 'nenhum alerta no arquivo integro');

var marc3 = r671.marcacoes.filter(function (m) { return m.tipo === '3'; })[0];
igual(marc3.tipoIdentificador, 'CPF', 'marcacao tipo 3 identifica por CPF');
ok(marc3.identificadorValido, 'CPF da marcacao tipo 3 e valido');
igual(marc3.crc.length, 4, 'CRC-16 com 4 posicoes');

var marc7 = r671.marcacoes.filter(function (m) { return m.tipo === '7'; })[0];
igual(marc7.hash.length, 64, 'hash SHA-256 do registro REP-P com 64 posicoes');
ok(!!marc7.dataGravacao, 'data de gravacao do REP-P lida');
igual(marc7.tipoIdentificador, 'CPF', 'marcacao tipo 7 identifica por CPF');

var emp671 = r671.empregados[0];
igual(emp671.operacaoDescricao, 'Inclusão', 'operacao do cadastro de empregado');
ok(/^[A-Z ]+$/.test(emp671.nome), 'nome do empregado lido sem sujeira: ' + emp671.nome);
igual(emp671.tipoIdentificador, 'CPF', 'cadastro de empregado por CPF');

/* ------------------------------------------------------------------ */
grupo('AFD com inconsistencias');

var rErros = AFD.analisar(ler('afd_com_inconsistencias.txt', 'latin1'));
var cods = codigos(rErros);

[
    'DOC_EMPREGADOR_INVALIDO',
    'NSR_DUPLICADO',
    'NSR_LACUNA',
    'MARCACAO_DUPLICADA',
    'RETROCESSO_TEMPORAL',
    'DATA_INVALIDA',
    'DOC_MARCACAO_INVALIDO',
    'FORA_DO_PERIODO',
    'SEM_CADASTRO',
    'TAMANHO_INVALIDO',
    'TRAILER_DIVERGENTE'
].forEach(function (c) {
    ok(cods.indexOf(c) >= 0, 'detecta ' + c);
});

/* uma data invalida nao deve gerar alertas encadeados de cronologia */
var linhaDataInvalida = rErros.inconsistencias.filter(function (i) { return i.codigo === 'DATA_INVALIDA'; })[0].linha;
var retrocessosNaMesmaLinha = rErros.inconsistencias.filter(function (i) {
    return i.codigo === 'RETROCESSO_TEMPORAL' && i.linha === linhaDataInvalida;
});
igual(retrocessosNaMesmaLinha.length, 0, 'data invalida nao dispara alerta de retrocesso na mesma linha');

/* ------------------------------------------------------------------ */
grupo('Espelho de ponto');

var espelho = AFD.montarEspelho(r1510.marcacoes, r1510.pessoas);
igual(espelho.length, 20, '20 linhas de espelho (4 pessoas x 5 dias)');

var diaAna = espelho.filter(function (e) {
    return /ANA PAULA/.test(e.nome) && e.data === '2026-08-03';
})[0];
ok(!!diaAna, 'espelho de ANA PAULA em 03/08/2026');
igual(diaAna.quantidade, 4, '4 marcacoes no dia');
igual(diaAna.pares.length, 2, '2 pares entrada/saida');
igual(diaAna.impar, false, 'dia sem marcacao impar');
igual(diaAna.diaSemana, 'Segunda', 'dia da semana calculado');
igual(diaAna.total, '08:08', 'total trabalhado no dia (07:58-12:04 e 13:03-17:05)');
igual(diaAna.pares[0].minutos, 246, 'minutos do primeiro par');
igual(AFD.formatarMinutos(492), '08:12', 'formatacao de minutos');

/* a visao em cartoes mostra o NSR de cada ficha: horario e NSR nao podem desencontrar */
var nsrBatem = espelho.every(function (dia) {
    return dia.horarios.every(function (hora, i) {
        var m = r1510.marcacoes.filter(function (x) { return x.nsr === dia.nsrs[i]; })[0];
        return m && m.hora === hora && m.data === dia.data && m.chave === dia.chave;
    });
});
ok(nsrBatem, 'cada horario do espelho aponta para o NSR da propria marcacao');

var impar = AFD.montarEspelho([
    { chave: '1', identificador: '11144477735', data: '2026-08-03', hora: '08:00:00', tipoIdentificador: 'CPF' },
    { chave: '1', identificador: '11144477735', data: '2026-08-03', hora: '12:00:00', tipoIdentificador: 'CPF' },
    { chave: '1', identificador: '11144477735', data: '2026-08-03', hora: '13:00:00', tipoIdentificador: 'CPF' }
], []);
igual(impar[0].impar, true, 'dia com numero impar de marcacoes e sinalizado');
igual(impar[0].total, '04:00', 'total considera apenas os pares completos');

/* ------------------------------------------------------------------ */
grupo('Robustez');

var semQuebras = ler('afd_1510_exemplo.txt', 'latin1').replace(/\r?\n/g, '');
var rSemQuebras = AFD.analisar(semQuebras);
igual(rSemQuebras.resumo.totalMarcacoes, 80, 'arquivo 1.510 sem quebras de linha e reconstituido');

var comBOM = '﻿' + texto671;
igual(AFD.analisar(comBOM).resumo.totalMarcacoes, 80, 'BOM no inicio do arquivo e ignorado');

var soLF = texto671.replace(/\r\n/g, '\n');
igual(AFD.analisar(soLF).resumo.totalMarcacoes, 80, 'arquivo com quebras LF');

var comVazias = texto671.replace(/\r\n/g, '\r\n\r\n');
igual(AFD.analisar(comVazias).resumo.totalMarcacoes, 80, 'linhas em branco sao ignoradas');

igual(AFD.analisar('lixo qualquer\n').layout, 'desconhecido', 'arquivo invalido nao e confundido com AFD');
ok(AFD.analisar('').inconsistencias.length > 0, 'arquivo vazio gera inconsistencia');

var forcado = AFD.analisar(texto671, { layout: '671' });
igual(forcado.resumo.totalMarcacoes, 80, 'leiaute forcado manualmente');

/* analise em lotes deve dar o mesmo resultado da analise de uma vez */
var an = AFD.criarAnalise();
var linhas = AFD.separarLinhas(texto671);
for (var i = 0; i < linhas.length; i += 7) { an.processar(linhas.slice(i, i + 7)); }
var emLotes = an.finalizar();
igual(emLotes.resumo.totalMarcacoes, r671.resumo.totalMarcacoes, 'analise em lotes: mesmas marcacoes');
igual(emLotes.inconsistencias.length, r671.inconsistencias.length, 'analise em lotes: mesmas inconsistencias');

/* ------------------------------------------------------------------ */
console.log('\n' + (falhas === 0 ? 'TODOS OS TESTES PASSARAM' : 'FALHAS: ' + falhas) +
    '  (' + testes + ' verificacoes)');
process.exit(falhas === 0 ? 0 : 1);
