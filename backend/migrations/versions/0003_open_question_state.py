"""Add an item state while preserving the table's existing constraints and indexes."""

from alembic import op

revision = "0003"
down_revision = "0002"

OLD_STATES = "CHECK (state IN ('open','in_progress','blocked','done','cancelled'))"
NEW_STATES = "CHECK (state IN ('open','open_question','in_progress','blocked','done','cancelled'))"


def upgrade():
    connection = op.get_bind()
    if connection.exec_driver_sql("PRAGMA foreign_keys").scalar_one():
        raise RuntimeError("The items table rebuild requires the migration connection.")
    create_items = connection.exec_driver_sql(
        "SELECT sql FROM sqlite_schema WHERE type='table' AND name='items'"
    ).scalar_one()
    if not create_items.startswith("CREATE TABLE items (") or OLD_STATES not in create_items:
        raise RuntimeError("The items table does not match the schema expected for this upgrade.")
    indexes = (
        connection.exec_driver_sql(
            "SELECT sql FROM sqlite_schema WHERE type='index' AND tbl_name='items' AND sql IS NOT NULL"
        )
        .scalars()
        .all()
    )
    op.execute(
        create_items.replace(
            "CREATE TABLE items (", "CREATE TABLE items_open_question (", 1
        ).replace(OLD_STATES, NEW_STATES, 1)
    )
    op.execute("INSERT INTO items_open_question SELECT * FROM items")
    op.drop_table("items")
    op.rename_table("items_open_question", "items")
    for index in indexes:
        op.execute(index)


def downgrade():
    raise RuntimeError("Restore a backup to downgrade without discarding open question states.")
