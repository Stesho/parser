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

const proxyList = [
  "bn8GSgVk:2LgriTmQ@45.146.169.134:63804",
  "bn8GSgVk:2LgriTmQ@45.140.63.125:62674",
  "bn8GSgVk:2LgriTmQ@212.193.102.160:62290",
  "bn8GSgVk:2LgriTmQ@195.209.135.131:64670",
  "bn8GSgVk:2LgriTmQ@213.226.102.212:63770",
  "bn8GSgVk:2LgriTmQ@91.188.228.152:62464",
  "bn8GSgVk:2LgriTmQ@176.103.92.217:62166",
  "bn8GSgVk:2LgriTmQ@176.103.93.92:61736",
  "bn8GSgVk:2LgriTmQ@195.19.173.124:63294",
  "bn8GSgVk:2LgriTmQ@85.143.51.109:62450",
];

async function fetchRate() {
  try {
    const proxy = proxyList[Math.floor(Math.random() * proxyList.length)];
    const [auth, hostPort] = proxy.split("@");
    const [user, pass] = auth.split(":");
    const [host, port] = hostPort.split(":");

    console.log(`[INFO] Используем прокси: ${host}:${port}`);

    const browser = await puppeteer.launch({
      headless: true,
      executablePath: "/usr/bin/google-chrome-stable",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        `--proxy-server=${host}:${port}`,
      ],
    });

    const page = await browser.newPage();

    await page.authenticate({ username: user, password: pass });

    await page.setViewport({ width: 1366, height: 768 });
    await page.goto(URL, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    await page.waitForSelector("table tbody tr td:nth-child(4)");

    const rates = await page.$$eval("table tbody tr td:nth-child(4)", (tds) =>
      tds.map((td) => td.firstChild.textContent.trim())
    );

    const bestRate = rates[0];
    const log = `[${new Date().toLocaleTimeString()}]: ${bestRate}`;
    const data = [
      `USDTTRC20 - SBERRUB : ${bestRate} + 0.0006`,
      `SBERRUB - USDTTRC20 : (USDTTRC20 - SBERRUB)`,
    ].join("\n");

    console.log(log);

    await fs.writeFile(FILE_PATH, data, "utf-8");
    await browser.close();
  } catch(err) {
    console.error(err);
  }
}

(async function loop() {
  await fetchRate();
  setTimeout(loop, 1_000);
})();

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/rates.txt", (req, res) => {
  res.sendFile(FILE_PATH);
});

app.listen(PORT, () => {
  console.log(`Server start on port ${PORT}`);
});
