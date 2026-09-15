/**
 * Structured data for search engines (schema.org, JSON-LD): what a page is —
 * a game, a list of games, a FAQ — so results can show it richly. Everything
 * described here must also be visible on the page itself.
 */
export default function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  return (
    <script
      type="application/ld+json"
      // `<` is escaped so a value can never close the script tag.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  );
}
