/*!
 * Leitor de AFD - analisador do Arquivo-Fonte de Dados (AFD)
 *
 * Leiautes suportados:
 *   - Portaria MTE 1.510/2009  (REP-C classico, datas DDMMAAAA)
 *   - Portaria MTP 671/2021    (REP-C, REP-A e REP-P, datas AAAA-MM-DD)
 *
 * Funciona no navegador (window.AFD) e no Node (module.exports).
 * Nao depende de bibliotecas externas e nao envia nada para a rede.
 */
(function (raiz, fabrica) {
    'use strict';
    var api = fabrica();
    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    } else {
        raiz.AFD = api;
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    /* ------------------------------------------------------------------ *
     * Tabelas de apoio
     * ------------------------------------------------------------------ */

    var TIPOS = {
        '1': 'Cabecalho',
        '2': 'Inclusao/alteracao de empregador',
        '3': 'Marcacao de ponto',
        '4': 'Ajuste do relogio',
        '5': 'Inclusao/alteracao/exclusao de empregado',
        '6': 'Evento sensivel do REP',
        '7': 'Marcacao de ponto (REP-P)',
        '8': 'Marcacao de ponto anotada/excluida',
        '9': 'Trailer'
    };

    var TIPOS_ROTULO = {
        '1': 'Cabeçalho',
        '2': 'Empregador',
        '3': 'Marcação de ponto',
        '4': 'Ajuste do relógio',
        '5': 'Empregado',
        '6': 'Evento sensível do REP',
        '7': 'Marcação de ponto (REP-P)',
        '8': 'Marcação anotada/excluída',
        '9': 'Trailer'
    };

    /* Tamanho esperado de cada tipo no leiaute da Portaria 1.510/2009 */
    var TAMANHOS_1510 = { '1': 232, '2': 299, '3': 34, '4': 34, '5': 87, '9': 37 };

    var OPERACOES = { 'I': 'Inclusão', 'A': 'Alteração', 'E': 'Exclusão' };

    /* ------------------------------------------------------------------ *
     * Utilitarios de texto
     * ------------------------------------------------------------------ */

    function apenasDigitos(v) {
        return String(v == null ? '' : v).replace(/\D+/g, '');
    }

    function limpar(v) {
        return String(v == null ? '' : v).replace(/\s+$/, '').replace(/^\s+/, '');
    }

    function ehSoDigitos(v) {
        return /^[0-9]+$/.test(String(v == null ? '' : v));
    }

    function pad(n, tam) {
        var s = String(n);
        while (s.length < tam) { s = '0' + s; }
        return s;
    }

    /* ------------------------------------------------------------------ *
     * Validacao de documentos
     * ------------------------------------------------------------------ */

    function validarCPF(valor) {
        var c = apenasDigitos(valor);
        if (c.length === 12 && c.charAt(0) === '0') { c = c.slice(1); }
        if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) { return false; }
        var soma = 0, i, dv;
        for (i = 0; i < 9; i++) { soma += Number(c.charAt(i)) * (10 - i); }
        dv = (soma * 10) % 11;
        if (dv === 10) { dv = 0; }
        if (dv !== Number(c.charAt(9))) { return false; }
        soma = 0;
        for (i = 0; i < 10; i++) { soma += Number(c.charAt(i)) * (11 - i); }
        dv = (soma * 10) % 11;
        if (dv === 10) { dv = 0; }
        return dv === Number(c.charAt(10));
    }

    function validarPIS(valor) {
        var c = apenasDigitos(valor);
        while (c.length > 11 && c.charAt(0) === '0') { c = c.slice(1); }
        c = pad(c, 11);
        if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) { return false; }
        var pesos = [3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
        var soma = 0;
        for (var i = 0; i < 10; i++) { soma += Number(c.charAt(i)) * pesos[i]; }
        var dv = 11 - (soma % 11);
        if (dv === 10 || dv === 11) { dv = 0; }
        return dv === Number(c.charAt(10));
    }

    /* Aceita CNPJ numerico e CNPJ alfanumerico (valor do caractere = ASCII - 48) */
    function validarCNPJ(valor) {
        var c = String(valor == null ? '' : valor).toUpperCase().replace(/[^0-9A-Z]/g, '');
        if (c.length !== 14 || /^(.)\1{13}$/.test(c)) { return false; }
        if (!/^\d{2}$/.test(c.slice(12))) { return false; }
        var p1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
        var p2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
        var soma = 0, i, dv;
        for (i = 0; i < 12; i++) { soma += (c.charCodeAt(i) - 48) * p1[i]; }
        dv = soma % 11;
        dv = dv < 2 ? 0 : 11 - dv;
        if (dv !== Number(c.charAt(12))) { return false; }
        soma = 0;
        for (i = 0; i < 13; i++) { soma += (c.charCodeAt(i) - 48) * p2[i]; }
        dv = soma % 11;
        dv = dv < 2 ? 0 : 11 - dv;
        return dv === Number(c.charAt(13));
    }

    function formatarCPF(v) {
        var c = apenasDigitos(v);
        if (c.length === 12 && c.charAt(0) === '0') { c = c.slice(1); }
        if (c.length !== 11) { return v; }
        return c.slice(0, 3) + '.' + c.slice(3, 6) + '.' + c.slice(6, 9) + '-' + c.slice(9);
    }

    function formatarPIS(v) {
        var c = apenasDigitos(v);
        while (c.length > 11 && c.charAt(0) === '0') { c = c.slice(1); }
        c = pad(c, 11);
        if (c.length !== 11) { return v; }
        return c.slice(0, 3) + '.' + c.slice(3, 8) + '.' + c.slice(8, 10) + '-' + c.slice(10);
    }

    function formatarCNPJ(v) {
        var c = String(v == null ? '' : v).toUpperCase().replace(/[^0-9A-Z]/g, '');
        if (c.length !== 14) { return v; }
        return c.slice(0, 2) + '.' + c.slice(2, 5) + '.' + c.slice(5, 8) + '/' + c.slice(8, 12) + '-' + c.slice(12);
    }

    function formatarDocumento(valor, tipo) {
        if (!valor) { return ''; }
        if (tipo === 'CPF') { return formatarCPF(valor); }
        if (tipo === 'PIS') { return formatarPIS(valor); }
        if (tipo === 'CNPJ') { return formatarCNPJ(valor); }
        return valor;
    }

    /* Mascara para compartilhar relatorios sem expor documentos (LGPD) */
    function mascarar(valor) {
        var c = apenasDigitos(valor);
        if (c.length < 5) { return valor; }
        return c.slice(0, 3) + '.***.***-' + c.slice(-2);
    }

    /* ------------------------------------------------------------------ *
     * Datas e horas
     * ------------------------------------------------------------------ */

    function dataEhValida(ano, mes, dia) {
        if (!ano || mes < 1 || mes > 12 || dia < 1) { return false; }
        var dias = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
        if (mes === 2 && ((ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0)) { return dia <= 29; }
        return dia <= dias[mes - 1];
    }

    function horaEhValida(h, m, s) {
        return h >= 0 && h <= 23 && m >= 0 && m <= 59 && (s === undefined || (s >= 0 && s <= 59));
    }

    /* DDMMAAAA -> { iso: 'AAAA-MM-DD', valido } */
    function lerDataDDMMAAAA(texto) {
        var t = String(texto == null ? '' : texto);
        var m = /^(\d{2})(\d{2})(\d{4})$/.exec(t);
        if (!m) { return { iso: '', bruto: t, valido: false }; }
        return {
            iso: m[3] + '-' + m[2] + '-' + m[1],
            bruto: t,
            valido: dataEhValida(Number(m[3]), Number(m[2]), Number(m[1]))
        };
    }

    /* HHMM ou HHMMSS -> { hora: 'hh:mm:ss', valido } */
    function lerHoraCompacta(texto) {
        var t = String(texto == null ? '' : texto);
        var m = /^(\d{2})(\d{2})(\d{2})?$/.exec(t);
        if (!m) { return { hora: '', bruto: t, valido: false }; }
        var s = m[3] ? Number(m[3]) : 0;
        return {
            hora: m[1] + ':' + m[2] + ':' + pad(s, 2),
            bruto: t,
            valido: horaEhValida(Number(m[1]), Number(m[2]), s)
        };
    }

    /* Data ISO isolada (AAAA-MM-DD), usada nos campos de periodo do cabecalho */
    function lerDataISO(texto, pos) {
        pos = pos || 0;
        var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(texto).slice(pos));
        if (!m) { return null; }
        return {
            iso: m[1] + '-' + m[2] + '-' + m[3],
            bruto: m[0],
            valido: dataEhValida(Number(m[1]), Number(m[2]), Number(m[3])),
            inicio: pos,
            fim: pos + m[0].length
        };
    }

    /*
     * Data/hora dos registros da Portaria 671. Aceita as variacoes que os
     * fabricantes usam na pratica:
     *   AAAA-MM-DDThh:mm:ss-0300 | AAAA-MM-DDThh:mm:ss | AAAA-MM-DD hh:mm
     *   AAAA-MM-DDhhmmss         | AAAA-MM-DDhhmm
     * O lookahead evita "comer" a data seguinte quando o campo nao tem hora.
     */
    var RE_DATA_HORA = new RegExp(
        '^(\\d{4})-(\\d{2})-(\\d{2})' +
        '(?:[T ](\\d{2}):?(\\d{2})(?::?(\\d{2}))?' +
        '|(?!\\d{4}-)(\\d{2}):?(\\d{2})(?::?(\\d{2}))?)?' +
        '(Z|[+-]\\d{2}:?\\d{2})?'
    );

    function lerDataHoraISO(texto, pos) {
        pos = pos || 0;
        var m = RE_DATA_HORA.exec(String(texto).slice(pos));
        if (!m) { return null; }
        var hh = m[4] || m[7] || '';
        var mi = m[5] || m[8] || '';
        var ss = m[6] || m[9] || '';
        var temHora = hh !== '';
        var valido = dataEhValida(Number(m[1]), Number(m[2]), Number(m[3]));
        if (temHora) {
            valido = valido && horaEhValida(Number(hh), Number(mi), ss === '' ? undefined : Number(ss));
        }
        return {
            data: m[1] + '-' + m[2] + '-' + m[3],
            hora: temHora ? (hh + ':' + mi + ':' + pad(ss === '' ? 0 : Number(ss), 2)) : '',
            fuso: m[10] || '',
            temHora: temHora,
            valido: valido,
            bruto: m[0],
            inicio: pos,
            fim: pos + m[0].length
        };
    }

    function carimbo(data, hora) {
        if (!data) { return ''; }
        return data + 'T' + (hora || '00:00:00');
    }

    function minutosDoDia(hora) {
        var m = /^(\d{2}):(\d{2})(?::(\d{2}))?/.exec(String(hora || ''));
        if (!m) { return null; }
        return Number(m[1]) * 60 + Number(m[2]);
    }

    function formatarMinutos(total) {
        var neg = total < 0;
        var t = Math.abs(Math.round(total));
        return (neg ? '-' : '') + pad(Math.floor(t / 60), 2) + ':' + pad(t % 60, 2);
    }

    function formatarDataBR(iso) {
        var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
        return m ? m[3] + '/' + m[2] + '/' + m[1] : (iso || '');
    }

    function formatarSaldo(total) {
        var t = Math.round(total || 0);
        if (t === 0) { return '00:00'; }
        return (t > 0 ? '+' : '-') + formatarMinutos(Math.abs(t));
    }

    var DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    var MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

    function diaDaSemana(iso) {
        var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
        if (!m) { return ''; }
        var d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
        return DIAS_SEMANA[d.getUTCDay()];
    }

    function dataParaUTC(iso) {
        var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
        if (!m) { return null; }
        return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
    }

    function ehFimDeSemana(iso) {
        var d = dataParaUTC(iso);
        if (!d) { return false; }
        var s = d.getUTCDay();
        return s === 0 || s === 6;
    }

    /* Segunda-feira da semana da data, usada como chave e rotulo do periodo */
    function inicioDaSemana(iso) {
        var d = dataParaUTC(iso);
        if (!d) { return ''; }
        var s = d.getUTCDay();
        d.setUTCDate(d.getUTCDate() - (s === 0 ? 6 : s - 1));
        return d.toISOString().slice(0, 10);
    }

    function fimDaSemana(iso) {
        var d = dataParaUTC(inicioDaSemana(iso));
        if (!d) { return ''; }
        d.setUTCDate(d.getUTCDate() + 6);
        return d.toISOString().slice(0, 10);
    }

    function nomeDoMes(iso) {
        var m = /^(\d{4})-(\d{2})/.exec(String(iso || ''));
        return m ? MESES[Number(m[2]) - 1] + '/' + m[1] : '';
    }

    /* ------------------------------------------------------------------ *
     * Leitura do identificador do trabalhador (PIS de 12 ou CPF de 11)
     * ------------------------------------------------------------------ */

    function lerIdentificador(texto, pos, preferido) {
        var resto = String(texto).slice(pos);
        var corrida = /^\d+/.exec(resto);
        if (!corrida) { return null; }
        var digitos = corrida[0];
        var candidatos = [];

        if (digitos.length >= 11) { candidatos.push({ valor: digitos.slice(0, 11), tipo: 'CPF', tam: 11 }); }
        if (digitos.length >= 12) { candidatos.push({ valor: digitos.slice(0, 12), tipo: 'PIS', tam: 12 }); }
        if (!candidatos.length) {
            return {
                valor: digitos, tipo: 'DESCONHECIDO', valido: false,
                confianca: 0, inicio: pos, fim: pos + digitos.length
            };
        }

        candidatos.forEach(function (c) {
            var sobra = digitos.length - c.tam;
            c.valido = c.tipo === 'CPF' ? validarCPF(c.valor) : validarPIS(c.valor);
            c.pontos = 0;
            if (c.valido) { c.pontos += 4; }
            if (c.tipo === preferido) { c.pontos += 2; }
            if (sobra === 0) { c.pontos += 1; }
            if (sobra === 4) { c.pontos += 1; }   /* provavel CRC-16 logo em seguida */
        });
        candidatos.sort(function (a, b) { return b.pontos - a.pontos; });

        var esc = candidatos[0];
        return {
            valor: esc.valor,
            tipo: esc.tipo,
            valido: esc.valido,
            confianca: esc.pontos,
            inicio: pos,
            fim: pos + esc.tam
        };
    }

    /* Chave estavel para agrupar a mesma pessoa mesmo com zeros a esquerda */
    function chavePessoa(valor) {
        var c = apenasDigitos(valor).replace(/^0+/, '');
        return c || apenasDigitos(valor) || String(valor || '');
    }

    /* ------------------------------------------------------------------ *
     * Deteccao de leiaute
     * ------------------------------------------------------------------ */

    function detectarLayout(linhas) {
        var i, l;
        for (i = 0; i < linhas.length && i < 500; i++) {
            l = linhas[i];
            if (!l) { continue; }
            if (/^\d{9}1/.test(l)) {
                if (/\d{4}-\d{2}-\d{2}/.test(l)) { return '671'; }
                if (l.length >= 228 && /^\d{8}$/.test(l.substr(204, 8))) { return '1510'; }
            }
        }
        for (i = 0; i < linhas.length && i < 2000; i++) {
            l = linhas[i];
            if (!l) { continue; }
            if (/^\d{9}7/.test(l)) { return '671'; }
            if (/^\d{9}[2-8]\d{4}-\d{2}-\d{2}/.test(l)) { return '671'; }
            if (l.length === 34 && /^\d{34}$/.test(l) && l.charAt(9) === '3') { return '1510'; }
        }
        return 'desconhecido';
    }

    /*
     * Alguns REPs exportam o AFD sem quebras de linha. No leiaute 1.510 os
     * tamanhos sao fixos, entao da para reconstituir as linhas.
     */
    function dividirSemQuebras(texto) {
        var linhas = [];
        var pos = 0;
        while (pos < texto.length) {
            var tam = TAMANHOS_1510[texto.charAt(pos + 9)];
            if (!tam || pos + tam > texto.length) {
                var sobra = texto.length - pos;
                if (sobra > 0 && sobra <= 60 && texto.charAt(texto.length - 1) === '9') {
                    linhas.push(texto.slice(pos));
                    return linhas;
                }
                return null;
            }
            linhas.push(texto.substr(pos, tam));
            pos += tam;
        }
        return linhas;
    }

    /* ------------------------------------------------------------------ *
     * Trailer (comum aos dois leiautes: N grupos de 9 digitos + "9")
     * ------------------------------------------------------------------ */

    function lerTrailer(linha) {
        if (!ehSoDigitos(linha) || linha.charAt(linha.length - 1) !== '9') { return null; }
        var corpo = linha.slice(0, -1);
        if (corpo.length === 0 || corpo.length % 9 !== 0) { return null; }
        var grupos = corpo.length / 9;
        if (grupos < 4 || grupos > 8) { return null; }
        var contagens = {};
        var ordem = ['2', '3', '4', '5', '6', '7', '8'];
        for (var i = 0; i < grupos; i++) {
            contagens[ordem[i]] = Number(corpo.substr(i * 9, 9));
        }
        return { tipo: '9', contagens: contagens, grupos: grupos, linha: linha, tamanho: linha.length, campos: [] };
    }

    /* ------------------------------------------------------------------ *
     * Registros - Portaria 1.510/2009
     * ------------------------------------------------------------------ */

    function lerRegistro1510(linha) {
        var r = {
            nsr: linha.slice(0, 9),
            nsrNumero: Number(linha.slice(0, 9)),
            tipo: linha.charAt(9),
            tamanho: linha.length,
            linha: linha,
            campos: []
        };
        var d, h, d2, h2;

        function campo(nome, valor, ini, tam) {
            r.campos.push({ nome: nome, valor: valor, inicio: ini, fim: ini + tam - 1 });
        }

        campo('NSR', r.nsr, 1, 9);
        campo('Tipo do registro', r.tipo, 10, 1);

        switch (r.tipo) {
        case '1':
            r.tamanhoEsperado = 232;
            r.tipoIdentificadorEmpregador = linha.charAt(10);
            r.identificadorEmpregador = linha.substr(11, 14);
            r.tipoDocumentoEmpregador = r.tipoIdentificadorEmpregador === '2' ? 'CPF' : 'CNPJ';
            r.cei = limpar(linha.substr(25, 12));
            r.razaoSocial = limpar(linha.substr(37, 150));
            r.numeroFabricacao = limpar(linha.substr(187, 17));
            d = lerDataDDMMAAAA(linha.substr(204, 8)); r.dataInicial = d.iso; r.dataInicialValida = d.valido;
            d = lerDataDDMMAAAA(linha.substr(212, 8)); r.dataFinal = d.iso; r.dataFinalValida = d.valido;
            d = lerDataDDMMAAAA(linha.substr(220, 8)); r.dataGeracao = d.iso; r.dataGeracaoValida = d.valido;
            h = lerHoraCompacta(linha.substr(228, 4)); r.horaGeracao = h.hora;
            campo('Tipo do identificador do empregador', r.tipoIdentificadorEmpregador, 11, 1);
            campo('CNPJ/CPF do empregador', r.identificadorEmpregador, 12, 14);
            campo('CEI', r.cei, 26, 12);
            campo('Razão social', r.razaoSocial, 38, 150);
            campo('Número de fabricação do REP', r.numeroFabricacao, 188, 17);
            campo('Data inicial', r.dataInicial, 205, 8);
            campo('Data final', r.dataFinal, 213, 8);
            campo('Data de geração', r.dataGeracao, 221, 8);
            campo('Hora de geração', r.horaGeracao, 229, 4);
            break;

        case '2':
            r.tamanhoEsperado = 299;
            d = lerDataDDMMAAAA(linha.substr(10, 8));
            h = lerHoraCompacta(linha.substr(18, 4));
            r.data = d.iso; r.hora = h.hora; r.dataValida = d.valido && h.valido;
            r.tipoIdentificadorEmpregador = linha.charAt(22);
            r.identificadorEmpregador = linha.substr(23, 14);
            r.tipoDocumentoEmpregador = r.tipoIdentificadorEmpregador === '2' ? 'CPF' : 'CNPJ';
            r.cei = limpar(linha.substr(37, 12));
            r.razaoSocial = limpar(linha.substr(49, 150));
            r.localPrestacao = limpar(linha.substr(199, 100));
            campo('Data', r.data, 11, 8);
            campo('Hora', r.hora, 19, 4);
            campo('Tipo do identificador do empregador', r.tipoIdentificadorEmpregador, 23, 1);
            campo('CNPJ/CPF do empregador', r.identificadorEmpregador, 24, 14);
            campo('CEI', r.cei, 38, 12);
            campo('Razão social', r.razaoSocial, 50, 150);
            campo('Local de prestação de serviço', r.localPrestacao, 200, 100);
            break;

        case '3':
            r.tamanhoEsperado = 34;
            d = lerDataDDMMAAAA(linha.substr(10, 8));
            h = lerHoraCompacta(linha.substr(18, 4));
            r.data = d.iso; r.hora = h.hora; r.dataValida = d.valido && h.valido;
            r.identificador = linha.substr(22, 12);
            r.tipoIdentificador = 'PIS';
            r.identificadorValido = validarPIS(r.identificador);
            campo('Data', r.data, 11, 8);
            campo('Hora', r.hora, 19, 4);
            campo('PIS', r.identificador, 23, 12);
            break;

        case '4':
            r.tamanhoEsperado = 34;
            d = lerDataDDMMAAAA(linha.substr(10, 8));
            h = lerHoraCompacta(linha.substr(18, 4));
            d2 = lerDataDDMMAAAA(linha.substr(22, 8));
            h2 = lerHoraCompacta(linha.substr(30, 4));
            r.dataAntes = d.iso; r.horaAntes = h.hora;
            r.dataDepois = d2.iso; r.horaDepois = h2.hora;
            r.dataValida = d.valido && h.valido && d2.valido && h2.valido;
            campo('Data anterior ao ajuste', r.dataAntes, 11, 8);
            campo('Hora anterior ao ajuste', r.horaAntes, 19, 4);
            campo('Data posterior ao ajuste', r.dataDepois, 23, 8);
            campo('Hora posterior ao ajuste', r.horaDepois, 31, 4);
            break;

        case '5':
            r.tamanhoEsperado = 87;
            d = lerDataDDMMAAAA(linha.substr(10, 8));
            h = lerHoraCompacta(linha.substr(18, 4));
            r.data = d.iso; r.hora = h.hora; r.dataValida = d.valido && h.valido;
            r.operacao = linha.charAt(22);
            r.operacaoDescricao = OPERACOES[r.operacao] || r.operacao;
            r.identificador = linha.substr(23, 12);
            r.tipoIdentificador = 'PIS';
            r.identificadorValido = validarPIS(r.identificador);
            r.nome = limpar(linha.substr(35, 52));
            campo('Data', r.data, 11, 8);
            campo('Hora', r.hora, 19, 4);
            campo('Operação', r.operacao, 23, 1);
            campo('PIS', r.identificador, 24, 12);
            campo('Nome', r.nome, 36, 52);
            break;

        default:
            r.desconhecido = true;
        }
        return r;
    }

    /* ------------------------------------------------------------------ *
     * Registros - Portaria 671/2021
     * ------------------------------------------------------------------ */

    function lerRegistro671(linha) {
        var r = {
            nsr: linha.slice(0, 9),
            nsrNumero: Number(linha.slice(0, 9)),
            tipo: linha.charAt(9),
            tamanho: linha.length,
            linha: linha,
            campos: []
        };
        var resto = linha.slice(10);
        var pos = 0, dh, id, dt, cauda, mh;

        function campo(nome, valor, iniResto, tam) {
            r.campos.push({ nome: nome, valor: valor, inicio: 11 + iniResto, fim: 11 + iniResto + Math.max(tam, 1) - 1 });
        }

        r.campos.push({ nome: 'NSR', valor: r.nsr, inicio: 1, fim: 9 });
        r.campos.push({ nome: 'Tipo do registro', valor: r.tipo, inicio: 10, fim: 10 });

        switch (r.tipo) {
        case '1':
            /* Prefixo de tamanho fixo; o final e lido por varredura de datas,
               porque ha variacao entre fabricantes no carimbo de geracao. */
            r.tipoIdentificadorEmpregador = resto.charAt(0);
            r.identificadorEmpregador = resto.substr(1, 14);
            r.tipoDocumentoEmpregador = r.tipoIdentificadorEmpregador === '2' ? 'CPF' : 'CNPJ';
            r.cei = limpar(resto.substr(15, 14));
            r.razaoSocial = limpar(resto.substr(29, 150));
            r.numeroFabricacao = limpar(resto.substr(179, 17));
            campo('Tipo do identificador do empregador', r.tipoIdentificadorEmpregador, 0, 1);
            campo('CNPJ/CPF do empregador', r.identificadorEmpregador, 1, 14);
            campo('CNO/CAEPF', r.cei, 15, 14);
            campo('Razão social', r.razaoSocial, 29, 150);
            campo('Número de fabricação do REP', r.numeroFabricacao, 179, 17);

            pos = 196;
            dt = lerDataISO(resto, pos);
            if (dt) {
                r.dataInicial = dt.iso; r.dataInicialValida = dt.valido;
                campo('Data inicial dos registros', dt.iso, pos, dt.bruto.length);
                pos = dt.fim;
            }
            dt = lerDataISO(resto, pos);
            if (dt) {
                r.dataFinal = dt.iso; r.dataFinalValida = dt.valido;
                campo('Data final dos registros', dt.iso, pos, dt.bruto.length);
                pos = dt.fim;
            }
            dh = lerDataHoraISO(resto, pos);
            if (dh) {
                r.dataGeracao = dh.data; r.horaGeracao = dh.hora; r.dataGeracaoValida = dh.valido;
                campo('Data/hora da geração', dh.bruto, pos, dh.bruto.length);
                pos = dh.fim;
            }
            r.complemento = limpar(resto.slice(pos));
            if (r.complemento) {
                campo('Complemento (versão do leiaute / desenvolvedor)', r.complemento, pos, resto.length - pos);
            }
            break;

        case '2':
            dh = lerDataHoraISO(resto, 0);
            if (dh) {
                r.data = dh.data; r.hora = dh.hora; r.dataValida = dh.valido;
                campo('Data/hora do registro', dh.bruto, 0, dh.bruto.length);
                pos = dh.fim;
            }
            r.tipoIdentificadorEmpregador = resto.charAt(pos);
            r.identificadorEmpregador = resto.substr(pos + 1, 14);
            r.tipoDocumentoEmpregador = r.tipoIdentificadorEmpregador === '2' ? 'CPF' : 'CNPJ';
            r.cei = limpar(resto.substr(pos + 15, 14));
            r.razaoSocial = limpar(resto.substr(pos + 29, 150));
            r.localPrestacao = limpar(resto.substr(pos + 179, 100));
            campo('Tipo do identificador do empregador', r.tipoIdentificadorEmpregador, pos, 1);
            campo('CNPJ/CPF do empregador', r.identificadorEmpregador, pos + 1, 14);
            campo('CNO/CAEPF', r.cei, pos + 15, 14);
            campo('Razão social', r.razaoSocial, pos + 29, 150);
            campo('Local de prestação de serviço', r.localPrestacao, pos + 179, 100);
            break;

        case '3':
        case '7':
            dh = lerDataHoraISO(resto, 0);
            if (dh) {
                r.data = dh.data; r.hora = dh.hora; r.fuso = dh.fuso; r.dataValida = dh.valido;
                campo('Data/hora da marcação', dh.bruto, 0, dh.bruto.length);
                pos = dh.fim;
            }
            id = lerIdentificador(resto, pos, 'CPF');
            if (id) {
                r.identificador = id.valor;
                r.tipoIdentificador = id.tipo;
                r.identificadorValido = id.valido;
                campo(id.tipo, id.valor, pos, id.valor.length);
                pos = id.fim;
            }
            if (r.tipo === '7') {
                dh = lerDataHoraISO(resto, pos);
                if (dh) {
                    r.dataGravacao = dh.data; r.horaGravacao = dh.hora;
                    campo('Data/hora da gravação', dh.bruto, pos, dh.bruto.length);
                    pos = dh.fim;
                }
                cauda = resto.slice(pos);
                mh = /([0-9A-Fa-f]{32,})\s*$/.exec(cauda);
                if (mh) {
                    r.hash = mh[1];
                    r.complemento = limpar(cauda.slice(0, mh.index));
                    if (r.complemento) { campo('Complemento', r.complemento, pos, mh.index); }
                    campo('Hash do registro', r.hash, pos + mh.index, r.hash.length);
                } else {
                    r.complemento = limpar(cauda);
                    if (r.complemento) { campo('Complemento', r.complemento, pos, cauda.length); }
                }
            } else {
                r.crc = limpar(resto.slice(pos));
                if (r.crc) { campo('CRC-16', r.crc, pos, resto.length - pos); }
            }
            break;

        case '4':
            dh = lerDataHoraISO(resto, 0);
            if (dh) {
                r.dataAntes = dh.data; r.horaAntes = dh.hora;
                campo('Data/hora anterior ao ajuste', dh.bruto, 0, dh.bruto.length);
                pos = dh.fim;
            }
            dh = lerDataHoraISO(resto, pos);
            if (dh) {
                r.dataDepois = dh.data; r.horaDepois = dh.hora;
                campo('Data/hora posterior ao ajuste', dh.bruto, pos, dh.bruto.length);
                pos = dh.fim;
            }
            r.dataValida = !!(r.dataAntes && r.dataDepois);
            r.crc = limpar(resto.slice(pos));
            if (r.crc) { campo('CRC-16', r.crc, pos, resto.length - pos); }
            break;

        case '5':
            dh = lerDataHoraISO(resto, 0);
            if (dh) {
                r.data = dh.data; r.hora = dh.hora; r.dataValida = dh.valido;
                campo('Data/hora do registro', dh.bruto, 0, dh.bruto.length);
                pos = dh.fim;
            }
            r.operacao = resto.charAt(pos);
            r.operacaoDescricao = OPERACOES[r.operacao] || r.operacao;
            campo('Operação', r.operacao, pos, 1);
            pos += 1;
            id = lerIdentificador(resto, pos, 'CPF');
            if (id) {
                r.identificador = id.valor;
                r.tipoIdentificador = id.tipo;
                r.identificadorValido = id.valido;
                campo(id.tipo, id.valor, pos, id.valor.length);
                pos = id.fim;
            }
            r.nome = limpar(resto.substr(pos, 52));
            campo('Nome', r.nome, pos, 52);
            r.complemento = limpar(resto.slice(pos + 52));
            if (r.complemento) { campo('Complemento', r.complemento, pos + 52, r.complemento.length); }
            break;

        case '6':
            dh = lerDataHoraISO(resto, 0);
            if (dh) {
                r.data = dh.data; r.hora = dh.hora; r.dataValida = dh.valido;
                campo('Data/hora do evento', dh.bruto, 0, dh.bruto.length);
                pos = dh.fim;
            }
            r.evento = limpar(resto.slice(pos));
            campo('Descrição do evento', r.evento, pos, resto.length - pos);
            break;

        case '8':
            dh = lerDataHoraISO(resto, 0);
            if (dh) {
                r.data = dh.data; r.hora = dh.hora; r.dataValida = dh.valido;
                campo('Data/hora da marcação', dh.bruto, 0, dh.bruto.length);
                pos = dh.fim;
            }
            id = lerIdentificador(resto, pos, 'CPF');
            if (id) {
                r.identificador = id.valor;
                r.tipoIdentificador = id.tipo;
                r.identificadorValido = id.valido;
                campo(id.tipo, id.valor, pos, id.valor.length);
                pos = id.fim;
            }
            r.complemento = limpar(resto.slice(pos));
            if (r.complemento) { campo('Complemento', r.complemento, pos, resto.length - pos); }
            break;

        default:
            r.desconhecido = true;
        }
        return r;
    }

    /* ------------------------------------------------------------------ *
     * Analisador incremental (processa arquivos grandes em lotes)
     * ------------------------------------------------------------------ */

    function criarAnalise(opcoes) {
        opcoes = opcoes || {};

        var est = {
            layout: opcoes.layout && opcoes.layout !== 'auto' ? opcoes.layout : null,
            layoutForcado: !!(opcoes.layout && opcoes.layout !== 'auto'),
            numeroLinha: 0,
            totalLinhas: 0,
            linhasVazias: 0,
            registros: [],
            marcacoes: [],
            empregados: [],
            empregadores: [],
            ajustes: [],
            eventos: [],
            desconhecidos: [],
            cabecalho: null,
            trailer: null,
            contagens: {},
            inconsistencias: [],
            pessoas: {},
            ultimoNSR: null,
            ultimoCarimbo: null,
            houveAjuste: false,
            chavesMarcacao: {}
        };

        function alerta(nivel, codigo, mensagem, linha, nsr, detalhe) {
            est.inconsistencias.push({
                nivel: nivel, codigo: codigo, mensagem: mensagem,
                linha: linha, nsr: nsr || '', detalhe: detalhe || ''
            });
        }

        function registrarPessoa(identificador, tipo, nome, nsr) {
            if (!identificador) { return null; }
            var chave = chavePessoa(identificador);
            var p = est.pessoas[chave];
            if (!p) {
                p = est.pessoas[chave] = {
                    chave: chave, identificador: identificador, tipoIdentificador: tipo || '',
                    nome: '', nsrNome: -1, marcacoes: 0, cadastrado: false,
                    primeira: '', ultima: ''
                };
            }
            if (nome && Number(nsr) >= p.nsrNome) { p.nome = nome; p.nsrNome = Number(nsr); }
            if (tipo && tipo !== 'DESCONHECIDO') { p.tipoIdentificador = tipo; }
            return p;
        }

        function processarLinha(bruta) {
            est.numeroLinha += 1;
            var n = est.numeroLinha;
            var linha = String(bruta).replace(/[\r\n]+$/, '');

            if (linha.replace(/\s+/g, '') === '') { est.linhasVazias += 1; return; }
            est.totalLinhas += 1;

            if (!est.layout) {
                var det = detectarLayout([linha]);
                if (det !== 'desconhecido') { est.layout = det; }
            }

            if (linha.length < 10) {
                alerta('erro', 'LINHA_CURTA', 'Linha com menos de 10 caracteres, fora de qualquer leiaute do AFD.', n, '', 'Tamanho: ' + linha.length);
                est.desconhecidos.push({ linha: linha, numeroLinha: n });
                return;
            }

            var tipo = linha.charAt(9);
            var pareceTrailer = ehSoDigitos(linha) && linha.charAt(linha.length - 1) === '9' &&
                (linha.length - 1) % 9 === 0 && linha.length !== 34;

            /* O trailer nao tem NSR: e formado por contagens de 9 digitos + "9" */
            if (!TIPOS[tipo] || pareceTrailer) {
                var tr = lerTrailer(linha);
                if (tr) {
                    tr.numeroLinha = n;
                    tr.tipoDescricao = TIPOS_ROTULO['9'];
                    if (est.trailer) { alerta('erro', 'TRAILER_DUPLICADO', 'Mais de um registro trailer (tipo 9) no arquivo.', n, ''); }
                    est.trailer = tr;
                    est.contagens['9'] = (est.contagens['9'] || 0) + 1;
                    est.registros.push(tr);
                    return;
                }
            }

            if (!TIPOS[tipo]) {
                alerta('erro', 'TIPO_DESCONHECIDO', 'Tipo de registro "' + tipo + '" não previsto no leiaute do AFD.', n, linha.slice(0, 9));
                est.desconhecidos.push({ linha: linha, numeroLinha: n });
                return;
            }

            if (!ehSoDigitos(linha.slice(0, 9))) {
                alerta('erro', 'NSR_INVALIDO', 'NSR com caracteres não numéricos.', n, linha.slice(0, 9));
            }

            var layout = est.layout || '1510';
            var r = layout === '671' ? lerRegistro671(linha) : lerRegistro1510(linha);
            r.numeroLinha = n;
            r.tipoDescricao = TIPOS_ROTULO[r.tipo] || r.tipo;
            est.registros.push(r);
            est.contagens[r.tipo] = (est.contagens[r.tipo] || 0) + 1;

            /* Tamanho da linha: so o leiaute 1.510 tem tamanho fixo por tipo */
            if (layout === '1510' && r.tamanhoEsperado && r.tamanho !== r.tamanhoEsperado) {
                alerta('erro', 'TAMANHO_INVALIDO',
                    'Registro tipo ' + r.tipo + ' com ' + r.tamanho + ' caracteres (esperado ' + r.tamanhoEsperado + ').',
                    n, r.nsr);
            }

            /* Sequencia do NSR */
            if (r.tipo !== '1') {
                if (est.ultimoNSR !== null && !isNaN(r.nsrNumero)) {
                    if (r.nsrNumero === est.ultimoNSR) {
                        alerta('erro', 'NSR_DUPLICADO', 'NSR ' + r.nsr + ' repetido.', n, r.nsr);
                    } else if (r.nsrNumero < est.ultimoNSR) {
                        alerta('erro', 'NSR_FORA_DE_ORDEM', 'NSR ' + r.nsr + ' menor que o do registro anterior (' + pad(est.ultimoNSR, 9) + ').', n, r.nsr);
                    } else if (r.nsrNumero > est.ultimoNSR + 1) {
                        alerta('alerta', 'NSR_LACUNA',
                            'Salto de NSR: do ' + pad(est.ultimoNSR, 9) + ' para o ' + r.nsr + ' (' + (r.nsrNumero - est.ultimoNSR - 1) + ' ausente(s)).',
                            n, r.nsr);
                    }
                }
                if (!isNaN(r.nsrNumero)) { est.ultimoNSR = r.nsrNumero; }
            }

            switch (r.tipo) {
            case '1':
                if (est.cabecalho) {
                    alerta('erro', 'CABECALHO_DUPLICADO', 'Mais de um registro de cabeçalho (tipo 1) no arquivo.', n, r.nsr);
                    break;
                }
                est.cabecalho = r;
                if (n !== 1) {
                    alerta('alerta', 'CABECALHO_FORA_DO_INICIO', 'O cabeçalho não é a primeira linha do arquivo.', n, r.nsr);
                }
                if (ehSoDigitos(r.nsr) && Number(r.nsr) !== 0) {
                    alerta('alerta', 'CABECALHO_NSR', 'O NSR do cabeçalho deveria ser 000000000.', n, r.nsr);
                }
                r.documentoEmpregadorValido = r.tipoDocumentoEmpregador === 'CPF'
                    ? validarCPF(r.identificadorEmpregador)
                    : validarCNPJ(r.identificadorEmpregador);
                if (!r.documentoEmpregadorValido) {
                    alerta('alerta', 'DOC_EMPREGADOR_INVALIDO',
                        'O ' + r.tipoDocumentoEmpregador + ' do empregador no cabeçalho não passou na validação do dígito verificador.',
                        n, r.nsr, r.identificadorEmpregador);
                }
                if (!r.numeroFabricacao) {
                    alerta('alerta', 'REP_SEM_NUMERO', 'Número de fabricação do REP em branco no cabeçalho.', n, r.nsr);
                }
                if (r.dataInicial && r.dataFinal && r.dataInicial > r.dataFinal) {
                    alerta('erro', 'PERIODO_INVERTIDO', 'Data inicial posterior à data final no cabeçalho.', n, r.nsr,
                        formatarDataBR(r.dataInicial) + ' > ' + formatarDataBR(r.dataFinal));
                }
                break;

            case '2':
                est.empregadores.push(r);
                break;

            case '4':
                est.ajustes.push(r);
                est.houveAjuste = true;
                break;

            case '5':
                est.empregados.push(r);
                var pe = registrarPessoa(r.identificador, r.tipoIdentificador, r.nome, r.nsrNumero);
                if (pe) { pe.cadastrado = true; }
                if (r.identificador && r.identificadorValido === false) {
                    alerta('alerta', 'DOC_EMPREGADO_INVALIDO',
                        (r.tipoIdentificador || 'Documento') + ' inválido no cadastro de empregado: ' + r.identificador,
                        n, r.nsr, r.nome);
                }
                if (!OPERACOES[r.operacao]) {
                    alerta('alerta', 'OPERACAO_INVALIDA', 'Operação "' + r.operacao + '" não prevista (esperado I, A ou E).', n, r.nsr);
                }
                break;

            case '6':
                est.eventos.push(r);
                break;

            case '3':
            case '7':
            case '8':
                if (r.tipo === '8') { est.eventos.push(r); }
                var m = {
                    numeroLinha: n,
                    nsr: r.nsr,
                    nsrNumero: r.nsrNumero,
                    tipo: r.tipo,
                    data: r.data || '',
                    hora: r.hora || '',
                    fuso: r.fuso || '',
                    identificador: r.identificador || '',
                    tipoIdentificador: r.tipoIdentificador || '',
                    identificadorValido: r.identificadorValido,
                    dataGravacao: r.dataGravacao || '',
                    horaGravacao: r.horaGravacao || '',
                    hash: r.hash || '',
                    crc: r.crc || '',
                    linha: linha
                };
                m.carimbo = carimbo(m.data, m.hora);
                m.chave = chavePessoa(m.identificador);
                est.marcacoes.push(m);

                var p = registrarPessoa(m.identificador, m.tipoIdentificador, '', -1);
                if (p) {
                    p.marcacoes += 1;
                    if (!p.primeira || m.carimbo < p.primeira) { p.primeira = m.carimbo; }
                    if (!p.ultima || m.carimbo > p.ultima) { p.ultima = m.carimbo; }
                }

                var dataConfiavel = r.dataValida !== false && !!m.data;
                if (!dataConfiavel) {
                    alerta('erro', 'DATA_INVALIDA', 'Data/hora inválida na marcação de ponto.', n, r.nsr, linha.slice(10, 40));
                }
                if (m.identificador && r.identificadorValido === false) {
                    alerta('alerta', 'DOC_MARCACAO_INVALIDO',
                        (m.tipoIdentificador || 'Documento') + ' com dígito verificador inválido na marcação: ' + m.identificador,
                        n, r.nsr);
                }
                var chaveDup = m.chave + '|' + m.carimbo;
                if (!dataConfiavel) {
                    /* sem data confiavel nao ha como julgar duplicidade nem cronologia */
                    break;
                }
                if (est.chavesMarcacao[chaveDup]) {
                    alerta('alerta', 'MARCACAO_DUPLICADA',
                        'Marcação repetida para o mesmo trabalhador no mesmo instante (' + formatarDataBR(m.data) + ' ' + (m.hora || '') + ').',
                        n, r.nsr);
                } else {
                    est.chavesMarcacao[chaveDup] = true;
                }
                if (m.carimbo && est.ultimoCarimbo && m.carimbo < est.ultimoCarimbo) {
                    if (est.houveAjuste) {
                        alerta('info', 'RETROCESSO_APOS_AJUSTE',
                            'Marcação anterior à precedente logo após um ajuste do relógio (registro tipo 4).', n, r.nsr,
                            est.ultimoCarimbo + ' -> ' + m.carimbo);
                    } else {
                        alerta('alerta', 'RETROCESSO_TEMPORAL',
                            'Marcação com data/hora anterior à do registro precedente, sem ajuste de relógio declarado.',
                            n, r.nsr, est.ultimoCarimbo + ' -> ' + m.carimbo);
                    }
                }
                if (m.carimbo) {
                    if (!est.ultimoCarimbo || m.carimbo > est.ultimoCarimbo) { est.ultimoCarimbo = m.carimbo; }
                    est.houveAjuste = false;
                }
                break;
            }
        }

        return {
            estado: est,

            processar: function (linhas) {
                for (var i = 0; i < linhas.length; i++) { processarLinha(linhas[i]); }
            },

            finalizar: function () {
                var i, c;

                if (!est.layout) { est.layout = 'desconhecido'; }
                if (!est.cabecalho) {
                    alerta('erro', 'CABECALHO_AUSENTE', 'Arquivo sem registro de cabeçalho (tipo 1).', 0, '');
                }
                if (!est.trailer) {
                    alerta('erro', 'TRAILER_AUSENTE', 'Arquivo sem registro trailer (tipo 9).', est.numeroLinha, '');
                }

                /* Confronto do trailer com o que foi realmente lido */
                if (est.trailer) {
                    Object.keys(est.trailer.contagens).forEach(function (t) {
                        var declarado = est.trailer.contagens[t];
                        var real = est.contagens[t] || 0;
                        if (declarado !== real) {
                            alerta('erro', 'TRAILER_DIVERGENTE',
                                'O trailer declara ' + declarado + ' registro(s) do tipo ' + t + ', mas o arquivo contém ' + real + '.',
                                est.trailer.numeroLinha, '');
                        }
                    });
                }

                /* Marcacoes fora do periodo declarado no cabecalho */
                var cab = est.cabecalho;
                if (cab && cab.dataInicial && cab.dataFinal) {
                    var fora = 0;
                    for (i = 0; i < est.marcacoes.length; i++) {
                        c = est.marcacoes[i];
                        if (c.data && (c.data < cab.dataInicial || c.data > cab.dataFinal)) { fora += 1; }
                    }
                    if (fora) {
                        alerta('alerta', 'FORA_DO_PERIODO',
                            fora + ' marcação(ões) fora do período declarado no cabeçalho (' +
                            formatarDataBR(cab.dataInicial) + ' a ' + formatarDataBR(cab.dataFinal) + ').',
                            cab.numeroLinha, cab.nsr);
                    }
                }

                /* Trabalhadores com marcacao e sem cadastro (tipo 5) */
                var semCadastro = [];
                Object.keys(est.pessoas).forEach(function (k) {
                    var p = est.pessoas[k];
                    if (p.marcacoes > 0 && !p.cadastrado) { semCadastro.push(p.identificador); }
                });
                if (semCadastro.length) {
                    alerta('info', 'SEM_CADASTRO',
                        semCadastro.length + ' trabalhador(es) com marcação e sem registro de cadastro (tipo 5) no arquivo.',
                        0, '', semCadastro.slice(0, 20).join(', '));
                }

                est.marcacoes.sort(function (a, b) {
                    if (a.carimbo === b.carimbo) { return a.nsrNumero - b.nsrNumero; }
                    return a.carimbo < b.carimbo ? -1 : 1;
                });

                var periodoReal = { inicio: '', fim: '' };
                for (i = 0; i < est.marcacoes.length; i++) {
                    c = est.marcacoes[i];
                    if (!c.data) { continue; }
                    if (!periodoReal.inicio || c.data < periodoReal.inicio) { periodoReal.inicio = c.data; }
                    if (!periodoReal.fim || c.data > periodoReal.fim) { periodoReal.fim = c.data; }
                }

                var niveis = { erro: 0, alerta: 0, info: 0 };
                est.inconsistencias.forEach(function (x) { niveis[x.nivel] = (niveis[x.nivel] || 0) + 1; });

                var pessoas = Object.keys(est.pessoas).map(function (k) { return est.pessoas[k]; });
                pessoas.sort(function (a, b) {
                    return (a.nome || '\uFFFF').localeCompare(b.nome || '\uFFFF', 'pt-BR');
                });

                return {
                    layout: est.layout,
                    layoutDescricao: est.layout === '671'
                        ? 'Portaria MTP 671/2021'
                        : (est.layout === '1510' ? 'Portaria MTE 1.510/2009' : 'Não identificado'),
                    cabecalho: est.cabecalho,
                    trailer: est.trailer,
                    registros: est.registros,
                    marcacoes: est.marcacoes,
                    empregados: est.empregados,
                    empregadores: est.empregadores,
                    ajustes: est.ajustes,
                    eventos: est.eventos,
                    desconhecidos: est.desconhecidos,
                    pessoas: pessoas,
                    inconsistencias: est.inconsistencias,
                    resumo: {
                        totalLinhas: est.totalLinhas,
                        linhasVazias: est.linhasVazias,
                        contagens: est.contagens,
                        totalMarcacoes: est.marcacoes.length,
                        totalPessoas: pessoas.length,
                        periodoDeclarado: cab ? { inicio: cab.dataInicial || '', fim: cab.dataFinal || '' } : { inicio: '', fim: '' },
                        periodoReal: periodoReal,
                        geracao: cab ? { data: cab.dataGeracao || '', hora: cab.horaGeracao || '' } : { data: '', hora: '' },
                        niveis: niveis
                    }
                };
            }
        };
    }

    /* ------------------------------------------------------------------ *
     * Analise em uma chamada
     * ------------------------------------------------------------------ */

    function separarLinhas(texto) {
        var t = String(texto).replace(/^\uFEFF/, '');
        var linhas = t.split(/\r\n|\n|\r/);
        if (linhas.length <= 2 && t.length > 400) {
            var reconstruido = dividirSemQuebras(t.replace(/\s+$/, ''));
            if (reconstruido && reconstruido.length > 1) { return reconstruido; }
        }
        return linhas;
    }

    function analisar(texto, opcoes) {
        var an = criarAnalise(opcoes);
        an.processar(separarLinhas(texto));
        return an.finalizar();
    }

    /* ------------------------------------------------------------------ *
     * Espelho de ponto (marcacoes agrupadas por trabalhador e dia)
     * ------------------------------------------------------------------ */

    function montarEspelho(marcacoes, pessoas) {
        var mapaNomes = {};
        (pessoas || []).forEach(function (p) { mapaNomes[p.chave] = p; });

        var grupos = {};
        marcacoes.forEach(function (m) {
            if (!m.data) { return; }
            var k = m.chave + '|' + m.data;
            if (!grupos[k]) {
                var p = mapaNomes[m.chave] || {};
                grupos[k] = {
                    chave: m.chave,
                    identificador: m.identificador,
                    tipoIdentificador: m.tipoIdentificador || p.tipoIdentificador || '',
                    nome: p.nome || '',
                    nomeExterno: !!p.nomeExterno,
                    data: m.data,
                    diaSemana: diaDaSemana(m.data),
                    entradas: [],
                    horarios: [],
                    nsrs: []
                };
            }
            grupos[k].entradas.push({ hora: m.hora || '', nsr: m.nsr, tipo: m.tipo });
        });

        var linhas = Object.keys(grupos).map(function (k) {
            var g = grupos[k];
            /* ordena mantendo o NSR colado no seu horario */
            g.entradas.sort(function (a, b) {
                if (a.hora === b.hora) { return a.nsr < b.nsr ? -1 : (a.nsr > b.nsr ? 1 : 0); }
                return a.hora < b.hora ? -1 : 1;
            });
            g.horarios = g.entradas.map(function (e) { return e.hora; });
            g.nsrs = g.entradas.map(function (e) { return e.nsr; });
            g.pares = [];
            g.totalMinutos = 0;
            for (var i = 0; i + 1 < g.horarios.length; i += 2) {
                var ent = minutosDoDia(g.horarios[i]);
                var sai = minutosDoDia(g.horarios[i + 1]);
                var dur = (ent === null || sai === null) ? 0 : Math.max(0, sai - ent);
                g.pares.push({ entrada: g.horarios[i], saida: g.horarios[i + 1], minutos: dur });
                g.totalMinutos += dur;
            }
            g.impar = g.horarios.length % 2 === 1;
            g.total = formatarMinutos(g.totalMinutos);
            g.quantidade = g.horarios.length;
            return g;
        });

        linhas.sort(function (a, b) {
            var na = a.nome || a.identificador || '';
            var nb = b.nome || b.identificador || '';
            if (na !== nb) { return na.localeCompare(nb, 'pt-BR'); }
            return a.data < b.data ? -1 : (a.data > b.data ? 1 : 0);
        });
        return linhas;
    }

    /*
     * Saldo de horas: compara o trabalhado no dia com a jornada esperada e
     * acumula por semana, por mes e por trabalhador.
     *
     * Conta apenas os dias que tem marcacao no arquivo: o AFD nao diz quem
     * faltou, quem estava de folga, de ferias ou de atestado.
     *
     * opcoes.jornadaMinutos   jornada diaria esperada (padrao 480 = 08:00)
     * opcoes.apenasDiasUteis  sabado e domingo passam a contar como saldo
     *                         integral (jornada esperada zero)
     */
    /*
     * Escalas prontas, em minutos por dia da semana (indice 0 = domingo).
     * O limite constitucional e de 8h por dia e 44h por semana; as duas
     * primeiras sao as formas usuais de fechar as 44h.
     */
    var ESCALAS = {
        'sem44_8h48': { rotulo: '44h por semana — 8h48 de segunda a sexta', dias: [0, 528, 528, 528, 528, 528, 0] },
        'sem44_sab': { rotulo: '44h por semana — 8h de segunda a sexta e 4h no sábado', dias: [0, 480, 480, 480, 480, 480, 240] },
        'sem40': { rotulo: '40h por semana — 8h de segunda a sexta', dias: [0, 480, 480, 480, 480, 480, 0] },
        'sem36': { rotulo: '36h por semana — 7h12 de segunda a sexta', dias: [0, 432, 432, 432, 432, 432, 0] },
        'sem30': { rotulo: '30h por semana — 6h de segunda a sexta', dias: [0, 360, 360, 360, 360, 360, 0] }
    };

    function somaDaEscala(dias) {
        return (dias || []).reduce(function (t, m) { return t + (Number(m) || 0); }, 0);
    }

    function calcularSaldos(espelho, opcoes) {
        opcoes = opcoes || {};
        var jornada = opcoes.jornadaMinutos == null ? 480 : Number(opcoes.jornadaMinutos);
        var soUteis = !!opcoes.apenasDiasUteis;
        var escala = null;
        if (opcoes.escala && opcoes.escala.length === 7) {
            escala = opcoes.escala.map(function (m) { return Number(m) || 0; });
        } else if (opcoes.escala && ESCALAS[opcoes.escala]) {
            escala = ESCALAS[opcoes.escala].dias;
        }

        var pessoas = {};
        var semanas = {};
        var meses = {};
        var total = { dias: 0, minutos: 0, esperado: 0, saldo: 0 };

        function acumular(alvo, dia) {
            alvo.dias += 1;
            alvo.minutos += dia.totalMinutos;
            alvo.esperado += dia.jornadaEsperada;
            alvo.saldo += dia.saldo;
        }

        function balde(mapa, chave, extra) {
            if (!mapa[chave]) {
                mapa[chave] = { chave: chave, dias: 0, minutos: 0, esperado: 0, saldo: 0 };
                if (extra) { Object.keys(extra).forEach(function (k) { mapa[chave][k] = extra[k]; }); }
            }
            return mapa[chave];
        }

        espelho.forEach(function (dia) {
            if (escala) {
                var d = dataParaUTC(dia.data);
                dia.jornadaEsperada = d ? escala[d.getUTCDay()] : jornada;
            } else {
                dia.jornadaEsperada = (soUteis && ehFimDeSemana(dia.data)) ? 0 : jornada;
            }
            dia.saldo = dia.totalMinutos - dia.jornadaEsperada;
            dia.chaveSemana = inicioDaSemana(dia.data);
            dia.chaveMes = String(dia.data).slice(0, 7);

            var p = pessoas[dia.chave];
            if (!p) {
                p = pessoas[dia.chave] = {
                    chave: dia.chave, dias: 0, minutos: 0, esperado: 0, saldo: 0,
                    semanas: {}, meses: {}
                };
            }
            acumular(p, dia);
            acumular(balde(p.semanas, dia.chaveSemana, { inicio: dia.chaveSemana, fim: fimDaSemana(dia.data) }), dia);
            acumular(balde(p.meses, dia.chaveMes, { rotulo: nomeDoMes(dia.data) }), dia);
            acumular(balde(semanas, dia.chaveSemana, { inicio: dia.chaveSemana, fim: fimDaSemana(dia.data) }), dia);
            acumular(balde(meses, dia.chaveMes, { rotulo: nomeDoMes(dia.data) }), dia);
            acumular(total, dia);
        });

        return { pessoas: pessoas, semanas: semanas, meses: meses, total: total };
    }

    /*
     * Lista de nomes: casa documento com nome para o AFD que nao traz
     * cadastro de empregado (registro tipo 5).
     *
     * Aceita o export de usuarios do REP (pis;nome;administrador;...) e
     * qualquer arquivo com duas colunas, documento e nome, separadas por
     * ponto e virgula, virgula ou tabulacao.
     */
    function lerListaDeNomes(texto) {
        var linhas = String(texto == null ? '' : texto).replace(/^\uFEFF/, '').split(/\r\n|\n|\r/);
        var nomes = {};
        var total = 0;
        var ignorados = 0;
        var repetidos = 0;

        var primeira = '';
        for (var i = 0; i < linhas.length; i++) {
            if (linhas[i] && linhas[i].trim()) { primeira = linhas[i]; break; }
        }
        if (!primeira) { return { nomes: nomes, total: 0, ignorados: 0, repetidos: 0, separador: '' }; }

        var separadores = [';', '\t', ','];
        var separador = separadores[0];
        var maior = -1;
        separadores.forEach(function (sep) {
            var qtd = primeira.split(sep).length;
            if (qtd > maior) { maior = qtd; separador = sep; }
        });
        if (maior < 2) { return { nomes: nomes, total: 0, ignorados: 0, repetidos: 0, separador: '' }; }

        var colDoc = 0;
        var colNome = 1;
        var cabecalho = primeira.split(separador).map(function (c) {
            return c.replace(/"/g, '').trim().toLowerCase();
        });
        var temCabecalho = cabecalho.some(function (c) {
            return c === 'pis' || c === 'cpf' || c === 'nome' || c === 'documento' || c === 'pis/cpf';
        }) && !/\d{8}/.test(primeira);

        if (temCabecalho) {
            var achaDoc = ['pis', 'cpf', 'documento', 'doc', 'pis/cpf'];
            cabecalho.forEach(function (c, idx) {
                if (achaDoc.indexOf(c) >= 0 && colDoc === 0) { colDoc = idx; }
                if (c.indexOf('nome') >= 0 && colNome === 1) { colNome = idx; }
            });
            var idxDoc = -1;
            cabecalho.forEach(function (c, idx) { if (achaDoc.indexOf(c) >= 0 && idxDoc < 0) { idxDoc = idx; } });
            if (idxDoc >= 0) { colDoc = idxDoc; }
        }

        linhas.forEach(function (linha, indice) {
            if (!linha || !linha.trim()) { return; }
            if (temCabecalho && linha === primeira) { return; }
            if (!temCabecalho && indice === 0 && /nome/i.test(linha) && !/\d{8}/.test(linha)) { return; }

            var partes = linha.split(separador);
            var doc = apenasDigitos(partes[colDoc] || '');
            var nome = limpar((partes[colNome] || '').replace(/"/g, ''));

            /* CPF que perdeu o zero a esquerda no export */
            if (doc.length === 10) { doc = '0' + doc; }

            if (doc.length < 11 || !nome) { ignorados += 1; return; }

            var chave = chavePessoa(doc);
            if (nomes[chave]) { repetidos += 1; return; }
            nomes[chave] = nome;
            total += 1;
        });

        return { nomes: nomes, total: total, ignorados: ignorados, repetidos: repetidos, separador: separador };
    }

    /* Normaliza { documento: nome } para a chave usada na comparacao */
    function normalizarListaDeNomes(objeto) {
        var nomes = {};
        var total = 0;
        Object.keys(objeto || {}).forEach(function (doc) {
            var nome = limpar(objeto[doc]);
            if (!nome) { return; }
            var digitos = apenasDigitos(doc);
            if (digitos.length === 10) { digitos = '0' + digitos; }
            var chave = chavePessoa(digitos || doc);
            if (nomes[chave]) { return; }
            nomes[chave] = nome;
            total += 1;
        });
        return { nomes: nomes, total: total };
    }

    /* ------------------------------------------------------------------ *
     * API publica
     * ------------------------------------------------------------------ */

    return {
        TIPOS: TIPOS,
        TIPOS_ROTULO: TIPOS_ROTULO,
        TAMANHOS_1510: TAMANHOS_1510,
        OPERACOES: OPERACOES,
        analisar: analisar,
        criarAnalise: criarAnalise,
        separarLinhas: separarLinhas,
        detectarLayout: detectarLayout,
        montarEspelho: montarEspelho,
        calcularSaldos: calcularSaldos,
        ESCALAS: ESCALAS,
        somaDaEscala: somaDaEscala,
        lerListaDeNomes: lerListaDeNomes,
        normalizarListaDeNomes: normalizarListaDeNomes,
        validarCPF: validarCPF,
        validarPIS: validarPIS,
        validarCNPJ: validarCNPJ,
        formatarCPF: formatarCPF,
        formatarPIS: formatarPIS,
        formatarCNPJ: formatarCNPJ,
        formatarDocumento: formatarDocumento,
        formatarDataBR: formatarDataBR,
        formatarMinutos: formatarMinutos,
        formatarSaldo: formatarSaldo,
        inicioDaSemana: inicioDaSemana,
        fimDaSemana: fimDaSemana,
        nomeDoMes: nomeDoMes,
        ehFimDeSemana: ehFimDeSemana,
        minutosDoDia: minutosDoDia,
        diaDaSemana: diaDaSemana,
        mascarar: mascarar,
        chavePessoa: chavePessoa,
        lerDataHoraISO: lerDataHoraISO,
        lerIdentificador: lerIdentificador
    };
}));
