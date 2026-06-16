import json
import re
import urllib.parse
import urllib.request
from datetime import datetime

from sources.common import em_get

TICKERS = {
    ".IXIC": {"name": "纳斯达克综合", "type": "index", "tencent": "IXIC", "eastmoney": "100.IXIC"},
    ".NDX": {"name": "纳斯达克100", "type": "index", "tencent": "NDX", "eastmoney": "100.NDX"},
    ".INX": {"name": "标普500", "type": "index", "tencent": "INX", "eastmoney": "100.INX"},
    ".DJI": {"name": "道琼斯", "type": "index", "tencent": "DJI", "eastmoney": "100.DJI"},
    "NVDA": {"name": "英伟达", "type": "stock", "tencent": "NVDA", "eastmoney": "105.NVDA"},
    "AAPL": {"name": "苹果", "type": "stock", "tencent": "AAPL", "eastmoney": "105.AAPL"},
    "MSFT": {"name": "微软", "type": "stock", "tencent": "MSFT", "eastmoney": "105.MSFT"},
    "GOOGL": {"name": "谷歌", "type": "stock", "tencent": "GOOGL", "eastmoney": "105.GOOGL"},
    "META": {"name": "Meta", "type": "stock", "tencent": "META", "eastmoney": "105.META"},
    "AMZN": {"name": "亚马逊", "type": "stock", "tencent": "AMZN", "eastmoney": "105.AMZN"},
    "TSLA": {"name": "特斯拉", "type": "stock", "tencent": "TSLA", "eastmoney": "105.TSLA"},
    "TSM": {"name": "台积电", "type": "stock", "tencent": "TSM", "eastmoney": "106.TSM"},
    "AVGO": {"name": "博通", "type": "stock", "tencent": "AVGO", "eastmoney": "105.AVGO"},
    "AMD": {"name": "AMD", "type": "stock", "tencent": "AMD", "eastmoney": "105.AMD"},
    "MU": {"name": "美光", "type": "stock", "tencent": "MU", "eastmoney": "105.MU"},
    "QCOM": {"name": "高通", "type": "stock", "tencent": "QCOM", "eastmoney": "105.QCOM"},
    "BABA": {"name": "阿里巴巴", "type": "stock", "tencent": "BABA", "eastmoney": "106.BABA"},
    "PDD": {"name": "拼多多", "type": "stock", "tencent": "PDD", "eastmoney": "105.PDD"},
    "JD": {"name": "京东", "type": "stock", "tencent": "JD", "eastmoney": "105.JD"},
}

WEEKDAYS = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"]


def _to_float(value, default=0):
    try:
        return float(value) if value not in ("", None, "-") else default
    except (TypeError, ValueError):
        return default


def _read_url(url, encoding="gbk", headers=None, timeout=10):
    req = urllib.request.Request(url)
    for key, value in (headers or {}).items():
        req.add_header(key, value)
    req.add_header("User-Agent", "Mozilla/5.0")
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read().decode(encoding, errors="ignore")


def _date_label(date_text):
    if not date_text:
        return ""
    try:
        dt = datetime.strptime(date_text[:10], "%Y-%m-%d")
        return f"{dt.strftime('%Y-%m-%d')}（{WEEKDAYS[dt.weekday()]}，美股交易日）"
    except ValueError:
        return date_text


def _batch_tencent_us(ticker_meta):
    query = ",".join(f"us{meta['tencent']}" for meta in ticker_meta.values())
    text = _read_url(f"https://qt.gtimg.cn/q={query}", encoding="gbk")
    results = {}
    for line in text.strip().split(";"):
        if not line.strip() or "=" not in line or '"' not in line:
            continue
        key = line.split("=")[0].split("_")[-1]
        raw_code = key[2:]
        vals = line.split('"')[1].split("~")
        if len(vals) < 35:
            continue
        symbol = next((ticker for ticker, meta in ticker_meta.items() if meta["tencent"] == raw_code), raw_code)
        meta = ticker_meta.get(symbol, {"name": vals[1], "type": "stock"})
        close = _to_float(vals[3])
        change_pct = _to_float(vals[32])
        if close == 0 and change_pct == 0:
            continue
        quote_time = vals[30] if len(vals) > 30 else ""
        data_date = quote_time[:10] if quote_time else ""
        results[symbol] = {
            "name": meta["name"],
            "type": meta["type"],
            "close": close,
            "change_pct": change_pct,
            "open": _to_float(vals[5]),
            "high": _to_float(vals[33]),
            "low": _to_float(vals[34]),
            "prev_close": _to_float(vals[4]),
            "volume": vals[36] if len(vals) > 36 else "0",
            "amount": _to_float(vals[37]) if len(vals) > 37 else 0,
            "time": quote_time,
            "data_date": data_date,
            "data_date_label": _date_label(data_date),
            "source": "tencent_us",
        }
    return results


def _eastmoney_us_quote(ticker, meta):
    secid = meta.get("eastmoney")
    if not secid:
        return None
    url = "https://push2.eastmoney.com/api/qt/stock/get"
    params = {
        "secid": secid,
        "fields": "f43,f44,f45,f46,f47,f48,f57,f58,f60,f169,f170,f171,f107",
    }
    r = em_get(url, params=params, headers={"Referer": "https://quote.eastmoney.com/"}, timeout=15)
    data = r.json().get("data", {}) or {}
    close = _to_float(data.get("f43")) / 1000
    if close == 0:
        return None
    return {
        "name": meta["name"],
        "type": meta["type"],
        "close": close,
        "change_pct": _to_float(data.get("f170")) / 100,
        "open": _to_float(data.get("f46")) / 1000,
        "high": _to_float(data.get("f44")) / 1000,
        "low": _to_float(data.get("f45")) / 1000,
        "prev_close": _to_float(data.get("f60")) / 1000,
        "volume": "0",
        "time": "",
        "data_date": "",
        "data_date_label": "",
        "source": "eastmoney_us",
    }


