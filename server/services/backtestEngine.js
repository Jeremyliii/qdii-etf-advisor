const { calcRSI, calcSMA, calcMACD } = require('./indicators');
const {
  calcDirectionScore,
  calcOpportunityScore,
  directionFromScore,
  generateAction,
  labelConfidence
} = require('./scoringModel');

const MAX_SIGNAL_GAP_DAYS = 7;

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function changePct(prev, current) {
  return prev ? ((current - prev) / prev) * 100 : 0;
}

function mean(values) {
  const clean = values.map(Number).filter(Number.isFinite);
  return clean.length ? clean.reduce((sum, value) => sum + value, 0) / clean.length : 0;
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(Number(value || 0) * factor) / factor;
}

function dateGapDays(laterDate, earlierDate) {
  const later = new Date(`${laterDate}T00:00:00Z`).getTime();
  const earlier = new Date(`${earlierDate}T00:00:00Z`).getTime();
  if (!Number.isFinite(later) || !Number.isFinite(earlier)) return Infinity;
  return Math.round((later - earlier) / 86_400_000);
}

function scoreTechnical(kline, index) {
  const start = Math.max(0, index - 60);
  const closes = kline.slice(start, index + 1).map((item) => Number(item.close)).filter(Number.isFinite);
  if (closes.length < 30) return { score: 0, rsi: 50, trend: '数据不足' };

  const rsi = calcRSI(closes, 14).at(-1) || 50;
  const ma5 = calcSMA(closes, 5).at(-1);
  const ma20 = calcSMA(closes, 20).at(-1);
  const macd = calcMACD(closes);

  let score = 0;
  if (rsi < 30) score += 10;
  else if (rsi > 70) score -= 10;
  else score += (50 - rsi) * 0.15;
  if (ma5 && ma20) score += ma5 > ma20 ? 5 : -5;
  score += (macd.histogram.at(-1) || 0) > 0 ? 4 : -4;

  return { score, rsi: Math.round(rsi), trend: ma5 > ma20 ? '短期上行' : '短期承压' };
}

function normalizeHistory(history = []) {
  const sorted = [...history]
    .filter((item) => item?.date && Number.isFinite(Number(item.close)))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  let previousClose = null;
  return sorted.map((item) => {
    const close = Number(item.close);
    const rawChange = Number(item.change_pct);
    const change_pct = Number.isFinite(rawChange)
      ? rawChange
      : previousClose
        ? changePct(previousClose, close)
        : 0;
    previousClose = close;
    return { ...item, close, change_pct };
  });
}

function findPrevHistoryItem(history = [], date) {
  let result = null;
  for (const item of history) {
    if (!item?.date) continue;
    if (item.date < date) result = item;
    else break;
  }
  return result;
}

function firstNonEmpty(...histories) {
  return histories.find((history) => Array.isArray(history) && history.length) || [];
}

function linkedChangeForDate(etf, usHistoryMap, date) {
  const values = [];
  const sources = [];
  for (const ticker of etf.linkedTickers || []) {
    const item = findPrevHistoryItem(usHistoryMap[ticker] || [], date);
    if (item && dateGapDays(date, item.date) > MAX_SIGNAL_GAP_DAYS) continue;
    if (item && Number.isFinite(Number(item.change_pct))) {
      values.push(Number(item.change_pct));
      sources.push({ ticker, date: item.date, change_pct: round(item.change_pct) });
    }
  }
  return {
    value: values.length ? mean(values) : null,
    sources
  };
}

function premiumForKnownDate(etf, kline, knownIndex, usHistoryMap) {
  if (knownIndex <= 0) return 0;
  const known = kline[knownIndex];
  const linked = linkedChangeForDate(etf, usHistoryMap, known.date);
  if (linked.value === null) return 0;
  const etfChange = changePct(kline[knownIndex - 1]?.close, known.close);
  return etfChange - linked.value;
}

