import { CloudSun, Droplets, MapPin, RefreshCw, Wind } from 'lucide-react';

interface WeatherWidgetProps {
  condition: string;
  errorMessage: string | null;
  humidity: string;
  isLoading: boolean;
  isRefreshingLocation: boolean;
  locationHelperText: string;
  locationLabel: string;
  rainChance: string;
  temperatureText: string;
  updatedText: string;
  wind: string;
  onOpen: () => void;
  onRefreshLocation: () => void;
}

export function WeatherWidget({
  condition,
  errorMessage,
  humidity,
  isLoading,
  isRefreshingLocation,
  locationHelperText,
  locationLabel,
  rainChance,
  temperatureText,
  updatedText,
  wind,
  onOpen,
  onRefreshLocation,
}: WeatherWidgetProps) {
  return (
    <div className="border-b border-[#f1e6d8] bg-[#fffaf4] px-4 py-3">
      <div
        onClick={onOpen}
        className="cursor-pointer rounded-[22px] bg-white/80 p-3 shadow-[0_10px_28px_rgba(72,45,18,0.06)] transition hover:bg-white"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#F8DFAE] text-white">
              <CloudSun size={24} />
            </div>
            <div className="min-w-0">
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-light tracking-[-0.04em] text-[#2f2417]">
                  {temperatureText}
                </span>
                <span className="text-lg font-light text-[#c2a98b]">°C</span>
              </div>
              <div className="mt-0.5 flex items-center gap-1 truncate text-xs font-medium text-[#6c5840]">
                <MapPin size={12} />
                <span className="truncate">
                  {locationLabel} · {condition}
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onRefreshLocation();
            }}
            title="서울 기준 날씨 다시 불러오기"
            className="group relative rounded-full bg-[#F8F5EF] p-2 text-[#9d7b52] transition hover:bg-white"
            aria-label="서울 기준 날씨 다시 불러오기"
          >
            <RefreshCw
              size={17}
              className={isRefreshingLocation ? 'animate-spin' : undefined}
            />
            <span className="pointer-events-none absolute right-0 top-full z-10 mt-2 hidden w-44 rounded-xl bg-[#2f2417] px-3 py-2 text-left text-[11px] font-medium leading-4 text-white shadow-lg group-hover:block">
              서울 기준 날씨를 다시 불러옵니다.
            </span>
          </button>
        </div>

        <div className="mt-3 flex items-center gap-2 overflow-x-auto text-[10px] font-medium text-[#7d6851]">
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-[#F8F5EF] px-2 py-1">
            <Droplets size={11} className="text-[#7DA8D8]" />
            강수 {rainChance}
          </span>
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-[#F8F5EF] px-2 py-1">
            <CloudSun size={11} className="text-[#E89B9B]" />
            습도 {humidity}
          </span>
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-[#F8F5EF] px-2 py-1">
            <Wind size={11} className="text-[#A594F9]" />
            바람 {wind}
          </span>
        </div>

        <div className="mt-2 flex items-center justify-between gap-3 text-[10px] text-[#8d7558]">
          <p className="truncate">{locationHelperText}</p>
          <p className="shrink-0 text-right">{isLoading ? '업데이트 중' : updatedText}</p>
        </div>

        {errorMessage ? (
          <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
            {errorMessage}
          </div>
        ) : null}
      </div>
    </div>
  );
}
