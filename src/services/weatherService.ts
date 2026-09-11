import { format, addHours, isAfter, parseISO } from 'date-fns';

export interface WeatherData {
  temp: number;
  condition: string;
  humidity: number;
  windSpeed: number;
  precipitation: number;
  forecast: Array<{
    time: string;
    temp: number;
    condition: string;
    precipitation: number;
  }>;
  alerts: string[];
}

const CONDITION_MAP: Record<number, string> = {
  0: 'Clear sky',
  1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Fog', 48: 'Depositing rime fog',
  51: 'Light drizzle', 53: 'Moderate drizzle', 55: 'Dense drizzle',
  61: 'Slight rain', 63: 'Moderate rain', 65: 'Heavy rain',
  71: 'Slight snow', 73: 'Moderate snow', 75: 'Heavy snow',
  80: 'Slight rain showers', 81: 'Moderate rain showers', 82: 'Violent rain showers',
  95: 'Thunderstorm', 96: 'Thunderstorm with slight hail', 99: 'Thunderstorm with heavy hail',
};

export async function fetchWeather(lat: number = -1.286389, lon: number = 36.817223): Promise<WeatherData> {
    try {
      // Try local proxy first for better reliability (bypasses browser CORS/Adblock issues)
      try {
        const proxyResponse = await fetch(`/api/weather?latitude=${lat}&longitude=${lon}`);
        if (proxyResponse.ok) {
          const data = await proxyResponse.json();
          return processWeatherData(data);
        }
        console.warn(`Weather proxy returned ${proxyResponse.status}. Attempting direct fetch...`);
      } catch (proxyError) {
        console.warn("Weather proxy connection failed. Attempting direct fetch...", proxyError);
      }

      // Fallback to direct fetch from Open-Meteo if local proxy is unavailable or fails
      const directResponse = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=temperature_2m,relativehumidity_2m,precipitation_probability,weathercode&timezone=auto`
      );

      if (!directResponse.ok) {
        throw new Error(`Direct weather API returned ${directResponse.status}`);
      }

      const data = await directResponse.json();
      return processWeatherData(data);
    } catch (error) {
      console.error("All weather fetch attempts failed:", error);
      // Fallback mock data
      return getFallbackWeatherData();
    }
}

// Helper to keep the fetch logic clean
function processWeatherData(data: any): WeatherData {
  const current = data.current_weather;
  const hourly = data.hourly;
  
  // Find next 24 hours
  const now = new Date();
  const forecast = [];
  
  // In case the data is slightly shifted or missing hourly fields
  const hourlyTime = hourly?.time || [];
  const hourlyTemp = hourly?.temperature_2m || [];
  const hourlyWeatherCode = hourly?.weathercode || [];
  const hourlyPrecipProb = hourly?.precipitation_probability || [];
  const hourlyHumidity = hourly?.relativehumidity_2m || [];

  for (let i = 0; i < Math.min(24, hourlyTime.length); i++) {
    const timeStr = hourlyTime[i];
    const time = parseISO(timeStr);
    if (isAfter(time, now) || i === 0) {
      forecast.push({
        time: timeStr,
        temp: hourlyTemp[i] ?? 0,
        condition: CONDITION_MAP[hourlyWeatherCode[i]] || 'Unknown',
        precipitation: hourlyPrecipProb[i] ?? 0
      });
    }
    if (forecast.length >= 6) break;
  }

  // Generate alerts based on data
  const alerts = [];
  const willRainSoon = forecast.some((f, idx) => idx < 3 && f.precipitation > 50);
  if (willRainSoon) {
    alerts.push("High probability of rain in the next 3 hours. Secure your harvest!");
  }
  
  const isHot = current.temperature > 30;
  if (isHot) {
    alerts.push("High temperatures detected. Ensure livestock have adequate water and shade.");
  }
  
  const isCold = current.temperature < 15;
  if (isCold) {
    alerts.push("Low temperatures expected. Provide extra bedding for young chicks.");
  }

  return {
    temp: current.temperature,
    condition: CONDITION_MAP[current.weathercode] || 'Unknown',
    humidity: hourlyHumidity[0] ?? 60,
    windSpeed: current.windspeed,
    precipitation: hourlyPrecipProb[0] ?? 0,
    forecast,
    alerts
  };
}

function getFallbackWeatherData(): WeatherData {
  return {
    temp: 24,
    condition: 'Partly Cloudy',
    humidity: 60,
    windSpeed: 12,
    precipitation: 10,
    forecast: [],
    alerts: ["Unable to fetch real-time weather. Showing estimated data."]
  };
}

export function getPlantingSeasonAdvice(month: number) {
  // Kenyan context (Long rains: March-May, Short rains: Oct-Dec)
  if (month >= 2 && month <= 4) {
    return "Long rains season starting. Ideal for planting maize, beans, and potatoes.";
  } else if (month >= 9 && month <= 11) {
    return "Short rains season. Good for fast-maturing crops like cowpeas and green grams.";
  } else if (month === 0 || month === 1 || month === 5 || month === 6) {
    return "Dry season. Focus on irrigation and soil preparation.";
  } else {
    return "Harvesting season for many crops. Monitor storage conditions.";
  }
}