function normalizeAshareSentiment(kline = []) {
  const sorted = [...kline]
    .filter((item) => item?.date && Number.isFinite(Number(item.close)))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  let prevClose = null;
  return sorted.map((item) => {
    const close = Number(item.close);
    const rawChange = Number(item.change_pct);
    const change_pct = Number.isFinite(rawChange)
      ? rawChange
      : prevClose
        ? changePct(prevClose, close)
        : 0;
    prevClose = close;
    return { ...item, close, change_pct };
  });
}

function aShareSentimentForDate(history = [], date) {
  const item = findPrevHistoryItem(history, date);
  return Number(item?.change_pct || 0);
}

function calcHistoricalScore(etf, kline, index, usHistoryMap) {
  const target = kline[index];
  const knownIndex = index - 1;
  const linked = linkedChangeForDate(etf, usHistoryMap, target.date);

  const linkedChange = linked.value ?? 0;
  const technical = scoreTechnical(kline, knownIndex);
  const estimatedPremium = premiumForKnownDate(etf, kline, knownIndex, usHistoryMap);
  const vix = findPrevHistoryItem(firstNonEmpty(usHistoryMap.VIX, usHistoryMap['^VIX']), target.date);
  const vixClose = Number(vix?.close || 20);
  const aShareChange = aShareSentimentForDate(calcHistoricalScore.aShareSentiment || [], target.date);
  const historyUsData = { VIX: { close: vixClose } };
  const knownKline = kline.slice(0, knownIndex + 1);
  const direction = calcDirectionScore({
    linkedChange,
    linkedCount: linked.sources.length,
    usData: historyUsData,
    aShareSentiment: aShareChange,
    etf
  });
  const opportunity = calcOpportunityScore({
    linkedChange,
    kline: knownKline,
    premium: estimatedPremium,
    usData: historyUsData
  });
  const actionInfo = generateAction(direction.score, opportunity.score);

  return {
    score: opportunity.score,
    directionScore: direction.score,
    direction: direction.direction,
    opportunityScore: opportunity.score,
    opportunityDetails: opportunity.details,
    action: actionInfo.action,
    actionLabel: actionInfo.label,
    linkedChange: round(linkedChange),
    linkedCount: linked.sources.length,
    estimatedPremium: round(estimatedPremium),
    technical,
    aShareSentiment: round(aShareChange),
    reasons: [...new Set([actionInfo.reason, ...opportunity.reasons, ...direction.reasons])].filter(Boolean).slice(0, 5),
    usSignalDate: linked.sources.map((item) => item.date).sort().at(-1) || null,
    linkedSources: linked.sources,
    componentScores: {
      direction: direction.score,
      opportunity: opportunity.score
    }
  };
}

function scoreRangeFor(score) {
  if (score >= 65) return '>=65';
  if (score >= 58) return '58-64';
  if (score >= 50) return '50-57';
  if (score >= 42) return '42-49';
  if (score >= 35) return '35-41';
  return '<35';
}

