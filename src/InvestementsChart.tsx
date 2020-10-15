import * as R from 'ramda';
import * as React from 'react';
import {VegaLite, VisualizationSpec} from 'react-vega'

import {Beancount} from './BeancountConverterService';
import {HistoricalData} from './FinanceService';
import BeancountParser from './BeancountParser';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

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

interface InvestementsChartProps {
  beancount: Beancount;
  historicalData: readonly HistoricalData[];
  includeDividends?: boolean;
  onlyDividends?: boolean;
  onlyReturns?: boolean;
}

const InvestementsChart: React.FC<InvestementsChartProps> = ({
  beancount,
  historicalData,
  includeDividends = false,
  onlyDividends = false,
  onlyReturns = false,
}) => {
  const data = React.useMemo(() => {
    if (historicalData.length === 0) {
      return {};
    }

    const stockSymbols = R.uniq(historicalData.map(datum => datum.symbol));

    const currentMonth = new Date().getMonth() + 1;

    const table = MONTHS
      .map((month, idx) => {
        const monthIdx = idx + 1;

        if (monthIdx > currentMonth) {
          return null;
        }

        const upTo = {month: monthIdx, year: 2020};

        const stockTotals = onlyDividends
          ? []
          : stockSymbols.map(stockSymbol =>
              BeancountParser.getStockTotal(
                beancount,
                historicalData,
                {
                  upTo,
                  symbol: stockSymbol,
                  onlyReturns,
                },
              ),
            );
        const dividendTotals = includeDividends && !onlyDividends
          ? []
          : stockSymbols.map(stockSymbol =>
              BeancountParser.getDividendTotal(beancount, {
                upTo,
                symbol: stockSymbol,
              }),
            );

        const stockTotal = R.sum(stockTotals);
        const dividendTotal = R.sum(dividendTotals);
        const cashTotal = onlyReturns
          ? 0
          : BeancountParser.getCashTotal(beancount, {upTo});

        const price = onlyDividends
          ? dividendTotal
          : (stockTotal + (onlyReturns ? dividendTotal : cashTotal - dividendTotal));

        return {
          Month: month,
          Price: price,
        }
      })
    .filter(Boolean)

    return {table};
  }, [beancount, historicalData, includeDividends, onlyDividends, onlyReturns]);

  return <VegaLite spec={vegaSpec} data={data} />;
};

export default InvestementsChart;
