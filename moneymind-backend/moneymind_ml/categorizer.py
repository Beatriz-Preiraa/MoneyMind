"""
categorizer.py — Categorizacao automatica de transacoes

Como funciona:
  1. Treina um modelo Naive Bayes com exemplos de descricoes de transacoes
     mapeadas para categorias (ex: "ifood" -> "Alimentacao").
  2. Quando o usuario lanca uma transacao pelo WhatsApp sem informar a categoria,
     o modelo tenta adivinhar com base na descricao.
  3. O modelo salvo em disco (modelo_categorias.pkl) e reutilizado nas chamadas
     seguintes — nao precisa treinar de novo a cada requisicao.

Precisao esperada com o conjunto de treino atual: ~85-90% nas categorias comuns.
"""

import os
import joblib
import re
import unicodedata
from sklearn.pipeline import Pipeline
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.naive_bayes import MultinomialNB
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report

# Caminho onde o modelo treinado fica salvo
MODEL_PATH = os.path.join(os.path.dirname(__file__), "modelo_categorias.pkl")

# -----------------------------------------------------------------------
# Dataset de treino — descricoes reais de transacoes + categoria correta
# Quanto mais exemplos, melhor a precisao. Adicione exemplos do seu dia a dia.
# -----------------------------------------------------------------------
TRAINING_DATA = [
    # Alimentacao
    ("ifood", "Alimentacao"),
    ("rappi", "Alimentacao"),
    ("uber eats", "Alimentacao"),
    ("mcdonalds", "Alimentacao"),
    ("burger king", "Alimentacao"),
    ("supermercado", "Alimentacao"),
    ("mercado", "Alimentacao"),
    ("padaria", "Alimentacao"),
    ("acougue", "Alimentacao"),
    ("hortifruti", "Alimentacao"),
    ("feira", "Alimentacao"),
    ("pizza", "Alimentacao"),
    ("restaurante", "Alimentacao"),
    ("lanchonete", "Alimentacao"),
    ("sushi", "Alimentacao"),
    ("extra supermercado", "Alimentacao"),
    ("pao de acucar", "Alimentacao"),
    ("carrefour", "Alimentacao"),
    ("atacadao", "Alimentacao"),
    ("assai", "Alimentacao"),
    ("mercado livre alimentos", "Alimentacao"),
    ("bebida", "Alimentacao"),
    ("cafe", "Alimentacao"),
    ("sorveteria", "Alimentacao"),

    # Transporte
    ("uber", "Transporte"),
    ("99", "Transporte"),
    ("99app", "Transporte"),
    ("cabify", "Transporte"),
    ("gasolina", "Transporte"),
    ("combustivel", "Transporte"),
    ("etanol", "Transporte"),
    ("shell", "Transporte"),
    ("ipiranga posto", "Transporte"),
    ("estacionamento", "Transporte"),
    ("pedagio", "Transporte"),
    ("sem parar", "Transporte"),
    ("onibus", "Transporte"),
    ("metro", "Transporte"),
    ("bilhete unico", "Transporte"),
    ("conserto carro", "Transporte"),
    ("mecanica", "Transporte"),
    ("troca oleo", "Transporte"),
    ("pneu", "Transporte"),
    ("ipva", "Transporte"),
    ("licenciamento", "Transporte"),

    # Moradia
    ("aluguel", "Moradia"),
    ("condominio", "Moradia"),
    ("agua", "Moradia"),
    ("luz", "Moradia"),
    ("energia", "Moradia"),
    ("enel", "Moradia"),
    ("sabesp", "Moradia"),
    ("gas", "Moradia"),
    ("internet", "Moradia"),
    ("vivo", "Moradia"),
    ("claro", "Moradia"),
    ("tim", "Moradia"),
    ("oi fibra", "Moradia"),
    ("iptu", "Moradia"),
    ("reforma", "Moradia"),
    ("manutencao", "Moradia"),
    ("eletricista", "Moradia"),
    ("encanador", "Moradia"),
    ("pintura", "Moradia"),

    # Saude
    ("farmacia", "Saude"),
    ("drogasil", "Saude"),
    ("droga raia", "Saude"),
    ("ultrafarma", "Saude"),
    ("remedio", "Saude"),
    ("medico", "Saude"),
    ("consulta", "Saude"),
    ("dentista", "Saude"),
    ("psicologica", "Saude"),
    ("psiquiatra", "Saude"),
    ("exame", "Saude"),
    ("laboratorio", "Saude"),
    ("hospital", "Saude"),
    ("pronto socorro", "Saude"),
    ("plano saude", "Saude"),
    ("unimed", "Saude"),
    ("hapvida", "Saude"),
    ("amil", "Saude"),
    ("suplemento", "Saude"),
    ("whey", "Saude"),

    # Lazer
    ("netflix", "Lazer"),
    ("spotify", "Lazer"),
    ("amazon prime", "Lazer"),
    ("disney plus", "Lazer"),
    ("hbo max", "Lazer"),
    ("globoplay", "Lazer"),
    ("youtube premium", "Lazer"),
    ("steam", "Lazer"),
    ("jogo", "Lazer"),
    ("cinema", "Lazer"),
    ("teatro", "Lazer"),
    ("show", "Lazer"),
    ("ingresso", "Lazer"),
    ("balada", "Lazer"),
    ("bar", "Lazer"),
    ("academia", "Lazer"),
    ("smart fit", "Lazer"),
    ("bodytech", "Lazer"),
    ("viagem", "Lazer"),
    ("hotel", "Lazer"),
    ("airbnb", "Lazer"),
    ("passagem", "Lazer"),
    ("livro", "Lazer"),

    # Educacao
    ("faculdade", "Educacao"),
    ("mensalidade", "Educacao"),
    ("unifecaf", "Educacao"),
    ("curso", "Educacao"),
    ("udemy", "Educacao"),
    ("alura", "Educacao"),
    ("rocketseat", "Educacao"),
    ("escola", "Educacao"),
    ("material escolar", "Educacao"),
    ("apostila", "Educacao"),
    ("certificacao", "Educacao"),

    # Investimento / Reserva
    ("tesouro direto", "Investimento"),
    ("tesouro selic", "Investimento"),
    ("cdb", "Investimento"),
    ("lci", "Investimento"),
    ("lca", "Investimento"),
    ("fundo", "Investimento"),
    ("acao", "Investimento"),
    ("dividendo", "Investimento"),
    ("corretora", "Investimento"),
    ("xp investimentos", "Investimento"),
    ("nubank investimento", "Investimento"),
    ("rico", "Investimento"),
    ("poupanca", "Investimento"),
    ("reserva", "Investimento"),
    ("previdencia", "Investimento"),

    # Renda (entradas)
    ("salario", "Renda"),
    ("pagamento", "Renda"),
    ("freelance", "Renda"),
    ("pix recebido", "Renda"),
    ("transferencia recebida", "Renda"),
    ("bonus", "Renda"),
    ("decimo terceiro", "Renda"),
    ("ferias", "Renda"),
    ("rendimento", "Renda"),
    ("aluguel recebido", "Renda"),

    # Vestuario
    ("roupa", "Vestuario"),
    ("calcado", "Vestuario"),
    ("tenis", "Vestuario"),
    ("camisa", "Vestuario"),
    ("camiseta", "Vestuario"),
    ("calca", "Vestuario"),
    ("zara", "Vestuario"),
    ("hm", "Vestuario"),
    ("renner", "Vestuario"),
    ("riachuelo", "Vestuario"),
    ("c&a", "Vestuario"),
]


