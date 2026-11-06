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

    /* Um colator so: String.localeCompare monta um a cada chamada, o que pesa
       nas ordenacoes de dezenas de milhares de linhas. */
    var COLATOR = (typeof Intl !== 'undefined' && Intl.Collator)
        ? new Intl.Collator('pt-BR')
        : { compare: function (a, b) { return a < b ? -1 : (a > b ? 1 : 0); } };

    function compararTexto(a, b) {
        return COLATOR.compare(a, b);
    }

    /*
     * Mapa sem prototipo. As chaves abaixo (PIS, CPF, datas, codigos) vem do
     * arquivo enviado; num objeto comum, uma chave como "constructor" ou
     * "toString" ja responderia como se existisse e a leitura quebraria.
     */
    function mapaVazio() {
        return Object.create ? Object.create(null) : {};
    }

    function apenasDigitos(v) {
        return String(v == null ? '' : v).replace(/\D+/g, '');
    }

    function limpar(v) {
        return String(v == null ? '' : v).replace(/\s+$/, '').replace(/^\s+/, '');
    }

    var RE_SO_DIGITOS = /^[0-9]+$/;
    var RE_SO_ESPACO = /^\s*$/;
    var RE_NSR = /^[0-9]{9}/;

    function ehSoDigitos(v) {
        return RE_SO_DIGITOS.test(String(v == null ? '' : v));
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

    var DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    var MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

    function formatarSaldo(total) {
        var t = Math.round(total || 0);
        if (t === 0) { return '00:00'; }
        return (t > 0 ? '+' : '-') + formatarMinutos(Math.abs(t));
    }

    function diaDaSemana(iso) {
        return infoData(iso).diaSemana;
    }

    /* AAAA-MM-DD que existe no calendario (31/02 nao existe) */
    function dataIsoValida(iso) {
        var d = dataParaUTC(iso);
        return !!d && d.toISOString().slice(0, 10) === iso;
    }

    /* HH:MM[:SS] entre 00:00 e 23:59 */
    function horaValidaTexto(hora) {
        return /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(String(hora || ''));
    }

    function dataParaUTC(iso) {
        var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
        if (!m) { return null; }
        return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
    }

    /*
     * Cada data do periodo se repete uma vez por trabalhador, entao o dia da
     * semana, a semana e o mes sao calculados uma vez e reaproveitados.
     */
    var CACHE_DATA = mapaVazio();

    /* Data ilegivel nao entra no cache: um arquivo corrompido traria milhares
       de textos diferentes e todos cabem nesta mesma resposta. */
    var DATA_INVALIDA = {
        valida: false, dow: -1, diaSemana: '',
        semana: '', fimSemana: '', mes: '', rotuloMes: ''
    };
    if (Object.freeze) { Object.freeze(DATA_INVALIDA); }

    function infoData(iso) {
        var pronta = CACHE_DATA[iso];
        if (pronta) { return pronta; }
        var d = dataParaUTC(iso);
        if (!d) {
            return DATA_INVALIDA;
        } else {
            var dow = d.getUTCDay();
            var seg = new Date(d.getTime());
            seg.setUTCDate(seg.getUTCDate() - (dow === 0 ? 6 : dow - 1));
            var dom = new Date(seg.getTime());
            dom.setUTCDate(dom.getUTCDate() + 6);
            pronta = {
                valida: true,
                dow: dow,
                diaSemana: DIAS_SEMANA[dow],
                semana: seg.toISOString().slice(0, 10),
                fimSemana: dom.toISOString().slice(0, 10),
                mes: iso.slice(0, 7),
                rotuloMes: MESES[d.getUTCMonth()] + '/' + d.getUTCFullYear()
            };
        }
        CACHE_DATA[iso] = pronta;
        return pronta;
    }

    function ehFimDeSemana(iso) {
        var dow = infoData(iso).dow;
        return dow === 0 || dow === 6;
    }

    /* Segunda-feira da semana da data, usada como chave e rotulo do periodo */
    function inicioDaSemana(iso) {
        return infoData(iso).semana;
    }

    function fimDaSemana(iso) {
        return infoData(iso).fimSemana;
    }

    /* Aceita tanto a data inteira quanto so o mes ("2026-08"). */
    function nomeDoMes(iso) {
        var t = String(iso || '');
        return infoData(t.length === 7 ? t + '-01' : t).rotuloMes;
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

    /*
     * comCampos monta a lista de campos com as posicoes, usada pelo inspetor
     * de registro. Na leitura de um arquivo inteiro ela fica de fora: seriam
     * uma dezena de objetos por linha, so para quase nunca serem abertos.
     */
    function lerRegistro1510(linha, comCampos) {
        var r = {
            nsr: linha.slice(0, 9),
            nsrNumero: Number(linha.slice(0, 9)),
            tipo: linha.charAt(9),
            tamanho: linha.length,
            linha: linha
        };
        var d, h, d2, h2;
        if (comCampos) { r.campos = []; }

        function campo(nome, valor, ini, tam) {
            if (!comCampos) { return; }
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

    function lerRegistro671(linha, comCampos) {
        var r = {
            nsr: linha.slice(0, 9),
            nsrNumero: Number(linha.slice(0, 9)),
            tipo: linha.charAt(9),
            tamanho: linha.length,
            linha: linha
        };
        var resto = linha.slice(10);
        var pos = 0, dh, id, dt, cauda, mh;
        if (comCampos) { r.campos = []; }

        function campo(nome, valor, iniResto, tam) {
            if (!comCampos) { return; }
            r.campos.push({ nome: nome, valor: valor, inicio: 11 + iniResto, fim: 11 + iniResto + Math.max(tam, 1) - 1 });
        }

        if (comCampos) {
            r.campos.push({ nome: 'NSR', valor: r.nsr, inicio: 1, fim: 9 });
            r.campos.push({ nome: 'Tipo do registro', valor: r.tipo, inicio: 10, fim: 10 });
        }

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
            contagens: mapaVazio(),
            inconsistencias: [],
            contagemPorCodigo: mapaVazio(),
            contagemPorNivel: mapaVazio(),
            inconsistenciasOmitidas: 0,
            limiteInconsistencias: opcoes.limiteInconsistencias || 5000,
            pessoas: mapaVazio(),
            ultimoNSR: null,
            ultimoCarimbo: null,
            houveAjuste: false,
            chavesMarcacao: mapaVazio()
        };

        /*
         * Arquivo muito quebrado pode gerar uma ocorrencia por linha. A lista
         * para no teto, mas a contagem por codigo continua inteira, para o
         * resumo nao mentir.
         */
        function alerta(nivel, codigo, mensagem, linha, nsr, detalhe) {
            est.contagemPorCodigo[codigo] = (est.contagemPorCodigo[codigo] || 0) + 1;
            est.contagemPorNivel[nivel] = (est.contagemPorNivel[nivel] || 0) + 1;
            if (est.inconsistencias.length >= est.limiteInconsistencias) {
                est.inconsistenciasOmitidas += 1;
                return;
            }
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

            if (linha === '' || RE_SO_ESPACO.test(linha)) { est.linhasVazias += 1; return; }
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
            /* O formato do trailer (contagens de 9 digitos + "9") so e testado
               quando a linha tem a cara dele: um regex de linha inteira em todas
               as linhas custa caro em arquivo grande. */
            var pareceTrailer = linha.charAt(linha.length - 1) === '9' &&
                (linha.length - 1) % 9 === 0 && linha.length !== 34 && ehSoDigitos(linha);

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

            if (!RE_NSR.test(linha)) {
                alerta('erro', 'NSR_INVALIDO', 'NSR com caracteres não numéricos.', n, linha.slice(0, 9));
            }

            var layout = est.layout || '1510';
            var r = layout === '671' ? lerRegistro671(linha, false) : lerRegistro1510(linha, false);
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
                /* data/hora impossivel (31/02, 25:00) deixa o dia "para conferir" no espelho */
                m.valida = dataConfiavel && dataIsoValida(m.data) && horaValidaTexto(m.hora);
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

                var niveis = {
                    erro: est.contagemPorNivel.erro || 0,
                    alerta: est.contagemPorNivel.alerta || 0,
                    info: est.contagemPorNivel.info || 0
                };
                if (est.inconsistenciasOmitidas) {
                    est.inconsistencias.push({
                        nivel: 'info', codigo: 'LISTA_TRUNCADA',
                        mensagem: 'A lista para nas primeiras ' + est.limiteInconsistencias +
                            ' ocorrências; outras ' + est.inconsistenciasOmitidas +
                            ' foram contadas mas não listadas.',
                        linha: 0, nsr: '', detalhe: ''
                    });
                }

                var pessoas = Object.keys(est.pessoas).map(function (k) { return est.pessoas[k]; });
                pessoas.sort(function (a, b) {
                    return compararTexto(a.nome || '\uFFFF', b.nome || '\uFFFF');
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

    /*
     * opcoes.datasAjuste  { 'AAAA-MM-DD': true } dias com ajuste do relogio
     *                     (registro tipo 4): o pareamento pode estar trocado.
     *
     * Cada dia recebe "pendencias": motivos que impedem fechar o saldo sem
     * alguem conferir (marcacao impar, repetida, invalida, ajuste do relogio).
     * Nenhuma batida e apagada nem inventada.
     */
    /*
     * SHA-256 dos bytes do arquivo, para o rodape do relatorio: identifica o
     * AFD exato que gerou os numeros. Recebe Uint8Array (ou texto, em UTF-8).
     */
    var K256 = [
        0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
        0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
        0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
        0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
        0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
        0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
        0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
        0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
    ];

    function bytesUtf8(texto) {
        var s = unescape(encodeURIComponent(String(texto)));
        var b = new Uint8Array(s.length);
        for (var i = 0; i < s.length; i++) { b[i] = s.charCodeAt(i); }
        return b;
    }

    function sha256(entrada) {
        var dados = typeof entrada === 'string' ? bytesUtf8(entrada) : new Uint8Array(entrada);
        var n = dados.length;
        var total = ((n + 9 + 63) >> 6) << 6;
        var msg = new Uint8Array(total);
        msg.set(dados);
        msg[n] = 0x80;
        var bits = n * 8;
        msg[total - 4] = (bits >>> 24) & 0xff;
        msg[total - 3] = (bits >>> 16) & 0xff;
        msg[total - 2] = (bits >>> 8) & 0xff;
        msg[total - 1] = bits & 0xff;
        msg[total - 5] = Math.floor(n / 0x20000000) & 0xff;
        var h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
        var w = new Array(64);
        function rotr(x, k) { return (x >>> k) | (x << (32 - k)); }
        for (var off = 0; off < total; off += 64) {
            for (var t = 0; t < 16; t++) {
                var j = off + t * 4;
                w[t] = ((msg[j] << 24) | (msg[j + 1] << 16) | (msg[j + 2] << 8) | msg[j + 3]) | 0;
            }
            for (t = 16; t < 64; t++) {
                var s0 = rotr(w[t - 15], 7) ^ rotr(w[t - 15], 18) ^ (w[t - 15] >>> 3);
                var s1 = rotr(w[t - 2], 17) ^ rotr(w[t - 2], 19) ^ (w[t - 2] >>> 10);
                w[t] = (w[t - 16] + s0 + w[t - 7] + s1) | 0;
            }
            var a = h[0], b = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], hh = h[7];
            for (t = 0; t < 64; t++) {
                var S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
                var ch = (e & f) ^ (~e & g);
                var t1 = (hh + S1 + ch + K256[t] + w[t]) | 0;
                var S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
                var maj = (a & b) ^ (a & c) ^ (b & c);
                var t2 = (S0 + maj) | 0;
                hh = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
            }
            h[0] = (h[0] + a) | 0; h[1] = (h[1] + b) | 0; h[2] = (h[2] + c) | 0; h[3] = (h[3] + d) | 0;
            h[4] = (h[4] + e) | 0; h[5] = (h[5] + f) | 0; h[6] = (h[6] + g) | 0; h[7] = (h[7] + hh) | 0;
        }
        return h.map(function (x) { return ('0000000' + (x >>> 0).toString(16)).slice(-8); }).join('');
    }

    /*
     * Celula de planilha (CSV ou copia): texto que comeca com = + - @ tabulacao
     * ou retorno vira formula no Excel. Ganha um apostrofo na frente. Numeros e
     * horas com sinal (-00:52, +01:30, 12, 3,5) ficam como estao.
     */
    function celulaPlanilha(valor) {
        var s = String(valor == null ? '' : valor);
        if (!/^[=+\-@\t\r]/.test(s)) { return s; }
        if (/^[+-]?\d{1,4}:\d{2}$/.test(s) || /^[+-]?\d+([.,]\d+)?$/.test(s)) { return s; }
        return "'" + s;
    }

    /* versao das regras de calculo; sobe sempre que uma regra de saldo mudar */
    var VERSAO = '2.0.0';

    /* batida ate 5 minutos depois da anterior e tratada como repetida suspeita */
    var LIMITE_REPETIDA = 5;

    function montarEspelho(marcacoes, pessoas, opcoes) {
        var datasAjuste = (opcoes && opcoes.datasAjuste) || {};
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
                    diaSemana: infoData(m.data).diaSemana,
                    entradas: [],
                    horarios: [],
                    nsrs: []
                };
            }
            grupos[k].entradas.push({ hora: m.hora || '', nsr: m.nsr, tipo: m.tipo, valida: m.valida !== false });
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

            g.pendencias = [];
            if (g.impar) { g.pendencias.push('MARCAÇÃO ÍMPAR'); }
            for (var j = 1; j < g.horarios.length; j++) {
                var anterior = minutosDoDia(g.horarios[j - 1]);
                var atual = minutosDoDia(g.horarios[j]);
                if (anterior !== null && atual !== null && atual - anterior <= LIMITE_REPETIDA) {
                    g.pendencias.push('MARCAÇÃO REPETIDA (' + g.horarios[j - 1].slice(0, 5) + ' e ' + g.horarios[j].slice(0, 5) + ')');
                }
            }
            if (g.entradas.some(function (e) { return !e.valida; }) || !dataIsoValida(g.data)) {
                g.pendencias.push('DATA OU HORA INVÁLIDA');
            }
            if (datasAjuste[g.data]) { g.pendencias.push('AJUSTE DO RELÓGIO NESTE DIA'); }
            return g;
        });

        linhas.sort(function (a, b) {
            var na = a.nome || a.identificador || '';
            var nb = b.nome || b.identificador || '';
            if (na !== nb) { return compararTexto(na, nb); }
            return a.data < b.data ? -1 : (a.data > b.data ? 1 : 0);
        });
        return linhas;
    }

    /*
     * Classifica cada dia do periodo e cria as linhas que o AFD nao tem.
     * O arquivo so registra quem bateu, entao o dia vazio nao existe nele.
     *
     * Com a escala em maos, cada dia vira um destes casos:
     *   normal  dia com jornada prevista e marcacao
     *   falta   dia com jornada prevista e nenhuma marcacao   -> desconta
     *   folga   dia sem jornada prevista e nenhuma marcacao   -> etiqueta do dia
     *   extra   dia sem jornada prevista, mas com marcacao    -> tudo vira saldo
     *
     * opcoes.escala          minutos por dia da semana (indice 0 = domingo)
     * opcoes.inicio/fim      periodo a varrer (AAAA-MM-DD)
     * opcoes.todoPeriodo     true varre o periodo inteiro; false (padrao) so
     *                        da primeira a ultima marcacao de cada pessoa,
     *                        para nao acusar falta antes da admissao
     * opcoes.limiteDias      teto de dias varridos por pessoa (padrao 400)
     */
    function completarDias(espelho, opcoes) {
        opcoes = opcoes || {};
        var escala = opcoes.escala && opcoes.escala.length === 7 ? opcoes.escala : null;
        if (!escala || !somaDaEscala(escala)) { return espelho.slice(); }

        var comCalendario = !!opcoes.calendario;
        function calendario(iso) { return comCalendario ? diaDoCalendario(iso, opcoes.feriadosLocais) : null; }

        function classificar(dia) {
            var info = infoData(dia.data);
            var cal = calendario(dia.data);
            var feriado = !!cal && cal.tipo === 'feriado';
            var prevista = info.valida && !feriado ? escala[info.dow] : 0;
            var nomeDia = feriado ? 'FERIADO' : info.diaSemana.toUpperCase();
            if (comCalendario) { dia.calendario = cal; }
            if (prevista > 0) {
                dia.tipo = 'normal';
                dia.etiqueta = '';
            } else {
                dia.tipo = 'extra';
                dia.etiqueta = 'HORA EXTRA ' + nomeDia;
            }
            return dia;
        }

        var limite = opcoes.limiteDias || 400;
        var pessoas = mapaVazio();
        var ordem = [];

        espelho.forEach(function (dia) {
            classificar(dia);
            if (!pessoas[dia.chave]) {
                pessoas[dia.chave] = { modelo: dia, datas: mapaVazio(), primeira: dia.data, ultima: dia.data };
                ordem.push(dia.chave);
            }
            var p = pessoas[dia.chave];
            p.datas[dia.data] = true;
            if (dia.data < p.primeira) { p.primeira = dia.data; }
            if (dia.data > p.ultima) { p.ultima = dia.data; }
        });

        var saida = espelho.slice();

        ordem.forEach(function (chave) {
            var p = pessoas[chave];
            var inicio = opcoes.todoPeriodo && opcoes.inicio ? opcoes.inicio : p.primeira;
            var fim = opcoes.todoPeriodo && opcoes.fim ? opcoes.fim : p.ultima;
            if (opcoes.inicio && inicio < opcoes.inicio) { inicio = opcoes.inicio; }
            if (opcoes.fim && fim > opcoes.fim) { fim = opcoes.fim; }

            var d = dataParaUTC(inicio);
            var limiteData = dataParaUTC(fim);
            if (!d || !limiteData) { return; }

            var contador = 0;
            while (d <= limiteData && contador < limite) {
                contador += 1;
                var iso = d.toISOString().slice(0, 10);
                if (!p.datas[iso]) {
                    var dow = d.getUTCDay();
                    var cal = calendario(iso);
                    var feriado = !!cal && cal.tipo === 'feriado';
                    var prevista = feriado ? 0 : escala[dow];
                    var nomeDia = feriado ? 'FERIADO' : DIAS_SEMANA[dow].toUpperCase();
                    var novo = {
                        chave: chave,
                        identificador: p.modelo.identificador,
                        tipoIdentificador: p.modelo.tipoIdentificador,
                        nome: p.modelo.nome,
                        nomeExterno: p.modelo.nomeExterno,
                        data: iso,
                        diaSemana: diaDaSemana(iso),
                        entradas: [],
                        horarios: [],
                        nsrs: [],
                        pares: [],
                        quantidade: 0,
                        totalMinutos: 0,
                        total: '00:00',
                        impar: false,
                        tipo: prevista > 0 ? 'falta' : 'folga',
                        falta: prevista > 0,
                        etiqueta: prevista > 0 ? 'FALTA' : nomeDia,
                        pendencias: []
                    };
                    if (comCalendario) { novo.calendario = cal; }
                    saida.push(novo);
                }
                d.setUTCDate(d.getUTCDate() + 1);
            }
        });

        saida.sort(function (a, b) {
            var na = a.nome || a.identificador || '';
            var nb = b.nome || b.identificador || '';
            if (na !== nb) { return compararTexto(na, nb); }
            return a.data < b.data ? -1 : (a.data > b.data ? 1 : 0);
        });
        return saida;
    }

    /*
     * Calendario: feriados nacionais (jornada prevista zero) e pontos
     * facultativos (dia normal de trabalho na Fortman, so marcado na tela).
     * Datas moveis pela Pascoa; feriados estaduais/municipais entram por
     * opcoes.feriadosLocais = { 'AAAA-MM-DD' ou 'MM-DD': 'Nome' }.
     */
    var FERIADOS_FIXOS = {
        '01-01': 'Confraternização Universal',
        '04-21': 'Tiradentes',
        '05-01': 'Dia do Trabalho',
        '09-07': 'Independência do Brasil',
        '10-12': 'Nossa Senhora Aparecida',
        '11-02': 'Finados',
        '11-15': 'Proclamação da República',
        '11-20': 'Dia Nacional de Zumbi e da Consciência Negra',
        '12-25': 'Natal'
    };
    var FACULTATIVOS_FIXOS = {
        '10-28': 'Dia do Servidor Público',
        '12-24': 'Véspera de Natal',
        '12-31': 'Véspera de Ano Novo'
    };
    /* dias contados a partir do Domingo de Pascoa */
    var MOVEIS = [
        [-48, 'facultativo', 'Carnaval'],
        [-47, 'facultativo', 'Carnaval'],
        [-46, 'facultativo', 'Quarta-feira de Cinzas'],
        [-2, 'feriado', 'Paixão de Cristo'],
        [60, 'facultativo', 'Corpus Christi']
    ];
    var CACHE_CALENDARIO = mapaVazio();

    /* Domingo de Pascoa (algoritmo de Meeus/Jones/Butcher, calendario gregoriano). */
    function pascoa(ano) {
        var a = ano % 19, b = Math.floor(ano / 100), c = ano % 100;
        var d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
        var g = Math.floor((b - f + 1) / 3);
        var h = (19 * a + b - d - g + 15) % 30;
        var i = Math.floor(c / 4), k = c % 4;
        var l = (32 + 2 * e + 2 * i - h - k) % 7;
        var m = Math.floor((a + 11 * h + 22 * l) / 451);
        var mes = Math.floor((h + l - 7 * m + 114) / 31);
        var dia = ((h + l - 7 * m + 114) % 31) + 1;
        return pad(ano, 4) + '-' + pad(mes, 2) + '-' + pad(dia, 2);
    }

    function calendarioDoAno(ano) {
        if (CACHE_CALENDARIO[ano]) { return CACHE_CALENDARIO[ano]; }
        var lista = mapaVazio();
        Object.keys(FACULTATIVOS_FIXOS).forEach(function (md) {
            lista[ano + '-' + md] = { tipo: 'facultativo', nome: FACULTATIVOS_FIXOS[md] };
        });
        Object.keys(FERIADOS_FIXOS).forEach(function (md) {
            lista[ano + '-' + md] = { tipo: 'feriado', nome: FERIADOS_FIXOS[md] };
        });
        var base = dataParaUTC(pascoa(ano)).getTime();
        MOVEIS.forEach(function (mv) {
            var iso = new Date(base + mv[0] * 86400000).toISOString().slice(0, 10);
            if (!lista[iso] || lista[iso].tipo !== 'feriado') { lista[iso] = { tipo: mv[1], nome: mv[2] }; }
        });
        CACHE_CALENDARIO[ano] = lista;
        return lista;
    }

    /* { tipo: 'feriado' | 'facultativo', nome } ou null */
    function diaDoCalendario(iso, locais) {
        if (!dataIsoValida(iso)) { return null; }
        if (locais) {
            var local = locais[iso] || locais[iso.slice(5)];
            if (local) { return { tipo: 'feriado', nome: String(local) }; }
        }
        return calendarioDoAno(Number(iso.slice(0, 4)))[iso] || null;
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
        'sem44_9h_sex8h': {
            rotulo: '44h por semana — 06:55 às 16:55, sexta até 15:55 (1h de almoço)',
            dias: [0, 540, 540, 540, 540, 480, 0],
            /* horarios previstos de cada batida, base da HORA FECHADA (tolerancia por marcacao) */
            horarios: [null,
                ['06:55', '11:55', '12:55', '16:55'], ['06:55', '11:55', '12:55', '16:55'],
                ['06:55', '11:55', '12:55', '16:55'], ['06:55', '11:55', '12:55', '16:55'],
                ['06:55', '11:55', '12:55', '15:55'], null]
        },
        'sem44_8h48': { rotulo: '44h por semana — 8h48 de segunda a sexta', dias: [0, 528, 528, 528, 528, 528, 0] },
        'sem44_sab': { rotulo: '44h por semana — 8h de segunda a sexta e 4h no sábado', dias: [0, 480, 480, 480, 480, 480, 240] },
        'sem40': { rotulo: '40h por semana — 8h de segunda a sexta', dias: [0, 480, 480, 480, 480, 480, 0] },
        'sem36': { rotulo: '36h por semana — 7h12 de segunda a sexta', dias: [0, 432, 432, 432, 432, 432, 0] },
        'sem30': { rotulo: '30h por semana — 6h de segunda a sexta', dias: [0, 360, 360, 360, 360, 360, 0] }
    };

    /* CLT art. 58, par. 1: ate 5 minutos por marcacao, no maximo 10 minutos no dia */
    var TOLERANCIA_PADRAO = { porMarcacao: 5, porDia: 10 };

    /*
     * HORA FECHADA (saldo depois da tolerancia legal), ao lado do saldo bruto
     * (HORAS PRATICAS, campo saldo, que nao muda):
     *  - dia PARA CONFERIR: null (fora da soma);
     *  - dia sem jornada prevista (fim de semana, feriado) ou falta: igual ao bruto;
     *  - escala sem horarios previstos: null, fechadaIndisponivel = true;
     *  - dia util com as batidas da jornada: se toda batida variou ate 5 min do
     *    horario previsto e a soma das variacoes e de ate 10 min, zero; senao, o
     *    bruto inteiro (Sumula 366 do TST: nao se abate a tolerancia).
     */
    function aplicarHoraFechada(dia, previstos, tolerancia) {
        dia.variacoes = [];
        dia.toleranciaAplicada = false;
        dia.fechadaIndisponivel = false;
        if (dia.statusSaldo === 'pendente') { dia.saldoFechado = null; return; }
        if (dia.jornadaEsperada === 0 || dia.quantidade === 0) { dia.saldoFechado = dia.saldo; return; }
        if (!previstos) { dia.saldoFechado = null; dia.fechadaIndisponivel = true; return; }
        var soma = 0;
        var dentro = true;
        for (var i = 0; i < previstos.length; i++) {
            var v = Math.abs(minutosDoDia(dia.horarios[i]) - minutosDoDia(previstos[i]));
            dia.variacoes.push(v);
            soma += v;
            if (v > tolerancia.porMarcacao) { dentro = false; }
        }
        if (soma > tolerancia.porDia) { dentro = false; }
        dia.toleranciaAplicada = dentro && dia.saldo !== 0;
        dia.saldoFechado = dentro ? 0 : dia.saldo;
    }

    /*
     * Alertas de jornada (nao mudam o saldo, so chamam a atencao):
     * mais de 12h no dia, intervalo intrajornada curto (CLT art. 71) e
     * descanso entre jornadas menor que 11h (CLT art. 66).
     */
    function alertasDoDia(dia, anterior) {
        var alertas = [];
        if (!dia.quantidade || dia.impar) { return alertas; }
        if (dia.totalMinutos > 720) { alertas.push('MAIS DE 12H TRABALHADAS NO DIA'); }
        var maiorIntervalo = 0;
        for (var i = 1; i + 1 < dia.horarios.length; i += 2) {
            var intervalo = minutosDoDia(dia.horarios[i + 1]) - minutosDoDia(dia.horarios[i]);
            if (intervalo > maiorIntervalo) { maiorIntervalo = intervalo; }
        }
        if (dia.totalMinutos > 360) {
            if (dia.horarios.length === 2) {
                alertas.push('SEM INTERVALO REGISTRADO EM JORNADA DE MAIS DE 6H (CLT art. 71)');
            } else if (maiorIntervalo < 60) {
                alertas.push('INTERVALO MENOR QUE 1H EM JORNADA DE MAIS DE 6H (CLT art. 71)');
            }
        } else if (dia.totalMinutos > 240 && dia.horarios.length > 2 && maiorIntervalo < 15) {
            alertas.push('INTERVALO MENOR QUE 15 MIN EM JORNADA DE 4H A 6H (CLT art. 71)');
        }
        if (anterior && anterior.minutos !== null) {
            var a = dataParaUTC(anterior.data);
            var b = dataParaUTC(dia.data);
            var dias = a && b ? Math.round((b - a) / 86400000) : 99;
            var descanso = dias * 1440 - anterior.minutos + minutosDoDia(dia.horarios[0]);
            if (dias <= 1 && descanso < 660) {
                alertas.push('DESCANSO ENTRE JORNADAS MENOR QUE 11H (CLT art. 66)');
            }
        }
        return alertas;
    }

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

        var pessoas = mapaVazio();
        var semanas = mapaVazio();
        var meses = mapaVazio();
        var total = novoBalde();

        /* horarios previstos por dia da semana: opcoes.horarios ou os da escala pronta */
        var horarios = null;
        if (opcoes.horarios && opcoes.horarios.length === 7) {
            horarios = opcoes.horarios;
        } else if (typeof opcoes.escala === 'string' && ESCALAS[opcoes.escala] && ESCALAS[opcoes.escala].horarios) {
            horarios = ESCALAS[opcoes.escala].horarios;
        }
        var tolerancia = opcoes.tolerancia || TOLERANCIA_PADRAO;
        var comCalendario = !!opcoes.calendario;

        function novoBalde() {
            return { dias: 0, faltas: 0, folgas: 0, extras: 0, minutos: 0, esperado: 0, saldo: 0,
                saldoFechado: 0, pendentes: 0, semFechada: 0 };
        }

        function acumular(alvo, dia) {
            if (dia.tipo === 'falta') {
                alvo.faltas = (alvo.faltas || 0) + 1;
            } else if (dia.tipo === 'folga') {
                alvo.folgas = (alvo.folgas || 0) + 1;
            } else {
                alvo.dias += 1;
                if (dia.tipo === 'extra') { alvo.extras = (alvo.extras || 0) + 1; }
            }
            alvo.minutos += dia.totalMinutos;
            alvo.esperado += dia.jornadaEsperada;
            alvo.saldo += dia.saldo;
            if (dia.statusSaldo === 'pendente') {
                alvo.pendentes = (alvo.pendentes || 0) + 1;
            } else if (dia.saldoFechado == null) {
                alvo.semFechada = (alvo.semFechada || 0) + 1;
            } else {
                alvo.saldoFechado = (alvo.saldoFechado || 0) + dia.saldoFechado;
            }
        }

        function balde(mapa, chave, extra) {
            if (!mapa[chave]) {
                mapa[chave] = novoBalde();
                mapa[chave].chave = chave;
                if (extra) { Object.keys(extra).forEach(function (k) { mapa[chave][k] = extra[k]; }); }
            }
            return mapa[chave];
        }

        var ultimaSaida = mapaVazio();
        var ordenados = espelho.slice().sort(function (a, b) {
            if (a.chave !== b.chave) { return a.chave < b.chave ? -1 : 1; }
            return a.data < b.data ? -1 : (a.data > b.data ? 1 : 0);
        });

        ordenados.forEach(function (dia) {
            var info = infoData(dia.data);
            var cal = comCalendario ? diaDoCalendario(dia.data, opcoes.feriadosLocais) : (dia.calendario || null);
            var feriado = !!cal && cal.tipo === 'feriado';
            if (comCalendario) { dia.calendario = cal; }
            if (escala) {
                dia.jornadaEsperada = info.valida ? escala[info.dow] : jornada;
            } else {
                dia.jornadaEsperada = (soUteis && (info.dow === 0 || info.dow === 6)) ? 0 : jornada;
            }
            if (feriado) {
                dia.jornadaEsperada = 0;
                if (dia.quantidade > 0 && dia.tipo !== 'falta' && dia.tipo !== 'folga') {
                    dia.tipo = 'extra';
                    dia.etiqueta = 'HORA EXTRA FERIADO';
                }
            }
            dia.saldo = dia.totalMinutos - dia.jornadaEsperada;
            dia.chaveSemana = info.semana;
            dia.chaveMes = info.mes;

            /* PARA CONFERIR: pendencias do espelho mais a quantidade de batidas fora da jornada */
            var previstos = horarios && info.valida ? horarios[info.dow] : null;
            var pendencias = (dia.pendencias || []).slice();
            if (previstos && dia.jornadaEsperada > 0 && dia.quantidade > 0 && !pendencias.length &&
                    dia.quantidade !== previstos.length) {
                pendencias.push('QUANTIDADE DE MARCAÇÕES DIFERENTE DA JORNADA (' + dia.quantidade + ' de ' + previstos.length + ')');
            }
            dia.pendencias = pendencias;
            dia.statusSaldo = pendencias.length ? 'pendente' : 'ok';
            aplicarHoraFechada(dia, previstos, tolerancia);
            dia.alertas = alertasDoDia(dia, ultimaSaida[dia.chave]);
            if (dia.quantidade > 0 && !dia.impar) {
                ultimaSaida[dia.chave] = { data: dia.data, minutos: minutosDoDia(dia.horarios[dia.horarios.length - 1]) };
            }

            var p = pessoas[dia.chave];
            if (!p) {
                p = pessoas[dia.chave] = novoBalde();
                p.chave = dia.chave;
                p.semanas = {};
                p.meses = {};
            }
            acumular(p, dia);
            acumular(balde(p.semanas, dia.chaveSemana, { inicio: dia.chaveSemana, fim: info.fimSemana }), dia);
            acumular(balde(p.meses, dia.chaveMes, { rotulo: info.rotuloMes }), dia);
            acumular(balde(semanas, dia.chaveSemana, { inicio: dia.chaveSemana, fim: info.fimSemana }), dia);
            acumular(balde(meses, dia.chaveMes, { rotulo: info.rotuloMes }), dia);
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

    /*
     * Lista "documento -> empresa", para separar os colaboradores quando duas
     * empresas usam o mesmo relogio. Colunas: documento (PIS ou CPF), empresa e,
     * opcional, CNPJ da empresa. Cabecalho opcional; separador ; , ou tabulacao.
     */
    function lerListaDeEmpresas(texto) {
        var linhas = String(texto == null ? '' : texto).replace(/^\uFEFF/, '').split(/\r\n|\n|\r/);
        var empresas = mapaVazio();
        var cnpjs = mapaVazio();
        var total = 0, ignorados = 0, repetidos = 0;
        var primeira = '';
        for (var i = 0; i < linhas.length; i++) {
            if (linhas[i] && linhas[i].trim()) { primeira = linhas[i]; break; }
        }
        if (!primeira) { return { empresas: empresas, cnpjs: cnpjs, total: 0, ignorados: 0, repetidos: 0 }; }

        var separador = [';', '\t', ','].reduce(function (melhor, sep) {
            return primeira.split(sep).length > primeira.split(melhor).length ? sep : melhor;
        }, ';');
        var colDoc = 0, colEmpresa = 1, colCnpj = 2;
        var cab = primeira.split(separador).map(function (c) { return c.replace(/"/g, '').trim().toLowerCase(); });
        var temCabecalho = cab.some(function (c) { return /^(pis|cpf|documento|empresa|cnpj|pis\/cpf)$/.test(c); });
        if (temCabecalho) {
            cab.forEach(function (c, idx) {
                if (/^(pis|cpf|documento|doc|pis\/cpf)$/.test(c)) { colDoc = idx; }
                if (c === 'empresa' || c === 'razao social' || c === 'razão social') { colEmpresa = idx; }
                if (c === 'cnpj') { colCnpj = idx; }
            });
        }

        linhas.forEach(function (linha) {
            if (!linha || !linha.trim()) { return; }
            if (temCabecalho && linha === primeira) { return; }
            var partes = linha.split(separador);
            var doc = apenasDigitos(partes[colDoc] || '');
            var empresa = limpar((partes[colEmpresa] || '').replace(/"/g, ''));
            var cnpj = apenasDigitos(partes[colCnpj] || '');
            if (doc.length === 10) { doc = '0' + doc; }
            if (doc.length < 11 || !empresa) { ignorados += 1; return; }
            var chave = chavePessoa(doc);
            if (empresas[chave]) { repetidos += 1; return; }
            empresas[chave] = empresa;
            if (cnpj.length === 14 && !cnpjs[empresa]) { cnpjs[empresa] = cnpj; }
            total += 1;
        });
        return { empresas: empresas, cnpjs: cnpjs, total: total, ignorados: ignorados, repetidos: repetidos };
    }

    /* Normaliza { documento: nome } para a chave usada na comparacao */
    function normalizarListaDeNomes(objeto) {
        var nomes = mapaVazio();
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

    /* Campos e posicoes de um registro, montados so quando o inspetor abre. */
    function camposDoRegistro(linha, layout) {
        if (typeof linha !== 'string' || linha.length < 10) { return []; }
        var r = layout === '671' ? lerRegistro671(linha, true) : lerRegistro1510(linha, true);
        return r.campos || [];
    }

    return {
        TIPOS: TIPOS,
        camposDoRegistro: camposDoRegistro,
        compararTexto: compararTexto,
        TIPOS_ROTULO: TIPOS_ROTULO,
        TAMANHOS_1510: TAMANHOS_1510,
        OPERACOES: OPERACOES,
        analisar: analisar,
        criarAnalise: criarAnalise,
        separarLinhas: separarLinhas,
        detectarLayout: detectarLayout,
        montarEspelho: montarEspelho,
        calcularSaldos: calcularSaldos,
        completarDias: completarDias,
        ESCALAS: ESCALAS,
        somaDaEscala: somaDaEscala,
        lerListaDeNomes: lerListaDeNomes,
        VERSAO: VERSAO,
        sha256: sha256,
        celulaPlanilha: celulaPlanilha,
        pascoa: pascoa,
        diaDoCalendario: diaDoCalendario,
        dataIsoValida: dataIsoValida,
        TOLERANCIA_PADRAO: TOLERANCIA_PADRAO,
        lerListaDeEmpresas: lerListaDeEmpresas,
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
