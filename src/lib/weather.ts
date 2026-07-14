export interface TemperatureValue {
  degrees?: number;
  unit?: string;
}

export interface LocalizedText {
  text?: string;
  languageCode?: string;
}

export interface WeatherCondition {
  iconBaseUri?: string;
  description?: LocalizedText;
  type?: string;
}

export interface WindDirection {
  cardinal?: string;
  degrees?: number;
}

export interface WindSpeed {
  unit?: string;
  value?: number;
}

export interface Wind {
  direction?: WindDirection;
  speed?: WindSpeed;
  gust?: WindSpeed;
}

export interface PrecipitationProbability {
  percent?: number;
  type?: string;
}

export interface QuantitativePrecipitationForecast {
  quantity?: number;
  unit?: string;
}

export interface Precipitation {
  probability?: PrecipitationProbability;
  qpf?: QuantitativePrecipitationForecast;
  snowQpf?: QuantitativePrecipitationForecast;
}

export interface WeatherEnvironmentMetric {
  grade?: string;
  source?: string;
  unit?: string;
  value?: number;
}

export interface WeatherEnvironment {
  pm10?: WeatherEnvironmentMetric;
  pm25?: WeatherEnvironmentMetric;
  sunriseTime?: string;
  sunsetTime?: string;
  uvIndex?: WeatherEnvironmentMetric;
}

export interface CurrentConditionsResponse {
  currentTime?: string;
  timeZone?: {
    id?: string;
  };
  weatherCondition?: WeatherCondition;
  temperature?: TemperatureValue;
  feelsLikeTemperature?: TemperatureValue;
  precipitation?: Precipitation;
  wind?: Wind;
  isDaytime?: boolean;
  relativeHumidity?: number;
  environment?: WeatherEnvironment;
}

export interface DisplayDateTime {
  year?: number;
  month?: number;
  day?: number;
  hours?: number;
  minutes?: number;
  utcOffset?: string;
}

export interface ForecastHourResponseItem {
  displayDateTime?: DisplayDateTime;
  weatherCondition?: WeatherCondition;
  temperature?: TemperatureValue;
  precipitation?: Precipitation;
  wind?: Wind;
  isDaytime?: boolean;
}

export interface ForecastHoursResponse {
  forecastHours?: ForecastHourResponseItem[];
  timeZone?: {
    id?: string;
  };
}

export interface DisplayDate {
  year?: number;
  month?: number;
  day?: number;
}

export interface ForecastDayPart {
  weatherCondition?: WeatherCondition;
  precipitation?: Precipitation;
  wind?: Wind;
  relativeHumidity?: number;
}

export interface ForecastDayResponseItem {
  displayDate?: DisplayDate;
  daytimeForecast?: ForecastDayPart;
  nighttimeForecast?: ForecastDayPart;
  maxTemperature?: TemperatureValue;
  minTemperature?: TemperatureValue;
}

export interface ForecastDaysResponse {
  forecastDays?: ForecastDayResponseItem[];
  timeZone?: {
    id?: string;
  };
}

export interface HourlyWeatherItem {
  dateKey: string;
  timeLabel: string;
  temperature: number;
  precipitationPercent: number;
  windSpeed: number;
  iconUrl: string | null;
  description: string;
  pm10?: number;
  pm10Grade?: string;
  pm25?: number;
  pm25Grade?: string;
  uvGrade?: string;
  uvIndex?: number;
}

export interface DailyWeatherItem {
  dateKey: string;
  dayLabel: string;
  fullLabel: string;
  iconUrl: string | null;
  description: string;
  maxTemperature: number;
  minTemperature: number;
  sunriseTime?: string;
  sunsetTime?: string;
}

export interface WeatherLocation {
  label: string;
  latitude: number;
  longitude: number;
  source: 'gps' | 'fallback';
  coordsLabel?: string;
  updatedAt: number;
}

export interface WeatherSnapshot {
  current: CurrentConditionsResponse;
  hourly: HourlyWeatherItem[];
  daily: DailyWeatherItem[];
  timeZoneId: string;
  location: WeatherLocation;
  provider?: 'kma' | 'open-meteo';
  providerLabel?: string;
}

interface OpenMeteoCurrentResponse {
  time?: string;
  temperature_2m?: number;
  relative_humidity_2m?: number;
  apparent_temperature?: number;
  is_day?: number;
  precipitation?: number;
  weather_code?: number;
  wind_speed_10m?: number;
  wind_direction_10m?: number;
  wind_gusts_10m?: number;
}

