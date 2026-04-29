import * as cheerio from "cheerio";
import type { Segment } from "./types.js";

// Regions to exclude — navigation, footer, cookie banners, etc.
const EXCLUDE_SELECTORS = [
  "nav", "header", "footer",
  "[role='navigation']", "[role='banner']", "[role='contentinfo']",
  ".cookie-banner", ".cookie-notice", "#cookie-banner",
  ".nav", ".navbar", ".header", ".footer",
  "script", "style", "noscript", "svg",
];

// Selectors that commonly contain marketing copy on automotive/CMS sites
const COPY_SELECTORS = [
  "h1", "h2", "h3",
  "p", "li",
  "[class*='headline']", "[class*='title']",
  "[class*='feature']", "[class*='spec']",
  "[class*='description']", "[class*='copy']",
  "[data-copy]",
];

let segmentCounter = 0;

export function extractSegments(html: string, pageUrl: string): Segment[] {
  const $ = cheerio.load(html);

  // Remove excluded regions entirely
  EXCLUDE_SELECTORS.forEach((sel) => $(sel).remove());

  const segments: Segment[] = [];
  const seen = new Set<string>();

  for (const sel of COPY_SELECTORS) {
    $(sel).each((_i, el) => {
      const element = $(el);
      const text = element.text().trim();

      // Skip empty or very short elements (single words, icons, etc.)
      if (text.length < 15) return;

      // Skip duplicates (same text seen from a broader and narrower selector)
      if (seen.has(text)) return;
      seen.add(text);

      const id = `seg-${++segmentCounter}`;
      segments.push({
        id,
        selector: buildSelector(el, $),
        text,
        outerHTML: $.html(el) ?? element.prop("outerHTML") ?? "",
      });
    });
  }

  return segments;
}

function buildSelector(el: cheerio.AnyNode, $: cheerio.CheerioAPI): string {
  const element = $(el);
  const tag = (el as cheerio.Element).tagName ?? "div";
  const id = element.attr("id");
  if (id) return `#${id}`;
  const cls = element.attr("class");
  if (cls) {
    const first = cls.trim().split(/\s+/)[0];
    return `${tag}.${first}`;
  }
  return tag;
}
