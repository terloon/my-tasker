"""Offline recovery: stop the app before running this command against its data volume."""

import argparse
import getpass

from sqlalchemy import delete, select, update

from . import models as m
from .config import Settings
from .db import make_engine, migrate, transaction
from .service import now, passwords


def main():
    parser = argparse.ArgumentParser(
        description="Reset a human administrator locally. Stop the app first."
    )
    parser.add_argument("username")
    args = parser.parse_args()
    password = getpass.getpass("New password (12+ characters): ")
    if len(password) < 12 or password != getpass.getpass("Confirm new password: "):
        parser.error("Passwords must match and contain at least 12 characters.")
    engine = make_engine(Settings())
    migrate(engine)
    with transaction(engine, True) as c:
        user = (
            c.execute(
                select(m.users).where(
                    m.users.c.username == args.username.casefold(), m.users.c.kind == "human"
                )
            )
            .mappings()
            .first()
        )
        if not user:
            parser.error("An existing human account with this username is required.")
        c.execute(
            update(m.users)
            .where(m.users.c.id == user["id"])
            .values(
                password_hash=passwords.hash(password),
                is_admin=True,
                enabled=True,
                updated_at=now(),
                version=user["version"] + 1,
            )
        )
        c.execute(delete(m.sessions).where(m.sessions.c.user_id == user["id"]))
    print("Administrator recovered. Previous sessions and tokens were revoked.")


if __name__ == "__main__":
    main()
