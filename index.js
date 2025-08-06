import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import fs from "fs/promises";
import minimist from 'minimist';

puppeteer.use(StealthPlugin());

const args = minimist(process.argv.slice(2));

const URL = args.url;
const FILE_PATH = `/app/data/${args.file}`;
const PAIR = args.pair.split('-') || ['USDTTRC20', 'SBERRUB'];
const PROXY = '1xoy4ol61ks6oi08pdot1gn:RNW78Fm5@fast.froxy.com:10000';

let browser;
let page;
let zeroCount = 0;
let startTime = Date.now();

async function init() {
  try {
    if(browser) {
      await browser.close();
    }

    const [auth, hostPort] = PROXY.split("@");
    const [user, pass] = auth.split(":");
    const [host, port] = hostPort.split(":");

    console.log(`[INFO] Reload browser`);

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

    if(zeroCount > 4) {
      zeroCount = 0;
      await page.reload({ waitUntil: 'domcontentloaded' });
      return;
    }

    if(bestRate === '0') {
      zeroCount++;
      return;
    }
    
    if(bestExchange === 'VibeBit') {
      bestRate = rates[1];
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
