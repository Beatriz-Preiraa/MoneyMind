import os
import sys
import json
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from dotenv import load_dotenv
from openai import OpenAI

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8')

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(dotenv_path=os.path.join(BASE_DIR, '.env'))

app = FastAPI(title="MoneyMind AI Service")

client = OpenAI(
    base_url="https://api.groq.com/openai/v1",
    api_key=os.environ.get("GROQ_API_KEY")
)

class MessageSchema(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[MessageSchema]

tools = [
    {
        "type": "function",
        "function": {
            "name": "cadastrar_transacao",
            "description": (
                "Use SOMENTE quando o usuário confirmar explicitamente um valor já gasto "
                "ou recebido. "
                "Exemplos que DEVEM acionar: 'gastei 50 no mercado', 'paguei 120 de uber', "
                "'recebi 3000 de salário', 'lança 80 de farmácia', 'comprei por 45 reais'. "
                "Exemplos que NUNCA devem acionar esta ferramenta: 'quero investir', "
                "'como investir', 'onde aplicar meu dinheiro', 'quanto rende o Tesouro', "
                "'me dá dicas de investimento', 'quero economizar', 'como poupar'."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "valor": {
                        "type": "number",
                        "description": "O valor numérico da transação em reais. Ex: 45.50"
                    },
                    "categoria": {
                        "type": "string",
                        "description": (
                            "A categoria do lançamento. Use EXATAMENTE um destes valores "
                            "(com acento): Alimentação, Transporte, Lazer, Saúde, "
                            "Educação, Moradia, Salário, Investimento, Outros."
                        )
                    },
                    "tipo": {
                        "type": "string",
                        "enum": ["entrada", "saida"],
                        "description": (
                            "Se é um ganho/receita/salário use 'entrada'. "
                            "Se é despesa/gasto/compra use 'saida'."
                        )
                    },
                    "descricao": {
                        "type": "string",
                        "description": (
                            "Breve descrição da transação. "
                            "Ex: 'Almoço no restaurante', 'Uber para o trabalho'."
                        )
                    }
                },
                "required": ["valor", "categoria", "tipo", "descricao"]
            }
        }
    }
]

PROMPT_SISTEMA = """Você é o MoneyMind, um assistente financeiro pessoal inteligente, amigável e direto.
Você tem DOIS papéis: registrar transações financeiras e orientar sobre como economizar e investir.

═══════════════════════════════════════
PAPEL 1 — REGISTRAR TRANSAÇÕES
═══════════════════════════════════════
Chame 'cadastrar_transacao' SOMENTE quando o usuário informar um valor concreto já movimentado.
Palavras-gatilho: gastei, paguei, comprei, recebi, lança, registra, anota.

Categorias (use EXATAMENTE com acento):
Alimentação, Transporte, Lazer, Saúde, Educação, Moradia, Salário, Investimento, Outros

Exemplos de categorização:
- Uber, 99, gasolina, ônibus → Transporte
- iFood, mercado, restaurante → Alimentação
- Netflix, Spotify, cinema → Lazer
- Farmácia, médico, academia → Saúde
- Aluguel, luz, internet → Moradia
- Faculdade, curso, Udemy → Educação
- Salário, freelance, pix recebido → Salário
- Aplicação no Tesouro, CDB comprado → Investimento

⚠️ NÃO chame cadastrar_transacao quando o usuário:
- Perguntar sobre investimentos sem citar valor gasto ("onde investir?", "como aplicar?")
- Usar palavras como render, guardar, poupar, aplicar SEM valor concreto já movimentado
- Pedir dicas de economia ou finanças
- Fazer perguntas abertas sobre finanças
Nesses casos responda APENAS com texto. Nunca chame a ferramenta.

═══════════════════════════════════════
PAPEL 2 — ORIENTAÇÃO FINANCEIRA E INVESTIMENTOS
═══════════════════════════════════════
Quando o usuário perguntar sobre investimentos ou como fazer o dinheiro render, responda com texto.

Para iniciantes (reserva < 6 meses de gastos):
→ Tesouro Selic: seguro, liquidez diária, ideal para reserva de emergência
→ CDB de liquidez diária: rentabilidade próxima ao CDI
→ LCI/LCA: isentos de IR para pessoa física

Para perfil moderado:
→ Fundos Multimercado, FIIs (Fundos Imobiliários), CDB de prazo maior

Para perfil arrojado:
→ Ações, ETFs (BOVA11, IVVB11) — sempre com ressalvas de risco

Regras:
- Pergunte o objetivo antes de recomendar (reserva? aposentadoria? curto prazo?)
- Se houver dívidas com juros altos, oriente a quitar antes de investir
- Finalize sempre com: "Para decisões maiores, consulte um assessor financeiro certificado (CFP)."

═══════════════════════════════════════
REGRAS GERAIS
═══════════════════════════════════════
1. Mantenha o contexto do histórico da conversa.
2. Dicas de economia devem ser específicas à categoria pedida. Nunca misture categorias.
3. Responda sempre em português brasileiro.
4. Seja direto. Evite respostas longas.
5. Se não identificar o valor de uma transação, pergunte antes de registrar.
6. Fora do contexto financeiro, redirecione: "Sou especialista em finanças pessoais. Posso te ajudar com gastos ou investimentos?"
"""


@app.post("/v1/chat")
async def chat_endpoint(request: ChatRequest):
    try:
        formatted_messages = [
            {"role": m.role, "content": m.content}
            for m in request.messages
        ]

        # Remove system antigo do histórico e injeta o atualizado
        formatted_messages = [m for m in formatted_messages if m["role"] != "system"]
        formatted_messages.insert(0, {"role": "system", "content": PROMPT_SISTEMA})

        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=formatted_messages,
            tools=tools,
            tool_choice="auto"
        )

        message = response.choices[0].message

        resultado = {
            "resposta": message.content,
            "action": None
        }

        if message.tool_calls:
            tool_call = message.tool_calls[0]

            if tool_call.function.name == "cadastrar_transacao":
                argumentos = json.loads(tool_call.function.arguments)

                # Fallback: se a IA não preencheu descrição, usa a última msg do usuário
                if not argumentos.get("descricao"):
                    ultima_msg = next(
                        (m["content"] for m in reversed(formatted_messages) if m["role"] == "user"),
                        ""
                    )
                    argumentos["descricao"] = ultima_msg

                resultado["action"] = {
                    "type": "INSERT_TRANSACTION",
                    "payload": argumentos
                }

                # Gera resposta amigável se a IA não gerou texto
                if not resultado["resposta"]:
                    tipo = argumentos.get("tipo", "saida")
                    emoji = "💸" if tipo == "saida" else "💰"
                    resultado["resposta"] = (
                        f"{emoji} Registrado! "
                        f"R$ {argumentos.get('valor', 0):.2f} em "
                        f"{argumentos.get('categoria', 'Outros')} "
                        f"({'saída' if tipo == 'saida' else 'entrada'}) "
                        f"anotado no seu painel."
                    )

        return resultado

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)