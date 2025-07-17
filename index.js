import puppeteer from "puppeteer";

const fetchRate = async () => {
  const url =
    "https://exnode.ru/exchange/tether_trc20_usdt-usdttrc-to-sberbank-sberrub";

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
  );
  await page.setViewport({ width: 1366, height: 768 });
  await page.goto(url, {
    waitUntil: ["domcontentloaded"],
  });

  await page.screenshot({ path: "debug.png", fullPage: true });

  await page.waitForSelector("table tbody tr td:nth-child(4)");

  const divsCounts = await page.$$eval(
    "table tbody tr td:nth-child(4)",
    (divs) => divs.map((div) => div.firstChild.textContent)
  );
  console.log("Собранные данные о курсах:");
  console.log(divsCounts[0]);

  await browser.close();
};

(async () => {
  await fetchRate();
})();
