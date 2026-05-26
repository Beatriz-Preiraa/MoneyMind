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

# Força o Python a procurar o arquivo .env uma pasta acima (raiz do projeto)
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
                    "valor": {
                        "type": "number",
                        "description": "O valor numérico da transação em reais. Ex: 45.50"
                    },
                    "categoria": {
                        "type": "string",
                        # CORREÇÃO 3: a IA deve retornar a categoria COM acento para bater com o banco
                        "description": "A categoria do lançamento. Use exatamente um destes valores: Alimentação, Transporte, Lazer, Saúde, Educação, Moradia, Salário, Outros."
                    },
                    "tipo": {
                        "type": "string",
                        "enum": ["entrada", "saida"],
                        "description": "Se é um ganho/receita/salário (entrada) ou despesa/gasto/compra (saida)."
                    },
                    # CORREÇÃO 1: campo descricao adicionado para o service gravar corretamente
                    "descricao": {
                        "type": "string",
                        "description": "Breve descrição da transação com as próprias palavras do usuário. Ex: 'Almoço no restaurante', 'Uber para o trabalho'."
                    }
                },
                "required": ["valor", "categoria", "tipo", "descricao"]
            }
        }
    }
]

@app.post("/v1/chat")
async def chat_endpoint(request: ChatRequest):
    try:
        formatted_messages = [{"role": m.role, "content": m.content} for m in request.messages]

        # Prompt principal: instruções de comportamento e contexto do assistente
        prompt_sistema = (
            "Você é o MoneyMind, um assistente financeiro pessoal inteligente, focado e direto. "
            "Seu objetivo é ajudar o usuário a gerenciar o orçamento e economizar dinheiro com base nas categorias dele.\n\n"
            "REGRAS CRUCIAIS DE COMPORTAMENTO:\n"
            "1. Sempre analise o histórico da conversa antes de responder. Se o usuário estiver respondendo a uma pergunta anterior sua (como fornecer apenas o nome de uma categoria), mantenha o assunto.\n"
            "2. Se o usuário pedir dicas ou disser que quer economizar em uma categoria específica (como 'transporte'), dê dicas EXCLUSIVAS sobre ela (ex: combustível, caronas, transporte público, manutenção de veículo). NUNCA dê dicas genéricas de alimentação, almoço ou assinaturas se o foco for outra categoria.\n"
            "3. Se o usuário relatar um gasto ou ganho (ex: 'gastei 20 com uber', 'lança 50 de mercado', 'recebi meu salário'), você DEVE chamar imediatamente a ferramenta 'cadastrar_transacao'. Não tente apenas conversar em formato de texto.\n"
            # CORREÇÃO 3: reforço no prompt para a IA usar exatamente as categorias com acento
            "4. Ao chamar 'cadastrar_transacao', o campo 'categoria' deve ser EXATAMENTE um destes valores (com acento): Alimentação, Transporte, Lazer, Saúde, Educação, Moradia, Salário, Outros."
        )

        # Remove qualquer prompt de sistema antigo trazido pelo histórico e injeta o atualizado
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

                # CORREÇÃO 1: garante que o campo descricao sempre esteja no payload
                # Se a IA não preencheu, usa o texto da última mensagem do usuário como fallback
                if "descricao" not in argumentos or not argumentos["descricao"]:
                    ultima_msg_usuario = next(
                        (m["content"] for m in reversed(formatted_messages) if m["role"] == "user"),
                        ""
                    )
                    argumentos["descricao"] = ultima_msg_usuario

                resultado["action"] = {
                    "type": "INSERT_TRANSACTION",
                    "payload": argumentos
                }

                # Se a IA chamou a ferramenta mas não gerou texto, monta a resposta amigável
                if not resultado["resposta"]:
                    categoria_formatada = argumentos.get('categoria', 'Outros')
                    resultado["resposta"] = (
                        f"Perfeito! Identifiquei um lançamento de R$ {argumentos.get('valor'):.2f} "
                        f"em '{categoria_formatada}'. Estou registrando no seu painel agora mesmo."
                    )

        return resultado

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
