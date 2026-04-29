import "dotenv/config";
import { program } from "commander";
import { chromium } from "playwright";
import * as fs from "fs";
import * as path from "path";
import pLimit from "p-limit";

import { crawl } from "./crawler.js";
import { scrapePage } from "./scraper.js";
import { diffSpecs } from "./differ.js";
import { extractSegments } from "./segmenter.js";
import { analyzeSegments } from "./analyzer.js";
import { rewriteSegments } from "./rewriter.js";
import { annotateAndWrite } from "./annotator.js";
import type { PageResult } from "./types.js";

program
  .name("copy-refresh")
  .description("Crawl a website, diff spec docs, and propose copy updates for human review")
  .requiredOption("--root <url>", "Root URL to crawl from")
  .requiredOption("--old-spec <path>", "Path to old spec document")
  .requiredOption("--new-spec <path>", "Path to new spec document")
  .requiredOption("--guidelines <path>", "Path to copy guidelines markdown file")
  .option("--depth <n>", "BFS crawl depth", "1")
  .option("--output <dir>", "Output directory", "./output")
  .option("--concurrency <n>", "Max parallel page analyses", "3")
  .parse();

const opts = program.opts<{
  root: string;
  oldSpec: string;
  newSpec: string;
  guidelines: string;
  depth: string;
  output: string;
  concurrency: string;
}>();

async function main() {
  // Read inputs
  const oldSpec = fs.readFileSync(opts.oldSpec, "utf-8");
  const newSpec = fs.readFileSync(opts.newSpec, "utf-8");
  const guidelines = fs.readFileSync(opts.guidelines, "utf-8");
  const maxDepth = parseInt(opts.depth, 10);
  const concurrency = parseInt(opts.concurrency, 10);

  fs.mkdirSync(opts.output, { recursive: true });

  console.log("\n🔍 Step 1: Diffing spec documents...");
  const changeSet = await diffSpecs(oldSpec, newSpec);
  if (changeSet.length === 0) {
    console.log("  No changes detected between specs. Exiting.");
    return;
  }
  console.log(`  → ${changeSet.length} changes found`);
  changeSet.forEach((c) => console.log(`     • [${c.changeType}] ${c.attribute}: "${c.oldValue}" → "${c.newValue}"`));

  console.log("\n🌐 Step 2: Crawling site...");
  const browser = await chromium.launch({ headless: true });

  let urls: string[];
  try {
    urls = await crawl(browser, opts.root, maxDepth);
  } catch (err) {
    await browser.close();
    throw err;
  }
  console.log(`  → ${urls.length} pages discovered`);

  console.log("\n📄 Step 3: Processing pages...");
  const limit = pLimit(concurrency);
  const results: PageResult[] = [];

  await Promise.all(
    urls.map((url) =>
      limit(async () => {
        console.log(`\n  Processing: ${url}`);
        try {
          const { html, title } = await scrapePage(browser, url);
          const segments = extractSegments(html, url);
          console.log(`  [segmenter] ${segments.length} segments extracted from "${title}"`);

          if (segments.length === 0) {
            console.log("  [segmenter] no copy segments found, skipping page");
            return;
          }

          const analyses = await analyzeSegments(segments, changeSet, guidelines, url);
          const rewrites = await rewriteSegments(segments, analyses, guidelines, concurrency);

          results.push({ url, html, segments, analyses, rewrites });

          const outPath = annotateAndWrite(
            { url, html, segments, analyses, rewrites },
            opts.output
          );
          console.log(`  ✅ Written: ${outPath}`);
        } catch (err) {
          console.error(`  ❌ Error processing ${url}: ${(err as Error).message}`);
        }
      })
    )
  );

  await browser.close();

  // Summary
  console.log("\n✨ Done!");
  console.log(`  Pages processed : ${results.length}`);
  const totalFlagged = results.reduce(
    (sum, r) => sum + r.analyses.filter((a) => a.affected).length,
    0
  );
  console.log(`  Total changes   : ${totalFlagged}`);
  console.log(`  Output dir      : ${path.resolve(opts.output)}`);
  console.log("\n  Open any .html file in your browser to review proposed changes.\n");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
