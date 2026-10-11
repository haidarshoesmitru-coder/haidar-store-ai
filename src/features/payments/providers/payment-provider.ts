import QRCode from 'qrcode';
import { env } from '@/shared/config/env';

/**
 * Why this file exists: the seam between "make a QR for this bill" and
 * HOW the QR is made. The service layer, API routes, and WhatsApp AI
 * tools all depend only on the `PaymentProvider` interface below — they
 * never know whether the QR came from a static personal-account payload
 * or (later) a JazzCash Business dynamic-QR API call. Swapping providers
 * is a one-line constructor change, not a rewrite of the billing flow.
 *
 * --- TODAY: StaticQrProvider (personal JazzCash account) ---
 * The shop currently has a PERSONAL JazzCash account, which exposes no
 * API and no dynamic QR. So the QR encodes human-readable payment
 * instructions: shop name, the JazzCash number (from JAZZCASH_NUMBER env
 * — never hardcoded, never logged), the exact amount, and the bill
 * reference. The customer scans it with any QR reader, reads the number
 * + amount, and sends the money manually from their JazzCash app. It is
 * honest about what it is: NOT a deep link, NOT auto-verified — which is
 * exactly why payment confirmation stays a manual owner step for now
 * (the confirm_payment tool).
 *
 * --- FUTURE SEAM: JazzCashBusinessProvider (dynamic QR + auto-confirm) ---
 * When Haidar's JazzCash Business account/API arrives, add a
 * `JazzCashBusinessProvider implements PaymentProvider` in this folder:
 *   1. `generateQr()` calls the JazzCash merchant API to mint a dynamic
 *      Raast P2M QR (EMVCo payload with the amount + billNo embedded) and
 *      returns that payload + its rendered PNG data URL. Same return
 *      shape — nothing downstream changes.
 *   2. Payment confirmation arrives via a new webhook route
 *      (`/api/webhooks/payments/jazzcash`), which verifies the provider
 *      signature, calls `paymentService.confirmPayment()`, and sends the
 *      customer the thank-you WhatsApp message — the same message the
 *      manual confirm_payment tool sends today, so the customer-visible
 *      behavior is identical, only the trigger becomes automatic.
 *   3. `PaymentMethod` gains a `JAZZCASH_BUSINESS_QR` value; existing
 *      `JAZZCASH_QR` rows keep working untouched, and this static
 *      provider stays as the fallback.
 * Nothing in the service, repository, API, or AI-tool layers changes
 * shape for any of that — they already depend only on this interface.
 *
 * Dependencies: qrcode (PNG data-URL rendering), env.ts (JAZZCASH_NUMBER).
 * Future usage: constructed by payment.service.impl.ts (default) and
 * feature/ai/owner-tools.ts indirectly through the service.
 */

export interface QrBillInput {
  /** Final agreed amount in paisa (integer minor units). */
  amountPaisa: number;
  billNo: string;
  description: string | null;
}

export interface GeneratedQr {
  /** The exact text encoded into the QR image (also stored on Payment.qrPayload). */
  payload: string;
  /** PNG data URL (data:image/png;base64,…) ready to send or display. */
  imageDataUrl: string;
}

export interface PaymentProvider {
  /** Matches PaymentMethod — e.g. 'JAZZCASH_QR'. */
  readonly method: string;
  generateQr(input: QrBillInput): Promise<GeneratedQr>;
}

/** "Rs. 1,500" / "Rs. 1,500.50" — presentation formatting shared by the QR payload and WhatsApp messages. */
export function formatRupees(amountPaisa: number): string {
  const rupees = amountPaisa / 100;
  return Number.isInteger(rupees) ? rupees.toLocaleString('en-US') : rupees.toFixed(2);
}

export class StaticQrProvider implements PaymentProvider {
  readonly method = 'JAZZCASH_QR';

  /**
   * @param jazzCashNumber The shop's own JazzCash number (digits only).
   *   Always passed in from env — never a literal at the call site.
   */
  constructor(
    private readonly jazzCashNumber: string = env.JAZZCASH_NUMBER,
    private readonly shopName: string = 'Haidar Store',
  ) {}

  async generateQr(input: QrBillInput): Promise<GeneratedQr> {
    const lines = [
      this.shopName,
      `JazzCash: ${this.jazzCashNumber}`,
      `Amount: Rs. ${formatRupees(input.amountPaisa)}`,
      `Bill: ${input.billNo}`,
    ];
    if (input.description) {
      lines.push(`For: ${input.description}`);
    }
    lines.push('Apne JazzCash app se is number par ye amount bhejen.');
    const payload = lines.join('\n');

    const imageDataUrl = await QRCode.toDataURL(payload, {
      width: 512,
      margin: 2,
      errorCorrectionLevel: 'M',
    });

    return { payload, imageDataUrl };
  }
}
