import sys
import json
import re
# Importa a função de categorizar que você já escreveu!
from categorizer import categorizar

def extrair_dados_frase(frase):
    # 1. Regex para extrair o valor (identifica 50, 50.00, 50,00)
    valor_match = re.search(r'(?:R\$?\s*)?(\d+(?:[.,]\d{1,2})?)', frase)
    valor = 0.0
    if valor_match:
        # Limpa o valor para o padrão flutuante do banco (ex: 50,00 -> 50.00)
        valor_str = valor_match.group(1).replace(',', '.')
        valor = float(valor_str)

    # 2. Tenta extrair a descrição limpando palavras comuns de comando
    # Remove o valor da frase para não atrapalhar o classificador
    frase_limpa = frase.replace(valor_match.group(0) if valor_match else '', '')
    
    remover_palavras = [r'\bgastei\b', r'\bcom\b', r'\bno\b', r'\bna\b', r'\bcomprei\b', r'\bpaguei\b', r'\blancar\b', r'\breais\b']
    for palavra in remover_palavras:
        frase_limpa = re.sub(palavra, '', frase_limpa, flags=re.IGNORECASE)
    
    descricao = re.sub(r'\s+', ' ', frase_limpa).strip()
    if not descricao:
        descricao = "Gasto via WhatsApp"

    # 3. Chamar o seu modelo Naive Bayes para adivinhar a categoria
    resultado_categoria = categorizar(descricao)

    return {
        "valor": valor,
        "descricao": descricao.capitalize(),
        "categoria": resultado_categoria["categoria"],
        "confianca": resultado_categoria["confianca"]
    }

if __name__ == "__main__":
    # Recebe a frase enviada pelo Node.js como argumento de terminal
    if len(sys.argv) > 1:
        frase_input = sys.argv[1]
        resultado = extrair_dados_frase(frase_input)
        # Cospe o JSON na tela para o Node.js capturar
        print(json.dumps(resultado, ensure_ascii=False))
    else:
        print(json.dumps({"erro": "Nenhuma frase fornecida"}))