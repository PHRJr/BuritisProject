import os
from flask import Flask, request, jsonify, send_from_directory
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.sql import func
from dotenv import load_dotenv

# Carrega as variáveis de ambiente do arquivo .env (para uso local)
load_dotenv()

# --- INICIALIZAÇÃO E CONFIGURAÇÃO ---
# Com todos os arquivos na raiz, a inicialização do Flask é a mais simples possível
app = Flask(__name__)

# Configuração do Banco de Dados (sem alterações)
if 'DATABASE_URL' in os.environ:
    database_url = os.environ['DATABASE_URL'].replace("://", "ql://", 1)
    app.config['SQLALCHEMY_DATABASE_URI'] = database_url
else:
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///local.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)


# --- MODELO DA TABELA (sem alterações) ---
class Entradas(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    cod_item = db.Column(db.String(255), nullable=False)
    qtde = db.Column(db.Numeric(10, 3))
    validade = db.Column(db.Date)
    user = db.Column('user', db.String(255))
    telefone = db.Column(db.BigInteger)
    loja = db.Column(db.String(255))
    atualizacao = db.Column(db.DateTime(timezone=True), server_default=func.now())
    preco_unitario = db.Column(db.Numeric(10, 2))

    def to_dict(self):
        # Converte o objeto para um dicionário, útil para retornar JSON
        # Lida com a conversão de tipos que não são JSON-serializáveis por padrão
        d = {}
        for c in self.__table__.columns:
            val = getattr(self, c.name)
            if hasattr(val, 'isoformat'): # Converte datas/datetimes
                d[c.name] = val.isoformat()
            elif isinstance(val, (int, str, float, bool)) or val is None:
                d[c.name] = val
            else: # Converte outros tipos (como Decimal) para string
                d[c.name] = str(val)
        return d


# --- ROTAS DA API (sem alterações na lógica interna) ---
@app.route('/api/adicionar_item', methods=['POST'])
def adicionar_item():
    try:
        data = request.get_json()
        loja = data.get('loja')
        user = data.get('nome')
        telefone_str = ''.join(filter(str.isdigit, data.get('telefone', '')))
        telefone = int(telefone_str) if telefone_str else None
        produtos = data.get('produtos')

        if not produtos:
            return jsonify({'error': 'A lista de produtos está vazia.'}), 400

        for produto in produtos:
            validade_str = produto.get('validade')
            validade = None
            if validade_str and len(validade_str.split('/')) == 3:
                partes = validade_str.split('/')
                try:
                    # Formato AAAA-MM-DD
                    validade = f"{partes[2]}-{partes[1]}-{partes[0]}"
                except IndexError:
                    validade = None # Ignora datas mal formatadas

            nova_entrada = Entradas(
                cod_item=produto.get('codigo'),
                qtde=str(produto.get('quantidade', '0')).replace(',', '.'),
                validade=validade,
                user=user,
                telefone=telefone,
                loja=loja,
                preco_unitario=str(produto.get('preco_unitario', '0')).replace(',', '.')
            )
            db.session.add(nova_entrada)

        db.session.commit()
        return jsonify({'message': 'Dados salvos com sucesso!'}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f"Ocorreu um erro: {str(e)}"}), 500


@app.route('/api/itens', methods=['GET'])
def listar_itens():
    try:
        todas_as_entradas = Entradas.query.order_by(Entradas.id.desc()).all()
        return jsonify([entrada.to_dict() for entrada in todas_as_entradas])
    except Exception as e:
        return jsonify({'error': f"Ocorreu um erro: {str(e)}"}), 500


# --- ROTAS PARA SERVIR AS PÁGINAS E ARQUIVOS ---

# CORREÇÃO 1: A rota principal agora serve 'login.html' (ou o nome que você usar)
@app.route('/')
def rota_principal():
    # Se seu arquivo de login se chama 'index.html', mude 'login.html' para 'index.html'
    return send_from_directory('.', 'login.html')

# Esta rota "pega-tudo" agora serve todos os outros arquivos (produtos.html, estilo.css, etc.)
@app.route('/<path:filename>')
def servir_arquivos(filename):
    return send_from_directory('.', filename)


# CORREÇÃO 2: Bloco para rodar o servidor localmente foi restaurado e corrigido
if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    # Roda o servidor Flask para desenvolvimento
    app.run(debug=True, port=5000)
