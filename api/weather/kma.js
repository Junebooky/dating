const KMA_API_BASE_URL =
  'https://apihub.kma.go.kr/api/typ02/openApi/VilageFcstInfoService_2.0';
const AIRKOREA_API_BASE_URL =
  process.env.AIRKOREA_API_BASE_URL ||
  'https://apis.data.go.kr/B552584/ArpltnInforInqireSvc';
const OPEN_METEO_AIR_QUALITY_API_BASE_URL =
  'https://air-quality-api.open-meteo.com/v1/air-quality';
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAILY_FORECAST_COUNT = 5;

const DEFAULT_LOCATION = {
  label: '서울',
  latitude: 37.5665,
  longitude: 126.978,
  source: 'fallback',
  coordsLabel: '37.5665, 126.9780',
};

const ULTRA_NCST_CATEGORIES = ['T1H', 'RN1', 'UUU', 'VVV', 'REH', 'PTY', 'VEC', 'WSD'];
const VILLAGE_FORECAST_CATEGORIES = [
  'TMP',
  'POP',
  'WSD',
  'VEC',
  'SKY',
  'PTY',
  'REH',
  'TMN',
  'TMX',
];

const AIRKOREA_SIDO_CENTERS = [
  { name: '서울', latitude: 37.5665, longitude: 126.978 },
  { name: '인천', latitude: 37.4563, longitude: 126.7052 },
  { name: '경기', latitude: 37.2636, longitude: 127.0286 },
  { name: '강원', latitude: 37.8813, longitude: 127.7298 },
  { name: '충북', latitude: 36.6357, longitude: 127.4913 },
  { name: '충남', latitude: 36.6588, longitude: 126.6728 },
  { name: '대전', latitude: 36.3504, longitude: 127.3845 },
  { name: '세종', latitude: 36.4801, longitude: 127.289 },
  { name: '전북', latitude: 35.8242, longitude: 127.148 },
  { name: '전남', latitude: 34.8161, longitude: 126.4629 },
  { name: '광주', latitude: 35.1595, longitude: 126.8526 },
  { name: '경북', latitude: 36.5684, longitude: 128.7294 },
  { name: '대구', latitude: 35.8714, longitude: 128.6014 },
  { name: '울산', latitude: 35.5384, longitude: 129.3114 },
  { name: '부산', latitude: 35.1796, longitude: 129.0756 },
  { name: '경남', latitude: 35.2383, longitude: 128.6924 },
  { name: '제주', latitude: 33.4996, longitude: 126.5312 },
];

const SKY_PRESENTATION = {
  1: { description: '맑음', symbol: '☀️' },
  3: { description: '구름 많음', symbol: '⛅' },
  4: { description: '흐림', symbol: '☁️' },
};

const PRECIPITATION_PRESENTATION = {
  1: { description: '비', symbol: '🌧️' },
  2: { description: '비 또는 눈', symbol: '🌨️' },
  3: { description: '눈', symbol: '❄️' },
  4: { description: '소나기', symbol: '🌦️' },
  5: { description: '빗방울', symbol: '🌦️' },
  6: { description: '빗방울 또는 눈날림', symbol: '🌨️' },
  7: { description: '눈날림', symbol: '🌨️' },
};

function sendJson(response, statusCode, payload) {
  if (typeof response.status === 'function') {
    response.status(statusCode);
  } else {
    response.statusCode = statusCode;
  }

  response.setHeader('Content-Type', 'application/json');
  response.end(JSON.stringify(payload));
}

function clampCoordinate(value, fallback, min, max) {
  if (value == null || value === '') {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, parsed));
}

