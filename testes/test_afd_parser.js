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
grupo('Saldo de horas');

igual(AFD.formatarSaldo(64), '+01:04', 'saldo positivo');
igual(AFD.formatarSaldo(-32), '-00:32', 'saldo negativo');
igual(AFD.formatarSaldo(0), '00:00', 'saldo zerado sai sem sinal');

/* o dia do exemplo: 05:00 12:18 ... 09:04 trabalhadas contra 08:00 de jornada */
var diaExemplo = {
    chave: '1', identificador: '11144477735', data: '2026-08-24',
    horarios: ['05:00:00', '09:18:00', '09:46:00', '14:32:00'], totalMinutos: 544
};
var saldoExemplo = AFD.calcularSaldos([diaExemplo]);
igual(diaExemplo.jornadaEsperada, 480, 'jornada padrao de 8 horas');
igual(AFD.formatarSaldo(diaExemplo.saldo), '+01:04', 'saldo do dia de 09:04 trabalhadas');
igual(AFD.formatarSaldo(saldoExemplo.total.saldo), '+01:04', 'total acompanha o unico dia');

igual(AFD.inicioDaSemana('2026-08-24'), '2026-08-24', 'segunda-feira e o inicio da propria semana');
igual(AFD.inicioDaSemana('2026-08-30'), '2026-08-24', 'domingo pertence a semana que comecou na segunda');
igual(AFD.fimDaSemana('2026-08-24'), '2026-08-30', 'semana termina no domingo');
igual(AFD.nomeDoMes('2026-08-24'), 'Agosto/2026', 'rotulo do mes');
ok(AFD.ehFimDeSemana('2026-08-29') && !AFD.ehFimDeSemana('2026-08-28'), 'sabado e fim de semana, sexta nao');

/* jornada menor que a esperada gera saldo negativo */
var diaCurto = { chave: '1', data: '2026-08-25', horarios: ['08:00:00', '12:00:00'], totalMinutos: 240 };
AFD.calcularSaldos([diaCurto]);
igual(AFD.formatarSaldo(diaCurto.saldo), '-04:00', 'dia mais curto que a jornada');

/* jornada configuravel */
var dia6h = { chave: '1', data: '2026-08-26', horarios: ['08:00:00', '14:00:00'], totalMinutos: 360 };
AFD.calcularSaldos([dia6h], { jornadaMinutos: 360 });
igual(AFD.formatarSaldo(dia6h.saldo), '00:00', 'jornada de 6 horas zera o saldo de um dia de 6 horas');

/* acumulados por semana, mes e pessoa */
var saldosEspelho = AFD.calcularSaldos(AFD.montarEspelho(r1510.marcacoes, r1510.pessoas));
var pessoaAna = saldosEspelho.pessoas[AFD.chavePessoa(ana.identificador)];
igual(pessoaAna.dias, 5, 'ANA PAULA com 5 dias no acumulado');
igual(pessoaAna.esperado, 5 * 480, 'jornada esperada de 5 dias');
igual(pessoaAna.saldo, pessoaAna.minutos - pessoaAna.esperado, 'saldo da pessoa fecha com trabalhado menos esperado');
igual(Object.keys(pessoaAna.semanas).length, 1, 'os 5 dias caem na mesma semana');
igual(pessoaAna.semanas['2026-08-03'].saldo, pessoaAna.saldo, 'saldo da semana igual ao da pessoa no periodo');
igual(pessoaAna.meses['2026-08'].rotulo, 'Agosto/2026', 'balde do mes rotulado');

var somaDasPessoas = Object.keys(saldosEspelho.pessoas).reduce(function (t, k) {
    return t + saldosEspelho.pessoas[k].saldo;
}, 0);
igual(somaDasPessoas, saldosEspelho.total.saldo, 'total geral e a soma dos trabalhadores');

/* escalas semanais: o que fecha as 44h da Constituicao */
igual(AFD.somaDaEscala(AFD.ESCALAS['sem44_9h_sex8h'].dias), 44 * 60, 'escala de 9h de seg a qui com sexta de 8h soma 44h');

