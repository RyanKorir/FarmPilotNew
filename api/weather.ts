import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Allow CORS from same origin
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const { latitude, longitude } = req.query;

  if (!latitude || !longitude) {
    return res.status(400).json({ error: 'latitude and longitude are required' });
  }

  const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&hourly=temperature_2m,relativehumidity_2m,precipitation_probability,weathercode&timezone=auto`;

  let lastError: unknown;
  for (let i = 0; i < 3; i++) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
        return res.status(200).json(data);
      }
      lastError = new Error(`Upstream returned ${response.status}`);
      if (![502, 503, 504].includes(response.status)) break;
      await new Promise((r) => setTimeout(r, 500 * (i + 1)));
    } catch (err) {
      lastError = err;
      await new Promise((r) => setTimeout(r, 500 * (i + 1)));
    }
  }

  return res.status(502).json({
    error: 'Failed to fetch weather data after multiple attempts',
    details: lastError instanceof Error ? lastError.message : String(lastError),
  });
}
