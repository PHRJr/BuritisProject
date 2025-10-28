// =================================================================
// ARQUIVO server.js - VERSÃO FINAL (Otimizada c/ Tabela Temporária e Delimitador ';')
// =================================================================
require('dotenv').config();

// --- 1. IMPORTAÇÕES ---
const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const session = require('express-session');
const bcrypt = require('bcrypt');
const multer = require('multer');
const csv = require('csv-parser'); // Usado apenas para parsing inicial, não para COPY
const copyFrom = require('pg-copy-streams').from; // Para o COPY otimizado
const stream = require('stream');
const { Parser } = require('json2csv'); // Para exportação

// --- 2. CONFIGURAÇÃO INICIAL ---
const app = express();
const port = process.env.PORT || 3000;
const upload = multer({ storage: multer.memoryStorage() });
const isProduction = process.env.NODE_ENV === 'production';

// --- 3. MIDDLEWARE GERAL---
app.use(express.json());
app.set('trust proxy', 1); // Confia no proxy da Render

// --- 4. CONEXÃO COM O BANCO DE DADOS ---
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    // CORREÇÃO: Usamos SSL sempre, mas permitimos certificados não verificados
    ssl: {
        rejectUnauthorized: false
    }
});

// --- 5. CONFIGURAÇÃO DA SESSÃO ---
app.use(session({
    secret: process.env.SESSION_SECRET || 'seu-segredo-deve-ser-muito-bem-guardado',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: isProduction,
        maxAge: 24 * 60 * 60 * 1000, // 24 horas
        httpOnly: true
    }
}));

// --- 6. MIDDLEWARE DE AUTENTICAÇÃO ---
const isUserLoggedIn = (req, res, next) => {
    if (req.session.user) {
        return next();
    }
    if (req.headers.accept && req.headers.accept.includes('json')) {
        return res.status(401).json({ message: 'Acesso não autorizado.' });
    } else {
        return res.redirect('/login.html');
    }
};

const isAdminLoggedIn = (req, res, next) => {
    if (req.session.user && req.session.user.role === 'admin') {
        return next();
    }
    // Se não for admin, redireciona para a página de login de admin
    // Ou pode redirecionar para a página de login normal, dependendo da sua preferência
    res.redirect('/login_admin.html');
};

// --- FUNÇÃO AUXILIAR PARA LER CSVs (Usada para verificações, não para COPY principal) ---
function parseCsvBuffer(buffer, options = {}) {
    return new Promise((resolve, reject) => {
        const results = [];
        const bufferStream = new stream.PassThrough();
        bufferStream.end(buffer);
        // Ajusta o parser para usar ponto e vírgula se necessário para validações prévias
        const parserOptions = { separator: ';', ...options };
        bufferStream
            .pipe(csv(parserOptions))
            .on('data', (data) => results.push(data))
            .on('end', () => resolve(results))
            .on('error', (error) => reject(error));
    });
}


// =================================================================
// 7. ROTAS
// =================================================================

// --- ROTA RAIZ ---
app.get('/', (req, res) => {
    res.redirect('/login.html');
});

// --- ROTA DE DIAGNÓSTICO (Opcional, pode remover se não precisar mais) ---
app.get('/api/db-test', async (req, res) => {
    try {
        const client = await pool.connect();
        // Verifica se a tabela 'produtos' existe e tem dados
        const result = await client.query('SELECT codigo FROM produtos LIMIT 5');
        client.release();
        res.status(200).json({
            message: 'Conexão e consulta ao BD bem-sucedidas!',
            produtosEncontrados: result.rowCount,
            dadosExemplo: result.rows
        });
    } catch (error) {
        res.status(500).json({ message: 'Falha no teste de BD.', error: error.message });
    }
});


