from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="PLANNER_")
    data_dir: Path = Path("../data")
    frontend_dir: Path = Path("../frontend/dist")
    allowed_hosts: str = "localhost,127.0.0.1,testserver,app"
    allowed_origins: str = (
        "http://localhost:8080,http://127.0.0.1:8080,http://localhost:5173,http://127.0.0.1:5173"
    )
    session_hours: int = 12
    token_hours: int = 24
    max_file_bytes: int = 25 * 1024 * 1024
    text_preview_bytes: int = 1024 * 1024
    secure_cookies: bool = False

    @property
    def database_url(self):
        return f"sqlite:///{self.data_dir.resolve() / 'app.db'}"