function calcPredictionStats(predictions) {
  const total = predictions.length;
  const correct = predictions.filter((item) => item.correct).length;
  const predictUpList = predictions.filter((item) => item.predictDirection === 'up');
  const predictDownList = predictions.filter((item) => item.predictDirection === 'down');
  const truePositive = predictUpList.filter((item) => item.actualDirection === 'up').length;
  const falsePositive = predictUpList.filter((item) => item.actualDirection === 'down').length;
  const trueNegative = predictDownList.filter((item) => item.actualDirection === 'down').length;
  const falseNegative = predictDownList.filter((item) => item.actualDirection === 'up').length;
  const buyOnPredict = predictUpList.map((item) => item.actualChange);
  const avgReturn = buyOnPredict.length ? mean(buyOnPredict) : 0;
  const cumReturn = buyOnPredict.reduce((value, change) => value * (1 + change / 100), 1) - 1;

  const bySector = new Map();
  const byScoreRange = new Map([
    ['>=65', { range: '>=65', predictions: [] }],
    ['58-64', { range: '58-64', predictions: [] }],
    ['50-57', { range: '50-57', predictions: [] }],
    ['42-49', { range: '42-49', predictions: [] }],
    ['35-41', { range: '35-41', predictions: [] }],
    ['<35', { range: '<35', predictions: [] }]
  ]);

  for (const item of predictions) {
    if (!bySector.has(item.sector)) {
      bySector.set(item.sector, { sector: item.sector, name: item.tracking || item.sector, total: 0, correct: 0 });
    }
    const sector = bySector.get(item.sector);
    sector.total += 1;
    if (item.correct) sector.correct += 1;
    byScoreRange.get(scoreRangeFor(item.score))?.predictions.push(item);
  }

  const finishGroup = (group) => ({
    ...group,
    accuracy: group.total ? round((group.correct / group.total) * 100, 1) : 0
  });

  return {
    total,
    correct,
    accuracy: total ? round((correct / total) * 100, 1) : 0,
    truePositive,
    falsePositive,
    trueNegative,
    falseNegative,
    upPrecision: predictUpList.length ? round((truePositive / predictUpList.length) * 100, 1) : 0,
    downPrecision: predictDownList.length ? round((trueNegative / predictDownList.length) * 100, 1) : 0,
    avgReturn: round(avgReturn, 2),
    cumReturn: round(cumReturn * 100, 2),
    bySector: [...bySector.values()].map(finishGroup).sort((a, b) => b.accuracy - a.accuracy),
    byScoreRange: [...byScoreRange.values()].map((group) => {
      const totalInRange = group.predictions.length;
      const correctInRange = group.predictions.filter((item) => item.correct).length;
      return {
        range: group.range,
        total: totalInRange,
        correct: correctInRange,
        accuracy: totalInRange ? round((correctInRange / totalInRange) * 100, 1) : 0
      };
    }),
    recentPredictions: predictions.slice(-60).reverse()
  };
}

function summarizeActionStats(actionSamples) {
  const labels = {
    strong_buy: '强烈买入',
    buy_dip: '逢低买入',
    no_chase: '不追高',
    avoid: '回避',
    accumulate: '可以建仓',
    hold: '观望'
  };
  return Object.entries(labels).map(([action, label]) => {
    const items = actionSamples.filter((item) => item.action === action);
    const returns = items.map((item) => item.returnIfBuy).filter(Number.isFinite);
    const avgReturn = returns.length ? mean(returns) : 0;
    return {
      action,
      label,
      count: items.length,
      avgReturn: round(avgReturn, 2),
      winRate: returns.length ? round((returns.filter((value) => value > 0).length / returns.length) * 100, 1) : 0,
      maxReturn: returns.length ? round(Math.max(...returns), 2) : 0,
      maxLoss: returns.length ? round(Math.min(...returns), 2) : 0
    };
  });
}

