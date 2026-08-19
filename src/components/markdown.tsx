import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** Render Markdown aman (react-markdown tidak merender HTML mentah). */
export function Markdown({ content, className }: { content: string; className?: string }) {
  return (
    <div className={`prose-cms ${className ?? ""}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}
