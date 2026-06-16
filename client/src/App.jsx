import { useEffect, useMemo, useState } from 'react'
import { Activity, BarChart3, BriefcaseBusiness, RefreshCw, Settings } from 'lucide-react'
import { fetchDecisions, fetchMarket, fetchUSPrediction } from './api'
import MarketOverview from './components/MarketOverview'
import USTonightPrediction from './components/USTonightPrediction'
import AIAnalysis from './components/AIAnalysis'
import TodayDecisions from './components/TodayDecisions'
import TomorrowPrediction from './components/TomorrowPrediction'
import ETFScoreBoard from './components/ETFScoreBoard'
import HistoricalBacktest from './components/HistoricalBacktest'
import Portfolio from './components/Portfolio'
import StrategyConfig from './components/StrategyConfig'

const tabs = [
  { id: 'today', label: '今日决策', icon: Activity },
  { id: 'backtest', label: '预测验证', icon: BarChart3 },
  { id: 'portfolio', label: '我的持仓', icon: BriefcaseBusiness },
  { id: 'config', label: '策略配置', icon: Settings }
]

export default function App() {
  const [activeTab, setActiveTab] = useState('today')
  const [market, setMarket] = useState(null)
  const [usPrediction, setUsPrediction] = useState(null)
  const [usPredictionVerification, setUsPredictionVerification] = useState(null)
  const [decisions, setDecisions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [config, setConfig] = useState({ buyThreshold: 68, sellThreshold: 38, initialCash: 100000 })

  const refresh = async () => {
    setLoading(true)
    setError('')
    try {
      const [marketData, decisionData, usPredictionData] = await Promise.all([
        fetchMarket(),
        fetchDecisions(config),
        fetchUSPrediction()
      ])
      setMarket(marketData)
      setUsPrediction(usPredictionData)
      setUsPredictionVerification(decisionData.usPredictionVerification || null)
      setDecisions(decisionData.decisions || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [config.buyThreshold, config.sellThreshold])

  const grouped = useMemo(() => ({
    strong_buy: decisions.filter((item) => item.action === 'strong_buy'),
    buy_dip: decisions.filter((item) => item.action === 'buy_dip'),
    no_chase: decisions.filter((item) => item.action === 'no_chase'),
    avoid: decisions.filter((item) => item.action === 'avoid'),
    accumulate: decisions.filter((item) => item.action === 'accumulate'),
    hold: decisions.filter((item) => item.action === 'hold'),
  }), [decisions])

  const ActiveIcon = tabs.find((tab) => tab.id === activeTab)?.icon || Activity

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">QDII ETF 隔夜联动</p>
          <h1>每日投资决策系统</h1>
        </div>
        <div className="topbar-actions">
          <div className="status-dot">
            <span />
            {loading ? '刷新中' : '本地运行'}
          </div>
          <button className="icon-button wide" onClick={refresh} title="刷新数据">
            <RefreshCw size={18} />
            刷新
          </button>
        </div>
      </header>

      <nav className="tabbar" aria-label="主导航">
        {tabs.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              className={activeTab === tab.id ? 'tab active' : 'tab'}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon size={17} />
              <span>{tab.label}</span>
            </button>
          )
        })}
      </nav>

      {error && <div className="error-banner">{error}</div>}

      <main className="content">
        <div className="view-title">
          <ActiveIcon size={20} />
          <span>{tabs.find((tab) => tab.id === activeTab)?.label}</span>
        </div>

        {activeTab === 'today' && (
          <div className="stack">
            <USTonightPrediction data={usPrediction} verification={usPredictionVerification} loading={loading} />
            <MarketOverview data={market} loading={loading} />
            <AIAnalysis analysis={market?.aiAnalysis} loading={loading} />
            <TodayDecisions grouped={grouped} loading={loading} />
            <TomorrowPrediction config={config} />
            <ETFScoreBoard decisions={decisions} loading={loading} />
          </div>
        )}

        {activeTab === 'backtest' && (
          <HistoricalBacktest config={config} decisions={decisions} />
        )}

        {activeTab === 'portfolio' && (
          <Portfolio decisions={decisions} />
        )}

        {activeTab === 'config' && (
          <StrategyConfig config={config} setConfig={setConfig} decisions={decisions} />
        )}
      </main>
    </div>
  )
}
