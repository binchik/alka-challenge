const BASE_URL = 'https://us-central1-plain-text-accounting.cloudfunctions.net/converter';

export type BeancountEntryType = 'Open' | 'Close' | 'Commodity' | 'Pad' | 'Balance' | 'Transaction' | 'Note' | 'Event' | 'Query' | 'Price' | 'Document' | 'Custom';

export interface BeancountMeta {
  filename: string;
  lineno: number;
}

export interface BeancountPrice {
  number: number;
  currency: string;
}

export interface BeancountDirectivePosting {
  account: string;
  units: BeancountPrice;
  cost?: any;
  price?: BeancountPrice;
  flag?: any;
  meta: BeancountMeta;
}

export interface BeancountDirective {
  meta: BeancountMeta;
  date: string;
  account: string;
  currencies: string[];
  booking?: any;
  flag: string;
  payee?: any;
  narration: string;
  tags: any[];
  links: any[];
  postings: BeancountDirectivePosting[];
}

export interface BeancountEntry {
  type: BeancountEntryType;
  entry: BeancountDirective;
  hash: string;
}

export interface BeancountOptions {
  filename: string;
  include: any[];
  input_hash: string;
  dcontext?: any;
  commodities: string[];
  plugin: string[][];
  title: string;
  name_assets: string;
  name_liabilities: string;
  name_equity: string;
  name_income: string;
  name_expenses: string;
  account_previous_balances: string;
  account_previous_earnings: string;
  account_previous_conversions: string;
  account_current_earnings: string;
  account_current_conversions: string;
  account_rounding?: any | string;
  conversion_currency: string;
  inferred_tolerance_default: {};
  inferred_tolerance_multiplier: number;
  infer_tolerance_from_cost: boolean;
  documents: any[];
  operating_currency: any[];
  render_commas: boolean;
  plugin_processing_mode: string;
  long_string_maxlines: number;
  booking_method?: any;
  allow_pipe_separator: boolean;
  allow_deprecated_none_for_tags_and_links: boolean;
  insert_pythonpath: boolean;
}

export interface Beancount {
  entries: readonly BeancountEntry[];
  errors: readonly any[];
  options: BeancountOptions;
  variant: 'beancount';
  version: string;
}

const BeancountConverterService = {
  getJson: async (beancountAsString: string): Promise<Beancount> => {
    const res = await fetch(`${BASE_URL}/bean_to_json`, {
      method: 'POST',
      body: beancountAsString,
      headers: {
        'Content-Type': 'application/vnd+beancount',
      },
    });

    const json = await res.json();

    return json;
  },
}

export default BeancountConverterService;