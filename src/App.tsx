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

    const symbolTotals = STOCK_SYMBOLS.flatMap(symbol => {
      const [beginningStockTotal, endStockTotal] = upTos.map(
        (upTo, idx) => ({
          stock: BeancountParser.getStockTotal(beancount, historicalData, {
            symbol,
            upTo,
            useOpenPrice: idx === 0,
          }),
          dividend: BeancountParser.getDividendTotal(beancount, {
            symbol,
            upTo,
          }),
        }),
      );

      return {
        symbol,
        beginning: beginningStockTotal,
        end: endStockTotal,
      }
    });

    const stockBeginningTotal = R.sum(symbolTotals.map(symbolTotal => symbolTotal.beginning.stock));
    const stockEndTotal = R.sum(symbolTotals.map(symbolTotal => symbolTotal.end.stock));
    const stockTotalReturn = (stockEndTotal - stockBeginningTotal) / stockBeginningTotal * 100;

    const stockWithDividendBeginningTotal = R.sum(
      symbolTotals.map(
        symbolTotal => symbolTotal.beginning.stock + symbolTotal.beginning.dividend,
      ),
    );
    const stockWithDividendEndTotal = R.sum(
      symbolTotals.map(
        symbolTotal => symbolTotal.end.stock + symbolTotal.end.dividend,
      ),
    );
    const stockWithDividendTotalReturn =
      (stockWithDividendEndTotal - stockWithDividendBeginningTotal) /
      stockWithDividendBeginningTotal * 100;

    return {
      symbolTotals,
      stockTotalReturn,
      stockWithDividendTotalReturn,
      dividendTotalReturn: stockWithDividendTotalReturn - stockTotalReturn,
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
                  <td>% Total</td>
                  <td>Total</td>
                  <td>Ex-Dividends</td>
                  <td>Dividends Only</td>
                </tr>
              </thead>
              <tbody>
                {returns.symbolTotals.map(symbolTotal => {
                  const stockTotalsWithDividend =
                    symbolTotal.end.stock + symbolTotal.end.dividend -
                    symbolTotal.beginning.stock + symbolTotal.beginning.dividend;
                  const stockTotalsWithDividendROI =
                    stockTotalsWithDividend /
                    (symbolTotal.beginning.stock + symbolTotal.beginning.dividend) * 100;

                  return (
                    <tr key={symbolTotal.symbol}>
                      <td>{symbolTotal.symbol}</td>
                      <td>%{stockTotalsWithDividendROI.toFixed(2)}</td>
                      <td>${stockTotalsWithDividend.toFixed(2)}</td>
                      <td>${(symbolTotal.end.stock - symbolTotal.beginning.stock).toFixed(2)}</td>
                      <td>${(symbolTotal.end.dividend - symbolTotal.beginning.dividend).toFixed(2)}</td>
                    </tr>
                  );
                })}
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
                  <td>%{returns.stockWithDividendTotalReturn.toFixed(2)}</td>
                  <td>%{returns.stockTotalReturn.toFixed(2)}</td>
                  <td>%{returns.dividendTotalReturn.toFixed(2)}</td>
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
