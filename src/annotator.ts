import * as cheerio from "cheerio";
import * as fs from "fs";
import * as path from "path";
import type { PageResult } from "./types.js";

const ANNOTATION_CSS = `
/* Copy Refresh — annotation overlay */
.cr-flagged {
  position: relative;
  outline: 3px solid #f59e0b;
  outline-offset: 2px;
  border-radius: 3px;
}
.cr-annotation {
  display: block;
  margin: 8px 0 4px;
  background: #fff8f0;
  border: 1px solid #f59e0b;
  border-radius: 6px;
  padding: 10px 14px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-size: 13px;
  line-height: 1.5;
  color: #1a1a1a;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
}
.cr-label-original {
  font-weight: 600;
  color: #6b7280;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 2px;
}
.cr-original-text {
  color: #9ca3af;
  text-decoration: line-through;
  font-style: italic;
  margin-bottom: 8px;
}
.cr-label-proposed {
  font-weight: 600;
  color: #065f46;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 2px;
}
.cr-proposed-text {
  color: #065f46;
  background: #d1fae5;
  border-radius: 3px;
  padding: 2px 4px;
  margin-bottom: 8px;
  display: inline-block;
}
.cr-label-rationale {
  font-weight: 600;
  color: #92400e;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 2px;
}
.cr-rationale-text {
  color: #78350f;
  font-size: 12px;
}
.cr-summary-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 99999;
  background: #1e293b;
  color: #f1f5f9;
  padding: 10px 20px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 20px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.3);
}
.cr-summary-bar strong {
  color: #fbbf24;
}
.cr-summary-badge {
  background: #f59e0b;
  color: #1a1a1a;
  font-weight: 700;
  border-radius: 999px;
  padding: 2px 10px;
  font-size: 12px;
}
`;

function slugifyUrl(url: string): string {
  try {
    const u = new URL(url);
    const parts = [u.hostname, u.pathname]
      .join("")
      .replace(/[^a-zA-Z0-9]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    return parts.substring(0, 80) || "page";
  } catch {
    return "page";
  }
}

export function annotateAndWrite(result: PageResult, outputDir: string): string {
  const { url, html, segments, analyses, rewrites } = result;

  const rewriteMap = new Map(rewrites.map((r) => [r.segmentId, r]));
  const analysisMap = new Map(analyses.map((a) => [a.segmentId, a]));
  const affectedIds = new Set(analyses.filter((a) => a.affected).map((a) => a.segmentId));

  const $ = cheerio.load(html);

  // Inject annotation CSS
  $("head").append(`<style id="cr-styles">${ANNOTATION_CSS}</style>`);

  // Annotate each affected segment
  for (const segId of affectedIds) {
    const segment = segments.find((s) => s.id === segId);
    const analysis = analysisMap.get(segId);
    const rewrite = rewriteMap.get(segId);
    if (!segment || !analysis || !rewrite) continue;

    // Find the element by matching text content
    let target: cheerio.Cheerio<cheerio.AnyNode> | null = null;
    $(segment.selector).each((_i, el) => {
      if ($(el).text().trim() === segment.text) {
        target = $(el);
        return false; // break
      }
    });

    if (!target) {
      // Fallback: search all elements for exact text match
      $("h1,h2,h3,p,li").each((_i, el) => {
        if ($(el).text().trim() === segment.text) {
          target = $(el);
          return false;
        }
      });
    }

    if (!target) continue;

    const changesDesc = analysis.relevantChanges
      .map((c) => `<em>${c.attribute}</em>: "${c.oldValue}" → "${c.newValue}"`)
      .join("; ");

    const annotationHtml = `
<span class="cr-annotation">
  <div class="cr-label-original">Original</div>
  <div class="cr-original-text">${escapeHtml(segment.text)}</div>
  <div class="cr-label-proposed">Proposed</div>
  <div class="cr-proposed-text">${escapeHtml(rewrite.proposedCopy)}</div>
  <div class="cr-label-rationale">Why flagged</div>
  <div class="cr-rationale-text">${escapeHtml(rewrite.rationale)} <br><small>Changes: ${changesDesc}</small></div>
</span>`;

    (target as cheerio.Cheerio<cheerio.AnyNode>).addClass("cr-flagged").after(annotationHtml);
  }

  // Inject summary bar
  const totalSegments = segments.length;
  const totalFlagged = affectedIds.size;
  const summaryBar = `
<div class="cr-summary-bar">
  <span>📋 <strong>Copy Refresh Review</strong></span>
  <span class="cr-summary-badge">${totalFlagged} changes proposed</span>
  <span style="color:#94a3b8">${totalSegments} segments reviewed · ${url}</span>
</div>
<div style="height:44px"></div>`;

  $("body").prepend(summaryBar);

  // Write output file
  const slug = slugifyUrl(url);
  const filename = `${slug}.html`;
  const outPath = path.join(outputDir, filename);
  fs.writeFileSync(outPath, $.html(), "utf-8");

  return outPath;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
