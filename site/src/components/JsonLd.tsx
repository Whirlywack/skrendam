/**
 * Hardens a JSON-LD payload against `</script>` injection by replacing `<`
 * with its Unicode escape `<`. Safe to render via dangerouslySetInnerHTML.
 */
export function safeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

/** Injects a JSON-LD script tag. Data is sanitised by safeJsonLd. */
export function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJsonLd(data) }}
    />
  );
}
