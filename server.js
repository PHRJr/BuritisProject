// =================================================================
// ARQUIVO server.js - VERSÃO COM A CORREÇÃO NA CONSULTA SQL
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
// Confia no proxy da Render para que o cookie de sessão seguro funcione
app.set('trust proxy', 1);
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
// --- 5. CONFIGURAÇÃO DA SESSÃO ---
app.use(session({
    secret: process.env.SESSION_SECRET || 'seu-segredo-deve-ser-muito-bem-guardado',
    resave: false,
    saveUninitialized: false, // Alterado para false para melhores práticas
    cookie: { 
        secure: process.env.NODE_ENV === 'production', // Mantém-se igual
        maxAge: 24 * 60 * 60 * 1000, // 24 horas
        httpOnly: true // Adicionado para segurança extra
    }
}));

// --- 6. MIDDLEWARE DE AUTENTICAÇÃO ---

const isUserLoggedIn = (req, res, next) => {
    if (req.session.user) {
        return next(); // Se o utilizador está logado, continua
    }

    // Se não estiver logado, verificamos o tipo de pedido
    if (req.headers.accept && req.headers.accept.includes('json')) {
        // Se for um pedido de API (como o do script.js), envia um erro JSON
        return res.status(401).json({ message: 'Acesso não autorizado. Por favor, faça login novamente.' });
    } else {
        // Se for uma navegação de página, redireciona para o login
        return res.redirect('/login.html');
    }
};

// A função isAdminLoggedIn permanece igual
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

// --- INÍCIO DA CORREÇÃO ---
app.get('/api/produtos', isUserLoggedIn, async (req, res) => {
    const { loja } = req.query;
    try {
        // CORREÇÃO: A consulta agora começa na mesma linha da crase, sem espaços antes.
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
// --- FIM DA CORREÇÃO ---

// --- CÓDIGO CORRIGIDO ---
app.post('/api/adicionar_item', isUserLoggedIn, async (req, res) => {
    const { loja, nome, telefone, produtos } = req.body;
    const emailUsuarioLogado = req.session.user.email;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        for (const produto of produtos) {
            const validadeSQL = produto.validade ? produto.validade.split('/').reverse().join('-') : null;
            
            // A consulta foi reescrita para garantir que não há caracteres inválidos.
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
// --- ROTAS DE UPLOAD E EXPORTAÇÃO (ADMIN) ---

// ROTA PARA ATUALIZAR UTILIZADORES
app.post('/api/upload-users', isAdminLoggedIn, upload.single('userCsvFile'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'Nenhum arquivo CSV de utilizador enviado.' });
    }
    try {
        const client = await pool.connect();
        await client.query('BEGIN');
        await client.query('DELETE FROM utilizadores_padrao'); // Limpa a tabela

        const users = await parseCsvBuffer(req.file.buffer);

        for (const user of users) {
            if (user.email) { // Garante que a coluna 'email' existe
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

// ROTA PARA ATUALIZAR PRODUTOS E LOJAS
// ROTA PARA ATUALIZAR PRODUTOS E LOJAS (COM DIAGNÓSTICO MELHORADO)
app.post('/api/atualizar-dados', isAdminLoggedIn, upload.fields([
    { name: 'produtosCsvFile', maxCount: 1 },
    { name: 'lojasCsvFile', maxCount: 1 }
]), async (req, res) => {
    console.log("Iniciando a rota /api/atualizar-dados...");

    if (!req.files || !req.files.produtosCsvFile || !req.files.lojasCsvFile) {
        console.error("ERRO: Faltam arquivos. Upload abortado.");
        return res.status(400).json({ message: 'É necessário enviar os dois arquivos.' });
    }

    const client = await pool.connect();
    try {
        // --- ETAPA DE PARSING ---
        console.log("A processar o arquivo de produtos...");
        const produtos = await parseCsvBuffer(req.files.produtosCsvFile[0].buffer);
        console.log(`Sucesso! ${produtos.length} produtos encontrados no CSV.`);
        // Linha de diagnóstico: descomente se precisar de ver os dados dos produtos
        // console.log("Dados dos produtos:", JSON.stringify(produtos, null, 2));

        console.log("A processar o arquivo de lojas...");
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
        console.log(`Sucesso! ${nomesLojas.length} lojas e ${relacoes.length} relações encontradas no CSV.`);
        // Linha de diagnóstico: descomente se precisar de ver os dados das lojas
        // console.log("Nomes das lojas:", nomesLojas);
        // console.log("Relações:", relacoes);

        // --- ETAPA DE BANCO DE DADOS ---
        await client.query('BEGIN');
        console.log("Transação iniciada. A limpar tabelas antigas...");
        
        await client.query('TRUNCATE TABLE loja_produtos, produtos, lojas RESTART IDENTITY CASCADE');
        console.log("Tabelas limpas com sucesso.");

        console.log("A inserir novos produtos...");
        let produtosInseridosCount = 0;
        for (const p of produtos) {
            // CORREÇÃO: Se a linha for inválida (sem código ou nome), simplesmente ignoramos e passamos à próxima.
            if (p.codigo && p.nome && p.codigo.trim() !== '') {
                await client.query(
                    'INSERT INTO produtos (codigo, nome, unidade, preco, url_imagem) VALUES ($1, $2, $3, $4, $5)',
                    [p.codigo, p.nome, p.unidade, parseFloat(p.preco_unitario) || 0, p.imagem_url]
                );
                produtosInseridosCount++;
            } else {
                console.log("Aviso: Linha de produto vazia ou inválida ignorada no CSV:", JSON.stringify(p));
            }
        }
        console.log(`${produtosInseridosCount} produtos válidos foram inseridos.`);
        console.log(`${produtos.length} produtos inseridos.`);

        console.log("A inserir novas lojas...");
        const lojaIdMap = {};
        for (const nome of nomesLojas) {
            const result = await client.query('INSERT INTO lojas (nome) VALUES ($1) RETURNING id', [nome]);
            lojaIdMap[nome] = result.rows[0].id;
        }
        console.log(`${nomesLojas.length} lojas inseridas.`);

        console.log("A inserir novas relações loja-produto...");
        for (const rel of relacoes) {
            await client.query(
                'INSERT INTO loja_produtos (loja_id, produto_codigo) VALUES ($1, $2)',
                [lojaIdMap[rel.nome_loja], rel.produto_codigo]
            );
        }
        console.log(`${relacoes.length} relações inseridas.`);

        await client.query('COMMIT');
        console.log("Transação concluída com sucesso (COMMIT)!");

        res.status(200).json({ message: 'Produtos e lojas atualizados com sucesso!' });

    } catch (error) {
        // --- BLOCO DE ERRO ---
        console.error("!!!!!!!!!! OCORREU UM ERRO DURANTE A TRANSAÇÃO !!!!!!!!!!");
        console.error("MENSAGEM DE ERRO:", error.message);
        console.error("DETALHES COMPLETOS DO ERRO:", error); // Log completo
        
        await client.query('ROLLBACK');
        console.error("A TRANSAÇÃO FOI REVERTIDA (ROLLBACK). Os dados antigos foram apagados, mas os novos não foram salvos.");
        
        // Envia uma mensagem de erro mais informativa para o frontend
        res.status(500).json({ 
            message: `Ocorreu um erro no servidor ao processar os arquivos. Verifique os logs da aplicação.`,
            error: error.message 
        });
    } finally {
        client.release();
        console.log("Conexão com o banco de dados libertada.");
    }
});

// ROTA PARA EXPORTAR ENTRADAS
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