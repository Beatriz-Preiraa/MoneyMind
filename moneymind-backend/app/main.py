from fastapi import FastAPI

from routes.categorize import router as categorize_router
from routes.forecast import router as forecast_router

app = FastAPI(
    title="MoneyMind API"
)

app.include_router(categorize_router)
app.include_router(forecast_router)