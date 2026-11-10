import io
from pathlib import Path

from PIL import Image, UnidentifiedImageError
from sqlalchemy import delete, insert

from . import models as m
from .errors import require
from .service import check_version, now, page, public_user, uid
from .work import WorkService

Image.MAX_IMAGE_PIXELS = 16_000_000


class PlannerService(WorkService):
    def list_labels(self, project_id):
        self.access(project_id, "item")
        return self.rows(
            m.labels, m.labels.c.project_id == project_id, order=[m.labels.c.normalized_name]
        )

    def create_label(self, project_id, name):
        self.access(project_id, "item", "create")
        name = name.strip()
        require(name, 422, "empty_label", "Enter a label name.")
        require(
            not self.rows(
                m.labels,
                m.labels.c.project_id == project_id,
                m.labels.c.normalized_name == name.casefold(),
            ),
            409,
            "label_exists",
            "That label already exists.",
        )
        label = dict(
            id=uid(), project_id=project_id, name=name, normalized_name=name.casefold(), version=1
        )
        self.c.execute(insert(m.labels).values(**label))
        self.record(project_id, None, "label_created", label["id"], {"name": name})
        return label

    def update_label(self, project_id, label_id, name, expected, deleting=False):
        self.access(project_id, "item", "delete" if deleting else "update")
        label = self.row(m.labels, label_id)
        require(label["project_id"] == project_id, 404, "not_found", "This label is unavailable.")
        check_version(label, expected)
        for join in self.rows(m.item_labels, m.item_labels.c.label_id == label_id):
            item = self.row(m.items, join["item_id"])
            self.touch(m.items, item)
            self.record(
                project_id,
                item["id"],
                "label_removed" if deleting else "label_renamed",
                label_id,
                {"name": {"from": label["name"], "to": None if deleting else name}},
            )
        if deleting:
            self.c.execute(delete(m.labels).where(m.labels.c.id == label_id))
            return None
        require(
            not self.rows(
                m.labels,
                m.labels.c.project_id == project_id,
                m.labels.c.normalized_name == name.strip().casefold(),
                m.labels.c.id != label_id,
            ),
            409,
            "label_exists",
            "That label already exists.",
        )
        return self.touch(
            m.labels, label, {"name": name.strip(), "normalized_name": name.strip().casefold()}
        )

    def comment_out(self, comment):
        return {
            **comment,
            "author": public_user(self.row(m.users, comment["author_id"])),
            "last_editor": public_user(self.row(m.users, comment["last_editor_id"])),
        }

    def list_comments(self, item_id, offset=0, limit=50):
        item = self.item(item_id)
        self.access(item["project_id"], "comment")
        rows = self.rows(
            m.comments,
            m.comments.c.item_id == item_id,
            order=[m.comments.c.created_at, m.comments.c.id],
        )
        result = page(rows, offset, limit)
        result["items"] = [self.comment_out(r) for r in result["items"]]
        return result

    def create_comment(self, item_id, body):
        item = self.item(item_id)
        self.access(item["project_id"], "comment", "create")
        comment = dict(
            id=uid(),
            project_id=item["project_id"],
            item_id=item_id,
            author_id=self.user["id"],
            last_editor_id=self.user["id"],
            body=body,
            version=1,
            created_at=now(),
            updated_at=now(),
        )
        self.c.execute(insert(m.comments).values(**comment))
        self.record(
            item["project_id"],
            item_id,
            "comment_added",
            comment["id"],
            {"author": self.user["username"]},
            resource="comment",
        )
        return self.comment_out(comment)

    def update_comment(self, item_id, comment_id, body, expected, deleting=False):
        item = self.item(item_id)
        self.access(item["project_id"], "comment", "delete" if deleting else "update")
        comment = self.row(m.comments, comment_id)
        require(comment["item_id"] == item_id, 404, "not_found", "This comment is unavailable.")
        check_version(comment, expected)
        self.record(
            item["project_id"],
            item_id,
            "comment_deleted" if deleting else "comment_edited",
            comment_id,
            {"author_id": comment["author_id"], "body_changed": not deleting},
            resource="comment",
        )
        if deleting:
            self.c.execute(delete(m.comments).where(m.comments.c.id == comment_id))
            return None
        return self.comment_out(
            self.touch(m.comments, comment, {"body": body, "last_editor_id": self.user["id"]})
        )

    def attachment_out(self, attachment):
        return {k: v for k, v in attachment.items() if k not in ("storage_key",)}

    def attachment(self, attachment_id, action="view"):
        attachment = self.row(m.attachments, attachment_id)
        self.access(attachment["project_id"], "attachment", action)
        return attachment

    def list_attachments(self, item_id, offset=0, limit=50):
        item = self.item(item_id)
        self.access(item["project_id"], "attachment")
        rows = self.rows(
            m.attachments,
            m.attachments.c.item_id == item_id,
            m.attachments.c.storage_state == "ready",
            order=[m.attachments.c.created_at, m.attachments.c.id],
        )
        return page([self.attachment_out(r) for r in rows], offset, limit)

    def add_attachment(self, item_id, filename, temp_key, size, checksum, mime_type, preview_kind):
        item = self.item(item_id)
        self.access(item["project_id"], "attachment", "create")
        filename = filename.replace("\\", "/").rsplit("/", 1)[-1]
        filename = "".join(c for c in filename if c.isprintable())[:200] or "attachment"
        attachment = dict(
            id=uid(),
            project_id=item["project_id"],
            item_id=item_id,
            uploader_id=self.user["id"],
            filename=filename,
            storage_key=uid(),
            size=size,
            checksum=checksum,
            mime_type=mime_type,
            preview_kind=preview_kind,
            storage_state="pending",
            created_at=now(),
            version=1,
        )
        self.c.execute(insert(m.attachments).values(**attachment))
        self.c.execute(
            insert(m.storage_jobs).values(
                id=uid(),
                attachment_id=attachment["id"],
                storage_key=attachment["storage_key"],
                temp_key=temp_key,
                operation="finalize",
                attempts=0,
                created_at=now(),
            )
        )
        self.record(
            item["project_id"],
            item_id,
            "attachment_added",
            attachment["id"],
            {"filename": filename, "size": size},
            resource="attachment",
        )
        return self.attachment_out(attachment)

    def schedule_file_delete(self, attachment):
        self.c.execute(
            insert(m.storage_jobs).values(
                id=uid(),
                attachment_id=attachment["id"],
                storage_key=attachment["storage_key"],
                operation="delete",
                attempts=0,
                created_at=now(),
            )
        )
        self.record(
            attachment["project_id"],
            attachment["item_id"],
            "attachment_removed",
            attachment["id"],
            {"filename": attachment["filename"]},
            resource="attachment",
        )

    def delete_attachment(self, attachment_id, expected):
        attachment = self.attachment(attachment_id, "delete")
        check_version(attachment, expected)
        self.schedule_file_delete(attachment)
        self.c.execute(delete(m.attachments).where(m.attachments.c.id == attachment_id))

    def attachment_path(self, attachment):
        require(
            attachment["storage_state"] == "ready",
            409,
            "file_not_ready",
            "This attachment is not ready yet.",
        )
        path = self.settings.data_dir / "attachments" / attachment["storage_key"]
        require(path.is_file(), 404, "file_unavailable", "This file is unavailable.")
        return path

    def preview(self, attachment_id):
        attachment = self.attachment(attachment_id)
        path = self.attachment_path(attachment)
        require(
            attachment["preview_kind"], 415, "preview_unsupported", "Download this file to view it."
        )
        if attachment["preview_kind"] == "text":
            with path.open("rb") as f:
                content = f.read(self.settings.text_preview_bytes + 1)
            truncated = len(content) > self.settings.text_preview_bytes
            return {
                "kind": "text",
                "text": content[: self.settings.text_preview_bytes].decode(
                    "utf-8-sig", errors="replace"
                ),
                "truncated": truncated,
                "size": attachment["size"],
            }
        with Image.open(path) as image:
            image.seek(0)
            image.thumbnail((1920, 1920))
            if image.mode not in ("RGB", "RGBA"):
                image = image.convert("RGBA")
            buffer = io.BytesIO()
            image.save(buffer, format="PNG")
        return buffer.getvalue()

    def home(self):
        projects = [
            self.project_out(p)
            for p in self.rows(m.projects, order=[m.projects.c.name, m.projects.c.id])
            if self.can(p["id"], "project")
        ]
        for project in projects:
            pid = project["id"]
            project["active_sprint"] = None
            if self.can(pid, "sprint"):
                active = self.rows(
                    m.sprints, m.sprints.c.project_id == pid, m.sprints.c.state == "active"
                )
                project["active_sprint"] = self.sprint_out(active[0]) if active else None
            if self.can(pid, "item"):
                items = self.rows(m.items, m.items.c.project_id == pid)
                project["counts"] = {s: sum(i["state"] == s for i in items) for s in m.STATES}
        return {
            "projects": projects,
            "assigned": self.query_items(
                {
                    "assignee_id": [self.user["id"]],
                    "state": ["open", "in_progress", "blocked"],
                    "limit": 50,
                }
            ),
            "ready": self.query_items({"ready_to_resume": True, "limit": 50}),
        }

    def planning(self, project_id, offset=0, limit=50):
        self.access(project_id)
        return {
            "backlog": self.query_items(
                {
                    "project_id": [project_id],
                    "backlog": True,
                    "sort": "rank",
                    "direction": "asc",
                    "offset": offset,
                    "limit": limit,
                }
            )
            if self.can(project_id, "item")
            else None,
            "sprints": self.list_sprints(project_id, offset=offset, limit=limit)
            if self.can(project_id, "sprint")
            else None,
        }

    def board(self, sprint_id, offsets=None, limit=50):
        sprint = self.sprint(sprint_id)
        self.access(sprint["project_id"], "item")
        return {
            "sprint": self.sprint_out(sprint),
            "columns": {
                state: self.query_items(
                    {
                        "project_id": [sprint["project_id"]],
                        "sprint_id": [sprint_id],
                        "state": [state],
                        "sort": "rank",
                        "direction": "asc",
                        "offset": (offsets or {}).get(state, 0),
                        "limit": limit,
                    }
                )
                for state in m.STATES
            },
        }


def inspect_file(path: Path):
    """Decide preview eligibility from bytes; never trust the upload MIME type."""
    try:
        with Image.open(path) as image:
            if image.format in ("PNG", "JPEG", "GIF", "WEBP", "BMP"):
                require(
                    image.width * image.height <= 16_000_000,
                    413,
                    "image_too_large",
                    "The image dimensions are too large.",
                )
                image.verify()
                return "image/" + (
                    "jpeg" if image.format == "JPEG" else image.format.lower()
                ), "image"
    except (UnidentifiedImageError, OSError, ValueError):
        pass
    except Image.DecompressionBombError:
        require(False, 413, "image_too_large", "The image dimensions are too large.")
    with path.open("rb") as file:
        sample = file.read(65536)
    try:
        import codecs

        text = codecs.getincrementaldecoder("utf-8-sig")().decode(sample, final=False)
        if "\x00" not in text and not any(ord(c) < 9 for c in text):
            return "text/plain", "text"
    except UnicodeError:
        pass
    return "application/octet-stream", None