def normalizar(texto: str) -> str:
    """
    Remove acentos, converte para minusculas e elimina caracteres especiais.
    Isso melhora a generalizacao do modelo (ex: 'Farmácia' == 'farmacia').
    """
    texto = texto.lower().strip()
    # Remove acentos
    texto = unicodedata.normalize("NFKD", texto)
    texto = "".join(c for c in texto if not unicodedata.combining(c))
    # Mantém apenas letras e espacos
    texto = re.sub(r"[^a-z\s]", " ", texto)
    texto = re.sub(r"\s+", " ", texto).strip()
    return texto


def treinar_modelo() -> Pipeline:
    """
    Treina o classificador e salva em disco.
    Chame isso manualmente ou quando adicionar novos exemplos de treino.
    """
    descricoes  = [normalizar(d) for d, _ in TRAINING_DATA]
    categorias  = [c for _, c in TRAINING_DATA]

    # Pipeline: TF-IDF transforma texto em numeros → Naive Bayes classifica
    # TF-IDF funciona bem para textos curtos como descricoes de transacoes
    modelo = Pipeline([
        ("tfidf", TfidfVectorizer(
            ngram_range=(1, 2),   # considera pares de palavras (ex: "tesouro selic")
            min_df=1,
            analyzer="word",
        )),
        ("clf", MultinomialNB(alpha=0.5)),  # alpha=0.5 reduz overfitting em datasets pequenos
    ])

    # Avalia o modelo com 20% dos dados separados para teste
    if len(descricoes) >= 10:
        X_train, X_test, y_train, y_test = train_test_split(
            descricoes, categorias, test_size=0.2, random_state=42
        )
        modelo.fit(X_train, y_train)
        previsoes = modelo.predict(X_test)
        print("Relatorio de precisao do modelo:")
        print(classification_report(y_test, previsoes, zero_division=0))
    else:
        modelo.fit(descricoes, categorias)

    # Treina com todos os dados antes de salvar
    modelo.fit(descricoes, categorias)
    joblib.dump(modelo, MODEL_PATH)
    print(f"Modelo salvo em: {MODEL_PATH}")
    return modelo


def carregar_modelo() -> Pipeline:
    """
    Carrega o modelo do disco. Se nao existir, treina um novo automaticamente.
    """
    if os.path.exists(MODEL_PATH):
        return joblib.load(MODEL_PATH)
    print("Modelo nao encontrado. Treinando novo modelo...")
    return treinar_modelo()


# Instancia global — carregada uma vez quando o servidor sobe
_modelo = None

def get_modelo() -> Pipeline:
    global _modelo
    if _modelo is None:
        _modelo = carregar_modelo()
    return _modelo


def categorizar(descricao: str) -> dict:
    """
    Recebe a descricao de uma transacao e retorna a categoria prevista
    junto com a probabilidade de confianca.

    Retorno:
        {
            "categoria": "Alimentacao",
            "confianca": 0.92,   # de 0 a 1 — quanto maior, mais certo o modelo esta
            "sugestao": True     # indica que e uma sugestao, nao certeza absoluta
        }
    """
    modelo = get_modelo()
    texto  = normalizar(descricao)

    categoria = modelo.predict([texto])[0]
    probabilidades = modelo.predict_proba([texto])[0]
    confianca = float(max(probabilidades))

    return {
        "categoria":  categoria,
        "confianca":  round(confianca, 3),
        # Abaixo de 60% de confianca, sinalizamos que e apenas uma sugestao fraca
        "sugestao":   confianca < 0.60,
    }


# Para treinar o modelo direto pela linha de comando:
# python categorizer.py
if __name__ == "__main__":
    treinar_modelo()
    print("\nTeste rapido:")
    testes = ["ifood", "uber", "netflix", "salario", "farmacia drogasil", "tesouro selic"]
    for t in testes:
        r = categorizar(t)
        print(f"  '{t}' → {r['categoria']} ({r['confianca']*100:.0f}% confianca)")
