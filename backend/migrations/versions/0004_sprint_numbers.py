"""Number existing sprints per project without changing their names or history."""

import re
from itertools import groupby
from operator import itemgetter

import sqlalchemy as sa
from alembic import op

revision = "0004"
down_revision = "0003"


def upgrade():
    op.add_column("sprints", sa.Column("number", sa.Integer(), nullable=False, server_default="0"))
    connection = op.get_bind()
    rows = connection.execute(
        sa.text(
            "SELECT id, project_id, name, started_at FROM sprints "
            "ORDER BY project_id, started_at IS NULL, started_at, position, id"
        )
    ).mappings()
    prefix = re.compile(r"^(?:Sprint\s+|S)([0-9]{1,9})(?:\s*[-–—:]|\s+|$)", re.IGNORECASE)
    assignments = []
    for _, sprints in groupby(rows, key=itemgetter("project_id")):
        ordered = list(sprints)
        offsets = set()
        for index, sprint in enumerate(ordered, 1):
            match = prefix.match(sprint["name"].strip())
            if sprint["started_at"] is not None and match:
                offsets.add(int(match[1]) - index)
        # Preserve an existing historical sequence that began above 1 when the
        # names agree on its starting number.
        offset = max(0, offsets.pop()) if len(offsets) == 1 else 0
        assignments.extend(
            {"sprint_id": sprint["id"], "number": number}
            for number, sprint in enumerate(ordered, offset + 1)
        )
    if assignments:
        connection.execute(
            sa.text("UPDATE sprints SET number = :number WHERE id = :sprint_id"), assignments
        )
    op.create_index("sprint_project_id_number", "sprints", ["project_id", "number"], unique=True)


def downgrade():
    op.drop_index("sprint_project_id_number", table_name="sprints")
    op.drop_column("sprints", "number")