interface OpenMeteoHourlyResponse {
  time?: string[];
  temperature_2m?: number[];
  precipitation_probability?: number[];
  wind_speed_10m?: number[];
  weather_code?: number[];
  is_day?: number[];
}

interface OpenMeteoDailyResponse {
  time?: string[];
  weather_code?: number[];
  temperature_2m_max?: number[];
  temperature_2m_min?: number[];
}

interface OpenMeteoForecastResponse {
  latitude?: number;
  longitude?: number;
  timezone?: string;
  utc_offset_seconds?: number;
  current?: OpenMeteoCurrentResponse;
  hourly?: OpenMeteoHourlyResponse;
  daily?: OpenMeteoDailyResponse;
}

interface WeatherPresentation {
  description: string;
  symbol: string;
}

const OPEN_METEO_API_BASE_URL = 'https://api.open-meteo.com/v1/forecast';
const KMA_WEATHER_API_PATH = '/api/weather/kma';
const DAILY_FORECAST_COUNT = 5;

export const DEFAULT_LOCATION: WeatherLocation = {
  label: '서울',
  latitude: 37.5665,
  longitude: 126.978,
  source: 'fallback',
  coordsLabel: '37.5665, 126.9780',
  updatedAt: Date.now(),
};

const WEATHER_CODE_PRESENTATION: Record<number, { day: WeatherPresentation; night?: WeatherPresentation }> =
  {
    0: {
      day: { description: '맑음', symbol: '☀️' },
      night: { description: '맑음', symbol: '🌙' },
    },
    1: {
      day: { description: '대체로 맑음', symbol: '🌤️' },
      night: { description: '대체로 맑음', symbol: '🌙' },
    },
    2: {
      day: { description: '구름 조금', symbol: '⛅' },
      night: { description: '구름 조금', symbol: '☁️' },
    },
    3: {
      day: { description: '흐림', symbol: '☁️' },
    },
    45: {
      day: { description: '안개', symbol: '🌫️' },
    },
    48: {
      day: { description: '짙은 안개', symbol: '🌫️' },
    },
    51: {
      day: { description: '이슬비', symbol: '🌦️' },
    },
    53: {
      day: { description: '약한 비', symbol: '🌦️' },
    },
    55: {
      day: { description: '강한 비', symbol: '🌧️' },
    },
    56: {
      day: { description: '약한 진눈깨비', symbol: '🌨️' },
    },
    57: {
      day: { description: '강한 진눈깨비', symbol: '🌨️' },
    },
    61: {
      day: { description: '약한 비', symbol: '🌦️' },
    },
    63: {
      day: { description: '비', symbol: '🌧️' },
    },
    65: {
      day: { description: '강한 비', symbol: '🌧️' },
    },
    66: {
      day: { description: '약한 어는 비', symbol: '🌧️' },
    },
    67: {
      day: { description: '강한 어는 비', symbol: '🌧️' },
    },
    71: {
      day: { description: '약한 눈', symbol: '🌨️' },
    },
    73: {
      day: { description: '눈', symbol: '🌨️' },
    },
    75: {
      day: { description: '강한 눈', symbol: '❄️' },
    },
    77: {
      day: { description: '싸락눈', symbol: '🌨️' },
    },
    80: {
      day: { description: '약한 소나기', symbol: '🌦️' },
    },
    81: {
      day: { description: '소나기', symbol: '🌧️' },
    },
    82: {
      day: { description: '강한 소나기', symbol: '⛈️' },
    },
    85: {
      day: { description: '약한 눈 소나기', symbol: '🌨️' },
    },
    86: {
      day: { description: '강한 눈 소나기', symbol: '❄️' },
    },
    95: {
      day: { description: '천둥번개', symbol: '⛈️' },
    },
    96: {
      day: { description: '우박 가능', symbol: '⛈️' },
    },
    99: {
      day: { description: '강한 우박 가능', symbol: '⛈️' },
    },
  };

