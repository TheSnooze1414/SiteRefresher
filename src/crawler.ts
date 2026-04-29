import { Browser } from "playwright";

const SKIP_EXTENSIONS = /\.(pdf|jpg|jpeg|png|gif|svg|webp|mp4|zip|css|js|woff|woff2|ttf)$/i;
const SKIP_PROTOCOLS = /^(mailto:|tel:|javascript:|#)/;

export async function crawl(
  browser: Browser,
  rootUrl: string,
  maxDepth: number
): Promise<string[]> {
  const rootOrigin = new URL(rootUrl).origin;
  const visited = new Set<string>();
  const queue: Array<{ url: string; depth: number }> = [{ url: rootUrl, depth: 0 }];
  const discovered: string[] = [];

  const page = await browser.newPage();
  await page.setExtraHTTPHeaders({ "User-Agent": "copy-refresh-bot/1.0" });

  while (queue.length > 0) {
    const item = queue.shift()!;
    const { url, depth } = item;

    const normalized = normalizeUrl(url);
    if (!normalized || visited.has(normalized)) continue;
    visited.add(normalized);

    console.log(`  [crawl] depth=${depth} ${normalized}`);
    discovered.push(normalized);

    if (depth >= maxDepth) continue;

    try {
      await page.goto(normalized, { waitUntil: "networkidle", timeout: 30000 });
      const links = await page.$$eval("a[href]", (anchors) =>
        anchors.map((a) => (a as HTMLAnchorElement).href)
      );

      for (const link of links) {
        if (SKIP_PROTOCOLS.test(link)) continue;
        if (SKIP_EXTENSIONS.test(link)) continue;

        let parsed: URL;
        try {
          parsed = new URL(link);
        } catch {
          continue;
        }

        if (parsed.origin !== rootOrigin) continue;

        const clean = normalizeUrl(parsed.toString());
        if (clean && !visited.has(clean)) {
          queue.push({ url: clean, depth: depth + 1 });
        }
      }
    } catch (err) {
      console.warn(`  [crawl] failed to load ${normalized}: ${(err as Error).message}`);
    }
  }

  await page.close();
  return discovered;
}

function normalizeUrl(raw: string): string | null {
  try {
    const u = new URL(raw);
    u.hash = "";
    return u.toString().replace(/\/$/, "") || "/";
  } catch {
    return null;
  }
}
