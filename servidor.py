import os
import psycopg2
import psycopg2.extras # Importante para o DictCursor
from flask import Flask, request, jsonify, send_from_directory
from decimal import Decimal, InvalidOperation # Para lidar com números decimais

app = Flask(__name__)

# --- Conexão com o Banco de Dados ---
def get_db_connection():
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        raise ValueError("A variável de ambiente DATABASE_URL não foi definida.")
    conn = psycopg2.connect(db_url)
    return conn

# --- Rotas da API (A Lógica do seu App) ---
@app.route('/api/adicionar_item', methods=['POST'])
def adicionar_item():
    """Recebe uma lista de produtos e os insere no banco de dados."""
    try:
        data = request.get_json()

        # Extrai os dados gerais
        loja = data.get('loja')
        user = data.get('nome')
        telefone_str = ''.join(filter(str.isdigit, data.get('telefone', '')))
        
        # Converte telefone para número, se possível
        telefone = int(telefone_str) if telefone_str else None

        # Pega a lista de produtos
        produtos = data.get('produtos')

        if not produtos:
            return jsonify({'error': 'A lista de produtos está vazia.'}), 400

        conn = get_db_connection()
        cur = conn.cursor()

        # SQL para inserir os dados de forma SEGURA
        sql = """
            INSERT INTO entradas (cod_item, qtde, validade, "user", telefone, loja)
            VALUES (%s, %s, %s, %s, %s, %s);
        """
        
        # Itera sobre cada produto da lista e o insere no banco
        for produto in produtos:
            cod_item = produto.get('codigo')
            
            # Tratamento da quantidade: troca vírgula por ponto e converte para Decimal
            try:
                qtde_str = produto.get('quantidade', '0').replace(',', '.')
                qtde = Decimal(qtde_str)
            except InvalidOperation:
                qtde = Decimal('0')

            # Tratamento da data: converte de DD/MM/AAAA para AAAA-MM-DD se não for vazia
            validade_str = produto.get('validade')
            if validade_str and len(validade_str.split('/')) == 3:
                partes = validade_str.split('/')
                validade = f"{partes[2]}-{partes[1]}-{partes[0]}"
            else:
                validade = None # Salva como nulo se a data for inválida ou vazia

            # Executa o comando para este produto
            cur.execute(sql, (cod_item, qtde, validade, user, telefone, loja))

        conn.commit()
        cur.close()
        conn.close()
        
        return jsonify({'message': 'Dados salvos com sucesso!'}), 201

    except Exception as e:
        return jsonify({'error': f"Ocorreu um erro: {str(e)}"}), 500

@app.route('/api/itens', methods=['GET'])
def listar_itens():
    """Busca e retorna todos os itens salvos no banco de dados."""
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
        cur.execute('SELECT * FROM entradas ORDER BY id DESC;')
        itens = cur.fetchall()
        cur.close()
        conn.close()
        return jsonify([dict(item) for item in itens])

    except Exception as e:
        return jsonify({'error': f"Ocorreu um erro: {str(e)}"}), 500

# --- Rotas para Servir os Arquivos HTML/CSS/JS (Frontend) ---
@app.route('/')
def rota_principal():
    return send_from_directory('.', 'index.html')

@app.route('/<path:filename>')
def servir_pagina(filename):
    return send_from_directory('.', filename)