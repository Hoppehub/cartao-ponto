/*
 * relogio.js — Botão "Baixar do relógio" do leitor, só na versão para o computador.
 *
 * Pede o AFD ao relogio.php (que conversa com o Control iD) e o entrega ao leitor pela
 * API LeitorAFD.carregar, com a lista de nomes do relógio e o período do mês. A Promise
 * só resolve depois que a análise terminou e o mês foi aplicado nesta mesma carga. O
 * relógio entrega do dia 1 do mês em diante; o filtro do período corta o resto.
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

    function montarPainel() {
        var hoje = new Date();
        var painel = document.createElement('div');
        painel.id = 'painelRelogio';
        painel.innerHTML =
            '<style>' +
            '#painelRelogio{margin:12px 0;padding:14px 16px;border:1px solid var(--border-color);border-radius:10px;background:var(--card-bg)}' +
            '#painelRelogio h3{margin:0 0 10px;font-size:15px}' +
            '#painelRelogio .linha{display:flex;flex-wrap:wrap;gap:8px;align-items:center}' +
            '#painelRelogio input,#painelRelogio select{padding:7px 9px;border-radius:6px;border:1px solid var(--border-color);background:var(--bg-color);color:var(--text-color);font:inherit}' +
            '#painelRelogio .estado{margin-top:8px;font-size:13px;color:var(--text-muted)}' +
            '#painelRelogio .estado.erro{color:var(--erro)}' +
            '#painelRelogio .config{margin-top:12px;padding-top:12px;border-top:1px dashed var(--border-color)}' +
            '#painelRelogio .config label{display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--text-muted)}' +
            '#painelRelogio .config label.marcar{align-self:flex-end;padding-bottom:8px}' +
            '</style>' +
            '<h3><i class="fas fa-clock"></i> Baixar do relógio de ponto</h3>' +
            '<div class="linha">' +
            '  <input type="month" id="relMes" value="' + hoje.getFullYear() + '-' + doisDigitos(hoje.getMonth() + 1) + '" title="Mês">' +
            '  <button class="btn btn-primario" id="relBaixar"><i class="fas fa-download"></i> Baixar e abrir</button>' +
            '  <button class="btn" id="relConfigurar"><i class="fas fa-gear"></i> Configurar relógio</button>' +
            '</div>' +
            '<div class="estado" id="relEstado"></div>' +
            '<div class="config" id="relConfig" hidden>' +
            '  <div class="linha">' +
            '    <label>Endereço (IP)<input id="relIp" placeholder="192.168.1.99"></label>' +
            '    <label>Usuário<input id="relUsuario" autocomplete="off"></label>' +
            '    <label>Senha<input id="relSenha" type="password" autocomplete="new-password"></label>' +
            '    <label>Leiaute<select id="relModo">' +
            '      <option value="">Padrão do relógio</option>' +
            '      <option value="671">Portaria 671/2021</option>' +
            '    </select></label>' +
            '    <label class="marcar" title="Só se o relógio não aceitar conexão segura. Sem HTTPS, a senha e o AFD passam abertos pela rede.">' +
            '<span><input type="checkbox" id="relHttp"> Permitir conexão sem criptografia (HTTP)</span></label>' +
            '    <button class="btn btn-primario" id="relSalvar" style="align-self:flex-end">Salvar</button>' +
            '  </div>' +
            '</div>';
        return painel;
    }

    function estado(texto, erro) {
        var alvo = $('relEstado');
        alvo.textContent = texto;
        alvo.className = 'estado' + (erro ? ' erro' : '');
    }

    function carregarConfig() {
        return pedir('config').then(function (r) { return r.json(); }).then(function (c) {
            $('relIp').value = c.ip || '';
            $('relUsuario').value = '';
            $('relSenha').value = '';
            $('relModo').value = c.modo || '';
            $('relHttp').checked = !!c.permitirHttp;
            if (!c.tem_acesso) {
                $('relConfig').hidden = false;
                estado('Primeiro, informe o usuário e a senha do relógio (os mesmos do Chrome) e clique em Salvar.');
            }
        });
    }

    function salvar() {
        estado('Salvando...');
        pedir('salvar', {
            ip: $('relIp').value, usuario: $('relUsuario').value,
            senha: $('relSenha').value, modo: $('relModo').value, permitirHttp: $('relHttp').checked
        }).then(function () {
            $('relConfig').hidden = true;
            return carregarConfig();
        }).then(function () {
            estado('Configuração salva. Escolha o mês e clique em Baixar e abrir. ' +
                '(Para trocar o acesso, abra Configurar relógio; campo deixado em branco mantém o que já foi salvo.)');
        }).catch(function (e) { estado(e.message, true); });
    }

    function baixar() {
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
        var ancora = document.querySelector('#secaoCarga .zona-acoes');
        if (!ancora || !$('entradaArquivo')) { return; }
        var painel = montarPainel();
        ancora.parentNode.insertBefore(painel, ancora);
        $('relBaixar').addEventListener('click', baixar);
        $('relSalvar').addEventListener('click', salvar);
        $('relConfigurar').addEventListener('click', function () {
            $('relConfig').hidden = !$('relConfig').hidden;
        });
        carregarConfig().catch(function () {
            painel.remove(); // sem relogio.php por trás (por exemplo, a versão do site)
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', iniciar);
    } else {
        iniciar();
    }
})();
