import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import fs from "fs/promises";
import minimist from 'minimist';

puppeteer.use(StealthPlugin());

const args = minimist(process.argv.slice(2));

const URL = args.url;
const FILE_PATH = `/app/data/${args.file}`;
const PAIR = args.pair.split('-') || ['USDTTRC20', 'SBERRUB'];
const PROXY_LIST = args.proxies.split(",");

let browser;
let page;
let currentProxyIndex = 0;

const getNextProxy = () => {
  const proxy = PROXY_LIST[currentProxyIndex % PROXY_LIST.length];
  currentProxyIndex++;
  return proxy;
};

async function init() {
  try {
    if(browser) {
      await browser.close();
    }

    const proxy = getNextProxy();
    const [auth, hostPort] = proxy.split("@");
    const [user, pass] = auth.split(":");
    const [host, port] = hostPort.split(":");

    console.log(`[INFO] Используем прокси: ${host}:${port}`);

    browser = await puppeteer.launch({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
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
    await init();
  }
}

async function scrape() {
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

    console.log(log);

    if(bestRate === '0') {
      return;
    }
    
    if(bestExchange === 'VibeBit') {
      bestRate = rates[1];
    }
    
    if(+bestRate > 86) {
      return;
    }

    const [from, to] = PAIR;
    const data = [
      `${from} - ${to} : ${bestRate} + 0.0006`,
      `${to} - ${from} : (${from} - ${to})`,
    ].join("\n");

    await fs.writeFile(FILE_PATH, data, "utf-8");
  } catch(err) {
    console.log(err);
    await page.reload({ waitUntil: "domcontentloaded" });
  }
}

let startTime = Date.now();

async function loop() {
  const elapsed = Date.now() - startTime;

  if (elapsed > 900_000) {
    await init();
    startTime = Date.now();
  }

  await scrape();
  setTimeout(loop, 10_000);
}

(async function() {
  await init();
  await loop();
})();
