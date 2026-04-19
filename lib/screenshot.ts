import puppeteer from "puppeteer";

export async function fullPageScreenshot(html: string): Promise<Buffer> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: "networkidle0", timeout: 30000 });
    const buf = (await page.screenshot({
      fullPage: true,
      type: "png",
    })) as Buffer;
    return buf;
  } finally {
    await browser.close();
  }
}
