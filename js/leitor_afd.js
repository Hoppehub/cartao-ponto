/*!
 * Leitor de AFD - interface
 * Depende de js/afd_parser.js (window.AFD). Tudo roda no navegador.
 */
(function () {
    'use strict';

    var LOTE = 4000;          /* linhas processadas por ciclo */
    var POR_PAGINA = 200;     /* linhas por pagina nas tabelas */

    var estado = {
        resultado: null,
        espelho: [],
        registrosPorLinha: {},
        aba: 'resumo',
        pagina: {},
        ordem: {},
        mascarar: false,
        nomeArquivo: '',
        codificacao: '',
        tamanhoArquivo: 0,
        filtros: { busca: '', dataIni: '', dataFim: '', pessoa: '', tipo: '', nivel: '' }
    };

    /* ------------------------------------------------------------------ *
     * Utilitarios
     * ------------------------------------------------------------------ */

    function $(id) { return document.getElementById(id); }

    function esc(v) {
        return String(v == null ? '' : v)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function numeroBR(v) {
        return Number(v || 0).toLocaleString('pt-BR');
    }

    function tamanhoLegivel(bytes) {
        if (!bytes) { return '0 B'; }
        var un = ['B', 'KB', 'MB', 'GB'];
        var i = Math.floor(Math.log(bytes) / Math.log(1024));
        return (bytes / Math.pow(1024, i)).toFixed(i ? 1 : 0) + ' ' + un[i];
    }

    function documento(valor, tipo) {
        if (!valor) { return ''; }
        if (estado.mascarar) { return AFD.mascarar(valor); }
        return AFD.formatarDocumento(valor, tipo);
    }

    function dataHoraBR(data, hora) {
        if (!data) { return ''; }
        return AFD.formatarDataBR(data) + (hora ? ' ' + hora.slice(0, 5) : '');
    }

    function debounce(fn, ms) {
        var t;
        return function () {
            var args = arguments, ctx = this;
            clearTimeout(t);
            t = setTimeout(function () { fn.apply(ctx, args); }, ms);
        };
    }

    /* ------------------------------------------------------------------ *
     * Tema
     * ------------------------------------------------------------------ */

    function aplicarTema(tema) {
        document.documentElement.setAttribute('data-theme', tema);
        var i = $('btnTema').querySelector('i');
        i.className = tema === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
        try { localStorage.setItem('leitor-afd-tema', tema); } catch (e) { /* modo privado */ }
    }

    function iniciarTema() {
        var salvo = null;
        try { salvo = localStorage.getItem('leitor-afd-tema'); } catch (e) { /* ignora */ }
        var escuro = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        aplicarTema(salvo || (escuro ? 'dark' : 'light'));
        $('btnTema').addEventListener('click', function () {
            aplicarTema(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
        });
    }

    /* ------------------------------------------------------------------ *
     * Leitura do arquivo
     * ------------------------------------------------------------------ */

    function mostrarAviso(mensagem) {
        $('avisoTexto').innerHTML = mensagem;
        $('aviso').style.display = mensagem ? 'flex' : 'none';
    }

    function decodificar(buffer) {
        var bytes = new Uint8Array(buffer);
        var temAcento = false;
        for (var i = 0; i < bytes.length; i++) {
            if (bytes[i] > 127) { temAcento = true; break; }
        }
        if (!temAcento) { return { texto: new TextDecoder('utf-8').decode(bytes), codificacao: 'ASCII' }; }
        try {
            return { texto: new TextDecoder('utf-8', { fatal: true }).decode(bytes), codificacao: 'UTF-8' };
        } catch (e) {
            return { texto: new TextDecoder('windows-1252').decode(bytes), codificacao: 'ISO-8859-1' };
        }
    }

    function carregarArquivo(arquivo) {
        if (!arquivo) { return; }
        mostrarAviso('');
        estado.nomeArquivo = arquivo.name;
        estado.tamanhoArquivo = arquivo.size;
        var leitor = new FileReader();
        leitor.onerror = function () { mostrarAviso('Não foi possível ler o arquivo selecionado.'); };
        leitor.onload = function () {
            var d = decodificar(leitor.result);
            estado.codificacao = d.codificacao;
            analisar(d.texto);
        };
        leitor.readAsArrayBuffer(arquivo);
    }

    function analisar(texto) {
        if (!texto || !texto.trim()) {
            mostrarAviso('O conteúdo informado está vazio.');
            return;
        }
        var linhas = AFD.separarLinhas(texto);
        var layout = $('seletorLayout').value;
        var an = AFD.criarAnalise({ layout: layout });
        var i = 0;

        $('progresso').style.display = 'block';
        $('progressoBarra').style.width = '0%';
        $('progressoTexto').textContent = 'Lendo ' + numeroBR(linhas.length) + ' linha(s)...';

        function passo() {
            var fim = Math.min(i + LOTE, linhas.length);
            an.processar(linhas.slice(i, fim));
            i = fim;
            $('progressoBarra').style.width = ((i / linhas.length) * 100).toFixed(1) + '%';
            if (i < linhas.length) {
                setTimeout(passo, 0);
            } else {
                setTimeout(function () { concluir(an.finalizar()); }, 0);
            }
        }
        setTimeout(passo, 0);
    }

    function concluir(resultado) {
        $('progresso').style.display = 'none';
        estado.resultado = resultado;
        estado.espelho = AFD.montarEspelho(resultado.marcacoes, resultado.pessoas);
        estado.registrosPorLinha = {};
        resultado.registros.forEach(function (r) { estado.registrosPorLinha[r.numeroLinha] = r; });
        estado.pagina = {};
        estado.ordem = {};
        estado.filtros = { busca: '', dataIni: '', dataFim: '', pessoa: '', tipo: '', nivel: '' };
        estado.aba = 'resumo';

        if (resultado.layout === 'desconhecido') {
            mostrarAviso('Não foi possível identificar o leiaute do arquivo. ' +
                'Confira se é mesmo um AFD ou selecione o leiaute manualmente antes de carregar de novo.');
        }

        $('painel').hidden = false;
        desenharCartoes();
        desenharAbas();
        desenharConteudo();
        $('painel').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    /* ------------------------------------------------------------------ *
     * Cartoes de resumo
     * ------------------------------------------------------------------ */

    function desenharCartoes() {
        var r = estado.resultado;
        var res = r.resumo;
        var cab = r.cabecalho || {};
        var periodo = res.periodoDeclarado.inicio
            ? AFD.formatarDataBR(res.periodoDeclarado.inicio) + ' a ' + AFD.formatarDataBR(res.periodoDeclarado.fim)
            : (res.periodoReal.inicio
                ? AFD.formatarDataBR(res.periodoReal.inicio) + ' a ' + AFD.formatarDataBR(res.periodoReal.fim)
                : '—');
        var erros = res.niveis.erro || 0;
        var alertas = res.niveis.alerta || 0;
        var classeAuditoria = erros ? 'erro' : (alertas ? 'alerta' : 'ok');
        var textoAuditoria = erros ? erros + ' erro(s)' : (alertas ? alertas + ' alerta(s)' : 'Sem apontamentos');

        var cartoes = [
            {
                rotulo: 'Leiaute', icone: 'fa-file-shield', classe: '',
                valor: r.layoutDescricao, texto: true,
                apoio: estado.codificacao ? 'Codificação ' + estado.codificacao : ''
            },
            {
                rotulo: 'Empregador', icone: 'fa-building', classe: '',
                valor: cab.razaoSocial || '—', texto: true,
                apoio: cab.identificadorEmpregador
                    ? AFD.formatarDocumento(cab.identificadorEmpregador, cab.tipoDocumentoEmpregador) +
                      (cab.documentoEmpregadorValido === false ? ' (DV inválido)' : '')
                    : ''
            },
            {
                rotulo: 'Período dos registros', icone: 'fa-calendar-days', classe: '',
                valor: periodo, texto: true,
                apoio: res.geracao.data ? 'Gerado em ' + dataHoraBR(res.geracao.data, res.geracao.hora) : ''
            },
            {
                rotulo: 'Marcações de ponto', icone: 'fa-fingerprint', classe: '',
                valor: numeroBR(res.totalMarcacoes),
                apoio: numeroBR(res.totalLinhas) + ' linha(s) no arquivo'
            },
            {
                rotulo: 'Trabalhadores', icone: 'fa-users', classe: '',
                valor: numeroBR(res.totalPessoas),
                apoio: numeroBR(r.empregados.length) + ' registro(s) de cadastro'
            },
            {
                rotulo: 'Auditoria', icone: 'fa-clipboard-check', classe: classeAuditoria,
                valor: textoAuditoria, texto: true,
                apoio: (res.niveis.info || 0) + ' observação(ões)'
            }
        ];

        $('cartoes').innerHTML = cartoes.map(function (c) {
            return '<div class="cartao ' + c.classe + '">' +
                '<div class="rotulo"><i class="fas ' + c.icone + '"></i> ' + esc(c.rotulo) + '</div>' +
                '<div class="valor' + (c.texto ? ' texto' : '') + '">' + esc(c.valor) + '</div>' +
                (c.apoio ? '<div class="apoio">' + esc(c.apoio) + '</div>' : '') +
                '</div>';
        }).join('');
    }

    /* ------------------------------------------------------------------ *
     * Abas
     * ------------------------------------------------------------------ */

    function definicaoAbas() {
        var r = estado.resultado;
        return [
            { id: 'resumo', rotulo: 'Resumo', icone: 'fa-chart-simple' },
            { id: 'marcacoes', rotulo: 'Marcações', icone: 'fa-fingerprint', contador: r.marcacoes.length },
            { id: 'espelho', rotulo: 'Espelho de ponto', icone: 'fa-table-list', contador: estado.espelho.length },
            { id: 'pessoas', rotulo: 'Trabalhadores', icone: 'fa-users', contador: r.pessoas.length },
            { id: 'empresa', rotulo: 'Empregador e REP', icone: 'fa-building' },
            { id: 'eventos', rotulo: 'Relógio e eventos', icone: 'fa-clock-rotate-left', contador: r.ajustes.length + r.eventos.length },
            { id: 'auditoria', rotulo: 'Inconsistências', icone: 'fa-triangle-exclamation', contador: r.inconsistencias.length },
            { id: 'arquivo', rotulo: 'Arquivo bruto', icone: 'fa-code', contador: r.registros.length }
        ];
    }

    function desenharAbas() {
        $('abas').innerHTML = definicaoAbas().map(function (a) {
            return '<button class="aba' + (a.id === estado.aba ? ' ativa' : '') + '" data-aba="' + a.id + '">' +
                '<i class="fas ' + a.icone + '"></i> ' + esc(a.rotulo) +
                (a.contador !== undefined ? ' <span class="contador">' + numeroBR(a.contador) + '</span>' : '') +
                '</button>';
        }).join('');
    }

    /* ------------------------------------------------------------------ *
     * Filtros
     * ------------------------------------------------------------------ */

    function barraFiltros(opcoes) {
        var f = estado.filtros;
        var partes = ['<div class="filtros">'];

        partes.push('<div class="campo cresce"><label for="fBusca">Buscar</label>' +
            '<input type="search" id="fBusca" placeholder="' + esc(opcoes.placeholder || 'Nome, documento, NSR...') +
            '" value="' + esc(f.busca) + '"></div>');

        if (opcoes.datas) {
            partes.push('<div class="campo"><label for="fDataIni">De</label>' +
                '<input type="date" id="fDataIni" value="' + esc(f.dataIni) + '"></div>');
            partes.push('<div class="campo"><label for="fDataFim">Até</label>' +
                '<input type="date" id="fDataFim" value="' + esc(f.dataFim) + '"></div>');
        }

        if (opcoes.pessoas) {
            var pessoas = estado.resultado.pessoas;
            var limite = 1000;
            var lista = pessoas.slice(0, limite).map(function (p) {
                var rotulo = (p.nome || '(sem cadastro)') + ' — ' + documento(p.identificador, p.tipoIdentificador);
                return '<option value="' + esc(p.chave) + '"' + (f.pessoa === p.chave ? ' selected' : '') + '>' +
                    esc(rotulo) + '</option>';
            }).join('');
            partes.push('<div class="campo"><label for="fPessoa">Trabalhador</label>' +
                '<select id="fPessoa"><option value="">Todos</option>' + lista + '</select>' +
                (pessoas.length > limite ? '' : '') + '</div>');
        }

        if (opcoes.tipos) {
            var tipos = Object.keys(AFD.TIPOS_ROTULO).filter(function (t) {
                return estado.resultado.resumo.contagens[t];
            });
            partes.push('<div class="campo"><label for="fTipo">Tipo de registro</label>' +
                '<select id="fTipo"><option value="">Todos</option>' +
                tipos.map(function (t) {
                    return '<option value="' + t + '"' + (f.tipo === t ? ' selected' : '') + '>' +
                        t + ' — ' + esc(AFD.TIPOS_ROTULO[t]) + '</option>';
                }).join('') + '</select></div>');
        }

        if (opcoes.niveis) {
            partes.push('<div class="campo"><label for="fNivel">Gravidade</label>' +
                '<select id="fNivel">' +
                ['', 'erro', 'alerta', 'info'].map(function (n) {
                    var rot = { '': 'Todas', 'erro': 'Erros', 'alerta': 'Alertas', 'info': 'Observações' }[n];
                    return '<option value="' + n + '"' + (f.nivel === n ? ' selected' : '') + '>' + rot + '</option>';
                }).join('') + '</select></div>');
        }

        partes.push('<div class="filtros-acoes">');
        partes.push('<label class="interruptor"><input type="checkbox" id="fMascarar"' +
            (estado.mascarar ? ' checked' : '') + '> Ocultar documentos</label>');
        if (opcoes.exportar !== false) {
            partes.push('<button class="btn" id="btnCopiar"><i class="fas fa-copy"></i> Copiar</button>');
            partes.push('<button class="btn btn-primario" id="btnCsv"><i class="fas fa-file-csv"></i> Baixar CSV</button>');
        }
        partes.push('</div></div>');
        return partes.join('');
    }

    function filtroTexto(campos) {
        var termo = estado.filtros.busca.trim().toLowerCase();
        if (!termo) { return true; }
        return campos.join(' ').toLowerCase().indexOf(termo) >= 0;
    }

    function dentroDoPeriodo(data) {
        var f = estado.filtros;
        if (f.dataIni && (!data || data < f.dataIni)) { return false; }
        if (f.dataFim && (!data || data > f.dataFim)) { return false; }
        return true;
    }

    /* ------------------------------------------------------------------ *
     * Tabelas
     * ------------------------------------------------------------------ */

    function ordenar(chaveAba, linhas, colunas) {
        var ord = estado.ordem[chaveAba];
        if (!ord) { return linhas; }
        var col = colunas[ord.indice];
        if (!col || !col.valor) { return linhas; }
        var copia = linhas.slice();
        copia.sort(function (a, b) {
            var va = col.valor(a), vb = col.valor(b);
            if (typeof va === 'number' && typeof vb === 'number') { return ord.desc ? vb - va : va - vb; }
            va = String(va == null ? '' : va);
            vb = String(vb == null ? '' : vb);
            return ord.desc ? vb.localeCompare(va, 'pt-BR') : va.localeCompare(vb, 'pt-BR');
        });
        return copia;
    }

    function tabela(chaveAba, colunas, linhas, opcoes) {
        opcoes = opcoes || {};
        if (!linhas.length) {
            return '<div class="vazio"><i class="fas fa-inbox"></i>' +
                esc(opcoes.vazio || 'Nenhum registro para os filtros aplicados.') + '</div>';
        }

        var ordenadas = ordenar(chaveAba, linhas, colunas);
        var pagina = estado.pagina[chaveAba] || 1;
        var totalPaginas = Math.max(1, Math.ceil(ordenadas.length / POR_PAGINA));
        if (pagina > totalPaginas) { pagina = totalPaginas; estado.pagina[chaveAba] = pagina; }
        var inicio = (pagina - 1) * POR_PAGINA;
        var visiveis = ordenadas.slice(inicio, inicio + POR_PAGINA);
        var ord = estado.ordem[chaveAba];

        var html = ['<div class="rolagem"><table><thead><tr>'];
        colunas.forEach(function (c, i) {
            var seta = '';
            if (c.valor) {
                seta = ord && ord.indice === i
                    ? ' <i class="fas fa-sort-' + (ord.desc ? 'down' : 'up') + '"></i>'
                    : ' <i class="fas fa-sort" style="opacity:.3"></i>';
            }
            html.push('<th' + (c.valor ? ' class="clicavel" data-ordenar="' + i + '"' : '') + '>' +
                esc(c.titulo) + seta + '</th>');
        });
        html.push('</tr></thead><tbody>');

        visiveis.forEach(function (linha) {
            var atributos = opcoes.linhaAtributos ? opcoes.linhaAtributos(linha) : '';
            html.push('<tr ' + atributos + '>');
            colunas.forEach(function (c) {
                html.push('<td class="' + (c.classe || '') + '">' + c.celula(linha) + '</td>');
            });
            html.push('</tr>');
        });
        html.push('</tbody></table></div>');

        html.push('<div class="paginacao"><span>' +
            numeroBR(inicio + 1) + '–' + numeroBR(Math.min(inicio + POR_PAGINA, ordenadas.length)) +
            ' de ' + numeroBR(ordenadas.length) + ' registro(s)</span>');
        if (totalPaginas > 1) {
            html.push('<span class="paginacao-botoes">' +
                '<button class="btn btn-icone" data-pagina="1"' + (pagina === 1 ? ' disabled' : '') + '><i class="fas fa-angles-left"></i></button>' +
                '<button class="btn btn-icone" data-pagina="' + (pagina - 1) + '"' + (pagina === 1 ? ' disabled' : '') + '><i class="fas fa-angle-left"></i></button>' +
                '<span>Página ' + numeroBR(pagina) + ' de ' + numeroBR(totalPaginas) + '</span>' +
                '<button class="btn btn-icone" data-pagina="' + (pagina + 1) + '"' + (pagina === totalPaginas ? ' disabled' : '') + '><i class="fas fa-angle-right"></i></button>' +
                '<button class="btn btn-icone" data-pagina="' + totalPaginas + '"' + (pagina === totalPaginas ? ' disabled' : '') + '><i class="fas fa-angles-right"></i></button>' +
                '</span>');
        }
        html.push('</div>');
        return html.join('');
    }

    /* ------------------------------------------------------------------ *
     * Grafico de marcacoes por dia
     * ------------------------------------------------------------------ */

    function graficoPorDia() {
        var contagem = {};
        estado.resultado.marcacoes.forEach(function (m) {
            if (!m.data) { return; }
            contagem[m.data] = (contagem[m.data] || 0) + 1;
        });
        var dias = Object.keys(contagem).sort();
        if (dias.length < 2) { return ''; }

        var larg = 720, alt = 190;
        var margem = { esq: 38, dir: 10, topo: 16, base: 40 };
        var areaL = larg - margem.esq - margem.dir;
        var areaA = alt - margem.topo - margem.base;
        var maximo = Math.max.apply(null, dias.map(function (d) { return contagem[d]; }));
        var passo = areaL / dias.length;
        /* 2px de respiro entre as barras e largura maxima para poucos dias */
        var largBarra = Math.min(46, Math.max(2, passo - 2));
        var mostrarValor = dias.length <= 14;

        function caminho(x, y, w, h) {
            var r = Math.min(4, w / 2, h);
            if (h <= 0.5) { return ''; }
            return 'M' + x + ',' + (y + h) + 'V' + (y + r) +
                'a' + r + ',' + r + ' 0 0 1 ' + r + ',-' + r +
                'h' + (w - 2 * r) +
                'a' + r + ',' + r + ' 0 0 1 ' + r + ',' + r +
                'V' + (y + h) + 'Z';
        }

        var partes = ['<svg class="grafico" viewBox="0 0 ' + larg + ' ' + alt + '" role="img" ' +
            'aria-label="Marcações de ponto por dia">'];

        /* referencia horizontal no topo da escala */
        partes.push('<line class="eixo" x1="' + margem.esq + '" y1="' + margem.topo + '" x2="' + (larg - margem.dir) + '" y2="' + margem.topo + '" stroke-dasharray="3 3"/>');
        partes.push('<text x="' + (margem.esq - 6) + '" y="' + (margem.topo + 4) + '" text-anchor="end">' + maximo + '</text>');
        partes.push('<text x="' + (margem.esq - 6) + '" y="' + (margem.topo + areaA + 4) + '" text-anchor="end">0</text>');
        partes.push('<line class="eixo" x1="' + margem.esq + '" y1="' + (margem.topo + areaA) + '" x2="' + (larg - margem.dir) + '" y2="' + (margem.topo + areaA) + '"/>');

        var puloRotulo = Math.ceil(dias.length / 16);
        dias.forEach(function (d, i) {
            var h = (contagem[d] / maximo) * areaA;
            var x = margem.esq + i * passo + (passo - largBarra) / 2;
            var y = margem.topo + areaA - h;
            partes.push('<path class="barra" d="' + caminho(x, y, largBarra, h) + '">' +
                '<title>' + esc(AFD.formatarDataBR(d) + ' (' + AFD.diaDaSemana(d) + '): ' + contagem[d] + ' marcação(ões)') + '</title></path>');
            if (mostrarValor) {
                partes.push('<text x="' + (x + largBarra / 2) + '" y="' + (y - 4) + '" text-anchor="middle">' + contagem[d] + '</text>');
            }
            if (i % puloRotulo === 0) {
                partes.push('<text x="' + (x + largBarra / 2) + '" y="' + (margem.topo + areaA + 14) + '" text-anchor="middle">' +
                    esc(d.slice(8, 10) + '/' + d.slice(5, 7)) + '</text>');
                partes.push('<text x="' + (x + largBarra / 2) + '" y="' + (margem.topo + areaA + 26) + '" text-anchor="middle" style="opacity:.7">' +
                    esc(AFD.diaDaSemana(d).slice(0, 3)) + '</text>');
            }
        });
        partes.push('</svg>');
        partes.push('<div class="legenda-grafico">Marcações registradas por dia — passe o cursor sobre a barra para ver o total. ' +
            'Dias sem nenhuma marcação não aparecem no eixo.</div>');
        return partes.join('');
    }

    /* ------------------------------------------------------------------ *
     * Conteudo das abas
     * ------------------------------------------------------------------ */

    function desenharConteudo() {
        var html = '';
        switch (estado.aba) {
        case 'resumo': html = abaResumo(); break;
        case 'marcacoes': html = barraFiltros({ datas: true, pessoas: true, tipos: true }) + '<div id="areaTabela"></div>'; break;
        case 'espelho': html = barraFiltros({ datas: true, pessoas: true }) + '<div id="areaTabela"></div>'; break;
        case 'pessoas': html = barraFiltros({ placeholder: 'Nome ou documento...' }) + '<div id="areaTabela"></div>'; break;
        case 'empresa': html = abaEmpresa(); break;
        case 'eventos': html = barraFiltros({ datas: true, exportar: true }) + '<div id="areaTabela"></div>'; break;
        case 'auditoria': html = barraFiltros({ niveis: true, placeholder: 'Mensagem, código, NSR...' }) + '<div id="areaTabela"></div>'; break;
        case 'arquivo': html = barraFiltros({ tipos: true, placeholder: 'Trecho da linha, NSR...' }) + '<div id="areaTabela"></div>'; break;
        }
        $('conteudo').innerHTML = html;
        desenharTabela();
    }

    function desenharTabela() {
        var area = $('areaTabela');
        if (!area) { return; }
        switch (estado.aba) {
        case 'marcacoes': area.innerHTML = tabelaMarcacoes(); break;
        case 'espelho': area.innerHTML = tabelaEspelho(); break;
        case 'pessoas': area.innerHTML = tabelaPessoas(); break;
        case 'eventos': area.innerHTML = tabelaEventos(); break;
        case 'auditoria': area.innerHTML = tabelaAuditoria(); break;
        case 'arquivo': area.innerHTML = tabelaArquivo(); break;
        }
    }

    /* ---------- resumo ---------- */

    function abaResumo() {
        var r = estado.resultado;
        var cab = r.cabecalho || {};
        var res = r.resumo;

        var contagens = Object.keys(AFD.TIPOS_ROTULO)
            .filter(function (t) { return res.contagens[t]; })
            .map(function (t) {
                return '<tr><td class="mono">' + t + '</td><td>' + esc(AFD.TIPOS_ROTULO[t]) + '</td>' +
                    '<td class="num">' + numeroBR(res.contagens[t]) + '</td></tr>';
            }).join('');

        var topo = r.pessoas.slice().sort(function (a, b) { return b.marcacoes - a.marcacoes; }).slice(0, 8)
            .map(function (p) {
                return '<tr><td>' + esc(p.nome || '(sem cadastro no arquivo)') + '</td>' +
                    '<td class="mono">' + esc(documento(p.identificador, p.tipoIdentificador)) + '</td>' +
                    '<td class="num">' + numeroBR(p.marcacoes) + '</td></tr>';
            }).join('');

        var divergePeriodo = res.periodoDeclarado.inicio && res.periodoReal.inicio &&
            (res.periodoReal.inicio < res.periodoDeclarado.inicio || res.periodoReal.fim > res.periodoDeclarado.fim);

        return '<div class="grade-resumo">' +
            '<div class="bloco"><h3><i class="fas fa-circle-info"></i> Identificação do arquivo</h3>' +
            '<dl class="lista-dados">' +
            item('Arquivo', estado.nomeArquivo || 'Conteúdo colado') +
            item('Tamanho', estado.tamanhoArquivo ? tamanhoLegivel(estado.tamanhoArquivo) : '—') +
            item('Codificação', estado.codificacao || '—') +
            item('Leiaute', r.layoutDescricao) +
            item('Empregador', cab.razaoSocial || '—') +
            item(cab.tipoDocumentoEmpregador || 'Documento',
                cab.identificadorEmpregador
                    ? AFD.formatarDocumento(cab.identificadorEmpregador, cab.tipoDocumentoEmpregador) +
                      (cab.documentoEmpregadorValido === false ? ' <span class="etiqueta erro">DV inválido</span>' : ' <span class="etiqueta ok">DV ok</span>')
                    : '—', true) +
            item('REP nº de fabricação', cab.numeroFabricacao || '—') +
            item('Período declarado', res.periodoDeclarado.inicio
                ? AFD.formatarDataBR(res.periodoDeclarado.inicio) + ' a ' + AFD.formatarDataBR(res.periodoDeclarado.fim) : '—') +
            item('Período com marcações', res.periodoReal.inicio
                ? AFD.formatarDataBR(res.periodoReal.inicio) + ' a ' + AFD.formatarDataBR(res.periodoReal.fim) +
                  (divergePeriodo ? ' <span class="etiqueta alerta">fora do declarado</span>' : '') : '—', true) +
            item('Geração', res.geracao.data ? dataHoraBR(res.geracao.data, res.geracao.hora) : '—') +
            '</dl></div>' +

            '<div class="bloco"><h3><i class="fas fa-layer-group"></i> Registros por tipo</h3>' +
            '<div class="rolagem"><table><thead><tr><th>Tipo</th><th>Descrição</th><th style="text-align:right">Qtde.</th></tr></thead>' +
            '<tbody>' + contagens + '</tbody></table></div>' +
            (r.trailer ? '<p class="legenda-grafico">Trailer do arquivo: ' +
                Object.keys(r.trailer.contagens).map(function (t) {
                    return 'tipo ' + t + ' = ' + numeroBR(r.trailer.contagens[t]);
                }).join(', ') + '.</p>' : '<p class="legenda-grafico">Arquivo sem registro trailer (tipo 9).</p>') +
            '</div>' +

            '<div class="bloco" style="grid-column:1/-1"><h3><i class="fas fa-chart-column"></i> Marcações por dia</h3>' +
            (graficoPorDia() || '<p class="legenda-grafico">Marcações concentradas em um único dia.</p>') +
            '</div>' +

            '<div class="bloco"><h3><i class="fas fa-user-clock"></i> Trabalhadores com mais marcações</h3>' +
            '<div class="rolagem"><table><thead><tr><th>Nome</th><th>Documento</th><th style="text-align:right">Marcações</th></tr></thead>' +
            '<tbody>' + (topo || '<tr><td colspan="3">Nenhuma marcação encontrada.</td></tr>') + '</tbody></table></div></div>' +

            '<div class="bloco"><h3><i class="fas fa-clipboard-check"></i> Auditoria</h3>' +
            '<dl class="lista-dados">' +
            item('Erros', '<span class="etiqueta ' + ((res.niveis.erro || 0) ? 'erro' : 'ok') + '">' + numeroBR(res.niveis.erro || 0) + '</span>', true) +
            item('Alertas', '<span class="etiqueta ' + ((res.niveis.alerta || 0) ? 'alerta' : 'ok') + '">' + numeroBR(res.niveis.alerta || 0) + '</span>', true) +
            item('Observações', '<span class="etiqueta info">' + numeroBR(res.niveis.info || 0) + '</span>', true) +
            '</dl>' +
            '<p class="legenda-grafico">Detalhes na aba <strong>Inconsistências</strong>. ' +
            'Erros indicam quebra de leiaute ou de integridade do AFD; alertas pedem conferência.</p>' +
            '</div>' +
            '</div>';
    }

    function item(rotulo, valor, cru) {
        return '<dt>' + esc(rotulo) + '</dt><dd>' + (cru ? valor : esc(valor)) + '</dd>';
    }

    /* ---------- marcacoes ---------- */

    function marcacoesFiltradas() {
        var f = estado.filtros;
        return estado.resultado.marcacoes.filter(function (m) {
            if (f.tipo && m.tipo !== f.tipo) { return false; }
            if (f.pessoa && m.chave !== f.pessoa) { return false; }
            if (!dentroDoPeriodo(m.data)) { return false; }
            return filtroTexto([m.nsr, m.identificador, m.data, m.hora, nomeDe(m.chave)]);
        });
    }

    function nomeDe(chave) {
        var p = estado.resultado.pessoas.filter(function (x) { return x.chave === chave; })[0];
        return p ? p.nome : '';
    }

    function mapaNomes() {
        if (!estado._mapaNomes) {
            estado._mapaNomes = {};
            estado.resultado.pessoas.forEach(function (p) { estado._mapaNomes[p.chave] = p.nome; });
        }
        return estado._mapaNomes;
    }

    function tabelaMarcacoes() {
        var nomes = mapaNomes();
        var colunas = [
            { titulo: 'NSR', classe: 'mono', valor: function (m) { return m.nsrNumero; }, celula: function (m) { return esc(m.nsr); } },
            { titulo: 'Tipo', valor: function (m) { return m.tipo; }, celula: function (m) {
                return '<span class="etiqueta neutra">' + m.tipo + ' · ' + (m.tipo === '7' ? 'REP-P' : (m.tipo === '8' ? 'anotada' : 'REP-C/A')) + '</span>';
            } },
            { titulo: 'Data', valor: function (m) { return m.data; }, celula: function (m) { return esc(AFD.formatarDataBR(m.data)); } },
            { titulo: 'Dia', celula: function (m) { return esc(AFD.diaDaSemana(m.data)); } },
            { titulo: 'Hora', classe: 'mono', valor: function (m) { return m.hora; }, celula: function (m) { return esc(m.hora); } },
            { titulo: 'Documento', classe: 'mono', valor: function (m) { return m.identificador; }, celula: function (m) {
                return esc(documento(m.identificador, m.tipoIdentificador)) +
                    (m.identificadorValido === false ? ' <span class="etiqueta erro">DV</span>' : '');
            } },
            { titulo: 'Trabalhador', valor: function (m) { return nomes[m.chave] || ''; }, celula: function (m) {
                return esc(nomes[m.chave] || '—');
            } },
            { titulo: 'Verificação', classe: 'mono', celula: function (m) {
                if (m.hash) { return '<span title="' + esc(m.hash) + '">hash ' + esc(m.hash.slice(0, 12)) + '…</span>'; }
                if (m.crc) { return 'CRC ' + esc(m.crc); }
                return '—';
            } },
            { titulo: 'Linha', classe: 'num', valor: function (m) { return m.numeroLinha; }, celula: function (m) {
                return '<button class="btn btn-icone" data-detalhe="' + m.numeroLinha + '" title="Ver campos do registro">' +
                    '<i class="fas fa-magnifying-glass"></i></button>';
            } }
        ];
        return tabela('marcacoes', colunas, marcacoesFiltradas(), { vazio: 'Nenhuma marcação para os filtros aplicados.' });
    }

    /* ---------- espelho ---------- */

    function espelhoFiltrado() {
        var f = estado.filtros;
        return estado.espelho.filter(function (e) {
            if (f.pessoa && e.chave !== f.pessoa) { return false; }
            if (!dentroDoPeriodo(e.data)) { return false; }
            return filtroTexto([e.nome, e.identificador, e.data]);
        });
    }

    function tabelaEspelho() {
        var colunas = [
            { titulo: 'Trabalhador', valor: function (e) { return e.nome || e.identificador; }, celula: function (e) { return esc(e.nome || '—'); } },
            { titulo: 'Documento', classe: 'mono', celula: function (e) { return esc(documento(e.identificador, e.tipoIdentificador)); } },
            { titulo: 'Data', valor: function (e) { return e.data; }, celula: function (e) { return esc(AFD.formatarDataBR(e.data)); } },
            { titulo: 'Dia', celula: function (e) { return esc(e.diaSemana); } },
            { titulo: 'Marcações', classe: 'mono', celula: function (e) {
                return e.horarios.map(function (h) { return esc(h.slice(0, 5)); }).join(' &nbsp; ');
            } },
            { titulo: 'Qtde.', classe: 'num', valor: function (e) { return e.quantidade; }, celula: function (e) { return numeroBR(e.quantidade); } },
            { titulo: 'Total trabalhado', classe: 'num mono', valor: function (e) { return e.totalMinutos; }, celula: function (e) { return esc(e.total); } },
            { titulo: 'Situação', celula: function (e) {
                return e.impar
                    ? '<span class="etiqueta alerta">marcação ímpar</span>'
                    : '<span class="etiqueta ok">pares completos</span>';
            } }
        ];
        return tabela('espelho', colunas, espelhoFiltrado(), {
            vazio: 'Nenhum dia de marcação para os filtros aplicados.'
        });
    }

    /* ---------- pessoas ---------- */

    function pessoasFiltradas() {
        return estado.resultado.pessoas.filter(function (p) {
            return filtroTexto([p.nome, p.identificador]);
        });
    }

    function tabelaPessoas() {
        var colunas = [
            { titulo: 'Nome', valor: function (p) { return p.nome || ''; }, celula: function (p) { return esc(p.nome || '(sem cadastro no arquivo)'); } },
            { titulo: 'Documento', classe: 'mono', valor: function (p) { return p.identificador; }, celula: function (p) { return esc(documento(p.identificador, p.tipoIdentificador)); } },
            { titulo: 'Tipo', celula: function (p) { return esc(p.tipoIdentificador || '—'); } },
            { titulo: 'Cadastro (tipo 5)', celula: function (p) {
                return p.cadastrado ? '<span class="etiqueta ok">presente</span>' : '<span class="etiqueta alerta">ausente</span>';
            } },
            { titulo: 'Marcações', classe: 'num', valor: function (p) { return p.marcacoes; }, celula: function (p) { return numeroBR(p.marcacoes); } },
            { titulo: 'Primeira', celula: function (p) { return esc(p.primeira ? dataHoraBR(p.primeira.slice(0, 10), p.primeira.slice(11)) : '—'); } },
            { titulo: 'Última', celula: function (p) { return esc(p.ultima ? dataHoraBR(p.ultima.slice(0, 10), p.ultima.slice(11)) : '—'); } }
        ];
        return tabela('pessoas', colunas, pessoasFiltradas(), { vazio: 'Nenhum trabalhador encontrado.' });
    }

    /* ---------- empresa ---------- */

    function abaEmpresa() {
        var r = estado.resultado;
        var cab = r.cabecalho;
        if (!cab) {
            return '<div class="vazio"><i class="fas fa-inbox"></i>Arquivo sem registro de cabeçalho (tipo 1).</div>';
        }
        var linhas = r.empregadores.map(function (e) {
            return '<tr><td class="mono">' + esc(e.nsr) + '</td>' +
                '<td>' + esc(dataHoraBR(e.data, e.hora)) + '</td>' +
                '<td class="mono">' + esc(AFD.formatarDocumento(e.identificadorEmpregador, e.tipoDocumentoEmpregador)) + '</td>' +
                '<td>' + esc(e.razaoSocial) + '</td>' +
                '<td>' + esc(e.localPrestacao || '—') + '</td></tr>';
        }).join('');

        return '<div class="grade-resumo">' +
            '<div class="bloco"><h3><i class="fas fa-building"></i> Cabeçalho do arquivo</h3><dl class="lista-dados">' +
            item('Razão social', cab.razaoSocial || '—') +
            item(cab.tipoDocumentoEmpregador || 'Documento',
                AFD.formatarDocumento(cab.identificadorEmpregador, cab.tipoDocumentoEmpregador) +
                (cab.documentoEmpregadorValido === false ? ' <span class="etiqueta erro">DV inválido</span>' : ' <span class="etiqueta ok">DV ok</span>'), true) +
            item(r.layout === '671' ? 'CNO/CAEPF' : 'CEI', cab.cei || '—') +
            item('Nº de fabricação do REP', cab.numeroFabricacao || '—') +
            item('Data inicial', AFD.formatarDataBR(cab.dataInicial) || '—') +
            item('Data final', AFD.formatarDataBR(cab.dataFinal) || '—') +
            item('Geração', dataHoraBR(cab.dataGeracao, cab.horaGeracao) || '—') +
            (cab.complemento ? item('Complemento', cab.complemento) : '') +
            '</dl>' +
            '<button class="btn" data-detalhe="' + cab.numeroLinha + '" style="margin-top:12px">' +
            '<i class="fas fa-magnifying-glass"></i> Ver campos e posições</button>' +
            '</div>' +

            '<div class="bloco" style="grid-column:1/-1"><h3><i class="fas fa-clipboard-list"></i> Registros de empregador (tipo 2)</h3>' +
            (linhas
                ? '<div class="rolagem"><table><thead><tr><th>NSR</th><th>Data/hora</th><th>Documento</th><th>Razão social</th><th>Local de prestação</th></tr></thead><tbody>' + linhas + '</tbody></table></div>'
                : '<p class="legenda-grafico">Nenhum registro tipo 2 no arquivo.</p>') +
            '</div></div>';
    }

    /* ---------- relogio e eventos ---------- */

    function eventosFiltrados() {
        var r = estado.resultado;
        var lista = [];
        r.ajustes.forEach(function (a) {
            lista.push({
                nsr: a.nsr, nsrNumero: a.nsrNumero, numeroLinha: a.numeroLinha,
                tipo: '4', descricao: 'Ajuste do relógio',
                data: a.dataAntes, hora: a.horaAntes,
                detalhe: 'De ' + dataHoraBR(a.dataAntes, a.horaAntes) + ' para ' + dataHoraBR(a.dataDepois, a.horaDepois)
            });
        });
        r.eventos.forEach(function (e) {
            lista.push({
                nsr: e.nsr, nsrNumero: e.nsrNumero, numeroLinha: e.numeroLinha,
                tipo: e.tipo,
                descricao: AFD.TIPOS_ROTULO[e.tipo] || 'Evento',
                data: e.data, hora: e.hora,
                detalhe: e.evento || e.complemento || (e.identificador ? documento(e.identificador, e.tipoIdentificador) : '')
            });
        });
        lista.sort(function (a, b) { return a.nsrNumero - b.nsrNumero; });
        return lista.filter(function (e) {
            if (!dentroDoPeriodo(e.data)) { return false; }
            return filtroTexto([e.nsr, e.descricao, e.detalhe, e.data]);
        });
    }

    function tabelaEventos() {
        var colunas = [
            { titulo: 'NSR', classe: 'mono', valor: function (e) { return e.nsrNumero; }, celula: function (e) { return esc(e.nsr); } },
            { titulo: 'Tipo', celula: function (e) { return '<span class="etiqueta neutra">' + e.tipo + '</span>'; } },
            { titulo: 'Evento', valor: function (e) { return e.descricao; }, celula: function (e) { return esc(e.descricao); } },
            { titulo: 'Data/hora', valor: function (e) { return e.data + e.hora; }, celula: function (e) { return esc(dataHoraBR(e.data, e.hora)); } },
            { titulo: 'Detalhe', celula: function (e) { return esc(e.detalhe || '—'); } },
            { titulo: 'Linha', classe: 'num', celula: function (e) {
                return '<button class="btn btn-icone" data-detalhe="' + e.numeroLinha + '"><i class="fas fa-magnifying-glass"></i></button>';
            } }
        ];
        return tabela('eventos', colunas, eventosFiltrados(), {
            vazio: 'Nenhum ajuste de relógio ou evento sensível registrado no arquivo.'
        });
    }

    /* ---------- auditoria ---------- */

    function auditoriaFiltrada() {
        var f = estado.filtros;
        return estado.resultado.inconsistencias.filter(function (i) {
            if (f.nivel && i.nivel !== f.nivel) { return false; }
            return filtroTexto([i.codigo, i.mensagem, i.detalhe, i.nsr, String(i.linha)]);
        });
    }

    function tabelaAuditoria() {
        var colunas = [
            { titulo: 'Gravidade', valor: function (i) { return i.nivel; }, celula: function (i) {
                var rot = { erro: 'Erro', alerta: 'Alerta', info: 'Observação' }[i.nivel];
                return '<span class="etiqueta ' + i.nivel + '">' + rot + '</span>';
            } },
            { titulo: 'Código', classe: 'mono', valor: function (i) { return i.codigo; }, celula: function (i) { return esc(i.codigo); } },
            { titulo: 'Linha', classe: 'num', valor: function (i) { return i.linha; }, celula: function (i) {
                return i.linha ? '<button class="btn btn-icone" data-detalhe="' + i.linha + '">' + numeroBR(i.linha) + '</button>' : '—';
            } },
            { titulo: 'NSR', classe: 'mono', celula: function (i) { return esc(i.nsr || '—'); } },
            { titulo: 'Ocorrência', celula: function (i) { return esc(i.mensagem); } },
            { titulo: 'Detalhe', classe: 'mono', celula: function (i) { return esc(i.detalhe || '—'); } }
        ];
        return tabela('auditoria', colunas, auditoriaFiltrada(), {
            vazio: 'Nenhuma inconsistência encontrada. O arquivo passou em todas as verificações.'
        });
    }

    /* ---------- arquivo bruto ---------- */

    function registrosFiltrados() {
        var f = estado.filtros;
        return estado.resultado.registros.filter(function (r) {
            if (f.tipo && r.tipo !== f.tipo) { return false; }
            return filtroTexto([r.nsr, r.linha]);
        });
    }

    function tabelaArquivo() {
        var colunas = [
            { titulo: 'Linha', classe: 'num', valor: function (r) { return r.numeroLinha; }, celula: function (r) { return numeroBR(r.numeroLinha); } },
            { titulo: 'NSR', classe: 'mono', celula: function (r) { return esc(r.nsr || '—'); } },
            { titulo: 'Tipo', celula: function (r) { return '<span class="etiqueta neutra">' + esc(r.tipo) + ' · ' + esc(r.tipoDescricao || '') + '</span>'; } },
            { titulo: 'Tam.', classe: 'num', valor: function (r) { return r.tamanho; }, celula: function (r) { return numeroBR(r.tamanho); } },
            { titulo: 'Conteúdo', classe: 'mono', celula: function (r) {
                var t = r.linha.length > 110 ? r.linha.slice(0, 110) + '…' : r.linha;
                return '<span class="clicavel" data-detalhe="' + r.numeroLinha + '">' + esc(t) + '</span>';
            } }
        ];
        return tabela('arquivo', colunas, registrosFiltrados(), { vazio: 'Nenhuma linha para os filtros aplicados.' });
    }

    /* ------------------------------------------------------------------ *
     * Detalhe do registro (campos e posicoes)
     * ------------------------------------------------------------------ */

    function abrirDetalhe(numeroLinha) {
        var r = estado.registrosPorLinha[numeroLinha];
        if (!r) { return; }

        var campos = (r.campos || []).map(function (c) {
            return '<tr><td>' + esc(c.nome) + '</td>' +
                '<td class="mono num">' + c.inicio + '–' + c.fim + '</td>' +
                '<td class="mono">' + (esc(c.valor) || '<span style="opacity:.5">(vazio)</span>') + '</td></tr>';
        }).join('');

        var trailer = r.tipo === '9' && r.contagens
            ? Object.keys(r.contagens).map(function (t) {
                return '<tr><td>Registros do tipo ' + t + '</td><td class="mono num">—</td>' +
                    '<td class="mono">' + numeroBR(r.contagens[t]) + '</td></tr>';
            }).join('')
            : '';

        $('modalTitulo').textContent = 'Linha ' + numeroBR(r.numeroLinha) + ' — tipo ' + r.tipo +
            ' (' + (r.tipoDescricao || '') + ')';
        $('modalCorpo').innerHTML =
            '<div class="linha-bruta">' + esc(r.linha) + '</div>' +
            '<div class="rolagem"><table><thead><tr><th>Campo</th><th>Posição</th><th>Conteúdo</th></tr></thead>' +
            '<tbody>' + (campos + trailer || '<tr><td colspan="3">Registro sem campos reconhecidos.</td></tr>') +
            '</tbody></table></div>' +
            '<p class="legenda-grafico">Posições contadas a partir de 1, como nos anexos das portarias. ' +
            'Tamanho da linha: ' + numeroBR(r.tamanho) + ' caracteres' +
            (r.tamanhoEsperado ? ' (esperado ' + r.tamanhoEsperado + ')' : '') + '.</p>';
        $('modalFundo').classList.add('aberto');
    }

    function fecharModal() { $('modalFundo').classList.remove('aberto'); }

    /* ------------------------------------------------------------------ *
     * Exportacao
     * ------------------------------------------------------------------ */

    function dadosExportacao() {
        var nomes = mapaNomes();
        switch (estado.aba) {
        case 'marcacoes':
            return {
                nome: 'marcacoes',
                cabecalho: ['NSR', 'Tipo', 'Data', 'Dia da semana', 'Hora', 'Documento', 'Tipo do documento', 'Trabalhador', 'Verificacao', 'Linha'],
                linhas: marcacoesFiltradas().map(function (m) {
                    return [m.nsr, m.tipo, AFD.formatarDataBR(m.data), AFD.diaDaSemana(m.data), m.hora,
                        documento(m.identificador, m.tipoIdentificador), m.tipoIdentificador,
                        nomes[m.chave] || '', m.hash || m.crc || '', m.numeroLinha];
                })
            };
        case 'espelho':
            return {
                nome: 'espelho_de_ponto',
                cabecalho: ['Trabalhador', 'Documento', 'Data', 'Dia da semana', 'Marcacoes', 'Qtde', 'Total trabalhado', 'Situacao'],
                linhas: espelhoFiltrado().map(function (e) {
                    return [e.nome, documento(e.identificador, e.tipoIdentificador), AFD.formatarDataBR(e.data),
                        e.diaSemana, e.horarios.map(function (h) { return h.slice(0, 5); }).join(' '),
                        e.quantidade, e.total, e.impar ? 'Marcacao impar' : 'Pares completos'];
                })
            };
        case 'pessoas':
            return {
                nome: 'trabalhadores',
                cabecalho: ['Nome', 'Documento', 'Tipo', 'Cadastro tipo 5', 'Marcacoes', 'Primeira', 'Ultima'],
                linhas: pessoasFiltradas().map(function (p) {
                    return [p.nome, documento(p.identificador, p.tipoIdentificador), p.tipoIdentificador,
                        p.cadastrado ? 'presente' : 'ausente', p.marcacoes, p.primeira, p.ultima];
                })
            };
        case 'eventos':
            return {
                nome: 'eventos',
                cabecalho: ['NSR', 'Tipo', 'Evento', 'Data/hora', 'Detalhe'],
                linhas: eventosFiltrados().map(function (e) {
                    return [e.nsr, e.tipo, e.descricao, dataHoraBR(e.data, e.hora), e.detalhe];
                })
            };
        case 'auditoria':
            return {
                nome: 'inconsistencias',
                cabecalho: ['Gravidade', 'Codigo', 'Linha', 'NSR', 'Ocorrencia', 'Detalhe'],
                linhas: auditoriaFiltrada().map(function (i) {
                    return [i.nivel, i.codigo, i.linha, i.nsr, i.mensagem, i.detalhe];
                })
            };
        case 'arquivo':
            return {
                nome: 'linhas',
                cabecalho: ['Linha', 'NSR', 'Tipo', 'Tamanho', 'Conteudo'],
                linhas: registrosFiltrados().map(function (r) {
                    return [r.numeroLinha, r.nsr, r.tipo, r.tamanho, r.linha];
                })
            };
        default:
            return null;
        }
    }

    function montarCSV(dados) {
        function campo(v) {
            var s = String(v == null ? '' : v);
            return '"' + s.replace(/"/g, '""') + '"';
        }
        return [dados.cabecalho].concat(dados.linhas)
            .map(function (l) { return l.map(campo).join(';'); })
            .join('\r\n');
    }

    function baixarCSV() {
        var dados = dadosExportacao();
        if (!dados || !dados.linhas.length) { return; }
        var conteudo = '﻿' + montarCSV(dados);
        var blob = new Blob([conteudo], { type: 'text/csv;charset=utf-8;' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        var base = (estado.nomeArquivo || 'afd').replace(/\.[^.]+$/, '');
        a.href = url;
        a.download = base + '_' + dados.nome + '.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    }

    function copiarTabela(botao) {
        var dados = dadosExportacao();
        if (!dados) { return; }
        var texto = [dados.cabecalho].concat(dados.linhas)
            .map(function (l) { return l.join('\t'); }).join('\n');

        function aviso(ok) {
            botao.innerHTML = ok
                ? '<i class="fas fa-check"></i> Copiado'
                : '<i class="fas fa-xmark"></i> Falhou';
            setTimeout(function () { botao.innerHTML = '<i class="fas fa-copy"></i> Copiar'; }, 1800);
        }

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(texto).then(function () { aviso(true); }, function () { aviso(false); });
            return;
        }
        var ta = document.createElement('textarea');
        ta.value = texto;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        var ok = false;
        try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
        document.body.removeChild(ta);
        aviso(ok);
    }

    /* ------------------------------------------------------------------ *
     * Arquivos de demonstracao (gerados na hora, dados ficticios)
     * ------------------------------------------------------------------ */

    function gerarDemonstracao(layout) {
        function num(v, tam) {
            var s = String(v).replace(/\D/g, '');
            while (s.length < tam) { s = '0' + s; }
            return s.slice(-tam);
        }
        function txt(v, tam) {
            var s = String(v || '');
            return s.length > tam ? s.slice(0, tam) : s + new Array(tam - s.length + 1).join(' ');
        }
        function crc16(t) {
            var crc = 0xFFFF;
            for (var i = 0; i < t.length; i++) {
                crc ^= (t.charCodeAt(i) & 0xFF) << 8;
                for (var b = 0; b < 8; b++) {
                    crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xFFFF : (crc << 1) & 0xFFFF;
                }
            }
            return ('000' + crc.toString(16).toUpperCase()).slice(-4);
        }
        function pseudoHash(t) {
            var saida = '';
            var h = 2166136261;
            for (var i = 0; i < 8; i++) {
                for (var j = 0; j < t.length; j++) {
                    h ^= t.charCodeAt(j) + i;
                    h = (h * 16777619) >>> 0;
                }
                saida += ('0000000' + h.toString(16).toUpperCase()).slice(-8);
            }
            return saida;
        }
        function ddmmaaaa(iso) { return iso.slice(8, 10) + iso.slice(5, 7) + iso.slice(0, 4); }

        var empresa = { cnpj: '12345678000195', razao: 'AHTOOLS SERVICOS EMPRESARIAIS LTDA', local: 'AV BRASIL, 1500 - CENTRO - BELO HORIZONTE/MG', rep: 'REPP0000000000123' };
        var pessoas = [
            { nome: 'ANA PAULA RODRIGUES SOUZA', cpf: '11144477735', pis: '012065478502' },
            { nome: 'CARLOS EDUARDO MARTINS', cpf: '52998224725', pis: '020987654327' },
            { nome: 'FERNANDA LIMA DE OLIVEIRA', cpf: '39053344705', pis: '012345678900' }
        ];
        var dias = ['2026-08-03', '2026-08-04', '2026-08-05'];
        var batidas = [['07:58', '12:03', '13:01', '17:05'], ['08:01', '12:00', '13:04', '17:02'], ['07:55', '11:58', '12:58', '18:10']];

        var eventos = [];
        dias.forEach(function (dia, iDia) {
            pessoas.forEach(function (p, iP) {
                batidas[iP].forEach(function (hora, iH) {
                    var min = Number(hora.slice(3)) + ((iDia + iH) % 3);
                    var h = hora.slice(0, 2);
                    if (min > 59) { min -= 60; h = num(Number(h) + 1, 2); }
                    eventos.push({ tipo: '3', data: dia, hora: h + ':' + num(min, 2), pessoa: p, indice: iP });
                });
            });
            if (iDia === 1) { eventos.push({ tipo: '4', data: dia, hora: '20:00', indice: -1 }); }
        });
        eventos.sort(function (a, b) {
            var ca = a.data + a.hora, cb = b.data + b.hora;
            return ca < cb ? -1 : (ca > cb ? 1 : 0);
        });

        var linhas = [];
        var nsr = 0;
        var cont = { '2': 0, '3': 0, '4': 0, '5': 0, '6': 0, '7': 0 };

        function guardar(linha) {
            linhas.push(linha);
            var t = linha.charAt(9);
            if (cont[t] !== undefined) { cont[t] += 1; }
        }

        if (layout === '671') {
            var iso = function (d, h) { return d + 'T' + h + ':00-0300'; };
            linhas.push(num(0, 9) + '1' + '1' + num(empresa.cnpj, 14) + num('', 14) +
                txt(empresa.razao, 150) + txt(empresa.rep, 17) +
                dias[0] + dias[dias.length - 1] + iso('2026-08-28', '19:30') + '003');
            nsr += 1;
            guardar(num(nsr, 9) + '2' + iso(dias[0], '07:00') + '1' + num(empresa.cnpj, 14) + num('', 14) +
                txt(empresa.razao, 150) + txt(empresa.local, 100));
            pessoas.forEach(function (p) {
                nsr += 1;
                var corpo = num(nsr, 9) + '5' + iso(dias[0], '07:05') + 'I' + num(p.cpf, 11) + txt(p.nome, 52);
                guardar(corpo + crc16(corpo));
            });
            nsr += 1;
            guardar(num(nsr, 9) + '6' + iso(dias[0], '06:55') + 'Interrupcao no fornecimento de energia eletrica');
            eventos.forEach(function (e) {
                nsr += 1;
                if (e.tipo === '4') {
                    var c4 = num(nsr, 9) + '4' + iso(e.data, '20:00') + iso(e.data, '19:58');
                    guardar(c4 + crc16(c4));
                    return;
                }
                var marcada = iso(e.data, e.hora);
                if (e.indice % 2 === 0) {
                    var c3 = num(nsr, 9) + '3' + marcada + num(e.pessoa.cpf, 11);
                    guardar(c3 + crc16(c3));
                } else {
                    var c7 = num(nsr, 9) + '7' + marcada + num(e.pessoa.cpf, 11) + marcada + 'O';
                    guardar(c7 + pseudoHash(c7));
                }
            });
            linhas.push(num(cont['2'], 9) + num(cont['3'], 9) + num(cont['4'], 9) +
                num(cont['5'], 9) + num(cont['6'], 9) + num(cont['7'], 9) + '9');
        } else {
            linhas.push(num(0, 9) + '1' + '1' + num(empresa.cnpj, 14) + num('', 12) +
                txt(empresa.razao, 150) + txt(empresa.rep, 17) +
                ddmmaaaa(dias[0]) + ddmmaaaa(dias[dias.length - 1]) + ddmmaaaa('2026-08-28') + '1930');
            nsr += 1;
            guardar(num(nsr, 9) + '2' + ddmmaaaa(dias[0]) + '0700' + '1' + num(empresa.cnpj, 14) + num('', 12) +
                txt(empresa.razao, 150) + txt(empresa.local, 100));
            pessoas.forEach(function (p) {
                nsr += 1;
                guardar(num(nsr, 9) + '5' + ddmmaaaa(dias[0]) + '0705' + 'I' + num(p.pis, 12) + txt(p.nome, 52));
            });
            eventos.forEach(function (e) {
                nsr += 1;
                if (e.tipo === '4') {
                    guardar(num(nsr, 9) + '4' + ddmmaaaa(e.data) + '2000' + ddmmaaaa(e.data) + '1958');
                } else {
                    guardar(num(nsr, 9) + '3' + ddmmaaaa(e.data) + e.hora.replace(':', '') + num(e.pessoa.pis, 12));
                }
            });
            linhas.push(num(cont['2'], 9) + num(cont['3'], 9) + num(cont['4'], 9) + num(cont['5'], 9) + '9');
        }
        return linhas.join('\r\n') + '\r\n';
    }

    function carregarDemo(layout) {
        estado.nomeArquivo = 'exemplo_' + layout + '.txt';
        estado.codificacao = 'ASCII';
        var texto = gerarDemonstracao(layout);
        estado.tamanhoArquivo = texto.length;
        mostrarAviso('');
        analisar(texto);
    }

    /* ------------------------------------------------------------------ *
     * Eventos da interface
     * ------------------------------------------------------------------ */

    function ligarEventos() {
        var zona = $('zonaArquivo');
        var entrada = $('entradaArquivo');

        zona.addEventListener('click', function () { entrada.click(); });
        zona.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); entrada.click(); }
        });
        entrada.addEventListener('change', function () {
            if (entrada.files && entrada.files[0]) { carregarArquivo(entrada.files[0]); }
            entrada.value = '';
        });

        ['dragenter', 'dragover'].forEach(function (ev) {
            zona.addEventListener(ev, function (e) { e.preventDefault(); zona.classList.add('ativa'); });
        });
        ['dragleave', 'drop'].forEach(function (ev) {
            zona.addEventListener(ev, function (e) { e.preventDefault(); zona.classList.remove('ativa'); });
        });
        zona.addEventListener('drop', function (e) {
            if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
                carregarArquivo(e.dataTransfer.files[0]);
            }
        });

        $('btnColar').addEventListener('click', function () {
            var area = $('areaColar');
            var visivel = area.style.display === 'block';
            area.style.display = visivel ? 'none' : 'block';
            if (!visivel) { $('textoColado').focus(); }
        });
        $('btnLerColado').addEventListener('click', function () {
            estado.nomeArquivo = '';
            estado.codificacao = 'texto colado';
            var t = $('textoColado').value;
            estado.tamanhoArquivo = t.length;
            analisar(t);
        });
        $('btnDemo1510').addEventListener('click', function () { carregarDemo('1510'); });
        $('btnDemo671').addEventListener('click', function () { carregarDemo('671'); });

        $('abas').addEventListener('click', function (e) {
            var botao = e.target.closest('[data-aba]');
            if (!botao) { return; }
            estado.aba = botao.getAttribute('data-aba');
            desenharAbas();
            desenharConteudo();
        });

        var buscarComAtraso = debounce(function () {
            estado.pagina[estado.aba] = 1;
            desenharTabela();
        }, 180);

        $('conteudo').addEventListener('input', function (e) {
            var alvo = e.target;
            if (alvo.id === 'fBusca') { estado.filtros.busca = alvo.value; buscarComAtraso(); }
        });

        $('conteudo').addEventListener('change', function (e) {
            var alvo = e.target;
            var mapa = { fDataIni: 'dataIni', fDataFim: 'dataFim', fPessoa: 'pessoa', fTipo: 'tipo', fNivel: 'nivel' };
            if (mapa[alvo.id]) {
                estado.filtros[mapa[alvo.id]] = alvo.value;
                estado.pagina[estado.aba] = 1;
                desenharTabela();
            } else if (alvo.id === 'fMascarar') {
                estado.mascarar = alvo.checked;
                desenharConteudo();
            }
        });

        $('conteudo').addEventListener('click', function (e) {
            var detalhe = e.target.closest('[data-detalhe]');
            if (detalhe) { abrirDetalhe(Number(detalhe.getAttribute('data-detalhe'))); return; }

            var pagina = e.target.closest('[data-pagina]');
            if (pagina && !pagina.disabled) {
                estado.pagina[estado.aba] = Number(pagina.getAttribute('data-pagina'));
                desenharTabela();
                return;
            }

            var ordenar = e.target.closest('[data-ordenar]');
            if (ordenar) {
                var indice = Number(ordenar.getAttribute('data-ordenar'));
                var atual = estado.ordem[estado.aba];
                estado.ordem[estado.aba] = (atual && atual.indice === indice)
                    ? { indice: indice, desc: !atual.desc }
                    : { indice: indice, desc: false };
                desenharTabela();
                return;
            }

            if (e.target.closest('#btnCsv')) { baixarCSV(); return; }
            var copiar = e.target.closest('#btnCopiar');
            if (copiar) { copiarTabela(copiar); }
        });

        $('btnFecharModal').addEventListener('click', fecharModal);
        $('modalFundo').addEventListener('click', function (e) {
            if (e.target === $('modalFundo')) { fecharModal(); }
        });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') { fecharModal(); }
        });
    }

    /* ------------------------------------------------------------------ */

    iniciarTema();
    ligarEventos();
}());
