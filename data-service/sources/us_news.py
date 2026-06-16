import time

import requests

from sources.common import em_get

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/117.0.0.0"


def _add_unique(rows, seen, item):
    title = item.get("title", "").strip()
    if title and title not in seen:
        rows.append(item)
        seen.add(title)


def fetch_us_market_news():
    """收集美股相关新闻：新浪财经 + 东财全球资讯。"""
    all_news = []
    seen = set()

    try:
        url = "https://feed.mix.sina.com.cn/api/roll/get?pageid=155&lid=2514&num=30&encode=utf-8"
        r = requests.get(url, headers={"User-Agent": UA}, timeout=10)
        data = r.json()
        for item in data.get("result", {}).get("data", []):
            _add_unique(all_news, seen, {
                "title": item.get("title", "").strip(),
                "source": "新浪财经",
                "url": item.get("url", ""),
                "time": item.get("ctime", ""),
            })
    except Exception:
        pass

    try:
        url = "https://np-weblist.eastmoney.com/comm/web/getNewsByColumns"
        params = {
            "columns": "102",
            "pageSize": "30",
            "pageIndex": "0",
            "req_trace": f"qdii_{int(time.time() * 1000)}",
        }
        r = em_get(url, params=params, headers={"Referer": "https://finance.eastmoney.com/"})
        data = r.json()
        items = (
            data.get("data", {}).get("list")
            or data.get("data", {}).get("news")
            or data.get("data", {}).get("items")
            or []
        )
        for item in items:
            _add_unique(all_news, seen, {
                "title": item.get("title", "") or item.get("Title", ""),
                "source": "东方财富全球资讯",
                "url": item.get("url", "") or item.get("Url", "") or item.get("newsUrl", ""),
                "time": item.get("showTime", "") or item.get("time", "") or item.get("publishTime", ""),
            })
    except Exception:
        pass

    if not all_news:
        all_news.append({
            "title": "新闻源暂时不可用，系统将主要依据隔夜行情和技术指标生成保守信号",
            "source": "系统提示",
            "url": "",
            "time": "",
        })

    return all_news[:40]
