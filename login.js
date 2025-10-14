document.addEventListener('DOMContentLoaded', () => {
    const userLoginForm = document.getElementById('user-login-form');
    const userLoginStatus = document.getElementById('user-login-status');

    if (userLoginForm) {
        userLoginForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            userLoginStatus.textContent = 'Verificando...';
            userLoginStatus.style.color = 'grey';

            const senha = document.getElementById('user-passcode').value;

try {
    const response = await fetch('/api/user-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senha }) 
    });

                const result = await response.json();

                if (response.ok) {
                    // SUCESSO!
                    userLoginStatus.style.color = 'green';
                    userLoginStatus.textContent = result.message || 'Seja bem vindo!';
                    setTimeout(() => {
                        window.location.href = '/index.html';
                    }, 1000); // 1 segundo de atraso

                } else {
                    // ERRO
                    userLoginStatus.style.color = 'red';
                    userLoginStatus.textContent = result.message || 'Usuário não encontrado.';
                }
            } catch (error) {
                console.error('Erro de conexão:', error);
                userLoginStatus.style.color = 'red';
                userLoginStatus.textContent = 'Não foi possível conectar ao servidor.';
            }
        });
    }
});