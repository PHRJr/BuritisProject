// =================================================================
// ARQUIVO server.js - VERSÃO COM DIAGNÓSTICO E CORREÇÃO DE SSL
// =================================================================
require('dotenv').config();

// --- 1. IMPORTAÇÕES (sem alterações) ---
const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const session = require('express-session');
const bcrypt = require('bcrypt');
const multer = require('multer');
const csv = require('csv-parser');
const stream = require('stream');
const { Parser } = require('json2csv');

// --- 2. CONFIGURAÇÃO INICIAL (sem alterações) ---
const app = express();
const port = process.env.PORT || 3000;
const upload = multer({ storage: multer.memoryStorage() });

// --- 3. MIDDLEWARE GERAL (sem alterações)---
app.use(express.json());
app.set('trust proxy', 1); // Confia no proxy da Render

// --- 4. CONEXÃO COM O BANCO DE DADOS (ALTERAÇÃO IMPORTANTE) ---
const isProduction = process.env.NODE_ENV === 'production';
const connectionString = process.env.DATABASE_URL;

const pool = new Pool({
    connectionString: connectionString,
    // A configuração de SSL é crucial para a Render e outras plataformas cloud.
    // Em produção, exige-se uma conexão segura.
    ssl: isProduction ? { rejectUnauthorized: false } : false
});

// --- ROTA DE DIAGNÓSTICO TEMPORÁRIA ---
app.get('/api/db-test', async (req, res) => {
    try {
        const client = await pool.connect();
        // Vamos fazer três testes numa só rota:
        // 1. A conexão funciona?
        // 2. A tabela 'lojas' existe?
        // 3. O que está dentro da tabela 'lojas'?
        const result = await client.query('SELECT * FROM lojas');
        client.release(); // Liberta o cliente de volta para o pool

        res.status(200).json({
            message: 'Conexão com o banco de dados bem-sucedida!',
            rowCount: result.rowCount, // Quantas lojas foram encontradas?
            data: result.rows, // Quais são os dados das lojas?
            databaseUrlUsed: connectionString ? 'DATABASE_URL foi encontrada.' : 'DATABASE_URL NÃO foi encontrada.'
        });
    } catch (error) {
        console.error('ERRO NO DIAGNÓSTICO DE BD:', error);
        res.status(500).json({
            message: 'Falha ao conectar ou consultar o banco de dados.',
            error: error.message,
            stack: error.stack
        });
    }
});


// --- 5. CONFIGURAÇÃO DA SESSÃO (sem alterações) ---
app.use(session({
    secret: process.env.SESSION_SECRET || 'seu-segredo-deve-ser-muito-bem-guardado',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: isProduction,
        maxAge: 24 * 60 * 60 * 1000,
        httpOnly: true
    }
}));

// --- 6. MIDDLEWARE DE AUTENTICAÇÃO (sem alterações) ---
const isUserLoggedIn = (req, res, next) => {
    if (req.session.user) { return next(); }
    if (req.headers.accept && req.headers.accept.includes('json')) {
        return res.status(401).json({ message: 'Acesso não autorizado.' });
    } else {
        return res.redirect('/login.html');
    }
};
const isAdminLoggedIn = (req, res, next) => {
    if (req.session.user && req.session.user.role === 'admin') { return next(); }
    res.redirect('/login_admin.html');
};

// ... (O RESTANTE DO SEU CÓDIGO PERMANECE IGUAL) ...
// Copie o restante do seu `server.js` (a partir da função parseCsvBuffer) e cole aqui.
// Esta parte não precisa de ser alterada.

// --- FUNÇÃO AUXILIAR PARA LER CSVs EM BUFFER ---
function parseCsvBuffer(buffer, options = {}) {
    return new Promise((resolve, reject) => {
        const results = [];
        const bufferStream = new stream.PassThrough();
        bufferStream.end(buffer);
        bufferStream
            .pipe(csv(options))
            .on('data', (data) => results.push(data))
            .on('end', () => resolve(results))
            .on('error', (error) => reject(error));
    });
}

