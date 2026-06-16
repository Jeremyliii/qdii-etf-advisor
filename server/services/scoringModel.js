function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(Number(value || 0) * factor) / factor;
}

function calcLinkedScore(linkedChange) {
  const change = Number(linkedChange || 0);
  const absChange = Math.abs(change);
  let magnitude;

  if (absChange < 0.3) magnitude = 0;
  else if (absChange < 1) magnitude = absChange * 3;
  else if (absChange < 3) magnitude = 3 + (absChange - 1) * 4;
  else if (absChange < 5) magnitude = 11 + (absChange - 3) * 0.5;
  else magnitude = Math.max(12 - (absChange - 5) * 0.3, 8);

  return change > 0 ? magnitude : -magnitude;
}

function changePct(prev, current) {
  return prev ? ((Number(current) - Number(prev)) / Number(prev)) * 100 : 0;
}

function directionFromScore(score) {
  const clean = Number(score || 0);
  if (clean >= 55) return 'up';
  if (clean <= 45) return 'down';
  return 'neutral';
}

function directionText(direction) {
  if (direction === 'up') return '预测上涨';
  if (direction === 'down') return '预测下跌';
  return '方向不明';
}

function opportunityText(score) {
  const clean = Number(score || 0);
  if (clean >= 75) return '机会很好';
  if (clean >= 60) return '有吸引力';
  if (clean >= 45) return '机会一般';
  if (clean >= 30) return '机会偏差';
  return '机会很差';
}

function calcAShareSentimentScore(change) {
  const prevChange = Number(change || 0);
  if (prevChange > 1) return 5;
  if (prevChange > 0.5) return 3;
  if (prevChange < -1) return -5;
  if (prevChange < -0.5) return -3;
  return 0;
}

function calcDirectionScore({ linkedChange = 0, linkedCount = 0, usData = {}, aShareSentiment = 0, etf = {}, futures = null }) {
  let score = 50;
  const reasons = [];
  const linked = Number(linkedChange || 0);

  if (linkedCount > 0) {
    const linkedScore = calcLinkedScore(linked);
    score += linkedScore;
    if (linked > 1) reasons.push(`底层资产隔夜上涨${round(linked)}%，方向偏多`);
    if (linked < -1) reasons.push(`底层资产隔夜下跌${round(linked)}%，方向偏空`);
    if (Math.abs(linked) < 0.5) reasons.push('隔夜波动较小，方向信号不强');
  } else {
    reasons.push('联动数据不足，方向预测降为中性');
  }

  const sector = String(etf.sector || '');
  const nasdaqFuture = Number(futures?.nasdaq);
  if (Number.isFinite(nasdaqFuture) && sector.includes('nasdaq')) {
    score += nasdaqFuture * 2;
    reasons.push(`纳指期货修正${round(nasdaqFuture)}%`);
  }

  const vix = Number(usData?.VIX?.close || usData?.['.VIX']?.close || 20);
  if (vix > 30) {
    score -= 5;
    reasons.push('VIX 高位压制短线方向');
  } else if (vix < 15) {
    score += 3;
    reasons.push('VIX 低位支撑风险偏好');
  }

  const ashare = Number(aShareSentiment || 0);
  if (ashare > 1) {
    score += 3;
    reasons.push('A股大盘情绪偏强');
  } else if (ashare < -1) {
    score -= 3;
    reasons.push('A股大盘情绪偏弱');
  }

  const finalScore = clamp(Math.round(score), 0, 100);
  const direction = linkedCount > 0 ? directionFromScore(finalScore) : 'neutral';
  return {
    score: finalScore,
    direction,
    label: directionText(direction),
    reasons
  };
}

