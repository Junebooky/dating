import { useEffect, useMemo, useState } from 'react';
import { CloudSun, Droplets, MapPin, Sparkles, Sun, Wind, X } from 'lucide-react';

import {
  buildWeatherIconUrl,
  formatCurrentDateTime,
  formatSunTime,
  formatTemperature,
  type WeatherSnapshot,
} from '../lib/weather';

interface WeatherPopupProps {
  errorMessage: string | null;
  isLoading: boolean;
  isOpen: boolean;
  locationLabel: string;
  onClose: () => void;
  weatherData: WeatherSnapshot | null;
}

function parseHourLabelTo24(timeLabel: string) {
  const match = timeLabel.match(/(오전|오후)\s+(\d+)시/);

  if (!match) {
    return null;
  }

  const [, meridiem, hourText] = match;
  const hour = Number(hourText);

  if (Number.isNaN(hour)) {
    return null;
  }

  if (meridiem === '오전') {
    return hour === 12 ? 0 : hour;
  }

  return hour === 12 ? 12 : hour + 12;
}

function getLocalDateKey(timestamp?: string, timeZoneId?: string) {
  if (!timestamp) {
    return null;
  }

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timeZoneId ?? 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(timestamp));
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  if (!year || !month || !day) {
    return null;
  }

  return `${year}-${month}-${day}`;
}

function getLocalHour(timestamp?: string, timeZoneId?: string) {
  if (!timestamp) {
    return null;
  }

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timeZoneId ?? 'Asia/Seoul',
    hour: '2-digit',
    hour12: false,
  }).formatToParts(new Date(timestamp));
  const hour = parts.find((part) => part.type === 'hour')?.value;

  return hour ? Number(hour) : null;
}

function buildChart(hourly: WeatherSnapshot['hourly']) {
  if (hourly.length === 0) {
    return {
      areaPoints: '',
      height: 128,
      linePoints: '',
      pointMarkers: [] as Array<{
        temperature: number;
        timeLabel: string;
        x: number;
        y: number;
      }>,
      width: 480,
    };
  }

  const width = Math.max(480, hourly.length * 56);
  const height = 128;
  const leftPadding = 24;
  const rightPadding = 24;
  const topPadding = 24;
  const bottomPadding = 34;
  const plotWidth = Math.max(width - leftPadding - rightPadding, 1);
  const minTemperature = Math.min(...hourly.map((item) => item.temperature));
  const maxTemperature = Math.max(...hourly.map((item) => item.temperature));
  const range = Math.max(maxTemperature - minTemperature, 1);

  const pointMarkers = hourly.map((item, index) => {
    const x =
      hourly.length === 1
        ? width / 2
        : leftPadding + (plotWidth / (hourly.length - 1)) * index;
    const y =
      topPadding +
      ((maxTemperature - item.temperature) / range) * (height - topPadding - bottomPadding);

    return {
      temperature: item.temperature,
      timeLabel: item.timeLabel,
      x,
      y,
    };
  });

  const baselineY = height - bottomPadding + 8;
  const linePoints = pointMarkers.map((point) => `${point.x},${point.y}`).join(' ');
  const areaPoints = [
    ...pointMarkers.map((point) => `${point.x},${point.y}`),
    `${pointMarkers[pointMarkers.length - 1].x},${baselineY}`,
    `${pointMarkers[0].x},${baselineY}`,
  ].join(' ');

  return {
    areaPoints,
    height,
    linePoints,
    pointMarkers,
    width,
  };
}

function formatHourlyEnvironmentValue(grade?: string) {
  return grade ?? '-';
}

function formatHourlyTemperature(value: number) {
  return value.toFixed(1);
}

function getEnvironmentGradeClass(grade?: string) {
  if (grade === '매우좋음') {
    return 'text-[#8FB9DD]';
  }
  if (grade === '좋음') {
    return 'text-[#9FBFA8]';
  }
  if (grade === '낮음') {
    return 'text-[#8FB9DD]';
  }
  if (grade === '보통') {
    return 'text-[#D6B56D]';
  }
  if (grade === '높음') {
    return 'text-[#D89A8F]';
  }
  if (grade === '매우높음') {
    return 'text-[#E89B9B]';
  }
  if (grade === '위험') {
    return 'text-[#F0A0A0]';
  }
  if (grade === '나쁨') {
    return 'text-[#D89A8F]';
  }
  if (grade === '매우나쁨') {
    return 'text-[#E89B9B]';
  }

  return 'text-gray-500';
}

