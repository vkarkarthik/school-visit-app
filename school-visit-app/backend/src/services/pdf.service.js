import puppeteer from "puppeteer";

export async function generatePdfBuffer(html) {
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