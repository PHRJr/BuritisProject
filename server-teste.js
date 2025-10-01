// DENTRO DO NOVO ARQUIVO: server-teste.js

const express = require('express');
const path = require('path');
const app = express();
const port = 3000;

// Serve os arquivos da pasta 'public'
app.use(express.static(path.join(__dirname, 'public')));

// Rota de teste para as lojas. Não usa o banco de dados.
app.get('/api/lojas', (req, res) => {
    // Esta mensagem PROVA que a rota foi acessada com sucesso.
    console.log('>>> ROTA DE TESTE /api/lojas FOI ACESSADA! <<<');
    
    const lojasFalsas = ["Loja de Teste 1", "Loja de Teste 2", "Teste Funcionou!"];
    res.status(200).json(lojasFalsas);
});

app.listen(port, () => {
    console.log(`--- SERVIDOR DE TESTE a correr na porta ${port} ---`);
});