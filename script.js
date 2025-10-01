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

    const formInicio = document.getElementById('form-inicio');
    if (formInicio) {
        // 1. Declaramos uma variável para guardar a instância da Choices.js
        let choicesInstance = null;

        const formStatus = document.getElementById('form-status');
        const telefoneInput = document.getElementById('telefone');
        telefoneInput.addEventListener('input', () => formatarTelefone(telefoneInput));

        async function carregarLojas() {
            try {
                // Prevenção de reinicialização
                const selectLojaElement = document.getElementById('loja');
                if (selectLojaElement.classList.contains('choices__input')) {
                    return; 
                }

                const response = await fetch('/api/lojas');
                if (!response.ok) throw new Error('Não foi possível carregar a lista de lojas.');
                const lojas = await response.json();
                
                selectLojaElement.innerHTML = '<option value="">Selecione ou digite uma loja</option>';

                lojas.forEach(nomeLoja => {
                    const option = document.createElement('option');
                    option.value = nomeLoja;
                    option.textContent = nomeLoja;
                    selectLojaElement.appendChild(option);
                });

                // 2. Guardamos a instância na nossa variável
                choicesInstance = new Choices(selectLojaElement, {
                    searchPlaceholderValue: "Digite para pesquisar...",
                    itemSelectText: "Pressione Enter para selecionar",
                    noResultsText: "Nenhuma loja encontrada",
                    removeItemButton: true
                });

            } catch (error) {
                console.error('Erro ao carregar lojas:', error);
                const selectLoja = document.getElementById('loja');
                selectLoja.innerHTML = '<option value="">Erro ao carregar lojas</option>';
            }
        }

        function carregarDadosUsuario() {
            const nomeSalvo = localStorage.getItem('usuarioNome');
            const telefoneSalvo = localStorage.getItem('usuarioTelefone');
            if (nomeSalvo) document.getElementById('nome').value = nomeSalvo;
            if (telefoneSalvo) document.getElementById('telefone').value = telefoneSalvo;
        }

        formInicio.addEventListener('submit', (event) => {
            event.preventDefault();
            formStatus.textContent = '';
            formStatus.style.color = '';

            // 3. Para obter o valor, perguntamos diretamente à instância da Choices.js
            const loja = choicesInstance ? choicesInstance.getValue(true) : '';

            // A nossa verificação manual agora usa este valor correto
            if (!loja) {
                formStatus.textContent = 'Por favor, selecione uma loja para continuar.';
                formStatus.style.color = 'red';
                return;
            }

            const nome = document.getElementById('nome').value;
            const telefone = document.getElementById('telefone').value;
            
            localStorage.setItem('usuarioNome', nome);
            localStorage.setItem('usuarioTelefone', telefone);
            window.location.href = `produtos.html?loja=${loja}`;
        });

        carregarLojas();
        carregarDadosUsuario();
    }

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
            const precoFormatado = parseFloat(produto.preco).toFixed(2);
            // ESTA É A VERSÃO CORRIGIDA DO HTML, SEM OS TÍTULOS
            const cardHTML = `
                <div class="produto-card" data-codigo="${produto.codigo}" data-preco="${produto.preco}" data-original="true">
                    <div class="produto-imagem">
                        <img src="${produto.url_imagem || 'imagens/placeholder.png'}" alt="${produto.nome}">
                    </div>
                    <div class="produto-info">
                        <div class="nome">${produto.nome}</div>
                        <div class="preco">R$ ${precoFormatado}</div>
                        <div class="campo-quantidade">
                            <input type="number" min="0" step="any" placeholder="Quantidade">
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
            `;
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

        formProdutos.addEventListener('submit', async (event) => {
            event.preventDefault();
            const produtosParaSalvar = [];
            const todosOsCards = document.querySelectorAll('.produto-card');
            todosOsCards.forEach(card => {
                const quantidadeInput = card.querySelector('input[type="number"]');
                const validadeInput = card.querySelector('.campo-data');
                const quantidadeValue = quantidadeInput.value.replace(',', '.');
                const precoDoProduto = card.dataset.preco;
                if (quantidadeValue !== '' && parseFloat(quantidadeValue) >= 0) {
                    produtosParaSalvar.push({
                        codigo: card.dataset.codigo,
                        quantidade: quantidadeValue,
                        validade: validadeInput.value || '',
                        preco: precoDoProduto
                    });
                }
            });
            if (produtosParaSalvar.length === 0) {
                alert('Nenhum item com quantidade preenchida para salvar.');
                return;
            }
            const dadosParaEnviar = {
                loja: new URLSearchParams(window.location.search).get('loja'),
                nome: localStorage.getItem('usuarioNome') || '',
                telefone: localStorage.getItem('usuarioTelefone') || '',
                produtos: produtosParaSalvar
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
        });

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