import * as R from 'ramda';

import {Beancount, BeancountDirective, BeancountDirectivePosting} from "./BeancountConverterService";
import { HistoricalData } from './FinanceService';

export interface Returns {
  totalCash: number;
  stockReturnsBySymbol: Record<string, number>;
  stockReturnsTotal: number;
}

const BeancountParser = {
  getTransactionEntries: (beancount: Beancount) => beancount.entries
    .filter(entry => entry.type === 'Transaction')
    .map(transaction => transaction.entry),
  parseEntryDate: (entry: BeancountDirective) => {
    const [year, month, day] = entry.date
      .split('-')
      .map(dateComponent => Number(dateComponent));

    return {
      year,
      month,
      day,
    };
  },
  parseAccountName: (accountName: string) => {
    const [type, subType, institutionName, stockSymbol, investmentType] = accountName.split(':');

    return {
      type,
      subType,
      institutionName,
      stockSymbol,
      investmentType,
    };
  },
  isStockPosting: (posting: BeancountDirectivePosting) => {
    const {type, subType, stockSymbol} = BeancountParser.parseAccountName(posting.account);
    const acccountNameIsStockAccountName =
      type === 'Assets' && subType === 'Investments' && typeof stockSymbol === 'string';

    return acccountNameIsStockAccountName &&
      !!posting.price &&
      posting.units.currency !== posting.price?.currency;
  },
  isDividendAccountName: (accountName: string) => {
    const {type, subType, investmentType} = BeancountParser.parseAccountName(accountName);

    return type === 'Income' && subType === 'Investments' && investmentType === 'DIVIDEND';
  },
  isComissionAccountName: (accountName: string) => {
    const {type, subType, investmentType} = BeancountParser.parseAccountName(accountName);

    return type === 'Expenses' && subType === 'Investments' && investmentType === 'Commissions';
  },
  getStockTransactions: (beancount: Beancount) =>
    BeancountParser.getTransactionEntries(beancount)
      .filter(transactionEntry => transactionEntry.postings.some(BeancountParser.isStockPosting))
      .map(transactionEntry => {
        const stockPosting = transactionEntry.postings.find(
          posting => BeancountParser.isStockPosting(posting)
        );
        const comissionPosting = transactionEntry.postings.find(
          posting => BeancountParser.isComissionAccountName(posting.account)
        );

        if (!stockPosting) {
          return undefined as never;
        }

        return {
          symbol: stockPosting.units.currency,
          date: BeancountParser.parseEntryDate(transactionEntry),
          stockPosting,
          comissionPosting,
        }
      }),
  getDividendTransactions: (beancount: Beancount) =>
    BeancountParser.getTransactionEntries(beancount)
      .filter(transactionEntry =>
        transactionEntry.postings.some(posting => BeancountParser.isDividendAccountName(posting.account)),
      )
      .map(transactionEntry => {
        const cashPosting = transactionEntry.postings.find(
          posting =>
            !BeancountParser.isDividendAccountName(posting.account) &&
            !BeancountParser.isComissionAccountName(posting.account)
        );
        const dividendPosting = transactionEntry.postings.find(
          posting => BeancountParser.isDividendAccountName(posting.account)
        );
        const comissionPosting = transactionEntry.postings.find(
          posting => BeancountParser.isComissionAccountName(posting.account)
        );

        if (!dividendPosting || !cashPosting) {
          return undefined as never;
        }

        const symbol = BeancountParser.parseAccountName(dividendPosting.account).stockSymbol;

        return {
          symbol,
          date: BeancountParser.parseEntryDate(transactionEntry),
          cashPosting,
          dividendPosting,
          comissionPosting,
        }
      }),
  getCommissionTransactions: (beancount: Beancount) =>
      BeancountParser.getTransactionEntries(beancount)
        .filter(transactionEntry =>
          transactionEntry.postings.some(posting => BeancountParser.isComissionAccountName(posting.account)),
        )
        .map(transactionEntry => {
          const comissionPosting = transactionEntry.postings.find(
            posting => BeancountParser.isComissionAccountName(posting.account)
          );
          const cashPosting = transactionEntry.postings.find(
            posting =>
              !BeancountParser.isDividendAccountName(posting.account) &&
              !BeancountParser.isComissionAccountName(posting.account)
          );
          const dividendPosting = transactionEntry.postings.find(
            posting => BeancountParser.isDividendAccountName(posting.account)
          );
  
          if (!comissionPosting) {
            return undefined as never;
          }
  
          return {
            date: BeancountParser.parseEntryDate(transactionEntry),
            comissionPosting,
            cashPosting,
            dividendPosting,
          };
        }),
  getSymbolTotal: (
    beancount: Beancount,
    historicalData: readonly HistoricalData[],
    config: {
      symbol: string;
      upTo: {month: number; year: number};
      includeDividends?: boolean;
      onlyDividends?: boolean;
      onlyReturns?: boolean;
      useOpenStockPrice?: boolean;
    },
  ) => {
    const stockQuantities = BeancountParser
      .getStockTransactions(beancount)
      .filter(transaction => config.symbol === transaction.symbol)
      .filter(transaction =>
        config.upTo.month >= transaction.date.month &&
        config.upTo.year >= transaction.date.year,
      )
      .map(transaction => transaction.stockPosting.units.number);
    const stockQuantity = config.onlyDividends ? 0 : R.sum(stockQuantities);

    const dividendAmounts = BeancountParser
      .getDividendTransactions(beancount)
      .filter(transaction => config.symbol === transaction.symbol)
      .filter(transaction =>
        config.upTo.month >= transaction.date.month &&
        config.upTo.year >= transaction.date.year,
      )
      .map(transaction => transaction.cashPosting.units.number);
    const dividendTotal = config.onlyDividends || config.includeDividends
      ? R.sum(dividendAmounts) : 0;

    const historicalEntries = historicalData
      .filter(historicalDatum => historicalDatum.symbol === config.symbol)
      .flatMap(historicalDatum => historicalDatum.historical)
      .filter(entry => {
        const [year, month] = entry.date
          .split('-')
          .map(dateComponent => Number(dateComponent));
  
        return config.upTo.month === month && config.upTo.year === year;
      });
    const historicalEntriesSortedByDate = R.sortBy(R.prop('date'), historicalEntries);
    const stockOpenPrice = R.head(historicalEntriesSortedByDate)?.open || 0;
    const stockClosePrice = R.last(historicalEntriesSortedByDate)?.close || 0;

    const stockTotal = stockQuantity * (config.useOpenStockPrice ? stockOpenPrice : stockClosePrice)
      - (config.onlyReturns ? stockOpenPrice : 0);

    return stockTotal + dividendTotal;
  },
}

export default BeancountParser;