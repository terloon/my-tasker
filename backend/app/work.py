from collections import defaultdict
from datetime import UTC, datetime

from sqlalchemy import delete, func, insert, or_, select, update

from . import models as m
from .errors import require
from .service import Service, check_version, fingerprint, now, page, public_user, uid


class WorkService(Service):
    def blockers(self, item_id):
        edges = self.rows(
            m.links,
            m.links.c.source_id == item_id,
            m.links.c.kind == "blocked_by",
            order=[m.links.c.id],
        )
        return [(edge, self.row(m.items, edge["target_id"])) for edge in edges]

    def blocker_summary(self, item):
        blockers = self.blockers(item["id"])
        done = sum(b["state"] == "done" for _, b in blockers)
        return {
            "total": len(blockers),
            "done": done,
            "remaining": len(blockers) - done,
            "ready_to_resume": item["state"] == "blocked"
            and bool(blockers)
            and done == len(blockers),
            "blocker_revision": fingerprint(
                [(e["id"], e["version"], b["id"], b["version"], b["state"]) for e, b in blockers]
            ),
        }

    def item_out(self, item):
        project = self.row(m.projects, item["project_id"])
        sprint = self.row(m.sprints, item["sprint_id"]) if item["sprint_id"] else None
        assignee = (
            public_user(self.row(m.users, item["assignee_id"])) if item["assignee_id"] else None
        )
        label_ids = [
            r["label_id"] for r in self.rows(m.item_labels, m.item_labels.c.item_id == item["id"])
        ]
        return {
            **item,
            "key": f"{project['key']}-{item['number']}",
            "project_name": project["name"],
            "sprint_name": sprint["name"] if sprint else "Backlog",
            "sprint_state": sprint["state"] if sprint else None,
            "assignee": assignee,
            "labels": [self.row(m.labels, id) for id in label_ids],
            "label_ids": label_ids,
            "permissions": self.grants(item["project_id"]),
            "blocker_summary": self.blocker_summary(item),
        }

    def validate_destination(self, project_id, sprint_id):
        if sprint_id:
            sprint = self.sprint(sprint_id)
            require(
                sprint["project_id"] == project_id,
                422,
                "cross_project",
                "Choose a sprint in this project.",
            )
            require(
                sprint["state"] != "closed",
                409,
                "sprint_closed",
                "Closed sprints cannot receive items.",
            )

    def validate_assignee(self, project_id, user_id):
        if user_id:
            user = self.row(m.users, user_id)
            require(
                user["enabled"] and self.can(project_id, "item", user=user),
                422,
                "invalid_assignee",
                "Choose an enabled user who can view this project's items.",
            )

    def set_item_labels(self, item, label_ids):
        label_ids = list(dict.fromkeys(label_ids))
        for id in label_ids:
            label = self.row(m.labels, id)
            require(
                label["project_id"] == item["project_id"],
                422,
                "cross_project",
                "Choose labels from this project.",
            )
        old_ids = [
            r["label_id"] for r in self.rows(m.item_labels, m.item_labels.c.item_id == item["id"])
        ]
        if set(old_ids) != set(label_ids):
            self.c.execute(delete(m.item_labels).where(m.item_labels.c.item_id == item["id"]))
            for id in label_ids:
                self.c.execute(
                    insert(m.item_labels).values(
                        project_id=item["project_id"], item_id=item["id"], label_id=id
                    )
                )
            self.record(
                item["project_id"],
                item["id"],
                "labels_changed",
                item["id"],
                {"label_ids": {"from": old_ids, "to": label_ids}},
            )

    def create_item(self, project_id, data):
        self.access(project_id, "item", "create")
        project = self.row(m.projects, project_id)
        data = dict(data)
        label_ids, blocker_ids = data.pop("label_ids", []), data.pop("blocked_by_item_ids", [])
        if blocker_ids:
            self.access(project_id, "item", "update")
        self.validate_destination(project_id, data.get("sprint_id"))
        self.validate_assignee(project_id, data.get("assignee_id"))
        number = project["next_item_number"]
        self.c.execute(
            update(m.projects)
            .where(m.projects.c.id == project_id)
            .values(next_item_number=number + 1)
        )
        item = dict(
            id=uid(),
            project_id=project_id,
            number=number,
            title=data["title"],
            description=data.get("description", ""),
            type=data["type"],
            state=data.get("state", "open"),
            priority=data.get("priority", "none"),
            sprint_id=data.get("sprint_id"),
            assignee_id=data.get("assignee_id"),
            reporter_id=self.user["id"],
            rank=self.next_rank(project_id, data.get("sprint_id")),
            version=1,
            created_at=now(),
            updated_at=now(),
        )
        self.c.execute(insert(m.items).values(**item))
        self.record(
            project_id,
            item["id"],
            "item_created",
            item["id"],
            {
                k: item[k]
                for k in ("title", "type", "state", "priority", "sprint_id", "assignee_id")
            },
        )
        self.set_item_labels(item, label_ids)
        for blocker_id in dict.fromkeys(blocker_ids):
            self.add_link(item["id"], "blocked_by", blocker_id, None, None, internal=True)
        item = self.row(m.items, item["id"])
        require(
            item["state"] != "blocked" or self.blockers(item["id"]),
            409,
            "blocker_required",
            "Choose at least one Blocked by item before entering Blocked.",
        )
        return self.item_out(item)

    def next_rank(self, project_id, sprint_id):
        return (
            self.c.scalar(
                select(func.max(m.items.c.rank)).where(
                    m.items.c.project_id == project_id, m.items.c.sprint_id == sprint_id
                )
            )
            or 0
        ) + 1024

    def update_item(self, item_id, data, expected):
        item = self.item(item_id, "update")
        check_version(item, expected)
        data = dict(data)
        self.check_question_transition(item, data.get("state", item["state"]))
        require(
            data.get("state") != "cancelled",
            409,
            "cancellation_command_required",
            "Use the cancellation preview and cancel command.",
            {"preview": f"/api/v1/items/{item_id}/cancellation-preview"},
        )
        labels, blocker_ids = data.pop("label_ids", None), data.pop("blocked_by_item_ids", [])
        destination = data.get("sprint_id", item["sprint_id"])
        if destination != item["sprint_id"]:
            self.validate_destination(item["project_id"], destination)
            data["rank"] = self.next_rank(item["project_id"], destination)
        if item["sprint_id"] and self.row(m.sprints, item["sprint_id"])["state"] == "closed":
            require(
                data.get("state", item["state"]) == item["state"]
                or destination != item["sprint_id"],
                409,
                "closed_sprint_state",
                "Move this item out of its closed sprint before changing its state.",
            )
        if "assignee_id" in data:
            self.validate_assignee(item["project_id"], data["assignee_id"])
        changes = {k: {"from": item[k], "to": v} for k, v in data.items() if item[k] != v}
        if changes:
            item = self.touch(m.items, item, data)
            self.record(item["project_id"], item_id, "item_updated", item_id, changes)
        if labels is not None:
            before = self.rows(m.item_labels, m.item_labels.c.item_id == item_id)
            self.set_item_labels(item, labels)
            if set(r["label_id"] for r in before) != set(labels):
                item = self.touch(m.items, self.row(m.items, item_id))
        for blocker_id in dict.fromkeys(blocker_ids):
            self.add_link(item_id, "blocked_by", blocker_id, None, None, internal=True)
        item = self.row(m.items, item_id)
        require(
            item["state"] != "blocked" or self.blockers(item_id),
            409,
            "blocker_required",
            "Choose at least one Blocked by item before entering Blocked.",
        )
        return self.item_out(item)

    def query_items(self, query=None, *, hierarchy=False):
        q = query or {}

        def values(key):
            value = q.get(key, [])
            return value if isinstance(value, list) else [value]

        visible = [r for r in self.rows(m.items) if self.can(r["project_id"], "item")]
        rows = visible
        for key in ("project_id", "type", "state", "priority"):
            vals = values(key)
            if vals:
                rows = [r for r in rows if r[key] in vals]
        sprint_ids, assignees = values("sprint_id"), values("assignee_id")
        if sprint_ids or q.get("backlog"):
            rows = [
                r
                for r in rows
                if r["sprint_id"] in sprint_ids or (q.get("backlog") and r["sprint_id"] is None)
            ]
        if assignees or q.get("unassigned"):
            rows = [
                r
                for r in rows
                if r["assignee_id"] in assignees
                or (q.get("unassigned") and r["assignee_id"] is None)
            ]
        if q.get("q"):
            term = q["q"].casefold()
            rows = [
                r
                for r in rows
                if term
                in (
                    r["title"]
                    + " "
                    + r["description"]
                    + " "
                    + self.row(m.projects, r["project_id"])["key"]
                    + "-"
                    + str(r["number"])
                ).casefold()
            ]
        if q.get("updated_since"):
            try:
                since = datetime.fromisoformat(q["updated_since"].replace("Z", "+00:00"))
                require(
                    since.tzinfo is not None,
                    422,
                    "invalid_timestamp",
                    "Include a timezone in updated_since.",
                )
                since = since.astimezone(UTC)
            except ValueError:
                require(
                    False, 422, "invalid_timestamp", "Use an ISO 8601 timestamp for updated_since."
                )
            rows = [r for r in rows if datetime.fromisoformat(r["updated_at"]) >= since]
        if values("label_id"):
            wanted = set(values("label_id"))
            rows = [
                r
                for r in rows
                if wanted
                <= {
                    x["label_id"]
                    for x in self.rows(m.item_labels, m.item_labels.c.item_id == r["id"])
                }
            ]
        if q.get("blocked_by_item_id"):
            ids = {
                e["source_id"]
                for e in self.rows(
                    m.links,
                    m.links.c.kind == "blocked_by",
                    m.links.c.target_id == q["blocked_by_item_id"],
                )
            }
            rows = [r for r in rows if r["id"] in ids]
        if q.get("blocks_item_id"):
            ids = {
                e["target_id"]
                for e in self.rows(
                    m.links,
                    m.links.c.kind == "blocked_by",
                    m.links.c.source_id == q["blocks_item_id"],
                )
            }
            rows = [r for r in rows if r["id"] in ids]
        if q.get("ready_to_resume"):
            rows = [r for r in rows if self.blocker_summary(r)["ready_to_resume"]]
        sort = q.get("sort", "updated_at")
        require(
            sort in ("key", "title", "priority", "state", "created_at", "updated_at", "rank"),
            422,
            "invalid_sort",
            "Choose a supported sort field.",
        )
        if sort == "rank":
            require(
                len(values("project_id")) == 1
                and (
                    (len(sprint_ids) == 1 and not q.get("backlog"))
                    or (not sprint_ids and q.get("backlog"))
                ),
                422,
                "rank_scope",
                "Rank sorting requires one project and one sprint or Backlog.",
            )

        def order(r):
            val = (
                (self.row(m.projects, r["project_id"])["key"], r["number"])
                if sort == "key"
                else m.PRIORITIES.index(r[sort])
                if sort == "priority"
                else m.STATES.index(r[sort])
                if sort == "state"
                else r[sort]
            )
            return val, r["id"]

        reverse = q.get("direction", "desc") == "desc"
        offset, limit = q.get("offset", 0), q.get("limit", 50)
        if hierarchy:
            return self.item_hierarchy(visible, rows, order, reverse, offset, limit)
        result = page(sorted(rows, key=order, reverse=reverse), offset, limit)
        result["items"] = [self.item_out(i) for i in result["items"]]
        return result

    def item_hierarchy(self, visible, matches, order, reverse, offset, limit):
        if not matches:
            return page([], offset, limit)
        visible_by_id = {item["id"]: item for item in visible}
        project_ids = {item["project_id"] for item in matches}
        parents = {
            child_id: parent_id
            for child_id, parent_id in self.c.execute(
                select(m.links.c.target_id, m.links.c.source_id).where(
                    m.links.c.kind == "parent_child",
                    m.links.c.project_id.in_(project_ids),
                )
            )
        }
        match_ids = {item["id"] for item in matches}
        included = set()
        for item_id in match_ids:
            while item_id in visible_by_id and item_id not in included:
                included.add(item_id)
                item_id = parents.get(item_id)

        children = defaultdict(list)
        for item in sorted(
            (visible_by_id[item_id] for item_id in included), key=order, reverse=reverse
        ):
            parent_id = parents.get(item["id"])
            children[parent_id if parent_id in included else None].append(item)

        result = page(children[None], offset, limit)
        pending = [(item, None, 0) for item in reversed(result["items"])]
        items = []
        while pending:
            item, parent_id, depth = pending.pop()
            item_id = item["id"]
            branch = children.get(item_id, [])
            items.append(
                {
                    **self.item_out(item),
                    "parent_id": parent_id,
                    "depth": depth,
                    "has_children": bool(branch),
                    "matches_filters": item_id in match_ids,
                }
            )
            pending.extend((child, item_id, depth + 1) for child in reversed(branch))
        result["items"] = items
        return result

    def add_link(self, item_id, relationship, target_id, expected, target_expected, internal=False):
        source, target = self.item(item_id, "update"), self.item(target_id)
        if not internal:
            check_version(source, expected)
            check_version(target, target_expected)
        require(
            source["project_id"] == target["project_id"] and item_id != target_id,
            422,
            "invalid_link",
            "Link a different item in the same project.",
        )
        require(
            relationship in ("parent", "child", "related", "blocked_by", "blocks"),
            422,
            "invalid_relationship",
            "Choose a supported relationship.",
        )
        a, b = item_id, target_id
        kind = (
            "related"
            if relationship == "related"
            else "blocked_by"
            if relationship in ("blocked_by", "blocks")
            else "parent_child"
        )
        if relationship in ("parent", "blocks"):
            a, b = b, a
        if kind == "related":
            a, b = sorted((a, b))
        else:
            edges = self.rows(
                m.links, m.links.c.kind == kind, m.links.c.project_id == source["project_id"]
            )
            reachable, todo = set(), [b]
            while todo:
                node = todo.pop()
                if node in reachable:
                    continue
                reachable.add(node)
                todo.extend(e["target_id"] for e in edges if e["source_id"] == node)
            require(a not in reachable, 409, "link_cycle", "This link would create a cycle.")
            if kind == "blocked_by":
                require(
                    self.row(m.items, b)["state"] != "cancelled",
                    409,
                    "cancelled_blocker",
                    "A cancelled item cannot be a blocker.",
                )
            else:
                require(
                    not [e for e in edges if e["target_id"] == b],
                    409,
                    "parent_exists",
                    "An item can have only one parent.",
                )
        duplicate = self.rows(
            m.links, m.links.c.kind == kind, m.links.c.source_id == a, m.links.c.target_id == b
        )
        if duplicate and internal:
            return duplicate[0]
        require(not duplicate, 409, "link_exists", "These items are already linked this way.")
        edge = dict(
            id=uid(),
            project_id=source["project_id"],
            kind=kind,
            source_id=a,
            target_id=b,
            creator_id=self.user["id"],
            created_at=now(),
            version=1,
        )
        self.c.execute(insert(m.links).values(**edge))
        for id in (a, b):
            self.touch(m.items, self.row(m.items, id))
            self.record(
                source["project_id"],
                id,
                "link_added",
                edge["id"],
                {
                    "kind": kind,
                    "source_id": a,
                    "target_id": b,
                    "source_key": self.item_out(self.row(m.items, a))["key"],
                    "target_key": self.item_out(self.row(m.items, b))["key"],
                },
            )
        return edge

    def item_links(self, item_id):
        item = self.item(item_id)
        edges = self.rows(
            m.links, or_(m.links.c.source_id == item_id, m.links.c.target_id == item_id)
        )
        result = []
        for edge in edges:
            is_source = edge["source_id"] == item_id
            other_id = edge["target_id"] if is_source else edge["source_id"]
            relationship = (
                "related"
                if edge["kind"] == "related"
                else ("child" if is_source else "parent")
                if edge["kind"] == "parent_child"
                else ("blocked_by" if is_source else "blocks")
            )
            result.append(
                {**edge, "relationship": relationship, "item": self.item_out(self.item(other_id))}
            )
        return {
            "items": result,
            "blocker_summary": self.blocker_summary(item),
            "item_version": item["version"],
        }

    def remove_edge(self, edge, reason):
        endpoints = {}
        project_key = self.row(m.projects, edge["project_id"])["key"]
        for name in ("source", "target"):
            endpoint = self.row(m.items, edge[name + "_id"])
            endpoints[name] = {
                "key": f"{project_key}-{endpoint['number']}",
                "title": endpoint["title"],
            }
        self.c.execute(delete(m.links).where(m.links.c.id == edge["id"]))
        for id in (edge["source_id"], edge["target_id"]):
            self.touch(m.items, self.row(m.items, id))
            self.record(
                edge["project_id"],
                id,
                "link_removed",
                edge["id"],
                {
                    "kind": edge["kind"],
                    "source_id": edge["source_id"],
                    "target_id": edge["target_id"],
                    "reason": reason,
                    "endpoints": endpoints,
                },
            )
        source = self.row(m.items, edge["source_id"])
        if (
            edge["kind"] == "blocked_by"
            and source["state"] == "blocked"
            and not self.blockers(source["id"])
        ):
            self.touch(m.items, source, {"state": "open"})
            self.record(
                source["project_id"],
                source["id"],
                "state_changed_automatically",
                source["id"],
                {"state": {"from": "blocked", "to": "open"}},
                system=True,
                cause=reason,
            )
            return {"item_id": source["id"], "from": "blocked", "to": "open"}

    def unlink(self, item_id, link_id, expected, item_expected):
        item = self.item(item_id, "update")
        edge = self.row(m.links, link_id)
        require(
            item_id in (edge["source_id"], edge["target_id"]),
            404,
            "not_found",
            "This link is unavailable.",
        )
        check_version(edge, expected)
        check_version(item, item_expected)
        effect = self.remove_edge(
            edge, "blocker_removed" if edge["kind"] == "blocked_by" else "link_removed"
        )
        return {"removed_link_id": link_id, "automatic_state_changes": [effect] if effect else []}

    def impact(self, item_id, deleting=False):
        item = self.item(item_id)
        incoming = self.rows(
            m.links,
            m.links.c.kind == "blocked_by",
            m.links.c.target_id == item_id,
            order=[m.links.c.id],
        )
        affected = []
        for edge in incoming:
            dependent = self.row(m.items, edge["source_id"])
            remaining = [(e, b) for e, b in self.blockers(dependent["id"]) if e["id"] != edge["id"]]
            affected.append(
                {
                    "link_id": edge["id"],
                    "link_version": edge["version"],
                    "item": self.item_out(dependent),
                    "remaining_blockers": len(remaining),
                    "will_move_to_open": dependent["state"] == "blocked" and not remaining,
                }
            )
        return {
            "item_id": item_id,
            "version": item["version"],
            "affected_items": affected,
            "impact_revision": fingerprint(
                {"item": item, "affected": affected, "deleting": deleting}
            ),
        }

    def check_question_transition(self, item, target):
        require(
            item["state"] != "open_question" or target in ("open_question", "open"),
            409,
            "question_must_return_to_open",
            "Return this item to Open before changing it to another state.",
        )

    def cancel_item(self, item_id, expected, impact_revision, confirm_blocker_removal=False):
        item = self.item(item_id, "update")
        check_version(item, expected)
        self.check_question_transition(item, "cancelled")
        self.ensure_not_closed(item)
        impact = self.impact(item_id)
        require(
            impact["impact_revision"] == impact_revision,
            409,
            "impact_changed",
            "Cancellation impact changed. Review it again.",
        )
        require(
            not impact["affected_items"] or confirm_blocker_removal,
            409,
            "confirmation_required",
            "Confirm removal of this item as a blocker for all affected items.",
            impact,
        )
        self.touch(m.items, item, {"state": "cancelled"})
        self.record(
            item["project_id"],
            item_id,
            "item_cancelled",
            item_id,
            {"state": {"from": item["state"], "to": "cancelled"}},
        )
        effects = []
        for affected in impact["affected_items"]:
            effect = self.remove_edge(self.row(m.links, affected["link_id"]), "blocker_cancelled")
            if effect:
                effects.append(effect)
        return {
            "item": self.item_out(self.row(m.items, item_id)),
            "automatic_state_changes": effects,
            "removed_blocker_links": [a["link_id"] for a in impact["affected_items"]],
        }

    def ensure_not_closed(self, item):
        require(
            not item["sprint_id"] or self.row(m.sprints, item["sprint_id"])["state"] != "closed",
            409,
            "sprint_closed",
            "Move the item out of its closed sprint first.",
        )

    def resume_item(self, item_id, expected, blocker_revision):
        item = self.item(item_id, "update")
        check_version(item, expected)
        summary = self.blocker_summary(item)
        require(
            summary["ready_to_resume"] and summary["blocker_revision"] == blocker_revision,
            409,
            "readiness_changed",
            "The blockers changed. Review them before resuming.",
        )
        self.ensure_not_closed(item)
        item = self.touch(m.items, item, {"state": "in_progress"})
        self.record(
            item["project_id"],
            item_id,
            "item_resumed",
            item_id,
            {"state": {"from": "blocked", "to": "in_progress"}},
        )
        return self.item_out(item)

    def delete_item(self, item_id, expected, impact_revision):
        item = self.item(item_id, "delete")
        check_version(item, expected)
        self.ensure_not_closed(item)
        impact = self.impact(item_id, deleting=True)
        require(
            impact["impact_revision"] == impact_revision,
            409,
            "impact_changed",
            "Deletion impact changed. Review it again.",
        )
        for table, resource in ((m.comments, "comment"), (m.attachments, "attachment")):
            if self.rows(table, table.c.item_id == item_id):
                self.access(item["project_id"], resource, "delete")
        edges = self.rows(
            m.links, or_(m.links.c.source_id == item_id, m.links.c.target_id == item_id)
        )
        if edges:
            self.access(item["project_id"], "item", "update")
        effects = []
        # A deleted Blocked item itself must not generate a spurious reopening event.
        if item["state"] == "blocked":
            self.c.execute(update(m.items).where(m.items.c.id == item_id).values(state="open"))
        for edge in edges:
            effect = self.remove_edge(
                edge, "blocker_deleted" if edge["kind"] == "blocked_by" else "item_deleted"
            )
            if effect:
                effects.append(effect)
        for attachment in self.rows(m.attachments, m.attachments.c.item_id == item_id):
            self.schedule_file_delete(attachment)
        for comment in self.rows(m.comments, m.comments.c.item_id == item_id):
            self.record(
                item["project_id"],
                item_id,
                "comment_deleted",
                comment["id"],
                {"reason": "item_deleted"},
                resource="comment",
            )
        self.record(
            item["project_id"],
            item_id,
            "item_deleted",
            item_id,
            {"key": self.item_out(item)["key"], "title": item["title"]},
        )
        self.c.execute(delete(m.items).where(m.items.c.id == item_id))
        return {
            "deleted_item_id": item_id,
            "removed_blocker_links": [a["link_id"] for a in impact["affected_items"]],
            "automatic_state_changes": effects,
        }

    def bulk_move(self, project_id, versions, destination):
        self.access(project_id, "item", "update")
        self.validate_destination(project_id, destination)
        for id, expected in versions.items():
            item = self.item(id, "update")
            require(
                item["project_id"] == project_id,
                422,
                "cross_project",
                "Move items within one project.",
            )
            check_version(item, expected)
        return {
            "items": [
                self.update_item(id, {"sprint_id": destination}, expected)
                for id, expected in versions.items()
            ]
        }

    def reorder(self, project_id, resource, versions, ordered_ids, sprint_id=None):
        self.access(project_id, resource, "update")
        table = m.items if resource == "item" else m.sprints
        conditions = [table.c.project_id == project_id]
        if resource == "item":
            conditions.append(table.c.sprint_id == sprint_id)
        rows = self.rows(table, *conditions)
        require(
            len(ordered_ids) == len(set(ordered_ids))
            and set(ordered_ids) == {r["id"] for r in rows},
            409,
            "order_scope_changed",
            "Reload the complete list before reordering.",
        )
        for row in rows:
            check_version(row, versions.get(row["id"]))
        by_id = {r["id"]: r for r in rows}
        for i, id in enumerate(ordered_ids):
            column = "rank" if resource == "item" else "position"
            value = (i + 1) * 1024
            if by_id[id][column] != value:
                self.touch(table, by_id[id], {column: value})
                self.record(
                    project_id,
                    id if resource == "item" else None,
                    "reordered",
                    id,
                    {column: {"from": by_id[id][column], "to": value}},
                    resource=resource,
                )
        return {"ordered_ids": ordered_ids}

    def sprint_out(self, sprint):
        result = dict(sprint)
        if self.can(sprint["project_id"], "item"):
            rows = self.rows(m.items, m.items.c.sprint_id == sprint["id"])
            result["counts"] = {state: sum(i["state"] == state for i in rows) for state in m.STATES}
            result["total"] = len(rows)
        return result

    def list_sprints(self, project_id, state=None, offset=0, limit=50):
        self.access(project_id, "sprint")
        rows = self.rows(
            m.sprints,
            m.sprints.c.project_id == project_id,
            order=[m.sprints.c.position, m.sprints.c.id],
        )
        return page(
            [self.sprint_out(s) for s in rows if not state or s["state"] == state], offset, limit
        )

    def create_sprint(self, project_id, name, description=""):
        self.access(project_id, "sprint", "create")
        position = (
            self.c.scalar(
                select(func.max(m.sprints.c.position)).where(m.sprints.c.project_id == project_id)
            )
            or 0
        ) + 1024
        sprint = dict(
            id=uid(),
            project_id=project_id,
            name=name,
            description=description,
            position=position,
            state="planned",
            started_at=None,
            closed_at=None,
            version=1,
            created_at=now(),
            updated_at=now(),
        )
        self.c.execute(insert(m.sprints).values(**sprint))
        self.record(
            project_id,
            None,
            "sprint_created",
            sprint["id"],
            {"name": name, "description": description},
            resource="sprint",
        )
        return self.sprint_out(sprint)

    def update_sprint(self, sprint_id, changes, expected):
        sprint = self.sprint(sprint_id, "update")
        check_version(sprint, expected)
        require(bool(changes), 422, "empty_update", "Provide a name or description to update.")
        changed = self.touch(m.sprints, sprint, changes)
        self.record(
            sprint["project_id"],
            None,
            "sprint_updated",
            sprint_id,
            {
                key: {"from": sprint[key], "to": value}
                for key, value in changes.items()
                if sprint[key] != value
            },
            resource="sprint",
        )
        return self.sprint_out(changed)

    def start_sprint(self, sprint_id, expected):
        sprint = self.sprint(sprint_id, "update")
        check_version(sprint, expected)
        require(
            sprint["state"] == "planned",
            409,
            "invalid_sprint_state",
            "Only a not-started sprint can be started.",
        )
        require(
            not self.rows(
                m.sprints,
                m.sprints.c.project_id == sprint["project_id"],
                m.sprints.c.state == "active",
            ),
            409,
            "active_sprint_exists",
            "This project already has an active sprint.",
        )
        question_count = self.c.scalar(
            select(func.count())
            .select_from(m.items)
            .where(
                m.items.c.project_id == sprint["project_id"],
                m.items.c.sprint_id == sprint_id,
                m.items.c.state == "open_question",
            )
        )
        if question_count:
            can_view_items = self.can(sprint["project_id"], "item")
            require(
                False,
                409,
                "sprint_open_questions",
                "Return items with open questions to Open before starting this sprint."
                if can_view_items
                else "This sprint has open questions. Ask someone with item access to review them.",
                {"count": question_count} if can_view_items else {},
            )
        result = self.touch(m.sprints, sprint, {"state": "active", "started_at": now()})
        self.record(
            sprint["project_id"],
            None,
            "sprint_started",
            sprint_id,
            {"started_at": result["started_at"]},
            resource="sprint",
        )
        return self.sprint_out(result)

    def close_preview(self, sprint_id):
        sprint = self.sprint(sprint_id)
        self.access(sprint["project_id"], "item")
        unfinished = self.rows(
            m.items, m.items.c.sprint_id == sprint_id, m.items.c.state.not_in(("done", "cancelled"))
        )
        return {
            "sprint": self.sprint_out(sprint),
            "unfinished": [self.item_out(i) for i in unfinished],
            "destinations": [
                s
                for s in self.rows(
                    m.sprints,
                    m.sprints.c.project_id == sprint["project_id"],
                    m.sprints.c.id != sprint_id,
                    m.sprints.c.state != "closed",
                )
            ],
        }

    def close_sprint(self, sprint_id, expected, destination=None, destination_version=None):
        sprint = self.sprint(sprint_id, "update")
        check_version(sprint, expected)
        require(
            sprint["state"] == "active",
            409,
            "invalid_sprint_state",
            "Only the active sprint can be closed.",
        )
        unfinished = self.rows(
            m.items, m.items.c.sprint_id == sprint_id, m.items.c.state.not_in(("done", "cancelled"))
        )
        if unfinished:
            require(
                destination and destination != sprint_id,
                409,
                "unfinished_items",
                "Move unfinished items to another sprint before closing.",
                {"count": len(unfinished)},
            )
            target = self.sprint(destination)
            check_version(target, destination_version)
            self.bulk_move(
                sprint["project_id"], {i["id"]: i["version"] for i in unfinished}, destination
            )
        result = self.touch(m.sprints, sprint, {"state": "closed", "closed_at": now()})
        self.record(
            sprint["project_id"],
            None,
            "sprint_closed",
            sprint_id,
            {"closed_at": result["closed_at"]},
            resource="sprint",
        )
        return self.sprint_out(result)

    def delete_sprint(self, sprint_id, expected):
        sprint = self.sprint(sprint_id, "delete")
        check_version(sprint, expected)
        require(
            sprint["state"] == "planned"
            and not self.rows(m.items, m.items.c.sprint_id == sprint_id),
            409,
            "sprint_not_empty",
            "Only an empty, not-started sprint can be deleted.",
        )
        self.record(
            sprint["project_id"],
            None,
            "sprint_deleted",
            sprint_id,
            {"name": sprint["name"]},
            resource="sprint",
        )
        self.c.execute(delete(m.sprints).where(m.sprints.c.id == sprint_id))
