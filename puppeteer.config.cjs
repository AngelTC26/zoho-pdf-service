const { join } = require("path");

/** @type {import("puppeteer").Configuration} */
module.exports = {
  // Guarda/lee Chrome desde una carpeta que sí queda en el deploy
  cacheDirectory: join(__dirname, "node_modules", ".puppeteer_cache"),
};
