// Only include exchange-traded products that return valid real-time quotes.
// OTC mutual funds and products whose quote name does not match the strategy mapping stay out of this pool.
const QDII_ETF_POOL = [
  { symbol: '513100', name: '纳指ETF', manager: '国泰', tracking: '纳斯达克100', sector: 'nasdaq100', linkedTickers: ['NVDA', 'AAPL', 'MSFT', 'GOOGL', 'META', 'TSLA', 'AMZN'], lotSize: 100 },
  { symbol: '159941', name: '纳指ETF', manager: '广发', tracking: '纳斯达克100', sector: 'nasdaq100', linkedTickers: ['NVDA', 'AAPL', 'MSFT'], lotSize: 100 },
  { symbol: '513300', name: '纳斯达克ETF', manager: '华夏', tracking: '纳斯达克100', sector: 'nasdaq100', linkedTickers: ['NVDA', 'AAPL', 'MSFT'], lotSize: 100 },
  { symbol: '513390', name: '纳指100ETF', manager: '博时', tracking: '纳斯达克100', sector: 'nasdaq100', linkedTickers: ['NVDA', 'AAPL', 'MSFT', 'GOOGL', 'META'], lotSize: 100 },
  { symbol: '159632', name: '纳斯达克ETF', manager: '华安', tracking: '纳斯达克100', sector: 'nasdaq100', linkedTickers: ['NVDA', 'AAPL', 'MSFT', 'GOOGL', 'META'], lotSize: 100 },
  { symbol: '159513', name: '纳斯达克100ETF', manager: '大成', tracking: '纳斯达克100', sector: 'nasdaq100', linkedTickers: ['NVDA', 'AAPL', 'MSFT', 'GOOGL', 'META'], lotSize: 100 },
  { symbol: '513110', name: '纳指ETF', manager: '华泰柏瑞', tracking: '纳斯达克100', sector: 'nasdaq100', linkedTickers: ['NVDA', 'AAPL', 'MSFT', 'GOOGL', 'META'], lotSize: 100 },
  { symbol: '513870', name: '纳指ETF', manager: '富国', tracking: '纳斯达克100', sector: 'nasdaq100', linkedTickers: ['NVDA', 'AAPL', 'MSFT', 'GOOGL', 'META'], lotSize: 100 },
  { symbol: '159659', name: '纳斯达克100ETF', manager: '招商', tracking: '纳斯达克100', sector: 'nasdaq100', linkedTickers: ['NVDA', 'AAPL', 'MSFT', 'GOOGL', 'META'], lotSize: 100 },
  { symbol: '159501', name: '纳指ETF', manager: '嘉实', tracking: '纳斯达克100', sector: 'nasdaq100', linkedTickers: ['NVDA', 'AAPL', 'MSFT', 'GOOGL', 'META'], lotSize: 100 },
  { symbol: '159509', name: '纳指科技ETF', manager: '景顺长城', tracking: '纳斯达克科技市值加权', sector: 'nasdaq_tech', linkedTickers: ['NVDA', 'AAPL', 'MSFT', 'AVGO', 'AMD'], lotSize: 100 },

  { symbol: '513500', name: '标普500ETF', manager: '博时', tracking: '标普500', sector: 'sp500', linkedTickers: ['AAPL', 'MSFT', 'NVDA', 'AMZN', 'META'], lotSize: 100 },
  { symbol: '159612', name: '标普500ETF', manager: '国泰', tracking: '标普500', sector: 'sp500', linkedTickers: ['AAPL', 'MSFT', 'NVDA'], lotSize: 100 },
  { symbol: '513650', name: '标普500ETF', manager: '南方', tracking: '标普500', sector: 'sp500', linkedTickers: ['AAPL', 'MSFT', 'NVDA', 'AMZN', 'META'], lotSize: 100 },
  { symbol: '513400', name: '道琼斯ETF', manager: '鹏华', tracking: '道琼斯工业平均', sector: 'dow', linkedTickers: ['DJI', 'AAPL', 'MSFT', 'JPM', 'V'], lotSize: 100 },
  { symbol: '513290', name: '纳指生物科技ETF', manager: '汇添富', tracking: '纳斯达克生物科技', sector: 'biotech', linkedTickers: ['IBB', 'AMGN', 'GILD', 'REGN', 'VRTX'], lotSize: 100 },

  { symbol: '513310', name: '中韩半导体ETF', manager: '华泰柏瑞', tracking: '中韩半导体', sector: 'semiconductor', linkedTickers: ['TSM', 'NVDA', 'AVGO', 'AMD'], lotSize: 100 },

  { symbol: '513130', name: '恒生科技ETF', manager: '华泰柏瑞', tracking: '恒生科技', sector: 'hk_tech', linkedTickers: ['9988.HK', '0700.HK', '3690.HK'], lotSize: 100 },
  { symbol: '513890', name: '恒生科技ETF', manager: '摩根', tracking: '恒生科技', sector: 'hk_tech', linkedTickers: ['9988.HK', '0700.HK', '3690.HK'], lotSize: 100 },
  { symbol: '513380', name: '恒生科技ETF', manager: '广发', tracking: '恒生科技', sector: 'hk_tech', linkedTickers: ['9988.HK', '0700.HK', '3690.HK'], lotSize: 100 },
  { symbol: '513180', name: '恒生科技ETF', manager: '华夏', tracking: '恒生科技', sector: 'hk_tech', linkedTickers: ['9988.HK', '0700.HK', '3690.HK'], lotSize: 100 },
  { symbol: '513580', name: '恒生科技ETF', manager: '华安', tracking: '恒生科技', sector: 'hk_tech', linkedTickers: ['9988.HK', '0700.HK', '3690.HK'], lotSize: 100 },

  { symbol: '513050', name: '中概互联网ETF', manager: '易方达', tracking: '中国互联网50', sector: 'china_internet', linkedTickers: ['BABA', 'PDD', 'JD'], lotSize: 100 },
  { symbol: '159605', name: '中概互联ETF', manager: '广发', tracking: '中国互联网50', sector: 'china_internet', linkedTickers: ['BABA', 'PDD'], lotSize: 100 },
  { symbol: '513220', name: '中概互联ETF', manager: '招商', tracking: '中国互联网50', sector: 'china_internet', linkedTickers: ['BABA', 'PDD', 'JD'], lotSize: 100 },
  { symbol: '513330', name: '恒生互联网ETF', manager: '华夏', tracking: '恒生互联网科技业', sector: 'china_internet', linkedTickers: ['9988.HK', '0700.HK', '3690.HK'], lotSize: 100 },

  { symbol: '159920', name: '恒生ETF', manager: '华夏', tracking: '恒生指数', sector: 'hk', linkedTickers: ['0005.HK', '1299.HK', '0700.HK'], lotSize: 100 },
  { symbol: '513030', name: '德国ETF', manager: '华安', tracking: 'DAX30', sector: 'europe', linkedTickers: ['SAP', 'SIE.DE'], lotSize: 100 },
  { symbol: '513520', name: '日经ETF', manager: '华夏', tracking: '日经225', sector: 'japan', linkedTickers: ['7203.T', '6758.T', '9984.T'], lotSize: 100 }
];

module.exports = { QDII_ETF_POOL };
