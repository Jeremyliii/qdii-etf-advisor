const fs = require('fs');
const path = require('path');
const { calcMACD, calcRSI, calcSMA } = require('./indicators');

const STORE_PATH = path.join(__dirname, '..', 'data', 'us-prediction-cache.json');

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(Number(value || 0) * factor) / factor;
}

function confidenceLabel(confidence) {
  if (confidence === 'high') return '高';
  if (confidence === 'low') return '低';
  return '中';
}

function ensureSorted(kline = []) {
  return [...kline]
    .filter((item) => Number.isFinite(Number(item.close)))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

function analyzeUSTechnicals(usHistoryMap = {}) {
  const results = {};
  for (const [ticker, raw] of Object.entries(usHistoryMap)) {
    const kline = ensureSorted(raw);
    if (kline.length < 60) continue;
    const closes = kline.map((item) => Number(item.close));
    let score = 50;

    const rsiValues = calcRSI(closes, 14);
    const currentRSI = rsiValues.at(-1) || 50;
    if (currentRSI < 30) score += 10;
    else if (currentRSI < 40) score += 5;
    else if (currentRSI > 70) score -= 10;
    else if (currentRSI > 60) score -= 5;

    const ma5 = calcSMA(closes, 5).at(-1);
    const ma20 = calcSMA(closes, 20).at(-1);
    const ma50 = calcSMA(closes, 50).at(-1);
    const latest = closes.at(-1);
    if (ma5 > ma20 && ma20 > ma50) score += 6;
    if (ma5 < ma20 && ma20 < ma50) score -= 6;

    let streak = 0;
    for (let i = closes.length - 1; i > 0; i -= 1) {
      if (closes[i] > closes[i - 1]) {
        if (streak >= 0) streak += 1;
        else break;
      } else if (closes[i] < closes[i - 1]) {
        if (streak <= 0) streak -= 1;
        else break;
      } else break;
    }
    if (streak >= 5) score -= 8;
    else if (streak >= 3) score -= 4;
    if (streak <= -5) score += 8;
    else if (streak <= -3) score += 4;

    const distMA20 = ma20 ? ((latest - ma20) / ma20) * 100 : 0;
    if (distMA20 > 5) score -= 5;
    if (distMA20 < -5) score += 5;

    const macd = calcMACD(closes, 12, 26, 9);
    const histCurrent = macd.histogram.at(-1) || 0;
    const histPrev = macd.histogram.at(-2) || 0;
    if (histCurrent > histPrev) score += 3;
    if (histCurrent < histPrev) score -= 3;

    const ma20Series = calcSMA(closes, 20);
    const last20 = closes.slice(-20);
    const mean = ma20Series.at(-1);
    const variance = last20.reduce((sum, value) => sum + (value - mean) ** 2, 0) / Math.max(1, last20.length);
    const sd = Math.sqrt(variance);
    if (latest < mean - sd * 2) score += 6;
    if (latest > mean + sd * 2) score -= 6;

    results[ticker] = {
      score: clamp(round(score), 0, 100),
      rsi: round(currentRSI, 1),
      streak,
      distMA20: round(distMA20, 2),
      macdTrend: histCurrent > histPrev ? 'improving' : 'weakening',
      latestClose: latest,
      date: kline.at(-1)?.date || '',
    };
  }
  return results;
}

function analyzeVIX(vixHistory = []) {
  const kline = ensureSorted(vixHistory);
  if (kline.length < 25) return { score: 50, current: 20, ma20: 20, level: 'normal' };
  const closes = kline.map((item) => Number(item.close));
  const current = closes.at(-1);
  const ma20 = calcSMA(closes, 20).at(-1) || current;
  let score = 50;
  if (current > 30) score += 8;
  else if (current > 25) score += 3;
  else if (current < 13) score -= 5;
  if (current > ma20 * 1.2) score += 5;
  if (current < ma20 * 0.8) score -= 3;
  return {
    score: clamp(round(score), 0, 100),
    current: round(current, 2),
    ma20: round(ma20, 2),
    level: current > 25 ? 'high' : current < 15 ? 'low' : 'normal',
  };
}

function crossMarketSignal(aShareSentiment = {}, futures = {}) {
  let score = 50;
  const aShareChange = Number(aShareSentiment?.sentiment?.avg_change || 0);
  if (aShareChange > 1) score += 3;
  if (aShareChange < -1) score -= 3;
  const futureChanges = Object.values(futures || {})
    .map((item) => Number(item?.change_pct))
    .filter(Number.isFinite);
  const avgFutures = futureChanges.length
    ? futureChanges.reduce((sum, value) => sum + value, 0) / futureChanges.length
    : 0;
  if (avgFutures > 0.6) score += 4;
  if (avgFutures < -0.6) score -= 4;
  return { score: clamp(score, 0, 100), aShareChange: round(aShareChange), avgFutures: round(avgFutures) };
}

function aiPredictionScore(aiAnalysis = {}) {
  const score = Number(aiAnalysis.sentiment_score || 0);
  return {
    score,
    normalized: clamp(50 + score / 2, 0, 100),
    summary: aiAnalysis.summary || 'AI 暂无额外判断',
  };
}

function predictUSTonight({ usHistoryMap = {}, vixHistory = [], calendar = {}, earnings = {}, aShareSentiment = {}, futures = {}, aiAnalysis = {} }) {
  const technicals = analyzeUSTechnicals(usHistoryMap);
  const coreTech = ['NDX', '.NDX', 'QQQ', 'SPY', '.INX', 'SOXX', 'NVDA', 'AMD', 'TSM']
    .map((ticker) => technicals[ticker]?.score)
    .filter(Number.isFinite);
  const technicalScore = coreTech.length
    ? coreTech.reduce((sum, value) => sum + value, 0) / coreTech.length
    : 50;
  const vix = analyzeVIX(vixHistory);
  const cross = crossMarketSignal(aShareSentiment, futures);
  const ai = aiPredictionScore(aiAnalysis);

  let score = 50;
  score += (technicalScore - 50) * 0.25;
  score += (vix.score - 50) * 0.15;
  score += (cross.score - 50) * 0.15;
  score += (ai.normalized - 50) * 0.2;
  score = clamp(round(score), 0, 100);

  let confidence = 'medium';
  const reasons = [];
  const highImpact = Boolean(calendar.high_impact_today);
  const keyEarnings = Boolean(earnings.has_key_earnings);
  if (score >= 65 || score <= 35) confidence = 'high';
  if (score > 45 && score < 55) confidence = 'low';
  if (highImpact) {
    confidence = 'low';
    reasons.push('今晚有重大经济数据，方向不确定，波动可能放大');
  }
  if (keyEarnings) {
    confidence = 'low';
    reasons.push(`关键财报待发布: ${(earnings.earnings || []).map((item) => item.name).slice(0, 4).join('、')}`);
  }

  if (technicalScore > 55) reasons.push('美股技术面偏修复');
  if (technicalScore < 45) reasons.push('美股技术面偏承压');
  if (vix.level === 'high') reasons.push('VIX 偏高，可能有反弹但波动加大');
  if (vix.level === 'low') reasons.push('VIX 偏低，警惕过度乐观后的回撤');
  if (cross.avgFutures > 0.4) reasons.push('盘前期货偏强');
  if (cross.avgFutures < -0.4) reasons.push('盘前期货偏弱');
  if (ai.summary) reasons.push(ai.summary.slice(0, 90));

  const direction = score >= 55 ? 'up' : score <= 45 ? 'down' : 'uncertain';
  const directionText = direction === 'up' ? '偏涨' : direction === 'down' ? '偏跌' : '不确定';

  return {
    generatedAt: new Date().toISOString(),
    targetSession: 'tonight_us_market',
    score,
    direction,
    directionText,
    confidence,
    confidenceText: confidenceLabel(confidence),
    components: {
      technicalScore: round(technicalScore),
      vixScore: vix.score,
      crossScore: cross.score,
      aiScore: round(ai.score),
    },
    technicals,
    vix,
    crossMarket: cross,
    calendar,
    earnings,
    reasoning: reasons.slice(0, 5),
    impact: {
      ifUp: '如果今晚确认上涨，明早纳指/半导体 QDII 信号将获得双重确认加成。',
      ifDown: '如果今晚意外下跌，明早 QDII 操作以隔夜实际收盘为准并降低追涨意愿。',
    },
  };
}

function loadStoredPrediction() {
  try {
    return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
  } catch {
    return null;
  }
}

function saveStoredPrediction(prediction) {
  fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(prediction, null, 2), 'utf8');
}

function verifyUSPrediction(prediction, usData = {}) {
  if (!prediction) return null;
  const changes = ['.NDX', 'NDX', '.INX', 'NVDA', 'AMD', 'TSM']
    .map((ticker) => Number(usData?.[ticker]?.change_pct))
    .filter(Number.isFinite);
  if (!changes.length || prediction.direction === 'uncertain') {
    return { available: false, prediction };
  }
  const avgChange = changes.reduce((sum, value) => sum + value, 0) / changes.length;
  const actualDirection = avgChange > 0 ? 'up' : avgChange < 0 ? 'down' : 'uncertain';
  const hit = prediction.direction === actualDirection;
  return {
    available: true,
    prediction: prediction.direction,
    predictionText: prediction.directionText,
    score: prediction.score,
    confidence: prediction.confidence,
    actualDirection,
    actualChange: round(avgChange),
    hit,
    multiplier: hit && prediction.confidence === 'high' ? 1.3 : !hit && prediction.confidence === 'high' ? 0.7 : 1,
  };
}

module.exports = {
  analyzeUSTechnicals,
  analyzeVIX,
  predictUSTonight,
  loadStoredPrediction,
  saveStoredPrediction,
  verifyUSPrediction,
};