function buildWeatherApiUrl(
  latitude: number,
  longitude: number,
  extraParams: Record<string, string | number> = {},
) {
  const url = new URL(OPEN_METEO_API_BASE_URL);

  url.searchParams.set('latitude', String(latitude));
  url.searchParams.set('longitude', String(longitude));
  url.searchParams.set(
    'current',
    [
      'temperature_2m',
      'relative_humidity_2m',
      'apparent_temperature',
      'is_day',
      'precipitation',
      'weather_code',
      'wind_speed_10m',
      'wind_direction_10m',
      'wind_gusts_10m',
    ].join(','),
  );
  url.searchParams.set(
    'hourly',
    ['temperature_2m', 'precipitation_probability', 'wind_speed_10m', 'weather_code', 'is_day'].join(
      ',',
    ),
  );
  url.searchParams.set(
    'daily',
    ['weather_code', 'temperature_2m_max', 'temperature_2m_min'].join(','),
  );
  url.searchParams.set('forecast_days', String(DAILY_FORECAST_COUNT));
  url.searchParams.set('timezone', 'Asia/Seoul');
  url.searchParams.set('temperature_unit', 'celsius');
  url.searchParams.set('wind_speed_unit', 'kmh');

  Object.entries(extraParams).forEach(([key, value]) => {
    url.searchParams.set(key, String(value));
  });

  return url.toString();
}

function buildKmaWeatherApiUrl(
  location: WeatherLocation,
  extraParams: Record<string, string | number> = {},
) {
  const params = new URLSearchParams({
    label: location.label,
    latitude: String(location.latitude),
    longitude: String(location.longitude),
    source: location.source,
  });

  if (location.coordsLabel) {
    params.set('coordsLabel', location.coordsLabel);
  }
  Object.entries(extraParams).forEach(([key, value]) => {
    params.set(key, String(value));
  });

  return `${KMA_WEATHER_API_PATH}?${params.toString()}`;
}

async function fetchWeatherResource<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal });

  if (!response.ok) {
    let message = `날씨 API 요청에 실패했습니다. (${response.status})`;

    try {
      const errorBody = (await response.json()) as {
        error?: boolean | string;
        reason?: string;
      };
      if (errorBody.reason) {
        message = errorBody.reason;
      } else if (typeof errorBody.error === 'string') {
        message = errorBody.error;
      }
    } catch {
      // Keep the generic error message when parsing fails.
    }

    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

export function roundTemperature(value?: TemperatureValue) {
  return value?.degrees == null ? 0 : Math.round(value.degrees);
}

export function formatTemperature(value?: TemperatureValue) {
  return value?.degrees == null ? '--' : value.degrees.toFixed(1);
}

export function getPrecipitationPercent(precipitation?: Precipitation) {
  return precipitation?.probability?.percent ?? 0;
}

export function getWindSpeedValue(wind?: Wind) {
  return wind?.speed?.value == null ? 0 : Math.round(wind.speed.value);
}

export function formatWindSpeed(wind?: Wind) {
  const value = wind?.speed?.value;
  const unit = wind?.speed?.unit;

  if (value == null) {
    return '-';
  }

  if (unit === 'KILOMETERS_PER_HOUR') {
    return `${Math.round(value)}km/h`;
  }

  if (unit === 'MILES_PER_HOUR') {
    return `${Math.round(value)}mph`;
  }

  return `${Math.round(value)}`;
}

export function formatEnvironmentMetric(metric?: WeatherEnvironmentMetric) {
  return metric?.grade ?? '-';
}

export function formatSunTime(timestamp?: string) {
  if (!timestamp) {
    return '-';
  }

  const timePart = timestamp.includes('T') ? timestamp.split('T')[1] : timestamp;
  const [hourText, minuteText = '00'] = timePart.split(':');
  const hour = Number(hourText);
  const minute = Number(minuteText);

  if (Number.isNaN(hour) || Number.isNaN(minute)) {
    return '-';
  }

  const meridiem = hour < 12 ? '오전' : '오후';
  const normalizedHour = hour % 12 === 0 ? 12 : hour % 12;

  return `${meridiem} ${normalizedHour}:${String(minute).padStart(2, '0')}`;
}

export function buildWeatherIconUrl(condition?: WeatherCondition) {
  if (!condition?.iconBaseUri) {
    return null;
  }

  if (condition.iconBaseUri.startsWith('data:')) {
    return condition.iconBaseUri;
  }

  return `${condition.iconBaseUri}_dark.svg`;
}

export function formatCurrentDateTime(timestamp?: string, timeZoneId?: string) {
  if (!timestamp) {
    return '-';
  }

  const date = new Date(timestamp);
  const weekday = new Intl.DateTimeFormat('ko-KR', {
    weekday: 'long',
    timeZone: timeZoneId,
  }).format(date);
  const time = new Intl.DateTimeFormat('ko-KR', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: timeZoneId,
  }).format(date);

  return `(${weekday}) ${time}`;
}

