const express = require("express");
const puppeteer = require("puppeteer");
const crypto = require("crypto");

const app = express();
app.use(express.json({ limit: "5mb" }));

app.get("/health", (req, res) => {
  res.status(200).send("ok");
});

app.get("/echo", (req, res) => {
  res.status(200).send("ok");
});

app.post("/echo", (req, res) => {
  res.status(200).json({
    received: true,
    body: req.body,
  });
});

// HTML -> PDF (base64)
app.post("/pdf", async (req, res) => {
  try {
    const { html } = req.body || {};
    if (!html || typeof html !== "string") {
      return res.status(400).json({
        ok: false,
        error: "Missing 'html' string in request body",
      });
    }

    const browser = await puppeteer.launch({
      headless: "new",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "12mm", right: "12mm", bottom: "12mm", left: "12mm" },
    });

    await browser.close();

    return res.status(200).json({
      ok: true,
      pdf_base64: pdfBuffer.toString("base64"),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      ok: false,
      error: "PDF generation failed",
      details: String(err?.message || err),
    });
  }
});

// Test PDF inline
app.get("/pdf/test", async (req, res) => {
  const html = `
  <html>
    <body style="font-family: Arial; padding: 24px;">
      <h2>PDF Test</h2>
      <p>Si ves esto en PDF, Puppeteer está OK.</p>
    </body>
  </html>`;

  try {
    const browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
    });

    await browser.close();

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "inline; filename=test.pdf");
    return res.status(200).send(pdfBuffer);
  } catch (err) {
    return res
      .status(500)
      .json({ ok: false, error: String(err?.message || err) });
  }
});

// ✅ storage temporal en memoria (se pierde si Render reinicia/duerme)
const pdfStore = new Map(); // id -> { buffer, expiresAt }
const TTL_MS = 10 * 60 * 1000; // 10 minutos

setInterval(() => {
  const now = Date.now();
  for (const [id, item] of pdfStore.entries()) {
    if (item.expiresAt <= now) pdfStore.delete(id);
  }
}, 60 * 1000);

// Recibe HTML, genera PDF, guarda temporalmente y devuelve URL
app.post("/pdf/url", async (req, res) => {
  try {
    const { html } = req.body || {};
    if (!html || typeof html !== "string") {
      return res.status(400).json({ ok: false, error: "Missing 'html' string" });
    }

    const browser = await puppeteer.launch({
      headless: "new",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "12mm", right: "12mm", bottom: "12mm", left: "12mm" },
    });

    await browser.close();

    const id = crypto.randomUUID();
    pdfStore.set(id, { buffer: pdfBuffer, expiresAt: Date.now() + TTL_MS });

    const baseUrl = `${req.protocol}://${req.get("host")}`;
    return res.status(200).json({
      ok: true,
      pdf_url: `${baseUrl}/pdf/${id}`,
      expires_in_seconds: Math.floor(TTL_MS / 1000),
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "PDF generation failed",
      details: String(err?.message || err),
    });
  }
});

// Devuelve el PDF inline por ID
app.get("/pdf/:id", (req, res) => {
  const { id } = req.params;
  const item = pdfStore.get(id);

  if (!item) {
    return res.status(404).send("PDF not found (expired or invalid id)");
  }

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", 'inline; filename="documento.pdf"');
  return res.status(200).send(item.buffer);
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});
