from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes import train, predict, explain, metrics, models

app = FastAPI(
    title="XAI-NIDS API",
    description="Explainable AI Network Intrusion Detection System",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(train.router, tags=["Training"])
app.include_router(predict.router, tags=["Prediction"])
app.include_router(explain.router, tags=["Explainability"])
app.include_router(metrics.router, tags=["Metrics"])
app.include_router(models.router, tags=["Models"])


@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "xai-nids-backend"}


@app.get("/")
async def root():
    return {"message": "XAI-NIDS Backend API", "docs": "/docs"}
