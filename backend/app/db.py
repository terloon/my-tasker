from contextlib import contextmanager
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, event


def make_engine(settings):
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    engine = create_engine(
        settings.database_url,
        connect_args={"check_same_thread": False, "timeout": 5},
        hide_parameters=True,
    )

    @event.listens_for(engine, "connect")
    def configure(conn, _):
        conn.isolation_level = None
        conn.execute("PRAGMA foreign_keys=ON")
        conn.execute("PRAGMA busy_timeout=5000")
        conn.execute("PRAGMA synchronous=FULL")

    with engine.connect() as c:
        c.exec_driver_sql("PRAGMA journal_mode=WAL")
    return engine


@contextmanager
def transaction(engine, write=False):
    with engine.connect() as connection:
        connection.exec_driver_sql("BEGIN IMMEDIATE" if write else "BEGIN")
        try:
            yield connection
            connection.commit()
        except BaseException:
            connection.rollback()
            raise


def migrate(engine):
    base = Path(__file__).resolve().parents[1]
    config = Config(str(base / "alembic.ini"))
    config.set_main_option("script_location", str(base / "migrations"))
    with engine.connect() as connection:
        # Table rebuilds must keep referencing rows when the old table is dropped.
        connection.exec_driver_sql("PRAGMA foreign_keys=OFF")
        try:
            connection.exec_driver_sql("BEGIN IMMEDIATE")
            config.attributes["connection"] = connection
            command.upgrade(config, "head")
            if connection.exec_driver_sql("PRAGMA foreign_key_check").first() is not None:
                raise RuntimeError("The database failed its migration foreign-key check.")
            connection.commit()
        except BaseException:
            connection.rollback()
            raise
        finally:
            connection.exec_driver_sql("PRAGMA foreign_keys=ON")