export function GoogleWeatherPopup({
  errorMessage,
  isLoading,
  isOpen,
  locationLabel,
  onClose,
  weatherData,
}: WeatherPopupProps) {
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);

  const selectedDay = weatherData?.daily?.[selectedDayIndex] ?? weatherData?.daily?.[0] ?? null;
  const selectedHourly = useMemo(() => {
    if (!weatherData?.hourly || !selectedDay) {
      return [];
    }

    const hoursForDay = weatherData.hourly.filter((hour) => hour.dateKey === selectedDay.dateKey);
    const currentDateKey = getLocalDateKey(weatherData.current.currentTime, weatherData.timeZoneId);
    const currentHour = getLocalHour(weatherData.current.currentTime, weatherData.timeZoneId);

    if (selectedDay.dateKey !== currentDateKey || currentHour == null) {
      return hoursForDay;
    }

    const firstUpcomingIndex = hoursForDay.findIndex((hour) => {
      const hourValue = parseHourLabelTo24(hour.timeLabel);
      return hourValue != null && hourValue >= currentHour;
    });

    return firstUpcomingIndex >= 0 ? hoursForDay.slice(firstUpcomingIndex) : hoursForDay;
  }, [selectedDay, weatherData]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setSelectedDayIndex(0);
  }, [isOpen, weatherData?.daily?.[0]?.dateKey]);

  if (!isOpen) {
    return null;
  }

  const current = weatherData?.current;
  const currentTemperature = formatTemperature(current?.temperature);
  const currentConditionText = current?.weatherCondition?.description?.text ?? '날씨 정보 없음';
  const currentIconUrl = buildWeatherIconUrl(current?.weatherCondition);
  const currentDateTime = formatCurrentDateTime(current?.currentTime, weatherData?.timeZoneId);
  const chart = buildChart(selectedHourly);

  return (
    <div className="absolute inset-0 z-50 flex items-start justify-center bg-black/40 px-4 pb-4 pt-4 backdrop-blur-sm">
      <div className="relative max-h-[calc(100%-1rem)] w-full max-w-sm overflow-hidden rounded-[32px] bg-white shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-5 top-5 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/12 text-white transition hover:bg-white/20"
          aria-label="날씨 팝업 닫기"
        >
          <X size={20} />
        </button>

        <div className="max-h-[calc(100dvh-2rem)] overflow-y-auto bg-[#212121] p-6 text-white">
          <div className="mb-4 pr-12">
            <div className="inline-flex max-w-full items-start gap-1.5 rounded-full bg-white/8 px-3 py-1.5 text-[12px] font-semibold leading-4 text-gray-100">
              <MapPin size={13} className="mt-0.5 shrink-0 text-gray-300" />
              <span className="min-w-0 whitespace-normal break-keep">
                {locationLabel} 날씨
              </span>
            </div>

            <div className="mt-4 flex items-end gap-3">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-white/8">
                {currentIconUrl ? (
                  <img
                    src={currentIconUrl}
                    alt={currentConditionText}
                    className="h-12 w-12 object-contain"
                  />
                ) : (
                  <div className="text-xs text-gray-300">N/A</div>
                )}
              </div>
              <div>
                <div className="text-6xl font-light">
                  {weatherData ? currentTemperature : '--'}
                  <span className="align-top text-2xl">°C</span>
                </div>
              </div>
            </div>

            <div className="ml-auto mt-3 flex max-w-[78%] flex-wrap items-center justify-end gap-x-2 gap-y-1 text-right text-sm text-gray-400">
              <span>{currentDateTime}</span>
              <span aria-hidden="true">·</span>
              <span>{currentConditionText}</span>
            </div>
          </div>

          {isLoading && !weatherData ? (
            <div className="py-12 text-center text-sm text-gray-300">
              현재 위치 기준 날씨를 불러오는 중입니다.
            </div>
          ) : errorMessage ? (
            <div className="rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-200">
              {errorMessage}
            </div>
          ) : weatherData ? (
            <>
              <div className="scrollbar-hide mb-4 overflow-x-auto pb-2">
                <div className="relative" style={{ height: `${chart.height}px`, width: `${chart.width}px` }}>
                  <svg
                    className="h-full w-full"
                    preserveAspectRatio="none"
                    viewBox={`0 0 ${chart.width} ${chart.height}`}
                  >
                    <polygon fill="#665319" points={chart.areaPoints} />
                    <polyline
                      fill="none"
                      points={chart.linePoints}
                      stroke="#FFD700"
                      strokeWidth="2"
                    />
                    {chart.pointMarkers.map((point, index) => (
                      <g key={`${point.x}-${index}`}>
                        <circle cx={point.x} cy={point.y} r="3.5" fill="#FFD700" />
                        <text
                          x={point.x}
                          y={Math.max(point.y - 10, 14)}
                          fill="white"
                          fontSize="11"
                          fontWeight="bold"
                          textAnchor="middle"
                        >
                          {formatHourlyTemperature(point.temperature)}
                        </text>
                        <text
                          x={point.x}
                          y={chart.height - 8}
                          fill="#B8B8B8"
                          fontSize="10"
                          textAnchor="middle"
                        >
                          {point.timeLabel}
                        </text>
                      </g>
                    ))}
                  </svg>
                </div>
              </div>

              <div className="scrollbar-hide flex gap-3 overflow-x-auto pb-1">
                {selectedHourly.map((hour) => (
                  <div
                    key={`${hour.dateKey}-${hour.timeLabel}`}
                    className="min-w-[138px] rounded-2xl bg-white/5 px-3 py-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-[11px] font-medium text-gray-400">{hour.timeLabel}</div>
                        <div className="mt-1 text-lg font-semibold text-white">
                          {formatHourlyTemperature(hour.temperature)}°
                        </div>
                      </div>
                      {hour.iconUrl ? (
                        <img
                          src={hour.iconUrl}
                          alt={hour.description}
                          className="h-7 w-7 object-contain"
                        />
                      ) : (
                        <div className="text-[10px] text-gray-400">N/A</div>
                      )}
                    </div>
                    <div className="mt-2 text-[11px] text-gray-300">{hour.description}</div>
                    <div className="mt-3 space-y-1 text-[11px] text-gray-300">
                      <div className="flex items-center gap-1">
                        <Droplets size={12} className="text-sky-300" />
                        <span>강수 {hour.precipitationPercent}%</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Wind size={12} className="text-gray-300" />
                        <span>바람 {hour.windSpeed}km/h</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Sparkles size={12} className="text-stone-300" />
                        <span>
                          미세{' '}
                          <span className={getEnvironmentGradeClass(hour.pm10Grade)}>
                            {formatHourlyEnvironmentValue(hour.pm10Grade)}
                          </span>
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <CloudSun size={12} className="text-rose-200" />
                        <span>
                          초미세{' '}
                          <span className={getEnvironmentGradeClass(hour.pm25Grade)}>
                            {formatHourlyEnvironmentValue(hour.pm25Grade)}
                          </span>
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Sun size={12} className="text-yellow-200" />
                        <span>
                          자외선{' '}
                          <span className={getEnvironmentGradeClass(hour.uvGrade)}>
                            {formatHourlyEnvironmentValue(hour.uvGrade)}
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>
                ))}

                {selectedHourly.length === 0 ? (
                  <div className="rounded-2xl bg-white/5 px-4 py-5 text-sm text-gray-400">
                    선택한 날짜의 시간대 예보가 없습니다.
                  </div>
                ) : null}
              </div>
            </>
          ) : null}
        </div>

        <div className="scrollbar-hide overflow-x-auto border-t border-gray-700 bg-[#212121] px-4 pb-6">
          <div className="mt-4 flex gap-2 text-center">
            {(weatherData?.daily ?? []).map((day, index) => (
              <button
                type="button"
                key={`${day.dayLabel}-${index}`}
                onClick={() => setSelectedDayIndex(index)}
                className={`min-w-[84px] rounded-xl p-3 transition ${
                  selectedDayIndex === index
                    ? 'bg-[#303134] ring-1 ring-white/15'
                    : 'bg-transparent hover:bg-white/5'
                }`}
              >
                <span className="mb-2 block text-xs font-bold text-white">{day.dayLabel}</span>
                {day.iconUrl ? (
                  <img
                    src={day.iconUrl}
                    alt={day.description}
                    className="mx-auto mb-2 h-6 w-6 object-contain"
                  />
                ) : (
                  <div className="mb-2 text-[10px] text-gray-400">N/A</div>
                )}
                <span className="text-xs font-bold text-white">
                  {formatHourlyTemperature(day.maxTemperature)}°{' '}
                  <span className="font-normal text-gray-400">
                    {formatHourlyTemperature(day.minTemperature)}°
                  </span>
                </span>
                {day.sunsetTime ? (
                  <span className="mt-1 block text-[10px] text-gray-400">
                    일몰 {formatSunTime(day.sunsetTime)}
                  </span>
                ) : null}
              </button>
            ))}

            {!isLoading && !errorMessage && weatherData?.daily.length === 0 ? (
              <div className="py-4 text-sm text-gray-400">주간 예보가 없습니다.</div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
