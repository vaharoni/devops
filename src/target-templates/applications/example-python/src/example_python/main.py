import os
from fastapi import FastAPI

app = FastAPI()


@app.get("/")
def read_root():
    return "Hello from python"

@app.get("/healthz")
def healthz():
    return {"status": "ok"}