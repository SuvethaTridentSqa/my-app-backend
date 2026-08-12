const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const { authenticate } = require("../middleware/auth");

const router = express.Router();

router.post("/links", authenticate, async (req, res) => {
  try {
    const { targetUrl } = req.body;

    if (!targetUrl) {
      return res.status(400).json({
        message: "Target URL is required.",
      });
    }

    const response = await axios.get(targetUrl);

    const $ = cheerio.load(response.data);

    const connections = [];

    $("a[href]").each((_, element) => {
      const href = $(element).attr("href");

      if (!href) return;

      try {
        const absolute = new URL(href, targetUrl).href;

        connections.push({
          source: targetUrl,
          target: absolute,
        });
      } catch {}
    });

    res.json({
      connections,
    });
  } catch (error) {
    res.status(500).json({
      message: "Unable to crawl URL",
      error: error.message,
    });
  }
});

module.exports = router;
