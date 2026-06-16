import { TrendingDown, TrendingUp } from 'lucide-react'

const keyOrder = ['.IXIC', '.NDX', '.INX', '.DJI', 'NVDA', 'AAPL', 'MSFT', 'TSLA', 'TSM', 'AVGO', 'AMD', 'BABA']

function Change({ value }) {
  const number = Number(value || 0)
  const up = number >= 0
  const Icon = up ? TrendingUp : TrendingDown
  return (
    <span className={up ? 'change up' : 'change down'}>
      <Icon size={14} />
      {number.toFixed(2)}%
    </span>
  )
}

export default function MarketOverview({ data, loading }) {
  const close = data?.close || {}
  const rows = keyOrder.map((key) => [key, close[key]]).filter(([, value]) => value)
  const futures = Object.values(data?.futures || {})
  const dataDate = close?._meta?.data_date_label

  return (
    <section className="section">
      <div className="section-head">
        <h2>隔夜美股</h2>
        <span>{dataDate ? `数据日期: ${dataDate}` : data?.updatedAt ? new Date(data.updatedAt).toLocaleString() : '等待数据'}</span>
      </div>
      {loading ? <div className="skeleton-grid" /> : (
        <>
          <div className="market-grid">
            {rows.map(([ticker, item]) => (
              <article className="quote-card" key={ticker}>
                <div className="quote-top">
                  <strong>{item.name || ticker}</strong>
                  <span>{ticker}</span>
                </div>
                <div className="quote-price">{Number(item.close || 0).toLocaleString()}</div>
                <Change value={item.change_pct} />
              </article>
            ))}
          </div>
          <div className="futures-strip">
            {futures.map((item) => (
              <div key={item.name}>
                <span>{item.name}</span>
                <strong>{Number(item.price || 0).toLocaleString()}</strong>
                <Change value={item.change_pct} />
              </div>
            ))}
            {close.VIX && (
              <div>
                <span>VIX</span>
                <strong>{Number(close.VIX.close || 0).toFixed(2)}</strong>
                <Change value={close.VIX.change_pct} />
              </div>
            )}
          </div>
        </>
      )}
    </section>
  )
}
