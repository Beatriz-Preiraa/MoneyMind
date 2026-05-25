import os
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

load_dotenv()

# Reutiliza a mesma DATABASE_URL do backend Node para nao duplicar configuracao.
# O Supabase aceita conexoes psycopg2 normalmente — so precisa do SSL.
def get_connection():
    """
    Abre e retorna uma conexao com o banco Supabase.
    Sempre use dentro de um bloco with ou feche manualmente apos o uso.
    """
    url = os.getenv("DATABASE_URL")
    if not url:
        raise ValueError("DATABASE_URL nao encontrada no .env")

    conn = psycopg2.connect(
        url,
        sslmode="require",  # obrigatorio no Supabase
        cursor_factory=psycopg2.extras.RealDictCursor  # retorna linhas como dicionarios
    )
    return conn
