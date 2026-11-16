import { useId } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

const remarkPlugins = [
  [remarkGfm, { singleTilde: false }],
] satisfies NonNullable<
  React.ComponentProps<typeof ReactMarkdown>["remarkPlugins"]
>;

const components: Components = {
  table: ({ node: _node, ...props }) => (
    <div className="markdown-table">
      <table {...props} />
    </div>
  ),
  img: ({ node: _node, alt, ...props }) => (
    <img
      {...props}
      alt={alt || ""}
      loading="lazy"
      referrerPolicy="no-referrer"
    />
  ),
};

export function Markdown({
  children,
  compact = false,
}: {
  children: string;
  compact?: boolean;
}) {
  const id = useId();
  return (
    <div className={compact ? "markdown markdown-compact" : "markdown"}>
      <ReactMarkdown
        skipHtml
        remarkPlugins={remarkPlugins}
        remarkRehypeOptions={{ clobberPrefix: `markdown-${id}-` }}
        components={components}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
