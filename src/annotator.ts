import * as cheerio from "cheerio";
import * as fs from "fs";
import * as path from "path";
import type { PageResult } from "./types.js";

const ANNOTATION_CSS = `
/* Copy Refresh — annotation overlay */
.cr-flagged {
  position: relative;
  outline: 3px solid #f59e0b;
  outline-offset: 3px;
  border-radius: 3px;
  scroll-margin-top: 80px;
}
.cr-flagged.cr-active {
  outline: 3px solid #3b82f6;
  outline-offset: 3px;
}
.cr-change-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  position: absolute;
  top: -12px;
  left: -12px;
  width: 22px;
  height: 22px;
  background: #f59e0b;
  color: #1a1a1a;
  font-weight: 700;
  font-size: 11px;
  border-radius: 50%;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  box-shadow: 0 1px 4px rgba(0,0,0,0.2);
  z-index: 9999;
  cursor: pointer;
}
.cr-flagged.cr-active .cr-change-badge {
  background: #3b82f6;
  color: #fff;
}
.cr-annotation {
  display: block;
  margin: 10px 0 6px;
  background: #fff8f0;
  border: 1px solid #f59e0b;
  border-radius: 8px;
  padding: 12px 16px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-size: 13px;
  line-height: 1.55;
  color: #1a1a1a;
  box-shadow: 0 2px 10px rgba(0,0,0,0.09);
}
.cr-annotation-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
  padding-bottom: 8px;
  border-bottom: 1px solid #fde68a;
}
.cr-change-num {
  font-weight: 700;
  font-size: 12px;
  color: #92400e;
  background: #fde68a;
  padding: 2px 8px;
  border-radius: 999px;
}
.cr-nav-inline {
  display: flex;
  gap: 6px;
}
.cr-nav-inline button {
  background: #f59e0b;
  border: none;
  border-radius: 4px;
  padding: 3px 10px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  color: #1a1a1a;
}
.cr-nav-inline button:hover { background: #d97706; color: #fff; }
.cr-label {
  font-weight: 600;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 3px;
}
.cr-label-original { color: #6b7280; }
.cr-original-text {
  color: #9ca3af;
  text-decoration: line-through;
  font-style: italic;
  margin-bottom: 10px;
}
.cr-label-proposed { color: #065f46; }
.cr-proposed-text {
  color: #065f46;
  background: #d1fae5;
  border-radius: 4px;
  padding: 4px 8px;
  margin-bottom: 10px;
  display: block;
  font-weight: 500;
}
.cr-label-rationale { color: #92400e; }
.cr-rationale-text {
  color: #78350f;
  font-size: 12px;
}
.cr-rationale-text small {
  display: block;
  margin-top: 4px;
  opacity: 0.75;
}

/* ── Summary / Nav bar ── */
.cr-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 999999;
  background: #1e293b;
  color: #f1f5f9;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 0;
  box-shadow: 0 2px 10px rgba(0,0,0,0.4);
  min-height: 48px;
}
.cr-bar-title {
  padding: 0 16px;
  font-weight: 700;
  color: #fbbf24;
  white-space: nowrap;
  border-right: 1px solid #334155;
  display: flex;
  align-items: center;
  gap: 8px;
  align-self: stretch;
}
.cr-bar-badge {
  background: #f59e0b;
  color: #1a1a1a;
  font-weight: 700;
  border-radius: 999px;
  padding: 1px 10px;
  font-size: 12px;
}
.cr-bar-nav {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 16px;
  border-right: 1px solid #334155;
  align-self: stretch;
}
.cr-bar-btn {
  background: #334155;
  border: none;
  border-radius: 5px;
  padding: 5px 13px;
  font-size: 13px;
  font-weight: 600;
  color: #f1f5f9;
  cursor: pointer;
  white-space: nowrap;
}
.cr-bar-btn:hover { background: #475569; }
.cr-bar-btn:disabled { opacity: 0.35; cursor: default; }
.cr-bar-counter {
  color: #94a3b8;
  font-size: 13px;
  min-width: 60px;
  text-align: center;
  white-space: nowrap;
}
.cr-bar-counter strong { color: #f1f5f9; }
.cr-bar-jumps {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 16px;
  flex-wrap: nowrap;
  overflow-x: auto;
  flex: 1;
}
.cr-bar-jumps::-webkit-scrollbar { height: 3px; }
.cr-bar-jumps::-webkit-scrollbar-thumb { background: #475569; border-radius: 2px; }
.cr-jump-btn {
  background: #334155;
  border: none;
  border-radius: 50%;
  width: 26px;
  height: 26px;
  font-size: 11px;
  font-weight: 700;
  color: #94a3b8;
  cursor: pointer;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.cr-jump-btn:hover { background: #f59e0b; color: #1a1a1a; }
.cr-jump-btn.cr-jump-active { background: #3b82f6; color: #fff; }
.cr-bar-url {
  padding: 0 16px;
  color: #475569;
  font-size: 11px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 280px;
  border-left: 1px solid #334155;
  align-self: stretch;
  display: flex;
  align-items: center;
}
.cr-spacer { height: 52px; }
`;

