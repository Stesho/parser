import puppeteerCore from "puppeteer";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import express from "express";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

puppeteer.use(StealthPlugin());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FILE_PATH = path.join(__dirname, "rates.txt");
const URL =
  "https://exnode.ru/exchange/tether_trc20_usdt-usdttrc-to-sberbank-sberrub";

const fetchRate = async () => {
  const browser = await puppeteer.launch({
    executablePath: "/usr/bin/google-chrome-stable",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();

  await page.setViewport({ width: 1366, height: 768 });
  await page.goto(URL, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });

  await page.waitForSelector("table tbody tr td:nth-child(4)");

  const rates = await page.$$eval("table tbody tr td:nth-child(4)", (tds) =>
    tds.map((td) => td.firstChild.textContent)
  );

  const bestRate = rates[0];
  const log = `[${new Date().toLocaleTimeString()}]: ${bestRate}`;
  const data = [
    `USDTTRC20 - SBERRUB : ${bestRate} + 0.001`,
    `SBERRUB - USDTTRC20 : (USDTTRC20 - SBERRUB)`,
  ].join("\n");

  console.log(log);

  await fs.writeFile(FILE_PATH, data, "utf-8");
  await browser.close();
};

(async () => {
  await fetchRate();
  setInterval(fetchRate, 60_000);
})();

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/rates.txt", (req, res) => {
  res.sendFile(FILE_PATH);
});

app.listen(PORT, () => {
  console.log(`Server start on port ${PORT}`);
});
