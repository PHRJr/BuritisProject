// =================================================================
// ARQUIVO server.js - VERSÃO FINAL E COMPLETA
// =================================================================
require('dotenv').config();

// --- 1. IMPORTAÇÕES ---
const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const session = require('express-session');
const bcrypt = require('bcrypt');
const multer = require('multer');
const csv = require('csv-parser');
const stream = require('stream');
const { Parser } = require('json2csv');

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
    ssl: isProduction ? { rejectUnauthorized: false } : false
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
    res.redirect('/login_admin.html');
};

// --- FUNÇÃO AUXILIAR PARA LER CSVs ---
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
// 7. ROTAS
// =================================================================

// --- ROTA RAIZ ---
app.get('/', (req, res) => {
    res.redirect('/login.html');
});

// --- ROTA DE DIAGNÓSTICO ---
app.get('/api/db-test', async (req, res) => {
    try {
        const client = await pool.connect();
        const result = await client.query('SELECT nome FROM lojas LIMIT 5');
        client.release();
        res.status(200).json({
            message: 'Conexão e consulta ao BD bem-sucedidas!',
            lojasEncontradas: result.rowCount,
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


// --- ROTAS DE API DE DADOS ---
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


// --- ROTAS DE ADMINISTRAÇÃO ---
app.post('/api/upload-users', isAdminLoggedIn, upload.single('userCsvFile'), async (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'Nenhum arquivo enviado.' });
    const client = await pool.connect();
    try {
        const users = await parseCsvBuffer(req.file.buffer);
        if (users.length === 0 || !users[0].email) return res.status(400).json({ message: 'Arquivo CSV inválido.' });

        await client.query('BEGIN');
        await client.query('TRUNCATE TABLE utilizadores_padrao');
        for (const user of users) {
            await client.query('INSERT INTO utilizadores_padrao (email) VALUES ($1)', [user.email]);
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

app.post('/api/atualizar-dados', isAdminLoggedIn, upload.fields([{ name: 'produtosCsvFile' }, { name: 'lojasCsvFile' }]), async (req, res) => {
    if (!req.files || !req.files.produtosCsvFile || !req.files.lojasCsvFile) {
        return res.status(400).json({ message: 'É necessário enviar os dois arquivos.' });
    }
    const client = await pool.connect();
    try {
        const produtos = await parseCsvBuffer(req.files.produtosCsvFile[0].buffer);
        const lojasCsvContent = req.files.lojasCsvFile[0].buffer.toString('utf-8');
        const linhasLojas = lojasCsvContent.trim().split('\n');
        const nomesLojas = linhasLojas[0].split(',').map(h => h.trim());
        const relacoes = [];
        for (let i = 1; i < linhasLojas.length; i++) {
            const codigosProdutos = linhasLojas[i].split(',').map(c => c.trim());
            codigosProdutos.forEach((codigo, index) => {
                if (codigo) relacoes.push({ nome_loja: nomesLojas[index], produto_codigo: codigo });
            });
        }
        
        await client.query('BEGIN');