/* jornada real: entra 06:55, sai 16:55 com 1h de intervalo; sexta sai 15:55 */
var semanaReal = [
    { chave: '1', data: '2026-08-24', horarios: ['06:55:00', '11:55:00', '12:55:00', '16:55:00'], totalMinutos: 540 },
    { chave: '1', data: '2026-08-25', horarios: ['06:55:00', '11:55:00', '12:55:00', '16:55:00'], totalMinutos: 540 },
    { chave: '1', data: '2026-08-26', horarios: ['06:55:00', '11:55:00', '12:55:00', '16:55:00'], totalMinutos: 540 },
    { chave: '1', data: '2026-08-27', horarios: ['06:55:00', '11:55:00', '12:55:00', '16:55:00'], totalMinutos: 540 },
    { chave: '1', data: '2026-08-28', horarios: ['06:55:00', '11:55:00', '12:55:00', '15:55:00'], totalMinutos: 480 }
];
var saldoReal = AFD.calcularSaldos(semanaReal, { escala: 'sem44_9h_sex8h' });
igual(semanaReal[0].jornadaEsperada, 540, 'segunda espera 9h');
igual(semanaReal[4].jornadaEsperada, 480, 'sexta espera 8h');
igual(saldoReal.total.minutos, 44 * 60, 'a semana cumprida soma 44h trabalhadas');
igual(saldoReal.total.esperado, 44 * 60, 'a escala espera 44h');
igual(AFD.formatarSaldo(saldoReal.total.saldo), '00:00', 'semana na jornada exata fecha zerada');
igual(AFD.formatarSaldo(semanaReal[4].saldo), '00:00', 'sexta de 8h fecha zerada');

/* meia hora a mais numa quarta aparece so nela */
var comExtra = semanaReal.map(function (d) { return { chave: '1', data: d.data, horarios: d.horarios.slice(), totalMinutos: d.totalMinutos }; });
comExtra[2].totalMinutos = 570;
var saldoExtra = AFD.calcularSaldos(comExtra, { escala: 'sem44_9h_sex8h' });
igual(AFD.formatarSaldo(comExtra[2].saldo), '+00:30', 'meia hora a mais na quarta');
igual(AFD.formatarSaldo(saldoExtra.total.saldo), '+00:30', 'e a semana fecha com a mesma meia hora');

igual(AFD.somaDaEscala(AFD.ESCALAS['sem44_8h48'].dias), 44 * 60, 'escala de 8h48 de segunda a sexta soma 44h');
igual(AFD.somaDaEscala(AFD.ESCALAS['sem44_sab'].dias), 44 * 60, 'escala com sabado de 4h tambem soma 44h');
igual(AFD.somaDaEscala(AFD.ESCALAS['sem40'].dias), 40 * 60, 'escala de 8h de segunda a sexta soma 40h');

/* uma semana cheia na escala de 8h48 */
var semana48 = ['2026-08-24', '2026-08-25', '2026-08-26', '2026-08-27', '2026-08-28'].map(function (d) {
    return { chave: '1', data: d, horarios: ['08:00:00', '17:48:00'], totalMinutos: 588 };
});
var saldo48 = AFD.calcularSaldos(semana48, { escala: 'sem44_8h48' });
igual(semana48[0].jornadaEsperada, 528, 'segunda espera 8h48');
igual(AFD.formatarSaldo(semana48[0].saldo), '+01:00', 'dia de 9h48 na escala de 8h48');
igual(saldo48.total.esperado, 44 * 60, 'a semana inteira espera 44h');
igual(AFD.formatarSaldo(saldo48.total.saldo), '+05:00', 'saldo da semana');

/* mesma semana na escala com sabado: sexta espera 8h e sabado 4h */
var comSabado = [
    { chave: '1', data: '2026-08-28', horarios: ['08:00:00', '16:00:00'], totalMinutos: 480 },
    { chave: '1', data: '2026-08-29', horarios: ['08:00:00', '12:00:00'], totalMinutos: 240 }
];
AFD.calcularSaldos(comSabado, { escala: 'sem44_sab' });
igual(comSabado[0].jornadaEsperada, 480, 'sexta espera 8h na escala com sabado');
igual(comSabado[1].jornadaEsperada, 240, 'sabado espera 4h');
igual(AFD.formatarSaldo(comSabado[1].saldo), '00:00', 'sabado de 4h fecha zerado');

/* domingo nao tem jornada esperada em nenhuma escala pronta */
var domingo = [{ chave: '1', data: '2026-08-30', horarios: ['08:00:00', '12:00:00'], totalMinutos: 240 }];
AFD.calcularSaldos(domingo, { escala: 'sem44_8h48' });
igual(domingo[0].jornadaEsperada, 0, 'domingo sem jornada esperada');
igual(AFD.formatarSaldo(domingo[0].saldo), '+04:00', 'domingo trabalhado vira saldo integral');

