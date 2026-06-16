import { AlertTriangle, BrainCircuit, CheckCircle2, TrendingDown, TrendingUp } from 'lucide-react'

function directionClass(direction) {
  if (direction === 'up') return 'up'
  if (direction === 'down') return 'down'
  return ''
}

function directionIcon(direction) {
  if (direction === 'down') return <TrendingDown size={20} />
  return <TrendingUp size={20} />
}

function confidenceText(value) {
  if (value === 'high') return '高'
  if (value === 'low') return '低'
  return '中'
}

function formatTime(value) {
  return value ? new Date(value).toLocaleString() : '-'
}

export default function USTonightPrediction({ data, verification, loading }) {
  const prediction = data?.prediction
  const components = prediction?.components || {}
  const calendar = prediction?.calendar || {}
  const earnings = prediction?.earnings || {}

  return (
    <section className="section us-prediction-section">
      <div className="section-head">
        <h2>今晚美股预测</h2>
        <span>生成时间: {formatTime(prediction?.generatedAt)}</span>
      </div>
      {loading ? <div className="skeleton-line" /> : prediction ? (
        <>
          <div className="us-prediction-main">
            <div className={`us-prediction-score ${directionClass(prediction.direction)}`}>
              {directionIcon(prediction.direction)}
              <strong>{prediction.score}</strong>
              <span>/100 · {prediction.directionText}</span>
            </div>
            <div className={`confidence-text ${prediction.confidence || 'medium'}`}>
              置信度 {confidenceText(prediction.confidence)}
            </div>
          </div>

          <div className="component-grid">
            <div><span>技术面</span><strong>{Number(components.technicalScore || 0).toFixed(0)}</strong></div>
            <div><span>VIX</span><strong>{Number(components.vixScore || 0).toFixed(0)}</strong></div>
            <div><span>跨市场</span><strong>{Number(components.crossScore || 0).toFixed(0)}</strong></div>
            <div><span>AI 判断</span><strong>{Number(components.aiScore || 0).toFixed(0)}</strong></div>
          </div>

          <div className="prediction-detail-grid">
            <div>
              <h3>关键原因</h3>
              {(prediction.reasoning || []).slice(0, 4).map((item) => (
                <p key={item}>{item}</p>
              ))}
            </div>
            <div>
              <h3>今晚事件</h3>
              <p>
                {calendar.high_impact_today ? <AlertTriangle size={15} /> : <CheckCircle2 size={15} />}
                经济日历: {calendar.high_impact_today ? '有高影响数据' : '暂无高影响数据'} · {calendar.event_count || 0} 项
              </p>
              <p>
                {earnings.has_key_earnings ? <AlertTriangle size={15} /> : <CheckCircle2 size={15} />}
                关键财报: {earnings.has_key_earnings ? (earnings.earnings || []).map((item) => item.name).join('、') : '暂无'}
              </p>
            </div>
          </div>

          {verification?.available && (
            <div className={verification.hit ? 'prediction-verify hit' : 'prediction-verify miss'}>
              昨日预测验证: {verification.predictionText}({verification.score}分) → 实际 {Number(verification.actualChange || 0).toFixed(2)}%
              {verification.hit ? ' · 命中，今日 QDII 信号加成' : ' · 未命中，今日 QDII 信号打折'}
            </div>
          )}
        </>
      ) : (
        <div className="empty-state">暂无美股预测数据</div>
      )}
    </section>
  )
}
