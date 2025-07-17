import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

const URL =
  "https://exnode.ru/exchange/tether_trc20_usdt-usdttrc-to-sberbank-sberrub";

puppeteer.use(StealthPlugin());

const fetchRate = async () => {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();

  await page.setViewport({ width: 1366, height: 768 });
  await page.goto(URL, {
    waitUntil: "domcontentloaded",
  });

  await page.waitForSelector("table tbody tr td:nth-child(4)");

  const divsCounts = await page.$$eval(
    "table tbody tr td:nth-child(4)",
    (divs) => divs.map((div) => div.firstChild.textContent)
  );

  console.log(divsCounts[0]);

  await browser.close();
};

setInterval(fetchRate, 30_000);
