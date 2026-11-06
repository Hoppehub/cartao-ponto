/*!
 * Leitor de AFD - interface
 * Depende de js/afd_parser.js (window.AFD). Tudo roda no navegador.
 */
(function () {
    'use strict';

    var LOTE = 4000;             /* linhas processadas por ciclo */
    var POR_PAGINA = 200;        /* linhas por pagina nas tabelas */
    var POR_PAGINA_CARTOES = 12; /* trabalhadores por pagina na visao em cartoes */

    var estado = {
        resultado: null,
        espelho: [],
        /* Sobe a cada novo espelho; invalida os caches de nomes e de filtro. */
        versaoEspelho: 0,
        _mapaNomes: null,
        registrosPorLinha: {},
        aba: 'resumo',
        modo: 'espelho',
        pagina: {},
        ordem: {},
        mascarar: false,
        visaoEspelho: 'cartoes',
        escalaTipo: 'sem44_9h_sex8h',
        faltas: 'trabalhador',
        jornadaMinutos: 480,
        escalaCustom: [0, 540, 540, 540, 540, 480, 0],
        nomesPadrao: null,
        nomesArquivo: null,
        nomesInfo: null,
        nomeArquivo: '',
        codificacao: '',
        tamanhoArquivo: 0,
        filtros: { busca: '', dataIni: '', dataFim: '', pessoa: '', empresa: '', tipo: '', nivel: '' },
        /* documento -> empresa, para separar quem trabalha em cada empresa do mesmo relogio */
        empresasLista: null,
        /* carga em andamento e quem espera por ela (API LeitorAFD.carregar) */
        carga: 0,
        esperas: {},
        hashArquivo: '',
        empresasCnpj: {},
        versaoEmpresas: 0
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

    function horaDeMinutos(min) {
        var t = Math.max(0, Math.round(min || 0));
        return ('0' + Math.floor(t / 60)).slice(-2) + ':' + ('0' + (t % 60)).slice(-2);
    }

    function minutosDeHora(texto) {
        var m = /^(\d{1,2}):(\d{2})/.exec(String(texto || ''));
        if (!m) { return null; }
        return Number(m[1]) * 60 + Number(m[2]);
    }

    var DIAS_CURTOS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

    function escalaEmVigor() {
        if (estado.escalaTipo === 'diaria') {
            var m = estado.jornadaMinutos;
            return [0, m, m, m, m, m, 0];
        }
        if (estado.escalaTipo === 'custom') { return estado.escalaCustom.slice(); }
        var pronta = AFD.ESCALAS[estado.escalaTipo];
        return pronta ? pronta.dias.slice() : AFD.ESCALAS.sem44_9h_sex8h.dias.slice();
    }

    /* horarios previstos de cada batida (so a escala pronta que os tem); base da HORA FECHADA */
    function horariosEmVigor() {
        var pronta = AFD.ESCALAS[estado.escalaTipo];
        return pronta && pronta.horarios ? pronta.horarios : null;
    }

    function feriadosLocais() { return window.LEITOR_AFD_FERIADOS_LOCAIS || null; }

    function opcoesSaldo() {
        return { escala: escalaEmVigor(), horarios: horariosEmVigor(), calendario: true, feriadosLocais: feriadosLocais() };
    }

    /* dias com ajuste do relogio (tipo 4): o pareamento pode ter trocado */
    function datasDeAjuste(resultado) {
        var datas = {};
        (resultado.ajustes || []).forEach(function (a) {
            if (a.dataAntes) { datas[a.dataAntes] = true; }
            if (a.dataDepois) { datas[a.dataDepois] = true; }
        });
        return datas;
    }

    function montarEspelhoAtual() {
        var r = estado.resultado;
        return AFD.montarEspelho(r.marcacoes, r.pessoas, { datasAjuste: datasDeAjuste(r) });
    }

    function classeSaldo(minutos) {
        if (minutos > 0) { return 'positivo'; }
        if (minutos < 0) { return 'negativo'; }
        return 'neutro';
    }

    function saldoHTML(minutos) {
        return '<span class="' + classeSaldo(minutos) + '">' + esc(AFD.formatarSaldo(minutos)) + '</span>';
    }

    /* HORA FECHADA de um dia: valor, ou "—" quando o dia esta PARA CONFERIR ou a escala nao tem horarios */
    function fechadaDiaHTML(d) {
        if (d.saldoFechado == null) {
            var motivo = d.statusSaldo === 'pendente' ? 'Dia para conferir: fora da soma da hora fechada'
                : 'A escala escolhida não tem horários previstos por batida';
            return '<span class="neutro" title="' + esc(motivo) + '">—</span>';
        }
        return saldoHTML(d.saldoFechado);
    }

    /* soma da HORA FECHADA de um periodo, com os dias que ficaram de fora */
    function fechadaTotalHTML(b) {
        var fora = [];
        if (b.pendentes) { fora.push(numeroBR(b.pendentes) + ' para conferir'); }
        if (b.semFechada) { fora.push(numeroBR(b.semFechada) + ' sem horário previsto'); }
        return saldoHTML(b.saldoFechado || 0) + (fora.length ? ' <small class="fora-soma">(' + esc(fora.join(', ')) + ' fora da soma)</small>' : '');
    }

    /* tarja do calendario na faixa do dia */
    function tarjaCalendario(d) {
        if (!d.calendario) { return ''; }
        var feriado = d.calendario.tipo === 'feriado';
        return '<span class="tarja-cal ' + (feriado ? 'feriado' : 'facultativo') + '">' +
            (feriado ? 'FERIADO' : 'PONTO FACULTATIVO') + ' · ' + esc(d.calendario.nome) + '</span>';
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

    /* Sem escolha explicita, quem manda e a pagina que hospeda ou o sistema:
       o atributo so e carimbado quando o visitante troca o tema. */
    function temaEfetivo() {
        var atual = document.documentElement.getAttribute('data-theme');
        if (atual === 'dark' || atual === 'light') { return atual; }
        return (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) ? 'light' : 'dark';
    }

    function atualizarIconeTema() {
        var i = $('btnTema').querySelector('i');
        i.className = temaEfetivo() === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    }

    function aplicarTema(tema) {
        document.documentElement.setAttribute('data-theme', tema);
        try { localStorage.setItem('leitor-afd-tema', tema); } catch (e) { /* modo privado */ }
        atualizarIconeTema();
    }

    function iniciarTema() {
        var salvo = null;
        try { salvo = localStorage.getItem('leitor-afd-tema'); } catch (e) { /* ignora */ }
        if (salvo === 'dark' || salvo === 'light') {
            document.documentElement.setAttribute('data-theme', salvo);
        }
        atualizarIconeTema();
        $('btnTema').addEventListener('click', function () {
            aplicarTema(temaEfetivo() === 'dark' ? 'light' : 'dark');
        });
        if (window.matchMedia) {
            var mq = window.matchMedia('(prefers-color-scheme: light)');
            var aoTrocarSistema = function () {
                if (!document.documentElement.hasAttribute('data-theme')) { atualizarIconeTema(); }
            };
            if (mq.addEventListener) { mq.addEventListener('change', aoTrocarSistema); }
        }
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

    /*
     * Cada carga recebe um numero; so a ultima pode terminar e desenhar a tela.
     * Assim um arquivo grande escolhido antes nao sobrescreve o que veio depois.
     */
    function novaCarga() {
        estado.carga = (estado.carga || 0) + 1;
        Object.keys(estado.esperas).forEach(function (k) {
            if (Number(k) < estado.carga) {
                estado.esperas[k].reject(new Error('Carga substituída por outra mais recente.'));
                delete estado.esperas[k];
            }
        });
        return estado.carga;
    }

    function carregarArquivo(arquivo) {
        if (!arquivo) { return; }
        var carga = novaCarga();
        mostrarAviso('');
        var leitor = new FileReader();
        leitor.onerror = function () {
            if (carga === estado.carga) { mostrarAviso('Não foi possível ler o arquivo selecionado.'); }
        };
        leitor.onload = function () {
            if (carga !== estado.carga) { return; }
            estado.nomeArquivo = arquivo.name;
            estado.tamanhoArquivo = arquivo.size;
            estado.hashArquivo = AFD.sha256(new Uint8Array(leitor.result));
            var d = decodificar(leitor.result);
            estado.codificacao = d.codificacao;
            analisar(d.texto, carga);
        };
        leitor.readAsArrayBuffer(arquivo);
    }

    function analisar(texto, carga) {
        carga = carga || novaCarga();
        if (!texto || !texto.trim()) {
            mostrarAviso('O conteúdo informado está vazio.');
            if (estado.esperas[carga]) {
                estado.esperas[carga].reject(new Error('O conteúdo informado está vazio.'));
                delete estado.esperas[carga];
            }
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
            if (carga !== estado.carga) { return; }
            var fim = Math.min(i + LOTE, linhas.length);
            an.processar(linhas.slice(i, fim));
            i = fim;
            $('progressoBarra').style.width = ((i / linhas.length) * 100).toFixed(1) + '%';
            if (i < linhas.length) {
                setTimeout(passo, 0);
            } else {
                setTimeout(function () { if (carga === estado.carga) { concluir(an.finalizar(), carga); } }, 0);
            }
        }
        setTimeout(passo, 0);
    }

    /*
     * Nomes vindos da lista: o AFD manda quando traz cadastro (tipo 5);
     * a lista so preenche quem ficou sem nome.
     */
    /* lista fixa da instalacao, complementada pela que o usuario carregar */
    function nomesEmVigor() {
        if (!estado.nomesPadrao && !estado.nomesArquivo) { return null; }
        var mapa = {};
        [estado.nomesPadrao, estado.nomesArquivo].forEach(function (fonte) {
            if (!fonte) { return; }
            Object.keys(fonte).forEach(function (k) { mapa[k] = fonte[k]; });
        });
        return mapa;
    }

    function aplicarNomes() {
        if (!estado.resultado) { return 0; }
        var mapa = nomesEmVigor();
        var casados = 0;
        estado.resultado.pessoas.forEach(function (p) {
            if (mapa && mapa[p.chave]) {
                if (!p.nome || p.nomeExterno) {
                    p.nome = mapa[p.chave];
                    p.nomeExterno = true;
                }
                casados += 1;
            } else if (p.nomeExterno) {
                p.nome = '';
                p.nomeExterno = false;
            }
        });
        estado.resultado.pessoas.sort(function (a, b) {
            return AFD.compararTexto(a.nome || '\uFFFF', b.nome || '\uFFFF');
        });
        estado._mapaNomes = null;
        estado.espelho = montarEspelhoAtual();
        estado.versaoEspelho += 1;
        return casados;
    }

    function mostrarEstadoNomes() {
        var alvo = $('estadoNomes');
        if (!estado.nomesInfo) {
            alvo.hidden = true;
            return;
        }
        var texto = numeroBR(estado.nomesInfo.total) + ' nome(s) ' +
            (estado.nomesInfo.origem === 'arquivo' ? 'na lista carregada' : 'na lista da ferramenta');
        if (estado.resultado) {
            texto += ' · ' + numeroBR(estado.nomesInfo.casados) + ' de ' +
                numeroBR(estado.resultado.pessoas.length) + ' trabalhador(es) identificado(s)';
        }
        $('textoNomes').textContent = texto;
        alvo.hidden = false;
    }

    function carregarNomes(arquivo) {
        if (!arquivo) { return; }
        var leitor = new FileReader();
        leitor.onerror = function () { mostrarAviso('Não foi possível ler a lista de nomes.'); };
        leitor.onload = function () {
            aplicarTextoDeNomes(decodificar(leitor.result).texto, arquivo.name, true);
        };
        leitor.readAsArrayBuffer(arquivo);
    }

    /* aplica uma lista de nomes em texto; redesenha se ja houver arquivo aberto */
    function aplicarTextoDeNomes(texto, nomeArquivo, redesenhar) {
        var lista = AFD.lerListaDeNomes(texto);
        if (!lista.total) {
            mostrarAviso('Nenhum nome reconhecido na lista. O arquivo precisa ter uma coluna de documento ' +
                '(PIS ou CPF) e uma de nome, separadas por ponto e vírgula, vírgula ou tabulação.');
            return false;
        }
        mostrarAviso('');
        estado.nomesArquivo = lista.nomes;
        estado.nomesInfo = {
            total: Object.keys(nomesEmVigor() || {}).length,
            casados: 0, origem: 'arquivo', arquivo: nomeArquivo
        };
        estado.nomesInfo.casados = aplicarNomes();
        mostrarEstadoNomes();
        if (redesenhar && estado.resultado) {
            desenharCartoes();
            desenharAbas();
            desenharConteudo();
        }
        return true;
    }

    function descartarNomes() {
        estado.nomesArquivo = null;
        estado.nomesInfo = estado.nomesPadrao
            ? { total: Object.keys(estado.nomesPadrao).length, casados: 0, origem: 'padrao' }
            : null;
        var casados = aplicarNomes();
        if (estado.nomesInfo) { estado.nomesInfo.casados = casados; }
        mostrarEstadoNomes();
        if (estado.resultado) {
            desenharCartoes();
            desenharAbas();
            desenharConteudo();
        }
    }

    /*
     * Empresa de cada colaborador: a lista "documento -> empresa", quando
     * carregada, manda; sem ela, vale a empresa do cabecalho do AFD (caso de um
     * relogio por empresa).
     */
    function empresaDe(chave) {
        if (estado.empresasLista && estado.empresasLista[chave]) { return estado.empresasLista[chave]; }
        var cab = estado.resultado && estado.resultado.cabecalho;
        return (cab && cab.razaoSocial) || 'Empresa não informada';
    }

    /* CNPJ da empresa: o da lista, ou o do cabecalho quando a empresa e a do AFD. */
    function cnpjDe(empresa) {
        if (estado.empresasCnpj[empresa]) { return estado.empresasCnpj[empresa]; }
        var cab = estado.resultado && estado.resultado.cabecalho;
        if (cab && cab.razaoSocial === empresa && cab.tipoDocumentoEmpregador === 'CNPJ') {
            return cab.identificadorEmpregador;
        }
        return '';
    }

    function empresasPresentes() {
        if (!estado.resultado) { return []; }
        var vistas = {};
        estado.resultado.pessoas.forEach(function (p) { vistas[empresaDe(p.chave)] = true; });
        return Object.keys(vistas).sort(AFD.compararTexto);
    }

    function mostrarEstadoEmpresas() {
        var alvo = $('estadoEmpresas');
        if (!estado.empresasLista) { alvo.hidden = true; return; }
        var total = Object.keys(estado.empresasLista).length;
        var nomes = {};
        Object.keys(estado.empresasLista).forEach(function (k) { nomes[estado.empresasLista[k]] = true; });
        $('textoEmpresas').textContent = numeroBR(total) + ' colaborador(es) em ' +
            numeroBR(Object.keys(nomes).length) + ' empresa(s)';
        alvo.hidden = false;
    }

    function guardarEmpresas() {
        try {
            if (estado.empresasLista) {
                localStorage.setItem('leitor-afd-empresas', JSON.stringify({
                    empresas: estado.empresasLista, cnpjs: estado.empresasCnpj
                }));
            } else {
                localStorage.removeItem('leitor-afd-empresas');
            }
        } catch (e) { /* modo privado: vale so nesta sessao */ }
    }

    function aplicarEmpresas() {
        estado.versaoEmpresas += 1;
        estado.filtros.empresa = '';
        guardarEmpresas();
        mostrarEstadoEmpresas();
        if (estado.resultado) {
            desenharCartoes();
            desenharAbas();
            desenharConteudo();
        }
    }

    function carregarEmpresas(arquivo) {
        if (!arquivo) { return; }
        var leitor = new FileReader();
        leitor.onerror = function () { mostrarAviso('Não foi possível ler a lista de empresas.'); };
        leitor.onload = function () {
            var lista = AFD.lerListaDeEmpresas(decodificar(leitor.result).texto);
            if (!lista.total) {
                mostrarAviso('Nenhuma empresa reconhecida na lista. O arquivo precisa ter uma coluna de documento ' +
                    '(PIS ou CPF) e uma de empresa (e, se quiser, o CNPJ), separadas por ponto e vírgula.');
                return;
            }
            mostrarAviso(lista.ignorados
                ? numeroBR(lista.ignorados) + ' linha(s) da lista de empresas sem documento ou empresa foram ignoradas.'
                : '');
            estado.empresasLista = lista.empresas;
            estado.empresasCnpj = lista.cnpjs;
            aplicarEmpresas();
        };
        leitor.readAsArrayBuffer(arquivo);
    }

    function descartarEmpresas() {
        estado.empresasLista = null;
        estado.empresasCnpj = {};
        aplicarEmpresas();
    }

    function concluir(resultado, carga) {
        var espera = estado.esperas[carga];
        delete estado.esperas[carga];
        $('progresso').style.display = 'none';
        estado.resultado = resultado;
        estado.espelho = montarEspelhoAtual();
        estado.versaoEspelho += 1;
        estado._mapaNomes = null;
        if (estado.nomesInfo) {
            estado.nomesInfo.casados = aplicarNomes();
        }
        mostrarEstadoNomes();
        estado.registrosPorLinha = {};
        resultado.registros.forEach(function (r) { estado.registrosPorLinha[r.numeroLinha] = r; });
        estado.pagina = {};
        estado.ordem = {};
        estado.filtros = { busca: '', dataIni: '', dataFim: '', pessoa: '', empresa: '', tipo: '', nivel: '' };
        if (espera && espera.periodo) {
            estado.filtros.dataIni = espera.periodo.inicio || '';
            estado.filtros.dataFim = espera.periodo.fim || '';
        }
        estado.aba = 'espelho';

        if (resultado.layout === 'desconhecido') {
            mostrarAviso('Não foi possível identificar o leiaute do arquivo. ' +
                'Confira se é mesmo um AFD ou selecione o leiaute manualmente antes de carregar de novo.');
        }

        estado.modo = 'espelho';
        document.body.classList.add('carregado');
        document.body.classList.remove('modo-analises');
        $('tituloZona').textContent = 'Carregar outro arquivo';
        atualizarBotaoAnalises();

        $('painel').hidden = false;
        desenharCartoes();
        desenharAbas();
        desenharConteudo();

        if (espera) {
            espera.resolve({
                trabalhadores: resultado.pessoas.length,
                marcacoes: resultado.marcacoes.length,
                periodo: { inicio: estado.filtros.dataIni, fim: estado.filtros.dataFim }
            });
        }
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
     * Modos da tela: espelho de ponto (padrão) e demais análises
     * ------------------------------------------------------------------ */

    function atualizarBotaoAnalises() {
        var analises = estado.modo === 'analises';
        $('btnAnalises').classList.toggle('ativo', analises);
        $('rotuloAnalises').textContent = analises ? 'Voltar ao espelho de ponto' : 'Números para nerd';
        $('btnAnalises').querySelector('i').className = analises ? 'fas fa-arrow-left' : 'fas fa-chart-simple';
    }

    function trocarModo() {
        if (estado.modo === 'analises') {
            estado.modo = 'espelho';
            estado.aba = 'espelho';
        } else {
            estado.modo = 'analises';
            if (estado.aba === 'espelho') { estado.aba = 'resumo'; }
        }
        document.body.classList.toggle('modo-analises', estado.modo === 'analises');
        atualizarBotaoAnalises();
        desenharAbas();
        desenharConteudo();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    /* ------------------------------------------------------------------ *
     * Abas
     * ------------------------------------------------------------------ */

    function definicaoAbas() {
        var r = estado.resultado;
        return [
            { id: 'resumo', rotulo: 'Resumo', icone: 'fa-chart-simple' },
            { id: 'marcacoes', rotulo: 'Marcações', icone: 'fa-fingerprint', contador: r.marcacoes.length },
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

        if (opcoes.empresas) {
            var empresas = empresasPresentes();
            if (empresas.length > 1 || estado.empresasLista) {
                partes.push('<div class="campo"><label for="fEmpresa">Empresa</label>' +
                    '<select id="fEmpresa"><option value="">Todas</option>' +
                    empresas.map(function (nome) {
                        return '<option value="' + esc(nome) + '"' + (f.empresa === nome ? ' selected' : '') + '>' +
                            esc(nome) + '</option>';
                    }).join('') + '</select></div>');
            }
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

        if (opcoes.jornada) {
            var escala = escalaEmVigor();
            var opcoesEscala = Object.keys(AFD.ESCALAS).map(function (k) {
                return '<option value="' + k + '"' + (estado.escalaTipo === k ? ' selected' : '') + '>' +
                    esc(AFD.ESCALAS[k].rotulo) + '</option>';
            }).join('');
            opcoesEscala += '<option value="diaria"' + (estado.escalaTipo === 'diaria' ? ' selected' : '') +
                '>Mesma jornada de segunda a sexta</option>';
            opcoesEscala += '<option value="custom"' + (estado.escalaTipo === 'custom' ? ' selected' : '') +
                '>Personalizada por dia da semana</option>';

            partes.push('<div class="campo cresce"><label for="fEscala">Jornada contratual</label>' +
                '<select id="fEscala">' + opcoesEscala + '</select></div>');

            if (estado.escalaTipo === 'diaria') {
                partes.push('<div class="campo"><label for="fJornada">Por dia</label>' +
                    '<input type="time" id="fJornada" step="60" value="' + esc(horaDeMinutos(estado.jornadaMinutos)) + '"></div>');
            }

            partes.push('<div class="campo"><label>Total semanal</label>' +
                '<span class="total-escala">' + esc(AFD.formatarMinutos(AFD.somaDaEscala(escala))) + '</span></div>');

            var opcoesFaltas = [
                ['trabalhador', 'Entre a 1ª e a última marcação'],
                ['arquivo', 'Em todo o período do arquivo'],
                ['nao', 'Não completar os dias']
            ].map(function (o) {
                return '<option value="' + o[0] + '"' + (estado.faltas === o[0] ? ' selected' : '') + '>' +
                    esc(o[1]) + '</option>';
            }).join('');
            partes.push('<div class="campo"><label for="fFaltas">Dias sem marcação</label>' +
                '<select id="fFaltas" title="Dia útil vazio vira falta e desconta a jornada; sábado e domingo recebem etiqueta">' +
                opcoesFaltas + '</select></div>');
        }

        if (opcoes.visao) {
            partes.push('<div class="campo"><label>Exibição</label><div class="segmentado">' +
                '<button class="btn-seg' + (estado.visaoEspelho === 'cartoes' ? ' ativo' : '') + '" data-visao="cartoes">' +
                '<i class="fas fa-id-card"></i> Cartões</button>' +
                '<button class="btn-seg' + (estado.visaoEspelho === 'tabela' ? ' ativo' : '') + '" data-visao="tabela">' +
                '<i class="fas fa-table-list"></i> Tabela</button>' +
                '</div></div>');
        }

        partes.push('<div class="filtros-acoes">');
        partes.push('<label class="interruptor"><input type="checkbox" id="fMascarar"' +
            (estado.mascarar ? ' checked' : '') + '> Ocultar documentos</label>');
        if (opcoes.exportar !== false) {
            partes.push('<button class="btn" id="btnCopiar"><i class="fas fa-copy"></i> Copiar</button>');
            partes.push('<button class="btn btn-primario" id="btnCsv"><i class="fas fa-file-csv"></i> Baixar CSV</button>');
        }
        if (estado.aba === 'espelho') {
            partes.push('<button class="btn btn-primario" id="btnRelatorio" title="Um colaborador por página, pronto para imprimir ou salvar em PDF">' +
                '<i class="fas fa-file-pdf"></i> Relatório por colaborador</button>');
        }
        partes.push('</div>');

        if (opcoes.jornada && estado.escalaTipo === 'custom') {
            partes.push('<div class="escala-semana">');
            DIAS_CURTOS.forEach(function (rot, i) {
                partes.push('<label class="campo"><span>' + rot + '</span>' +
                    '<input type="time" step="60" data-dia="' + i + '" value="' +
                    esc(horaDeMinutos(estado.escalaCustom[i])) + '"></label>');
            });
            partes.push('</div>');
        }

        partes.push('</div>');
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

    /* Fatia a lista da aba atual e devolve o rodapé de paginação pronto. */
    function fatiarPagina(chaveAba, total, porPagina, rotulo) {
        var pagina = estado.pagina[chaveAba] || 1;
        var totalPaginas = Math.max(1, Math.ceil(total / porPagina));
        if (pagina > totalPaginas) { pagina = totalPaginas; estado.pagina[chaveAba] = pagina; }
        var inicio = (pagina - 1) * porPagina;
        var fim = Math.min(inicio + porPagina, total);

        var html = ['<div class="paginacao"><span>' +
            numeroBR(inicio + 1) + '–' + numeroBR(fim) + ' de ' + numeroBR(total) + ' ' + rotulo + '</span>'];
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
        return { inicio: inicio, fim: fim, html: html.join('') };
    }

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
            return ord.desc ? AFD.compararTexto(vb, va) : AFD.compararTexto(va, vb);
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
        var fatia = fatiarPagina(chaveAba, ordenadas.length, POR_PAGINA, 'registro(s)');
        var visiveis = ordenadas.slice(fatia.inicio, fatia.fim);
        var ord = estado.ordem[chaveAba];

        var agrupar = opcoes.agrupar;
        if (agrupar && ord && !colunas[ord.indice].agrupavel) {
            /* ordenação por outra coluna desfaz as sequências: sem faixas, volta o zebrado */
            agrupar = null;
        }

        var html = ['<div class="rolagem"><table' + (agrupar ? ' class="tabela-agrupada"' : '') + '><thead><tr>'];
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

        var grupoAtual = null;
        var indiceGrupo = -1;
        visiveis.forEach(function (linha) {
            var classeGrupo = '';
            if (agrupar) {
                var g = agrupar(linha);
                if (g.chave !== grupoAtual) {
                    grupoAtual = g.chave;
                    indiceGrupo += 1;
                    classeGrupo = indiceGrupo % 2 ? 'grupo-b' : 'grupo-a';
                    html.push('<tr class="linha-grupo ' + classeGrupo + '">' +
                        '<td colspan="' + colunas.length + '">' + g.html + '</td></tr>');
                } else {
                    classeGrupo = indiceGrupo % 2 ? 'grupo-b' : 'grupo-a';
                }
            }
            var atributos = opcoes.linhaAtributos ? opcoes.linhaAtributos(linha) : '';
            html.push('<tr class="' + classeGrupo + '" ' + atributos + '>');
            colunas.forEach(function (c) {
                html.push('<td class="' + (c.classe || '') + '">' + c.celula(linha) + '</td>');
            });
            html.push('</tr>');
        });
        html.push('</tbody></table></div>');

        html.push(fatia.html);
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
        case 'espelho': html = barraFiltros({ datas: true, empresas: true, pessoas: true, visao: true, jornada: true }) +
            '<p class="legenda-horas"><b>Horas práticas</b>: minuto a minuto do relógio, sem nenhum abono. ' +
            '<b>Hora fechada</b>: depois da tolerância de até 5 minutos por batida e 10 minutos no dia (CLT art. 58, §1º); ' +
            'passando disso, vale a diferença inteira. Feriado nacional não tem jornada prevista; ponto facultativo é dia normal. ' +
            'Dia <b>para conferir</b> (batida ímpar, repetida, inválida ou com ajuste do relógio) fica fora da hora fechada até alguém conferir.</p>' +
            '<div id="areaTabela"></div>'; break;
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
        case 'espelho': area.innerHTML = estado.visaoEspelho === 'tabela' ? tabelaEspelho() : cartoesEspelho(); break;
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

    function mapaNomes() {
        if (!estado._mapaNomes) {
            estado._mapaNomes = Object.create ? Object.create(null) : {};
            estado.resultado.pessoas.forEach(function (p) { estado._mapaNomes[p.chave] = p.nome; });
        }
        return estado._mapaNomes;
    }

    function nomeDe(chave) {
        return mapaNomes()[chave] || '';
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
                if (m.hash) {
                    return '<span title="' + esc(m.hash) + ' — lido do arquivo, não verificado">hash ' +
                        esc(m.hash.slice(0, 12)) + '… (não verificado)</span>';
                }
                if (m.crc) { return '<span title="CRC lido do arquivo; esta ferramenta não recalcula o CRC">CRC ' + esc(m.crc) + ' (não verificado)</span>'; }
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

    /*
     * Cartoes, tabela e exportacao pedem o mesmo espelho no mesmo render, e
     * cada tecla na busca dispara outro. Guardar o ultimo resultado evita
     * refazer filtro, completarDias e ordenacao a cada chamada.
     */
    var memoEspelho = { chave: null, valor: null };

    function chaveDoEspelho() {
        var f = estado.filtros;
        return [
            estado.versaoEspelho, f.busca, f.dataIni, f.dataFim, f.pessoa, f.empresa, estado.versaoEmpresas,
            estado.faltas, estado.escalaTipo, estado.jornadaMinutos,
            estado.escalaTipo === 'custom' ? estado.escalaCustom.join(',') : ''
        ].join('|');
    }

    function espelhoFiltrado() {
        var chave = chaveDoEspelho();
        if (memoEspelho.chave === chave) { return memoEspelho.valor; }
        var f = estado.filtros;
        var base = estado.espelho.filter(function (e) {
            if (f.pessoa && e.chave !== f.pessoa) { return false; }
            if (f.empresa && empresaDe(e.chave) !== f.empresa) { return false; }
            return filtroTexto([e.nome, e.identificador, e.data]);
        });

        if (estado.faltas !== 'nao' && estado.resultado) {
            var res = estado.resultado.resumo;
            base = AFD.completarDias(base, {
                escala: escalaEmVigor(),
                inicio: f.dataIni || res.periodoDeclarado.inicio || res.periodoReal.inicio,
                fim: f.dataFim || res.periodoDeclarado.fim || res.periodoReal.fim,
                todoPeriodo: estado.faltas === 'arquivo',
                calendario: true,
                feriadosLocais: feriadosLocais()
            });
        }

        var visiveis = base.filter(function (e) { return dentroDoPeriodo(e.data); });
        memoEspelho = { chave: chave, valor: visiveis };
        return visiveis;
    }

    /* Junta os dias por documento; serve à visão em cartões e às faixas da tabela. */
    function agruparPorDocumento(linhas) {
        var ordem = [];
        var grupos = {};
        linhas.forEach(function (l) {
            if (!grupos[l.chave]) {
                grupos[l.chave] = {
                    identificador: l.identificador,
                    tipo: l.tipoIdentificador,
                    nome: l.nome,
                    nomeExterno: l.nomeExterno,
                    dias: [],
                    marcacoes: 0,
                    faltas: 0,
                    folgas: 0,
                    minutos: 0
                };
                ordem.push(l.chave);
            }
            var g = grupos[l.chave];
            g.dias.push(l);
            g.marcacoes += l.quantidade;
            g.minutos += l.totalMinutos;
            if (l.tipo === 'falta') { g.faltas += 1; }
            if (l.tipo === 'folga') { g.folgas += 1; }
        });
        return { ordem: ordem, grupos: grupos };
    }

    function resumoDoGrupo(g) {
        var texto = numeroBR(g.dias.length - g.faltas - g.folgas) + ' dia(s) · ' + numeroBR(g.marcacoes) +
            ' marcação(ões) · ' + AFD.formatarMinutos(g.minutos) + ' trabalhadas';
        var html = esc(texto);
        if (g.faltas) {
            html += ' · <span class="negativo">' + numeroBR(g.faltas) + ' falta(s)</span>';
        }
        return html;
    }

    function metrica(rotulo, valor, classe) {
        return '<div class="metrica ' + (classe || '') + '">' +
            '<span class="rotulo">' + esc(rotulo) + '</span>' +
            '<span class="valor">' + valor + '</span></div>';
    }

    /* fechamento de semana ou de mês, dentro do cartão do trabalhador */
    function blocoFechamento(classe, titulo, icone, periodo, balde) {
        var sinal = classeSaldo(balde.saldo);

        var metricas = [
            metrica('Trabalhadas', esc(AFD.formatarMinutos(balde.minutos))),
            metrica('Esperadas', esc(AFD.formatarMinutos(balde.esperado))),
            metrica('Dias trabalhados', numeroBR(balde.dias))
        ];
        if (balde.faltas) { metricas.push(metrica('Faltas', '<span class="negativo">' + numeroBR(balde.faltas) + '</span>')); }
        if (balde.extras) { metricas.push(metrica('Dias extras', numeroBR(balde.extras))); }
        if (balde.pendentes) {
            metricas.push(metrica('Para conferir', '<span class="negativo">' + numeroBR(balde.pendentes) + '</span>'));
        }
        metricas.push(metrica('Horas práticas', '<span class="' + sinal + '">' + esc(AFD.formatarSaldo(balde.saldo)) + '</span>',
            'destaque ' + sinal));
        var sinalFechada = classeSaldo(balde.saldoFechado || 0);
        metricas.push(metrica('Hora fechada', fechadaTotalHTML(balde), 'destaque ' + sinalFechada));

        return '<div class="fechamento ' + classe + '">' +
            '<div class="fechamento-topo">' +
            '<span class="fechamento-titulo"><i class="fas ' + icone + '"></i> ' + esc(titulo) + '</span>' +
            '<span class="fechamento-periodo">' + esc(periodo) + '</span>' +
            '</div>' +
            '<div class="fechamento-metricas">' + metricas.join('') + '</div>' +
            '</div>';
    }

    /*
     * Visão em cartões: um cartão por documento, uma faixa por data e as
     * batidas do dia como fichas logo abaixo.
     */
    function cartoesEspelho() {
        var linhas = espelhoFiltrado();
        if (!linhas.length) {
            return '<div class="vazio"><i class="fas fa-inbox"></i>' +
                'Nenhum dia de marcação para os filtros aplicados.</div>';
        }

        var saldos = AFD.calcularSaldos(linhas, opcoesSaldo());
        var agrupado = agruparPorDocumento(linhas);
        var ordem = agrupado.ordem;
        var grupos = agrupado.grupos;

        var fatia = fatiarPagina('espelho', ordem.length, POR_PAGINA_CARTOES, 'trabalhador(es)');
        var mostrarEmpresa = !!estado.empresasLista || empresasPresentes().length > 1;
        var html = ['<div class="cartoes-doc">'];

        ordem.slice(fatia.inicio, fatia.fim).forEach(function (chave, i) {
            var g = grupos[chave];
            g.dias.sort(function (a, b) { return a.data < b.data ? -1 : (a.data > b.data ? 1 : 0); });

            html.push('<section class="cartao-doc ' + (i % 2 ? 'grupo-b' : 'grupo-a') + '">');
            html.push('<header class="doc-topo">' +
                '<i class="fas fa-file-lines" style="color:var(--doc-cor)"></i>' +
                '<span class="rotulo-doc">' + esc(g.tipo || 'Documento') + '</span>' +
                '<span class="numero-doc">' + esc(documento(g.identificador, g.tipo)) + '</span>' +
                (g.nome
                    ? '<span class="separador-doc">-</span><span class="nome-doc"' +
                      (g.nomeExterno ? ' title="Nome vindo da lista carregada, não do AFD"' : '') + '>' +
                      esc(g.nome) + '</span>'
                    : '<span class="sem-nome">nome não informado no arquivo</span>') +
                (mostrarEmpresa ? '<span class="etiqueta neutra" title="Empresa">' + esc(empresaDe(chave)) + '</span>' : '') +
                '<span class="resumo-doc">' + resumoDoGrupo(g) + ' · horas práticas ' +
                saldoHTML(saldos.pessoas[chave].saldo) + ' · hora fechada ' +
                fechadaTotalHTML(saldos.pessoas[chave]) + '</span>' +
                '</header>');

            var pessoa = saldos.pessoas[chave];
            var semanaAberta = null;
            var mesAberto = null;

            function fecharSemana() {
                if (!semanaAberta) { return; }
                var b = pessoa.semanas[semanaAberta];
                html.push(blocoFechamento('semana', 'Fechamento da semana', 'fa-calendar-week',
                    AFD.formatarDataBR(b.inicio) + ' a ' + AFD.formatarDataBR(b.fim), b));
                semanaAberta = null;
            }

            function fecharMes() {
                if (!mesAberto) { return; }
                var b = pessoa.meses[mesAberto];
                html.push(blocoFechamento('mes', 'Fechamento do mês', 'fa-calendar-days', b.rotulo, b));
                mesAberto = null;
            }

            g.dias.forEach(function (d) {
                if (semanaAberta && d.chaveSemana !== semanaAberta) { fecharSemana(); }
                if (mesAberto && d.chaveMes !== mesAberto) { fecharMes(); }
                semanaAberta = d.chaveSemana;
                mesAberto = d.chaveMes;

                var tipo = d.tipo || 'normal';
                var resumoDia;
                if (tipo === 'falta') {
                    resumoDia = 'sem marcação · desconta ' + esc(AFD.formatarMinutos(d.jornadaEsperada));
                } else if (tipo === 'folga') {
                    resumoDia = 'sem marcação · sem jornada prevista';
                } else if (tipo === 'extra') {
                    resumoDia = numeroBR(d.quantidade) + ' marcações · ' + esc(d.total) + ' · tudo como saldo';
                } else {
                    resumoDia = numeroBR(d.quantidade) + ' marcações · ' + esc(d.total) +
                        ' de ' + esc(AFD.formatarMinutos(d.jornadaEsperada));
                }

                var pendente = d.statusSaldo === 'pendente';
                html.push('<div class="dia-faixa ' + tipo + (pendente ? ' pendente' : '') + '">' +
                    '<i class="fas fa-calendar-days"></i>' +
                    '<span>' + esc(AFD.formatarDataBR(d.data)) + '</span>' +
                    '<span class="dia-semana">' + esc(d.diaSemana) + '</span>' +
                    tarjaCalendario(d) +
                    (pendente ? '<span class="etiqueta erro">PARA CONFERIR</span>' : '') +
                    '<span class="dia-total">' + resumoDia + '</span></div>');

                var feriadoVazio = d.calendario && d.calendario.tipo === 'feriado' && !d.quantidade;
                var etiquetaDia = d.etiqueta
                    ? '<span class="etiqueta-dia ' + tipo + (feriadoVazio ? ' feriado' : '') + '">' +
                      '<i class="fas ' + (tipo === 'falta' ? 'fa-user-xmark'
                          : (tipo === 'extra' ? 'fa-clock-rotate-left' : 'fa-mug-hot')) + '"></i> ' +
                      esc(d.etiqueta) + '</span>'
                    : '';

                var fichas = d.horarios.map(function (h, i) {
                    var semPar = d.impar && i === d.horarios.length - 1;
                    var nsr = d.nsrs && d.nsrs[i] ? d.nsrs[i] : '';
                    return '<span class="ficha-hora' + (semPar ? ' sem-par' : '') + '"' +
                        (nsr ? ' title="NSR ' + esc(nsr) + (semPar ? ' — sem par no dia' : '') + '"' : '') + '>' +
                        '<i class="fas fa-clock"></i>' + esc(h.slice(0, 5)) + '</span>';
                }).join('') + etiquetaDia +
                    (d.calendario && d.calendario.tipo === 'facultativo'
                        ? '<span class="etiqueta-dia facultativo"><i class="fas fa-flag"></i> PONTO FACULTATIVO</span>' : '');
                var avisos = '';
                if (pendente) {
                    avisos += '<div class="motivos-dia"><i class="fas fa-triangle-exclamation"></i> Para conferir: ' +
                        esc(d.pendencias.join(' · ')) + '</div>';
                }
                if (d.alertas && d.alertas.length) {
                    avisos += '<div class="alertas-dia"><i class="fas fa-circle-info"></i> ' + esc(d.alertas.join(' · ')) + '</div>';
                }

                html.push('<div class="dia-horas">' +
                    '<div class="fichas-e-avisos"><div class="fichas">' + fichas + '</div>' + avisos + '</div>' +
                    '<div class="saldos-dia">' +
                    '<div class="saldo-dia"><span class="rotulo">Horas práticas</span>' +
                    '<span class="valor ' + classeSaldo(d.saldo) + '">' + esc(AFD.formatarSaldo(d.saldo)) + '</span></div>' +
                    '<div class="saldo-dia"><span class="rotulo">Hora fechada</span>' +
                    '<span class="valor">' + fechadaDiaHTML(d) + '</span>' +
                    (d.toleranciaAplicada ? '<span class="nota-tolerancia">tolerância aplicada</span>' : '') +
                    '</div></div></div>');
            });

            fecharSemana();
            fecharMes();
            html.push('</section>');
        });

        html.push('</div>');
        html.push(fatia.html);
        return html.join('');
    }

    function tabelaEspelho() {
        var linhas = espelhoFiltrado();
        var saldos = AFD.calcularSaldos(linhas, opcoesSaldo());
        var grupos = agruparPorDocumento(linhas).grupos;

        var colunas = [
            { titulo: 'Trabalhador', agrupavel: true, valor: function (e) { return e.nome || e.identificador; }, celula: function (e) { return esc(e.nome || '—'); } },
            { titulo: 'Documento', classe: 'mono', agrupavel: true, valor: function (e) { return e.identificador; }, celula: function (e) { return esc(documento(e.identificador, e.tipoIdentificador)); } },
            { titulo: 'Data', valor: function (e) { return e.data; }, celula: function (e) { return esc(AFD.formatarDataBR(e.data)); } },
            { titulo: 'Dia', celula: function (e) { return esc(e.diaSemana); } },
            { titulo: 'Marcações', classe: 'mono', celula: function (e) {
                var marcas = e.horarios.map(function (h) { return esc(h.slice(0, 5)); }).join(' &nbsp; ');
                if (!e.etiqueta) { return marcas; }
                var cor = e.tipo === 'falta' ? 'erro' : (e.tipo === 'extra' ? 'alerta' : 'neutra');
                var selo = '<span class="etiqueta ' + cor + '">' + esc(e.etiqueta) + '</span>';
                return marcas ? marcas + ' &nbsp; ' + selo : selo;
            } },
            { titulo: 'Qtde.', classe: 'num', valor: function (e) { return e.quantidade; }, celula: function (e) { return numeroBR(e.quantidade); } },
            { titulo: 'Total trabalhado', classe: 'num mono', valor: function (e) { return e.totalMinutos; }, celula: function (e) { return esc(e.total); } },
            { titulo: 'Horas práticas', classe: 'num mono', valor: function (e) { return e.saldo; }, celula: function (e) { return saldoHTML(e.saldo); } },
            { titulo: 'Hora fechada', classe: 'num mono', valor: function (e) { return e.saldoFechado == null ? -1e9 : e.saldoFechado; }, celula: fechadaDiaHTML },
            { titulo: 'Situação', celula: function (e) {
                var selos = [];
                if (e.statusSaldo === 'pendente') {
                    selos.push('<span class="etiqueta erro" title="' + esc(e.pendencias.join(' · ')) + '">para conferir</span>');
                }
                if (e.calendario) {
                    selos.push('<span class="etiqueta ' + (e.calendario.tipo === 'feriado' ? 'erro' : 'alerta') + '">' +
                        (e.calendario.tipo === 'feriado' ? 'feriado' : 'ponto facultativo') + ' · ' + esc(e.calendario.nome) + '</span>');
                }
                if (e.tipo === 'falta') { selos.push('<span class="etiqueta erro">falta em dia útil</span>'); }
                else if (e.tipo === 'folga') { selos.push('<span class="etiqueta neutra">sem jornada prevista</span>'); }
                else if (e.tipo === 'extra') { selos.push('<span class="etiqueta alerta">hora extra</span>'); }
                if (e.toleranciaAplicada) { selos.push('<span class="etiqueta info">tolerância aplicada</span>'); }
                (e.alertas || []).forEach(function (a) { selos.push('<span class="etiqueta info">' + esc(a) + '</span>'); });
                if (!selos.length) { selos.push('<span class="etiqueta ok">pares completos</span>'); }
                return selos.join(' ');
            } }
        ];
        return tabela('espelho', colunas, linhas, {
            vazio: 'Nenhum dia de marcação para os filtros aplicados.',
            agrupar: function (e) {
                var g = grupos[e.chave];
                return {
                    chave: e.chave,
                    html: '<i class="fas fa-file-lines"></i> ' +
                        '<span class="rotulo-grupo">' + esc(g.tipo || 'Documento') + '</span>' +
                        '<span class="doc-grupo">' + esc(documento(g.identificador, g.tipo)) + '</span>' +
                        '<span class="nome-grupo">' + esc(g.nome || 'sem cadastro no arquivo') + '</span>' +
                        '<span class="resumo-grupo">' + resumoDoGrupo(g) + ' · horas práticas ' +
                        saldoHTML(saldos.pessoas[e.chave].saldo) + ' · hora fechada ' +
                        fechadaTotalHTML(saldos.pessoas[e.chave]) + '</span>'
                };
            }
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
        var aviso = estado.mascarar
            ? '<p class="legenda-horas"><b>Atenção:</b> "Ocultar documentos" não se aplica à linha bruta do arquivo. ' +
              'CPF e PIS aparecem completos aqui e no detalhe de cada linha.</p>'
            : '';
        return aviso + tabela('arquivo', colunas, registrosFiltrados(), { vazio: 'Nenhuma linha para os filtros aplicados.' });
    }

    /* ------------------------------------------------------------------ *
     * Detalhe do registro (campos e posicoes)
     * ------------------------------------------------------------------ */

    function abrirDetalhe(numeroLinha) {
        var r = estado.registrosPorLinha[numeroLinha];
        if (!r) { return; }

        var campos = AFD.camposDoRegistro(r.linha, estado.resultado.layout).map(function (c) {
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
            (estado.mascarar
                ? '<p class="legenda-horas"><b>Atenção:</b> a linha bruta mostra os documentos completos; ' +
                  '"Ocultar documentos" não se aplica aqui.</p>'
                : '') +
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
            var diasEspelho = espelhoFiltrado();
            AFD.calcularSaldos(diasEspelho, opcoesSaldo());
            return {
                nome: 'espelho_de_ponto',
                cabecalho: ['Empresa', 'Trabalhador', 'Documento', 'Data', 'Dia da semana', 'Marcacoes', 'Qtde',
                    'Total trabalhado', 'Jornada esperada', 'Horas praticas', 'Hora fechada', 'Situacao',
                    'Para conferir', 'Alertas'],
                linhas: diasEspelho.map(function (e) {
                    return [empresaDe(e.chave), e.nome, documento(e.identificador, e.tipoIdentificador), AFD.formatarDataBR(e.data),
                        e.diaSemana,
                        e.horarios.map(function (h) { return h.slice(0, 5); }).join(' ') || e.etiqueta || '',
                        e.quantidade, e.total, AFD.formatarMinutos(e.jornadaEsperada), AFD.formatarSaldo(e.saldo),
                        e.saldoFechado == null ? '' : AFD.formatarSaldo(e.saldoFechado),
                        situacaoTexto(e), (e.pendencias || []).join(' | '), (e.alertas || []).join(' | ')];
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

    /* situacao do dia em texto, para CSV e copia */
    function situacaoTexto(e) {
        var partes = [];
        if (e.statusSaldo === 'pendente') { partes.push('PARA CONFERIR'); }
        if (e.calendario) { partes.push((e.calendario.tipo === 'feriado' ? 'FERIADO' : 'PONTO FACULTATIVO') + ' - ' + e.calendario.nome); }
        if (e.etiqueta) { partes.push(e.etiqueta); }
        if (e.toleranciaAplicada) { partes.push('Tolerancia aplicada'); }
        if (!partes.length) { partes.push('Pares completos'); }
        return partes.join(' | ');
    }

    function montarCSV(dados) {
        function campo(v) {
            var s = AFD.celulaPlanilha(v);
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

    /* Ultimo recurso: o navegador pode barrar a area de transferencia
       (iframe sem permissao, contexto nao seguro). Ai o texto vai para a
       tela, pronto para selecionar. */
    function mostrarTextoParaCopiar(texto) {
        $('modalTitulo').textContent = 'Copiar dados da tabela';
        $('modalCorpo').innerHTML =
            '<p class="legenda-grafico" style="margin-top:0">O navegador bloqueou a cópia automática. ' +
            'O conteúdo está selecionado abaixo: use Ctrl+C (ou Cmd+C) e cole na planilha.</p>' +
            '<textarea id="areaCopia" readonly spellcheck="false" style="width:100%;min-height:300px;' +
            'font-family:\'SFMono-Regular\',Consolas,monospace;font-size:0.75rem;padding:10px;' +
            'border-radius:8px;border:1px solid var(--border-color);background:var(--bg-color);' +
            'color:var(--text-color);"></textarea>';
        $('areaCopia').value = texto;
        $('modalFundo').classList.add('aberto');
        $('areaCopia').focus();
        $('areaCopia').select();
    }

    function copiarTabela(botao) {
        var dados = dadosExportacao();
        if (!dados) { return; }
        var texto = [dados.cabecalho].concat(dados.linhas)
            .map(function (l) {
                return l.map(function (v) { return AFD.celulaPlanilha(v).replace(/[\t\r\n]+/g, ' '); }).join('\t');
            }).join('\n');
        var rotulo = botao.innerHTML;

        function aviso() {
            botao.innerHTML = '<i class="fas fa-check"></i> Copiado';
            setTimeout(function () { botao.innerHTML = rotulo; }, 1800);
        }

        function porSelecao() {
            var ta = document.createElement('textarea');
            ta.value = texto;
            ta.setAttribute('readonly', 'readonly');
            ta.style.position = 'fixed';
            ta.style.top = '0';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            ta.setSelectionRange(0, texto.length);
            var ok = false;
            try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
            document.body.removeChild(ta);
            if (ok) { aviso(); } else { mostrarTextoParaCopiar(texto); }
        }

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(texto).then(aviso, porSelecao);
            return;
        }
        porSelecao();
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
        estado.hashArquivo = AFD.sha256(texto);
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
            estado.hashArquivo = AFD.sha256(t);
            analisar(t);
        });
        $('btnNomes').addEventListener('click', function () { $('entradaNomes').click(); });
        $('entradaNomes').addEventListener('change', function () {
            var campo = $('entradaNomes');
            if (campo.files && campo.files[0]) { carregarNomes(campo.files[0]); }
            campo.value = '';
        });
        $('btnRemoverNomes').addEventListener('click', descartarNomes);
        $('btnEmpresas').addEventListener('click', function () { $('entradaEmpresas').click(); });
        $('entradaEmpresas').addEventListener('change', function () {
            var campo = $('entradaEmpresas');
            carregarEmpresas(campo.files[0]);
            campo.value = '';
        });
        $('btnRemoverEmpresas').addEventListener('click', descartarEmpresas);
        $('btnAnalises').addEventListener('click', trocarModo);
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
            var mapa = { fDataIni: 'dataIni', fDataFim: 'dataFim', fPessoa: 'pessoa', fEmpresa: 'empresa', fTipo: 'tipo', fNivel: 'nivel' };
            if (mapa[alvo.id]) {
                estado.filtros[mapa[alvo.id]] = alvo.value;
                estado.pagina[estado.aba] = 1;
                desenharTabela();
            } else if (alvo.id === 'fMascarar') {
                estado.mascarar = alvo.checked;
                desenharConteudo();
            } else if (alvo.id === 'fFaltas') {
                estado.faltas = alvo.value;
                try { localStorage.setItem('leitor-afd-faltas', alvo.value); } catch (err) { /* modo privado */ }
                desenharTabela();
            } else if (alvo.id === 'fEscala') {
                estado.escalaTipo = alvo.value;
                try { localStorage.setItem('leitor-afd-escala', alvo.value); } catch (err) { /* modo privado */ }
                desenharConteudo();
            } else if (alvo.id === 'fJornada') {
                var min = minutosDeHora(alvo.value);
                if (min !== null) {
                    estado.jornadaMinutos = min;
                    try { localStorage.setItem('leitor-afd-jornada', String(min)); } catch (err) { /* modo privado */ }
                    desenharConteudo();
                }
            } else if (alvo.hasAttribute && alvo.hasAttribute('data-dia')) {
                var dia = Number(alvo.getAttribute('data-dia'));
                var valor = minutosDeHora(alvo.value);
                if (valor !== null) {
                    estado.escalaCustom[dia] = valor;
                    try {
                        localStorage.setItem('leitor-afd-escala-custom', JSON.stringify(estado.escalaCustom));
                    } catch (err) { /* modo privado */ }
                    desenharConteudo();
                }
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

            var visao = e.target.closest('[data-visao]');
            if (visao) {
                estado.visaoEspelho = visao.getAttribute('data-visao');
                try { localStorage.setItem('leitor-afd-visao', estado.visaoEspelho); } catch (err) { /* modo privado */ }
                estado.pagina.espelho = 1;
                desenharConteudo();
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

    try {
        var visaoSalva = localStorage.getItem('leitor-afd-visao');
        if (visaoSalva === 'tabela' || visaoSalva === 'cartoes') { estado.visaoEspelho = visaoSalva; }
        var jornadaSalva = Number(localStorage.getItem('leitor-afd-jornada'));
        if (jornadaSalva > 0 && jornadaSalva <= 1440) { estado.jornadaMinutos = jornadaSalva; }
        var escalaSalva = localStorage.getItem('leitor-afd-escala');
        if (escalaSalva && (AFD.ESCALAS[escalaSalva] || escalaSalva === 'diaria' || escalaSalva === 'custom')) {
            estado.escalaTipo = escalaSalva;
        }
        var faltasSalva = localStorage.getItem('leitor-afd-faltas');
        if (faltasSalva === 'trabalhador' || faltasSalva === 'arquivo' || faltasSalva === 'nao') {
            estado.faltas = faltasSalva;
        }
        var customSalva = JSON.parse(localStorage.getItem('leitor-afd-escala-custom') || 'null');
        if (customSalva && customSalva.length === 7) { estado.escalaCustom = customSalva; }
    } catch (e) { /* modo privado */ }

    try {
        var empresasSalvas = JSON.parse(localStorage.getItem('leitor-afd-empresas') || 'null');
        if (empresasSalvas && empresasSalvas.empresas && Object.keys(empresasSalvas.empresas).length) {
            estado.empresasLista = empresasSalvas.empresas;
            estado.empresasCnpj = empresasSalvas.cnpjs || {};
        }
    } catch (e) { /* modo privado ou valor corrompido: sem lista */ }

    if (window.LEITOR_AFD_NOMES) {
        var padrao = AFD.normalizarListaDeNomes(window.LEITOR_AFD_NOMES);
        if (padrao.total) {
            estado.nomesPadrao = padrao.nomes;
            estado.nomesInfo = { total: padrao.total, casados: 0, origem: 'padrao' };
        }
    }

    /*
     * Espelho em vigor (filtros, escala e dias completados iguais aos da tela),
     * para o relatório por colaborador de relatorio.js. Os totais saem do mesmo
     * calcularSaldos dos cartões, então o papel bate com a tela.
     */
    window.LeitorAFD = window.LeitorAFD || {};

    /*
     * Carga por programa (usada pelo download do relogio no desktop):
     *   LeitorAFD.carregar({ bytes, nomeArquivo, nomes, periodo: { inicio, fim } })
     * nomes = lista "documento;nome" em texto (opcional). A Promise so resolve
     * depois que a analise terminou e o periodo foi aplicado nesta mesma carga;
     * e rejeitada se outra carga comecar antes.
     */
    window.LeitorAFD.versaoApi = 1;
    window.LeitorAFD.carregar = function (o) {
        return new Promise(function (resolve, reject) {
            var bytes = o.bytes instanceof Uint8Array ? o.bytes : new Uint8Array(o.bytes || []);
            if (o.nomes) { aplicarTextoDeNomes(o.nomes, o.nomeLista || 'nomes do relógio', false); }
            var carga = novaCarga();
            estado.esperas[carga] = { resolve: resolve, reject: reject, periodo: o.periodo || null };
            mostrarAviso('');
            estado.nomeArquivo = o.nomeArquivo || 'afd.txt';
            estado.tamanhoArquivo = bytes.length;
            estado.hashArquivo = AFD.sha256(bytes);
            var d = decodificar(bytes);
            estado.codificacao = d.codificacao;
            analisar(d.texto, carga);
        });
    };

    window.LeitorAFD.dadosDoEspelho = function () {
        if (!estado.resultado) { return null; }
        var linhas = espelhoFiltrado();
        var saldos = AFD.calcularSaldos(linhas, opcoesSaldo());
        var agrupado = agruparPorDocumento(linhas);
        var res = estado.resultado;
        var pronta = AFD.ESCALAS[estado.escalaTipo];
        var rotuloEscala = pronta ? pronta.rotulo
            : (estado.escalaTipo === 'diaria'
                ? 'Mesma jornada de segunda a sexta (' + AFD.formatarMinutos(estado.jornadaMinutos) + ')'
                : 'Personalizada por dia da semana');
        return {
            ordem: agrupado.ordem,
            grupos: agrupado.grupos,
            saldos: saldos,
            cabecalho: res.cabecalho || {},
            layout: res.layout,
            nomeArquivo: estado.nomeArquivo,
            periodo: {
                inicio: estado.filtros.dataIni || linhas.reduce(function (m, l) { return !m || l.data < m ? l.data : m; }, ''),
                fim: estado.filtros.dataFim || linhas.reduce(function (m, l) { return l.data > m ? l.data : m; }, '')
            },
            escala: { rotulo: rotuloEscala, dias: escalaEmVigor() },
            documento: documento,
            hashArquivo: estado.hashArquivo,
            versao: AFD.VERSAO + (window.LEITOR_AFD_MONTAGEM ? ' · ' + window.LEITOR_AFD_MONTAGEM : ''),
            empresaDe: empresaDe,
            cnpjDe: cnpjDe
        };
    };

    iniciarTema();
    ligarEventos();
    mostrarEstadoEmpresas();
}());
