import { Browser } from "playwright";

export interface ScrapedPage {
  url: string;
  html: string;
  title: string;
}

export async function scrapePage(browser: Browser, url: string): Promise<ScrapedPage> {
  const page = await browser.newPage();
  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });

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
