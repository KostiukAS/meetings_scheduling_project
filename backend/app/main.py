from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import auth, resources, meetings

app = FastAPI(
    title="Meetings Scheduling API",
    description="API для дипломного проєкту планування зустрічей",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(resources.router)
app.include_router(meetings.router)

@app.get("/")
def root():
    return {"message": "API системи планування зустрічей працює!"}