function runPredictionBacktest(etfKlineMap, usHistoryMap, config = {}) {
  const days = Number(config.days || 30);
  const etfPool = config.etfPool || [];
  const applySectorReliabilityFilter = Boolean(config.applySectorReliabilityFilter);
  const sectorReliabilityThreshold = Number(config.sectorReliabilityThreshold || 55);
  const normalizedUsHistoryMap = Object.fromEntries(
    Object.entries(usHistoryMap || {}).map(([ticker, history]) => [ticker, normalizeHistory(history)])
  );
  const predictions = [];
  const allPredictions = [];
  const actionSamples = [];
  calcHistoricalScore.aShareSentiment = normalizeAshareSentiment(config.aShareSentiment || []);

  for (const etf of etfPool) {
    const kline = (etfKlineMap[etf.symbol] || [])
      .filter((item) => item?.date && Number.isFinite(Number(item.close)))
      .sort((a, b) => String(a.date).localeCompare(String(b.date)));
    if (kline.length < 65) continue;

    const start = Math.max(61, kline.length - days);
    for (let i = start; i < kline.length; i += 1) {
      const today = kline[i];
      const yesterday = kline[i - 1];
      if (!today?.close || !yesterday?.close) continue;

      const signal = calcHistoricalScore(etf, kline, i, normalizedUsHistoryMap);
      const predictionDirection = signal.direction;
      const statsDirection = predictionDirection === 'neutral' ? directionFromScore(signal.directionScore) : predictionDirection;
      const confidence = signal.directionScore >= 65 || signal.directionScore <= 35
        ? 'high'
        : signal.directionScore >= 55 || signal.directionScore <= 45
          ? 'medium'
          : 'low';
      const predictUp = predictionDirection === 'up';
      const statsPredictUp = statsDirection === 'up';

      const actualChange = changePct(yesterday.close, today.close);
      const actualUp = actualChange > 0;
      const confidenceInfo = labelConfidence({
        score: signal.directionScore,
        linkedChange: signal.linkedChange,
        techConfirmed: true
      });
      const confidenceLabels = confidence === 'low'
        ? ['⚠️ 低置信度', '仅供参考，不建议操作', ...confidenceInfo.labels]
        : confidenceInfo.labels;
      const buyOpen = Number(today.open || today.close);
      const exitItem = kline[Math.min(i + 3, kline.length - 1)];
      const exitClose = Number(exitItem?.close || today.close);
      const returnIfBuy = buyOpen ? changePct(buyOpen, exitClose) : 0;
      actionSamples.push({
        date: today.date,
        symbol: etf.symbol,
        name: etf.name,
        action: signal.action,
        returnIfBuy: round(returnIfBuy),
        directionScore: signal.directionScore,
        opportunityScore: signal.opportunityScore
      });
      const basePrediction = {
        date: today.date,
        usSignalDate: signal.usSignalDate,
        symbol: etf.symbol,
        name: etf.name,
        tracking: etf.tracking,
        sector: etf.sector,
        score: signal.directionScore,
        directionScore: signal.directionScore,
        opportunityScore: signal.opportunityScore,
        action: signal.action,
        actionLabel: signal.actionLabel,
        predictDirection: predictionDirection,
        confidence,
        actualDirection: actualUp ? 'up' : 'down',
        actualChange: round(actualChange),
        linkedChange: signal.linkedChange,
        linkedCount: signal.linkedCount,
        estimatedPremium: signal.estimatedPremium,
        aShareSentiment: signal.aShareSentiment,
        reasons: signal.reasons,
        confidenceLabels: [...new Set(confidenceLabels)],
        componentScores: signal.componentScores,
        correct: (predictUp && actualUp) || (!predictUp && !actualUp)
      };
      if (predictionDirection !== 'neutral') {
        predictions.push(basePrediction);
      }
      allPredictions.push({
        ...basePrediction,
        predictDirection: statsDirection,
        confidence: predictionDirection === 'neutral' ? 'low' : confidence,
        correct: (statsPredictUp && actualUp) || (!statsPredictUp && !actualUp)
      });
    }
  }

  predictions.sort((a, b) => `${a.date}-${a.symbol}`.localeCompare(`${b.date}-${b.symbol}`));
  allPredictions.sort((a, b) => `${a.date}-${a.symbol}`.localeCompare(`${b.date}-${b.symbol}`));
  const rawStats = calcPredictionStats(predictions);
  const allStats = calcPredictionStats(allPredictions);
  const reliableSectors = new Set(
    (rawStats.bySector || [])
      .filter((item) => item.accuracy >= sectorReliabilityThreshold)
      .map((item) => item.sector)
  );
  const finalPredictions = applySectorReliabilityFilter
    ? predictions.filter((item) => reliableSectors.has(item.sector))
    : predictions;
  const skippedSectors = applySectorReliabilityFilter
    ? (rawStats.bySector || []).filter((item) => !reliableSectors.has(item.sector))
    : [];

  return {
    days,
    generatedAt: new Date().toISOString(),
    stats: calcPredictionStats(finalPredictions),
    rawStats,
    allStats,
    lowConfidenceImpact: {
      total: allStats.total - rawStats.total,
      correct: allStats.correct - rawStats.correct,
      accuracy: allStats.total - rawStats.total
        ? round(((allStats.correct - rawStats.correct) / (allStats.total - rawStats.total)) * 100, 1)
        : 0
    },
    actionStats: summarizeActionStats(actionSamples),
    actionSamples: actionSamples.slice(-120).reverse(),
    reliabilityFilter: {
      enabled: applySectorReliabilityFilter,
      threshold: sectorReliabilityThreshold,
      skippedSectors
    }
  };
}

module.exports = { runPredictionBacktest };
