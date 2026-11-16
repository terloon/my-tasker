"""Add optional sprint descriptions without changing existing sprint content or versions."""

import sqlalchemy as sa
from alembic import op

revision = "0002"
down_revision = "0001"


def upgrade():
    op.add_column("sprints", sa.Column("description", sa.Text(), nullable=False, server_default=""))


def downgrade():
    raise RuntimeError("Restore a backup to downgrade without discarding sprint descriptions.")
