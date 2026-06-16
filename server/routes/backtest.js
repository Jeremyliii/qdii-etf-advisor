const express = require('express');
const { QDII_ETF_POOL } = require('../services/etfPool');
const { runPredictionBacktest } = require('../services/backtestEngine');
const { getEtfKlineBatch, getUsHistory } = require('../services/dataProxy');

const router = express.Router();

const RANGE_TO_DAYS = { '7d': 7, '14d': 14, '30d': 30, '60d': 60, '1m': 30, '3m': 60, '6m': 60, '1y': 60, '3y': 60 };

function uniqueHistoryTickers() {
  return [...new Set([
    'NDX',
    'VIX',
    ...QDII_ETF_POOL.flatMap((item) => item.linkedTickers || [])
  ])];
}

router.post('/backtest', async (req, res) => {
  try {
    const range = req.body.range || `${req.body.days || 30}d`;
    const days = Number(req.body.days || RANGE_TO_DAYS[range] || 30);
    const historyDays = Math.max(100, days + 90);
    const symbols = [...QDII_ETF_POOL.map((item) => item.symbol), '510300'];
    const tickers = uniqueHistoryTickers();
    const [etfKlineMap, historyResults] = await Promise.all([
      getEtfKlineBatch(symbols, historyDays),
      Promise.allSettled(tickers.map(async (ticker) => [ticker, await getUsHistory(ticker, historyDays)]))
    ]);
    const usHistoryMap = Object.fromEntries(
      historyResults
        .filter((item) => item.status === 'fulfilled')
        .map((item) => item.value)
    );
    const result = runPredictionBacktest(etfKlineMap, usHistoryMap, {
      days,
      range,
      etfPool: QDII_ETF_POOL,
      aShareSentiment: etfKlineMap['510300'] || [],
      applySectorReliabilityFilter: false,
      sectorReliabilityThreshold: 55
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
