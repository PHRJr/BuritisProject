# servidor.py
import os
import csv
from flask import Flask, request, jsonify, send_from_directory

# Inicializa a aplicação Flask
app = Flask(__name__)

# Rota para servir os arquivos CSV para o JavaScript poder lê-los
@app.route('/<path:filename>')
def serve_static(filename):
    return send_from_directory('.', filename)

# Rota que vai receber os dados da página de produtos e salvar no CSV
@app.route('/salvar-dados', methods=['POST'])
def salvar_dados():
    """
    Recebe os dados do formulário da página de produtos e os anexa ao export.csv.
    """
    # Pega os dados enviados pelo JavaScript. Eles vêm em formato JSON.
    dados_recebidos = request.json['produtos']
    
    # Define o nome do arquivo de exportação
    nome_arquivo_export = 'export.csv'
    
    # Verifica se o arquivo já existe para saber se precisa escrever o cabeçalho
    arquivo_existe = os.path.isfile(nome_arquivo_export)
    
    try:
        # Abre o arquivo no modo 'a' (append/anexar), para adicionar no final sem apagar o que já existe
        with open(nome_arquivo_export, mode='a', newline='', encoding='utf-8') as f:
            escritor_csv = csv.writer(f)
            
            # Se o arquivo não existia, escreve o cabeçalho primeiro
            if not arquivo_existe:
                escritor_csv.writerow(['codigo_produto', 'quantidade', 'data_validade', 'nome_usuario', 'telefone_usuario', 'loja'])
            
            # Pega os dados do usuário e da loja que também foram enviados
            nome_usuario = request.json['nome']
            telefone_usuario = request.json['telefone']
            loja = request.json['loja']

            # Escreve uma linha no CSV para cada produto recebido
            for produto in dados_recebidos:
                escritor_csv.writerow([
                    produto['codigo'], 
                    produto['quantidade'], 
                    produto['validade'],
                    nome_usuario,
                    telefone_usuario,
                    loja
                ])
                
        # Retorna uma resposta de sucesso para o navegador
        return jsonify({"status": "sucesso", "mensagem": "Dados salvos com sucesso!"}), 200

    except Exception as e:
        # Em caso de erro, retorna uma mensagem de erro
        print(f"Erro ao salvar dados: {e}")
        return jsonify({"status": "erro", "mensagem": str(e)}), 500

# Rota principal para carregar o index.html
@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

# Inicia o servidor quando o script é executado
if __name__ == '__main__':
    # debug=True faz com que o servidor reinicie automaticamente quando você altera o código
    app.run(host='0.0.0.0', debug=True, port=5000)