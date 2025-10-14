require('dotenv').config();

const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const session = require('express-session');
const bcrypt = require('bcrypt');
const multer = require('multer');
const csv = require('csv-parser');
const stream = require('stream');
const { Parser } = require('json2csv');

const app = express();
app.set('trust proxy', 1);
const port = process.env.PORT || 3000;
const upload = multer({ storage: multer.memoryStorage() });

app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

app.use(session({
    secret: process.env.SESSION_SECRET || 'seu-segredo-deve-ser-muito-bem-guardado',
    resave: false,
    saveUninitialized: false, 
    cookie: { 
        secure: process.env.NODE_ENV === 'production', 
        maxAge: 24 * 60 * 60 * 1000, // 24 horas
        httpOnly: true //
    }
}));

const isUserLoggedIn = (req, res, next) => {
    if (req.session.user) {
        return next();
    }

    if (req.headers.accept && req.headers.accept.includes('json')) {
        return res.status(401).json({ message: 'Acesso não autorizado. Por favor, faça login novamente.' });
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

app.get('/', (req, res) => {
    res.redirect('/login.html');
});

app.get('/index.html', isUserLoggedIn, (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/produtos.html', isUserLoggedIn, (req, res) => res.sendFile(path.join(__dirname, 'produtos.html')));
app.get('/admin.html', isAdminLoggedIn, (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));

// Dentro do server.js, substitua a rota /api/user-login

app.post('/api/user-login', async (req, res) => {
    // Esperamos receber uma "senha" no corpo do pedido
    const { senha } = req.body;

    try {
        // A query agora procura na coluna "senha" (ou o nome que você usou no BD)
        const result = await pool.query('SELECT * FROM utilizadores_padrao WHERE email = $1', [senha]);

        if (result.rows.length > 0) {
            // Login bem-sucedido. O importante é criar a sessão.
            req.session.user = { id: result.rows[0].senha, role: 'user' };
            return res.status(200).json({ message: 'Login bem-sucedido!' });
        }

        // Se não encontrou, o código está incorreto.
        res.status(401).json({ message: 'Código de acesso inválido.' });
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
            return res.status(200).json({ message: 'Seja bem vindo!' });
        }
        res.status(401).json({ message: 'Email ou senha inválidos.' });
    } catch (error) {
        console.error('Erro ao logar:', error);
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
});

app.post('/api/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) return res.status(500).json({ message: 'Não foi possível fazer logout.' });
        res.clearCookie('connect.sid');
        res.status(200).json({ message: 'Logout bem sucedido.' });
    });
});

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
        const query = `SELECT p.codigo, p.nome, p.unidade, p.preco, p.url_imagem
            FROM produtos p
            JOIN loja_produtos lp ON p.codigo = lp.produto_codigo
            JOIN lojas l ON l.id = lp.loja_id
            WHERE l.nome = $1;`;

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
                    email_usuario_padrao, nome_loja, produto_codigo, 
                    quantidade, validade, nome_usuario, 
                    telefone_usuario, preco_unitario, preco_promocional, ponto_extra
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            `;

            await client.query(query, [
                emailUsuarioLogado, 
                loja, 
                produto.codigo, 
                parseFloat(produto.quantidade), 
                validadeSQL, 
                nome, 
                telefone, 
                parseFloat(produto.preco),
                produto.promocao,
                produto.ponto_extra  
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
    if (!req.file) {
        return res.status(400).json({ message: 'Nenhum arquivo CSV de utilizador enviado.' });
    }
    try {
        const client = await pool.connect();
        await client.query('BEGIN');
        await client.query('DELETE FROM utilizadores_padrao');

        const users = await parseCsvBuffer(req.file.buffer);

        for (const user of users) {
            if (user.email) { 
                await client.query('INSERT INTO utilizadores_padrao (email) VALUES ($1)', [user.email]);
            }
        }

        await client.query('COMMIT');
        res.status(200).json({ message: 'Lista de utilizadores padrão atualizada com sucesso!' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Erro ao atualizar utilizadores:', error);
        res.status(500).json({ message: 'Erro interno ao processar o arquivo de utilizadores.' });
    }
});

app.post('/api/atualizar-dados', isAdminLoggedIn, upload.fields([
    { name: 'produtosCsvFile', maxCount: 1 },
    { name: 'lojasCsvFile', maxCount: 1 } 
]), async (req, res) => {
    console.log("Iniciando a rota /api/atualizar-dados...");

    if (!req.files || !req.files.produtosCsvFile || !req.files.lojasCsvFile) {
        return res.status(400).json({ message: 'É necessário enviar os dois arquivos.' });
    }

    const client = await pool.connect();
    try {
        console.log("A processar o arquivo de produtos...");
        const produtos = await parseCsvBuffer(req.files.produtosCsvFile[0].buffer);
        console.log(`${produtos.length} produtos encontrados no CSV.`);

        console.log("A processar o arquivo de relações (loja_produtos.csv)...");

        const relacoes = await parseCsvBuffer(req.files.lojasCsvFile[0].buffer, {
            mapHeaders: ({ header }) => header.trim()
        });

        const nomesLojas = [...new Set(relacoes.map(item => item.loja_id))];
        console.log(`Sucesso! ${nomesLojas.length} lojas únicas e ${relacoes.length} relações encontradas.`);

        await client.query('BEGIN');
        console.log("Transação iniciada. A limpar tabelas antigas...");
        
        await client.query('TRUNCATE TABLE loja_produtos, produtos, lojas RESTART IDENTITY CASCADE');
        console.log("Tabelas limpas com sucesso.");

        console.log("A inserir novos produtos...");
        let produtosInseridosCount = 0;
        for (const p of produtos) {
            if (p.codigo && p.nome && p.codigo.trim() !== '') {
                await client.query(
                    'INSERT INTO produtos (codigo, nome, unidade, preco, url_imagem) VALUES ($1, $2, $3, $4, $5)',
                    [p.codigo, p.nome, p.unidade, parseFloat(p.preco) || 0, p.url_imagem]
                );
                produtosInseridosCount++;
            }
        }
        console.log(`${produtosInseridosCount} produtos válidos foram inseridos.`);

        console.log("A inserir novas lojas...");
        const lojaIdMap = {};
        for (const nome of nomesLojas) {
            const result = await client.query('INSERT INTO lojas (nome) VALUES ($1) RETURNING id', [nome]);
            lojaIdMap[nome] = result.rows[0].id;
        }
        console.log(`${nomesLojas.length} lojas inseridas.`);

        console.log("A inserir novas relações loja-produto...");
        for (const rel of relacoes) {
            const nomeLoja = rel.loja_id;
            const codigoProduto = rel.produto_codigo;
            
            if (lojaIdMap[nomeLoja] && codigoProduto) {
                 await client.query(
                    'INSERT INTO loja_produtos (loja_id, produto_codigo) VALUES ($1, $2)',
                    [lojaIdMap[nomeLoja], codigoProduto]
                );
            } else {
                console.warn(`Aviso: Relação inválida ou incompleta ignorada:`, rel);
            }
        }
        console.log(`${relacoes.length} relações processadas.`);

        await client.query('COMMIT');
        console.log("Transação concluída com sucesso (COMMIT)!");

        res.status(200).json({ message: 'Produtos e lojas atualizados com sucesso!' });

    } catch (error) {
        console.error("!!!!!!!!!! OCORREU UM ERRO DURANTE A TRANSAÇÃO !!!!!!!!!!");
        console.error("MENSAGEM DE ERRO:", error.message);
        
        await client.query('ROLLBACK');
        console.error("A TRANSAÇÃO FOI REVERTIDA (ROLLBACK).");
        
        res.status(500).json({ message: `Ocorreu um erro no servidor.`, error: error.message });
    } finally {
        client.release();
        console.log("Conexão com o banco de dados libertada.");
    }
});

app.get('/api/exportar-entradas', isAdminLoggedIn, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM itens_submetidos ORDER BY id DESC');
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Nenhuma entrada para exportar.' });
        }
        const json2csvParser = new Parser();
        const csv = json2csvParser.parse(result.rows);
        res.header('Content-Type', 'text/csv');
        res.attachment('relatorio_entradas.csv');
        res.send(csv);
    } catch (error) {
        console.error('Erro ao exportar entradas:', error);
        res.status(500).json({ message: 'Erro interno ao gerar o relatório.' });
    }
});

app.use(express.static(__dirname));

app.listen(port, () => {
  console.log(`Servidor a correr na porta ${port}`);
});