const NAV_SCRIPT = `
<script id="cr-nav-script">
(function() {
  var ids = CR_IDS_PLACEHOLDER;
  var current = 0;

  function activate(idx) {
    // Remove active from all
    ids.forEach(function(id, i) {
      var el = document.getElementById(id);
      if (el) el.classList.remove('cr-active');
      var jb = document.querySelector('.cr-jump-btn[data-idx="' + i + '"]');
      if (jb) jb.classList.remove('cr-jump-active');
    });
    // Activate current
    var target = document.getElementById(ids[idx]);
    if (target) {
      target.classList.add('cr-active');
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    var jbActive = document.querySelector('.cr-jump-btn[data-idx="' + idx + '"]');
    if (jbActive) jbActive.classList.add('cr-jump-active');

    current = idx;
    var counter = document.getElementById('cr-counter');
    if (counter) counter.innerHTML = '<strong>' + (idx + 1) + '</strong> of ' + ids.length;
    var prevBtn = document.getElementById('cr-prev');
    var nextBtn = document.getElementById('cr-next');
    if (prevBtn) prevBtn.disabled = (idx === 0);
    if (nextBtn) nextBtn.disabled = (idx === ids.length - 1);
  }

  window.crPrev = function() { if (current > 0) activate(current - 1); };
  window.crNext = function() { if (current < ids.length - 1) activate(current + 1); };
  window.crJump = function(idx) { activate(idx); };

  // Activate first change on load
  window.addEventListener('load', function() { if (ids.length > 0) activate(0); });
})();
</script>
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
  const affectedIds = analyses.filter((a) => a.affected).map((a) => a.segmentId);

  const $ = cheerio.load(html);

  $("head").append(`<style id="cr-styles">${ANNOTATION_CSS}</style>`);

  // Track which IDs we successfully annotated (some segments may not be found in DOM)
  const annotatedDomIds: string[] = [];
  let changeNum = 0;

  for (const segId of affectedIds) {
    const segment = segments.find((s) => s.id === segId);
    const analysis = analysisMap.get(segId);
    const rewrite = rewriteMap.get(segId);
    if (!segment || !analysis || !rewrite) continue;

    // Find element in DOM
    let target: cheerio.Cheerio<cheerio.AnyNode> | null = null;
    $(segment.selector).each((_i, el) => {
      if ($(el).text().trim() === segment.text) {
        target = $(el);
        return false;
      }
    });
    if (!target) {
      $("h1,h2,h3,p,li").each((_i, el) => {
        if ($(el).text().trim() === segment.text) {
          target = $(el);
          return false;
        }
      });
    }
    if (!target) continue;

    changeNum++;
    const domId = `cr-change-${changeNum}`;
    annotatedDomIds.push(domId);

    const changesDesc = analysis.relevantChanges
      .map((c) => `<em>${c.attribute}</em>: &ldquo;${escapeHtml(c.oldValue)}&rdquo; &rarr; &ldquo;${escapeHtml(c.newValue)}&rdquo;`)
      .join("; ");

    const isFirst = changeNum === 1;
    const isLast = changeNum === affectedIds.length; // approximate; refined by JS

    const annotationHtml = `
<span class="cr-annotation" role="region" aria-label="Change ${changeNum}">
  <div class="cr-annotation-header">
    <span class="cr-change-num">Change ${changeNum} of ${affectedIds.length}</span>
    <div class="cr-nav-inline">
      <button onclick="crPrev()" ${isFirst ? "disabled" : ""}>← Prev</button>
      <button onclick="crNext()" ${isLast ? "disabled" : ""}>Next →</button>
    </div>
  </div>
  <div class="cr-label cr-label-original">Original</div>
  <div class="cr-original-text">${escapeHtml(segment.text)}</div>
  <div class="cr-label cr-label-proposed">Proposed</div>
  <div class="cr-proposed-text">${escapeHtml(rewrite.proposedCopy)}</div>
  <div class="cr-label cr-label-rationale">Why flagged</div>
  <div class="cr-rationale-text">${escapeHtml(rewrite.rationale)}<small>Spec changes: ${changesDesc}</small></div>
</span>`;

    (target as cheerio.Cheerio<cheerio.AnyNode>)
      .attr("id", domId)
      .addClass("cr-flagged")
      .prepend(`<span class="cr-change-badge" onclick="crJump(${changeNum - 1})" title="Change ${changeNum}">${changeNum}</span>`)
      .after(annotationHtml);
  }

  // Build jump buttons
  const jumpButtons = annotatedDomIds
    .map((_, i) => `<button class="cr-jump-btn" data-idx="${i}" onclick="crJump(${i})" title="Jump to change ${i + 1}">${i + 1}</button>`)
    .join("\n");

  const totalFlagged = annotatedDomIds.length;
  const totalSegments = segments.length;

  const summaryBar = `
<div class="cr-bar" role="toolbar" aria-label="Copy Refresh navigation">
  <div class="cr-bar-title">
    📋 Copy Refresh
    <span class="cr-bar-badge">${totalFlagged} flagged</span>
  </div>
  <div class="cr-bar-nav">
    <button class="cr-bar-btn" id="cr-prev" onclick="crPrev()" ${totalFlagged <= 1 ? "disabled" : ""}>← Prev</button>
    <span class="cr-bar-counter" id="cr-counter"><strong>1</strong> of ${totalFlagged}</span>
    <button class="cr-bar-btn" id="cr-next" onclick="crNext()" ${totalFlagged <= 1 ? "disabled" : ""}>Next →</button>
  </div>
  <div class="cr-bar-jumps">
    ${jumpButtons}
  </div>
  <div class="cr-bar-url" title="${escapeHtml(url)}">${escapeHtml(url)}</div>
</div>
<div class="cr-spacer"></div>`;

  $("body").prepend(summaryBar);

  // Inject nav script with the actual DOM IDs
  const idsJson = JSON.stringify(annotatedDomIds);
  const script = NAV_SCRIPT.replace("CR_IDS_PLACEHOLDER", idsJson);
  $("body").append(script);

  // Write output
  const slug = slugifyUrl(url);
  const outPath = path.join(outputDir, `${slug}.html`);
  fs.writeFileSync(outPath, $.html(), "utf-8");

  console.log(`  [annotator] ${totalFlagged} changes annotated (${totalSegments} segments reviewed)`);
  return outPath;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
