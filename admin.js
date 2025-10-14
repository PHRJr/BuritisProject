document.addEventListener('DOMContentLoaded', () => {
    
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

            statusMessage.textContent = 'Sincronizando alterações...';
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

    const exportBtn = document.getElementById('export-btn');
    const exportStatus = document.getElementById('export-status');

    if (exportBtn) {
        exportBtn.addEventListener('click', async () => {
            exportStatus.textContent = 'Gerando relatório';
            exportStatus.style.color = 'black';

            try {
                const response = await fetch('/api/exportar-entradas');

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.message || 'Não foi possível gerar o relatório.');
                }

                const blob = await response.blob();
                
                const url = window.URL.createObjectURL(blob);
                
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                a.download = 'relatorio_entradas.csv';
                
                document.body.appendChild(a);
                a.click(); 
                
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

    const logoutBtn = document.getElementById('logout-btn');
    if(logoutBtn) {
        logoutBtn.addEventListener('click', async (event) => {
            event.preventDefault();
            await fetch('/api/logout', { method: 'POST' });
            window.location.href = '/login_admin.html';
        });
    }
});