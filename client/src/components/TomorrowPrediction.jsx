import { useEffect, useState } from 'react'
import { ArrowDownRight, ArrowUpRight, HelpCircle } from 'lucide-react'
import { fetchPrediction } from '../api'

function confidenceLabel(value) {
  if (value === 'very_high') return '极高'
  if (value === 'high') return '高'
  if (value === 'medium') return '中'
  return '低'
}

function rangeText(item) {
  const range = item?.estimatedRange
  if (item?.estimatedRangeAvailable === false || !Array.isArray(range)) {
    return '联动数据不足'
  }
  const [min = 0, max = 0] = range
  return `${Number(min).toFixed(2)}% ~ ${Number(max).toFixed(2)}%`
}

function premiumLabel(item) {
  const premiumAvailable = item.premiumAvailable && Number.isFinite(Number(item.estimatedPremium))
  if (!premiumAvailable) return '溢价暂无可靠数据'

  const value = Number(item.estimatedPremium).toFixed(2)
  if (item.premiumSource === 'eastmoney_latest_nav') {
    return `最新净值溢价率 ${value}%`
  }
  return `估算溢价率 ${value}%`
}

function PredictionCard({ item }) {
  const history = item.historicalAccuracy
  const accuracy = Number(history?.accuracy || 0)
  const reliable = history && accuracy >= 55
  const premiumText = premiumLabel(item)
  return (
    <article className={`prediction-card confidence-card ${item.confidence || 'low'}`}>
      <div className="prediction-top">
        <div>
          <strong>{item.name}</strong>
          <span>{item.symbol} · {item.tracking}</span>
        </div>
        <div className={`confidence ${item.confidence}`}>{confidenceLabel(item.confidence)}</div>
      </div>
      <div className="prediction-score">
        <span>方向分 {item.directionScore ?? item.score}</span>
        <strong className={item.estimatedRangeAvailable === false ? 'range-unavailable' : ''}>{rangeText(item)}</strong>
      </div>
      <p>{(item.reasons || []).join(' / ') || '暂无明确原因'}</p>
      <div className="prediction-action-line">
        操作建议: {item.actionLabel || '观望'} · 机会分 {item.opportunityScore ?? '-'}
      </div>
      <div className={`history-accuracy ${history ? (reliable ? 'reliable' : 'unreliable') : 'unknown'}`}>
        {history
          ? <>该板块近60天预测准确率: {accuracy.toFixed(1)}% {reliable ? '✅ 可信' : '⚠️ 该板块预测不可靠'}</>
          : <>该板块近60天预测准确率: 暂无足够样本</>}
      </div>
      {!!item.confidenceLabels?.length && (
        <div className="confidence-labels">
          {item.confidenceLabels.map((label) => <span key={label}>{label}</span>)}
        </div>
      )}
      <small>联动 {Number(item.linkedChange || 0).toFixed(2)}% · {premiumText}</small>
    </article>
  )
}

export default function TomorrowPrediction({ config }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    fetchPrediction(config)
      .then((value) => {
        if (active) setData(value.prediction)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [config.buyThreshold, config.sellThreshold])

  if (loading) {
    return (
      <section className="section">
        <div className="skeleton-line tall" />
      </section>
    )
  }

  const ups = data?.ups || []
  const downs = data?.downs || []
  const neutrals = data?.neutrals || []

  return (
    <section className="section">
      <div className="section-head">
        <h2>明日涨跌预测</h2>
        <span>只回答方向，不等于买卖建议</span>
      </div>
      <p className="muted-note">
        基于隔夜美股、VIX 和 A 股情绪生成方向分；买卖动作请看“今日操作建议”。预测时间: {data?.generatedAt ? new Date(data.generatedAt).toLocaleString() : '-'}
      </p>

      <div className="prediction-columns">
        <div className="prediction-panel up-panel">
          <div className="panel-title"><ArrowUpRight size={18} /> 预测上涨 <span>{ups.length}</span></div>
          <div className="prediction-list">
            {ups.map((item) => <PredictionCard key={item.symbol} item={item} />)}
            {!ups.length && <div className="empty-state">暂无明确上涨预测</div>}
          </div>
        </div>

        <div className="prediction-panel down-panel">
          <div className="panel-title"><ArrowDownRight size={18} /> 预测下跌 <span>{downs.length}</span></div>
          <div className="prediction-list">
            {downs.map((item) => <PredictionCard key={item.symbol} item={item} />)}
            {!downs.length && <div className="empty-state">暂无明确下跌预测</div>}
          </div>
        </div>

        <div className="prediction-panel neutral-panel">
          <div className="panel-title"><HelpCircle size={18} /> 方向不明 <span>{neutrals.length}</span></div>
          <div className="neutral-summary">
            <span>45-55 分之间为方向不明；方向不明仍可能有建仓机会，需要结合投资机会分。</span>
          </div>
          <div className="prediction-list">
            {neutrals.map((item) => <PredictionCard key={item.symbol} item={item} />)}
            {!neutrals.length && <div className="empty-state">暂无方向不明标的</div>}
          </div>
        </div>
      </div>

      <div className="confidence-help">
        <span>置信度说明</span>
        <p>{'方向预测只判断明日涨跌概率；操作建议另由投资机会分决定，可能出现“预测下跌但逢低买入”。'}</p>
      </div>
    </section>
  )
}
