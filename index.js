import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import express from "express";
import fs from "fs/promises";

puppeteer.use(StealthPlugin());

const FILE_PATH = "/app/data/rates.txt";;
const URL =
  "https://exnode.ru/exchange/tether_trc20_usdt-usdttrc-to-sberbank-sberrub";

const proxyList = [
  "adkgwmfT:uGYhU2yM@45.145.91.110:63538", 
  "adkgwmfT:uGYhU2yM@193.58.170.58:64392", 
  "adkgwmfT:uGYhU2yM@45.128.129.16:62588", 
  "adkgwmfT:uGYhU2yM@92.249.15.219:62810", 
  "adkgwmfT:uGYhU2yM@194.226.112.218:64898", 
  "adkgwmfT:uGYhU2yM@193.232.113.240:63700", 
  "adkgwmfT:uGYhU2yM@194.226.20.233:62258", 
  "adkgwmfT:uGYhU2yM@195.208.82.166:64544", 
  "adkgwmfT:uGYhU2yM@195.208.93.30:64454", 
  "adkgwmfT:uGYhU2yM@154.211.18.212:64408",
];

let currentProxy = 0;
let browser;
let page;

async function init() {
  try {
    const proxy = proxyList[currentProxy];
    const [auth, hostPort] = proxy.split("@");
    const [user, pass] = auth.split(":");
    const [host, port] = hostPort.split(":");

    console.log(`[INFO] Используем прокси: ${host}:${port}`);

    browser = await puppeteer.launch({
      headless: true,
      executablePath: "/usr/bin/google-chrome-stable",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        `--proxy-server=${host}:${port}`,
      ],
    });

    page = await browser.newPage();

    await page.authenticate({ username: user, password: pass });

    await page.setViewport({ width: 1366, height: 768 });
    await page.goto(URL, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
  } catch(err) {
    console.error(err);
  }
}

async function scrape() {
  try {
    await page.reload({ waitUntil: "domcontentloaded" });

    await page.waitForSelector("table tbody tr td:nth-child(4)");
    await page.waitForSelector("table tbody tr td:nth-child(1)");

    const names = await page.$$eval("table tbody tr td:nth-child(1)", (tds) => tds.map(tds => tds.textContent.trim()));
    const rates = await page.$$eval("table tbody tr td:nth-child(4)", (tds) =>
      tds.map((td) => td.firstChild.textContent.trim())
    );

    const bestExchange = names[0];
    let bestRate = rates[0];
    const log = `[${new Date().toLocaleTimeString()}]: ${bestExchange} ${bestRate}`;
    
    if(bestExchange === 'VibeBit') {
      bestRate = rates[1];
    }
    
    const data = [
      `USDTTRC20 - SBERRUB : ${bestRate} + 0.0006`,
      `SBERRUB - USDTTRC20 : (USDTTRC20 - SBERRUB)`,
    ].join("\n");

    console.log(log);

    await fs.writeFile(FILE_PATH, data, "utf-8");
  } catch(err) {
    console.log(err);
  }
}

(async function() {
  await init();
  (async function loop() {
    await scrape();
    setTimeout(loop, 20_000);
  })();
})();

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/rates.txt", (req, res) => {
  res.sendFile(FILE_PATH);
});

app.listen(PORT, () => {
  console.log(`Server start on port ${PORT}`);
});
