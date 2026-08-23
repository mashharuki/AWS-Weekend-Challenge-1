import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

export const isSafeHref = (href: string | undefined): boolean => {
  if (!href) {
    return false;
  }
  try {
    const protocol = new URL(href).protocol;
    return (
      protocol === "https:" || protocol === "http:" || protocol === "mailto:"
    );
  } catch {
    return false;
  }
};

const components: Components = {
  a: ({ children, href }) =>
    isSafeHref(href) ? (
      <a
        className="font-medium text-cyan-700 underline decoration-cyan-400 underline-offset-4 hover:text-cyan-950"
        href={href}
        rel="noreferrer"
        target="_blank"
      >
        {children}
      </a>
    ) : (
      <span>{children}</span>
    ),
  h1: ({ children }) => (
    <h1 className="mt-8 font-serif text-3xl font-semibold text-slate-950 first:mt-0">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="mt-7 font-serif text-2xl font-semibold text-slate-950">
      {children}
    </h2>
  ),
  p: ({ children }) => (
    <p className="mt-4 leading-8 text-slate-700">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="mt-4 list-disc space-y-2 pl-6 text-slate-700">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="mt-4 list-decimal space-y-2 pl-6 text-slate-700">
      {children}
    </ol>
  ),
};

export const MarkdownArticle = ({
  markdown,
}: {
  readonly markdown: string;
}) => (
  <article className="markdown-content text-left">
    <ReactMarkdown components={components} remarkPlugins={[remarkGfm]}>
      {markdown}
    </ReactMarkdown>
  </article>
);
