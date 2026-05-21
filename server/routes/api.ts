/**
 * REST API Routes
 */

import { Router, type Request, type Response } from "express";
import { CoreBankService } from "../services/core-bank.js";
import { warmup } from "../services/wasm-engine.js";
import { getSettings, saveSettings } from "../services/settings.js";
import { triggerTestNotification } from "../services/notifier.js";
import { TransactionMonitor } from "../services/monitor.js";
import { pendingDepositService } from "../services/pending-deposits.js";
import {
  createPaymentLink,
  verifyWebhookSignature,
  cancelPaymentLink,
  getPaymentInfo,
  confirmWebhookUrl,
} from "../services/payos.js";

const router = Router();
export const coreBankService = new CoreBankService();
const txMonitor = new TransactionMonitor(coreBankService);

// ─── PayOS payment callback registry ────────────────────────────────────────
interface PendingPayment {
  callbackUrl: string;
  secret?: string;
  amount: number;
  description: string;
  createdAt: number;
  checkoutUrl: string;
  qrCode: string;
  paymentLinkId: string;
}
const pendingPayments = new Map<number, PendingPayment>();

// ─── Health / Status ────────────────────────────────────────────────────────

router.get("/status", (req: Request, res: Response) => {
  const session = coreBankService.getSession();

  const base = (process.env.BASE_PATH || "/corebank").replace(/\/$/, "");
  const replitDomain = process.env.REPLIT_DOMAINS?.split(",")[0]?.trim();
  const publicApiUrl = replitDomain
    ? `https://${replitDomain}${base}/api`
    : `${req.protocol}://${req.get("host")}${base}/api`;

  res.json({
    status: "ok",
    loggedIn: !!session?.sessionId,
    username: session?.username || null,
    sessionAge: session ? Math.floor((Date.now() - session.createdAt) / 1000) : null,
    publicApiUrl,
  });
});

// ─── Warmup WASM ────────────────────────────────────────────────────────────