function sanitizeText(value, fallback) {
  const text = typeof value === 'string' ? value.trim() : '';
  return text ? text.slice(0, 40) : fallback;
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

function getKstDate(date = new Date(), offsetMinutes = 0) {
  return new Date(date.getTime() + KST_OFFSET_MS + offsetMinutes * 60 * 1000);
}

function formatKmaDate(kstDate) {
  return `${kstDate.getUTCFullYear()}${pad2(kstDate.getUTCMonth() + 1)}${pad2(
    kstDate.getUTCDate(),
  )}`;
}

function formatDateKey(kmaDate) {
  return `${kmaDate.slice(0, 4)}-${kmaDate.slice(4, 6)}-${kmaDate.slice(6, 8)}`;
}

function formatKmaTime(hour, minute = 0) {
  return `${pad2(hour)}${pad2(minute)}`;
}

function parseKmaNumber(value) {
  if (value == null) {
    return undefined;
  }

  const parsed = Number(String(value).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function roundNumber(value) {
  return value == null ? undefined : Math.round(value);
}

function msToKmh(value) {
  return value == null ? undefined : value * 3.6;
}

function toTemperatureValue(value) {
  return value == null
    ? undefined
    : {
        degrees: value,
        unit: 'CELSIUS',
      };
}

function toWind(valueMetersPerSecond, directionDegrees) {
  const speedKmh = msToKmh(valueMetersPerSecond);

  if (speedKmh == null && directionDegrees == null) {
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
      speedKmh == null
        ? undefined
        : {
            unit: 'KILOMETERS_PER_HOUR',
            value: speedKmh,
          },
  };
}

function toWindCardinal(directionDegrees) {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const normalized = ((directionDegrees % 360) + 360) % 360;
  const index = Math.round(normalized / 45) % directions.length;

  return directions[index];
}

function createEmojiIconDataUri(symbol) {
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

function getWeatherPresentation(precipitationType, sky, hour = 12) {
  const pty = parseKmaNumber(precipitationType);

  if (pty && PRECIPITATION_PRESENTATION[pty]) {
    return PRECIPITATION_PRESENTATION[pty];
  }

  const skyCode = parseKmaNumber(sky);

  if (skyCode && SKY_PRESENTATION[skyCode]) {
    const presentation = SKY_PRESENTATION[skyCode];

    if (skyCode === 1 && (hour < 6 || hour >= 19)) {
      return { description: presentation.description, symbol: '🌙' };
    }

    return presentation;
  }

  return hour < 6 || hour >= 19
    ? { description: '날씨 정보 준비 중', symbol: '🌙' }
    : { description: '날씨 정보 준비 중', symbol: '🌤️' };
}

function toDisplayDateTime(date, time) {
  return {
    year: Number(date.slice(0, 4)),
    month: Number(date.slice(4, 6)),
    day: Number(date.slice(6, 8)),
    hours: Number(time.slice(0, 2)),
    minutes: Number(time.slice(2, 4)),
  };
}

function toDisplayDate(date) {
  return {
    year: Number(date.slice(0, 4)),
    month: Number(date.slice(4, 6)),
    day: Number(date.slice(6, 8)),
  };
}

function toKstIso(date, time) {
  const displayDateTime = toDisplayDateTime(date, time);

  return new Date(
    Date.UTC(
      displayDateTime.year,
      displayDateTime.month - 1,
      displayDateTime.day,
      displayDateTime.hours,
      displayDateTime.minutes,
    ) - KST_OFFSET_MS,
  ).toISOString();
}

function formatHourlyLabel(dateTime) {
  const hour = dateTime?.hours;

  if (hour == null) {
    return '-';
  }

  const meridiem = hour < 12 ? '오전' : '오후';
  const normalizedHour = hour % 12 === 0 ? 12 : hour % 12;

  return `${meridiem} ${normalizedHour}시`;
}

function formatDayLabel(displayDate) {
  const date = new Date(
    Date.UTC(displayDate.year, displayDate.month - 1, displayDate.day, 12),
  );

  return new Intl.DateTimeFormat('ko-KR', {
    weekday: 'short',
    timeZone: 'UTC',
  }).format(date);
}

function formatFullDayLabel(displayDate) {
  const date = new Date(
    Date.UTC(displayDate.year, displayDate.month - 1, displayDate.day, 12),
  );
  const weekday = new Intl.DateTimeFormat('ko-KR', {
    weekday: 'long',
    timeZone: 'UTC',
  }).format(date);

  return `${displayDate.month}월 ${displayDate.day}일 ${weekday}`;
}

function getUltraNowcastBaseTime(now = new Date()) {
  const kstDate = getKstDate(now);

  if (kstDate.getUTCMinutes() < 40) {
    kstDate.setUTCHours(kstDate.getUTCHours() - 1);
  }

  return {
    base_date: formatKmaDate(kstDate),
    base_time: formatKmaTime(kstDate.getUTCHours()),
  };
}

function getVillageForecastBaseTime(now = new Date()) {
  const baseHours = [2, 5, 8, 11, 14, 17, 20, 23];
  const kstDate = getKstDate(now, -50);
  const currentHour = kstDate.getUTCHours();
  let baseHour = [...baseHours].reverse().find((hour) => hour <= currentHour);

  if (baseHour == null) {
    kstDate.setUTCDate(kstDate.getUTCDate() - 1);
    baseHour = 23;
  }

  return {
    base_date: formatKmaDate(kstDate),
    base_time: formatKmaTime(baseHour),
  };
}

function convertLatLonToKmaGrid(latitude, longitude) {
  const re = 6371.00877 / 5.0;
  const degrad = Math.PI / 180.0;
  const slat1 = 30.0 * degrad;
  const slat2 = 60.0 * degrad;
  const olon = 126.0 * degrad;
  const olat = 38.0 * degrad;
  const xo = 43;
  const yo = 136;

  let sn =
    Math.tan(Math.PI * 0.25 + slat2 * 0.5) /
    Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sn = Math.log(Math.cos(slat1) / Math.cos(slat2)) / Math.log(sn);

  let sf = Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sf = (Math.pow(sf, sn) * Math.cos(slat1)) / sn;

  let ro = Math.tan(Math.PI * 0.25 + olat * 0.5);
  ro = (re * sf) / Math.pow(ro, sn);

  let ra = Math.tan(Math.PI * 0.25 + latitude * degrad * 0.5);
  ra = (re * sf) / Math.pow(ra, sn);

  let theta = longitude * degrad - olon;
  if (theta > Math.PI) {
    theta -= 2.0 * Math.PI;
  }
  if (theta < -Math.PI) {
    theta += 2.0 * Math.PI;
  }
  theta *= sn;

  return {
    nx: Math.floor(ra * Math.sin(theta) + xo + 0.5),
    ny: Math.floor(ro - ra * Math.cos(theta) + yo + 0.5),
  };
}

function toCategoryMap(items, valueKey) {
  return Object.fromEntries(
    items.map((item) => [item.category, parseKmaNumber(item[valueKey])]),
  );
}

function groupForecastItems(items) {
  const groups = new Map();

  for (const item of items) {
    if (!item.fcstDate || !item.fcstTime || !item.category) {
      continue;
    }

    const key = `${item.fcstDate}${item.fcstTime}`;
    const group =
      groups.get(key) ??
      {
        date: item.fcstDate,
        time: item.fcstTime,
        values: {},
      };
    group.values[item.category] = parseKmaNumber(item.fcstValue);
    groups.set(key, group);
  }

  return [...groups.values()].sort((left, right) =>
    `${left.date}${left.time}`.localeCompare(`${right.date}${right.time}`),
  );
}

function pickForecastGroup(groups, currentDate, currentHour) {
  const currentKey = `${currentDate}${formatKmaTime(currentHour)}`;

  return groups.find((group) => `${group.date}${group.time}` >= currentKey) ?? groups[0] ?? null;
}

function buildHourlyForecast(groups) {
  const nowKstDate = getKstDate();
  const currentDate = formatKmaDate(nowKstDate);
  const currentHour = nowKstDate.getUTCHours();
  const currentKey = `${currentDate}${formatKmaTime(currentHour)}`;

  return groups
    .filter((group) => `${group.date}${group.time}` >= currentKey)
    .slice(0, 48)
    .map((group) => {
      const displayDateTime = toDisplayDateTime(group.date, group.time);
      const presentation = getWeatherPresentation(
        group.values.PTY,
        group.values.SKY,
        displayDateTime.hours,
      );

      return {
        dateKey: formatDateKey(group.date),
        timeLabel: formatHourlyLabel(displayDateTime),
        temperature: roundOneDecimal(group.values.TMP ?? 0),
        precipitationPercent: Math.round(group.values.POP ?? 0),
        windSpeed: Math.round(msToKmh(group.values.WSD) ?? 0),
        iconUrl: createEmojiIconDataUri(presentation.symbol),
        description: presentation.description,
      };
    });
}

function buildDailyForecast(groups) {
  const byDate = new Map();

  for (const group of groups) {
    const day =
      byDate.get(group.date) ??
      {
        date: group.date,
        groups: [],
        minTemperature: undefined,
        maxTemperature: undefined,
      };

    if (group.values.TMN != null) {
      day.minTemperature = group.values.TMN;
    }
    if (group.values.TMX != null) {
      day.maxTemperature = group.values.TMX;
    }

    day.groups.push(group);
    byDate.set(group.date, day);
  }

  return [...byDate.values()]
    .sort((left, right) => left.date.localeCompare(right.date))
    .slice(0, DAILY_FORECAST_COUNT)
    .map((day) => {
      const temperatures = day.groups
        .map((group) => group.values.TMP)
        .filter((value) => value != null);
      const fallbackMin = temperatures.length ? Math.min(...temperatures) : 0;
      const fallbackMax = temperatures.length ? Math.max(...temperatures) : 0;
      const representative =
        day.groups.find((group) => group.time === '1200') ??
        day.groups.find((group) => group.time === '1500') ??
        day.groups[0];
      const presentation = getWeatherPresentation(
        representative?.values.PTY,
        representative?.values.SKY,
        Number(representative?.time.slice(0, 2) ?? 12),
      );
      const displayDate = toDisplayDate(day.date);

      return {
        dateKey: formatDateKey(day.date),
        dayLabel: formatDayLabel(displayDate),
        fullLabel: formatFullDayLabel(displayDate),
        iconUrl: createEmojiIconDataUri(presentation.symbol),
        description: presentation.description,
        maxTemperature: roundOneDecimal(day.maxTemperature ?? fallbackMax),
        minTemperature: roundOneDecimal(day.minTemperature ?? fallbackMin),
      };
    });
}

function getPm10Grade(value) {
  if (value == null) {
    return undefined;
  }

  if (value <= 15) {
    return '매우좋음';
  }
  if (value <= 30) {
    return '좋음';
  }
  if (value <= 80) {
    return '보통';
  }
  if (value <= 150) {
    return '나쁨';
  }

  return '매우나쁨';
}

function getPm25Grade(value) {
  if (value == null) {
    return undefined;
  }

  if (value <= 8) {
    return '매우좋음';
  }
  if (value <= 15) {
    return '좋음';
  }
  if (value <= 35) {
    return '보통';
  }
  if (value <= 75) {
    return '나쁨';
  }

  return '매우나쁨';
}

function getUvGrade(value) {
  if (value == null) {
    return undefined;
  }

  if (value < 3) {
    return '낮음';
  }
  if (value < 6) {
    return '보통';
  }
  if (value < 8) {
    return '높음';
  }
  if (value < 11) {
    return '매우높음';
  }

  return '위험';
}

function roundOneDecimal(value) {
  return value == null ? undefined : Math.round(value * 10) / 10;
}

function buildEnvironmentMetric(value, unit, grade, source) {
  if (value == null && !grade) {
    return undefined;
  }

  return { grade, source, unit, value };
}

function parseAirKoreaNumber(value) {
  if (value == null) {
    return undefined;
  }

  const text = String(value).trim();
  if (!text || text === '-' || text.toLowerCase() === 'null') {
    return undefined;
  }

  const parsed = Number(text.replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseAirKoreaDataTime(value) {
  const match = String(value ?? '').match(
    /(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2})/,
  );

  if (!match) {
    return null;
  }

  const [, year, month, day, hours, minutes] = match;

  return {
    year: Number(year),
    month: Number(month),
    day: Number(day),
    hours: Number(hours),
    minutes: Number(minutes),
  };
}

function getNearestAirKoreaSidoName(latitude, longitude) {
  const longitudeWeight = Math.cos((latitude * Math.PI) / 180);

  return AIRKOREA_SIDO_CENTERS.reduce(
    (nearest, candidate) => {
      const latitudeDistance = candidate.latitude - latitude;
      const longitudeDistance = (candidate.longitude - longitude) * longitudeWeight;
      const score = latitudeDistance * latitudeDistance + longitudeDistance * longitudeDistance;

      return score < nearest.score ? { name: candidate.name, score } : nearest;
    },
    { name: '서울', score: Number.POSITIVE_INFINITY },
  ).name;
}

function getAirKoreaKeyCandidates(serviceKey) {
  const trimmed = typeof serviceKey === 'string' ? serviceKey.trim() : '';
  if (!trimmed) {
    return [];
  }

  const candidates = [trimmed];

  try {
    const decoded = decodeURIComponent(trimmed);
    if (decoded && decoded !== trimmed) {
      candidates.push(decoded);
    }
  } catch {
    // Some keys contain literal percent characters. In that case, keep the original key.
  }

  return candidates;
}

function getAirKoreaItems(payload) {
  const items = payload?.response?.body?.items;
  if (!items) {
    return [];
  }

  return Array.isArray(items) ? items : [items];
}

function pickAirKoreaMeasurement(items, label) {
  const validItems = items.filter(
    (item) =>
      parseAirKoreaNumber(item.pm10Value) != null ||
      parseAirKoreaNumber(item.pm25Value) != null,
  );

  if (validItems.length === 0) {
    return null;
  }

  const labelHint = String(label ?? '')
    .replace(/날씨|현재\s*위치|기준|대한민국|특별시|광역시|특별자치시|특별자치도|도/g, '')
    .trim();

  if (labelHint) {
    const matchedItem = validItems.find((item) => {
      const stationName = String(item.stationName ?? '').trim();
      return stationName && (stationName.includes(labelHint) || labelHint.includes(stationName));
    });

    if (matchedItem) {
      return matchedItem;
    }
  }

  return validItems[0];
}

function getAirKoreaServiceKey() {
  return (
    process.env.AIRKOREA_API_KEY ||
    process.env.AIRKOREA_SERVICE_KEY ||
    process.env.AIRKOREA_AUTH_KEY ||
    ''
  );
}

async function fetchAirKorea(endpoint, params, serviceKey) {
  let lastError;

  for (const key of getAirKoreaKeyCandidates(serviceKey)) {
    const url = new URL(`${AIRKOREA_API_BASE_URL}/${endpoint}`);

    Object.entries(params).forEach(([paramKey, value]) => {
      url.searchParams.set(paramKey, String(value));
    });
    url.searchParams.set('serviceKey', key);

    try {
      const response = await fetch(url, {
        headers: {
          Accept: 'application/json',
        },
      });
      const body = await response.text();

      if (!response.ok) {
        throw new Error(`AirKorea 요청에 실패했습니다. (${response.status})`);
      }

      let payload;
      try {
        payload = JSON.parse(body);
      } catch {
        throw new Error('AirKorea가 JSON이 아닌 응답을 반환했습니다.');
      }

      const header = payload?.response?.header;
      if (header?.resultCode && header.resultCode !== '00') {
        throw new Error(header.resultMsg || 'AirKorea 응답이 정상 코드가 아닙니다.');
      }

      return getAirKoreaItems(payload);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error('AirKorea API 키가 설정되지 않았습니다.');
}

function toAirKoreaHourlyEnvironment(item) {
  const displayDateTime = parseAirKoreaDataTime(item.dataTime);

  if (!displayDateTime) {
    return null;
  }

  const pm10 = roundOneDecimal(parseAirKoreaNumber(item.pm10Value));
  const pm25 = roundOneDecimal(parseAirKoreaNumber(item.pm25Value));

  if (pm10 == null && pm25 == null) {
    return null;
  }

  return {
    dateKey: `${displayDateTime.year}-${pad2(displayDateTime.month)}-${pad2(
      displayDateTime.day,
    )}`,
    pm10,
    pm10Grade: getPm10Grade(pm10),
    pm10Source: 'AirKorea',
    pm25,
    pm25Grade: getPm25Grade(pm25),
    pm25Source: 'AirKorea',
    timeLabel: formatHourlyLabel(displayDateTime),
  };
}

async function fetchAirKoreaStationHourlyEnvironment(stationName, serviceKey) {
  if (!stationName) {
    return [];
  }

  const measurements = await fetchAirKorea(
    'getMsrstnAcctoRltmMesureDnsty',
    {
      dataTerm: 'DAILY',
      numOfRows: 24,
      pageNo: 1,
      returnType: 'json',
      stationName,
      ver: '1.0',
    },
    serviceKey,
  );

  return measurements.map(toAirKoreaHourlyEnvironment).filter(Boolean);
}

function mergeEnvironmentHourlySources(baseHourly, overrideHourly) {
  const orderedKeys = [];
  const byKey = new Map();

  for (const item of baseHourly) {
    const key = `${item.dateKey}-${item.timeLabel}`;
    orderedKeys.push(key);
    byKey.set(key, item);
  }

  for (const item of overrideHourly) {
    const key = `${item.dateKey}-${item.timeLabel}`;
    if (!byKey.has(key)) {
      orderedKeys.push(key);
    }
    byKey.set(key, {
      ...byKey.get(key),
      ...item,
    });
  }

  return orderedKeys.map((key) => byKey.get(key)).filter(Boolean);
}

function preferAirKoreaHourlyValues(hourly, currentEnvironment) {
  const airKoreaPm10 = isAirKoreaMetric(currentEnvironment?.pm10)
    ? currentEnvironment.pm10.value
    : undefined;
  const airKoreaPm25 = isAirKoreaMetric(currentEnvironment?.pm25)
    ? currentEnvironment.pm25.value
    : undefined;

  return hourly.map((item) => {
    const pm10 =
      airKoreaPm10 == null
        ? item.pm10
        : item.pm10Source === 'AirKorea'
          ? item.pm10
          : airKoreaPm10;
    const pm25 =
      airKoreaPm25 == null
        ? item.pm25
        : item.pm25Source === 'AirKorea'
          ? item.pm25
          : airKoreaPm25;

    return {
      ...item,
      pm10,
      pm10Grade: getPm10Grade(pm10),
      pm25,
      pm25Grade: getPm25Grade(pm25),
    };
  });
}

async function fetchAirKoreaCurrentEnvironment(latitude, longitude, label) {
  const serviceKey = getAirKoreaServiceKey();

  if (!serviceKey) {
    return {};
  }

  const sidoName = getNearestAirKoreaSidoName(latitude, longitude);
  const measurements = await fetchAirKorea(
    'getCtprvnRltmMesureDnsty',
    {
      numOfRows: 100,
      pageNo: 1,
      returnType: 'json',
      sidoName,
      ver: '1.0',
    },
    serviceKey,
  );
  const measurement = pickAirKoreaMeasurement(measurements, label);

  if (!measurement) {
    return {};
  }

  const pm10 = roundOneDecimal(parseAirKoreaNumber(measurement.pm10Value));
  const pm25 = roundOneDecimal(parseAirKoreaNumber(measurement.pm25Value));
  const stationName = String(measurement.stationName ?? '').trim();
  const source = stationName ? `AirKorea ${stationName}` : 'AirKorea';
  const hourly = await fetchAirKoreaStationHourlyEnvironment(stationName, serviceKey).catch(
    (error) => {
      console.warn('AirKorea hourly environment data failed', error);
      return [];
    },
  );

  return {
    dataTime: measurement.dataTime,
    hourly,
    pm10: buildEnvironmentMetric(pm10, '㎍/㎥', getPm10Grade(pm10), source),
    pm25: buildEnvironmentMetric(pm25, '㎍/㎥', getPm25Grade(pm25), source),
  };
}

function isAirKoreaMetric(metric) {
  return metric?.source?.startsWith('AirKorea');
}

function mergeHourlyEnvironment(hourly, environmentHourly, currentEnvironment) {
  const environmentByKey = new Map(
    environmentHourly.map((item) => [`${item.dateKey}-${item.timeLabel}`, item]),
  );
  const airKoreaPm10 = isAirKoreaMetric(currentEnvironment?.pm10)
    ? currentEnvironment.pm10.value
    : undefined;
  const airKoreaPm25 = isAirKoreaMetric(currentEnvironment?.pm25)
    ? currentEnvironment.pm25.value
    : undefined;

  return hourly.map((item) => {
    const environment = environmentByKey.get(`${item.dateKey}-${item.timeLabel}`);
    const pm10 =
      airKoreaPm10 == null
        ? environment?.pm10
        : environment?.pm10Source === 'AirKorea'
          ? environment.pm10
          : airKoreaPm10;
    const pm25 =
      airKoreaPm25 == null
        ? environment?.pm25
        : environment?.pm25Source === 'AirKorea'
          ? environment.pm25
          : airKoreaPm25;

    return {
      ...item,
      ...environment,
      pm10,
      pm10Grade: getPm10Grade(pm10),
      pm25,
      pm25Grade: getPm25Grade(pm25),
    };
  });
}

function mergeDailySolar(daily, solarDaily) {
  const solarByDate = new Map(solarDaily.map((item) => [item.dateKey, item]));

  return daily.map((item) => ({
    ...item,
    ...solarByDate.get(item.dateKey),
  }));
}

function buildWeatherProviderLabel(environment) {
  const pmSource = environment?.current?.pm10?.source ?? environment?.current?.pm25?.source;

  if (pmSource?.startsWith('AirKorea')) {
    return '기상청 날씨 + 에어코리아 대기질';
  }

  if (pmSource || environment?.current?.uvIndex) {
    return '기상청 날씨 + 환경지표';
  }

  return '기상청 날씨';
}

async function fetchKma(endpoint, params, authKey) {
  const url = new URL(`${KMA_API_BASE_URL}/${endpoint}`);

  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, String(value));
  });
  url.searchParams.set('authKey', authKey);

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
    },
  });
  const body = await response.text();

  if (!response.ok) {
    let message = `기상청 API 요청에 실패했습니다. (${response.status})`;

    try {
      const errorPayload = JSON.parse(body);
      message = errorPayload?.result?.message || errorPayload?.message || message;
    } catch {
      // Keep the generic HTTP message when the API returns a non-JSON error body.
    }

    throw new Error(message);
  }

  let payload;
  try {
    payload = JSON.parse(body);
  } catch {
    throw new Error('기상청 API가 JSON이 아닌 응답을 반환했습니다.');
  }

  const header = payload?.response?.header;
  if (header?.resultCode && header.resultCode !== '00') {
    throw new Error(header.resultMsg || '기상청 API 응답이 정상 코드가 아닙니다.');
  }
  if (payload?.result?.status && payload.result.status !== 200) {
    throw new Error(payload.result.message || '기상청 API 응답이 정상 코드가 아닙니다.');
  }

  const item = payload?.response?.body?.items?.item ?? [];
  return Array.isArray(item) ? item : [item];
}

function toSolarTimeString(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(
    date.getHours(),
  )}:${pad2(date.getMinutes())}`;
}

function getSolarEventTime(date, latitude, longitude, isSunrise) {
  const rad = Math.PI / 180;
  const zenith = 90.833;
  const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const yearStart = new Date(date.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((dayStart.getTime() - yearStart.getTime()) / 86_400_000);
  const lngHour = longitude / 15;
  const approximateTime = dayOfYear + ((isSunrise ? 6 : 18) - lngHour) / 24;
  const meanAnomaly = 0.9856 * approximateTime - 3.289;
  let trueLongitude =
    meanAnomaly +
    1.916 * Math.sin(meanAnomaly * rad) +
    0.02 * Math.sin(2 * meanAnomaly * rad) +
    282.634;
  trueLongitude = ((trueLongitude % 360) + 360) % 360;

  let rightAscension = Math.atan(0.91764 * Math.tan(trueLongitude * rad)) / rad;
  rightAscension = ((rightAscension % 360) + 360) % 360;
  rightAscension += Math.floor(trueLongitude / 90) * 90 - Math.floor(rightAscension / 90) * 90;
  rightAscension /= 15;

  const sinDeclination = 0.39782 * Math.sin(trueLongitude * rad);
  const cosDeclination = Math.cos(Math.asin(sinDeclination));
  const cosHour =
    (Math.cos(zenith * rad) - sinDeclination * Math.sin(latitude * rad)) /
    (cosDeclination * Math.cos(latitude * rad));

  if (cosHour < -1 || cosHour > 1) {
    return undefined;
  }

  const localHourAngle = (isSunrise ? 360 - Math.acos(cosHour) / rad : Math.acos(cosHour) / rad) / 15;
  const localMeanTime =
    localHourAngle + rightAscension - 0.06571 * approximateTime - 6.622;
  const utcHour = ((localMeanTime - lngHour) % 24 + 24) % 24;
  const localHour = utcHour + 9;
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  result.setHours(Math.floor(localHour), Math.round((localHour % 1) * 60), 0, 0);

  return toSolarTimeString(result);
}

function buildSolarDaily(latitude, longitude) {
  return Array.from({ length: DAILY_FORECAST_COUNT }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() + index);
    const dateKey = `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

    return {
      dateKey,
      sunriseTime: getSolarEventTime(date, latitude, longitude, true),
      sunsetTime: getSolarEventTime(date, latitude, longitude, false),
    };
  });
}

