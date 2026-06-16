const express = require('express');
const { QDII_ETF_POOL } = require('../services/etfPool');
const { getAiAnalysis, getEtfQuotes, getUsClose, getUsFutures, getUsNews } = require('../services/dataProxy');

const router = express.Router();

router.get('/us-market', async (req, res) => {
  try {
    const [close, futures, news, aiAnalysis, etfQuotes] = await Promise.all([
      getUsClose(),
      getUsFutures(),
      getUsNews(),
      getAiAnalysis(),
      getEtfQuotes(QDII_ETF_POOL.map((item) => item.symbol))
    ]);

    res.json({
      close,
      futures,
      news,
      aiAnalysis,
      etfQuotes,
      etfPool: QDII_ETF_POOL,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/etf-pool', (req, res) => {
  res.json({ data: QDII_ETF_POOL });
});

module.exports = router;