// --- ROTAS DE PÁGINAS PROTEGIDAS ---
app.get('/index.html', isUserLoggedIn, (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/produtos.html', isUserLoggedIn, (req, res) => res.sendFile(path.join(__dirname, 'produtos.html')));
app.get('/admin.html', isAdminLoggedIn, (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));


// --- ROTAS DE API DE AUTENTICAÇÃO ---
// Login de Utilizador (com senha única)
app.post('/api/user-login', async (req, res) => {
    const { senha } = req.body;
    try {
        const result = await pool.query('SELECT * FROM utilizadores_padrao WHERE email = $1', [senha]);
        if (result.rows.length > 0) {
            req.session.user = { id: result.rows[0].senha, role: 'user' };
            return res.status(200).json({ message: 'Login bem-sucedido!' });
        }
        res.status(401).json({ message: 'Código de acesso inválido.' });
    } catch (error) {
        console.error('Erro no login de utilizador:', error);
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
});

// Login de Admin
app.post('/api/admin-login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM usuarios WHERE email = $1', [email]);
        const adminUser = result.rows[0];
        if (adminUser && await bcrypt.compare(password, adminUser.password_hash)) {
            req.session.user = { id: adminUser.id, email: adminUser.email, role: 'admin' };
            return res.status(200).json({ message: 'Login de admin bem-sucedido!' });
        }
        res.status(401).json({ message: 'Email ou senha inválidos.' });
    } catch (error) {
        console.error('Erro no login de admin:', error);
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
});

// Logout
app.post('/api/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) return res.status(500).json({ message: 'Não foi possível fazer logout.' });
        res.clearCookie('connect.sid'); // Limpa o cookie de sessão
        res.status(200).json({ message: 'Logout bem-sucedido.' });
    });
});


// --- ROTAS DE API DE DADOS (BASEADAS NA NOVA ESTRUTURA) ---

