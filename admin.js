// =================================================================
// ARQUIVO admin.js - VERSÃO FINAL E LIMPA
// =================================================================

document.addEventListener('DOMContentLoaded', () => {
    
    // --- LÓGICA PARA O UPLOAD DE PRODUTOS E LOJAS ---
    const uploadForm = document.getElementById('upload-form');
    const statusMessage = document.getElementById('status-message');

    if (uploadForm) {
        uploadForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const produtosFile = document.getElementById('produtos-csv').files[0];
            const lojasFile = document.getElementById('lojas-csv').files[0];
            const formData = new FormData();
            formData.append('produtosCsvFile', produtosFile);
            formData.append('lojasCsvFile', lojasFile);

            statusMessage.textContent = 'A enviar arquivos...';
            statusMessage.style.color = 'black';

            try {
                const response = await fetch('/api/atualizar-dados', {
                    method: 'POST',
                    body: formData
                });
                const result = await response.json();
                if (response.ok) {
                    statusMessage.style.color = 'green';
                    uploadForm.reset();
                } else {
                    statusMessage.style.color = 'red';
                }
                statusMessage.textContent = result.message;
            } catch (error) {
                statusMessage.style.color = 'red';
                statusMessage.textContent = 'Erro de conexão com o servidor.';
            }
        });
    }

    // --- LÓGICA PARA O UPLOAD DE UTILIZADORES ---
    const uploadUsersForm = document.getElementById('upload-users-form');
    const uploadUsersStatus = document.getElementById('upload-users-status');

    if (uploadUsersForm) {
        uploadUsersForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const userCsvFile = document.getElementById('users-csv').files[0];
            if (!userCsvFile) {
                uploadUsersStatus.textContent = 'Por favor, selecione um arquivo.';
                return;
            }
            const formData = new FormData();
            formData.append('userCsvFile', userCsvFile);
            
            uploadUsersStatus.textContent = 'A enviar arquivo...';
            uploadUsersStatus.style.color = 'black';

            try {
                const response = await fetch('/api/upload-users', {
                    method: 'POST',
                    body: formData
                });
                const result = await response.json();
                if (response.ok) {
                    uploadUsersStatus.style.color = 'green';
                    uploadUsersForm.reset();
                } else {
                    uploadUsersStatus.style.color = 'red';
                }
                uploadUsersStatus.textContent = result.message;
            } catch (error) {
                uploadUsersStatus.style.color = 'red';
                uploadUsersStatus.textContent = 'Erro de conexão com o servidor.';
            }
        });
    }

    // --- LÓGICA PARA O BOTÃO DE LOGOUT ---
    const logoutBtn = document.getElementById('logout-btn');
    if(logoutBtn) {
        logoutBtn.addEventListener('click', async (event) => {
            event.preventDefault();
            await fetch('/api/logout', { method: 'POST' });
            window.location.href = '/login_admin.html';
        });
    }

    // DENTRO DO SEU public/admin.js, DENTRO DO DOMContentLoaded

    // --- NOVA LÓGICA PARA O BOTÃO DE EXPORTAR ---
    const exportBtn = document.getElementById('export-btn');
    const exportStatus = document.getElementById('export-status');

    if (exportBtn) {
        exportBtn.addEventListener('click', async () => {
            exportStatus.textContent = 'A gerar relatório...';
            exportStatus.style.color = 'black';

            try {
                const response = await fetch('/api/exportar-entradas');

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.message || 'Não foi possível gerar o relatório.');
                }

                // Pega os dados como um "blob" (um tipo de arquivo genérico)
                const blob = await response.blob();
                
                // Cria uma URL temporária na memória do navegador para o arquivo
                const url = window.URL.createObjectURL(blob);
                
                // Cria um link <a> invisível para iniciar o download
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                a.download = 'relatorio_entradas.csv'; // Nome do arquivo que será baixado
                
                document.body.appendChild(a);
                a.click(); // Simula o clique no link
                
                // Limpa a URL temporária da memória
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);

                exportStatus.textContent = 'Download iniciado!';
                exportStatus.style.color = 'green';

            } catch (error) {
                exportStatus.textContent = `Erro: ${error.message}`;
                exportStatus.style.color = 'red';
            }
        });
    }
});