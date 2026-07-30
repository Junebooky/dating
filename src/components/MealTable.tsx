import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  Pencil,
  Plus,
  Trash2,
  UtensilsCrossed,
} from 'lucide-react';

export type MealProfile = 'boyfriend' | 'girlfriend';

export interface MealEntry {
  caption: string;
  createdAt: string;
  date: string;
  id: number;
  publicUrl: string | null;
  storagePath: string | null;
  title: string;
  uploadedByProfile?: MealProfile;
  uploadedByUsername?: string;
}

interface MealTableProps {
  currentProfile?: MealProfile;
  entries: MealEntry[];
  onAdd: () => void;
  onDelete: (entry: MealEntry) => void;
  onEdit: (entry: MealEntry) => void;
  onPreview: (entry: MealEntry) => void;
}

const PROFILE_LABELS: Record<MealProfile, string> = {
  boyfriend: '태준씌',
  girlfriend: '영주씌',
};

function parseDate(dateKey: string) {
  return new Date(`${dateKey}T00:00:00`);
}

function formatDateBadge(dateKey: string) {
  const date = parseDate(dateKey);

  return {
    day: date.getDate(),
    month: `${date.getMonth() + 1}월`,
    year: date.getFullYear(),
  };
}

function formatEntryTime(createdAt: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(createdAt));
}

