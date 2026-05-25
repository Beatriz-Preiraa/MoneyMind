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

# Força o Python a procurar o arquivo .env uma pasta acima (raiz de moneymind-backend)
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
            "description": "Use OBRIGATORIAMENTE quando o usuário indicar que gastou, comprou, pagou, recebeu ou quiser registrar uma movimentação financeira.",
            "parameters": {
                "type": "object",
                "properties": {
                    "valor": {"type": "number", "description": "O valor numérico da transação em reais. Ex: 45.50"},
                    "categoria": {"type": "string", "description": "A categoria do lançamento (ex: transporte, alimentacao, lazer, salario). Sempre em letras minúsculas e sem acentos."},
                    "tipo": {"type": "string", "enum": ["entrada", "saida"], "description": "Se é um ganho/receita/salário (entrada) ou despesa/gasto/compra (saida)."}
                },
                "required": ["valor", "categoria", "tipo"]
            }
        }
    }
]

@app.post("/v1/chat")
async def chat_endpoint(request: ChatRequest):
    try:
        formatted_messages = [{"role": m.role, "content": m.content} for m in request.messages]
        
        # PROMPT REESTRUTURADO: Instruções agressivas de comportamento e contexto
        prompt_sistema = (
            "Você é o MoneyMind, um assistente financeiro pessoal inteligente, focado e direto. "
            "Seu objetivo é ajudar o usuário a gerenciar o orçamento e economizar dinheio com base nas categorias dele.\n\n"
            "REGRAS CRUTIAIS DE COMPORTAMENTO:\n"
            "1. Sempre analise o histórico da conversa antes de responder. Se o usuário estiver respondendo a uma pergunta anterior sua (como fornecer apenas o nome de uma categoria), mantenha o assunto.\n"
            "2. Se o usuário pedir dicas ou disser que quer economizar em uma categoria específica (como 'transporte'), dê dicas EXCLUSIVAS sobre ela (ex: combustivel, caronas, transporte público, manutenção de veículo). NUNCA dê dicas genéricas de alimentação, almoço ou assinaturas se o foco for outra categoria.\n"
            "3. Se o usuário relatar um gasto ou ganho (ex: 'gastei 20 com uber', 'lança 50 de mercado', 'recebi meu salario'), você DEVE chamar imediatamente a ferramenta 'cadastrar_transacao'. Não tente apenas conversar em formato de texto."
        )
        
        # Remove qualquer prompt de sistema antigo trazido pelo histórico e injeta o novo atualizado
        formatted_messages = [m for m in formatted_messages if m["role"] != "system"]
        formatted_messages.insert(0, {"role": "system", "content": prompt_sistema})

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
                resultado["action"] = {
                    "type": "INSERT_TRANSACTION",
                    "payload": argumentos
                }
                # Se a IA optou por executar a ferramenta e não gerou texto, criamos o retorno amigável
                if not resultado["resposta"]:
                    categoria_formatada = argumentos.get('categoria').capitalize()
                    resultado["resposta"] = f"Perfeito! Identifiquei um lançamento de R$ {argumentos.get('valor'):.2f} em '{categoria_formatada}'. Estou registrando no seu painel agora mesmo."

        return resultado

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)