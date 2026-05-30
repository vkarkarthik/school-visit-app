import puppeteer from "puppeteer";
import { existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const serviceDir = dirname(fileURLToPath(import.meta.url));
const backendDir = join(serviceDir, "../..");
const renderCacheDir = join(backendDir, ".cache/puppeteer");

export async function generatePdfBuffer(html) {
  if (existsSync(renderCacheDir)) {
    process.env.PUPPETEER_CACHE_DIR = renderCacheDir;
  }

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });

    await page.evaluate(async () => {
      const images = Array.from(document.images);
      await Promise.all(
        images.map((img) => {
          if (img.complete) return Promise.resolve();
          return new Promise((resolve) => {
            img.onload = resolve;
            img.onerror = resolve;
          });
        })
      );
    });

    return await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "20mm", right: "12mm", bottom: "20mm", left: "12mm" }
    });
  } finally {
    await browser.close();
  }
}
