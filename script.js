// =========================================================
// VERSÃO FINAL COMPLETA DO SCRIPT.JS (COM LOGIN SEGURO)
// =========================================================

// FUNÇÕES GERAIS DE FORMATAÇÃO
function parseCSV(text) {
    const lines = text.trim().split('\n');
    const header = lines[0].split(',').map(h => h.trim());
    const rows = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim());
        let rowObject = {};
        header.forEach((col, index) => { rowObject[col] = values[index]; });
        return rowObject;
    });
    return rows;
}

function formatarTelefone(input) {
    let valor = input.value.replace(/\D/g, '');
    valor = valor.slice(0, 11);
    if (valor.length > 7) {
        valor = `(${valor.slice(0, 2)}) ${valor.slice(2, 7)}-${valor.slice(7)}`;
    } else if (valor.length > 2) {
        valor = `(${valor.slice(0, 2)}) ${valor.slice(2)}`;
    } else if (valor.length > 0) {
        valor = `(${valor.slice(0, 2)}`;
    }
    input.value = valor;
}

function formatarDataEnquantoDigita(input) {
    let valor = input.value.replace(/\D/g, '');
    if (valor.length > 2) { valor = `${valor.slice(0, 2)}/${valor.slice(2)}`; }
    if (valor.length > 5) { valor = `${valor.slice(0, 5)}/${valor.slice(5, 9)}`; }
    input.value = valor;
}

function validarEFormatarDataCompleta(input) {
    let valor = input.value;
    if (valor.length === 0) return;
    const partes = valor.split('/');
    if (partes.length < 3 || partes[2].length === 0) { return; }
    let dia = partes[0];
    let mes = partes[1];
    let ano = partes[2];
    if (dia.length === 1) dia = '0' + dia;
    if (mes.length === 1) mes = '0' + mes;
    if (ano.length === 2) ano = '20' + ano;
    if (parseInt(dia, 10) > 31 || parseInt(mes, 10) > 12) {
        alert(`Data inválida: ${dia}/${mes}/${ano}`);
        input.value = "";
        return;
    }
    input.value = `${dia}/${mes}/${ano}`;
}


