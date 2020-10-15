import * as R from 'ramda';
import DatePicker from 'react-datepicker';
import raw from "raw.macro";
import React from 'react';
import "react-datepicker/dist/react-datepicker.css";

import BeancountConverterService, {Beancount} from './BeancountConverterService';
import BeancountParser from './BeancountParser';
import FinanceService, {HistoricalData} from './FinanceService';
import InvestementsChart from './InvestementsChart';
import './App.css';

const beancountAsString = raw('./ibkr.bean');

const STOCK_SYMBOLS = ['VTI', 'VXUS', 'BND'];

const now = new Date();
const DATE_RANGE: [string, string] = [
  '2020-01-08',
  `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`,
];

const App: React.FC = () => {
  const [beancount, setBeancount] = React.useState<Beancount | null>(null);
  const [historicalData, setHistoricalData] = React.useState<readonly HistoricalData[] | null>(null);

  const [includeDividends, setIncludeDividends] = React.useState(false);
  const [onlyDividends, setOnlyDividends] = React.useState(false);
  const [onlyReturns, setOnlyReturns] = React.useState(false);

  const [startDate, setStartDate] = React.useState(() => new Date('2020-01-08'));
  const [endDate, setEndDate] = React.useState(() => new Date());

  React.useEffect(() => {
    const setUpDependencies = async () => {
      const [nextBeancount, nextHistoricalData] = await Promise.all([
        BeancountConverterService.getJson(beancountAsString),
        FinanceService.getHistoricalData({symbols: STOCK_SYMBOLS, dateRange: DATE_RANGE}),
      ]);

      setBeancount(nextBeancount);
      setHistoricalData(nextHistoricalData);
    };

    setUpDependencies();
  }, []);

  const returns = React.useMemo(() => {
    if (!beancount || !historicalData) {
      return null;
    }

    const upTos = [startDate, endDate].map(date => ({
      month: date.getMonth() + 1,
      year: date.getFullYear(),
    }));

    const stockTotals = STOCK_SYMBOLS.flatMap(symbol => {
      const [beginning, end] = upTos.map(upTo => ({
        total: BeancountParser.getTotalWithoutCommissions(beancount, historicalData, {
          symbol,
          upTo,
          includeDividends: true,
        }),
        totalExDividends: BeancountParser.getTotalWithoutCommissions(beancount, historicalData, {
          symbol,
          upTo,
          includeDividends: false,
        }),
        totalDividends: BeancountParser.getTotalWithoutCommissions(beancount, historicalData, {
          symbol,
          upTo,
          onlyDividends: true,
        }),
      }));

      return {
        symbol,
        beginning,
        end,
      }
    });

    const [upToBeginning, upToEnd] = upTos;
    const comissionTransactions = BeancountParser
      .getCommissionTransactions(beancount)
      .filter(
        transaction =>
          (upToBeginning.month <= transaction.date.month &&
            upToBeginning.year <= transaction.date.year) ||
          (upToEnd.month >= transaction.date.month &&
            upToEnd.year >= transaction.date.year)
      );
    const commissionsTotal = R.sum(
      comissionTransactions.map(transaction => transaction.comissionPosting.units.number)
    );

    const stockBeginningTotal = R.sum(stockTotals.map(stockTotal => stockTotal.beginning.total));
    const stockEndTotal = R.sum(stockTotals.map(stockTotal => stockTotal.end.total)) - commissionsTotal;
    const stockTotalReturn = (stockEndTotal - stockBeginningTotal) / stockBeginningTotal * 100;

    const stockBeginningTotalExDividends = R.sum(stockTotals.map(stockTotal => stockTotal.beginning.totalExDividends));
    const stockEndTotalExDividends = R.sum(stockTotals.map(stockTotal => stockTotal.end.totalExDividends)) - commissionsTotal;
    const stockTotalExDividendsReturn = (stockEndTotalExDividends - stockBeginningTotalExDividends) / stockBeginningTotalExDividends * 100;

    const stockTotalDividendsOnlyReturn = stockTotalReturn - stockTotalExDividendsReturn;

    return {
      stockTotals,
      stockTotalReturn,
      stockTotalExDividendsReturn,
      stockTotalDividendsOnlyReturn,
    };
  }, [beancount, historicalData, startDate, endDate]);

  const handleChangeIncludeDividends: React.ChangeEventHandler<HTMLInputElement> = (
    event
  ) => {
    setIncludeDividends(event.target.checked);
  }

  const handleChangeOnlyDividends: React.ChangeEventHandler<HTMLInputElement> = (
    event
  ) => {
    setOnlyDividends(event.target.checked);
  }

  const handleChangeOnlyReturns: React.ChangeEventHandler<HTMLInputElement> = (
    event
  ) => {
    setOnlyReturns(event.target.checked);
  }

  return (
    <div>
      <article className="Chart">
        <h1>Chart</h1>
        <div>
          {!onlyDividends && (
            <label>
              Include Dividends
              <input
                name="includeDividends"
                type="checkbox"
                checked={includeDividends}
                onChange={handleChangeIncludeDividends}
              />
            </label>
          )}
          <label>
            Only Dividends
            <input
              name="onlyDividends"
              type="checkbox"
              checked={onlyDividends}
              onChange={handleChangeOnlyDividends}
            />
          </label>
          {!onlyDividends && (
            <label>
              Returns Per Month
              <input
                name="onlyReturns"
                type="checkbox"
                checked={onlyReturns}
                onChange={handleChangeOnlyReturns}
              />
            </label>
          )}
        </div>
        {beancount && (
          <InvestementsChart
            beancount={beancount}
            historicalData={historicalData || []}
            includeDividends={includeDividends}
            onlyDividends={onlyDividends}
            onlyReturns={onlyReturns}
          />
        )}
      </article>
      {returns && (
        <div className="Returns">
          <h1>Returns for selected period</h1>
          <DatePicker
            selectsStart
            minDate={new Date(DATE_RANGE[0])}
            filterDate={date => date.getMonth() !== endDate.getMonth()}
            selected={startDate}
            startDate={startDate}
            endDate={endDate}
            onChange={setStartDate as any}
          />
          <DatePicker
            selectsEnd
            minDate={startDate}
            maxDate={new Date(DATE_RANGE[1])}
            filterDate={date => date.getMonth() !== startDate.getMonth()}
            selected={endDate}
            startDate={startDate}
            endDate={endDate}
            onChange={setEndDate as any}
          />
          <article>
            <h2>Per share performance</h2>
            <table>
              <thead>
                <tr>
                  <td>Symbol</td>
                  <td>Total</td>
                  <td>Ex-Dividends</td>
                  <td>Dividends Only</td>
                </tr>
              </thead>
              <tbody>
                {returns.stockTotals.map(ret => (
                  <tr key={ret.symbol}>
                    <td>{ret.symbol}</td>
                    <td>${(ret.end.total - ret.beginning.total).toFixed(2)}</td>
                    <td>${(ret.end.totalExDividends - ret.beginning.totalExDividends).toFixed(2)}</td>
                    <td>${(ret.end.totalDividends - ret.beginning.totalDividends).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </article>
          <article>
            <h2>Returns</h2>
            <table>
              <thead>
                <tr>
                  <td>Total</td>
                  <td>Ex-Dividends</td>
                  <td>Dividends Only</td>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>%{returns.stockTotalReturn.toFixed(2)}</td>
                  <td>%{returns.stockTotalExDividendsReturn.toFixed(2)}</td>
                  <td>%{returns.stockTotalDividendsOnlyReturn.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </article>
        </div>
      )}
    </div>
  );
}

export default App;
