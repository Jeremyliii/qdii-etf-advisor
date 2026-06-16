import json
import re
import time
from datetime import datetime

import requests

from sources.common import em_get
from sources.etf_quote import tencent_quote


def _to_float(value, default=None):
    try:
        return float(value) if value not in ("", None, "-") else default
    except (TypeError, ValueError):
        return default


def _fundgz_nav_estimate(symbol):
    """Return fund valuation data from EastMoney/1234567 when available."""
    url = f"http://fundgz.1234567.com.cn/js/{symbol}.js?rt={int(time.time() * 1000)}"
    try:
        r = requests.get(
            url,
            headers={
                "User-Agent": "Mozilla/5.0",
                "Referer": "https://fund.eastmoney.com/",
            },
            timeout=6,
        )
        match = re.search(r"jsonpgz\((.*)\)", r.text.strip())
        if not match:
            return None
        payload = match.group(1).strip()
        if not payload:
            return None
        data = json.loads(payload)
    except Exception:
        return None

    estimated_nav = _to_float(data.get("gsz"))
    latest_nav = _to_float(data.get("dwjz"))
    if estimated_nav and estimated_nav > 0:
        return {
            "nav_basis": estimated_nav,
            "nav_estimate": estimated_nav,
            "latest_nav": latest_nav,
            "nav_date": data.get("jzrq") or "",
            "nav_time": data.get("gztime") or "",
            "premium_source": "fundgz_estimated_nav",
        }
    if latest_nav and latest_nav > 0:
        return {
            "nav_basis": latest_nav,
            "nav_estimate": None,
            "latest_nav": latest_nav,
            "nav_date": data.get("jzrq") or "",
            "nav_time": data.get("gztime") or data.get("jzrq") or "",
            "premium_source": "fundgz_latest_nav",
        }
    return None


def _eastmoney_latest_nav(symbol):
    """Return latest official NAV from EastMoney fund detail data."""
    url = f"https://fund.eastmoney.com/pingzhongdata/{symbol}.js"
    try:
        r = em_get(
            url,
            params={"v": str(int(time.time() * 1000))},
            headers={
                "User-Agent": "Mozilla/5.0",
                "Referer": f"https://fund.eastmoney.com/{symbol}.html",
            },
            timeout=10,
        )
        match = re.search(r"var\s+Data_netWorthTrend\s*=\s*(\[.*?\]);", r.text, re.S)
        if not match:
            return None
        data = json.loads(match.group(1))
        if not data:
            return None
        latest = data[-1]
        latest_nav = _to_float(latest.get("y"))
        if not latest_nav or latest_nav <= 0:
            return None
        ts = latest.get("x")
        nav_date = ""
        if ts:
            nav_date = datetime.fromtimestamp(int(ts) / 1000).strftime("%Y-%m-%d")
        return {
            "nav_basis": latest_nav,
            "nav_estimate": None,
            "latest_nav": latest_nav,
            "nav_date": nav_date,
            "nav_time": nav_date,
            "premium_source": "eastmoney_latest_nav",
        }
    except Exception:
        return None


def _attach_premium(symbol, quote):
    nav = _fundgz_nav_estimate(symbol) or _eastmoney_latest_nav(symbol)
    price = _to_float(quote.get("price"))
    if nav and price and price > 0:
        nav_basis = nav["nav_basis"]
        quote.update(nav)
        quote["premium_rate"] = round((price - nav_basis) / nav_basis * 100, 2)
        quote["premium_available"] = True
    else:
        quote.update({
            "premium_rate": None,
            "premium_available": False,
            "premium_source": None,
            "nav_basis": None,
            "nav_estimate": None,
            "latest_nav": None,
            "nav_time": "",
            "nav_date": "",
        })
    return quote


def get_etf_realtime_quotes(symbols):
    """Real-time ETF quotes plus premium against fund valuation when available."""
    clean_symbols = [str(symbol).strip() for symbol in symbols if str(symbol).strip()]
    try:
        result = tencent_quote(clean_symbols)
    except Exception:
        result = {}
    for symbol in clean_symbols:
        quote = result.setdefault(symbol, {"price": 0, "change_pct": 0, "volume": 0, "amount": 0})
        _attach_premium(symbol, quote)
    return result


def get_etf_nav_and_premium(symbol):
    """Return quote plus fund valuation based premium when available."""
    quote = get_etf_realtime_quotes([symbol]).get(symbol, {})
    return {
        "symbol": symbol,
        "price": quote.get("price", 0),
        "nav": quote.get("nav_basis"),
        "premium_rate": quote.get("premium_rate"),
        "premium_available": quote.get("premium_available", False),
        "premium_source": quote.get("premium_source"),
        "nav_time": quote.get("nav_time", ""),
        "quote": quote,
        "note": "premium_rate uses fund valuation/latest NAV when a valid NAV basis is available; otherwise it is unavailable.",
    }