def _sina_json_quote(ticker, meta):
    callback = "callback"
    url = (
        "https://stock.finance.sina.com.cn/usstock/api/jsonp.php/"
        f"{callback}/US_MinKService.getStock?symbol={urllib.parse.quote(ticker.lower())}"
    )
    text = _read_url(url, encoding="utf-8", headers={"Referer": "https://finance.sina.com.cn/"})
    json_text = text[text.index("(") + 1 : text.rindex(")")]
    data = json.loads(json_text)
    close = _to_float(data.get("price") or data.get("last") or data.get("close"))
    prev_close = _to_float(data.get("prevclose") or data.get("prev_close"))
    change_pct = _to_float(data.get("chg") or data.get("changepercent") or data.get("percent"))
    if close == 0:
        return None
    if change_pct == 0 and prev_close:
        change_pct = (close - prev_close) / prev_close * 100
    quote_time = data.get("time") or data.get("date") or ""
    data_date = quote_time[:10] if quote_time else ""
    return {
        "name": meta["name"],
        "type": meta["type"],
        "close": close,
        "change_pct": change_pct,
        "open": _to_float(data.get("open")),
        "high": _to_float(data.get("high")),
        "low": _to_float(data.get("low")),
        "prev_close": prev_close,
        "volume": data.get("volume", "0"),
        "time": quote_time,
        "data_date": data_date,
        "data_date_label": _date_label(data_date),
        "source": "sina_us_json",
    }


def _sina_legacy_quote(ticker, meta):
    sina_ticker = ticker.replace(".", "").lower()
    text = _read_url(
        f"https://hq.sinajs.cn/list=gb_{sina_ticker}",
        encoding="gbk",
        headers={"Referer": "https://finance.sina.com.cn/"},
    )
    match = re.search(r'"(.*)"', text)
    if not match:
        return None
    vals = match.group(1).split(",")
    if len(vals) < 4 or not vals[1]:
        return None
    close = _to_float(vals[1])
    change_pct = _to_float(vals[2])
    quote_time = vals[3] if len(vals) > 3 else ""
    data_date = quote_time[:10] if quote_time else ""
    return {
        "name": meta["name"],
        "type": meta["type"],
        "close": close,
        "change_pct": change_pct,
        "open": _to_float(vals[5]) if len(vals) > 5 else 0,
        "high": _to_float(vals[6]) if len(vals) > 6 else 0,
        "low": _to_float(vals[7]) if len(vals) > 7 else 0,
        "prev_close": _to_float(vals[26]) if len(vals) > 26 else 0,
        "volume": vals[10] if len(vals) > 10 else "0",
        "time": quote_time,
        "data_date": data_date,
        "data_date_label": _date_label(data_date),
        "source": "sina_us_legacy",
    }


def _quote_with_fallback(ticker, meta):
    for getter in (_eastmoney_us_quote, _sina_json_quote, _sina_legacy_quote):
        try:
            quote = getter(ticker, meta)
            if quote and quote.get("close"):
                return quote
        except Exception:
            continue
    return {"name": meta["name"], "type": meta["type"], "error": "all quote sources failed"}


def _build_meta(results):
    dates = [
        item.get("data_date")
        for item in results.values()
        if isinstance(item, dict) and item.get("data_date")
    ]
    data_date = max(dates) if dates else ""
    sources = sorted({
        item.get("source")
        for item in results.values()
        if isinstance(item, dict) and item.get("source")
    })
    return {
        "data_date": data_date,
        "data_date_label": _date_label(data_date),
        "sources": sources,
    }


def get_us_market_close():
    """按 腾讯美股 > 东财美股 > 新浪美股 获取最近交易日收盘数据。"""
    results = {}
    try:
        results.update(_batch_tencent_us(TICKERS))
    except Exception:
        pass

    for ticker, meta in TICKERS.items():
        if ticker not in results:
            results[ticker] = _quote_with_fallback(ticker, meta)

    results["VIX"] = get_vix()
    results["_meta"] = _build_meta(results)
    return results


def get_us_futures():
    """获取美股期货盘前数据，Sina 失败时返回空对象。"""
    futures = {}
    for code, name in [("NQmain", "纳指期货"), ("ESmain", "标普期货")]:
        try:
            text = _read_url(
                f"https://hq.sinajs.cn/list=hf_{code}",
                encoding="gbk",
                headers={"Referer": "https://finance.sina.com.cn/"},
            )
            match = re.search(r'"(.*)"', text)
            if match:
                vals = match.group(1).split(",")
                futures[code] = {
                    "name": name,
                    "price": _to_float(vals[0]) if vals else 0,
                    "change_pct": _to_float(vals[1]) if len(vals) > 1 else 0,
                }
        except Exception:
            futures[code] = {"name": name, "price": 0, "change_pct": 0}
    return futures


def get_vix():
    """获取 VIX 恐慌指数。"""
    for code in ("VIX", ".VIX"):
        try:
            quotes = _batch_tencent_us({"VIX": {"name": "VIX", "type": "risk", "tencent": code, "eastmoney": "100.VIX"}})
            quote = quotes.get("VIX")
            if quote and quote.get("close"):
                return quote
        except Exception:
            continue
    return {"name": "VIX", "type": "risk", "close": 20, "change_pct": 0, "source": "fallback"}


def check_sina_us() -> bool:
    try:
        quote = _sina_legacy_quote("NVDA", TICKERS["NVDA"])
        return bool(quote and quote.get("close"))
    except Exception:
        return False
