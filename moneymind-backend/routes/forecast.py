from fastapi import APIRouter

from moneymind_ml.predictor import gerar_previsoes

router = APIRouter()

@router.get("/forecast/{user_id}")

def forecast(user_id: str):

    return gerar_previsoes(user_id)