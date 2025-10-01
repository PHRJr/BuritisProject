// ARQUIVO: criar-usuario.js
const bcrypt = require('bcrypt');

const senhaPlana = 'minhaSenhaSuperSecreta'; // <-- Coloque a senha que você quer para o admin aqui
const saltRounds = 10; // Fator de custo do hashing

bcrypt.hash(senhaPlana, saltRounds, function(err, hash) {
    if (err) {
        console.error("Erro ao gerar o hash:", err);
        return;
    }
    console.log(`Senha Plana: ${senhaPlana}`);
    console.log('Hash Gerado (copie e cole no seu comando INSERT):');
    console.log(hash);
});