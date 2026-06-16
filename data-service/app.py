from flask import Flask, jsonify, request
from flask_cors import CORS
import os
import re
import urllib.request
from pathlib import Path

env_path = Path(__file__).parent / ".env"
if env_path.exists():
    for line in env_path.read_text(encoding="utf-8").strip().split("\n"):
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, val = line.split("=", 1)
            os.environ[key.strip()] = val.strip()

from sources.eastmoney_news import eastmoney_etf_news, eastmoney_global_news
from sources.etf_kline import get_etf_kline
from sources.etf_quote import check_tencent, tencent_quote
from sources.qdii_data import get_etf_nav_and_premium, get_etf_realtime_quotes
from sources.sector_rank import get_sector_rank
from sources.sentiment import analyze_overnight
from sources.us_calendar import get_economic_calendar
from sources.us_earnings import get_earnings_calendar
from sources.us_history import get_us_ticker_history
from sources.us_market import get_us_futures, get_us_market_close, get_vix
from sources.us_news import fetch_us_market_news

app = Flask(__name__)
CORS(app)

DEEPSEEK_API_KEY = os.environ.get("DEEPSEEK_API_KEY", "")


def check_mootdx():
    try:
        return bool(get_etf_kline("513100", 1))
    except Exception:
        return False


def check_sina_us():
    try:
        req = urllib.request.Request("https://hq.sinajs.cn/list=gb_nvda")
        req.add_header("User-Agent", "Mozilla/5.0")
        req.add_header("Referer", "https://finance.sina.com.cn/")
        with urllib.request.urlopen(req, timeout=10) as resp:
            text = resp.read().decode("gbk", errors="ignore")
        match = re.search(r'"(.*)"', text)
        if not match:
            return False
        vals = match.group(1).split(",")
        return len(vals) > 2 and bool(vals[1])
    except Exception:
        return False


def check_tencent_source():
    try:
        if check_tencent():
            return True
    except Exception:
        pass
    try:
        data = get_us_market_close()
        return bool(data.get("NVDA", {}).get("close") and data.get("NVDA", {}).get("source") == "tencent_us")
    except Exception:
        return False


def check_eastmoney():
    try:
        return bool(eastmoney_global_news(1))
    except Exception:
        return False


@app.route("/api/us-close")
def api_us_close():
    try:
        return jsonify({"data": get_us_market_close()})
    except Exception as e:
        return jsonify({"error": str(e), "data": {}}), 500


@app.route("/api/us-futures")
def api_us_futures():
    try:
        return jsonify({"data": get_us_futures()})
    except Exception as e:
        return jsonify({"error": str(e), "data": {}}), 500


@app.route("/api/vix")
def api_vix():
    try:
        return jsonify({"data": get_vix()})
    except Exception as e:
        return jsonify({"error": str(e), "data": {"close": 20, "change_pct": 0}}), 500


@app.route("/api/us-news")
def api_us_news():
    try:
        return jsonify({"data": fetch_us_market_news()})
    except Exception as e:
        return jsonify({"error": str(e), "data": []}), 500


@app.route("/api/economic-calendar")
def api_economic_calendar():
    try:
        days = int(request.args.get("days", "2"))
        return jsonify({"data": get_economic_calendar(days)})
    except Exception as e:
        return jsonify({"error": str(e), "data": {"events": [], "high_impact_today": False, "event_count": 0}}), 500


@app.route("/api/earnings-calendar")
def api_earnings_calendar():
    try:
        days = int(request.args.get("days", "2"))
        return jsonify({"data": get_earnings_calendar(days)})
    except Exception as e:
        return jsonify({"error": str(e), "data": {"earnings": [], "has_key_earnings": False}}), 500


@app.route("/api/us-prediction")
def api_us_prediction_inputs():
    """US prediction input bundle for the Node decision engine."""
    try:
        days = int(request.args.get("days", "2"))
        return jsonify({
            "data": {
                "calendar": get_economic_calendar(days),
                "earnings": get_earnings_calendar(days),
            }
        })
    except Exception as e:
        return jsonify({
            "error": str(e),
            "data": {
                "calendar": {"events": [], "high_impact_today": False, "event_count": 0},
                "earnings": {"earnings": [], "has_key_earnings": False},
            },
        }), 500


