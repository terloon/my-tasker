import logging
import time

from sqlalchemy import delete, select, update

from . import models as m
from .content import PlannerService
from .db import transaction

log = logging.getLogger(__name__)


def reconcile(engine, settings):
    files = settings.data_dir / "attachments"
    temp = settings.data_dir / "uploads"
    files.mkdir(parents=True, exist_ok=True)
    temp.mkdir(parents=True, exist_ok=True)
    with transaction(engine) as c:
        job_ids = list(c.scalars(select(m.storage_jobs.c.id)))
    for job_id in job_ids:
        try:
            with transaction(engine, True) as c:
                job = (
                    c.execute(select(m.storage_jobs).where(m.storage_jobs.c.id == job_id))
                    .mappings()
                    .first()
                )
                if not job:
                    continue
                target = files / job["storage_key"]
                if job["operation"] == "delete":
                    target.unlink(missing_ok=True)
                else:
                    source = temp / job["temp_key"]
                    attachment = (
                        c.execute(
                            select(m.attachments).where(m.attachments.c.id == job["attachment_id"])
                        )
                        .mappings()
                        .first()
                    )
                    if not attachment:
                        source.unlink(missing_ok=True)
                        target.unlink(missing_ok=True)
                    elif source.exists():
                        source.replace(target)
                    if attachment and target.exists():
                        actor = dict(
                            c.execute(
                                select(m.users).where(m.users.c.id == attachment["uploader_id"])
                            )
                            .mappings()
                            .one()
                        )
                        c.execute(
                            update(m.attachments)
                            .where(m.attachments.c.id == attachment["id"])
                            .values(storage_state="ready")
                        )
                        PlannerService(c, actor, settings).record(
                            attachment["project_id"],
                            attachment["item_id"],
                            "attachment_ready",
                            attachment["id"],
                            resource="attachment",
                            system=True,
                            cause="upload_finalized",
                        )
                    elif attachment:
                        c.execute(
                            update(m.attachments)
                            .where(m.attachments.c.id == attachment["id"])
                            .values(storage_state="failed")
                        )
                        actor = dict(
                            c.execute(
                                select(m.users).where(m.users.c.id == attachment["uploader_id"])
                            )
                            .mappings()
                            .one()
                        )
                        PlannerService(c, actor, settings).record(
                            attachment["project_id"],
                            attachment["item_id"],
                            "attachment_failed",
                            attachment["id"],
                            resource="attachment",
                            system=True,
                            cause="upload_bytes_missing",
                        )
                c.execute(delete(m.storage_jobs).where(m.storage_jobs.c.id == job_id))
        except OSError:
            log.warning("Attachment cleanup will retry", extra={"job_id": job_id})
    with transaction(engine) as c:
        referenced = set(
            c.scalars(
                select(m.storage_jobs.c.temp_key).where(m.storage_jobs.c.temp_key.is_not(None))
            )
        )
    for path in temp.iterdir():
        if (
            path.is_file()
            and path.name not in referenced
            and path.stat().st_mtime < time.time() - 3600
        ):
            path.unlink(missing_ok=True)
