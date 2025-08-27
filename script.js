// Funções de formatação (parseCSV, formatarTelefone, etc.) - Nenhuma mudança aqui
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
// Fim das Funções de formatação

document.addEventListener('DOMContentLoaded', () => {
    // Lógica do menu dropdown e botão limpar - Nenhuma mudança aqui
    const optionsBtn = document.getElementById('options-btn');
    const dropdownMenu = document.getElementById('dropdown-menu');
    const limparBtn = document.getElementById('limpar-btn');

    if (optionsBtn && dropdownMenu) {
        optionsBtn.addEventListener('click', () => {
            dropdownMenu.classList.toggle('show');
        });
        window.addEventListener('click', (event) => {
            if (!event.target.matches('.options-button, .options-button .bar')) {
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
    // Fim da lógica do menu

    const formInicio = document.getElementById('form-inicio');
    if (formInicio) {
        // Nenhuma mudança aqui
        const telefoneInput = document.getElementById('telefone');
        telefoneInput.addEventListener('input', () => formatarTelefone(telefoneInput));
        async function carregarLojas() {
            try {
                const response = await fetch('/lojas.csv');
                const textoCsv = await response.text();
                const linhas = textoCsv.split('\n');
                const lojas = linhas[0].trim().split(',');
                const selectLoja = document.getElementById('loja');
                selectLoja.innerHTML = '<option value="">Selecione uma loja</option>';
                lojas.forEach(loja => {
                    const option = document.createElement('option');
                    option.value = loja;
                    option.textContent = loja;
                    selectLoja.appendChild(option);
                });
            } catch (error) { console.error('Erro ao carregar o arquivo de lojas:', error); }
        }
        function carregarDadosUsuario() {
            const nomeSalvo = localStorage.getItem('usuarioNome');
            const telefoneSalvo = localStorage.getItem('usuarioTelefone');
            if (nomeSalvo) document.getElementById('nome').value = nomeSalvo;
            if (telefoneSalvo) document.getElementById('telefone').value = telefoneSalvo;
        }
        formInicio.addEventListener('submit', (event) => {
            event.preventDefault();
            const nome = document.getElementById('nome').value;
            const telefone = document.getElementById('telefone').value;
            const loja = document.getElementById('loja').value;
            localStorage.setItem('usuarioNome', nome);
            localStorage.setItem('usuarioTelefone', telefone);
            window.location.href = `produtos.html?loja=${loja}`;
        });
        carregarLojas();
        carregarDadosUsuario();
    }

    const formProdutos = document.getElementById('form-produtos');
    if (formProdutos) {
        // Lógica de carregar produtos - Nenhuma mudança aqui
        async function carregarTudo() {
            const urlParams = new URLSearchParams(window.location.search);
            const nomeLoja = urlParams.get('loja');
            if (!nomeLoja) { document.getElementById('titulo-loja').textContent = "Loja não encontrada"; return; }
            document.getElementById('titulo-loja').textContent = `Produtos da ${nomeLoja}`;
            try {
                const [respLojas, respProdutos] = await Promise.all([fetch('/lojas.csv'), fetch('/produtos.csv')]);
                const textoLojas = await respLojas.text();
                const textoProdutos = await respProdutos.text();
                const produtosDb = parseCSV(textoProdutos).reduce((map, prod) => { map[prod.codigo] = prod; return map; }, {});
                const linhasLojas = textoLojas.trim().split('\n');
                const cabecalhoLojas = linhasLojas[0].split(',').map(h => h.trim());
                const indiceLoja = cabecalhoLojas.indexOf(nomeLoja);
                if (indiceLoja === -1) { throw new Error(`Loja não encontrada`); }
                const codigosDaLoja = linhasLojas.slice(1).map(linha => linha.split(',')[indiceLoja]?.trim()).filter(codigo => codigo);
                const containerProdutos = document.getElementById('lista-produtos');
                let htmlParaInserir = '';
                codigosDaLoja.forEach(codigo => {
                    const produto = produtosDb[codigo];
                    if (produto) {
                        const cardHTML = `
                            <div class="produto-card" data-codigo="${produto.codigo}" data-original="true">
                                <div class="produto-imagem"><img src="imagens/${produto.codigo}.jpg" alt="${produto.nome}" onerror="this.onerror=null; this.src='imagens/${produto.codigo}.png';"></div>
                                <div class="produto-info">
                                    <div class="nome">${produto.nome}</div>
                                    <div class="preco">R$ ${parseFloat(produto.preco_unitario).toFixed(2)}</div>
                                    <div class="campo-quantidade"><input type="number" min="0" step="any"><span class="unidade-texto">${produto.unidade}</span></div>
                                    <div class="unidade">${produto.unidade}</div>
                                    <div class="validade-acao-wrapper">
                                        <div class="campo-validade"><input type="text" class="campo-data" placeholder="DD/MM/AAAA" maxlength="10" inputmode="numeric"></div>
                                        <div class="acao"><button type="button" class="btn-duplicar">+</button></div>
                                    </div>
                                </div>
                            </div>
                        `;
                        htmlParaInserir += cardHTML;
                    }
                });
                containerProdutos.insertAdjacentHTML('beforeend', htmlParaInserir);
            } catch (error) { console.error("Erro ao carregar produtos:", error); }
        }
        
        // Lógica de eventos de input e click - Nenhuma mudança aqui
        const containerLista = document.getElementById('lista-produtos');
        containerLista.addEventListener('input', (event) => { if (event.target.classList.contains('campo-data')) { formatarDataEnquantoDigita(event.target); } });
        containerLista.addEventListener('focusout', (event) => { if (event.target.classList.contains('campo-data')) { validarEFormatarDataCompleta(event.target); } });
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

        // Lógica de SUBMIT do formulário - ÚNICA MUDANÇA ESTÁ AQUI
        formProdutos.addEventListener('submit', async (event) => {
            event.preventDefault();
            const produtosParaSalvar = [];
            const todosOsCards = document.querySelectorAll('.produto-card');
            todosOsCards.forEach(card => {
                const quantidadeInput = card.querySelector('input[type="number"]');
                const validadeInput = card.querySelector('.campo-data');
                if (quantidadeInput.value !== '' && parseFloat(quantidadeInput.value.replace(',', '.')) >= 0) {
                    produtosParaSalvar.push({ codigo: card.dataset.codigo, quantidade: quantidadeInput.value, validade: validadeInput.value || '' });
                }
            });
            if (produtosParaSalvar.length === 0) { alert('Nenhum item com quantidade preenchida para salvar.'); return; }
            const dadosParaEnviar = {
                loja: new URLSearchParams(window.location.search).get('loja'),
                nome: localStorage.getItem('usuarioNome') || '',
                telefone: localStorage.getItem('usuarioTelefone') || '',
                produtos: produtosParaSalvar
            };
            try {
                // AQUI ESTÁ A MUDANÇA!
                const response = await fetch('/api/adicionar_item', { 
                    method: 'POST', 
                    headers: { 'Content-Type': 'application/json' }, 
                    body: JSON.stringify(dadosParaEnviar) 
                });
                if (response.ok) { 
                    window.location.href = 'confirmacao.html'; 
                } else { 
                    const erro = await response.json(); 
                    alert(`Erro ao salvar: ${erro.error || 'Erro desconhecido'}`); 
                }
            } catch (error) { 
                console.error('Erro de comunicação com o servidor:', error); 
                alert('Não foi possível conectar ao servidor para salvar os dados.'); 
            }
        });
        
        carregarTudo();
    }
});

//Comentário para assimilar