// Busca redes únicas (agora da tabela redes_lojas para garantir que só redes com lojas apareçam)
app.get('/api/redes', isUserLoggedIn, async (req, res) => {
    try {
        const result = await pool.query('SELECT DISTINCT rede FROM redes_lojas ORDER BY rede');
        res.status(200).json(result.rows.map(r => r.rede));
    } catch (error) {
        console.error('Erro ao buscar a lista de redes:', error);
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
});

// Rota CORRIGIDA (querying 'redes_lojas')
app.get('/api/lojas', isUserLoggedIn, async (req, res) => {
    const { rede } = req.query;
    if (!rede) {
         return res.status(200).json([]);
    }
    try {
        // CORREÇÃO: Query the 'redes_lojas' table and select the 'loja' column
        const query = 'SELECT loja FROM redes_lojas WHERE rede = $1 ORDER BY loja'; // Select 'loja' column
        const params = [rede];
        const result = await pool.query(query, params);
        // Map the result using the correct column name 'loja'
        res.status(200).json(result.rows.map(item => item.loja)); // Map from item.loja
    } catch (error) {
        console.error('Erro ao buscar a lista de lojas por rede:', error);
        res.status(500).json({ message: 'Erro interno do servidor ao buscar lojas.' });
    }
});
// Em server.js, substitua a rota /api/produtos_por_rede

app.get('/api/produtos_por_rede', isUserLoggedIn, async (req, res) => {
    const { rede } = req.query; // Pega o parâmetro ?rede=

    // Validação inicial (se nenhuma rede for passada, retorna erro)
    if (!rede) {
        return res.status(400).json({ message: 'O parâmetro "rede" é obrigatório.' });
    }

    try {
        let result; // Variável para guardar o resultado da query

        // --- NOVA LÓGICA CONDICIONAL ---
        // Verifica se a rede selecionada é a genérica "NÃO ENCONTRADA"
        if (rede === "REDE NÃO ENCONTRADA") {
            console.log(`Buscando TODOS os produtos porque a rede é "${rede}"`);
            // Query para buscar TODOS os produtos
            result = await pool.query('SELECT codigo, nome, unidade, preco FROM produtos ORDER BY nome');
        } else {
            // Se a rede NÃO é "NÃO ENCONTRADA", tenta buscar os produtos específicos da rede
            // Dentro do 'else' da rota /api/produtos_por_rede
console.log(`Buscando produtos para a rede: ${rede}`);
// CORREÇÃO: Usa a tabela 'rede_produtos' e a coluna 'rede'
const queryEspecifica = `
    SELECT p.codigo, p.nome, p.unidade, p.preco
    FROM produtos p
    INNER JOIN rede_produtos rp ON p.codigo = rp.produto_codigo -- Junta com a tabela correta
    WHERE rp.rede = $1 -- Filtra pela coluna 'rede'
    ORDER BY p.nome;
`;
result = await pool.query(queryEspecifica, [rede]);

            // Se a busca específica NÃO retornou produtos, busca TODOS
            if (result.rows.length === 0) {
                console.log(`Nenhum produto encontrado para a rede "${rede}". Buscando TODOS os produtos como fallback.`);
                result = await pool.query('SELECT codigo, nome, unidade, preco FROM produtos ORDER BY nome');
            }
        }
        // --- FIM DA NOVA LÓGICA ---

        // Envia o resultado (seja da rede específica ou todos os produtos)
        res.status(200).json(result.rows);

    } catch (error) {
        console.error('Erro ao buscar produtos por rede (com fallback):', error);
        res.status(500).json({ message: 'Erro interno no servidor ao buscar produtos.' });
    }
});

// Adiciona itens submetidos pelo utilizador
app.post('/api/adicionar_item', isUserLoggedIn, async (req, res) => {
    // Atenção: A requisição agora envia 'rede' em vez de 'loja'
    const { rede, nome, telefone, observacao, produtos } = req.body; // Adicionado observacao
    // Usamos o 'id' da sessão como identificador do utilizador (que é a senha única)
    const userId = req.session.user ? req.session.user.id : 'desconhecido';

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        for (const produto of produtos) {
            const validadeSQL = produto.validade ? produto.validade.split('/').reverse().join('-') : null;
            // Dentro do loop for (const produto of produtos)

    // Query ATUALIZADA com a coluna observacao
    const query = `
        INSERT INTO itens_submetidos (
            email_usuario_padrao, nome_loja, produto_codigo,
            quantidade, validade, nome_usuario,
            telefone_usuario, preco_unitario, preco_promocional, ponto_extra,
            observacao -- Nova coluna
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) -- Novo placeholder $11
    `;

    // Parâmetros ATUALIZADOS para a query
    await client.query(query, [
        userId,
        rede,
        produto.codigo,
        parseFloat(produto.quantidade),
        validadeSQL,
        nome,
        telefone,
        parseFloat(produto.preco),
        produto.promocao,
        produto.ponto_extra,
        observacao // Novo valor
    ]);
        }
        await client.query('COMMIT');
        res.status(200).json({ message: 'Itens adicionados com sucesso!' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Erro ao adicionar itens:', error);
        res.status(500).json({ message: error.message || 'Erro ao salvar os dados.' });
    } finally {
        client.release();
    }
});


// --- ROTAS DE ADMINISTRAÇÃO ---

// Atualiza utilizadores padrão (sem alterações)
app.post('/api/upload-users', isAdminLoggedIn, upload.single('userCsvFile'), async (req, res) => {
    // ... (código existente para upload de utilizadores)
     if (!req.file) return res.status(400).json({ message: 'Nenhum arquivo enviado.' });
    const client = await pool.connect();
    try {
        // Assume CSV com delimitador padrão (vírgula) para este arquivo específico
        const users = await parseCsvBuffer(req.file.buffer, { separator: ',' });
        if (users.length === 0 || !users[0].senha) return res.status(400).json({ message: 'Arquivo CSV inválido ou coluna "senha" não encontrada.' });

        await client.query('BEGIN');
        await client.query('TRUNCATE TABLE utilizadores_padrao');
        for (const user of users) {
            await client.query('INSERT INTO utilizadores_padrao (senha) VALUES ($1)', [user.senha]);
        }
        await client.query('COMMIT');
        res.status(200).json({ message: `Lista de utilizadores atualizada com sucesso.` });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Erro no upload de utilizadores:", error);
        res.status(500).json({ message: 'Ocorreu um erro no servidor.' });
    } finally {
        client.release();
    }
});

// ROTA PARA ATUALIZAR DADOS (3 ARQUIVOS, Otimizada c/ Tabela Temporária e DELIMITER ';')
app.post('/api/atualizar-dados', isAdminLoggedIn, upload.fields([
    { name: 'produtosCsvFile', maxCount: 1 },
    { name: 'redesLojasCsvFile', maxCount: 1 }, // Arquivo redes_lojas.csv
    { name: 'lojasCsvFile', maxCount: 1 }      // Arquivo rede_produtos.csv
]), async (req, res) => {
    console.log("Iniciando a rota /api/atualizar-dados (3 arquivos, Tabela Temporária, Delimiter ';')...");

    if (!req.files || !req.files.produtosCsvFile || !req.files.redesLojasCsvFile || !req.files.lojasCsvFile) {
        return res.status(400).json({ message: 'É necessário enviar os três arquivos.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        console.log("Transação iniciada. A limpar tabelas antigas...");

        // 1. Limpar tabelas finais
        await client.query('TRUNCATE TABLE rede_produtos, redes_lojas, produtos RESTART IDENTITY CASCADE');
        console.log("Tabelas finais limpas com sucesso.");

        // --- Inserção de Produtos (via Tabela Temporária e COPY) ---
        console.log("Criando temp_produtos e carregando via COPY...");
        await client.query(`
            CREATE TEMP TABLE temp_produtos (
                id_csv INTEGER, codigo VARCHAR(255), nome VARCHAR(255), unidade VARCHAR(50),
                url_imagem VARCHAR(255), preco NUMERIC(10, 2)
            ) ON COMMIT DROP;
        `);
        // Ajustado para DELIMITER ';'
        const tempProdutosCopyStmt = `COPY temp_produtos (id_csv, codigo, nome, unidade, url_imagem, preco) FROM STDIN WITH (FORMAT CSV, HEADER TRUE, QUOTE '"', ESCAPE '"', DELIMITER ';')`;
        const tempProdutosCopyStream = client.query(copyFrom(tempProdutosCopyStmt));
        const produtosBuffer = req.files.produtosCsvFile[0].buffer;
        const produtosReadable = new stream.PassThrough();
        produtosReadable.end(produtosBuffer);
        await new Promise((resolve, reject) => {
             produtosReadable.pipe(tempProdutosCopyStream).on('finish', resolve).on('error', reject);
        });
        console.log("produtos.csv carregado para temp_produtos.");

        console.log("Inserindo produtos na tabela final...");
        const insertProdutosResult = await client.query(`
            INSERT INTO produtos (codigo, nome, unidade, preco)
            SELECT codigo, nome, unidade, preco FROM temp_produtos
            WHERE codigo IS NOT NULL AND nome IS NOT NULL AND codigo <> '';
        `);
        console.log(`${insertProdutosResult.rowCount} produtos válidos inseridos.`);

        // --- Processamento de Redes/Lojas (via Tabela Temporária e COPY) ---
         console.log("Criando temp_redes_lojas e carregando via COPY...");
        await client.query(`
            CREATE TEMP TABLE temp_redes_lojas (
                rede VARCHAR(255), loja VARCHAR(255)
            ) ON COMMIT DROP;
        `);
         // Ajustado para DELIMITER ';' (Assume CSV: rede;loja)
        const tempRedesLojasCopyStmt = `COPY temp_redes_lojas (rede, loja) FROM STDIN WITH (FORMAT CSV, HEADER TRUE, QUOTE '"', ESCAPE '"', DELIMITER ';')`;
        const tempRedesLojasCopyStream = client.query(copyFrom(tempRedesLojasCopyStmt));
        const redesLojasBuffer = req.files.redesLojasCsvFile[0].buffer;
        const redesLojasReadable = new stream.PassThrough();
        redesLojasReadable.end(redesLojasBuffer);
         await new Promise((resolve, reject) => {
             redesLojasReadable.pipe(tempRedesLojasCopyStream).on('finish', resolve).on('error', reject);
        });
        console.log("redes_lojas.csv carregado para temp_redes_lojas.");

        console.log("Inserindo relações rede-loja na tabela final...");
        const insertRedesLojasResult = await client.query(`
            INSERT INTO redes_lojas (rede, loja)
            SELECT DISTINCT rede, loja FROM temp_redes_lojas
            WHERE rede IS NOT NULL AND loja IS NOT NULL AND rede <> '' AND loja <> '';
        `);
        console.log(`${insertRedesLojasResult.rowCount} relações rede-loja únicas inseridas.`);


        // --- Processamento de Rede/Produtos (via Tabela Temporária e COPY) ---
        console.log("Criando temp_rede_produtos e carregando via COPY...");
        await client.query(`
            CREATE TEMP TABLE temp_rede_produtos (
                rede VARCHAR(255), produto_codigo VARCHAR(255)
            ) ON COMMIT DROP;
        `);
         // Ajustado para DELIMITER ';' (Assume CSV: rede;produto_codigo)
        const tempRedeProdutosCopyStmt = `COPY temp_rede_produtos (rede, produto_codigo) FROM STDIN WITH (FORMAT CSV, HEADER TRUE, QUOTE '"', ESCAPE '"', DELIMITER ';')`;
        const tempRedeProdutosCopyStream = client.query(copyFrom(tempRedeProdutosCopyStmt));
        const redeProdutosBuffer = req.files.lojasCsvFile[0].buffer; // Usando o buffer do terceiro arquivo
        const redeProdutosReadable = new stream.PassThrough();
        redeProdutosReadable.end(redeProdutosBuffer);
         await new Promise((resolve, reject) => {
             redeProdutosReadable.pipe(tempRedeProdutosCopyStream).on('finish', resolve).on('error', reject);
        });
        console.log("rede_produtos.csv carregado para temp_rede_produtos.");

        console.log("Inserindo relações rede-produto na tabela final...");
        const insertRedeProdutosResult = await client.query(`
            INSERT INTO rede_produtos (rede, produto_codigo)
            SELECT DISTINCT t.rede, t.produto_codigo
            FROM temp_rede_produtos t
            INNER JOIN produtos p ON t.produto_codigo = p.codigo -- Valida se produto existe
            WHERE t.rede IS NOT NULL AND t.produto_codigo IS NOT NULL AND t.rede <> '';
        `);
        console.log(`${insertRedeProdutosResult.rowCount} relações rede-produto válidas inseridas.`);

        // Tabelas temporárias são apagadas automaticamente

        await client.query('COMMIT');
        console.log("Transação concluída com sucesso (COMMIT)!");

        res.status(200).json({ message: 'Dados atualizados com sucesso via tabelas temporárias!' });

    } catch (error) {
        console.error("!!!!!!!!!! OCORREU UM ERRO DURANTE A TRANSAÇÃO !!!!!!!!!!");
        console.error("MENSAGEM DE ERRO:", error.message);
        console.error("DETALHES COMPLETOS DO ERRO:", error);
        
        try { await client.query('ROLLBACK'); } catch (rollbackError) { console.warn("Erro durante rollback:", rollbackError.message); }
        console.error("A TRANSAÇÃO FOI REVERTIDA (ROLLBACK).");
        
        res.status(500).json({ message: `Ocorreu um erro no servidor.`, error: error.message });
    } finally {
        client.release();
        console.log("Conexão com o banco de dados libertada.");
    }
});


// Exporta entradas submetidas (sem alterações na lógica principal)
app.get('/api/exportar-entradas', isAdminLoggedIn, async (req, res) => {
    try {
        // A coluna 'nome_loja' agora contém a REDE
        const { rows } = await pool.query('SELECT * FROM itens_submetidos ORDER BY data_submissao DESC');
        if (rows.length === 0) return res.status(404).json({ message: 'Nenhuma entrada para exportar.' });

        // Renomear a coluna 'nome_loja' para 'rede' no CSV exportado para clareza
        const fields = [
            { label: 'ID', value: 'id'},
            { label: 'UsuarioID', value: 'email_usuario_padrao'},
            { label: 'Rede', value: 'nome_loja'}, // Renomeado
            { label: 'CodProduto', value: 'produto_codigo'},
            { label: 'Quantidade', value: 'quantidade'},
            { label: 'Validade', value: 'validade'},
            { label: 'NomeUsuario', value: 'nome_usuario'},
            { label: 'TelefoneUsuario', value: 'telefone_usuario'},
            { label: 'PrecoUnitario', value: 'preco_unitario'},
            { label: 'Promocional', value: 'preco_promocional'},
            { label: 'PontoExtra', value: 'ponto_extra'},
            { label: 'DataSubmissao', value: 'data_submissao'}
        ];
        const json2csvParser = new Parser({ fields });
        const csv = json2csvParser.parse(rows);

        res.header('Content-Type', 'text/csv; charset=utf-8');
        res.attachment('relatorio_entradas.csv');
        // Adiciona BOM para Excel entender UTF-8 corretamente
        res.send('\ufeff' + csv);
    } catch (error) {
        console.error("Erro ao exportar entradas:", error);
        res.status(500).json({ message: 'Ocorreu um erro no servidor.' });
    }
});

// =================================================================
// 8. SERVIR ARQUIVOS ESTÁTICOS (POR ÚLTIMO)
// =================================================================
app.use(express.static(__dirname));

// =================================================================
// 9. INICIAR O SERVIDOR
// =================================================================
app.listen(port, () => {
    console.log(`Servidor a correr na porta ${port}`);
});