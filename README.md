# QDII ETF 隔夜联动决策系统

> **这是旧版，已不再维护。** 后续版本是 [us-stock-insight](https://github.com/hhbgj/us-stock-insight)：从“预测明天涨跌”改成了“按规则判断现在处在什么位置”（买入线、卖出指标、纳指止盈），原因是事后核对发现，这类打分和之后的实际涨跌基本不相关。
>
> *Archived first version of [us-stock-insight](https://github.com/hhbgj/us-stock-insight): a local dashboard for China-listed QDII ETFs that tracks the overnight US market, VIX, A-share sentiment, ETF premiums and technicals, and combines them with DeepSeek analysis into a direction score and a buy-opportunity score.*

本项目是一个本地运行的 QDII ETF 每日决策系统，用于跟踪隔夜美股、A 股情绪、ETF 溢价、技术面和 AI 分析，辅助生成“方向预测”和“操作建议”。

> 仅供研究和辅助决策，不构成投资建议。QDII ETF 存在溢价、汇率、流动性、T+1、海外市场波动等风险。

## 服务结构

- `data-service`: Python Flask 数据服务，默认端口 `5001`
- `server`: Node.js + Express API 服务，默认端口 `3002`
- `client`: Vite + React 前端，默认端口 `5173`
- `push`: OpenClaw 微信日报推送脚本

## 安装依赖

```powershell
npm run install:all

cd data-service
pip install -r requirements.txt
```

## 配置 DeepSeek

复制示例环境文件：

```powershell
Copy-Item data-service\.env.example data-service\.env
```

然后在 `data-service\.env` 中填写：

```text
DEEPSEEK_API_KEY=your_deepseek_api_key_here
```

注意：`.env` 已加入 `.gitignore`，不要把真实 API Key 上传到 GitHub。

## 本地运行

在仓库根目录分别打开三个终端：

```powershell
cd data-service
python app.py
```

```powershell
cd server
node index.js
```

```powershell
cd client
npm run dev
```

浏览器打开：

```text
http://localhost:5173
```

## 核心接口

- `GET /api/health`: 数据源健康检查
- `GET /api/decisions`: 今日 ETF 决策
- `GET /api/prediction`: 明日涨跌方向预测
- `POST /api/backtest`: 预测准确率和操作建议回测

## 评分逻辑

系统拆分为两个独立分数：

- `directionScore`: 明日涨跌方向预测，主要看隔夜联动、VIX、A 股情绪等。
- `opportunityScore`: 当前买入机会，主要看折溢价、技术面、回撤、极端波动等。

操作建议由两者组合生成：

- 强烈买入
- 逢低买入
- 可以建仓
- 不追高
- 回避
- 观望
