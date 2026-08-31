import Stripe from 'stripe';
import { env } from '@/env';

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    if (!env.STRIPE_SECRET_KEY) {
      throw new Error(
        'STRIPE_SECRET_KEY is not configured. Add it to .env to enable billing.'
      );
    }
    _stripe = new Stripe(env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-02-24.acacia'
    });
  }
  return _stripe;
}
