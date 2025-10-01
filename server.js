// =================================================================
// ARQUIVO server.js - VERSÃO FINAL E CORRIGIDA
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

// --- 3. MIDDLEWARE GERAL---
app.use(express.json());

// --- 4. CONEXÃO COM O BANCO DE DADOS ---
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// --- 5. CONFIGURAÇÃO DA SESSÃO ---
app.use(session({
    secret: 'seu-segredo-deve-ser-muito-bem-guardado',
    resave: false,
    saveUninitialized: true,
    cookie: { 
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000 // 24 horas
    }
}));

// --- 6. MIDDLEWARE DE AUTENTICAÇÃO ---
const isUserLoggedIn = (req, res, next) => {
    if (req.session.user) { return next(); }
    res.redirect('/login.html');
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
// 7. ROTAS (ORDEM CORRETA)
// =================================================================

// --- ROTA RAIZ ---
app.get('/', (req, res) => {
    res.redirect('/login.html');
});

// --- ROTAS DE PÁGINAS PROTEGIDAS ---
// MUDANÇA: Removido 'public' do caminho dos arquivos
app.get('/index.html', isUserLoggedIn, (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/produtos.html', isUserLoggedIn, (req, res) => res.sendFile(path.join(__dirname, 'produtos.html')));
app.get('/admin.html', isAdminLoggedIn, (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));


// --- ROTAS DE API DE AUTENTICAÇÃO ---
// ... (Nenhuma alteração nesta seção)
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


// --- ROTAS DE API DE DADOS (PROTEGIDAS) ---
// ... (Nenhuma alteração nesta seção, pois elas lidam com o banco de dados, não com arquivos)
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
                INSERT INTO itens_submetidos (
                    email_usuario_padrao, 
                    nome_loja, 
                    produto_codigo, 
                    quantidade, 
                    validade, 
                    nome_usuario, 
                    telefone_usuario,
                    preco_unitario
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `;
            
            await client.query(query, [
                emailUsuarioLogado,
                loja,
                produto.codigo,
                parseFloat(produto.quantidade),
                validadeSQL,
                nome,
                telefone,
                parseFloat(produto.preco)
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

// ... (Restante das rotas de API sem alterações)
app.post('/api/upload-users', /* ... */);
app.post('/api/atualizar-dados', /* ... */);
app.get('/api/exportar-entradas', /* ... */);


// =================================================================
// 8. SERVIR ARQUIVOS ESTÁTICOS (POR ÚLTIMO)
// =================================================================

// MUDANÇA: Servir arquivos estáticos da pasta raiz (__dirname) em vez de 'public'
app.use(express.static(__dirname));


// =================================================================
// 9. INICIAR O SERVIDOR
// =================================================================
app.listen(port, () => {
  console.log(`Servidor a correr na porta ${port}`);
});