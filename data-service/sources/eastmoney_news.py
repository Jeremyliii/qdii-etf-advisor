import json
import re
import time

from sources.common import UA, em_get


def eastmoney_etf_news(name: str, page_size: int = 20) -> list[dict]:
    """东财 ETF 相关新闻，使用 search-api-web JSONP。"""
    keyword = (name or "").strip()
    if not keyword:
        return []

    cb = "jQuery_news"
    url = "https://search-api-web.eastmoney.com/search/jsonp"
    inner_params = json.dumps({
        "uid": "",
        "keyword": keyword,
        "type": ["cmsArticleWebOld"],
        "client": "web",
        "clientType": "web",
        "clientVersion": "curr",
        "param": {
            "cmsArticleWebOld": {
                "searchScope": "default",
                "sort": "default",
                "pageIndex": 1,
                "pageSize": page_size,
                "preTag": "",
                "postTag": "",
            }
        },
    }, separators=(",", ":"))
    params = {"cb": cb, "param": inner_params, "_": str(int(time.time() * 1000))}
    headers = {"User-Agent": UA, "Referer": "https://so.eastmoney.com/"}
    r = em_get(url, params=params, headers=headers, timeout=15)

    text = r.text
    json_str = text[text.index("(") + 1 : text.rindex(")")]
    data = json.loads(json_str)

    rows = []
    articles = data.get("result", {}).get("cmsArticleWebOld", []) or []
    for article in articles:
        rows.append({
            "title": re.sub(r"<[^>]+>", "", article.get("title", "")),
            "content": re.sub(r"<[^>]+>", "", article.get("content", ""))[:200],
            "time": article.get("date", ""),
            "source": article.get("mediaName", ""),
            "url": article.get("url", ""),
        })
    return rows


def eastmoney_global_news(page_size: int = 30) -> list[dict]:
    """东方财富全球资讯，备用给健康检查和直接复用。"""
    url = "https://np-weblist.eastmoney.com/comm/web/getNewsByColumns"
    params = {
        "client": "web",
        "biz": "web_news_col",
        "column": "102",
        "pageSize": str(page_size),
        "pageIndex": "0",
        "req_trace": f"qdii_{int(time.time() * 1000)}",
    }
    r = em_get(url, params=params, headers={"Referer": "https://finance.eastmoney.com/"})
    data = r.json()
    payload = data.get("data") or {}
    items = payload.get("list") or payload.get("news") or payload.get("items") or []
    if not items:
        url = "https://np-weblist.eastmoney.com/comm/web/getFastNewsList"
        now_ms = str(int(time.time() * 1000))
        params = {
            "client": "web",
            "biz": "web_724",
            "fastColumn": "102",
            "sortEnd": "",
            "pageSize": str(page_size),
            "req_trace": now_ms,
            "_": now_ms,
        }
        r = em_get(url, params=params, headers={"Referer": "https://kuaixun.eastmoney.com/"})
        payload = r.json().get("data") or {}
        items = payload.get("fastNewsList") or []
    rows = []
    for item in items:
        rows.append({
            "title": item.get("title", "") or item.get("Title", ""),
            "summary": (item.get("summary", "") or item.get("digest", "") or "")[:200],
            "time": item.get("showTime", "") or item.get("time", "") or item.get("publishTime", ""),
            "url": item.get("url", "") or item.get("Url", "") or item.get("newsUrl", ""),
        })
    return rows
