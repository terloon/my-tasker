"""Run with the backend environment from the repository root."""

import json
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
from app.config import Settings
from app.main import create_app

with tempfile.TemporaryDirectory() as directory:
    app = create_app(Settings(data_dir=Path(directory)))
    Path("docs/openapi.json").write_text(json.dumps(app.openapi(), indent=2) + "\n")
    app.state.engine.dispose()
