import datetime

from .common import em_get


KEY_STOCKS = {
    "NVDA": "NVIDIA",
    "AAPL": "Apple",
    "MSFT": "Microsoft",
    "GOOGL": "Google",
    "META": "Meta",
    "AMZN": "Amazon",
    "TSLA": "Tesla",
    "TSM": "TSMC",
    "AVGO": "Broadcom",
    "AMD": "AMD",
    "MU": "Micron",
    "QCOM": "Qualcomm",
}


def get_earnings_calendar(days=2):
    """Fetch near-term US earnings calendar, filtered to key linked stocks."""
    today = datetime.date.today()
    end = today + datetime.timedelta(days=max(1, int(days or 2)))
    url = "https://datacenter-web.eastmoney.com/api/data/v1/get"
    params = {
        "reportName": "RPT_USSTOCK_EARNING",
        "columns": "ALL",
        "filter": f"(REPORT_DATE>='{today:%Y-%m-%d}')(REPORT_DATE<='{end:%Y-%m-%d}')",
        "pageSize": "100",
        "sortColumns": "REPORT_DATE",
        "sortTypes": "1",
    }
    try:
        data = em_get(url, params=params).json()
        result = data.get("result") or {}
        rows = result.get("data", []) or []
    except Exception as exc:
        return {
            "earnings": [],
            "has_key_earnings": False,
            "error": str(exc),
        }

    earnings = []
    for item in rows:
        code = (item.get("SECURITY_CODE") or item.get("SECUCODE") or "").split(".")[0].upper()
        if code not in KEY_STOCKS:
            continue
        earnings.append({
            "ticker": code,
            "name": KEY_STOCKS[code],
            "date": item.get("REPORT_DATE") or item.get("NOTICE_DATE") or "",
            "time": item.get("REPORT_TIME") or item.get("EARNINGS_TIME") or "after/before market",
        })

    return {
        "earnings": earnings,
        "has_key_earnings": len(earnings) > 0,
    }
