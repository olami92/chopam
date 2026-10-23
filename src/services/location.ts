/**
 * Location Auto-Detection Service
 * Handles browser GPS geolocation, reverse geocoding, and timezone-based fallback.
 */

// Timezone to readable city/country mapping for instant, zero-network fallbacks
const TIMEZONE_LOCATION_MAP: Record<string, string> = {
  'Africa/Lagos': 'Lagos, Nigeria',
  'Africa/Abuja': 'Abuja, Nigeria',
  'Africa/Porto-Novo': 'Cotonou, Benin',
  'Africa/Accra': 'Accra, Ghana',
  'Africa/Johannesburg': 'Johannesburg, South Africa',
  'Africa/Nairobi': 'Nairobi, Kenya',
  'Africa/Cairo': 'Cairo, Egypt',
  'Europe/London': 'London, United Kingdom',
  'Europe/Berlin': 'Berlin, Germany',
  'Europe/Paris': 'Paris, France',
  'America/New_York': 'New York, United States',
  'America/Chicago': 'Chicago, United States',
  'America/Los_Angeles': 'Los Angeles, United States',
  'America/Toronto': 'Toronto, Canada',
  'Asia/Dubai': 'Dubai, United Arab Emirates',
  'Asia/Singapore': 'Singapore',
  'Asia/Tokyo': 'Tokyo, Japan',
};

export interface DetectedLocationResult {
  city: string;
  country: string;
  formatted: string;
  source: 'gps' | 'reverse_geocode' | 'timezone' | 'default';
  latitude?: number;
  longitude?: number;
}

export async function autoDetectLocation(): Promise<DetectedLocationResult> {
  const defaultFallback: DetectedLocationResult = {
    city: 'Lagos',
    country: 'Nigeria',
    formatted: 'Lagos, Nigeria',
    source: 'default',
  };

  // 1. Try timezone deduction as initial baseline
  let baseline = defaultFallback;
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && TIMEZONE_LOCATION_MAP[tz]) {
      const parts = TIMEZONE_LOCATION_MAP[tz].split(', ');
      baseline = {
        city: parts[0] || 'Lagos',
        country: parts[1] || 'Nigeria',
        formatted: TIMEZONE_LOCATION_MAP[tz],
        source: 'timezone',
      };
    } else if (tz) {
      const cityGuess = tz.split('/').pop()?.replace(/_/g, ' ') || 'Lagos';
      baseline = {
        city: cityGuess,
        country: 'Global',
        formatted: `${cityGuess}`,
        source: 'timezone',
      };
    }
  } catch {
    // Ignore error
  }

  // 2. If navigator.geolocation is available, attempt GPS lookup
  if (typeof window !== 'undefined' && 'geolocation' in navigator) {
    try {
      const coords = await new Promise<GeolocationCoordinates | null>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve(pos.coords),
          () => resolve(null),
          { timeout: 5000, maximumAge: 60000, enableHighAccuracy: false }
        );
      });

      if (coords) {
        const { latitude, longitude } = coords;
        // Try reverse geocoding via public openStreetMap or bigdatacloud free endpoint
        try {
          const res = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`,
            { signal: AbortSignal.timeout(4000) }
          );
          if (res.ok) {
            const data = await res.json();
            const city = data.city || data.locality || data.principalSubdivision || baseline.city;
            const country = data.countryName || baseline.country;
            return {
              city,
              country,
              formatted: `${city}, ${country}`,
              source: 'gps',
              latitude,
              longitude,
            };
          }
        } catch {
          // If network fetch fails, format using coordinates and timezone city
          return {
            city: baseline.city,
            country: baseline.country,
            formatted: `${baseline.city}, ${baseline.country} (GPS)`,
            source: 'gps',
            latitude,
            longitude,
          };
        }
      }
    } catch {
      // Return baseline timezone result
    }
  }

  return baseline;
}