router.post("/warmup", async (_req: Request, res: Response) => {
  try {
    await warmup();
    res.json({ success: true, message: "WASM engine ready" });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Captcha ────────────────────────────────────────────────────────────────

router.post("/captcha", async (_req: Request, res: Response) => {
  try {
    const captcha = await coreBankService.getCaptcha();
    res.json({ success: true, ...captcha });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Login ──────────────────────────────────────────────────────────────────

router.post("/login", async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      res.status(400).json({ success: false, message: "Missing username or password" });
      return;
    }
    const result = await coreBankService.autoLogin(username, password);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Balance ────────────────────────────────────────────────────────────────

router.post("/balance", async (_req: Request, res: Response) => {
  try {
    const balance = await coreBankService.getBalance();
    res.json({ success: true, data: balance });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Transactions ───────────────────────────────────────────────────────────

router.post("/transactions", async (req: Request, res: Response) => {
  try {
    const { accountNumber, fromDate, toDate } = req.body;
    if (!accountNumber || !fromDate || !toDate) {
      res.status(400).json({ success: false, message: "Missing accountNumber, fromDate, or toDate" });
      return;
    }
    const transactions = await coreBankService.getTransactions(accountNumber, fromDate, toDate);
    res.json({ success: true, data: transactions });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Settings ───────────────────────────────────────────────────────────────

router.get("/settings", (_req: Request, res: Response) => {
  res.json({ success: true, data: getSettings() });
});

router.post("/settings", (req: Request, res: Response) => {
  try {
    saveSettings(req.body);
    const newSettings = getSettings();
    if (newSettings.monitor.running) {
      txMonitor.start();
    } else {
      txMonitor.stop();
    }
    res.json({ success: true, data: newSettings });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post("/monitor/test", async (_req: Request, res: Response) => {
  try {
    await triggerTestNotification();
    res.json({ success: true, message: "Test notification sent" });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Pending Deposit (MB Bank native match) ──────────────────────────────────

router.post("/pending-deposit", (req: Request, res: Response) => {
  const { code, amount, callbackUrl, secret } = req.body as {
    code?: string;
    amount?: number | string;
    callbackUrl?: string;
    secret?: string;
  };

  const settings = getSettings();
  const internalSecret = settings.customWebhook?.secret;
  if (internalSecret) {
    const provided = (req.headers["x-internal-secret"] as string) ?? secret ?? "";
    if (provided !== internalSecret) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }
  }

  if (!code || !amount || !callbackUrl) {
    res.status(400).json({ success: false, message: "Missing code, amount, or callbackUrl" });
    return;
  }

  pendingDepositService.register(String(code), Number(amount), String(callbackUrl), secret);
  res.json({
    success: true,
    message: `Watching for ${code} = ${Number(amount).toLocaleString("vi-VN")}đ (5 min TTL)`,
    pending: pendingDepositService.size,
  });
});

router.get("/pending-deposit", (_req: Request, res: Response) => {
  res.json({ success: true, data: pendingDepositService.list() });
});

// ─── PayOS Payment Integration ───────────────────────────────────────────────

/**
 * POST /api/payment/create
 *
 * Bot Telegram gọi endpoint này để tạo link thanh toán PayOS.
 *
 * Headers (optional):  x-internal-secret
 * Body:
 *   amount       number  - Số tiền (VND)
 *   description  string  - Nội dung CK (tối đa 9 ký tự với NH thường, MB Bank hỗ trợ dài hơn)
 *   callbackUrl  string  - URL bot nhận kết quả khi TT thành công / thất bại
 *   secret       string? - X-Webhook-Secret đính kèm trong callback
 *   expiredAt    number? - Unix timestamp hết hạn link
 *   buyerName    string? - Tên người mua
 *   buyerPhone   string? - SĐT người mua
 *
 * Response 200:
 *   { success, data: { checkoutUrl, qrCode, orderCode, accountNumber, bin, ... } }
 */
router.post("/payment/create", async (req: Request, res: Response) => {
  const { amount, description, callbackUrl, secret, expiredAt, buyerName, buyerPhone } = req.body as {
    amount?: number | string;
    description?: string;
    callbackUrl?: string;
    secret?: string;
    expiredAt?: number;
    buyerName?: string;
    buyerPhone?: string;
  };

  const settings = getSettings();
  const internalSecret = settings.customWebhook?.secret;
  if (internalSecret) {
    const provided = (req.headers["x-internal-secret"] as string) ?? secret ?? "";
    if (provided !== internalSecret) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }
  }

  if (!amount || !description || !callbackUrl) {
    res.status(400).json({ success: false, message: "Thiếu amount, description hoặc callbackUrl" });
    return;
  }

  const result = await createPaymentLink({
    amount: Number(amount),
    description: String(description),
    expiredAt,
    buyerName,
    buyerPhone,
  });

  if (result.success && result.data) {
    pendingPayments.set(result.data.orderCode, {
      callbackUrl: String(callbackUrl),
      secret,
      amount: Number(amount),
      description: String(description),
      createdAt: Date.now(),
      checkoutUrl: result.data.checkoutUrl,
      qrCode: result.data.qrCode,
      paymentLinkId: result.data.paymentLinkId,
    });
    console.log(`💳 Payment created: orderCode=${result.data.orderCode}, amount=${amount}đ, callback=${callbackUrl}`);
    res.json({ success: true, data: result.data });
  } else {
    res.status(500).json({ success: false, message: result.message });
  }
});

/**
 * POST /api/payment/webhook
 *
 * PayOS gọi endpoint này khi có giao dịch thành công.
 * Server xác thực chữ ký HMAC_SHA256 rồi callback về bot.
 *
 * Đăng ký URL này qua POST /api/payment/register-webhook hoặc PayOS dashboard.
 */
router.post("/payment/webhook", async (req: Request, res: Response) => {
  const { data, signature, code, success: isSuccess } = req.body as {
    code?: string;
    success?: boolean;
    data?: Record<string, unknown>;
    signature?: string;
  };

  if (!data || !signature) {
    res.status(400).json({ success: false, message: "Missing data or signature" });
    return;
  }

  if (!verifyWebhookSignature(data, signature)) {
    console.warn("⚠️  PayOS webhook: invalid signature");
    res.status(400).json({ success: false, message: "Invalid signature" });
    return;
  }

  // Phải trả 2XX ngay cho PayOS
  res.json({ success: true });

  const orderCode = data.orderCode as number | undefined;
  console.log(`📥 PayOS webhook: orderCode=${orderCode}, code=${code}, success=${isSuccess}`);

  if (code === "00" && isSuccess && orderCode) {
    const pending = pendingPayments.get(orderCode);
    if (pending) {
      pendingPayments.delete(orderCode);
      console.log(`✅ PayOS confirmed: orderCode=${orderCode}, amount=${data.amount}đ → callback`);
      try {
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (pending.secret) headers["X-Webhook-Secret"] = pending.secret;
        await fetch(pending.callbackUrl, {
          method: "POST",
          headers,
          body: JSON.stringify({
            status: "success",
            orderCode,
            amount: data.amount,
            description: data.description,
            transactionDateTime: data.transactionDateTime,
            reference: data.reference,
            accountNumber: data.accountNumber,
            paymentLinkId: data.paymentLinkId,
            counterAccountName: data.counterAccountName,
            counterAccountNumber: data.counterAccountNumber,
            counterAccountBankName: data.counterAccountBankName,
          }),
          signal: AbortSignal.timeout(10_000),
        });
        console.log(`📤 Bot callback sent: ${pending.callbackUrl}`);
      } catch (err: any) {
        console.error(`❌ Bot callback failed: ${err.message}`);
      }
    } else {
      console.warn(`⚠️  No pending payment for orderCode=${orderCode}`);
    }
  }
});

/**
 * GET /api/payment/pending
 * Danh sách payment đang chờ xác nhận từ PayOS.
 */
router.get("/payment/pending", (_req: Request, res: Response) => {
  const list = [...pendingPayments.entries()].map(([orderCode, p]) => ({
    orderCode,
    amount: p.amount,
    description: p.description,
    callbackUrl: p.callbackUrl,
    checkoutUrl: p.checkoutUrl,
    ageSeconds: Math.floor((Date.now() - p.createdAt) / 1000),
  }));
  res.json({ success: true, data: list, total: list.length });
});

/**
 * DELETE /api/payment/:orderCode
 * Huỷ link thanh toán và xoá khỏi danh sách chờ.
 */
router.delete("/payment/:orderCode", async (req: Request, res: Response) => {
  const orderCode = Number(req.params.orderCode);
  if (isNaN(orderCode)) {
    res.status(400).json({ success: false, message: "Invalid orderCode" });
    return;
  }
  pendingPayments.delete(orderCode);
  const result = await cancelPaymentLink(orderCode, "Cancelled via API");
  res.json(result);
});

/**
 * GET /api/payment/:orderCode
 * Lấy thông tin link thanh toán từ PayOS.
 */
router.get("/payment/:orderCode", async (req: Request, res: Response) => {
  const id = req.params.orderCode;
  const info = await getPaymentInfo(id);
  if (info) {
    res.json({ success: true, data: info });
  } else {
    res.status(404).json({ success: false, message: "Payment not found" });
  }
});

/**
 * POST /api/payment/register-webhook
 * Đăng ký webhook URL với PayOS.
 * Nếu không truyền webhookUrl, tự detect từ request host.
 */
router.post("/payment/register-webhook", async (req: Request, res: Response) => {
  const { webhookUrl } = req.body as { webhookUrl?: string };

  let url = webhookUrl;
  if (!url) {
    const host = req.headers.host || "localhost";
    const proto = (req.headers["x-forwarded-proto"] as string) || "https";
    url = `${proto}://${host}/api/payment/webhook`;
  }

  const result = await confirmWebhookUrl(url);
  if (result.success) {
    console.log(`✅ PayOS webhook registered: ${url}`);
    res.json({ success: true, webhookUrl: url, data: result.data });
  } else {
    res.status(400).json({ success: false, message: result.message });
  }
});

export default router;
