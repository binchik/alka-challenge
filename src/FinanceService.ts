import historicalDataSnapshot from './historicalDataSnapshot.json';

export interface HistoricalDataEntry {
  date: string;
  label: string;
  adjClose: number;
  change: number;
  changeOverTime: number;
  changePercent: number;
  close: number;
  high: number;
  low: number;
  open: number;
  unadjustedVolume: number;
  volume: number;
  vwap: number;
}

export interface HistoricalData {
  symbol: string;
  historical: readonly HistoricalDataEntry[];
}

const API_KEY = '074e48a0182bd76011ab6560eddfa501';

const FinanceService = {
  getHistoricalData: async (config: {
    symbols: readonly string[];
    dateRange: [string, string];
  }): Promise<readonly HistoricalData[]> => {
    // const symbolsCommaSeparated = config.symbols.join(',');
    // const [from, to] = config.dateRange;

    // const res = await fetch(
    //   `https://financialmodelingprep.com/api/v3/historical-price-full/${symbolsCommaSeparated}?from=${from}&to=${to}&apikey=${API_KEY}`,
    // );

    // const {historicalStockList} = await res.json();

    return historicalDataSnapshot;
  }
}

export default FinanceService;