// LISTENER PRINCIPAL - Executado quando o HTML da página termina de carregar
document.addEventListener('DOMContentLoaded', () => {

    // --- LÓGICA DO MENU E BOTÕES GLOBAIS ---
    const optionsBtn = document.getElementById('options-btn');
    const dropdownMenu = document.getElementById('dropdown-menu');
    const limparBtn = document.getElementById('limpar-btn');

    if (optionsBtn && dropdownMenu) {
        optionsBtn.addEventListener('click', () => {
            dropdownMenu.classList.toggle('show');
        });
        window.addEventListener('click', (event) => {
            if (!event.target.matches('.options-button, .options-button *')) {
                if (dropdownMenu.classList.contains('show')) {
                    dropdownMenu.classList.remove('show');
                }
            }
        });
    }

    if (limparBtn) {
        limparBtn.addEventListener('click', (event) => {
            event.preventDefault();
            if (document.getElementById('form-produtos')) {
                document.querySelectorAll('.produto-card[data-original="true"]').forEach(card => {
                    card.querySelector('input[type="number"]').value = '';
                    card.querySelector('.campo-data').value = '';
                });
                document.querySelectorAll('.produto-card[data-original="false"]').forEach(card => card.remove());
                alert('Campos preenchidos foram limpos e lotes extras removidos!');
            }
            if (document.getElementById('form-inicio')) {
                document.getElementById('nome').value = '';
                document.getElementById('telefone').value = '';
                document.getElementById('loja').selectedIndex = 0;
                alert('Campos de nome, telefone e loja foram limpos!');
            }
            if (dropdownMenu) dropdownMenu.classList.remove('show');
        });
    }

// DENTRO DO SEU public/script.js, SUBSTITUA O BLOCO if (formInicio)

// Em script.js, substitua o bloco "if (formInicio)" inteiro:

// Em script.js, substitua o bloco "if (formInicio)" inteiro por esta versão completa:

const formInicio = document.getElementById('form-inicio');
if (formInicio) {

    const redeSelect = document.getElementById('rede');
    const lojaSelect = document.getElementById('loja'); // Elemento Loja é necessário novamente
    const formStatus = document.getElementById('form-status');
    const telefoneInput = document.getElementById('telefone');

    // Instâncias do Choices.js para ambos
    let redeChoices = null;
    let lojaChoices = null; // Choices para Loja é necessário novamente

    telefoneInput.addEventListener('input', () => formatarTelefone(telefoneInput));

    // Função para carregar as REDES
    async function carregarRedes() {
        try {
            const response = await fetch('/api/redes');
            if (!response.ok) throw new Error('Não foi possível carregar a lista de redes.');

            const redes = await response.json();

            redeSelect.innerHTML = '<option value="">Selecione ou digite uma rede</option>';
            redes.forEach(nomeRede => {
                const option = document.createElement('option');
                option.value = nomeRede;
                option.textContent = nomeRede;
                redeSelect.appendChild(option);
            });

            // Adiciona a opção "REDE NÃO ENCONTRADA"
            const optionNaoEncontradaRede = document.createElement('option');
            optionNaoEncontradaRede.value = "REDE NÃO ENCONTRADA";
            optionNaoEncontradaRede.textContent = "REDE NÃO ENCONTRADA";
            redeSelect.appendChild(optionNaoEncontradaRede);


            // Inicializa o Choices para Redes
            redeChoices = new Choices(redeSelect, {
                searchPlaceholderValue: "Digite para pesquisar...",
                itemSelectText: "Pressione Enter",
                noResultsText: "Nenhuma rede encontrada",
                removeItemButton: true
            });

            // Inicializa o Choices para Lojas (começa desabilitado)
            // Certifique-se que o elemento <select id="loja"> existe no HTML
            if (lojaSelect) {
                 lojaChoices = new Choices(lojaSelect, {
                    searchPlaceholderValue: "Digite para pesquisar...",
                    itemSelectText: "Pressione Enter",
                    noResultsText: "Nenhuma loja encontrada",
                    removeItemButton: true
                });
                 // Começa desabilitado
                 lojaChoices.disable(); 
            }


        } catch (error) {
            console.error('Erro ao carregar redes:', error);
            redeSelect.innerHTML = '<option value="">Erro ao carregar redes</option>';
        }
    }

    // --- RESTAURAR ESTA FUNÇÃO ---
    // Função para carregar LOJAS filtradas pela REDE
    async function carregarLojasPorRede(nomeRede) {
        if (!lojaChoices) return; // Sai se o Choices de loja não foi inicializado

        // Limpa e desabilita o dropdown de lojas
        lojaChoices.disable();
        lojaChoices.clearStore();
        lojaChoices.setChoices([{ value: '', label: 'Carregando lojas...', selected: true, disabled: true }]);

        if (!nomeRede) {
            lojaChoices.setChoices([{ value: '', label: 'Selecione uma rede primeiro', selected: true, disabled: true }]);
            return;
        }

        try {
            // --- USA A API CORRETA --- (Verifique se a rota /api/lojas existe no server.js e aceita ?rede=)
            const response = await fetch(`/api/lojas?rede=${encodeURIComponent(nomeRede)}`);
            if (!response.ok) throw new Error('Não foi possível carregar as lojas.');

            const lojas = await response.json();

            const opcoesLojas = lojas.map(nomeLoja => ({
                value: nomeLoja,
                label: nomeLoja
            }));

            const opcaoNaoEncontradaLoja = { value: "LOJA NÃO ENCONTRADA", label: "LOJA NÃO ENCONTRADA" };

            // Habilita e preenche o dropdown de lojas
            lojaChoices.enable(); // <-- HABILITA O CAMPO
            lojaChoices.setChoices(
                [
                    { value: '', label: 'Selecione ou digite uma loja' },
                    ...opcoesLojas,
                    opcaoNaoEncontradaLoja
                ],
                'value', 'label', true
            );

        } catch (error) {
            console.error('Erro ao carregar lojas:', error);
            lojaChoices.setChoices([{ value: '', label: 'Erro ao carregar lojas', selected: true, disabled: true }]);
        }
    }

    // --- RESTAURAR ESTE EVENT LISTENER ---
    // Evento: Quando o utilizador MUDA a rede selecionada
    redeSelect.addEventListener('change', (event) => {
        const redeSelecionada = event.target.value;
        carregarLojasPorRede(redeSelecionada);
    });

    // Carrega os dados do utilizador (nome/telefone)
    function carregarDadosUsuario() { /* ... código existente ... */ }

    // Evento: Submissão do formulário (precisa validar Loja novamente)
    formInicio.addEventListener('submit', (event) => {
        event.preventDefault();
        formStatus.textContent = '';
        formStatus.style.color = '';

        const rede = redeChoices ? redeChoices.getValue(true) : '';
        const loja = lojaChoices ? lojaChoices.getValue(true) : ''; // Lê o valor da loja

        if (!rede) {
            formStatus.textContent = 'Por favor, selecione uma rede.';
            formStatus.style.color = 'red';
            return;
        }
        // --- RESTAURAR ESTA VALIDAÇÃO ---
        if (!loja) {
            formStatus.textContent = 'Por favor, selecione uma loja para continuar.';
            formStatus.style.color = 'red';
            return;
        }

        const nome = document.getElementById('nome').value;
        const telefone = document.getElementById('telefone').value;
        const observacao = document.getElementById('observacao').value;

        localStorage.setItem('usuarioNome', nome);
        localStorage.setItem('usuarioTelefone', telefone);
        localStorage.setItem('usuarioObservacao', observacao);

        // --- RESTAURAR PASSAGEM DO PARÂMETRO 'loja' ---
        window.location.href = `produtos.html?rede=${rede}&loja=${loja}`;
    });

    carregarRedes(); // Carrega as redes e inicializa ambos Choices
    carregarDadosUsuario();
} // Fim do if (formInicio)


    // --- LÓGICA DA PÁGINA DE PRODUTOS (PRODUTOS.HTML) ---
    const formProdutos = document.getElementById('form-produtos');
    if (formProdutos) {
// DENTRO DO SEU script.js, SUBSTITUA A FUNÇÃO carregarTudo INTEIRA

async function carregarTudo() {
    const urlParams = new URLSearchParams(window.location.search);
    const nomeLoja = urlParams.get('loja');
    if (!nomeLoja) {
        document.getElementById('titulo-loja').textContent = "Loja não encontrada";
        return;
    }
    document.getElementById('titulo-loja').textContent = `Produtos da ${nomeLoja}`;

    try {
        const response = await fetch(`/api/produtos?loja=${nomeLoja}`);
        if (!response.ok) throw new Error('Não foi possível carregar os produtos do servidor.');
        
        const produtosDaLoja = await response.json();
        const containerProdutos = document.getElementById('lista-produtos');
        let htmlParaInserir = '';

        produtosDaLoja.forEach(produto => {
            // ESTA É A VERSÃO CORRIGIDA DO HTML, SEM OS TÍTULOS
            // Dentro da função carregarTudo() em script.js

        // Dentro da função carregarTudo() em script.js

// !!! Lembre-se de colocar a sua URL real do Cloudinary aqui !!!
        const cloudinaryBaseUrl = "https://res.cloudinary.com/dlnk6p5ug/image/upload/";

        const precoFormatado = parseFloat(produto.preco).toFixed(2);

        // SUBSTITUA O BLOCO INTEIRO POR ESTE CÓDIGO ABAIXO:
        const cardHTML = `
            <div class="produto-card" data-codigo="${produto.codigo}" data-nome="${produto.nome}" data-unidade="${produto.unidade}" data-original="true">
                <div class="produto-imagem">
                    <img src="${cloudinaryBaseUrl}${produto.codigo}.png" 
                        alt="${produto.nome}" 
                        onerror="this.onerror=null;this.src='imagens/placeholder.png';">
                </div>
                <div class="produto-info">
                    <div class="nome">${produto.nome}</div>
                    <div class="preco-container">
                        <div class="campo-preco-unitario">
                            <label>Preço Unit.</label>
                            <input type="number" min="0" step="0.01" class="campo-preco" placeholder="R$" value="${precoFormatado}">
                        </div>
                        <div class="checkboxes-container">
                            <label class="checkbox-label">
                                <input type="checkbox" class="campo-promocao"> Preço promocional?
                            </label>
                            <label class="checkbox-label">
                                <input type="checkbox" class="campo-ponto-extra"> Ponto extra?
                            </label>
                        </div>
                    </div>
                    <div class="campo-quantidade">
                        <input type="number" min="0" step="any" class="campo-qtde" placeholder="Quantidade">
                        <span class="unidade-texto">${produto.unidade}</span>
                    </div>
                    <div class="unidade">${produto.unidade}</div>
                    <div class="validade-acao-wrapper">
                        <div class="campo-validade">
                            <input type="text" class="campo-data" placeholder="DD/MM/AAAA" maxlength="10" inputmode="numeric">
                        </div>
                        <div class="acao">
                            <button type="button" class="btn-duplicar">+</button>
                        </div>
                    </div>
                </div>
            </div>
        `; // <--- O acento grave e o ponto e vírgula de fecho estão aqui.
            htmlParaInserir += cardHTML;
        });

        // Limpa apenas os cartões de produto antigos, preservando o cabeçalho
        containerProdutos.querySelectorAll('.produto-card').forEach(card => card.remove());
        // Adiciona os novos cartões no final, depois do cabeçalho.
        containerProdutos.insertAdjacentHTML('beforeend', htmlParaInserir);

    } catch (error) {
        console.error("Erro ao carregar produtos:", error);
        document.getElementById('lista-produtos').innerHTML = '<p style="color: red; text-align: center;">Ocorreu um erro ao carregar os produtos.</p>';
    }
}

        const containerLista = document.getElementById('lista-produtos');
        containerLista.addEventListener('input', (event) => {
            if (event.target.classList.contains('campo-data')) {
                formatarDataEnquantoDigita(event.target);
            }
        });
        containerLista.addEventListener('focusout', (event) => {
            if (event.target.classList.contains('campo-data')) {
                validarEFormatarDataCompleta(event.target);
            }
        });
        containerLista.addEventListener('click', function(event) {
            if (event.target.classList.contains('btn-duplicar')) {
                const linhaOriginal = event.target.closest('.produto-card');
                if (linhaOriginal) {
                    const novaLinha = linhaOriginal.cloneNode(true);
                    novaLinha.dataset.original = "false";
                    novaLinha.querySelector('input[type="number"]').value = '';
                    novaLinha.querySelector('.campo-data').value = '';
                    const containerAcao = novaLinha.querySelector('.acao');
                    containerAcao.innerHTML = '<button type="button" class="btn-remover">-</button>';
                    linhaOriginal.after(novaLinha);
                }
            }
            if (event.target.classList.contains('btn-remover')) {
                const linhaParaRemover = event.target.closest('.produto-card');
                if (linhaParaRemover) {
                    linhaParaRemover.remove();
                }
            }
        });

// Em script.js, substitua o listener de submit inteiro por este:

// --- LÓGICA DE SUBMISSÃO DO FORMULÁRIO DE PRODUTOS ---
if (formProdutos) {
    // Seleciona os elementos do novo modal
    const modalConfirmacao = document.getElementById('modal-confirmacao-vazia');
    const btnFecharModal = document.getElementById('fechar-modal-confirmacao');
    const btnConfirmarEnvio = document.getElementById('btn-confirmar-envio');
    const btnCancelarEnvio = document.getElementById('btn-cancelar-envio');

    // Função para esconder o modal
    const esconderModal = () => {
        if (modalConfirmacao) modalConfirmacao.style.display = 'none';
    };

    // Adiciona eventos para fechar o modal
    if(modalConfirmacao) {
        btnFecharModal.addEventListener('click', esconderModal);
        btnCancelarEnvio.addEventListener('click', esconderModal);
        modalConfirmacao.addEventListener('click', (event) => {
            if (event.target === modalConfirmacao) esconderModal();
        });
    }

    // Função refatorada para enviar os dados ao servidor
const enviarDadosParaServidor = async (produtos) => {
    const dadosParaEnviar = {
        rede: new URLSearchParams(window.location.search).get('rede'), // Ou 'loja' se reverteu
        nome: localStorage.getItem('usuarioNome') || '',
        telefone: localStorage.getItem('usuarioTelefone') || '',
        // --- ADICIONAR ESTA LINHA ---
        observacao: localStorage.getItem('usuarioObservacao') || '', // Ler a observação
        produtos: produtos
    };

        try {
            const response = await fetch('/api/adicionar_item', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dadosParaEnviar)
            });
            if (response.ok) {
                window.location.href = 'confirmacao.html';
            } else {
                const erro = await response.json();
                alert(`Erro ao salvar: ${erro.message || 'Erro desconhecido'}`);
            }
        } catch (error) {
            console.error('Erro de comunicação com o servidor:', error);
            alert('Não foi possível conectar ao servidor para salvar os dados.');
        }
    };

    // Evento principal de submissão do formulário
    formProdutos.addEventListener('submit', (event) => {
        event.preventDefault();

        let produtosParaSalvar = [];
        const todosOsCards = document.querySelectorAll('.produto-card');

        todosOsCards.forEach(card => {
            const quantidadeInput = card.querySelector('.campo-qtde');
            if (quantidadeInput.value && parseFloat(quantidadeInput.value.replace(',', '.')) > 0) {
                produtosParaSalvar.push({
                    codigo: card.dataset.codigo,
                    quantidade: quantidadeInput.value.replace(',', '.'),
                    validade: card.querySelector('.campo-data').value || '',
                    preco: card.querySelector('.campo-preco').value.replace(',', '.'),
                    promocao: card.querySelector('.campo-promocao').checked,
                    ponto_extra: card.querySelector('.campo-ponto-extra').checked
                });
            }
        });

        if (produtosParaSalvar.length > 0) {
            // Se a lista NÃO está vazia, envia diretamente
            enviarDadosParaServidor(produtosParaSalvar);
        } else {
            // Se a lista ESTÁ vazia, mostra o nosso modal personalizado
            if(modalConfirmacao) modalConfirmacao.style.display = 'flex';
        }
    });

    // Evento para o botão "Sim" do modal
    if (btnConfirmarEnvio) {
        btnConfirmarEnvio.addEventListener('click', () => {
            const primeiroCard = document.querySelector('.produto-card[data-original="true"]');
            if (primeiroCard) {
                const hoje = new Date();
                const dia = String(hoje.getDate()).padStart(2, '0');
                const mes = String(hoje.getMonth() + 1).padStart(2, '0');
                const ano = hoje.getFullYear();
                const dataDeHoje = `${dia}/${mes}/${ano}`;

                const produtoVazio = [{
                    codigo: primeiroCard.dataset.codigo,
                    quantidade: '0',
                    validade: dataDeHoje,
                    preco: primeiroCard.querySelector('.campo-preco').value.replace(',', '.'),
                    promocao: false,
                    ponto_extra: false
                }];

                enviarDadosParaServidor(produtoVazio);
            }
            esconderModal();
        });
    }
}

        carregarTudo();
    }

    // --- LÓGICA DO MODAL DE LOGIN (INDEX.HTML) ---
    const adminLink = document.getElementById('admin-link');
    const modal = document.getElementById('login-modal');

    if (adminLink && modal) {
        const closeButton = modal.querySelector('.close-button');
        const loginForm = document.getElementById('login-form');
        const usernameInput = document.getElementById('username'); // Captura o novo campo
        const passwordInput = document.getElementById('password');
        const loginError = document.getElementById('login-error');

        adminLink.addEventListener('click', (event) => {
            event.preventDefault();
            modal.style.display = 'flex';
            usernameInput.value = '';
            passwordInput.value = '';
            loginError.textContent = '';
            usernameInput.focus();
        });

        const closeModal = () => {
            modal.style.display = 'none';
        };
        closeButton.addEventListener('click', closeModal);
        modal.addEventListener('click', (event) => {
            if (event.target === modal) {
                closeModal();
            }
        });
        
        // ##### ALTERAÇÃO FINAL E MAIS IMPORTANTE #####
        // Substituímos a verificação de senha local por uma chamada à API.
        loginForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            loginError.textContent = ''; // Limpa erros antigos

            const username = usernameInput.value;
            const password = passwordInput.value;

            try {
                const response = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
                
                const result = await response.json();

                if (response.ok) {
                    // Login bem-sucedido, o servidor criou a sessão. Agora podemos redirecionar.
                    window.location.href = adminLink.href;
                } else {
                    // O servidor respondeu com um erro (ex: senha inválida)
                    loginError.textContent = result.message;
                }
            } catch (error) {
                // Erro de rede ou o servidor não respondeu
                loginError.textContent = 'Erro de conexão com o servidor.';
            }
        });
    }
});
// --- LÓGICA PARA O BOTÃO FLUTUANTE ---
const botaoFlutuante = document.getElementById('botao-flutuante');
if (botaoFlutuante) {
    // Mostra o botão quando o utilizador rolar a página para baixo
    window.addEventListener('scroll', () => {
        if (window.scrollY > 300) { // Aparece depois de rolar 300 pixels
            botaoFlutuante.style.display = 'block';
        } else {
            botaoFlutuante.style.display = 'none';
        }
    });

    // Adiciona uma rolagem suave ao clicar
    botaoFlutuante.addEventListener('click', (event) => {
        event.preventDefault();
        const targetId = botaoFlutuante.getAttribute('href');
        const targetElement = document.querySelector(targetId);
        if (targetElement) {
            targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    });
}