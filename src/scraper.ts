import { Browser } from "playwright";

const REALISTIC_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export interface ScrapedPage {
  url: string;
  html: string;
  title: string;
}

export async function scrapePage(browser: Browser, url: string): Promise<ScrapedPage> {
  const page = await browser.newPage();
  await page.setExtraHTTPHeaders({
    "User-Agent": REALISTIC_UA,
    "Accept-Language": "en-US,en;q=0.9",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  });
  await page.setViewportSize({ width: 1440, height: 900 });

  try {
    // Try networkidle first; fall back to domcontentloaded for aggressive anti-bot sites
    try {
      await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });
    } catch {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    }

    // Extra wait for JS-rendered content to settle
    await page.waitForTimeout(2000);

    // Inject a <base> tag so relative assets resolve correctly in the saved HTML
    await page.evaluate((baseUrl) => {
      const base = document.createElement("base");
      base.href = baseUrl;
      document.head.prepend(base);
    }, url);

    const html = await page.content();
    const title = await page.title();

    return { url, html, title };
  } finally {
    await page.close();
  }
}
