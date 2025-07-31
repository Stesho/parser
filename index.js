import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import express from "express";
import fs from "fs/promises";

puppeteer.use(StealthPlugin());

const FILE_PATH = "/app/data/rates.txt";;

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

const urls = [
  {
    pair: ['USDTTRC20', 'SBERRUB'],
    url: "https://exnode.ru/exchange/tether_trc20_usdt-usdttrc-to-sberbank-sberrub",
  },
  {
    pair: ['USDTTRC20', 'TCSBRUB'],
    url: "https://exnode.ru/exchange/tether_trc20_usdt-usdttrc-to-tinkoff-tcsbrub",
  },
  {
    pair: ['BTC', 'SBERRUB'],
    url: "https://exnode.ru/exchange/bitcoin_btc-btc-to-sberbank-sberrub",
  },
  {
    pair: ['BTC', 'SBPRUB'],
    url: "https://exnode.ru/exchange/bitcoin_btc-btc-to-sbprub-sbprub",
  },
  {
    pair: ['USDTTRC20', 'SBPRUB'],
    url: "https://exnode.ru/exchange/tether_trc20_usdt-usdttrc-to-sbprub-sbprub",
  },
  {
    pair: ['USDTBEP20', 'SBERRUB'],
    url: "https://exnode.ru/exchange/tether_bep20_usdt-usdtbep20-to-sberbank-sberrub",
  },
];

let browser;
const pages = [];

async function init() {
  try {
    const proxy = proxyList[Math.floor(Math.random() * proxyList.length)];
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

    for (let i = 0; i < urls.length; i++) {
      const page = await browser.newPage();
      await page.authenticate({ username: user, password: pass });
      await page.setViewport({ width: 1366, height: 768 });
      await page.goto(urls[i].url, { waitUntil: "domcontentloaded", timeout: 60000 });
      pages.push(page);
    }
  } catch(err) {
    console.error(err);
  }
}

async function fetchRate(page, pair) {
  try {
    await page.waitForSelector("table ~ div > div:nth-of-type(2) > div > p:first-of-type");
    await page.waitForSelector("table ~ div div > div > div:nth-of-type(3) > p");

    const names = await page.$$eval("table ~ div > div:nth-of-type(2) > div > p:first-of-type", (tds) => tds.map(tds => tds.textContent.trim()));
    const rates = await page.$$eval("table ~ div div > div > div:nth-of-type(3) > p", (tds) =>
      tds.map((td) => td.firstChild.textContent.trim())
    );

    const bestExchange = names[0];
    let bestRate = rates[0];
    const log = `[${new Date().toLocaleTimeString()}]: ${bestExchange} ${bestRate}`;
    
    if(bestExchange === 'VibeBit') {
      bestRate = rates[1];
    }
    
    const [from, to] = pair;
    const data = [
      `${from} - ${to} : ${bestRate} + 0.0006`,
      `${to} - ${from} : (${from} - ${to})`,
    ].join("\n");

    console.log(log);

    return data;
  } catch(err) {
    console.error(`[ERROR] Ошибка при обработке ${pair.join(' - ')}: ${err.message}`);
    return null;
  }
}

async function scrape() {
  try {
    const result = await Promise.all(pages.map((page, ind) => fetchRate(page, urls[ind].pair)));

    if(result.some((val) => val === null)) {
      return;
    }

    const fileData = result.filter(Boolean).join('\n');

    await fs.writeFile(FILE_PATH, fileData, "utf-8");
  } catch(err) {
    console.log(err);
  }
}

let startTime = Date.now();

async function loop() {
  const elapsed = Date.now() - startTime;

  if (elapsed > 900_000) {
    await Promise.allSettled(pages.map(page => page.reload()));
    startTime = Date.now();
  }

  await scrape();
  setTimeout(loop, 10_000);
}

(async function() {
  await init();
  await loop();
})();

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/rates.txt", (req, res) => {
  res.sendFile(FILE_PATH);
});

app.listen(PORT, () => {
  console.log(`Server start on port ${PORT}`);
});
