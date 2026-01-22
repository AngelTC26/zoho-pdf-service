const express = require("express");

const app = express();
app.use(express.json({ limit: "2mb" }));

app.get("/health", (req, res) => {
  res.status(200).send("ok");
});

// ✅ Nuevo: para probar en navegador
app.get("/echo", (req, res) => {
  res.status(200).send("ok");
});

// ✅ Nuevo: para probar POST desde Zoho Flow
app.post("/echo", (req, res) => {
  res.status(200).json({
    received: true,
    body: req.body,
  });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});
