FROM ghcr.io/puppeteer/puppeteer:22.6.4

WORKDIR /app

COPY package*.json ./

USER root
RUN npm install

COPY . .

CMD ["node", "index.js"]
