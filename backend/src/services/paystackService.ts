import 'dotenv/config';
import axios from 'axios';

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || '';
const PAYSTACK_BASE_URL = 'https://api.paystack.co';


const paystackApi = axios.create({
  baseURL: PAYSTACK_BASE_URL,
  headers: {
    Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
    'Content-Type': 'application/json',
  },
});

export interface InitializeTransactionPayload {
  email: string;
  amount: number; // In kobo (lowest currency unit). Multiply NGN by 100.
  reference?: string;
  callback_url?: string;
  metadata?: Record<string, any>;
}

export interface InitializeTransactionResponse {
  status: boolean;
  message: string;
  data: {
    authorization_url: string;
    access_code: string;
    reference: string;
  };
}

export interface VerifyTransactionResponse {
  status: boolean;
  message: string;
  data: {
    id: number;
    domain: string;
    status: 'success' | 'failed' | 'abandoned' | 'pending';
    reference: string;
    amount: number; // In kobo
    message: string | null;
    gateway_response: string;
    channel: string;
    currency: string;
    authorization: {
      authorization_code: string;
      bin: string;
      last4: string;
      exp_month: string;
      exp_year: string;
      channel: string;
      card_type: string;
      bank: string;
      country_code: string;
      brand: string;
      reusable: boolean;
      signature: string;
    };
    customer: {
      id: number;
      first_name: string | null;
      last_name: string | null;
      email: string;
      customer_code: string;
      phone: string | null;
      metadata: any;
      risk_action: string;
    };
    metadata: any;
    paid_at: string | null;
    created_at: string;
  };
}

/**
 * Initialize a Paystack transaction.
 * Returns an authorization URL to redirect the customer to, plus a reference.
 */
export async function initializePaystackTransaction(
  payload: InitializeTransactionPayload
): Promise<InitializeTransactionResponse> {
  const response = await paystackApi.post<InitializeTransactionResponse>(
    '/transaction/initialize',
    payload
  );
  return response.data;
}

/**
 * Verify a Paystack transaction by reference.
 * Returns the full transaction detail including status.
 */
export async function verifyPaystackTransaction(
  reference: string
): Promise<VerifyTransactionResponse> {
  const response = await paystackApi.get<VerifyTransactionResponse>(
    `/transaction/verify/${encodeURIComponent(reference)}`
  );
  return response.data;
}
