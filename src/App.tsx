import raw from "raw.macro";
import React from 'react';

import './App.css';

import BeancountConverterService, {Beancount} from './BeancountConverterService';
import BeancountParser, {Returns} from './BeancountParser';
import FinanceService, {HistoricalData} from './FinanceService';
import InvestementsChart from './InvestementsChart';

const beancountAsString = raw('./ibkr.bean');

const STOCK_SYMBOLS = ['VTI', 'VXUS', 'BND'];
const DATE_RANGE: [string, string] = ['2020-01-08', '2020-11-01'];

const App: React.FC = () => {
  const [beancount, setBeancount] = React.useState<Beancount | null>(null);
  const [historicalData, setHistoricalData] = React.useState<readonly HistoricalData[] | null>(null);
  const [totals, setTotals] = React.useState<Returns | null>(null);
  const [includeDividends, setIncludeDividends] = React.useState(false);
  const [onlyDividends, setOnlyDividends] = React.useState(false);
  const [onlyReturns, setOnlyReturns] = React.useState(false);

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

  React.useEffect(() => {
    if (!beancount || !historicalData) {
      return;
    }

    const totals = BeancountParser.getReturns(
      beancount,
      historicalData,
      {
        from: {month: 1, year: 2020},
        to: {month: 11, year: 2020},
      }
    );

    setTotals(totals);
  }, [beancount, historicalData])

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
    <div className="App">
      <header>
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
      </header>
      {beancount && (
        <InvestementsChart
          beancount={beancount}
          historicalData={historicalData || []}
          includeDividends={includeDividends}
          onlyDividends={onlyDividends}
          onlyReturns={onlyReturns}
        />
      )}
      <article>
        <h2>Returns</h2>
        <table>
          <thead>
            <tr>
              <td>Total</td>
              <td>Ex-Dividends</td>
              <td>Dividends</td>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>${totals ? totals.stockReturnsTotal.toFixed(2) : 0}</td>
              <td>Ex-Dividends</td>
              <td>Dividends</td>
            </tr>
          </tbody>
        </table>

      </article>
    </div>
  );
}

export default App;