function calcOpportunityScore({ linkedChange = 0, kline = [], premium = null, usData = {} }) {
  let score = 50;
  const reasons = [];
  const sorted = [...(kline || [])]
    .filter((item) => Number.isFinite(Number(item.close)))
    .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
  const closes = sorted.map((item) => Number(item.close));

  if (false && closes.length < 30) {
    return {
      score: 50,
      label: '数据不足',
      reasons: ['K线不足，机会分保持中性'],
      details: {}
    };
  }

  const hasEnoughKline = closes.length >= 30;
  if (!hasEnoughKline) {
    reasons.push('K线不足，暂不使用技术面，机会分由溢价和隔夜走势估算');
  }

  const { calcRSI, calcSMA } = require('./indicators');
  const currentPrice = closes.at(-1);
  const ma20 = calcSMA(closes, 20).at(-1);
  const ma60 = calcSMA(closes, 60).at(-1);
  const rsi = calcRSI(closes, 14).at(-1) || 50;
  const change5d = closes.length > 5 ? changePct(closes.at(-6), currentPrice) : 0;
  const change10d = closes.length > 10 ? changePct(closes.at(-11), currentPrice) : 0;
  const trendUp = Number.isFinite(ma20) && Number.isFinite(ma60) && ma20 > ma60;

  if (trendUp) {
    score += 5;
    reasons.push('中期趋势向上');
    if (Number.isFinite(ma20) && currentPrice < ma20) {
      score += 8;
      reasons.push('趋势向上但价格回到MA20下方，属于回调买点');
    }
  } else if (Number.isFinite(ma20) && Number.isFinite(ma60)) {
    score -= 3;
    reasons.push('中期趋势仍偏弱，抄底需谨慎');
  }

  if (rsi < 25) {
    score += trendUp ? 15 : 8;
    reasons.push(`RSI=${Math.round(rsi)} 极度超卖`);
  } else if (rsi < 30) {
    score += trendUp ? 10 : 5;
    reasons.push(`RSI=${Math.round(rsi)} 超卖`);
  } else if (rsi < 40) {
    score += 5;
    reasons.push(`RSI=${Math.round(rsi)} 偏低`);
  } else if (rsi > 75) {
    score -= 12;
    reasons.push(`RSI=${Math.round(rsi)} 极度超买`);
  } else if (rsi > 70) {
    score -= 8;
    reasons.push(`RSI=${Math.round(rsi)} 超买`);
  } else if (rsi > 60) {
    score -= 3;
    reasons.push(`RSI=${Math.round(rsi)} 偏热`);
  }

  if (change5d < -8) {
    score += trendUp ? 12 : 6;
    reasons.push(`近5日跌${round(Math.abs(change5d))}%，出现超跌修复机会`);
  } else if (change5d < -5) {
    score += trendUp ? 8 : 4;
    reasons.push(`近5日跌${round(Math.abs(change5d))}%，回调幅度较深`);
  } else if (change5d < -3) {
    score += 4;
    reasons.push(`近5日回调${round(Math.abs(change5d))}%`);
  } else if (change5d > 8) {
    score -= 10;
    reasons.push(`近5日涨${round(change5d)}%，追高风险大`);
  } else if (change5d > 5) {
    score -= 6;
    reasons.push(`近5日涨${round(change5d)}%，短线偏热`);
  }

  const linked = Number(linkedChange || 0);
  if (linked < -5) {
    score += trendUp ? 12 : 6;
    reasons.push('隔夜暴跌可能带来低开抄底窗口');
  } else if (linked < -3) {
    score += trendUp ? 6 : 3;
    reasons.push('隔夜大跌，等待低开企稳机会');
  } else if (linked < -1) {
    score += 2;
  } else if (linked > 5) {
    score -= 8;
    reasons.push('隔夜暴涨，明日高开后追入风险大');
  } else if (linked > 3) {
    score -= 4;
    reasons.push('隔夜大涨，注意高开回落');
  }

  const premiumPct = Number(premium);
  if (Number.isFinite(premiumPct)) {
    if (premiumPct < -3) {
      score += 10;
      reasons.push(`折价${round(Math.abs(premiumPct))}%，打折买入`);
    } else if (premiumPct < -1) {
      score += 5;
      reasons.push(`折价${round(Math.abs(premiumPct))}%，估值有吸引力`);
    } else if (premiumPct > 5) {
      score -= 15;
      reasons.push(`溢价${round(premiumPct)}%，买入成本过高`);
    } else if (premiumPct > 3) {
      score -= 10;
      reasons.push(`溢价${round(premiumPct)}%，不宜追买`);
    } else if (premiumPct > 1) {
      score -= 3;
      reasons.push(`溢价${round(premiumPct)}%，略贵`);
    }
  } else {
    reasons.push('溢价暂无可靠数据');
  }

  const vix = Number(usData?.VIX?.close || usData?.['.VIX']?.close || 20);
  if (vix > 35) {
    score += 8;
    reasons.push('VIX 极端恐慌，逆向机会增加');
  } else if (vix > 25) {
    score += 3;
    reasons.push('VIX 偏高，适合分批而非追涨');
  } else if (vix < 13) {
    score -= 5;
    reasons.push('VIX 过低，市场过于平静');
  }

  const finalScore = clamp(Math.round(score), 0, 100);
  return {
    score: finalScore,
    label: opportunityText(finalScore),
    reasons,
    details: {
      trend: {
        ma20: round(ma20),
        ma60: round(ma60),
        ma20VsMa60: trendUp ? '上升' : '下降',
        priceVsMa20: currentPrice > ma20 ? '均线上方' : '均线下方'
      },
      oversold: {
        rsi: round(rsi, 1),
        change5d: round(change5d),
        change10d: round(change10d)
      },
      overnight: { linkedChange: round(linked) },
      premium: { premiumPct: Number.isFinite(premiumPct) ? round(premiumPct) : null },
      vix: { level: round(vix) }
    }
  };
}

