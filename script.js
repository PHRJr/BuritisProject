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

// =========================================================
// INÍCIO DO NOVO BLOCO "formInicio" (SEM CHOICES.JS)
// =========================================================

const formInicio = document.getElementById('form-inicio');
if (formInicio) {

    // --- Selecionar os novos elementos ---
    const redeSearchInput = document.getElementById('rede-search');
    const redeHiddenInput = document.getElementById('rede-hidden');
    const redeOptionsContainer = document.getElementById('rede-options');
    
    const lojaSearchInput = document.getElementById('loja-search');
    const lojaHiddenInput = document.getElementById('loja-hidden');
    const lojaOptionsContainer = document.getElementById('loja-options');

    const formStatus = document.getElementById('form-status');
    const telefoneInput = document.getElementById('telefone');

    telefoneInput.addEventListener('input', () => formatarTelefone(telefoneInput));

    let todasAsRedes = [];
    let todasAsLojas = [];

    // --- Função para popular o dropdown de Redes ---
    function popularRedes(listaRedes) {
        // Limpa apenas as opções antigas, mantendo a "sticky-option"
        redeOptionsContainer.querySelectorAll('.option-item:not(.sticky-option)').forEach(el => el.remove());
        
        const stickyOption = redeOptionsContainer.querySelector('.sticky-option');
        
        listaRedes.forEach(nomeRede => {
            const div = document.createElement('div');
            div.className = 'option-item';
            div.textContent = nomeRede;
            div.dataset.value = nomeRede;
            // Insere antes da opção sticky
            redeOptionsContainer.insertBefore(div, stickyOption);
        });
    }

    // --- Função para popular o dropdown de Lojas ---
    function popularLojas(listaLojas) {
        lojaOptionsContainer.querySelectorAll('.option-item:not(.sticky-option)').forEach(el => el.remove());
        const stickyOption = lojaOptionsContainer.querySelector('.sticky-option');
        
        listaLojas.forEach(nomeLoja => {
            const div = document.createElement('div');
            div.className = 'option-item';
            div.textContent = nomeLoja;
            div.dataset.value = nomeLoja;
            lojaOptionsContainer.insertBefore(div, stickyOption);
        });
    }

    // --- Carregar as Redes da API ---
    async function carregarRedes() {
        try {
            const response = await fetch('/api/redes');
            if (!response.ok) throw new Error('Não foi possível carregar a lista de redes.');
            
            todasAsRedes = await response.json();
            popularRedes(todasAsRedes);

        } catch (error) {
            console.error('Erro ao carregar redes:', error);
            redeSearchInput.placeholder = "Erro ao carregar redes";
        }
    }

    // --- Carregar Lojas da API com base na Rede ---
    async function carregarLojasPorRede(nomeRede) {
        // Limpa e desabilita o campo de lojas
        lojaSearchInput.value = '';
        lojaHiddenInput.value = '';
        lojaSearchInput.placeholder = 'Carregando lojas...';
        popularLojas([]); // Limpa a lista
        
        if (!nomeRede) {
            lojaSearchInput.placeholder = 'Selecione uma rede primeiro';
            lojaSearchInput.disabled = true;
            return;
        }

        try {
            const response = await fetch(`/api/lojas?rede=${encodeURIComponent(nomeRede)}`);
            if (!response.ok) throw new Error('Não foi possível carregar as lojas.');
            
            todasAsLojas = await response.json();
            popularLojas(todasAsLojas);
            lojaSearchInput.disabled = false;
            lojaSearchInput.placeholder = 'Selecione ou digite uma loja';

        } catch (error) {
            console.error('Erro ao carregar lojas:', error);
            lojaSearchInput.placeholder = "Erro ao carregar lojas";
            lojaSearchInput.disabled = false;
        }
    }

    // --- LÓGICA DE EVENTOS (A MAGIA ACONTECE AQUI) ---

    // Função genérica de filtro (ESTA É A LÓGICA CHAVE)
    function filtrarOpcoes(input, container) {
        const filtro = input.value.toLowerCase();
        const opcoes = container.querySelectorAll('.option-item');
        
        opcoes.forEach(opcao => {
            // Se for a opção "pegajosa" (sticky), ignora e nunca esconde
            if (opcao.classList.contains('sticky-option')) {
                return; // Deixa sempre visível
            }
            
            // Esconde ou mostra as outras opções
            const texto = opcao.textContent.toLowerCase();
            if (texto.includes(filtro)) {
                opcao.classList.remove('hidden');
            } else {
                opcao.classList.add('hidden');
            }
        });
    }

    // --- Eventos para o dropdown de REDES ---
    redeSearchInput.addEventListener('focus', () => {
        redeOptionsContainer.classList.remove('hidden');
        filtrarOpcoes(redeSearchInput, redeOptionsContainer); // Mostra todas ao focar
    });
    redeSearchInput.addEventListener('input', () => {
        filtrarOpcoes(redeSearchInput, redeOptionsContainer);
        // Limpa a seleção se o utilizador estiver a digitar
        redeHiddenInput.value = ''; 
    });
    redeOptionsContainer.addEventListener('mousedown', (e) => { // mousedown é melhor que click
        if (e.target.classList.contains('option-item')) {
            const valor = e.target.dataset.value;
            redeSearchInput.value = e.target.textContent;
            redeHiddenInput.value = valor;
            redeOptionsContainer.classList.add('hidden');
            // Carrega as lojas correspondentes
            carregarLojasPorRede(valor);
        }
    });

    // --- Eventos para o dropdown de LOJAS ---
    lojaSearchInput.addEventListener('focus', () => {
        lojaOptionsContainer.classList.remove('hidden');
        filtrarOpcoes(lojaSearchInput, lojaOptionsContainer);
    });
    lojaSearchInput.addEventListener('input', () => {
        filtrarOpcoes(lojaSearchInput, lojaOptionsContainer);
        lojaHiddenInput.value = '';
    });
    lojaOptionsContainer.addEventListener('mousedown', (e) => {
        if (e.target.classList.contains('option-item')) {
            const valor = e.target.dataset.value;
            lojaSearchInput.value = e.target.textContent;
            lojaHiddenInput.value = valor;
            lojaOptionsContainer.classList.add('hidden');
        }
    });

    // --- Esconder os dropdowns se clicar fora ---
    document.addEventListener('click', (e) => {
        if (!formInicio.contains(e.target)) {
            redeOptionsContainer.classList.add('hidden');
            lojaOptionsContainer.classList.add('hidden');
        }
    });

    // --- Carregar dados do utilizador (Nome/Telefone) ---
    function carregarDadosUsuario() { 
        const nome = localStorage.getItem('usuarioNome');
        const telefone = localStorage.getItem('usuarioTelefone');
        if (nome) document.getElementById('nome').value = nome;
        if (telefone) document.getElementById('telefone').value = telefone;
    }

    // --- Submissão do Formulário ---
    formInicio.addEventListener('submit', (event) => {
        event.preventDefault();
        formStatus.textContent = '';
        formStatus.style.color = '';

        const rede = redeHiddenInput.value; // Pega o valor do input escondido
        const loja = lojaHiddenInput.value; // Pega o valor do input escondido

        if (!rede) {
            formStatus.textContent = 'Por favor, selecione uma rede.';
            formStatus.style.color = 'red';
            return;
        }
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

        window.location.href = `produtos.html?rede=${rede}&loja=${loja}`;
    });

    // --- Iniciar tudo ---
    carregarRedes();
    carregarDadosUsuario();
}
// =========================================================
// FIM DO NOVO BLOCO "formInicio"
// =========================================================


    // --- LÓGICA DA PÁGINA DE PRODUTOS (PRODUTOS.HTML) ---
    const formProdutos = document.getElementById('form-produtos');
    if (formProdutos) {
// DENTRO DO SEU script.js, SUBSTITUA A FUNÇÃO carregarTudo INTEIRA

// Em script.js, substitua a função carregarTudo inteira:

async function carregarTudo() {
    const urlParams = new URLSearchParams(window.location.search);
    const nomeRede = urlParams.get('rede');
    const nomeLoja = urlParams.get('loja');

    // --- CORREÇÃO: Mover declarações para o TOPO da função ---
    const tituloElement = document.getElementById('titulo-loja');
    const containerProdutos = document.getElementById('lista-produtos');
    // --- FIM DA CORREÇÃO ---

if (nomeRede) {
    // Modifique esta parte
    let titulo = `Produtos da Rede: ${nomeRede}`;
    if (nomeLoja) { // Adiciona a loja se existir
        titulo += ` (Loja: ${nomeLoja})`;
    }
    // Adiciona um aviso se a rede for a genérica ou se for um fallback (podemos inferir isso se a lista for muito grande, mas é mais complexo)
    // Uma forma simples é verificar se a rede é a "Não Encontrada"
    if (nomeRede === "REDE NÃO ENCONTRADA") {
        titulo += " (Exibindo TODOS os produtos)";
    }
    tituloElement.textContent = titulo;

} else {
    // ... (código existente para rede não especificada) ...
}
    //const containerProdutos = document.getElementById('lista-produtos');

    // Atualiza o título da página usando a Rede (e a Loja se disponível)
    if (nomeRede) {
        tituloElement.textContent = `Produtos da Rede: ${nomeRede}` + (nomeLoja ? ` (Loja: ${nomeLoja})` : '');
    } else {
        tituloElement.textContent = "Rede não especificada";
        containerProdutos.innerHTML = '<p style="color: red; text-align: center;">Erro: Nenhuma rede foi selecionada na página anterior.</p>';
        return; // Interrompe se não houver rede
    }

    try {
        // CORREÇÃO: Chamamos a API /api/produtos_por_rede, filtrando pela 'rede'
        const response = await fetch(`/api/produtos_por_rede?rede=${encodeURIComponent(nomeRede)}`);

        if (!response.ok) {
             const errorData = await response.json().catch(() => ({ message: `Erro ${response.status} ao buscar produtos.` }));
             throw new Error(errorData.message || `Não foi possível carregar os produtos (${response.status})`);
        }

        const produtosDaRede = await response.json(); // Renomeado para clareza

        // Limpa apenas os cartões de produto antigos, preservando o cabeçalho
        containerProdutos.querySelectorAll('.produto-card').forEach(card => card.remove());

        if (produtosDaRede.length === 0) {
             containerProdutos.insertAdjacentHTML('beforeend', '<p style="text-align: center; margin-top: 20px;">Nenhum produto encontrado para esta rede.</p>');
             return;
        }

        let htmlParaInserir = '';
        // !!! Lembre-se de colocar a sua URL real do Cloudinary aqui !!!
        const cloudinaryBaseUrl = "https://res.cloudinary.com/dlnk6p5ug/image/upload/";

        produtosDaRede.forEach(produto => { // Iterar sobre produtosDaRede
            // Define o precoFormatado DENTRO do loop
            const precoFormatado = parseFloat(produto.preco).toFixed(2);
            // O HTML do card (sem alterações na estrutura interna)
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
            `;
            htmlParaInserir += cardHTML;
        });

        // Adiciona os novos cartões no final.
        containerProdutos.insertAdjacentHTML('beforeend', htmlParaInserir);

    } catch (error) {
        console.error("Erro ao carregar produtos:", error);
        containerProdutos.querySelectorAll('.produto-card').forEach(card => card.remove());
        containerProdutos.insertAdjacentHTML('beforeend', `<p style="color: red; text-align: center;">Ocorreu um erro ao carregar os produtos: ${error.message}</p>`);
    }
}

// Garante que a função seja chamada quando o DOM estiver pronto
if (document.getElementById('form-produtos')) {
    // Remove qualquer listener antigo para evitar duplicação
    document.removeEventListener('DOMContentLoaded', carregarTudo);
    // Adiciona o listener atualizado
    document.addEventListener('DOMContentLoaded', carregarTudo);
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