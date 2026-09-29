import { useEffect, useState } from 'react';
import { DEFAULT_SETTINGS, emptyLedger, type Balance, type Ledger, type Settings } from '@/lib/credits';
import * as store from '@/lib/storage';

export interface CreditState {
  settings: Settings;
  ledger: Ledger;
  balance: Balance | undefined;
}

/** Live view of credit settings, this month's spend and Apollo's balance. */
export function useCredits(): CreditState {
  const [state, setState] = useState<CreditState>({ settings: DEFAULT_SETTINGS, ledger: emptyLedger(), balance: undefined });
  useEffect(() => {
    const load = async () => {
      const [settings, ledger, balance] = await Promise.all([store.getSettings(), store.getLedger(), store.getBalance()]);
      setState({ settings, ledger, balance });
    };
    load();
    return store.onLocalChange(['settings', 'credits', 'balance'], load);
  }, []);
  return state;
}
