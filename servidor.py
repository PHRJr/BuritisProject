import os
from flask import Flask, request, jsonify, send_from_directory
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.sql import func
from dotenv import load_dotenv

# Carrega as variáveis de ambiente do arquivo .env (para uso local)
load_dotenv()

# --- INICIALIZAÇÃO E CONFIGURAÇÃO ---
app = Flask(__name__)

# Configuração do Banco de Dados (sem alterações)
if 'DATABASE_URL' in os.environ:
    database_url = os.environ['DATABASE_URL']
    # A Render já fornece a URL no formato correto (postgresql://),
    # mas esta verificação garante compatibilidade com outras plataformas.
    if database_url.startswith("postgres://"):
        database_url = database_url.replace("postgres://", "postgresql://", 1)
    app.config['SQLALCHEMY_DATABASE_URI'] = database_url
else:
    # Para desenvolvimento local, se não houver DATABASE_URL
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///local.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)


# --- MODELO DA TABELA (COM A CORREÇÃO DE SINTAXE) ---
class Entradas(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    cod_item = db.Column(db.String(255), nullable=False)
    qtde = db.Column(db.Numeric(10, 3))
    validade = db.Column(db.Date)
    "user" = db.Column('user', db.String(255))
    telefone = db.Column(db.BigInteger)
    loja = db.Column(db.String(255))
    atualizacao = db.Column(db.DateTime(timezone=True), server_default=func.now())
    preco_unitario = db.Column(db.Numeric(10, 2))

    def to_dict(self):
        d = {}
        for c in self.__table__.columns:
            val = getattr(self, c.name)
            if hasattr(val, 'isoformat'):
                d[c.name] = val.isoformat()
            elif isinstance(val, (int, str, float, bool)) or val is None:
                d[c.name] = val
            else:
                d[c.name] = str(val)
        return d


# --- ROTAS DA API (sem alterações) ---
@app.route('/api/adicionar_item', methods=['POST'])
def adicionar_item():
    try:
        data = request.get_json()
        loja = data.get('loja')
        user_data = data.get('nome')
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
                    validade = f"{partes[2]}-{partes[1]}-{partes[0]}"
                except IndexError:
                    validade = None

            nova_entrada = Entradas(
                cod_item=produto.get('codigo'),
                qtde=str(produto.get('quantidade', '0')).replace(',', '.'),
                validade=validade,
                user=user_data,
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
@app.route('/')
def rota_principal():
    return send_from_directory('.', 'login.html')

@app.route('/<path:filename>')
def servir_arquivos(filename):
    return send_from_directory('.', filename)


# --- BLOCO PARA RODAR LOCALMENTE ---
if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True, port=5000)
