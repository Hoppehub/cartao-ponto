/*
 * relogio.js — Botão "Baixar do relógio" do leitor, só na versão para o computador.
 *
 * Pede o AFD ao relogio.php (que conversa com o Control iD) e o entrega ao leitor pela
 * API LeitorAFD.carregar, com a lista de nomes do relógio e o período do mês. A Promise
 * só resolve depois que a análise terminou e o mês foi aplicado nesta mesma carga. O
 * relógio entrega do dia 1 do mês em diante; o filtro do período corta o resto.
 * Com usuário e senha salvos, o programa abre sozinho o mês anterior inteiro.
 */
(function () {
    'use strict';

    var URL_RELOGIO = 'relogio.php';

    function $(id) { return document.getElementById(id); }

    function pedir(acao, corpo) {
        var opcoes = corpo === undefined ? {} : {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Relogio': '1' },
            body: JSON.stringify(corpo)
        };
        return fetch(URL_RELOGIO + '?acao=' + acao, opcoes).then(function (r) {
            if (r.ok) { return r; }
            return r.json().catch(function () { return {}; }).then(function (j) {
                throw new Error(j.erro || ('Falha ao falar com o programa (HTTP ' + r.status + ').'));
            });
        });
    }

    function doisDigitos(n) { return (n < 10 ? '0' : '') + n; }

    function ultimoDia(ano, mes) { return new Date(ano, mes, 0).getDate(); }

    /* O mês que abre sozinho: sempre o mês anterior inteiro (o do fechamento). */
    function mesAnterior() {
        var d = new Date();
        d.setDate(1);
        d.setMonth(d.getMonth() - 1);
        return d.getFullYear() + '-' + doisDigitos(d.getMonth() + 1);
    }

    function montarPainel() {
        var painel = document.createElement('div');
        painel.id = 'painelRelogio';
        painel.innerHTML =
            '<style>' +
            '#painelRelogio{padding:14px 16px;border:1px solid var(--border-color);border-radius:10px;background:var(--card-bg)}' +
            '#painelRelogio h3{margin:0 0 8px;font-size:15px}' +
            '#painelRelogio .linha{display:flex;flex-wrap:wrap;gap:8px;align-items:flex-end;margin-top:8px}' +
            '#painelRelogio label{display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--text-muted)}' +
            '#painelRelogio label.marcar{flex-direction:row;align-items:center;align-self:center}' +
            '#painelRelogio input,#painelRelogio select{padding:7px 9px;border-radius:6px;border:1px solid var(--border-color);background:var(--bg-color);color:var(--text-color);font:inherit}' +
            '#painelRelogio .acesso input{width:150px}' +
            '#painelRelogio .estado{margin-top:8px;font-size:13px;color:var(--text-muted)}' +
            '#painelRelogio .estado:empty{display:none}' +
            '#painelRelogio .estado.erro{color:var(--erro)}' +
            '#painelRelogio .config{margin-top:4px}' +
            /* tela inicial: título, painel do relógio no centro e a área de arquivo embaixo */
            'body.com-relogio:not(.carregado) #painelRelogio{justify-self:center;width:fit-content;max-width:100%;margin:24px 0}' +
            'body.com-relogio:not(.carregado) #zonaArquivo{justify-self:center;width:min(440px,100%);padding:20px;margin-top:24px}' +
            'body.com-relogio:not(.carregado) #zonaArquivo p{display:none}' +
            /* com um mês aberto, o painel fica numa linha só dele, embaixo do topo */
            'body.com-relogio.carregado #painelRelogio{grid-column:1/-1;order:1;flex-basis:100%}' +
            /* título, área de arquivo, botões de carga e o aviso de rodapé ficam em "Números para nerd" */
            'body.com-relogio:not(.modo-analises) #secaoCarga > .zona-acoes,' +
            'body.com-relogio:not(.modo-analises) .nota-rodape,' +
            'body.com-relogio.carregado:not(.modo-analises) .topo,' +
            'body.com-relogio.carregado:not(.modo-analises) #zonaArquivo{display:none!important}' +
            'body.com-relogio.carregado:not(.modo-analises) .linha-topo{display:flex!important;flex-wrap:wrap;justify-content:flex-end}' +
            '</style>' +
            '<h3><i class="fas fa-clock"></i> Baixar do relógio de ponto</h3>' +
            '<div class="linha acesso">' +
            '  <label>Usuário<input id="relUsuario" autocomplete="off"></label>' +
            '  <label>Senha<input id="relSenha" type="password" autocomplete="new-password"></label>' +
            '</div>' +
            '<div class="linha">' +
            '  <input type="month" id="relMes" value="' + mesAnterior() + '" title="Mês">' +
            '  <button class="btn btn-primario" id="relBaixar"><i class="fas fa-download"></i> Baixar e abrir</button>' +
            '  <button class="btn" id="relConfigurar"><i class="fas fa-gear"></i> Configurar relógio</button>' +
            '</div>' +
            '<div class="config" id="relConfig" hidden>' +
            '  <div class="linha">' +
            '    <label>Endereço (IP)<input id="relIp" placeholder="192.168.1.99"></label>' +
            '    <label>Leiaute<select id="relModo">' +
            '      <option value="">Padrão do relógio</option>' +
            '      <option value="671">Portaria 671/2021</option>' +
            '    </select></label>' +
            '  </div>' +
            '  <div class="linha">' +
            '    <label class="marcar" title="Só se o relógio não aceitar conexão segura. Sem HTTPS, a senha e o AFD passam abertos pela rede.">' +
            '<input type="checkbox" id="relHttp"> Permitir conexão sem criptografia (HTTP)</label>' +
            '    <button class="btn btn-primario" id="relSalvar">Salvar</button>' +
            '  </div>' +
            '</div>' +
            '<div class="estado" id="relEstado"></div>';
        return painel;
    }

    function estado(texto, erro) {
        var alvo = $('relEstado');
        alvo.textContent = texto;
        alvo.className = 'estado' + (erro ? ' erro' : '');
    }

    var temAcesso = false;

    /* Usuário e senha nunca voltam do programa: os campos abrem sempre em branco. */
    function carregarConfig() {
        return pedir('config').then(function (r) { return r.json(); }).then(function (c) {
            temAcesso = !!c.tem_acesso;
            $('relIp').value = c.ip || '';
            $('relModo').value = c.modo || '';
            $('relHttp').checked = !!c.permitirHttp;
            return c;
        });
    }

    /* Grava o que está na tela; usuário ou senha em branco mantém o que já foi salvo. */
    function salvarAcesso() {
        return pedir('salvar', {
            ip: $('relIp').value, usuario: $('relUsuario').value,
            senha: $('relSenha').value, modo: $('relModo').value, permitirHttp: $('relHttp').checked
        }).then(function () {
            $('relUsuario').value = '';
            $('relSenha').value = '';
            return carregarConfig();
        });
    }

    function salvar() {
        estado('Salvando...');
        salvarAcesso().then(function () {
            $('relConfig').hidden = true;
            if (temAcesso) { baixar(); } else { estado(PEDIR_ACESSO); }
        }).catch(function (e) { estado(e.message, true); });
    }

    var PEDIR_ACESSO = 'Informe o usuário e a senha do relógio (os mesmos do Chrome) e clique em Baixar e abrir.';

    /* "Baixar e abrir": se usuário ou senha foram digitados, salva antes; depois baixa o mês escolhido. */
    function baixar() {
        var digitou = $('relUsuario').value.trim() !== '' || $('relSenha').value !== '';
        var antes = Promise.resolve();
        if (digitou) {
            estado('Salvando o acesso...');
            antes = salvarAcesso();
        }
        antes.then(function () {
            if (!temAcesso) { estado(PEDIR_ACESSO, true); return; }
            baixarMes();
        }).catch(function (e) { estado(e.message, true); });
    }

    function baixarMes() {
        var valor = $('relMes').value;
        if (!/^\d{4}-\d{2}$/.test(valor)) { estado('Escolha o mês.', true); return; }
        var ano = Number(valor.slice(0, 4)), mes = Number(valor.slice(5, 7));
        var botao = $('relBaixar');
        botao.disabled = true;
        estado('Falando com o relógio... arquivos grandes podem levar um minuto.');
        if (!window.LeitorAFD || window.LeitorAFD.versaoApi !== 1) {
            estado('Esta versão do contador de horas não aceita o download do relógio. Monte o programa de novo.', true);
            botao.disabled = false;
            return;
        }
        var nomes = [];
        var avisoNomes = '';
        var semCabecalho = false;
        pedir('baixar', { ano: ano, mes: mes }).then(function (r) {
            return r.json();
        }).then(function (resposta) {
            // O AFD do relógio costuma vir sem o cadastro dos empregados: a lista de nomes vai junto.
            nomes = resposta.nomes || [];
            avisoNomes = resposta.avisoNomes || '';
            semCabecalho = !!resposta.semCabecalho;
            var csv = nomes.length
                ? 'documento;nome\n' + nomes.map(function (n) {
                    return n.doc + ';' + String(n.nome).replace(/[;\r\n]/g, ' ');
                }).join('\n')
                : '';
            var binario = atob(resposta.afd || '');
            var bytes = new Uint8Array(binario.length);
            for (var i = 0; i < binario.length; i++) { bytes[i] = binario.charCodeAt(i); }
            estado('AFD recebido. Lendo o arquivo...');
            // A Promise só resolve depois que a análise terminou e o mês foi aplicado nesta mesma carga.
            return window.LeitorAFD.carregar({
                bytes: bytes,
                nomeArquivo: 'AFD_relogio_' + ano + '-' + doisDigitos(mes) + '.txt',
                nomes: csv,
                nomeLista: 'nomes do relógio',
                periodo: {
                    inicio: ano + '-' + doisDigitos(mes) + '-01',
                    fim: ano + '-' + doisDigitos(mes) + '-' + doisDigitos(ultimoDia(ano, mes))
                }
            });
        }).then(function () {
            estado('Mostrando ' + doisDigitos(mes) + '/' + ano +
                (nomes.length ? ', com os nomes cadastrados no relógio.' : '.') +
                (semCabecalho ? ' O relógio mandou só os registros do mês, sem o cabeçalho do arquivo: por isso a auditoria ' +
                    'aponta "cabeçalho ausente". É esperado e não muda as horas.' : '') +
                (avisoNomes ? ' Atenção: ' + avisoNomes : ''), !!avisoNomes);
        }).catch(function (e) {
            estado(e.message, true);
        }).then(function () { botao.disabled = false; });
    }

    function iniciar() {
        if (location.protocol === 'file:') { return; }
        var topo = document.querySelector('.linha-topo .topo');
        if (!topo || !$('entradaArquivo')) { return; }
        var painel = montarPainel();
        topo.parentNode.insertBefore(painel, topo.nextSibling);
        document.body.classList.add('com-relogio');
        $('relBaixar').addEventListener('click', baixar);
        $('relSalvar').addEventListener('click', salvar);
        $('relConfigurar').addEventListener('click', function () {
            $('relConfig').hidden = !$('relConfig').hidden;
        });
        ['relUsuario', 'relSenha'].forEach(function (id) {
            $(id).addEventListener('keydown', function (e) { if (e.key === 'Enter') { baixar(); } });
        });
        carregarConfig().then(function () {
            // Com o acesso já salvo, abre sozinho o mês anterior inteiro.
            if (temAcesso) { baixar(); } else { estado(PEDIR_ACESSO); }
        }, function () {
            painel.remove(); // sem relogio.php por trás (por exemplo, a versão do site)
            document.body.classList.remove('com-relogio');
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', iniciar);
    } else {
        iniciar();
    }
})();
