/*
 * relatorio.js — Relatório por colaborador: um colaborador por página, para
 * imprimir ou salvar em PDF pelo diálogo de impressão do navegador.
 *
 * Usa window.LeitorAFD.dadosDoEspelho(), que entrega o espelho com os mesmos
 * filtros, escala e totais da tela. Nada é recalculado aqui: o relatório só
 * organiza os números que o leitor já mostra.
 *
 * Cada página é um colaborador em um mês, e cabe numa folha A4: se o conteúdo
 * passar da altura, a página é reduzida (zoom) até caber. As páginas saem em
 * ordem de empresa e de nome, e o cabeçalho traz a empresa do colaborador.
 *
 * Quando o núcleo passar a entregar saldoFechado por dia, a coluna HORA FECHADA
 * aparece sozinha ao lado de HORAS PRÁTICAS.
 */
(function () {
    'use strict';

    var ID = 'relatorioImpressao';

    function esc(v) {
        return String(v == null ? '' : v)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function dataBR(iso) { return AFD.formatarDataBR(iso) || '—'; }
    function horas(min) { return AFD.formatarMinutos(min || 0); }
    function saldo(min) { return AFD.formatarSaldo(min || 0); }
    function classe(min) { return min > 0 ? 'pos' : (min < 0 ? 'neg' : ''); }

    function agora() {
        var d = new Date();
        function dd(n) { return (n < 10 ? '0' : '') + n; }
        return dd(d.getDate()) + '/' + dd(d.getMonth() + 1) + '/' + d.getFullYear() +
            ' ' + dd(d.getHours()) + ':' + dd(d.getMinutes());
    }

    function temFechada(dia) { return Object.prototype.hasOwnProperty.call(dia, 'saldoFechado'); }

    /* Situação do dia: etiqueta do leitor, marcação ímpar e feriado (quando feriados.js existir). */
    function situacao(dia) {
        var partes = [];
        if (dia.etiqueta) { partes.push(dia.etiqueta); }
        if (dia.impar) { partes.push('MARCAÇÃO ÍMPAR — conferir'); }
        if (window.FERIADOS && typeof window.FERIADOS.feriado === 'function') {
            var nome = window.FERIADOS.feriado(AFD.formatarDataBR(dia.data));
            if (nome) { partes.push('FERIADO — ' + nome); }
        }
        if (dia.statusSaldo === 'pendente') { partes.push('PARA CONFERIR'); }
        return partes.join(' · ');
    }

    function linhaDia(dia, comFechada) {
        var batidas = (dia.horarios || []).map(function (h) { return String(h).slice(0, 5); }).join('  ');
        var celulaFechada = '';
        if (comFechada) {
            celulaFechada = dia.saldoFechado == null
                ? '<td class="num">—</td>'
                : '<td class="num ' + classe(dia.saldoFechado) + '">' + esc(saldo(dia.saldoFechado)) + '</td>';
        }
        return '<tr class="' + (dia.tipo === 'falta' ? 'falta' : (dia.tipo === 'folga' ? 'folga' : '')) + '">' +
            '<td>' + esc(dataBR(dia.data)) + '</td>' +
            '<td>' + esc(String(dia.diaSemana || '').slice(0, 3)) + '</td>' +
            '<td class="mono">' + esc(batidas || '—') + '</td>' +
            '<td class="num">' + esc(horas(dia.totalMinutos)) + '</td>' +
            '<td class="num">' + esc(horas(dia.jornadaEsperada)) + '</td>' +
            '<td class="num ' + classe(dia.saldo) + '">' + esc(saldo(dia.saldo)) + '</td>' +
            celulaFechada +
            '<td class="sit">' + esc(situacao(dia)) + '</td>' +
            '</tr>';
    }

    /* Soma dos dias da semana que estão nesta página (semana que cruza o mês sai parcial). */
    function somaDias(dias) {
        return dias.reduce(function (t, d) {
            t.minutos += d.totalMinutos || 0;
            t.esperado += d.jornadaEsperada || 0;
            t.saldo += d.saldo || 0;
            return t;
        }, { minutos: 0, esperado: 0, saldo: 0, inicio: dias[0].data, fim: dias[dias.length - 1].data });
    }

    function linhaSemana(b, colunas) {
        return '<tr class="subtotal"><td colspan="3">Total da semana ' + esc(dataBR(b.inicio)) + ' a ' + esc(dataBR(b.fim)) + '</td>' +
            '<td class="num">' + esc(horas(b.minutos)) + '</td>' +
            '<td class="num">' + esc(horas(b.esperado)) + '</td>' +
            '<td class="num ' + classe(b.saldo) + '">' + esc(saldo(b.saldo)) + '</td>' +
            '<td colspan="' + (colunas - 6) + '"></td></tr>';
    }

    function somaFechada(dias) {
        var total = 0, pendentes = 0;
        dias.forEach(function (d) {
            if (!temFechada(d)) { return; }
            if (d.saldoFechado == null) { pendentes += 1; } else { total += d.saldoFechado; }
        });
        return { total: total, pendentes: pendentes };
    }

    function pagina(dados, item, numero, total) {
        var g = dados.grupos[item.chave];
        var p = dados.saldos.pessoas[item.chave];
        var m = (p.meses && p.meses[item.mes]) || {};
        var dias = item.dias;
        var comFechada = dias.some(temFechada);
        var colunas = comFechada ? 8 : 7;
        var cab = dados.cabecalho;
        var empresa = item.empresa;
        var cnpj = dados.cnpjDe(empresa);

        var corpo = [];
        var semana = [];
        dias.forEach(function (d, i) {
            semana.push(d);
            corpo.push(linhaDia(d, comFechada));
            var proximo = dias[i + 1];
            if (!proximo || proximo.chaveSemana !== d.chaveSemana) {
                corpo.push(linhaSemana(somaDias(semana), colunas));
                semana = [];
            }
        });

        var fechada = comFechada ? somaFechada(dias) : null;
        var totais =
            '<div class="totais">' +
            '<div><span>Trabalhadas</span><b>' + esc(horas(m.minutos)) + '</b></div>' +
            '<div><span>Previstas</span><b>' + esc(horas(m.esperado)) + '</b></div>' +
            '<div><span>Dias trabalhados</span><b>' + esc(m.dias || 0) + '</b></div>' +
            '<div><span>Faltas</span><b>' + esc(m.faltas || 0) + '</b></div>' +
            '<div><span>Dias extras</span><b>' + esc(m.extras || 0) + '</b></div>' +
            '<div class="destaque"><span>Horas práticas (saldo do mês)</span><b class="' + classe(m.saldo) + '">' + esc(saldo(m.saldo)) + '</b></div>' +
            (fechada
                ? '<div class="destaque"><span>Hora fechada (saldo do mês)</span><b class="' + classe(fechada.total) + '">' +
                  esc(saldo(fechada.total)) + '</b>' +
                  (fechada.pendentes ? '<small>' + fechada.pendentes + ' dia(s) para conferir fora da soma</small>' : '') + '</div>'
                : '') +
            '</div>';

        return '<section class="rel-pagina">' +
            '<header class="rel-topo">' +
            '<div><h1>Espelho de ponto — conferência de jornada</h1>' +
            '<p><b>' + esc(empresa) + '</b>' +
            (cnpj ? ' · CNPJ ' + esc(AFD.formatarDocumento(cnpj, 'CNPJ')) : '') +
            (cab.numeroFabricacao ? ' · REP ' + esc(cab.numeroFabricacao) : '') + '</p></div>' +
            '<div class="rel-pag">Página ' + numero + ' de ' + total + '</div>' +
            '</header>' +
            '<div class="rel-pessoa">' +
            '<div><span>Colaborador</span><b>' + esc(g.nome || 'Nome não informado no arquivo') + '</b></div>' +
            '<div><span>' + esc(g.tipo || 'Documento') + '</span><b class="mono">' + esc(dados.documento(g.identificador, g.tipo)) + '</b></div>' +
            '<div><span>Mês</span><b>' + esc(m.rotulo || item.mes) + '</b><small>' + esc(dataBR(dias[0].data)) + ' a ' +
            esc(dataBR(dias[dias.length - 1].data)) + '</small></div>' +
            '<div><span>Jornada contratual</span><b>' + esc(dados.escala.rotulo) + '</b></div>' +
            '</div>' +
            '<table class="rel-dias"><thead><tr>' +
            '<th>Data</th><th>Dia</th><th>Marcações</th><th class="num">Trabalhado</th><th class="num">Previsto</th>' +
            '<th class="num">Horas práticas</th>' + (comFechada ? '<th class="num">Hora fechada</th>' : '') +
            '<th>Situação</th></tr></thead><tbody>' + corpo.join('') + '</tbody></table>' +
            totais +
            '<div class="rel-assinaturas">' +
            '<div><span></span>Colaborador</div>' +
            '<div><span></span>Responsável pela conferência</div>' +
            '</div>' +
            '<footer class="rel-rodape">Gerado em ' + esc(agora()) + ' pelo Contador de horas' +
            (dados.nomeArquivo ? ' · Arquivo: ' + esc(dados.nomeArquivo) : '') +
            ' · Horas práticas = minuto a minuto do relógio. Documento de conferência; não substitui a folha de pagamento.' +
            '</footer>' +
            '</section>';
    }

    /* Uma página por colaborador e por mês, em ordem de empresa e de nome. */
    function paginas(dados) {
        var lista = [];
        dados.ordem.forEach(function (chave) {
            var g = dados.grupos[chave];
            var empresa = dados.empresaDe(chave);
            var porMes = {};
            g.dias.slice().sort(function (a, b) { return a.data < b.data ? -1 : (a.data > b.data ? 1 : 0); })
                .forEach(function (d) { (porMes[d.chaveMes] = porMes[d.chaveMes] || []).push(d); });
            Object.keys(porMes).sort().forEach(function (mes) {
                lista.push({ chave: chave, empresa: empresa, nome: g.nome || '', mes: mes, dias: porMes[mes] });
            });
        });
        lista.sort(function (a, b) {
            return AFD.compararTexto(a.empresa, b.empresa) ||
                AFD.compararTexto(a.nome || '￿', b.nome || '￿') ||
                (a.chave < b.chave ? -1 : (a.chave > b.chave ? 1 : 0)) ||
                (a.mes < b.mes ? -1 : (a.mes > b.mes ? 1 : 0));
        });
        return lista;
    }

    var ESTILO =
        '#' + ID + '{display:none}' +
        '@media print{' +
        '@page{size:A4 portrait;margin:12mm 10mm}' +
        'body.imprimindo-relatorio>*:not(#' + ID + '){display:none!important}' +
        'body.imprimindo-relatorio{background:#fff!important;padding:0!important;margin:0!important}' +
        'body.imprimindo-relatorio #' + ID + '{display:block!important}' +
        '}' +
        '#' + ID + '{font:9pt/1.35 Arial,Helvetica,sans-serif;color:#000}' +
        '#' + ID + ' .rel-pagina{font-size:9pt}' +
        '#' + ID + ' *{box-sizing:border-box}' +
        '#' + ID + ' .rel-pagina{break-after:page;page-break-after:always}' +
        '#' + ID + ' .rel-pagina:last-child{break-after:auto;page-break-after:auto}' +
        '#' + ID + ' .rel-topo{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #000;padding-bottom:4px;margin-bottom:6px}' +
        '#' + ID + ' h1{font-size:1.444em;margin:0}' +
        '#' + ID + ' .rel-topo p{margin:2px 0 0;font-size:0.944em}' +
        '#' + ID + ' .rel-pag{font-size:0.889em;white-space:nowrap}' +
        '#' + ID + ' .rel-pessoa{display:grid;grid-template-columns:2fr 1.2fr 1.2fr 2fr;gap:4px 10px;margin-bottom:6px}' +
        '#' + ID + ' .rel-pessoa small{display:block;font-size:0.833em}' +
        '#' + ID + ' .rel-pessoa span,#' + ID + ' .totais span{display:block;font-size:0.778em;text-transform:uppercase;letter-spacing:.04em;color:#444}' +
        '#' + ID + ' table{width:100%;border-collapse:collapse;margin-bottom:6px;font-size:1em}' +
        '#' + ID + ' th,#' + ID + ' td{border:1px solid #999;padding:.2em .45em;text-align:left;vertical-align:top;font-size:1em;line-height:1.3;height:auto}' +
        '#' + ID + ' th{background:#e8e8e8;font-size:0.833em;text-transform:uppercase}' +
        '#' + ID + ' tr{break-inside:avoid;page-break-inside:avoid}' +
        '#' + ID + ' .num{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}' +
        '#' + ID + ' .mono{font-family:"Courier New",monospace;font-size:1em}' +
        '#' + ID + ' .sit{font-size:0.833em}' +
        '#' + ID + ' .neg{color:#b00000}' +
        '#' + ID + ' .pos{color:#006b2d}' +
        '#' + ID + ' tr.falta td{background:#fbeaea}' +
        '#' + ID + ' tr.folga td{color:#555}' +
        '#' + ID + ' tr.subtotal td{background:#f3f3f3;font-weight:bold}' +
        '#' + ID + ' .totais{display:flex;flex-wrap:wrap;gap:6px;margin:4px 0 10px;break-inside:avoid}' +
        '#' + ID + ' .totais div{border:1px solid #999;padding:3px 6px;min-width:80px}' +
        '#' + ID + ' .totais .destaque{border:2px solid #000}' +
        '#' + ID + ' .totais b{font-size:1.167em}' +
        '#' + ID + ' .totais small{display:block;font-size:0.778em}' +
        '#' + ID + ' .rel-assinaturas{display:flex;gap:30px;margin-top:22px;break-inside:avoid}' +
        '#' + ID + ' .rel-assinaturas div{flex:1;text-align:center;font-size:0.889em}' +
        '#' + ID + ' .rel-assinaturas span{display:block;border-top:1px solid #000;margin-bottom:2px}' +
        '#' + ID + ' .rel-rodape{margin-top:10px;font-size:0.778em;color:#444;border-top:1px solid #999;padding-top:3px}';

    function garantirEstilo() {
        if (document.getElementById(ID + 'Estilo')) { return; }
        var s = document.createElement('style');
        s.id = ID + 'Estilo';
        s.textContent = ESTILO;
        document.head.appendChild(s);
    }

    /* Monta o HTML do relatório; exposto para pré-visualização e testes. */
    function montar(dados) {
        if (!dados || !dados.ordem.length) { return ''; }
        var lista = paginas(dados);
        return lista.map(function (item, i) { return pagina(dados, item, i + 1, lista.length); }).join('');
    }

    /*
     * Garante uma folha por página: mede cada página na largura útil do A4 e,
     * se passar da altura útil, reduz o tamanho da letra (até 5,5 pt) até caber.
     * Todas as medidas do relatório são relativas à letra da página.
     */
    var MM = 96 / 25.4;
    var LARGURA_UTIL = 190 * MM;   /* A4 210 mm - 2 x 10 mm */
    var ALTURA_UTIL = 270 * MM;    /* A4 297 mm - 2 x 12 mm, com folga de 3 mm */
    var LETRA = 9, LETRA_MINIMA = 5.5;

    function caberEmUmaFolha(alvo) {
        var antes = alvo.getAttribute('style') || '';
        alvo.setAttribute('style', 'display:block;position:absolute;left:-10000px;top:0;width:' + LARGURA_UTIL + 'px');
        alvo.querySelectorAll('.rel-pagina').forEach(function (pag) {
            var letra = LETRA;
            pag.style.fontSize = letra + 'pt';
            for (var i = 0; i < 6 && pag.scrollHeight > ALTURA_UTIL && letra > LETRA_MINIMA; i++) {
                letra = Math.max(LETRA_MINIMA, Math.floor(letra * (ALTURA_UTIL / pag.scrollHeight) * 10) / 10);
                pag.style.fontSize = letra + 'pt';
            }
            pag.setAttribute('data-letra', String(letra));
        });
        alvo.setAttribute('style', antes);
    }

    function gerar() {
        var dados = window.LeitorAFD && window.LeitorAFD.dadosDoEspelho ? window.LeitorAFD.dadosDoEspelho() : null;
        var html = montar(dados);
        if (!html) {
            window.alert('Nenhum colaborador no espelho com os filtros atuais.');
            return;
        }
        garantirEstilo();
        var alvo = document.getElementById(ID);
        if (!alvo) {
            alvo = document.createElement('div');
            alvo.id = ID;
            document.body.appendChild(alvo);
        }
        alvo.innerHTML = html;
        caberEmUmaFolha(alvo);
        document.body.classList.add('imprimindo-relatorio');
        var limpar = function () {
            document.body.classList.remove('imprimindo-relatorio');
            window.removeEventListener('afterprint', limpar);
        };
        // A classe só vale na mídia de impressão; se afterprint não vier, a tela não muda.
        window.addEventListener('afterprint', limpar);
        window.print();
    }

    document.addEventListener('click', function (e) {
        if (e.target.closest && e.target.closest('#btnRelatorio')) { gerar(); }
    });

    window.LeitorAFD = window.LeitorAFD || {};
    window.LeitorAFD.relatorio = { montar: montar, gerar: gerar, caberEmUmaFolha: caberEmUmaFolha, estilo: function () { return ESTILO; } };
})();