// =================================================================
// 7. ROTAS (ORDEM CORRETA)
// =================================================================

// --- ROTA RAIZ ---
app.get('/', (req, res) => {
    res.redirect('/login.html');
});

// --- ROTAS DE PÁGINAS PROTEGIDAS ---
app.get('/index.html', isUserLoggedIn, (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/produtos.html', isUserLoggedIn, (req, res) => res.sendFile(path.join(__dirname, 'produtos.html')));
app.get('/admin.html', isAdminLoggedIn, (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));

// --- ROTAS DE API DE AUTENTICAÇÃO (sem alterações) ---
app.post('/api/user-login', async (req, res) => {
    const { email } = req.body;
    try {
        const result = await pool.query('SELECT * FROM utilizadores_padrao WHERE email = $1', [email]);
        if (result.rows.length > 0) {
            req.session.user = { email: result.rows[0].email, role: 'user' };
            return res.status(200).json({ message: 'Login bem-sucedido!' });
        }
        res.status(401).json({ message: 'Email não autorizado.' });
    } catch (error) {
        console.error('Erro no login de utilizador:', error);
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
});

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

app.post('/api/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) return res.status(500).json({ message: 'Não foi possível fazer logout.' });
        res.clearCookie('connect.sid');
        res.status(200).json({ message: 'Logout bem-sucedido.' });
    });
});


