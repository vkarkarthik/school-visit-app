import { existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const serviceDir = dirname(fileURLToPath(import.meta.url));
const backendDir = join(serviceDir, "../..");
const renderCacheDir = join(backendDir, ".cache/puppeteer");
const PDF_PAGE_TIMEOUT_MS = 15000;
const IMAGE_WAIT_TIMEOUT_MS = 5000;

export async function generatePdfBuffer(html) {
  if (existsSync(renderCacheDir)) {
    process.env.PUPPETEER_CACHE_DIR = renderCacheDir;
  }

  const { default: puppeteer } = await import("puppeteer");

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  try {
    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(PDF_PAGE_TIMEOUT_MS);
    page.setDefaultTimeout(PDF_PAGE_TIMEOUT_MS);

    await page.setContent(html, { waitUntil: "domcontentloaded", timeout: PDF_PAGE_TIMEOUT_MS });

    await page.evaluate(async (imageWaitTimeoutMs) => {
      const images = Array.from(document.images);
      await Promise.all(
        images.map((img) => {
          if (img.complete) return Promise.resolve();
          return Promise.race([
            new Promise((resolve) => {
              img.onload = resolve;
              img.onerror = resolve;
            }),
            new Promise((resolve) => setTimeout(resolve, imageWaitTimeoutMs)),
          ]);
        })
      );
    }, IMAGE_WAIT_TIMEOUT_MS);

    return await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "20mm", right: "12mm", bottom: "20mm", left: "12mm" }
    });
  } finally {
    await browser.close();
  }
}