/* escala livre, informada em minutos por dia da semana */
var livre = [{ chave: '1', data: '2026-08-25', horarios: ['08:00:00', '14:00:00'], totalMinutos: 360 }];
AFD.calcularSaldos(livre, { escala: [0, 360, 360, 360, 360, 360, 0] });
igual(AFD.formatarSaldo(livre[0].saldo), '00:00', 'escala personalizada de 6h');

/* fim de semana pode contar como saldo integral */
var sabado = { chave: '1', data: '2026-08-29', horarios: ['08:00:00', '12:00:00'], totalMinutos: 240 };
AFD.calcularSaldos([sabado], { apenasDiasUteis: true });
igual(AFD.formatarSaldo(sabado.saldo), '+04:00', 'sabado vira saldo integral quando a jornada e so de dias uteis');

/* ------------------------------------------------------------------ */
grupo('Lista de nomes');

/* formato do export de usuarios do REP */
var listaREP = AFD.lerListaDeNomes(
    'pis;nome;administrador;matricula;rfid;codigo;senha;barras;digitais\r\n' +
    '12065478502;ANA PAULA RODRIGUES SOUZA ;0;53;53;53;;0000000053;SUNSUzIxAAAH\r\n' +
    '20987654327;CARLOS EDUARDO MARTINS;0;0;0;0;;;\r\n' +
    '0;ADMIN DO RELOGIO;1;0;0;0;;;\r\n' +
    '15;Suporte;1;0;0;15;1234;;\r\n'
);
igual(listaREP.total, 2, 'le os dois trabalhadores do export de usuarios');
igual(listaREP.ignorados, 2, 'descarta os usuarios administrativos sem documento');
igual(listaREP.separador, ';', 'separador detectado');
igual(listaREP.nomes[AFD.chavePessoa('12065478502')], 'ANA PAULA RODRIGUES SOUZA', 'nome pelo PIS, sem espaco sobrando');

/* duas colunas simples, sem cabecalho */
var listaSimples = AFD.lerListaDeNomes('11144477735,Fulano de Tal\n52998224725,Beltrano\n');
igual(listaSimples.total, 2, 'arquivo de duas colunas separado por virgula');
igual(listaSimples.nomes[AFD.chavePessoa('11144477735')], 'Fulano de Tal', 'nome pelo CPF');

/* CPF que perdeu o zero a esquerda no export */
var listaZero = AFD.lerListaDeNomes('documento;nome\n6769043432;Sicrana da Silva\n');
igual(listaZero.total, 1, 'documento de 10 digitos e aproveitado');
igual(listaZero.nomes[AFD.chavePessoa('06769043432')], 'Sicrana da Silva', 'zero a esquerda reposto no CPF');

/* a mesma pessoa cadastrada por PIS e por CPF chega pelos dois caminhos */
var listaDupla = AFD.lerListaDeNomes('pis;nome\n12065478502;Ana Paula\n11144477735;Ana Paula\n');
igual(listaDupla.total, 2, 'dois documentos da mesma pessoa entram como duas chaves');

/* tabulacao e aspas */
var listaTab = AFD.lerListaDeNomes('pis\tnome\n12065478502\t"SOUZA, ANA"\n');
igual(listaTab.nomes[AFD.chavePessoa('12065478502')], 'SOUZA, ANA', 'separador por tabulacao com aspas');

/* arquivo que nao serve */
igual(AFD.lerListaDeNomes('isto nao e uma lista').total, 0, 'texto solto nao vira lista');
igual(AFD.lerListaDeNomes('').total, 0, 'arquivo vazio');

/* o nome da lista chega ao espelho */
var pessoasComLista = r1510.pessoas.map(function (p) {
    return { chave: p.chave, identificador: p.identificador, tipoIdentificador: p.tipoIdentificador,
        nome: '', nomeExterno: false };
});
pessoasComLista.forEach(function (p) {
    var n = listaREP.nomes[p.chave];
    if (n) { p.nome = n; p.nomeExterno = true; }
});
var espelhoComLista = AFD.montarEspelho(r1510.marcacoes, pessoasComLista);
var diaComNome = espelhoComLista.filter(function (d) { return d.nome; })[0];
ok(!!diaComNome, 'o espelho recebe o nome vindo da lista');
igual(diaComNome.nomeExterno, true, 'a origem do nome fica marcada');

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