export function MealTable({
  currentProfile,
  entries,
  onAdd,
  onDelete,
  onEdit,
  onPreview,
}: MealTableProps) {
  const visibleEntries = useMemo(
    () =>
      [...entries].sort(
      (left, right) =>
        right.date.localeCompare(left.date) ||
        new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
      ),
    [entries],
  );
  const dates = useMemo(
    () => Array.from(new Set(visibleEntries.map((entry) => entry.date))).sort().reverse(),
    [visibleEntries],
  );
  const dateTitles = useMemo(
    () => new Map(visibleEntries.map((entry) => [entry.date, entry.title])),
    [visibleEntries],
  );
  const years = useMemo(() => {
    const datesByYear = new Map<number, string[]>();

    dates.forEach((dateKey) => {
      const year = parseDate(dateKey).getFullYear();
      const yearDates = datesByYear.get(year) ?? [];
      yearDates.push(dateKey);
      datesByYear.set(year, yearDates);
    });

    return Array.from(datesByYear, ([year, yearDates]) => ({
      dates: yearDates,
      year,
    })).sort((left, right) => right.year - left.year);
  }, [dates]);
  const [selectedDate, setSelectedDate] = useState(dates[0] ?? '');
  const [entryIndex, setEntryIndex] = useState(0);
  const [isAllDatesOpen, setIsAllDatesOpen] = useState(false);
  const dateRailRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (dates.length === 0) {
      if (selectedDate) {
        setSelectedDate('');
      }
      return;
    }

    if (!dates.includes(selectedDate)) {
      setSelectedDate(dates[0]);
    }
  }, [dates, selectedDate]);

  const selectedEntries = useMemo(
    () => visibleEntries.filter((entry) => entry.date === selectedDate),
    [selectedDate, visibleEntries],
  );
  const safeEntryIndex = Math.min(entryIndex, Math.max(selectedEntries.length - 1, 0));
  const selectedEntry = selectedEntries[safeEntryIndex];
  const dateBadge = selectedEntry ? formatDateBadge(selectedEntry.date) : null;
  const canManage =
    Boolean(selectedEntry) &&
    Boolean(currentProfile) &&
    selectedEntry?.uploadedByProfile === currentProfile;

  function selectDate(dateKey: string) {
    setSelectedDate(dateKey);
    setEntryIndex(0);

    requestAnimationFrame(() => {
      const rail = dateRailRef.current;
      const dateButton = rail?.querySelector<HTMLElement>(`[data-meal-date="${dateKey}"]`);

      if (!rail || !dateButton) {
        return;
      }

      rail.scrollTo({
        behavior: 'smooth',
        left: dateButton.offsetLeft - (rail.clientWidth - dateButton.offsetWidth) / 2,
      });
    });
  }

  function selectDateFromAllView(dateKey: string) {
    selectDate(dateKey);
    setIsAllDatesOpen(false);
  }

  function showPreviousEntry() {
    setEntryIndex((currentIndex) =>
      currentIndex === 0 ? selectedEntries.length - 1 : currentIndex - 1,
    );
  }

  function showNextEntry() {
    setEntryIndex((currentIndex) => (currentIndex + 1) % selectedEntries.length);
  }

  return (
    <section className="px-4 pb-10 pt-6">
      <div className="stacked-card stacked-card--pink rounded-[28px]">
        <div className="stacked-card__body flex h-[620px] flex-col px-4 pb-5 pt-5">
          <div className="flex shrink-0 items-end justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#9d7b52]">
                Our Meal Notes
              </p>
              <h2 className="mt-1 text-2xl font-black text-[#2f2417]">식사테이블</h2>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={() => setIsAllDatesOpen((isOpen) => !isOpen)}
                className={`flex items-center gap-1 rounded-full px-2.5 py-2 text-[11px] font-black transition ${
                  isAllDatesOpen
                    ? 'bg-[#FBEFEF] text-[#D48787]'
                    : 'bg-[#F8F5EF] text-[#918679] hover:bg-[#f2ede5]'
                }`}
                aria-pressed={isAllDatesOpen}
              >
                <CalendarDays size={13} />
                {isAllDatesOpen ? '한 장 보기' : '전체 보기'}
              </button>
              <button
                type="button"
                onClick={onAdd}
                className="flex items-center gap-1 rounded-full bg-[#FBEFEF] px-2.5 py-2 text-[11px] font-black text-[#D48787] transition hover:bg-[#f8e5e5]"
              >
                <Plus size={13} strokeWidth={2.8} />
                기록
              </button>
            </div>
          </div>

          <div className="relative mt-4 min-h-0 flex-1 overflow-hidden">
            {isAllDatesOpen ? (
              <div key="meal-overview" className="meal-view-unfold flex h-full min-h-0 flex-col">
                <div className="flex shrink-0 items-end justify-between border-b border-[#f1e6d8] pb-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#9d7b52]">
                      Meal Archive
                    </p>
                    <h3 className="mt-1 text-lg font-black text-[#2f2417]">전체 날짜</h3>
                  </div>
                  <span className="text-xs font-black text-[#D48787]">{dates.length}일</span>
                </div>

                <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto overscroll-contain pt-4">
                  <div className="space-y-5">
                    {years.map((yearGroup) => (
                      <section key={yearGroup.year}>
                        <div className="mb-2.5 flex items-center justify-between">
                          <h4 className="text-base font-black text-[#2f2417]">
                            {yearGroup.year}년
                          </h4>
                          <span className="text-[10px] font-bold text-[#B8AEA5]">
                            {yearGroup.dates.length}개
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          {yearGroup.dates.map((dateKey) => {
                            const badge = formatDateBadge(dateKey);
                            const isSelected = dateKey === selectedDate;

                            return (
                              <button
                                key={dateKey}
                                type="button"
                                onClick={() => selectDateFromAllView(dateKey)}
                                className={`flex h-[76px] min-w-0 flex-col items-center justify-center rounded-[14px] px-2 transition-all duration-200 ease-out hover:-translate-y-1 hover:shadow-[0_8px_18px_rgba(47,36,23,0.09)] focus-visible:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E8B6B6]/60 ${
                                  isSelected
                                    ? 'bg-[#FBEFEF] text-[#D48787] hover:bg-[#F9E7E7]'
                                    : 'bg-[#F8F5EF] text-[#918679] hover:bg-[#F3EEE7] hover:text-[#6F6458]'
                                }`}
                                aria-pressed={isSelected}
                              >
                                <span className="whitespace-nowrap text-sm font-black">
                                  {badge.month} {badge.day}일
                                </span>
                                <span className="mt-2 block w-full truncate text-[10px] font-black">
                                  {dateTitles.get(dateKey)}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </section>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div key="meal-detail" className="meal-view-unfold flex h-full min-h-0 flex-col">
                <div
                  ref={dateRailRef}
                  className="scrollbar-hide -mx-1 flex shrink-0 snap-x gap-2 overflow-x-auto px-1 pb-2"
                  aria-label="식사 기록 날짜"
                >
                  {dates.map((dateKey) => {
                    const badge = formatDateBadge(dateKey);
                    const isSelected = dateKey === selectedDate;

                    return (
                      <button
                        key={dateKey}
                        type="button"
                        onClick={() => selectDate(dateKey)}
                        data-meal-date={dateKey}
                        className={`flex h-[92px] w-[82px] shrink-0 snap-start flex-col items-center justify-center rounded-[16px] px-2 transition-all duration-300 ${
                          isSelected
                            ? 'translate-y-0 bg-[#FBEFEF] text-[#D48787] shadow-[0_8px_18px_rgba(212,135,135,0.15)]'
                            : 'translate-y-0.5 bg-[#F8F5EF] text-[#9A8F82]'
                        }`}
                        aria-pressed={isSelected}
                      >
                        <span className="text-[10px] font-black">{badge.month}</span>
                        <span className="my-0.5 text-xl font-black leading-none">{badge.day}</span>
                        <span className="text-[9px] font-bold opacity-65">{badge.year}</span>
                        <span className="mt-1.5 block w-full truncate text-[10px] font-black">
                          {dateTitles.get(dateKey)}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {selectedEntry && dateBadge ? (
                  <div
                    key={`${selectedEntry.date}-${selectedEntry.id}`}
                    className="meal-card-reveal relative mt-4 flex min-h-0 flex-1 flex-col"
                  >
                    {selectedEntry.publicUrl ? (
                      <button
                        type="button"
                        onClick={() => onPreview(selectedEntry)}
                        className="block h-[200px] w-full shrink-0 overflow-hidden rounded-[22px] bg-[#F8F5EF] text-left"
                        aria-label={`${dateBadge.month} ${dateBadge.day}일 음식 사진 크게 보기`}
                      >
                        <img
                          src={selectedEntry.publicUrl}
                          alt={`${dateBadge.month} ${dateBadge.day}일 식사`}
                          className="h-full w-full object-cover"
                          loading="eager"
                        />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onEdit(selectedEntry)}
                        disabled={!canManage}
                        className="flex h-[200px] w-full shrink-0 flex-col items-center justify-center overflow-hidden rounded-[22px] bg-[#F8F5EF] text-[#B8AEA5] transition hover:bg-[#F3EEE7] hover:text-[#D48787] disabled:cursor-default disabled:hover:bg-[#F8F5EF] disabled:hover:text-[#B8AEA5]"
                        aria-label={
                          canManage
                            ? `${dateBadge.month} ${dateBadge.day}일 식사 사진 추가`
                            : `${dateBadge.month} ${dateBadge.day}일 식사 사진 없음`
                        }
                      >
                        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-[#D48787] shadow-sm">
                          <ImagePlus size={20} />
                        </span>
                        <span className="mt-3 text-xs font-black">
                          {canManage ? '사진 추가' : '사진 없음'}
                        </span>
                      </button>
                    )}

                  <div className="absolute -top-3 left-4 flex h-[72px] w-[58px] flex-col items-center justify-center rounded-[15px] bg-white text-[#2f2417] shadow-[0_10px_24px_rgba(47,36,23,0.17)]">
                    <span className="text-[10px] font-black text-[#9d7b52]">
                      {dateBadge.month}
                    </span>
                    <span className="text-2xl font-black leading-none">{dateBadge.day}</span>
                    <span className="mt-1 text-[9px] font-bold text-[#b3a696]">
                      {dateBadge.year}
                    </span>
                  </div>

                  <div className="flex min-h-0 flex-1 flex-col px-1 pb-1 pt-3.5">
                    <div className="flex shrink-0 items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-bold text-[#9A8F82]">
                          <span className="flex items-center gap-1 text-[#D48787]">
                            <UtensilsCrossed size={12} />
                            {selectedEntry.uploadedByProfile
                              ? `${PROFILE_LABELS[selectedEntry.uploadedByProfile]}가 남김`
                              : '함께 남긴 기록'}
                          </span>
                          <span>{formatEntryTime(selectedEntry.createdAt)}</span>
                        </div>
                      </div>

                      {canManage ? (
                        <button
                          type="button"
                          onClick={() => onDelete(selectedEntry)}
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#C9C1B8] transition hover:bg-[#F8F5EF] hover:text-[#7F766E]"
                          aria-label="식사 기록 삭제"
                          title="삭제"
                        >
                          <Trash2 size={15} />
                        </button>
                      ) : null}
                    </div>

                    <div className="mt-2.5 flex shrink-0 items-center justify-between gap-3">
                      <h3 className="min-w-0 truncate text-base font-black text-[#2f2417]">
                        {selectedEntry.title}
                      </h3>
                      {canManage ? (
                        <button
                          type="button"
                          onClick={() => onEdit(selectedEntry)}
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#B8AEA5] transition hover:bg-[#F8F5EF] hover:text-[#7F766E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D8D0C7]"
                          aria-label={`${selectedEntry.title} 사진, 메뉴 이름, 방명록 수정`}
                          title="수정"
                        >
                          <Pencil size={15} />
                        </button>
                      ) : null}
                    </div>
                    <div className="scrollbar-hide mt-1.5 min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
                      <p className="whitespace-pre-wrap break-words text-sm font-medium leading-6 text-[#5f5142]">
                        {selectedEntry.caption}
                      </p>
                    </div>
                  </div>
                  </div>
                ) : (
                  <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#F8F5EF] text-[#D48787]">
                      <UtensilsCrossed size={22} />
                    </div>
                    <h3 className="mt-4 text-base font-black text-[#2f2417]">
                      아직 식사 기록이 없어요
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-[#918679]">
                      함께 먹은 첫 메뉴를 기록해 보세요.
                    </p>
                  </div>
                )}

                <div className="mt-2 flex h-8 shrink-0 items-center justify-between">
                  {selectedEntries.length > 1 ? (
                    <>
                      <button
                        type="button"
                        onClick={showPreviousEntry}
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F8F5EF] text-[#918679]"
                        aria-label="이전 식사 기록"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <div className="flex items-center gap-1.5" aria-label="식사 기록 순서">
                        {selectedEntries.map((entry, index) => (
                          <button
                            key={entry.id}
                            type="button"
                            onClick={() => setEntryIndex(index)}
                            className={`h-1.5 rounded-full transition-all ${
                              index === safeEntryIndex
                                ? 'w-5 bg-[#D48787]'
                                : 'w-1.5 bg-[#ded6c9]'
                            }`}
                            aria-label={`${index + 1}번째 식사 기록`}
                            aria-current={index === safeEntryIndex}
                          />
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={showNextEntry}
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F8F5EF] text-[#918679]"
                        aria-label="다음 식사 기록"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
