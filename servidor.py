import os
import psycopg2
from flask import Flask, request, jsonify, send_from_directory

# Inicializa a aplicação Flask
app = Flask(__name__)

# --- Conexão com o Banco de Dados ---
# Função auxiliar para não repetir o código de conexão
def get_db_connection():
    """Cria e retorna uma nova conexão com o banco de dados."""
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        # Isso ajuda a identificar o erro caso a variável de ambiente não esteja configurada
        raise ValueError("A variável de ambiente DATABASE_URL não foi definida.")
    conn = psycopg2.connect(db_url)
    return conn

# --- Rotas da API (A Lógica do seu App) ---

@app.route('/api/adicionar_item', methods=['POST'])
def adicionar_item():
    """Recebe dados via POST e insere no banco de dados."""
    try:
        data = request.get_json()

        # Extrai os dados, garantindo que não dê erro se um campo vier vazio
        cod_item = data.get('COD_ITEM')
        qtde = data.get('QTDE')
        validade = data.get('VALIDADE')
        user = data.get('USER')
        telefone = data.get('TELEFONE')
        loja = data.get('LOJA')

        # Validação para garantir que o campo principal foi enviado
        if not cod_item:
            return jsonify({'error': 'COD_ITEM é um campo obrigatório'}), 400

        conn = get_db_connection()
        cur = conn.cursor()

        # Comando SQL seguro para inserir os dados
        sql = """
            INSERT INTO entradas (cod_item, qtde, validade, "user", telefone, loja)
            VALUES (%s, %s, %s, %s, %s, %s);
        """
        
        cur.execute(sql, (cod_item, qtde, validade, user, telefone, loja))

        conn.commit()
        cur.close()
        conn.close()
        
        return jsonify({'message': 'Dados salvos com sucesso!'}), 201

    except Exception as e:
        # Retorna uma mensagem de erro clara se algo der errado
        return jsonify({'error': f"Ocorreu um erro: {str(e)}"}), 500

@app.route('/api/itens', methods=['GET'])
def listar_itens():
    """Busca e retorna todos os itens salvos no banco de dados."""
    try:
        conn = get_db_connection()
        # O cursor "dict" retorna os dados como um dicionário (chave: valor), mais fácil de usar no frontend
        cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
        
        # Ordena os itens pelo ID, do mais recente para o mais antigo
        cur.execute('SELECT * FROM entradas ORDER BY id DESC;')
        itens = cur.fetchall()
        
        cur.close()
        conn.close()

        # Converte a lista de itens para um formato JSON e a retorna
        return jsonify([dict(item) for item in itens])

    except Exception as e:
        return jsonify({'error': f"Ocorreu um erro: {str(e)}"}), 500

# --- Rotas para Servir os Arquivos HTML/CSS/JS (Frontend) ---

@app.route('/')
def rota_principal():
    """Serve a página inicial 'index.html'."""
    return send_from_directory('.', 'index.html')

@app.route('/<path:filename>')
def servir_pagina(filename):
    """Serve qualquer outro arquivo (ex: produtos.html, estilo.css, script.js)."""
    return send_from_directory('.', filename)
