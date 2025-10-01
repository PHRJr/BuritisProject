// VERSÃO FINAL E COMPLETA DO login.js

document.addEventListener('DOMContentLoaded', () => {
    const userLoginForm = document.getElementById('user-login-form');
    const userLoginStatus = document.getElementById('user-login-status');

    if (userLoginForm) {
        userLoginForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            userLoginStatus.textContent = 'A verificar email...';
            userLoginStatus.style.color = 'grey';

            const email = document.getElementById('user-email').value;

            try {
                const response = await fetch('/api/user-login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });

                const result = await response.json();

                if (response.ok) {
                    // SUCESSO!
                    userLoginStatus.style.color = 'green';
                    userLoginStatus.textContent = result.message || 'Login bem-sucedido! A redirecionar...';
                    
                    // Adicionamos um pequeno atraso para que o utilizador possa ler a mensagem
                    setTimeout(() => {
                        window.location.href = '/index.html';
                    }, 1000); // 1 segundo de atraso

                } else {
                    // ERRO (ex: email não autorizado)
                    userLoginStatus.style.color = 'red';
                    userLoginStatus.textContent = result.message || 'Erro ao tentar aceder.';
                }
            } catch (error) {
                console.error('Erro de conexão:', error);
                userLoginStatus.style.color = 'red';
                userLoginStatus.textContent = 'Não foi possível conectar ao servidor.';
            }
        });
    }
});