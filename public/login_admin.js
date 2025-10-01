// VERSÃO FINAL E COMPLETA DO login_admin.js

document.addEventListener('DOMContentLoaded', () => {
    const adminLoginForm = document.getElementById('admin-login-form');
    const adminLoginError = document.getElementById('admin-login-error');

    if (adminLoginForm) {
        adminLoginForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            adminLoginError.textContent = ''; // Limpa erros antigos

            const email = document.getElementById('admin-email').value;
            const password = document.getElementById('admin-password').value;

            try {
                const response = await fetch('/api/admin-login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });
                
                const result = await response.json();

                if (response.ok) {
                    // SUCESSO!
                    adminLoginError.style.color = 'green';
                    adminLoginError.textContent = result.message || 'Login bem-sucedido! A redirecionar...';
                    
                    // Adicionamos um pequeno atraso para que o admin possa ler a mensagem
                    setTimeout(() => {
                        window.location.href = '/admin.html';
                    }, 1000); // 1 segundo de atraso

                } else {
                    // ERRO (ex: credenciais inválidas)
                    adminLoginError.style.color = 'red';
                    adminLoginError.textContent = result.message;
                }
            } catch (error) {
                // Erro de rede ou servidor não respondeu
                console.error('Erro de conexão:', error);
                adminLoginError.textContent = 'Erro de conexão com o servidor.';
            }
        });
    }
    
});