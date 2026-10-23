// Service to fetch live USDT/NGN exchange rate from CoinGecko with fallback
let cachedRate: number | null = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 60 * 1000; // Cache for 60 seconds
const FALLBACK_RATE = 1500;

/**
 * Fetch authoritative live exchange rate for 1 USDT in NGN.
 */
export async function fetchLiveUsdtToNgnRate(): Promise<number> {
  const now = Date.now();
  if (cachedRate !== null && now - lastFetchTime < CACHE_TTL_MS) {
    return cachedRate;
  }

  try {
    const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=ngn');
    if (res.ok) {
      const data = await res.json();
      if (data?.tether?.ngn && typeof data.tether.ngn === 'number') {
        cachedRate = Math.round(data.tether.ngn * 100) / 100;
        lastFetchTime = now;
        return cachedRate;
      }
    }
  } catch (err) {
    console.warn('Failed to fetch live USDT/NGN exchange rate, using fallback:', err);
  }

  return cachedRate ?? FALLBACK_RATE;
}
