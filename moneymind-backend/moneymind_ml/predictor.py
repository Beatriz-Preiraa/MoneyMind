"""
predictor.py — Previsao de gastos para o proximo mes

Como funciona:
  1. Busca o historico de gastos mensais por categoria diretamente do Supabase.
  2. Aplica regressao linear simples para prever o gasto do proximo mes.
  3. Se o historico for curto (menos de 3 meses), usa a media simples como fallback.
  4. Retorna previsao + tendencia (subindo, caindo, estavel).

Limitacao: regressao linear e simples mas funciona bem para dados financeiros
mensais regulares. Com 6+ meses de historico a precisao melhora bastante.
"""

import numpy as np
from sklearn.linear_model import LinearRegression
from moneymind_ml.database import get_connection


def buscar_historico_usuario(user_id: str) -> dict:
    """
    Busca os gastos mensais dos ultimos 12 meses agrupados por categoria.

    Retorna dicionario no formato:
        {
            "Alimentacao": [780, 820, 750, ...],  # gasto de cada mes, do mais antigo ao mais recente
            "Transporte":  [420, 390, 440, ...],
            ...
        }
    """
    query = """
        SELECT
            COALESCE(c.name, 'Sem categoria') AS categoria,
            EXTRACT(YEAR  FROM t.date)::int    AS ano,
            EXTRACT(MONTH FROM t.date)::int    AS mes,
            SUM(t.amount)                      AS total
        FROM transactions t
        LEFT JOIN categories c ON c.id = t.category_id
        WHERE t.user_id = %s
          AND t.type = 'expense'
          AND t.date >= NOW() - INTERVAL '12 months'
        GROUP BY c.name, ano, mes
        ORDER BY ano ASC, mes ASC
    """
    historico = {}

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(query, (user_id,))
            rows = cur.fetchall()

    for row in rows:
        cat = row["categoria"]
        if cat not in historico:
            historico[cat] = []
        historico[cat].append(float(row["total"]))

    return historico


def prever_categoria(valores: list[float]) -> dict:
    """
    Aplica regressao linear nos valores mensais e retorna a previsao do proximo mes.

    Parametros:
        valores — lista com os totais mensais em ordem cronologica

    Retorna:
        {
            "previsao":   850.0,   # valor previsto para o proximo mes
            "tendencia":  "subindo",  # "subindo", "caindo" ou "estavel"
            "variacao":   8.97,    # variacao percentual esperada em relacao ao ultimo mes
            "confianca":  "media"  # "baixa" (< 3 meses), "media" (3-5), "alta" (6+)
        }
    """
    n = len(valores)

    # Com menos de 2 pontos nao tem como calcular tendencia
    if n < 2:
        media = valores[0] if n == 1 else 0.0
        return {
            "previsao":  round(media, 2),
            "tendencia": "estavel",
            "variacao":  0.0,
            "confianca": "baixa",
        }

    # Eixo X: 0, 1, 2, ... (indice de cada mes)
    X = np.array(range(n)).reshape(-1, 1)
    y = np.array(valores)

    modelo = LinearRegression()
    modelo.fit(X, y)

    # Previsao para o proximo periodo (n)
    proximo = float(modelo.predict([[n]])[0])
    proximo = max(proximo, 0.0)  # gasto nao pode ser negativo

    ultimo  = valores[-1]
    variacao = ((proximo - ultimo) / ultimo * 100) if ultimo > 0 else 0.0

    # Tendencia com margem de 5% para nao marcar como "subindo" em variacoes minimas
    if variacao > 5:
        tendencia = "subindo"
    elif variacao < -5:
        tendencia = "caindo"
    else:
        tendencia = "estavel"

    confianca = "alta" if n >= 6 else "media" if n >= 3 else "baixa"

    return {
        "previsao":  round(proximo, 2),
        "tendencia": tendencia,
        "variacao":  round(variacao, 1),
        "confianca": confianca,
    }


def gerar_previsoes(user_id: str) -> dict:
    """
    Funcao principal — busca o historico e gera previsoes para todas as categorias.

    Retorna:
        {
            "previsoes": {
                "Alimentacao": { "previsao": 850.0, "tendencia": "subindo", ... },
                "Transporte":  { "previsao": 400.0, "tendencia": "estavel", ... },
                ...
            },
            "total_previsto": 3200.0,
            "aviso": "Previsao baseada em X meses de historico"
        }
    """
    historico = buscar_historico_usuario(user_id)

    if not historico:
        return {
            "previsoes":      {},
            "total_previsto": 0.0,
            "aviso":          "Historico insuficiente. Registre transacoes para receber previsoes.",
        }

    previsoes     = {}
    total_previsto = 0.0
    max_meses     = max(len(v) for v in historico.values())

    for categoria, valores in historico.items():
        resultado = prever_categoria(valores)
        previsoes[categoria] = resultado
        total_previsto += resultado["previsao"]

    aviso = f"Previsao baseada em {max_meses} mes(es) de historico."
    if max_meses < 3:
        aviso += " Precisao aumenta com mais historico."

    return {
        "previsoes":      previsoes,
        "total_previsto": round(total_previsto, 2),
        "aviso":          aviso,
    }
