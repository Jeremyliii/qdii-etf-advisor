const {
  calcDirectionScore,
  calcOpportunityScore,
  directionText,
  generateAction,
  round
} = require('./scoringModel');

const DEFAULT_CONFIG = {
  buyThreshold: 68,
  sellThreshold: 38,
  weights: {
    ai: 0.3,
    linked: 0.25,
    technical: 0.18,
    premium: 0.12,
    vix: 0.1,
    ashare: 0.1
  }
};

function mean(numbers) {
  const clean = numbers.filter((value) => Number.isFinite(value));
  return clean.length ? clean.reduce((sum, value) => sum + value, 0) / clean.length : 0;
}

function generateDecisions(usData, aiAnalysis, etfQuotes, etfKlineMap, config = {}) {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  const decisions = [];

  for (const etf of mergedConfig.etfPool || []) {
    const sectorScore = aiAnalysis?.sector_scores?.[etf.sector]?.score || 0;
    const linkedChanges = etf.linkedTickers
      .map((ticker) => Number(usData?.[ticker]?.change_pct))
      .filter(Number.isFinite);
    const hasLinkedData = linkedChanges.length > 0;
    const linkedChange = mean(linkedChanges);

    const quote = etfQuotes?.[etf.symbol];
    const premiumValue = Number(quote?.premium_rate);
    const hasPremiumData = Boolean(quote?.premium_available) && Number.isFinite(premiumValue);
    const estimatedPremium = hasPremiumData ? premiumValue : null;

    const ashareChange = Number(mergedConfig.aShareSentiment?.sentiment?.avg_change || 0);
    const direction = calcDirectionScore({
      linkedChange,
      linkedCount: linkedChanges.length,
      usData,
      aShareSentiment: ashareChange,
      etf,
      futures: mergedConfig.futures
    });
    const opportunity = calcOpportunityScore({
      linkedChange,
      kline: etfKlineMap?.[etf.symbol] || [],
      premium: estimatedPremium,
      usData
    });
    const actionInfo = generateAction(direction.score, opportunity.score);
    const primaryReasons = [...new Set([
      actionInfo.reason,
      ...opportunity.reasons,
      ...direction.reasons
    ])].filter(Boolean);

    decisions.push({
      ...etf,
      score: opportunity.score,
      directionScore: direction.score,
      direction: direction.direction,
      directionLabel: directionText(direction.direction),
      directionReasons: direction.reasons,
      opportunityScore: opportunity.score,
      opportunityLabel: opportunity.label,
      opportunityReasons: opportunity.reasons,
      opportunityDetails: opportunity.details,
      action: actionInfo.action,
      actionLabel: actionInfo.label,
      actionReason: actionInfo.reason,
      actionTip: actionInfo.tip || '',
      linkedChange: round(linkedChange),
      linkedDataAvailable: hasLinkedData,
      linkedCoverage: {
        available: linkedChanges.length,
        total: etf.linkedTickers.length
      },
      sectorSentiment: sectorScore,
      quote: quote || null,
      estimatedPremium: hasPremiumData ? round(estimatedPremium) : null,
      premiumAvailable: hasPremiumData,
      premiumSource: quote?.premium_source || null,
      navBasis: quote?.nav_basis || null,
      navTime: quote?.nav_time || '',
      technical: {
        rsi: opportunity.details?.oversold?.rsi ?? 50,
        trend: opportunity.details?.trend?.ma20VsMa60 === '上升' ? '中期上升' : '中期下降'
      },
      aShareSentiment: round(ashareChange),
      usPredictionVerification: mergedConfig.usPredictionVerification || null,
      reasons: primaryReasons.slice(0, 5),
      updatedAt: new Date().toISOString()
    });
  }

  return decisions.sort((a, b) => b.opportunityScore - a.opportunityScore);
}

module.exports = { DEFAULT_CONFIG, generateDecisions };
