import os
from pathlib import Path
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "DumpSense AI"
    API_V1_STR: str = "/api"
    
    # Database URL defaults to local postgresql if available, or fallback to sqlite
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./dumpsense.db")
    
    JWT_SECRET: str = os.getenv("JWT_SECRET", "dumpsense_jwt_secret_coimbatore_expo_2026")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    
    BASE_DIR: Path = Path(__file__).resolve().parent.parent.parent
    UPLOAD_DIR: Path = BASE_DIR / "uploads"
    _ROOT_DIR: Path = Path(__file__).resolve().parent.parent.parent.parent
    FIRE_MODEL_PATH: Path = (
        Path(os.getenv("FIRE_MODEL_PATH"))
        if os.getenv("FIRE_MODEL_PATH")
        else (
            _ROOT_DIR / "MODEL" / "best.pt"
            if (_ROOT_DIR / "MODEL" / "best.pt").exists()
            else (
                BASE_DIR / "models" / "best.pt"
                if (BASE_DIR / "models" / "best.pt").exists()
                else (_ROOT_DIR / "FireDetection" / "best.pt")
            )
        )
    )
    WASTE_MODEL_PATH: Path = (
        Path(os.getenv("WASTE_MODEL_PATH"))
        if os.getenv("WASTE_MODEL_PATH")
        else (
            _ROOT_DIR / "MODEL" / "best2.pt"
            if (_ROOT_DIR / "MODEL" / "best2.pt").exists()
            else (
                BASE_DIR / "models" / "best2.pt"
                if (BASE_DIR / "models" / "best2.pt").exists()
                else (_ROOT_DIR / "FireDetection" / "best2.pt")
            )
        )
    )
    MODEL_PATH: Path = FIRE_MODEL_PATH

    class Config:
        case_sensitive = True

settings = Settings()
settings.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
