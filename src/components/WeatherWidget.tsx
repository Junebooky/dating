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
    <div className="border-b border-[#f1e6d8] bg-[linear-gradient(180deg,#fffaf4_0%,#fff3e3_100%)] px-6 py-6">
      <div
        onClick={onOpen}
        className="cursor-pointer rounded-[28px] bg-white/80 p-5 shadow-[0_16px_40px_rgba(72,45,18,0.08)] transition hover:bg-white"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#ffc85c] shadow-[0_12px_28px_rgba(255,200,92,0.35)]">
              <CloudSun size={34} className="text-white" />
            </div>
            <div>
              <div className="flex items-baseline gap-1">
                <span className="text-5xl font-light tracking-[-0.06em] text-[#2f2417]">
                  {temperatureText}
                </span>
                <span className="text-2xl font-light text-[#c2a98b]">°C</span>
              </div>
              <div className="mt-1 flex items-center gap-1 text-sm font-medium text-[#6c5840]">
                <MapPin size={13} />
                <span>
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
            className="group relative rounded-full border border-[#f1e6d8] bg-[#fff9f1] p-2 text-[#9d7b52] transition hover:border-[#d8b68e] hover:bg-white"
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

        <div className="mt-5 flex items-center gap-3 text-[11px] font-medium text-[#7d6851]">
          <span className="flex items-center gap-1 rounded-full bg-[#fff4e6] px-2.5 py-1">
            <Droplets size={12} className="text-sky-500" />
            강수 {rainChance}
          </span>
          <span className="flex items-center gap-1 rounded-full bg-[#fff4e6] px-2.5 py-1">
            <CloudSun size={12} className="text-amber-500" />
            습도 {humidity}
          </span>
          <span className="flex items-center gap-1 rounded-full bg-[#fff4e6] px-2.5 py-1">
            <Wind size={12} className="text-slate-500" />
            바람 {wind}
          </span>
        </div>

        <div className="mt-4 flex items-center justify-between gap-4 text-xs text-[#8d7558]">
          <p>{locationHelperText}</p>
          <p className="shrink-0 text-right">{isLoading ? '날씨 업데이트 중' : updatedText}</p>
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
