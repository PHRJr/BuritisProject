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
app.get('/index.html', isUserLoggedIn, (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/produtos.html', isUserLoggedIn, (req, res) => res.sendFile(path.join(__dirname, 'public', 'produtos.html')));
app.get('/admin.html', isAdminLoggedIn, (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));


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

// --- ROTAS DE API DE DADOS (PROTEGIDAS) ---
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

// DENTRO DO SEU server.js, SUBSTITUA A ROTA /api/adicionar_item

// DENTRO DO SEU server.js, SUBSTITUA A ROTA /api/adicionar_item

app.post('/api/adicionar_item', isUserLoggedIn, async (req, res) => {
    const { loja, nome, telefone, produtos } = req.body;
    const emailUsuarioLogado = req.session.user.email;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        for (const produto of produtos) {
            const validadeSQL = produto.validade ? produto.validade.split('/').reverse().join('-') : null;
            
            // Query ATUALIZADA para incluir a nova coluna 'preco_unitario'
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
                parseFloat(produto.preco) // <-- O novo dado sendo inserido
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

app.post('/api/upload-users', isAdminLoggedIn, upload.single('userCsvFile'), async (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'Nenhum arquivo enviado.' });
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query('TRUNCATE TABLE utilizadores_padrao RESTART IDENTITY');
        const users = await parseCsvBuffer(req.file.buffer, { headers: ['email'], skipHeader: true });
        for (const user of users) {
            if (user.email && user.email.trim() !== '') {
                await client.query('INSERT INTO utilizadores_padrao (email) VALUES ($1)', [user.email.trim()]);
            }
        }
        await client.query('COMMIT');
        res.status(200).json({ message: `Utilizadores atualizados com sucesso: ${users.length} emails importados.` });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Erro ao inserir utilizadores do CSV:', error);
        res.status(500).json({ message: 'Erro ao processar o arquivo CSV.' });
    } finally {
        client.release();
    }
});

app.post('/api/atualizar-dados', isAdminLoggedIn, upload.fields([{ name: 'produtosCsvFile', maxCount: 1 }, { name: 'lojasCsvFile', maxCount: 1 }]), async (req, res) => {
    if (!req.files || !req.files.produtosCsvFile || !req.files.lojasCsvFile) return res.status(400).json({ message: 'É necessário enviar os dois arquivos.' });
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query('TRUNCATE TABLE lojas, produtos RESTART IDENTITY CASCADE');

        const produtosData = await parseCsvBuffer(req.files.produtosCsvFile[0].buffer);
        for (const produto of produtosData) {
            if (produto.codigo && produto.nome) {
                await client.query('INSERT INTO produtos (codigo, nome, unidade, url_imagem, preco) VALUES ($1, $2, $3, $4, $5)', [produto.codigo.trim(), produto.nome.trim(), produto.unidade, produto.url_imagem, parseFloat(produto.preco) || 0]);
            }
        }

        const lojasRelData = await parseCsvBuffer(req.files.lojasCsvFile[0].buffer);
        const relacoesUnicas = new Map();
        for (const relacao of lojasRelData) {
            const nomeDaLojaLimpo = relacao.loja_id ? relacao.loja_id.trim() : null;
            const codigoProdutoLimpo = relacao.produto_codigo ? relacao.produto_codigo.trim() : null;
            if (nomeDaLojaLimpo && codigoProdutoLimpo) {
                const chave = `${nomeDaLojaLimpo}|${codigoProdutoLimpo}`;
                if (!relacoesUnicas.has(chave)) {
                    relacoesUnicas.set(chave, { nome_loja: nomeDaLojaLimpo, produto_codigo: codigoProdutoLimpo });
                }
            }
        }
        const dadosLimpos = Array.from(relacoesUnicas.values());
        
        const nomesLojasUnicas = [...new Set(dadosLimpos.map(item => item.nome_loja))];
        const lojasInseridasMap = new Map();
        for (const nomeLoja of nomesLojasUnicas) {
            const result = await client.query('INSERT INTO lojas (nome) VALUES ($1) RETURNING id', [nomeLoja]);
            lojasInseridasMap.set(nomeLoja, result.rows[0].id);
        }

        for (const relacao of dadosLimpos) {
            const lojaId = lojasInseridasMap.get(relacao.nome_loja);
            if (lojaId && relacao.produto_codigo) {
                await client.query('INSERT INTO loja_produtos (loja_id, produto_codigo) VALUES ($1, $2)', [lojaId, relacao.produto_codigo]);
            }
        }
        
        await client.query('COMMIT');
        res.status(200).json({ message: `Dados atualizados! ${produtosData.length} produtos, ${lojasInseridasMap.size} lojas e ${dadosLimpos.length} relações inseridas.` });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Erro ao atualizar dados:', error);
        res.status(500).json({ message: 'Erro ao processar os arquivos. Verifique os cabeçalhos e o formato dos CSVs.' });
    } finally {
        client.release();
    }
});

// DENTRO DO SEU server.js, SUBSTITUA A ROTA /api/exportar-entradas

app.get('/api/exportar-entradas', isAdminLoggedIn, async (req, res) => {
    try {
        console.log("A gerar relatório de entradas...");

        // Query ATUALIZADA para usar as novas colunas e não depender mais dos IDs.
        const query = `
            SELECT 
                i.id,
                i.nome_loja AS loja,
                i.produto_codigo,
                p.nome AS nome_produto, -- Ainda pegamos o nome do produto para um relatório mais completo
                i.quantidade,
                i.preco_unitario,
                TO_CHAR(i.validade, 'DD/MM/YYYY') AS validade,
                i.nome_usuario,
                i.telefone_usuario,
                i.email_usuario_padrao,
                TO_CHAR(i.data_submissao, 'DD/MM/YYYY HH24:MI:SS') AS data_de_envio
            FROM 
                itens_submetidos i
            LEFT JOIN -- Usamos LEFT JOIN para garantir que a entrada apareça mesmo que o produto tenha sido apagado do catálogo
                produtos p ON i.produto_codigo = p.codigo
            ORDER BY 
                i.data_submissao DESC;
        `;

        const { rows } = await pool.query(query);

        if (rows.length === 0) {
            // Se não houver dados, enviamos uma mensagem em vez de um arquivo vazio
            return res.status(200).send("Nenhum dado de entrada encontrado para exportar.");
        }

        const json2csvParser = new Parser();
        const csv = json2csvParser.parse(rows);

        res.header('Content-Type', 'text/csv; charset=utf-8');
        res.attachment('relatorio_entradas.csv');
        
        res.send(csv);

    } catch (error) {
        console.error("Erro ao exportar dados:", error);
        res.status(500).send("Ocorreu um erro ao gerar o relatório.");
    }
});

// =================================================================
// 8. SERVIR ARQUIVOS ESTÁTICOS (POR ÚLTIMO)
// =================================================================
// Esta linha deve vir DEPOIS de todas as rotas GET específicas de páginas
app.use(express.static(path.join(__dirname, 'public')));


// =================================================================
// 9. INICIAR O SERVIDOR
// =================================================================
app.listen(port, () => {
  console.log(`Servidor a correr na porta ${port}`);
});