function getCurrentOpenMeteoHourKey() {
  const kstDate = getKstDate();

  return `${formatDateKey(formatKmaDate(kstDate))}T${pad2(kstDate.getUTCHours())}`;
}

async function fetchOpenMeteoAirQuality(latitude, longitude) {
  const url = new URL(OPEN_METEO_AIR_QUALITY_API_BASE_URL);

  url.searchParams.set('latitude', String(latitude));
  url.searchParams.set('longitude', String(longitude));
  url.searchParams.set('hourly', ['pm10', 'pm2_5', 'uv_index'].join(','));
  url.searchParams.set('timezone', 'Asia/Seoul');
  url.searchParams.set('forecast_days', String(DAILY_FORECAST_COUNT));

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Open-Meteo 대기질 요청에 실패했습니다. (${response.status})`);
  }

  return response.json();
}

async function fetchEnvironmentData(latitude, longitude, label) {
  const [airQualityResult, airKoreaResult] = await Promise.allSettled([
    fetchOpenMeteoAirQuality(latitude, longitude),
    fetchAirKoreaCurrentEnvironment(latitude, longitude, label),
  ]);
  const airQuality = airQualityResult.status === 'fulfilled' ? airQualityResult.value : null;
  const airKorea = airKoreaResult.status === 'fulfilled' ? airKoreaResult.value : {};

  if (airQualityResult.status === 'rejected') {
    console.warn('Open-Meteo environment data failed', airQualityResult.reason);
  }
  if (airKoreaResult.status === 'rejected') {
    console.warn('AirKorea environment data failed', airKoreaResult.reason);
  }

  const airTimes = airQuality?.hourly?.time ?? [];
  const currentHourKey = getCurrentOpenMeteoHourKey();
  const foundCurrentAirIndex = airTimes.findIndex(
    (time) => String(time).slice(0, 13) >= currentHourKey,
  );
  const currentAirIndex = airTimes.length === 0 ? -1 : Math.max(0, foundCurrentAirIndex);
  const currentPm10 = roundOneDecimal(airQuality?.hourly?.pm10?.[currentAirIndex]);
  const currentPm25 = roundOneDecimal(airQuality?.hourly?.pm2_5?.[currentAirIndex]);
  const currentUvIndex = roundOneDecimal(airQuality?.hourly?.uv_index?.[currentAirIndex]);
  const solarDaily = buildSolarDaily(latitude, longitude);
  const todaySolar = solarDaily[0];

  const current = {
      pm10:
        airKorea.pm10 ??
        buildEnvironmentMetric(currentPm10, '㎍/㎥', getPm10Grade(currentPm10), 'Open-Meteo'),
      pm25:
        airKorea.pm25 ??
        buildEnvironmentMetric(currentPm25, '㎍/㎥', getPm25Grade(currentPm25), 'Open-Meteo'),
      sunriseTime: todaySolar.sunriseTime,
      sunsetTime: todaySolar.sunsetTime,
      uvIndex: buildEnvironmentMetric(
        currentUvIndex,
        'index',
        getUvGrade(currentUvIndex),
        'Open-Meteo',
      ),
    };
  const hourly = mergeEnvironmentHourlySources(
      airTimes.map((time, index) => {
        const displayDateTime = {
          year: Number(String(time).slice(0, 4)),
          month: Number(String(time).slice(5, 7)),
          day: Number(String(time).slice(8, 10)),
          hours: Number(String(time).slice(11, 13)),
          minutes: 0,
        };
        const pm10 = roundOneDecimal(airQuality?.hourly?.pm10?.[index]);
        const pm25 = roundOneDecimal(airQuality?.hourly?.pm2_5?.[index]);
        const uvIndex = roundOneDecimal(airQuality?.hourly?.uv_index?.[index]);

        return {
          dateKey: String(time).slice(0, 10),
          pm10,
          pm10Grade: getPm10Grade(pm10),
          pm10Source: 'Open-Meteo',
          pm25,
          pm25Grade: getPm25Grade(pm25),
          pm25Source: 'Open-Meteo',
          timeLabel: formatHourlyLabel(displayDateTime),
          uvGrade: getUvGrade(uvIndex),
          uvIndex,
        };
      }),
      airKorea.hourly ?? [],
    );

  return {
    current,
    daily: solarDaily,
    hourly: preferAirKoreaHourlyValues(hourly, current),
  };
}

function buildCurrentConditions({ forecastGroup, location, nowcast, nowcastBase }) {
  const nowKstDate = getKstDate();
  const currentHour = nowKstDate.getUTCHours();
  const temperature = nowcast.T1H ?? forecastGroup?.values.TMP;
  const humidity = roundNumber(nowcast.REH ?? forecastGroup?.values.REH);
  const windSpeed = nowcast.WSD ?? forecastGroup?.values.WSD;
  const windDirection = nowcast.VEC ?? forecastGroup?.values.VEC;
  const precipitationType = nowcast.PTY ?? forecastGroup?.values.PTY;
  const presentation = getWeatherPresentation(
    precipitationType,
    forecastGroup?.values.SKY,
    currentHour,
  );

  return {
    currentTime: toKstIso(nowcastBase.base_date, nowcastBase.base_time),
    timeZone: {
      id: 'Asia/Seoul',
    },
    weatherCondition: {
      iconBaseUri: createEmojiIconDataUri(presentation.symbol),
      description: {
        text: presentation.description,
        languageCode: 'ko',
      },
      type:
        precipitationType == null
          ? String(forecastGroup?.values.SKY ?? '')
          : String(precipitationType),
    },
    temperature: toTemperatureValue(temperature),
    feelsLikeTemperature: toTemperatureValue(temperature),
    precipitation: {
      probability: {
        percent: Math.round(forecastGroup?.values.POP ?? 0),
        type: 'RAIN',
      },
      qpf:
        nowcast.RN1 == null
          ? undefined
          : {
              quantity: nowcast.RN1,
              unit: 'MILLIMETER',
            },
    },
    wind: toWind(windSpeed, windDirection),
    isDaytime: currentHour >= 6 && currentHour < 19,
    relativeHumidity: humidity,
    location,
  };
}

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return sendJson(response, 405, { error: 'Method not allowed' });
  }

  try {
    const requestUrl = new URL(request.url, `http://${request.headers.host}`);
    const latitude = clampCoordinate(
      requestUrl.searchParams.get('latitude'),
      DEFAULT_LOCATION.latitude,
      32,
      39.5,
    );
    const longitude = clampCoordinate(
      requestUrl.searchParams.get('longitude'),
      DEFAULT_LOCATION.longitude,
      124,
      132,
    );
    const source = requestUrl.searchParams.get('source') === 'gps' ? 'gps' : 'fallback';
    const label = sanitizeText(
      requestUrl.searchParams.get('label'),
      source === 'gps' ? '현재 위치' : DEFAULT_LOCATION.label,
    );
    const coordsLabel = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
    const location = {
      label,
      latitude,
      longitude,
      source,
      coordsLabel,
      updatedAt: Date.now(),
    };

    if (requestUrl.searchParams.get('environmentOnly') === '1') {
      const environment = await fetchEnvironmentData(latitude, longitude, label);

      return sendJson(response, 200, {
        current: {
          environment: environment.current,
        },
        daily: environment.daily,
        hourly: environment.hourly,
        location,
        provider: 'kma',
        providerLabel: buildWeatherProviderLabel(environment),
        timeZoneId: 'Asia/Seoul',
      });
    }

    const authKey = process.env.KMA_API_KEY || process.env.KMA_AUTH_KEY;
    if (!authKey) {
      return sendJson(response, 500, { error: '기상청 API 키가 설정되지 않았습니다.' });
    }

    const grid = convertLatLonToKmaGrid(latitude, longitude);
    const nowcastBase = getUltraNowcastBaseTime();
    const villageBase = getVillageForecastBaseTime();
    const commonParams = {
      pageNo: 1,
      numOfRows: 1000,
      dataType: 'JSON',
      nx: grid.nx,
      ny: grid.ny,
    };

    const [nowcastItems, forecastItems, environment] = await Promise.all([
      fetchKma(
        'getUltraSrtNcst',
        {
          ...commonParams,
          ...nowcastBase,
        },
        authKey,
      ),
      fetchKma(
        'getVilageFcst',
        {
          ...commonParams,
          ...villageBase,
        },
        authKey,
      ),
      fetchEnvironmentData(latitude, longitude, label).catch((error) => {
        console.warn('Environment data failed', error);
        return {
          current: {},
          daily: [],
          hourly: [],
        };
      }),
    ]);

    const filteredNowcastItems = nowcastItems.filter((item) =>
      ULTRA_NCST_CATEGORIES.includes(item.category),
    );
    const filteredForecastItems = forecastItems.filter((item) =>
      VILLAGE_FORECAST_CATEGORIES.includes(item.category),
    );
    const nowcast = toCategoryMap(filteredNowcastItems, 'obsrValue');
    const forecastGroups = groupForecastItems(filteredForecastItems);
    const nowKstDate = getKstDate();
    const currentForecastGroup = pickForecastGroup(
      forecastGroups,
      formatKmaDate(nowKstDate),
      nowKstDate.getUTCHours(),
    );
    const currentConditions = buildCurrentConditions({
      forecastGroup: currentForecastGroup,
      location,
      nowcast,
      nowcastBase,
    });
    const hourly = mergeHourlyEnvironment(
      buildHourlyForecast(forecastGroups),
      environment.hourly,
      environment.current,
    );
    const daily = mergeDailySolar(buildDailyForecast(forecastGroups), environment.daily);

    return sendJson(response, 200, {
      current: {
        ...currentConditions,
        environment: environment.current,
      },
      daily,
      hourly,
      location,
      provider: 'kma',
      providerLabel: buildWeatherProviderLabel(environment),
      timeZoneId: 'Asia/Seoul',
    });
  } catch (error) {
    console.error('KMA weather failed', error);
    return sendJson(response, 500, {
      error: error.message || '기상청 날씨를 불러오지 못했습니다.',
    });
  }
}