export function formatHourlyLabel(displayDateTime?: DisplayDateTime) {
  const hour = displayDateTime?.hours;

  if (hour == null) {
    return '-';
  }

  const meridiem = hour < 12 ? '오전' : '오후';
  const normalizedHour = hour % 12 === 0 ? 12 : hour % 12;

  return `${meridiem} ${normalizedHour}시`;
}

export function formatDayLabel(displayDate?: DisplayDate) {
  if (!displayDate?.year || !displayDate.month || !displayDate.day) {
    return '-';
  }

  const date = new Date(Date.UTC(displayDate.year, displayDate.month - 1, displayDate.day, 12));
  return new Intl.DateTimeFormat('ko-KR', {
    weekday: 'short',
    timeZone: 'UTC',
  }).format(date);
}

function createEmojiIconDataUri(symbol: string) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
      <rect width="96" height="96" rx="24" fill="rgba(255,255,255,0)" />
      <text x="50%" y="55%" font-size="54" text-anchor="middle" dominant-baseline="middle">
        ${symbol}
      </text>
    </svg>
  `.trim();

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function getWeatherPresentation(weatherCode?: number, isDaytime = true): WeatherPresentation {
  const defaultPresentation = isDaytime
    ? { description: '날씨 정보 준비 중', symbol: '🌤️' }
    : { description: '날씨 정보 준비 중', symbol: '🌙' };
  const presentation = weatherCode == null ? undefined : WEATHER_CODE_PRESENTATION[weatherCode];

  if (!presentation) {
    return defaultPresentation;
  }

  return isDaytime ? presentation.day : presentation.night ?? presentation.day;
}

function toTemperatureValue(value?: number): TemperatureValue | undefined {
  if (value == null) {
    return undefined;
  }

  return {
    degrees: value,
    unit: 'CELSIUS',
  };
}

function toWind(value?: number, directionDegrees?: number, gustValue?: number): Wind | undefined {
  if (value == null && directionDegrees == null && gustValue == null) {
    return undefined;
  }

  return {
    direction:
      directionDegrees == null
        ? undefined
        : {
            degrees: directionDegrees,
            cardinal: toWindCardinal(directionDegrees),
          },
    speed:
      value == null
        ? undefined
        : {
            unit: 'KILOMETERS_PER_HOUR',
            value,
          },
    gust:
      gustValue == null
        ? undefined
        : {
            unit: 'KILOMETERS_PER_HOUR',
            value: gustValue,
          },
  };
}

function toWindCardinal(directionDegrees: number) {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const normalized = ((directionDegrees % 360) + 360) % 360;
  const index = Math.round(normalized / 45) % directions.length;

  return directions[index];
}

function normalizeOpenMeteoTime(time?: string, utcOffsetSeconds = 0) {
  if (!time) {
    return undefined;
  }

  const [datePart, timePart] = time.split('T');
  if (!datePart || !timePart) {
    return undefined;
  }

  const [year, month, day] = datePart.split('-').map(Number);
  const [hours, minutes] = timePart.split(':').map(Number);

  if (
    [year, month, day, hours, minutes].some((value) => Number.isNaN(value) || value == null)
  ) {
    return undefined;
  }

  return new Date(
    Date.UTC(year, month - 1, day, hours, minutes) - utcOffsetSeconds * 1000,
  ).toISOString();
}

function parseOpenMeteoDisplayTime(time?: string): DisplayDateTime | undefined {
  if (!time) {
    return undefined;
  }

  const [datePart, timePart] = time.split('T');
  if (!datePart || !timePart) {
    return undefined;
  }

  const [year, month, day] = datePart.split('-').map(Number);
  const [hours, minutes] = timePart.split(':').map(Number);

  if (
    [year, month, day, hours, minutes].some((value) => Number.isNaN(value) || value == null)
  ) {
    return undefined;
  }

  return {
    year,
    month,
    day,
    hours,
    minutes,
  };
}

function parseOpenMeteoDisplayDate(date?: string): DisplayDate | undefined {
  if (!date) {
    return undefined;
  }

  const [year, month, day] = date.split('-').map(Number);

  if ([year, month, day].some((value) => Number.isNaN(value) || value == null)) {
    return undefined;
  }

  return {
    year,
    month,
    day,
  };
}

function formatFullDayLabel(date?: string) {
  const displayDate = parseOpenMeteoDisplayDate(date);

  if (!displayDate?.year || !displayDate.month || !displayDate.day) {
    return '-';
  }

  const parsedDate = new Date(Date.UTC(displayDate.year, displayDate.month - 1, displayDate.day, 12));
  const weekday = new Intl.DateTimeFormat('ko-KR', {
    weekday: 'long',
    timeZone: 'UTC',
  }).format(parsedDate);

  return `${displayDate.month}월 ${displayDate.day}일 ${weekday}`;
}

function findCurrentHourlyIndex(currentTime?: string, hourlyTimes?: string[]) {
  if (!currentTime || !hourlyTimes?.length) {
    return -1;
  }

  const currentHourKey = currentTime.slice(0, 13);
  return hourlyTimes.findIndex((hourlyTime) => hourlyTime.slice(0, 13) === currentHourKey);
}

async function fetchKmaWeatherSnapshot(
  location: WeatherLocation,
  signal: AbortSignal,
): Promise<WeatherSnapshot> {
  const snapshot = await fetchWeatherResource<WeatherSnapshot>(
    buildKmaWeatherApiUrl(location, { includeEnvironment: 0 }),
    signal,
  );

  return {
    ...snapshot,
    location: {
      ...location,
      ...snapshot.location,
      updatedAt: location.updatedAt,
    },
    provider: snapshot.provider ?? 'kma',
    providerLabel: snapshot.providerLabel ?? '기상청 위치기반 날씨',
  };
}

export async function fetchWeatherEnvironmentSnapshot(
  location: WeatherLocation,
  signal: AbortSignal,
): Promise<WeatherSnapshot | null> {
  try {
    return await fetchWeatherResource<WeatherSnapshot>(
      buildKmaWeatherApiUrl(location, { environmentOnly: 1 }),
      signal,
    );
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error;
    }

    console.warn('Weather environment fallback failed.', error);
    return null;
  }
}

function mergeHourlyEnvironment(
  hourly: HourlyWeatherItem[],
  environmentHourly: HourlyWeatherItem[] = [],
) {
  const environmentByKey = new Map(
    environmentHourly.map((item) => [`${item.dateKey}-${item.timeLabel}`, item]),
  );

  return hourly.map((item) => {
    const environment = environmentByKey.get(`${item.dateKey}-${item.timeLabel}`);

    return {
      ...item,
      pm10: environment?.pm10 ?? item.pm10,
      pm10Grade: environment?.pm10Grade ?? item.pm10Grade,
      pm25: environment?.pm25 ?? item.pm25,
      pm25Grade: environment?.pm25Grade ?? item.pm25Grade,
      uvGrade: environment?.uvGrade ?? item.uvGrade,
      uvIndex: environment?.uvIndex ?? item.uvIndex,
    };
  });
}

function mergeDailyEnvironment(
  daily: DailyWeatherItem[],
  environmentDaily: DailyWeatherItem[] = [],
) {
  const environmentByDate = new Map(environmentDaily.map((item) => [item.dateKey, item]));

  return daily.map((item) => {
    const environment = environmentByDate.get(item.dateKey);

    return {
      ...item,
      sunriseTime: environment?.sunriseTime ?? item.sunriseTime,
      sunsetTime: environment?.sunsetTime ?? item.sunsetTime,
    };
  });
}

export function mergeWeatherEnvironmentSnapshot(
  weatherSnapshot: WeatherSnapshot,
  environmentSnapshot: WeatherSnapshot,
): WeatherSnapshot {
  return {
    ...weatherSnapshot,
    current: {
      ...weatherSnapshot.current,
      environment: {
        ...weatherSnapshot.current.environment,
        ...environmentSnapshot.current.environment,
      },
    },
    hourly: mergeHourlyEnvironment(weatherSnapshot.hourly, environmentSnapshot.hourly),
    daily: mergeDailyEnvironment(weatherSnapshot.daily, environmentSnapshot.daily),
    providerLabel: environmentSnapshot.providerLabel ?? weatherSnapshot.providerLabel,
  };
}

async function fetchOpenMeteoWeatherSnapshot(
  location: WeatherLocation,
  signal: AbortSignal,
): Promise<WeatherSnapshot> {
  const [forecast, environmentSnapshot] = await Promise.all([
    fetchWeatherResource<OpenMeteoForecastResponse>(
      buildWeatherApiUrl(location.latitude, location.longitude),
      signal,
    ),
    fetchWeatherEnvironmentSnapshot(location, signal),
  ]);
  const timeZoneId = forecast.timezone ?? 'Asia/Seoul';
  const utcOffsetSeconds = forecast.utc_offset_seconds ?? 0;
  const currentWeather = forecast.current;
  const hourlyWeather = forecast.hourly;
  const dailyWeather = forecast.daily;
  const currentPresentation = getWeatherPresentation(
    currentWeather?.weather_code,
    currentWeather?.is_day === 1,
  );
  const currentHourlyIndex = findCurrentHourlyIndex(currentWeather?.time, hourlyWeather?.time);
  const currentPrecipitationPercent =
    currentHourlyIndex >= 0
      ? hourlyWeather?.precipitation_probability?.[currentHourlyIndex] ?? 0
      : hourlyWeather?.precipitation_probability?.[0] ?? 0;
  const currentConditions: CurrentConditionsResponse = {
    currentTime: normalizeOpenMeteoTime(currentWeather?.time, utcOffsetSeconds),
    timeZone: {
      id: timeZoneId,
    },
    weatherCondition: {
      iconBaseUri: createEmojiIconDataUri(currentPresentation.symbol),
      description: {
        text: currentPresentation.description,
        languageCode: 'ko',
      },
      type: currentWeather?.weather_code == null ? undefined : String(currentWeather.weather_code),
    },
    temperature: toTemperatureValue(currentWeather?.temperature_2m),
    feelsLikeTemperature: toTemperatureValue(currentWeather?.apparent_temperature),
    precipitation: {
      probability: {
        percent: currentPrecipitationPercent,
        type: 'RAIN',
      },
      qpf:
        currentWeather?.precipitation == null
          ? undefined
          : {
              quantity: currentWeather.precipitation,
              unit: 'MILLIMETER',
            },
    },
    wind: toWind(
      currentWeather?.wind_speed_10m,
      currentWeather?.wind_direction_10m,
      currentWeather?.wind_gusts_10m,
    ),
    isDaytime: currentWeather?.is_day === 1,
    relativeHumidity: currentWeather?.relative_humidity_2m,
  };

  const hourly = (hourlyWeather?.time ?? []).map((time, index) => {
    const weatherPresentation = getWeatherPresentation(
      hourlyWeather?.weather_code?.[index],
      hourlyWeather?.is_day?.[index] === 1,
    );

    return {
      dateKey: time.slice(0, 10),
      timeLabel: formatHourlyLabel(parseOpenMeteoDisplayTime(time)),
      temperature: Number((hourlyWeather?.temperature_2m?.[index] ?? 0).toFixed(1)),
      precipitationPercent: hourlyWeather?.precipitation_probability?.[index] ?? 0,
      windSpeed: Math.round(hourlyWeather?.wind_speed_10m?.[index] ?? 0),
      iconUrl: createEmojiIconDataUri(weatherPresentation.symbol),
      description: weatherPresentation.description,
    };
  });
  const daily = (dailyWeather?.time ?? []).map((date, index) => {
    const weatherPresentation = getWeatherPresentation(dailyWeather?.weather_code?.[index], true);

    return {
      dateKey: date,
      dayLabel: formatDayLabel(parseOpenMeteoDisplayDate(date)),
      fullLabel: formatFullDayLabel(date),
      iconUrl: createEmojiIconDataUri(weatherPresentation.symbol),
      description: weatherPresentation.description,
      maxTemperature: Number((dailyWeather?.temperature_2m_max?.[index] ?? 0).toFixed(1)),
      minTemperature: Number((dailyWeather?.temperature_2m_min?.[index] ?? 0).toFixed(1)),
    };
  });

  return {
    current: {
      ...currentConditions,
      environment: environmentSnapshot?.current.environment,
    },
    hourly: mergeHourlyEnvironment(hourly, environmentSnapshot?.hourly),
    daily: mergeDailyEnvironment(daily, environmentSnapshot?.daily),
    timeZoneId,
    location,
    provider: 'open-meteo',
    providerLabel: environmentSnapshot?.providerLabel ?? '백업 날씨',
  };
}

export async function fetchWeatherSnapshot(
  location: WeatherLocation,
  signal: AbortSignal,
): Promise<WeatherSnapshot> {
  try {
    return await fetchKmaWeatherSnapshot(location, signal);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error;
    }

    if (error instanceof Error && error.message.includes('기상청 API 키')) {
      throw error;
    }

    console.warn('KMA weather fallback activated.', error);
    return fetchOpenMeteoWeatherSnapshot(location, signal);
  }
}