// --- ROTAS DE API DE DADOS (sem alterações) ---
app.get('/api/lojas', isUserLoggedIn, async (req, res) => {
    try {
        const result = await pool.query('SELECT nome FROM lojas ORDER BY nome');
        res.status(200).json(result.rows.map(loja => loja.nome));
    } catch (error) {
        console.error('Erro ao buscar a lista de lojas:', error);
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
});

app.get('/api/produtos', isUserLoggedIn, async (req, res) => {
    const { loja } = req.query;
    try {
        const query = `
            SELECT p.codigo, p.nome, p.unidade, p.preco, p.url_imagem
            FROM produtos p
            JOIN loja_produtos lp ON p.codigo = lp.produto_codigo
            JOIN lojas l ON l.id = lp.loja_id
            WHERE l.nome = $1;
        `;
        const result = await pool.query(query, [loja]);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Erro ao buscar produtos:', error);
        res.status(500).json({ message: 'Erro interno no servidor.' });
    }
});

app.post('/api/adicionar_item', isUserLoggedIn, async (req, res) => {
    const { loja, nome, telefone, produtos } = req.body;
    const emailUsuarioLogado = req.session.user.email;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        for (const produto of produtos) {
            const validadeSQL = produto.validade ? produto.validade.split('/').reverse().join('-') : null;
            const query = `
                INSERT INTO itens_submetidos (email_usuario_padrao, nome_loja, produto_codigo, quantidade, validade, nome_usuario, telefone_usuario, preco_unitario)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `;
            await client.query(query, [emailUsuarioLogado, loja, produto.codigo, parseFloat(produto.quantidade), validadeSQL, nome, telefone, parseFloat(produto.preco)]);
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


// --- ROTAS DE ADMINISTRAÇÃO (LÓGICA IMPLEMENTADA) ---

// ROTA PARA ATUALIZAR A LISTA DE UTILIZADORES AUTORIZADOS
app.post('/api/upload-users', isAdminLoggedIn, upload.single('userCsvFile'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'Nenhum arquivo enviado.' });
    }
    const client = await pool.connect();
    try {
        const users = await parseCsvBuffer(req.file.buffer);
        if (users.length === 0 || !users[0].email) {
            return res.status(400).json({ message: 'Arquivo CSV inválido ou vazio. Verifique se a coluna se chama "email".' });
        }

        await client.query('BEGIN');
        await client.query('TRUNCATE TABLE utilizadores_padrao'); // Limpa a tabela
        for (const user of users) {
            await client.query('INSERT INTO utilizadores_padrao (email) VALUES ($1)', [user.email]);
        }
        await client.query('COMMIT');

        res.status(200).json({ message: `Lista de utilizadores atualizada com sucesso. ${users.length} emails importados.` });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Erro ao fazer upload de utilizadores:", error);
        res.status(500).json({ message: 'Ocorreu um erro no servidor.' });
    } finally {
        client.release();
    }
});

// ROTA PARA ATUALIZAR PRODUTOS E LOJAS
app.post('/api/atualizar-dados', isAdminLoggedIn, upload.fields([
    { name: 'produtosCsvFile', maxCount: 1 },
    { name: 'lojasCsvFile', maxCount: 1 }
]), async (req, res) => {
    if (!req.files || !req.files.produtosCsvFile || !req.files.lojasCsvFile) {
        return res.status(400).json({ message: 'É necessário enviar os dois arquivos.' });
    }
    const client = await pool.connect();
    try {
        // Parse dos CSVs
        const produtos = await parseCsvBuffer(req.files.produtosCsvFile[0].buffer);
        // O CSV de lojas é especial (pivotado), então não usamos o parser padrão.
        const lojasCsvContent = req.files.lojasCsvFile[0].buffer.toString('utf-8');
        const linhasLojas = lojasCsvContent.trim().split('\n');
        const nomesLojas = linhasLojas[0].split(',').map(h => h.trim());
        const relacoes = [];
        for (let i = 1; i < linhasLojas.length; i++) {
            const codigosProdutos = linhasLojas[i].split(',').map(c => c.trim());
            codigosProdutos.forEach((codigo, index) => {
                if (codigo) {
                    relacoes.push({ nome_loja: nomesLojas[index], produto_codigo: codigo });
                }
            });
        }
        
        await client.query('BEGIN');
        // Limpar tabelas na ordem correta para evitar erros de chave estrangeira
        await client.query('TRUNCATE TABLE loja_produtos, produtos, lojas RESTART IDENTITY CASCADE');

        // Inserir produtos
        for (const p of produtos) {
            await client.query(
                'INSERT INTO produtos (codigo, nome, unidade, preco, url_imagem) VALUES ($1, $2, $3, $4, $5)',
                [p.codigo, p.nome, p.unidade, parseFloat(p.preco_unitario), p.imagem_url]
            );
        }

        // Inserir lojas e criar um mapa de nome para id
        const lojaIdMap = {};
        for (const nome of nomesLojas) {
            const result = await client.query('INSERT INTO lojas (nome) VALUES ($1) RETURNING id', [nome]);
            lojaIdMap[nome] = result.rows[0].id;
        }

        // Inserir relações loja-produto
        for (const rel of relacoes) {
            await client.query(
                'INSERT INTO loja_produtos (loja_id, produto_codigo) VALUES ($1, $2)',
                [lojaIdMap[rel.nome_loja], rel.produto_codigo]
            );
        }
        await client.query('COMMIT');

        res.status(200).json({ message: 'Produtos e lojas atualizados com sucesso!' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Erro ao atualizar dados:", error);
        res.status(500).json({ message: `Ocorreu um erro no servidor: ${error.message}` });
    } finally {
        client.release();
    }
});


// ROTA PARA EXPORTAR AS ENTRADAS DOS UTILIZADORES
app.get('/api/exportar-entradas', isAdminLoggedIn, async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM itens_submetidos ORDER BY data_submissao DESC');
        if (rows.length === 0) {
            return res.status(404).json({ message: 'Nenhuma entrada para exportar.' });
        }
        const json2csvParser = new Parser();
        const csv = json2csvParser.parse(rows);
        res.header('Content-Type', 'text/csv');
        res.attachment('relatorio_entradas.csv');
        res.send(csv);
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