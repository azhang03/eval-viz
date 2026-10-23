// Content strings in content/ use a little HTML (<code>, <b>, <i>, entities). They are our own
// hand-written text, never user input, so they are rendered as HTML.
import type { ElementType } from "react";

export function Html({ html, as: Tag = "span", className }: { html: string; as?: ElementType; className?: string }) {
  return <Tag className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}
