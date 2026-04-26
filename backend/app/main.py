from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="Meetings Scheduling API",
    description="API для дипломного проєкту планування зустрічей",
    version="1.0.0"
)

# Налаштування CORS (щоб фронтенд міг робити запити до бекенду)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # У продакшені тут буде URL вашого фронтенду
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {"message": "API системи планування зустрічей працює!"}
