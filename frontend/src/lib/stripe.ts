import { loadStripe } from '@stripe/stripe-js';

// Direct checkout URLs for plans
export const stripePlans = {
  pro: 'https://buy.stripe.com/test_6oE2a93BO3q2bSw5kl',
  enterprise: 'https://buy.stripe.com/test_7sI9CB8W8f8K4q4bIK'
};

// Initialize Stripe (only needed if you're using Stripe Elements or other Stripe features)
const stripePublishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
export const stripePromise = stripePublishableKey ? loadStripe(stripePublishableKey) : null;

export async function createSubscription(checkoutUrl: string) {
  if (!checkoutUrl) {
    throw new Error('Checkout URL is required');
  }
  window.location.href = checkoutUrl;
}