@app.route("/api/etf-news")
def api_etf_news():
    """ETF 相关新闻（东财搜索）。"""
    name = request.args.get("name", "")
    page_size = int(request.args.get("pageSize", "20"))
    try:
        return jsonify({"data": eastmoney_etf_news(name, page_size)})
    except Exception as e:
        return jsonify({"error": str(e), "data": []}), 500


@app.route("/api/sector-rank")
def api_sector_rank():
    """全市场行业板块涨跌排名。"""
    top_n = int(request.args.get("topN", "20"))
    try:
        return jsonify({"data": get_sector_rank(top_n)})
    except Exception as e:
        return jsonify({"error": str(e), "data": {"top": [], "bottom": [], "total": 0}}), 500


@app.route("/api/ai-analyze")
def api_ai_analyze():
    try:
        us_data = get_us_market_close()
        news = fetch_us_market_news()
        return jsonify(analyze_overnight(us_data, news, DEEPSEEK_API_KEY))
    except Exception as e:
        return jsonify({"error": str(e), "sentiment_score": 0, "summary": "AI 分析失败"}), 500


@app.route("/api/etf-kline")
def api_etf_kline():
    symbol = request.args.get("symbol", "")
    days = int(request.args.get("days", "500"))
    try:
        return jsonify({"data": get_etf_kline(symbol, days)})
    except Exception as e:
        return jsonify({"error": str(e), "data": []}), 500


@app.route("/api/etf-kline-batch")
def api_etf_kline_batch():
    symbols = [s.strip() for s in request.args.get("symbols", "").split(",") if s.strip()]
    days = int(request.args.get("days", "500"))
    result = {}
    for symbol in symbols:
        try:
            result[symbol] = get_etf_kline(symbol, days)
        except Exception:
            result[symbol] = []
    return jsonify({"data": result})


@app.route("/api/etf-quotes")
def api_etf_quotes():
    symbols = [s.strip() for s in request.args.get("symbols", "").split(",") if s.strip()]
    try:
        return jsonify({"data": get_etf_realtime_quotes(symbols)})
    except Exception as e:
        return jsonify({"error": str(e), "data": {}}), 500


@app.route("/api/etf-premium")
def api_etf_premium():
    symbol = request.args.get("symbol", "")
    try:
        return jsonify({"data": get_etf_nav_and_premium(symbol)})
    except Exception as e:
        return jsonify({"error": str(e), "data": None}), 500


@app.route("/api/ashare-sentiment")
def api_ashare_sentiment():
    """A 股大盘情绪指标。"""
    try:
        quotes = tencent_quote(["510300", "510500", "159915"])
        result = {}
        for code, q in quotes.items():
            result[code] = {
                "name": q.get("name", ""),
                "change_pct": q.get("change_pct", 0),
                "turnover_pct": q.get("turnover_pct", 0),
            }

        changes = [q.get("change_pct", 0) for q in quotes.values() if q.get("change_pct")]
        avg_change = sum(changes) / len(changes) if changes else 0
        result["sentiment"] = {
            "avg_change": round(avg_change, 2),
            "bullish": avg_change > 0.5,
            "bearish": avg_change < -0.5,
        }
        return jsonify({"data": result})
    except Exception as e:
        return jsonify({"error": str(e), "data": {}}), 500


@app.route("/api/us-history")
def api_us_history():
    ticker = request.args.get("ticker", "")
    days = int(request.args.get("days", "500"))
    try:
        return jsonify({"data": get_us_ticker_history(ticker, days)})
    except Exception as e:
        return jsonify({"error": str(e), "data": []}), 500


@app.route("/api/health")
def health():
    """数据源连通性检查。"""
    return jsonify({
        "status": "ok",
        "deepseek_configured": bool(os.environ.get("DEEPSEEK_API_KEY", "")),
        "sources": {
            "mootdx": check_mootdx(),
            "tencent": check_tencent_source(),
            "sina_us": check_sina_us(),
            "eastmoney": check_eastmoney(),
        },
    })


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", "5001")), debug=True, use_reloader=False)
