from fastapi import FastAPI

app = FastAPI(
    title="Medius Backend",
    description="AI-assisted dispute resolution — humans make every decision.",
    version="0.1.0",
)


@app.get("/health")
def health():
    return {"status": "ok", "service": "medius-backend"}
