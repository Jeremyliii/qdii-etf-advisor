import { AlertTriangle, BrainCircuit } from 'lucide-react'

export default function AIAnalysis({ analysis, loading }) {
  const score = Number(analysis?.sentiment_score || 0)
  const width = Math.max(0, Math.min(100, score + 50))

  return (
    <section className="section">
      <div className="section-head">
        <h2>AI 分析</h2>
        <span>{analysis?.market_sentiment || '中性'}</span>
      </div>
      {loading ? <div className="skeleton-line" /> : (
        <div className="ai-layout">
          <div className="sentiment-meter">
            <div className="meter-number">
              <BrainCircuit size={22} />
              <strong>{score}</strong>
            </div>
            <div className="meter-track">
              <span style={{ width: `${width}%` }} />
            </div>
            <p>{analysis?.summary || '暂无 AI 摘要'}</p>
          </div>
          <div className="risk-list">
            {(analysis?.risk_alerts || []).slice(0, 3).map((item) => (
              <div key={item}>
                <AlertTriangle size={16} />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
