from fastapi import APIRouter
from pydantic import BaseModel

from moneymind_ml.categorizer import categorizar

router = APIRouter()

class TransactionInput(BaseModel):
    descricao: str


@router.post("/categorize")
def categorize_transaction(data: TransactionInput):

    resultado = categorizar(data.descricao)

    return resultado