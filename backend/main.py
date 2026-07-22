from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.core.config import settings
from backend.core.database import db
from backend.api import search, routes
 
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    docs_url="/docs",
    redoc_url="/redoc"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(search.router)
app.include_router(routes.router)

@app.on_event("startup")
async def startup():
    import os
    test_time = os.environ.get("VOYAGER_TEST_TIME")
    if test_time:
        from backend.services.gtfs_service import set_test_time
        set_test_time(test_time)
        print(f"[MAIN] Test time override: {test_time}")

    db.initialize()
    # Preload GTFS data synchronously (takes ~40s once)
    from backend.services.transit_service import _ensure_gtfs
    _ensure_gtfs()

@app.get("/")
async def root():
    return {
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "running",
        "data": {
            "metro_stations": len(db.metro_stations),
            "bus_stops": len(db.bus_stops),
            "kia_routes": len(db.kia_routes),
        }
    }

@app.get("/health")
async def health():
    return {"status": "healthy", "database_initialized": db._initialized}
#update
