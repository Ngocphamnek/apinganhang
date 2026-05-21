import { getSettings } from './settings';
import { broadcastTransaction, notifyMatchedDeposit } from './notifier';
import { CoreBankService } from './core-bank';
import { pendingDepositService } from './pending-deposits';

export class TransactionMonitor {
  private timer: NodeJS.Timeout | null = null;
  private seenTxIds = new Set<string>();
  private readonly MAX_SEEN_IDS = 2000;
  private coreBankService: CoreBankService;

  constructor(coreBankService: CoreBankService) {
    this.coreBankService = coreBankService;
    
    const settings = getSettings();
    if (settings.monitor.running) {
      this.start();
    }
  }

  public start() {
    if (this.timer) return;
    console.log('🚀 Starting Core Bank Transaction Monitor...');
    this.tick();
  }

  public stop() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    console.log('🛑 Stopped Core Bank Transaction Monitor.');
  }

  private async tick() {
    try {
      const settings = getSettings();
      if (!settings.monitor.running) {
        this.stop();
        return;
      }

      await this.checkTransactions();

    } catch (error: any) {
      console.error('Monitor tick failed:', error.message);
    } finally {
      const settings = getSettings();
      if (settings.monitor.running) {
        const interval = Math.max(10, settings.monitor.intervalSeconds) * 1000;
        this.timer = setTimeout(() => this.tick(), interval);
      }
    }
  }

  private async checkTransactions() {
    let session = this.coreBankService.getSession();
    if (!session?.sessionId) {
      if (!this.coreBankService.hasCredentials()) return;

      console.log('🔄 Monitor: session expired, re-authenticating...');
      const ok = await this.coreBankService.reAuthenticate();
      if (!ok) {
        console.error('⚠️  Monitor: re-authentication failed, will retry next tick');
        return;
      }
      session = this.coreBankService.getSession();
      if (!session?.sessionId) return;
      console.log('✅ Monitor: re-authentication successful');
    }

    const balanceSummary = await this.coreBankService.getBalance();
    const accounts = balanceSummary?.accounts || [];
    if (!accounts.length) return;

    const mainAccount = accounts[0].number;

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const todayStr = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayStr = `${pad(yesterday.getDate())}/${pad(yesterday.getMonth() + 1)}/${yesterday.getFullYear()}`;

    // Fetch yesterday + today to avoid missing transactions created near midnight
    const txList = await this.coreBankService.getTransactions(mainAccount, yesterdayStr, todayStr);
    const chronologicalTx = [...txList].reverse();

    for (const tx of chronologicalTx) {
      const txId = tx.refNo || `${tx.transactionDate}-${tx.creditAmount}-${tx.debitAmount}`;

      if (this.seenTxIds.has(txId)) continue;
      // Trim seenTxIds if it gets too large (keep most recent half)
      if (this.seenTxIds.size >= this.MAX_SEEN_IDS) {
        const entries = [...this.seenTxIds];
        entries.slice(0, this.MAX_SEEN_IDS / 2).forEach(id => this.seenTxIds.delete(id));
      }
      this.seenTxIds.add(txId);

      console.log(`🔔 New transaction detected: ${txId}`);

      // ── Check if this matches a pending deposit ──────────────────────────
      if (tx.creditAmount > 0) {
        const match = pendingDepositService.match(tx.description || '', tx.creditAmount);

        if (match) {
          console.log(`🎯 Matched pending deposit: ${match.code} = ${tx.creditAmount}đ`);
          pendingDepositService.consume(match.code);

          // Notify bot with status:"success" — skip generic broadcast for this tx
          await notifyMatchedDeposit(match.callbackUrl, match.secret, {
            status: 'success',
            code: match.code,
            creditAmount: tx.creditAmount,
            refNo: tx.refNo,
            description: tx.description,
            transactionDate: tx.transactionDate,
            accountNo: mainAccount,
          });
          continue; // Don't double-broadcast
        }
      }

      // ── Normal broadcast (no matching pending deposit) ───────────────────
      await broadcastTransaction({ ...tx, accountNo: mainAccount });
    }
  }
}
