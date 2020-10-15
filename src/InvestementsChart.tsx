import * as R from 'ramda';
import * as React from 'react';
import {VegaLite, VisualizationSpec} from 'react-vega'

import {Beancount} from './BeancountConverterService';
import {HistoricalData} from './FinanceService';
import BeancountParser from './BeancountParser';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface InvestementsChartProps {
  beancount: Beancount;
  historicalData: readonly HistoricalData[];
  includeDividends?: boolean;
  onlyDividends?: boolean;
}

const vegaSpec: VisualizationSpec = {
  width: 400,
  height: 200,
  mark: {type: 'bar', tooltip: true},
  encoding: {
    x: {field: 'Month', type: 'ordinal', sort: MONTHS},
    y: {field: 'Price', type: 'quantitative'},
  },
  data: { name: 'table' },
};

const InvestementsChart: React.FC<InvestementsChartProps> = ({
  beancount,
  historicalData,
  includeDividends = false,
  onlyDividends = false,
}) => {
  const data = React.useMemo(() => {
    if (historicalData.length === 0) {
      return {};
    }

    const historicalEntries = historicalData.flatMap(
      historicalDatum =>
        historicalDatum.historical.map(entry => ({
          ...entry,
          symbol: historicalDatum.symbol,
        }),
      ),
    );

    const historicalEntriesByMonth = R.groupBy(
      entry => {
        const [,month] = entry.date.split('-')

        return String(Number(month));
      },
      historicalEntries,
    );

    const allStockTransactions = BeancountParser.getStockTransactions(beancount);
    const allDividendTransactions = BeancountParser.getDividendTransactions(beancount);

    const table = MONTHS
      .map((month, idx) => {
        const monthIdx = idx + 1;

        const monthHistoricalEntries = historicalEntriesByMonth[monthIdx];

        if (!monthHistoricalEntries) {
          return null;
        }

        const monthHistoricalDataByStock = R.groupBy(R.prop('symbol'), monthHistoricalEntries);
        const latestMonthDataByStock = R.mapObjIndexed(
          stockData => R.last(R.sortBy(R.prop('date'), stockData)),
          monthHistoricalDataByStock,
        );

        const monthAllStockTransactions = allStockTransactions.filter(
          transaction => monthIdx >= transaction.date.month,
        );
        const monthAllDividendTransactions = allDividendTransactions.filter(
          transaction => monthIdx >= transaction.date.month,
        );

        const stockSymbols = Object.keys(latestMonthDataByStock);

        const price = R.sum(
          stockSymbols.map(stockSymbol => {
            const stockTransactions = monthAllStockTransactions.filter(
              transaction => transaction.symbol === stockSymbol,
            );
            const dividedndTransactions = monthAllDividendTransactions.filter(
              transaction => transaction.symbol === stockSymbol,
            );

            const stockQuantity = onlyDividends
              ? 0
              : R.sum(
                  stockTransactions.map(transaction => transaction.stockPosting.units.number)
                );
            const dividendTotal = onlyDividends || includeDividends
              ? R.sum(
                  dividedndTransactions.map(transactions => transactions.cashPosting.units.number)
                )
              : 0;

            const stockClosePrice = latestMonthDataByStock[stockSymbol]?.close || 0;

            return stockQuantity * stockClosePrice + dividendTotal;
          })
        );

        return {
          Month: month,
          Price: price,
        }
      })
    .filter(Boolean)

    return {table};
  }, [beancount, historicalData, includeDividends, onlyDividends]);

  return <VegaLite spec={vegaSpec} data={data} />;
};

export default InvestementsChart;