function generateAction(directionScore, opportunityScore) {
  const direction = Number(directionScore || 0);
  const opportunity = Number(opportunityScore || 0);

  if (direction >= 55 && opportunity >= 60) {
    return {
      action: 'strong_buy',
      label: '强烈买入',
      reason: '方向看涨且当前估值有吸引力'
    };
  }
  if (direction <= 45 && opportunity >= 65) {
    return {
      action: 'buy_dip',
      label: '逢低买入',
      reason: '短期可能下跌，但正是低价买入窗口',
      tip: '建议等开盘后观察15分钟，如果企稳再买入'
    };
  }
  if (direction >= 55 && opportunity <= 40) {
    return {
      action: 'no_chase',
      label: '不追高',
      reason: '方向看涨但估值偏高或溢价过大',
      tip: '已持有可继续观察，新资金不建议追入'
    };
  }
  if (direction <= 45 && opportunity <= 40) {
    return {
      action: 'avoid',
      label: '回避',
      reason: '方向偏空且估值没有吸引力'
    };
  }
  if (direction > 45 && direction < 55 && opportunity >= 60) {
    return {
      action: 'accumulate',
      label: '可以建仓',
      reason: '短期方向不明，但中期位置有吸引力',
      tip: '适合小仓位分批建仓'
    };
  }
  return {
    action: 'hold',
    label: '观望',
    reason: '没有明确的买卖信号'
  };
}

function applyDynamicPremium(score, linkedChange, estimatedPremium, reasons = []) {
  let nextScore = score;
  const premium = Number(estimatedPremium || 0);
  const linked = Number(linkedChange || 0);

  if (linked > 0 && premium > 2) {
    const premiumPenalty = Math.min(20, (premium - 2) * 5);
    nextScore -= premiumPenalty;
    reasons.push(`溢价${premium.toFixed(1)}%压缩上涨空间`);
  } else if (linked < 0 && premium < -1) {
    nextScore += 3;
    reasons.push(`折价${Math.abs(premium).toFixed(1)}%可能缓冲下跌`);
  } else if (linked < 0 && premium > 3) {
    const premiumPenalty = Math.min(22, 10 + (premium - 3) * 1.5);
    nextScore -= premiumPenalty;
    reasons.push(`溢价${premium.toFixed(1)}%叠加隔夜下跌，双重压力`);
  } else if (premium > 3) {
    const premiumPenalty = Math.min(18, (premium - 3) * 3);
    nextScore -= premiumPenalty;
    reasons.push(`溢价${premium.toFixed(1)}%偏高，联动不足时先按风险处理`);
  }

  return nextScore;
}

function applyExtremeMoveAdjustment(score, linkedChange, reasons = []) {
  let nextScore = score;
  const linked = Number(linkedChange || 0);
  if (linked > 4) {
    nextScore -= 5;
    reasons.push('隔夜涨幅极大，注意高开低走风险');
  }
  if (linked < -4) {
    nextScore += 3;
    reasons.push('隔夜跌幅极大，可能出现超跌反弹');
  }
  return nextScore;
}

function getTechConfirmation(technical = {}) {
  const rsi = Number(technical.rsi || 50);
  const trend = String(technical.trend || '');
  return {
    bullish: rsi < 40 || trend.includes('上行'),
    bearish: rsi > 65 || trend.includes('承压')
  };
}

function labelConfidence({ score, sectorAccuracy = 0, linkedChange = 0, techConfirmed = true }) {
  const labels = [];
  const cleanScore = Number(score || 0);
  const accuracy = Number(sectorAccuracy || 0);
  const linked = Number(linkedChange || 0);

  if (cleanScore >= 60 && cleanScore <= 69) labels.push('评分处于高准确率区间(60-69)');
  if (cleanScore >= 55 && cleanScore <= 59 && !techConfirmed) labels.push('弱信号未经技术面确认');
  if (cleanScore >= 70) labels.push('极高评分，注意高开低走风险');
  if (accuracy > 0 && accuracy < 50) labels.push('该板块历史准确率低于50%');
  if (accuracy >= 70) labels.push('该板块历史准确率优秀');
  if (Math.abs(linked) < 0.5) labels.push('隔夜波动小，信号不强');
  if (Math.abs(linked) > 4) labels.push('隔夜波动极大，注意反转');

  const warnings = labels.filter((label) => label.includes('注意') || label.includes('弱') || label.includes('低于') || label.includes('不强')).length;
  return {
    labels,
    overallConfidence: warnings === 0 ? 'high' : warnings <= 1 ? 'medium' : 'low'
  };
}

module.exports = {
  clamp,
  round,
  changePct,
  calcLinkedScore,
  calcDirectionScore,
  calcOpportunityScore,
  directionFromScore,
  directionText,
  opportunityText,
  generateAction,
  calcAShareSentimentScore,
  applyDynamicPremium,
  applyExtremeMoveAdjustment,
  getTechConfirmation,
  labelConfidence
};
