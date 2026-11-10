# Operations

## Storage and startup

Compose stores `/data/app.db`, SQLite sidecars, uploads, finalized attachments and durable cleanup jobs in its `planner-data` volume. Replacing the image/container keeps that volume. Do not use `docker compose down --volumes` on an installation whose data you want to keep.

Startup applies Alembic migrations before serving requests. Migration failure stops startup. The container runs as UID/GID 10001 with one Uvicorn worker. Liveness is `/health/live`; readiness is `/health/ready`. Setup-required is a healthy running state. No Node runtime is required.

Use a local filesystem volume, not an NFS/shared SQLite file. SQLite uses WAL, foreign keys, a bounded busy timeout and short serialized write transactions. Every committed item mutation and its history share a transaction.

Attachment ingestion stages bytes and records a durable finalization job. A startup/periodic reconciliation pass completes pending finalizations/deletions and removes aged orphan temp files. Interrupted cleanup does not expose a file that was deleted in metadata.

## Backup

Stop the app cleanly and back up the **entire** data directory, including attachments and sidecars. Copying a live `.db` file alone is insufficient.

From the repository root, choose a new archive path that does not already exist:

```sh
mkdir -p backups
docker compose stop app
umask 077
docker cp "$(docker compose ps -aq app):/data/." - > backups/planner-backup.tar
docker compose start app
```

Check the archive with `tar -tf backups/planner-backup.tar`. Keep backups private because they contain project data and credential/session hashes. Restart the app even if a backup attempt fails. Take a backup before upgrading/migrating.

## Restore

Restore while stopped, preferably into a **new empty named volume**, retaining the original volume until verification succeeds. Use the same application image/schema version first, extract the whole archive into `/data`, and ensure files are owned by UID/GID 10001 before running as the app user. Do not overlay an old backup onto a nonempty working volume or leave unrelated WAL files there.

After restoring, verify login, project/item counts, historical activity and attachment downloads/previews. Then select the restored volume in Compose and start the app. The release verification procedure rehearses this on a disposable test volume; it does not restore over user data.

## Administrator recovery

Stop the app, then run against the same mounted data volume:

```sh
docker compose stop app
docker compose run --rm --no-deps --entrypoint python app -m app.recover YOUR_USERNAME
docker compose start app
```

The interactive command accepts an existing human account, asks twice for a new password, enables administrator access, and revokes its prior sessions/tokens. There is no public recovery endpoint and no password in command arguments or logs. Access to the local data volume is required.

## Configuration

All settings use the `PLANNER_` prefix: `DATA_DIR`, `FRONTEND_DIR`, `ALLOWED_HOSTS`, `ALLOWED_ORIGINS`, `SESSION_HOURS`, `TOKEN_HOURS`, `MAX_FILE_BYTES`, `TEXT_PREVIEW_BYTES`, `SECURE_COOKIES`. Allowed hosts/origins are comma-separated exact local entries; include the browser's actual port. Use Secure cookies if HTTPS is configured later. Current deployment is local HTTP only.

Logs contain request IDs, operational errors and startup status. They do not log passwords, bearer/session headers, comment bodies or file contents. Activity is the durable user-facing mutation record, not the HTTP access log.
