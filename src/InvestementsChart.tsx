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

    const comissionTransactions = BeancountParser.getCommissionTransactions(beancount);

    const currentMonth = new Date().getMonth() + 1;

    const table = MONTHS
      .map((month, idx) => {
        const monthIdx = idx + 1;

        if (monthIdx > currentMonth) {
          return null;
        }

        const price = R.sum(
          stockSymbols.map(
            symbol => {
              const totalWithoutCommissions = BeancountParser.getTotalWithoutCommissions(beancount, historicalData, {
                symbol,
                onlyDividends,
                includeDividends,
                onlyReturns,
                upTo: {month: monthIdx, year: 2020}
              })

              const monthCommissionTransactions = comissionTransactions.filter(
                transaction => monthIdx >= transaction.date.month,
              );
              const comissionTotal = onlyDividends
                ? 0
                : R.sum(
                    monthCommissionTransactions.map(transaction => transaction.comissionPosting.units.number)
                  );

              return totalWithoutCommissions - comissionTotal;
            },
          )
        );

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
