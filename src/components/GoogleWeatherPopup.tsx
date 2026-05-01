import { useEffect, useMemo, useState } from 'react';
import { Droplets, Wind, X } from 'lucide-react';

import {
  buildWeatherIconUrl,
  formatCurrentDateTime,
  formatWindSpeed,
  getPrecipitationPercent,
  roundTemperature,
  type WeatherSnapshot,
} from '../lib/weather';

interface WeatherPopupProps {
  coordsLabel?: string;
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

export function GoogleWeatherPopup({
  coordsLabel,
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
  const currentTemperature = roundTemperature(current?.temperature);
  const currentConditionText = current?.weatherCondition?.description?.text ?? '날씨 정보 없음';
  const currentIconUrl = buildWeatherIconUrl(current?.weatherCondition);
  const currentDateTime = formatCurrentDateTime(current?.currentTime, weatherData?.timeZoneId);
  const precipitationPercent = getPrecipitationPercent(current?.precipitation);
  const humidityText = current?.relativeHumidity == null ? '-' : `${current.relativeHumidity}%`;
  const windSpeed = formatWindSpeed(current?.wind);
  const chart = buildChart(selectedHourly);

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-sm overflow-hidden rounded-[32px] bg-white shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-10 rounded-full bg-gray-100 p-2 hover:bg-gray-200"
          aria-label="날씨 팝업 닫기"
        >
          <X size={20} />
        </button>

        <div className="bg-[#212121] p-6 text-white">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/8">
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
            <div className="text-right">
              <div className="text-xl font-bold">{locationLabel} 날씨</div>
              <div className="text-sm text-gray-400">{currentDateTime}</div>
              <div className="text-sm text-gray-400">{currentConditionText}</div>
              {coordsLabel ? <div className="text-xs text-gray-500">{coordsLabel}</div> : null}
            </div>
          </div>

          {isLoading && !weatherData ? (
            <div className="py-12 text-center text-sm text-gray-300">
              서울 기준 날씨를 불러오는 중입니다.
            </div>
          ) : errorMessage ? (
            <div className="rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-200">
              {errorMessage}
            </div>
          ) : weatherData ? (
            <>
              <div className="mb-6 grid grid-cols-3 gap-2 text-xs text-gray-200">
                <div className="rounded-2xl bg-white/6 px-3 py-2">
                  <div className="text-[11px] text-gray-400">현재 강수확률</div>
                  <div className="mt-1 font-semibold text-white">{precipitationPercent}%</div>
                </div>
                <div className="rounded-2xl bg-white/6 px-3 py-2">
                  <div className="text-[11px] text-gray-400">현재 습도</div>
                  <div className="mt-1 font-semibold text-white">{humidityText}</div>
                </div>
                <div className="rounded-2xl bg-white/6 px-3 py-2">
                  <div className="text-[11px] text-gray-400">현재 바람</div>
                  <div className="mt-1 font-semibold text-white">{windSpeed}</div>
                </div>
              </div>

              <div className="mb-4">
                <div className="text-sm font-semibold text-white">
                  {selectedDay ? `${selectedDay.fullLabel} 시간대별 예보` : '시간대별 예보'}
                </div>
                <div className="mt-1 text-[11px] text-gray-400">
                  오늘은 현재 시각 이후 시간대부터 보여주고, 다른 날짜는 하루 전체 시간대를 보여줍니다.
                </div>
              </div>

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
                          {point.temperature}
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
                    className="min-w-[112px] rounded-2xl bg-white/5 px-3 py-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-[11px] font-medium text-gray-400">{hour.timeLabel}</div>
                        <div className="mt-1 text-lg font-semibold text-white">
                          {hour.temperature}°
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
                  {day.maxTemperature}°{' '}
                  <span className="font-normal text-gray-400">{day.minTemperature}°</span>
                </span>
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
