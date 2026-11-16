import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { Markdown } from "./Markdown";

it("formats long text with tables, checklists and code while stripping embedded HTML", () => {
  const html = renderToStaticMarkup(
    <Markdown>
      {[
        "## Goal",
        "**Action** with `code`.",
        "- [x] Done\n- [ ] Next",
        "| Item | State |\n| --- | --- |\n| Issue | Done |",
        "<script>alert('injected')</script>",
        "[unsafe](javascript:alert%281%29)",
      ].join("\n\n")}
    </Markdown>,
  );

  expect(html).toContain("<h2>Goal</h2>");
  expect(html).toContain("<strong>Action</strong>");
  expect(html).toContain("<code>code</code>");
  expect(html).toContain('type="checkbox"');
  expect(html).toContain("<table>");
  expect(html).not.toContain("<script");
  expect(html).not.toContain("javascript:");
});
