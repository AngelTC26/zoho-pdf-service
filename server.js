const express = require("express");
const puppeteer = require("puppeteer");

const app = express();
app.use(express.json({ limit: "5mb" })); // subimos límite por el HTML

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

// ✅ Nuevo: HTML -> PDF (base64)
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

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});
