import { type FormEvent, useEffect, useMemo, useState } from 'react';
import {
  Bell,
  Calendar as CalendarIcon,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Heart,
  LockKeyhole,
  LogOut,
  Pencil,
  Plus,
  Settings,
  Thermometer,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';

import { GoogleWeatherPopup } from './components/GoogleWeatherPopup';
import { WeatherWidget } from './components/WeatherWidget';
import {
  getInitialPushNotificationStatus,
  getPushNotificationStatusText,
  notifyPushUpdate,
  registerPushSubscription,
  type PushNotificationStatus,
} from './lib/pushNotifications';
import { isSupabaseConfigured, supabase } from './lib/supabase';
import {
  DEFAULT_LOCATION,
  fetchWeatherSnapshot,
  formatCurrentDateTime,
  formatWindSpeed,
  getPrecipitationPercent,
  roundTemperature,
  type WeatherLocation,
  type WeatherSnapshot,
} from './lib/weather';

type Tab = 'calendar' | 'manner' | 'bucket';
type BucketStatus = 'pending' | 'ready' | 'completed';
type BucketFilter = 'all' | BucketStatus;
type AccountProfile = 'boyfriend' | 'girlfriend';
type MannerRating = 1 | 2 | 3 | 4 | 5;
type MannerReviewStatus = 'open' | 'requested' | 'improved';

interface CalendarEvent {
  authorProfile?: AccountProfile;
  authorUsername?: string;
  date: string;
  endDate: string;
  id: number;
  importance: 1 | 2 | 3;
  memo: string;
  participantProfiles?: AccountProfile[];
  time: string;
  title: string;
}

interface BucketItem {
  id: number;
  status: BucketStatus;
  text: string;
}

interface MannerReview {
  authorProfile: AccountProfile;
  createdAt: string;
  id: number;
  improvementConfirmedAt?: string;
  improvementRequestedAt?: string;
  improvements: string;
  rating: MannerRating;
  status: MannerReviewStatus;
  strengths: string;
  targetProfile: AccountProfile;
}

interface Account {
  email: string;
  emailAliases?: string[];
  profile: AccountProfile;
  username: string;
}

interface Session {
  loggedInAt: string;
  username: string;
}

interface CalendarEventRow {
  author_profile?: string | null;
  author_username?: string | null;
  date?: string | null;
  end_date?: string | null;
  id?: number | null;
  importance?: number | null;
  memo?: string | null;
  participant_profiles?: string[] | null;
  time?: string | null;
  title?: string | null;
}

interface BucketItemRow {
  id?: number | null;
  status?: string | null;
  text?: string | null;
}

interface MannerReviewRow {
  author_profile?: string | null;
  created_at?: string | null;
  id?: number | null;
  improvement_confirmed_at?: string | null;
  improvement_requested_at?: string | null;
  improvements?: string | null;
  rating?: number | null;
  status?: string | null;
  strengths?: string | null;
  target_profile?: string | null;
}

interface EventDraft {
  endDate: string;
  importance: 1 | 2 | 3;
  memo: string;
  participantProfiles: AccountProfile[];
  time: string;
  title: string;
}

interface BucketDraft {
  status: BucketStatus;
  text: string;
}

interface MannerReviewDraft {
  improvements: string;
  rating: MannerRating;
  strengths: string;
}

const LOCATION_STORAGE_KEY = 'dating:location';
const MANNER_BASE_TEMPERATURE = 36.5;
const MANNER_RATING_STEP = 0.1;
const MANNER_MIN_TEMPERATURE = 30;
const MANNER_MAX_TEMPERATURE = 45;
const LOVE_START_DATE = new Date(2026, 1, 14);
const LOVE_GOAL_DAYS = 1000;
const LOVE_MILESTONE_DAYS = Array.from({ length: 10 }, (_, index) => (index + 1) * 100);
const CALENDAR_CELL_TITLE_MAX_LENGTH = 18;
const EVENT_MEMO_META_PREFIX = '__dear_days_event_meta__';

const IMPORTANCE_COLORS: Record<
  CalendarEvent['importance'],
  { bg: string; label: string; text: string }
> = {
  1: { bg: '#FBEFEF', text: '#D48787', label: '매우 중요' },
  2: { bg: '#F8F5EF', text: '#9A8F82', label: '중요' },
  3: { bg: '#EEF4FB', text: '#6F99C7', label: '보통' },
};

const PROFILE_META: Record<
  AccountProfile,
  { displayName: string; emoji: string; label: string }
> = {
  boyfriend: { emoji: '🧑🏽', label: '남자친구', displayName: '태준씌' },
  girlfriend: { emoji: '👱🏻‍♀️', label: '여자친구', displayName: '영주씌' },
};

const CALENDAR_EVENT_TONES: Record<
  AccountProfile | 'shared',
  { bg: string; label: string; text: string }
> = {
  boyfriend: { bg: '#7DA8D8', label: '태준씌', text: '#ffffff' },
  girlfriend: { bg: '#E89B9B', label: '영주씌', text: '#ffffff' },
  shared: { bg: '#A594F9', label: '공통 태그', text: '#ffffff' },
};

const BUCKET_STATUS_TONES: Record<
  BucketStatus,
  { bg: string; label: string; text: string }
> = {
  pending: { bg: '#F4F1EC', label: '미완료', text: '#918679' },
  ready: { bg: '#EEF4FB', label: '준비중', text: '#6F99C7' },
  completed: { bg: '#FBEFEF', label: '완료', text: '#D48787' },
};

const BUCKET_FILTER_LABELS: Record<BucketFilter, string> = {
  all: '전체',
  pending: '미완료',
  ready: '준비중',
  completed: '완료',
};

const MANNER_STATUS_LABELS: Record<MannerReviewStatus, string> = {
  open: '기록 완료',
  requested: '기록 완료',
  improved: '기록 완료',
};

const DEFAULT_ACCOUNTS: Account[] = [
  {
    username: 'yeongju0214',
    email: 'yeongju0214@couple.local',
    emailAliases: ['yeongjoo0214@couple.local'],
    profile: 'girlfriend',
  },
  {
    username: 'taejun0214',
    email: 'taejun0214@couple.local',
    profile: 'boyfriend',
  },
];

const EMPTY_EVENT_DRAFT: EventDraft = {
  title: '',
  time: '12:00',
  endDate: '',
  importance: 3,
  memo: '',
  participantProfiles: [],
};

const EMPTY_BUCKET_DRAFT: BucketDraft = {
  text: '',
  status: 'pending',
};

const EMPTY_MANNER_REVIEW_DRAFT: MannerReviewDraft = {
  rating: 4,
  strengths: '',
  improvements: '',
};

function writeStorage<T>(key: string, value: T) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(value));
}

function formatYMD(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}

function findAccountByUsername(accounts: Account[], username?: string | null) {
  if (!username) {
    return undefined;
  }

  return accounts.find((account) => account.username === username);
}

function findAccountByEmail(accounts: Account[], email?: string | null) {
  if (!email) {
    return undefined;
  }

  const normalizedEmail = email.toLowerCase();

  return accounts.find((account) =>
    [account.email, ...(account.emailAliases ?? [])].some(
      (accountEmail) => accountEmail.toLowerCase() === normalizedEmail,
    ),
  );
}

function isAccountProfile(value: unknown): value is AccountProfile {
  return value === 'boyfriend' || value === 'girlfriend';
}

function isMannerRating(value: unknown): value is MannerRating {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5;
}

function isMannerReviewStatus(value: unknown): value is MannerReviewStatus {
  return value === 'open' || value === 'requested' || value === 'improved';
}

function getPartnerProfile(profile: AccountProfile): AccountProfile {
  return profile === 'boyfriend' ? 'girlfriend' : 'boyfriend';
}

function getEventParticipantProfiles(event: CalendarEvent) {
  if (event.participantProfiles && event.participantProfiles.length > 0) {
    return event.participantProfiles;
  }

  return event.authorProfile ? [event.authorProfile] : [];
}

function normalizeEventEndDate(startDate: string, endDate?: string | null) {
  return typeof endDate === 'string' && endDate >= startDate ? endDate : startDate;
}

function isDateInEventRange(event: CalendarEvent, dateKey: string) {
  const endDate = normalizeEventEndDate(event.date, event.endDate);
  return event.date <= dateKey && dateKey <= endDate;
}

function doesEventIntersectDateRange(event: CalendarEvent, rangeStart: string, rangeEnd: string) {
  const endDate = normalizeEventEndDate(event.date, event.endDate);
  return event.date <= rangeEnd && endDate >= rangeStart;
}

function getCalendarRangeSegment(event: CalendarEvent, dateKey: string) {
  const endDate = normalizeEventEndDate(event.date, event.endDate);

  if (event.date === endDate) {
    return 'single';
  }

  if (dateKey === event.date) {
    return 'start';
  }

  if (dateKey === endDate) {
    return 'end';
  }

  return 'middle';
}

function getCalendarEventTone(event: CalendarEvent) {
  const participants = getEventParticipantProfiles(event);

  if (participants.includes('boyfriend') && participants.includes('girlfriend')) {
    return CALENDAR_EVENT_TONES.shared;
  }

  if (participants.includes('boyfriend')) {
    return CALENDAR_EVENT_TONES.boyfriend;
  }

  if (participants.includes('girlfriend')) {
    return CALENDAR_EVENT_TONES.girlfriend;
  }

  return event.authorProfile
    ? CALENDAR_EVENT_TONES[event.authorProfile]
    : CALENDAR_EVENT_TONES.shared;
}

function truncateMiddle(value: string, maxLength = CALENDAR_CELL_TITLE_MAX_LENGTH) {
  const text = value.trim();

  if (text.length <= maxLength) {
    return text;
  }

  const visibleLength = Math.max(3, maxLength - 1);
  const frontLength = Math.ceil(visibleLength * 0.62);
  const backLength = visibleLength - frontLength;

  return `${text.slice(0, frontLength)}…${text.slice(text.length - backLength)}`;
}

function decodeEventMemo(rawMemo?: string | null) {
  const memo = typeof rawMemo === 'string' ? rawMemo : '';

  if (!memo.startsWith(EVENT_MEMO_META_PREFIX)) {
    return { memo };
  }

  const lineBreakIndex = memo.indexOf('\n');
  const metaLine = lineBreakIndex >= 0 ? memo.slice(0, lineBreakIndex) : memo;
  const visibleMemo = lineBreakIndex >= 0 ? memo.slice(lineBreakIndex + 1) : '';

  try {
    const parsed = JSON.parse(metaLine.slice(EVENT_MEMO_META_PREFIX.length));
    return {
      endDate: typeof parsed.endDate === 'string' ? parsed.endDate : undefined,
      memo: visibleMemo,
    };
  } catch {
    return { memo };
  }
}

function encodeEventMemo(event: CalendarEvent) {
  const endDate = normalizeEventEndDate(event.date, event.endDate);

  if (endDate === event.date) {
    return event.memo;
  }

  return `${EVENT_MEMO_META_PREFIX}${JSON.stringify({ endDate })}\n${event.memo}`;
}

function isMissingEndDateColumnError(error: { message?: string } | null) {
  if (!error?.message) {
    return false;
  }

  return error.message.includes('end_date') && error.message.includes('column');
}

function buildDefaultEvents(accounts: Account[]): CalendarEvent[] {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const girlfriendAccount = accounts.find((account) => account.profile === 'girlfriend');
  const boyfriendAccount = accounts.find((account) => account.profile === 'boyfriend');

  return [
    {
      id: 1,
      date: formatYMD(new Date(year, month, Math.min(today.getDate() + 1, 28))),
      endDate: formatYMD(new Date(year, month, Math.min(today.getDate() + 1, 28))),
      time: '18:30',
      title: '저녁 데이트',
      importance: 2,
      memo: '분위기 좋은 식당 예약 확인',
      authorUsername: boyfriendAccount?.username,
      authorProfile: boyfriendAccount?.profile,
      participantProfiles: boyfriendAccount?.profile ? [boyfriendAccount.profile] : [],
    },
    {
      id: 2,
      date: formatYMD(new Date(year, month, Math.min(today.getDate() + 4, 28))),
      endDate: formatYMD(new Date(year, month, Math.min(today.getDate() + 4, 28))),
      time: '20:00',
      title: '영화 보기',
      importance: 3,
      memo: '팝콘 세트 미리 주문하기',
      authorUsername: girlfriendAccount?.username,
      authorProfile: girlfriendAccount?.profile,
      participantProfiles: girlfriendAccount?.profile ? [girlfriendAccount.profile] : [],
    },
    {
      id: 3,
      date: formatYMD(new Date(year, month, Math.min(today.getDate() + 7, 28))),
      endDate: formatYMD(new Date(year, month, Math.min(today.getDate() + 9, 28))),
      time: '11:00',
      title: '브런치 & 산책',
      importance: 1,
      memo: '벚꽃 코스 체크',
      authorUsername: boyfriendAccount?.username,
      authorProfile: boyfriendAccount?.profile,
      participantProfiles: [boyfriendAccount?.profile, girlfriendAccount?.profile].filter(
        (profile): profile is AccountProfile => Boolean(profile),
      ),
    },
  ];
}

function buildDefaultBucketList(): BucketItem[] {
  return [
    { id: 1, text: '제주도 한 달 살기', status: 'ready' },
    { id: 2, text: '커플 링 만들기', status: 'completed' },
    { id: 3, text: '번지점프 도전하기', status: 'pending' },
    { id: 4, text: '유럽 배낭 여행 가기', status: 'pending' },
    { id: 5, text: '심야 영화 5번 연속 보기', status: 'completed' },
    { id: 6, text: '커플 신발 맞추기', status: 'ready' },
  ];
}

function normalizeCalendarEventRow(row: CalendarEventRow, index: number): CalendarEvent {
  const authorProfile = isAccountProfile(row.author_profile) ? row.author_profile : undefined;
  const participantProfiles = Array.isArray(row.participant_profiles)
    ? row.participant_profiles.filter(isAccountProfile)
    : authorProfile
      ? [authorProfile]
      : [];
  const date = typeof row.date === 'string' ? row.date : formatYMD(new Date());
  const decodedMemo = decodeEventMemo(row.memo);

  return {
    id: typeof row.id === 'number' ? row.id : index + 1,
    date,
    endDate: normalizeEventEndDate(
      date,
      typeof row.end_date === 'string' ? row.end_date : decodedMemo.endDate,
    ),
    time: typeof row.time === 'string' ? row.time : '12:00',
    title: typeof row.title === 'string' ? row.title : '제목 없음',
    importance:
      row.importance === 1 || row.importance === 2 || row.importance === 3
        ? row.importance
        : 3,
    memo: decodedMemo.memo,
    authorUsername: typeof row.author_username === 'string' ? row.author_username : undefined,
    authorProfile,
    participantProfiles,
  };
}

function toCalendarEventRow(event: CalendarEvent, includeEndDate = true) {
  const row: CalendarEventRow = {
    id: event.id,
    date: event.date,
    end_date: normalizeEventEndDate(event.date, event.endDate),
    time: event.time,
    title: event.title,
    importance: event.importance,
    memo: includeEndDate ? event.memo : encodeEventMemo(event),
    author_username: event.authorUsername ?? null,
    author_profile: event.authorProfile ?? null,
    participant_profiles: getEventParticipantProfiles(event),
  };

  if (!includeEndDate) {
    delete row.end_date;
  }

  return row;
}

function normalizeBucketItemRow(row: BucketItemRow, index: number): BucketItem {
  return {
    id: typeof row.id === 'number' ? row.id : index + 1,
    text: typeof row.text === 'string' ? row.text : '제목 없음',
    status:
      row.status === 'pending' || row.status === 'ready' || row.status === 'completed'
        ? row.status
        : 'pending',
  };
}

function toBucketItemRow(item: BucketItem) {
  return {
    id: item.id,
    text: item.text,
    status: item.status,
  };
}

function normalizeMannerReviewRow(row: MannerReviewRow, index: number): MannerReview | null {
  if (
    !isAccountProfile(row.author_profile) ||
    !isAccountProfile(row.target_profile) ||
    row.author_profile === row.target_profile ||
    !isMannerRating(row.rating)
  ) {
    return null;
  }

  return {
    id: typeof row.id === 'number' ? row.id : index + 1,
    authorProfile: row.author_profile,
    targetProfile: row.target_profile,
    rating: row.rating,
    strengths: typeof row.strengths === 'string' ? row.strengths : '',
    improvements: typeof row.improvements === 'string' ? row.improvements : '',
    status: isMannerReviewStatus(row.status) ? row.status : 'open',
    createdAt: typeof row.created_at === 'string' ? row.created_at : new Date().toISOString(),
    improvementRequestedAt:
      typeof row.improvement_requested_at === 'string'
        ? row.improvement_requested_at
        : undefined,
    improvementConfirmedAt:
      typeof row.improvement_confirmed_at === 'string'
        ? row.improvement_confirmed_at
        : undefined,
  };
}

function toMannerReviewRow(review: MannerReview) {
  return {
    id: review.id,
    author_profile: review.authorProfile,
    target_profile: review.targetProfile,
    rating: review.rating,
    strengths: review.strengths,
    improvements: review.improvements,
    status: review.status,
    created_at: review.createdAt,
    improvement_requested_at: review.improvementRequestedAt ?? null,
    improvement_confirmed_at: review.improvementConfirmedAt ?? null,
  };
}

function getMannerReviewTemperatureDelta() {
  return MANNER_RATING_STEP;
}

function clampTemperature(value: number) {
  return Math.min(MANNER_MAX_TEMPERATURE, Math.max(MANNER_MIN_TEMPERATURE, value));
}

function calculateMannerTemperature(profile: AccountProfile, reviews: MannerReview[]) {
  const rawTemperature = reviews
    .filter((review) => review.targetProfile === profile)
    .reduce((temperature) => {
      return temperature + getMannerReviewTemperatureDelta();
    }, MANNER_BASE_TEMPERATURE);

  return Number(clampTemperature(rawTemperature).toFixed(1));
}

function formatSignedTemperatureDelta(delta: number) {
  const roundedDelta = Number(delta.toFixed(1));

  if (roundedDelta > 0) {
    return `+${roundedDelta.toFixed(1)}°C`;
  }

  return `${roundedDelta.toFixed(1)}°C`;
}

function formatReviewDate(timestamp: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(timestamp));
}

function formatCalendarDateLabel(dateKey: string) {
  const [, month, day] = dateKey.split('-');
  return `${Number(month)}월 ${Number(day)}일`;
}

function getLoveDayCount(today = new Date()) {
  const startDate = new Date(
    LOVE_START_DATE.getFullYear(),
    LOVE_START_DATE.getMonth(),
    LOVE_START_DATE.getDate(),
  );
  const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diffTime = todayDate.getTime() - startDate.getTime();

  return Math.max(0, Math.floor(diffTime / 86_400_000));
}

function getLoveProgressPercent(dayCount: number) {
  return Math.min(100, Math.max(0, (dayCount / LOVE_GOAL_DAYS) * 100));
}

function getLoveMilestoneDate(day: number) {
  const milestoneDate = new Date(LOVE_START_DATE);
  milestoneDate.setDate(LOVE_START_DATE.getDate() + day - 1);

  return milestoneDate;
}

function formatLoveMilestoneDate(date: Date) {
  return `${String(date.getFullYear()).slice(2)}.${String(date.getMonth() + 1).padStart(
    2,
    '0',
  )}.${String(date.getDate()).padStart(2, '0')}`;
}

function loadLocation() {
  return {
    ...DEFAULT_LOCATION,
    updatedAt: Date.now(),
  };
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function firstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

function formatClockFromTimestamp(timestamp: number) {
  return new Intl.DateTimeFormat('ko-KR', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(timestamp));
}

function buildSessionFromEmail(email?: string | null): Session | null {
  const matchedAccount = findAccountByEmail(DEFAULT_ACCOUNTS, email);

  if (!matchedAccount) {
    return null;
  }

  return {
    username: matchedAccount.username,
    loggedInAt: new Date().toISOString(),
  };
}

export default function App() {
  const accounts = DEFAULT_ACCOUNTS;
  const [session, setSession] = useState<Session | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [bucketList, setBucketList] = useState<BucketItem[]>([]);
  const [mannerReviews, setMannerReviews] = useState<MannerReview[]>([]);
  const [location, setLocation] = useState<WeatherLocation>(() => loadLocation());
  const [activeTab, setActiveTab] = useState<Tab>('calendar');
  const [bucketFilter, setBucketFilter] = useState<BucketFilter>('all');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [newEvent, setNewEvent] = useState<EventDraft>(EMPTY_EVENT_DRAFT);
  const [bucketDraft, setBucketDraft] = useState<BucketDraft>(EMPTY_BUCKET_DRAFT);
  const [mannerReviewDraft, setMannerReviewDraft] = useState<MannerReviewDraft>(
    EMPTY_MANNER_REVIEW_DRAFT,
  );
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isBucketModalOpen, setIsBucketModalOpen] = useState(false);
  const [isMannerModalOpen, setIsMannerModalOpen] = useState(false);
  const [editingMannerReviewId, setEditingMannerReviewId] = useState<number | null>(null);
  const [isWeatherPopupOpen, setIsWeatherPopupOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState<number | null>(null);
  const [editingBucketItemId, setEditingBucketItemId] = useState<number | null>(null);
  const [loginForm, setLoginForm] = useState({
    username: DEFAULT_ACCOUNTS[0].username,
    password: '',
  });
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [mannerReviewError, setMannerReviewError] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isRefreshingLocation, setIsRefreshingLocation] = useState(false);
  const [weatherData, setWeatherData] = useState<WeatherSnapshot | null>(null);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [isWeatherLoading, setIsWeatherLoading] = useState(false);
  const [pushNotificationStatus, setPushNotificationStatus] =
    useState<PushNotificationStatus>(() => getInitialPushNotificationStatus());

  useEffect(() => {
    writeStorage(LOCATION_STORAGE_KEY, location);
  }, [location]);

  useEffect(() => {
    if (!supabase) {
      setLoginError('Supabase 환경변수가 설정되지 않았습니다.');
      setIsAuthReady(true);
      return;
    }

    let isMounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) {
        return;
      }

      const nextSession = buildSessionFromEmail(data.session?.user.email);
      setSession(nextSession);
      if (nextSession) {
        setLoginForm((previousForm) => ({
          ...previousForm,
          username: nextSession.username,
          password: '',
        }));
      }
      setIsAuthReady(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, authSession) => {
      const nextSession = buildSessionFromEmail(authSession?.user.email);
      setSession(nextSession);
      if (nextSession) {
        setLoginForm((previousForm) => ({
          ...previousForm,
          username: nextSession.username,
          password: '',
        }));
      }
      setIsAuthReady(true);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session) {
      setIsWeatherPopupOpen(false);
      setIsAccountModalOpen(false);
      setWeatherData(null);
      setWeatherError(null);
      setLocationError(null);
      setEditingEventId(null);
      setIsBucketModalOpen(false);
      setEditingBucketItemId(null);
      setIsMannerModalOpen(false);
      setEditingMannerReviewId(null);
      setMannerReviewError(null);
      setEvents([]);
      setBucketList([]);
      setMannerReviews([]);
      setDataError(null);
      return;
    }

    const currentAccount = findAccountByUsername(accounts, session.username);
    if (!currentAccount) {
      setSession(null);
    }
  }, [accounts, session]);

  useEffect(() => {
    if (!session) {
      return;
    }

    setLocation({
      ...DEFAULT_LOCATION,
      updatedAt: Date.now(),
    });
    setLocationError(null);
    setIsRefreshingLocation(false);
  }, [session]);

  useEffect(() => {
    if (!session) {
      return;
    }

    const controller = new AbortController();
    setIsWeatherLoading(true);
    setWeatherError(null);

    fetchWeatherSnapshot(location, controller.signal)
      .then((snapshot) => {
        setWeatherData(snapshot);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }

        setWeatherData(null);
        setWeatherError(
          error instanceof Error ? error.message : '날씨 정보를 불러오지 못했습니다.',
        );
      })
      .finally(() => {
        setIsWeatherLoading(false);
        setIsRefreshingLocation(false);
      });

    return () => {
      controller.abort();
    };
  }, [location, session]);

  const selectedDateEvents = useMemo(() => {
    const selectedDateKey = formatYMD(selectedDate);

    return events
      .filter((event) => isDateInEventRange(event, selectedDateKey))
      .sort((left, right) => left.time.localeCompare(right.time));
  }, [events, selectedDate]);

  const monthEvents = useMemo(() => {
    const monthStart = formatYMD(
      new Date(currentDate.getFullYear(), currentDate.getMonth(), 1),
    );
    const monthEnd = formatYMD(
      new Date(
        currentDate.getFullYear(),
        currentDate.getMonth(),
        daysInMonth(currentDate.getFullYear(), currentDate.getMonth()),
      ),
    );

    return events.filter((event) => doesEventIntersectDateRange(event, monthStart, monthEnd));
  }, [currentDate, events]);

  const upcomingEvents = useMemo(() => {
    const todayKey = formatYMD(new Date());
    const currentProfile = findAccountByUsername(accounts, session?.username)?.profile;

    if (!currentProfile) {
      return [];
    }

    return events
      .filter((event) => {
        const participants = getEventParticipantProfiles(event);

        return (
          normalizeEventEndDate(event.date, event.endDate) >= todayKey &&
          participants.includes(currentProfile)
        );
      })
      .sort((left, right) => {
        const leftNextDate = left.date < todayKey ? todayKey : left.date;
        const rightNextDate = right.date < todayKey ? todayKey : right.date;

        return leftNextDate.localeCompare(rightNextDate) || left.time.localeCompare(right.time);
      })
      .slice(0, 5);
  }, [accounts, events, session?.username]);

  const bucketStats = useMemo(() => {
    const total = bucketList.length;
    const completed = bucketList.filter((item) => item.status === 'completed').length;
    const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);

    return { total, completed, percentage };
  }, [bucketList]);

  const filteredBucketList = useMemo(() => {
    if (bucketFilter === 'all') {
      return bucketList;
    }

    return bucketList.filter((item) => item.status === bucketFilter);
  }, [bucketFilter, bucketList]);

  const currentAccount = useMemo(
    () => findAccountByUsername(accounts, session?.username),
    [accounts, session?.username],
  );

  const currentPartnerProfile = currentAccount
    ? getPartnerProfile(currentAccount.profile)
    : null;
  const currentMannerTemperature = currentAccount
    ? calculateMannerTemperature(currentAccount.profile, mannerReviews)
    : null;
  const loveDayCount = getLoveDayCount();
  const loveProgressPercent = getLoveProgressPercent(loveDayCount);
  const loveRunnerPosition = Math.min(96, Math.max(4, loveProgressPercent));
  const editingEvent = editingEventId == null ? null : events.find((event) => event.id === editingEventId);
  const editingBucketItem =
    editingBucketItemId == null ? null : bucketList.find((item) => item.id === editingBucketItemId);
  const editingMannerReview =
    editingMannerReviewId == null
      ? null
      : mannerReviews.find((review) => review.id === editingMannerReviewId);
  const eventModalStartDate = editingEvent?.date ?? formatYMD(selectedDate);

  useEffect(() => {
    if (!session || !currentAccount) {
      return;
    }

    void loadRemoteData();
  }, [currentAccount, session]);

  useEffect(() => {
    if (
      !session ||
      !currentAccount ||
      pushNotificationStatus === 'loading' ||
      pushNotificationStatus === 'subscribed' ||
      typeof Notification === 'undefined' ||
      Notification.permission !== 'granted'
    ) {
      return;
    }

    void enablePushNotifications(true);
  }, [currentAccount, pushNotificationStatus, session]);

  const boyfriendEvents = useMemo(
    () =>
      selectedDateEvents.filter((event) =>
        getEventParticipantProfiles(event).includes('boyfriend'),
      ),
    [selectedDateEvents],
  );

  const girlfriendEvents = useMemo(
    () =>
      selectedDateEvents.filter((event) =>
        getEventParticipantProfiles(event).includes('girlfriend'),
      ),
    [selectedDateEvents],
  );

  const weatherSummary = useMemo(() => {
    const baseLocationText = '서울 고정 날씨';

    return {
      condition: weatherData?.current.weatherCondition?.description?.text ?? '날씨 정보 준비 중',
      humidity:
        weatherData?.current.relativeHumidity == null
          ? '-'
          : `${weatherData.current.relativeHumidity}%`,
      locationHelperText: `${baseLocationText} · ${formatClockFromTimestamp(location.updatedAt)}`,
      locationLabel: location.label,
      rainChance: weatherData
        ? `${getPrecipitationPercent(weatherData.current.precipitation)}%`
        : '-',
      temperatureText: weatherData
        ? String(roundTemperature(weatherData.current.temperature))
        : '--',
      updatedText:
        weatherData?.current.currentTime != null
          ? formatCurrentDateTime(weatherData.current.currentTime, weatherData.timeZoneId)
          : `위치 갱신 ${formatClockFromTimestamp(location.updatedAt)}`,
      wind: weatherData ? formatWindSpeed(weatherData.current.wind) : '-',
    };
  }, [location, weatherData]);

  function getRemoteClient() {
    if (!supabase) {
      setDataError('Supabase 환경변수가 설정되지 않았습니다.');
      return null;
    }

    return supabase;
  }

  function getRemoteErrorMessage(error: { message?: string }) {
    const message = error.message ?? '';

    return message.includes('relation')
      ? 'Supabase 테이블을 찾을 수 없습니다. supabase-schema.sql을 SQL Editor에서 먼저 실행해 주세요.'
      : message || 'Supabase 요청에 실패했습니다.';
  }

  async function getCurrentAccessToken() {
    if (!supabase) {
      return null;
    }

    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }

  async function enablePushNotifications(isSilent = false) {
    if (!currentAccount) {
      return;
    }

    setPushNotificationStatus('loading');

    try {
      const token = await getCurrentAccessToken();

      if (!token) {
        throw new Error('Missing auth token.');
      }

      await registerPushSubscription({
        profile: currentAccount.profile,
        token,
        username: currentAccount.username,
      });
      setPushNotificationStatus('subscribed');
    } catch (error) {
      if (!isSilent) {
        console.warn('Push notification setup failed', error);
      }

      setPushNotificationStatus(
        typeof Notification !== 'undefined' && Notification.permission === 'denied'
          ? 'denied'
          : 'error',
      );
    }
  }

  async function publishPushNotification({
    body,
    tag,
    targetProfiles,
    title,
    type,
    url = '/',
  }: {
    body: string;
    tag?: string;
    targetProfiles?: AccountProfile[];
    title: string;
    type: string;
    url?: string;
  }) {
    if (!currentAccount) {
      return;
    }

    const token = await getCurrentAccessToken();
    await notifyPushUpdate(
      {
        actorProfile: currentAccount.profile,
        actorUsername: currentAccount.username,
        body,
        tag,
        targetProfiles,
        title,
        type,
        url,
      },
      token,
    );
  }

  function getNotificationTargetProfiles(profiles?: AccountProfile[]) {
    if (!currentAccount) {
      return undefined;
    }

    const baseProfiles: AccountProfile[] =
      profiles && profiles.length > 0 ? profiles : ['boyfriend', 'girlfriend'];
    const targetProfiles = Array.from(new Set<AccountProfile>(baseProfiles)).filter(
      (profile) => profile !== currentAccount.profile,
    );

    return targetProfiles.length > 0 ? targetProfiles : [getPartnerProfile(currentAccount.profile)];
  }

  async function insertCalendarEvent(client: NonNullable<typeof supabase>, event: CalendarEvent) {
    const result = await client.from('calendar_events').insert(toCalendarEventRow(event));

    if (!isMissingEndDateColumnError(result.error)) {
      return result;
    }

    return client.from('calendar_events').insert(toCalendarEventRow(event, false));
  }

  async function upsertCalendarEvent(client: NonNullable<typeof supabase>, event: CalendarEvent) {
    const result = await client.from('calendar_events').upsert(toCalendarEventRow(event));

    if (!isMissingEndDateColumnError(result.error)) {
      return result;
    }

    return client.from('calendar_events').upsert(toCalendarEventRow(event, false));
  }

  async function upsertCalendarEvents(
    client: NonNullable<typeof supabase>,
    nextEvents: CalendarEvent[],
  ) {
    const result = await client
      .from('calendar_events')
      .upsert(nextEvents.map((event) => toCalendarEventRow(event)));

    if (!isMissingEndDateColumnError(result.error)) {
      return result;
    }

    return client
      .from('calendar_events')
      .upsert(nextEvents.map((event) => toCalendarEventRow(event, false)));
  }

  async function loadRemoteData() {
    const client = getRemoteClient();

    if (!client) {
      return;
    }

    setIsDataLoading(true);
    setDataError(null);

    const [eventsResult, bucketResult, mannerResult] = await Promise.all([
      client.from('calendar_events').select('*').order('date').order('time'),
      client.from('bucket_items').select('*').order('id'),
      client.from('manner_reviews').select('*').order('created_at', { ascending: false }),
    ]);

    const firstError = eventsResult.error ?? bucketResult.error ?? mannerResult.error;

    if (firstError) {
      setDataError(getRemoteErrorMessage(firstError));
      setIsDataLoading(false);
      return;
    }

    let nextEvents = ((eventsResult.data ?? []) as CalendarEventRow[]).map(
      normalizeCalendarEventRow,
    );
    let nextBucketList = ((bucketResult.data ?? []) as BucketItemRow[]).map(
      normalizeBucketItemRow,
    );

    if (nextEvents.length === 0) {
      const defaultEvents = buildDefaultEvents(accounts);
      const { error } = await upsertCalendarEvents(client, defaultEvents);

      if (error) {
        setDataError(getRemoteErrorMessage(error));
      } else {
        nextEvents = defaultEvents;
      }
    }

    if (nextBucketList.length === 0) {
      const defaultBucketList = buildDefaultBucketList();
      const { error } = await client
        .from('bucket_items')
        .upsert(defaultBucketList.map(toBucketItemRow));

      if (error) {
        setDataError(getRemoteErrorMessage(error));
      } else {
        nextBucketList = defaultBucketList;
      }
    }

    setEvents(nextEvents);
    setBucketList(nextBucketList);
    setMannerReviews(
      ((mannerResult.data ?? []) as MannerReviewRow[])
        .map(normalizeMannerReviewRow)
        .filter((review): review is MannerReview => Boolean(review)),
    );
    setIsDataLoading(false);
  }

  function refreshCurrentLocation() {
    setIsRefreshingLocation(true);
    setLocationError(null);
    setLocation({
      ...DEFAULT_LOCATION,
      updatedAt: Date.now(),
    });
  }

  function openAddModal() {
    setNewEvent({
      ...EMPTY_EVENT_DRAFT,
      endDate: formatYMD(selectedDate),
      participantProfiles: currentAccount ? [currentAccount.profile] : [],
    });
    setEditingEventId(null);
    setIsAddModalOpen(true);
  }

  function closeEventModal() {
    setIsAddModalOpen(false);
    setEditingEventId(null);
    setNewEvent(EMPTY_EVENT_DRAFT);
  }

  function openBucketModal() {
    setEditingBucketItemId(null);
    setBucketDraft(EMPTY_BUCKET_DRAFT);
    setIsBucketModalOpen(true);
  }

  function openEditBucketModal(item: BucketItem) {
    setEditingBucketItemId(item.id);
    setBucketDraft({
      text: item.text,
      status: item.status,
    });
    setIsBucketModalOpen(true);
  }

  function closeBucketModal() {
    setIsBucketModalOpen(false);
    setEditingBucketItemId(null);
    setBucketDraft(EMPTY_BUCKET_DRAFT);
  }

  function openMannerReviewModal() {
    if (!currentAccount) {
      return;
    }

    setEditingMannerReviewId(null);
    setMannerReviewDraft(EMPTY_MANNER_REVIEW_DRAFT);
    setMannerReviewError(null);
    setIsMannerModalOpen(true);
  }

  function openEditMannerReviewModal(review: MannerReview) {
    if (currentAccount?.profile !== review.authorProfile) {
      return;
    }

    setEditingMannerReviewId(review.id);
    setMannerReviewDraft({
      rating: review.rating,
      strengths: review.strengths,
      improvements: review.improvements,
    });
    setMannerReviewError(null);
    setIsMannerModalOpen(true);
  }

  function closeMannerReviewModal() {
    setIsMannerModalOpen(false);
    setEditingMannerReviewId(null);
    setMannerReviewDraft(EMPTY_MANNER_REVIEW_DRAFT);
    setMannerReviewError(null);
  }

  async function submitMannerReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!currentAccount) {
      return;
    }

    const targetProfile = getPartnerProfile(currentAccount.profile);
    const strengths = mannerReviewDraft.strengths.trim();

    if (!strengths) {
      setMannerReviewError('칭찬을 입력해 주세요.');
      return;
    }

    if (targetProfile === currentAccount.profile) {
      setMannerReviewError('자기 자신에게는 러브온도를 남길 수 없습니다.');
      return;
    }

    if (editingMannerReview) {
      const nextReview: MannerReview = {
        ...editingMannerReview,
        strengths,
      };

      const client = getRemoteClient();
      if (!client) {
        return;
      }

      const { error } = await client
        .from('manner_reviews')
        .update({
          strengths: nextReview.strengths,
          improvements: nextReview.improvements,
        })
        .eq('id', nextReview.id);

      if (error) {
        setMannerReviewError(getRemoteErrorMessage(error));
        return;
      }

      setMannerReviews((previousReviews) =>
        previousReviews.map((review) => (review.id === nextReview.id ? nextReview : review)),
      );
      void publishPushNotification({
        body: `${PROFILE_META[currentAccount.profile].displayName}님이 칭찬을 수정했어요.`,
        tag: `manner-${nextReview.id}`,
        targetProfiles: getNotificationTargetProfiles([
          nextReview.authorProfile,
          nextReview.targetProfile,
        ]),
        title: '칭찬 수정',
        type: 'manner-review',
      });
      closeMannerReviewModal();
      setActiveTab('manner');
      return;
    }

    const nextReview: MannerReview = {
      id: Date.now(),
      authorProfile: currentAccount.profile,
      targetProfile,
      rating: mannerReviewDraft.rating,
      strengths,
      improvements: '',
      status: 'open',
      createdAt: new Date().toISOString(),
    };

    const client = getRemoteClient();
    if (!client) {
      return;
    }

    const { error } = await client.from('manner_reviews').insert(toMannerReviewRow(nextReview));

    if (error) {
      setMannerReviewError(getRemoteErrorMessage(error));
      return;
    }

    setMannerReviews((previousReviews) => [nextReview, ...previousReviews]);
    void publishPushNotification({
      body: `${PROFILE_META[currentAccount.profile].displayName}님이 칭찬을 남겼어요.`,
      tag: `manner-${nextReview.id}`,
      targetProfiles: [targetProfile],
      title: '새 칭찬 기록',
      type: 'manner-review',
    });
    closeMannerReviewModal();
    setActiveTab('manner');
  }

  function toggleEventParticipant(profile: AccountProfile) {
    setNewEvent((previousEvent) => ({
      ...previousEvent,
      participantProfiles: previousEvent.participantProfiles.includes(profile)
        ? previousEvent.participantProfiles.filter(
            (participantProfile) => participantProfile !== profile,
          )
        : [...previousEvent.participantProfiles, profile],
    }));
  }

  function openEditModal(event: CalendarEvent) {
    setEditingEventId(event.id);
    setNewEvent({
      title: event.title,
      time: event.time,
      endDate: normalizeEventEndDate(event.date, event.endDate),
      importance: event.importance,
      memo: event.memo,
      participantProfiles: getEventParticipantProfiles(event),
    });
    setIsAddModalOpen(true);
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase) {
      setLoginError('Supabase 설정이 없습니다.');
      return;
    }

    const username = loginForm.username.trim();
    const password = loginForm.password.trim();
    const matchedAccount = findAccountByUsername(accounts, username);

    if (!matchedAccount || !password) {
      setLoginError('아이디와 비밀번호를 입력해 주세요.');
      return;
    }

    const signInEmails = [matchedAccount.email, ...(matchedAccount.emailAliases ?? [])];
    let lastSignInError: unknown = null;

    for (const email of signInEmails) {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (!error) {
        setLoginError(null);
        return;
      }

      lastSignInError = error;
    }

    if (lastSignInError) {
      setLoginError('아이디 또는 비밀번호가 맞지 않습니다.');
      return;
    }
  }

  async function handleLogout() {
    if (supabase) {
      await supabase.auth.signOut();
    }

    setSession(null);
    setLoginError(null);
    setIsWeatherPopupOpen(false);
  }

  async function addEvent() {
    if (!newEvent.title.trim() || !session) {
      return;
    }

    const client = getRemoteClient();
    if (!client) {
      return;
    }

    if (editingEventId != null) {
      const targetEvent = events.find((event) => event.id === editingEventId);

      if (!targetEvent) {
        closeEventModal();
        return;
      }

      const baseParticipant = targetEvent.authorProfile;
      const participantProfiles = Array.from(
        new Set(
          [
            ...newEvent.participantProfiles,
            ...(baseParticipant ? [baseParticipant] : []),
          ].filter((profile): profile is AccountProfile => Boolean(profile)),
        ),
      );
      const nextEvent: CalendarEvent = {
        ...targetEvent,
        title: newEvent.title.trim(),
        time: newEvent.time,
        endDate: normalizeEventEndDate(targetEvent.date, newEvent.endDate),
        importance: newEvent.importance,
        memo: newEvent.memo.trim(),
        participantProfiles,
      };
      const { error } = await upsertCalendarEvent(client, nextEvent);

      if (error) {
        setDataError(getRemoteErrorMessage(error));
        return;
      }

      setEvents((previousEvents) =>
        previousEvents.map((event) => (event.id === editingEventId ? nextEvent : event)),
      );
      void publishPushNotification({
        body: `${PROFILE_META[currentAccount?.profile ?? 'boyfriend'].displayName}님이 "${nextEvent.title}" 일정을 수정했어요.`,
        tag: `calendar-${nextEvent.id}`,
        targetProfiles: getNotificationTargetProfiles(getEventParticipantProfiles(nextEvent)),
        title: '일정 수정',
        type: 'calendar-event',
      });
      closeEventModal();
      return;
    }

    const participantProfiles =
      newEvent.participantProfiles.length > 0 && currentAccount
        ? Array.from(new Set([...newEvent.participantProfiles, currentAccount.profile]))
        : currentAccount
          ? [currentAccount.profile]
          : newEvent.participantProfiles;

    const nextEvent: CalendarEvent = {
      ...newEvent,
      id: Date.now(),
      date: formatYMD(selectedDate),
      endDate: normalizeEventEndDate(formatYMD(selectedDate), newEvent.endDate),
      title: newEvent.title.trim(),
      memo: newEvent.memo.trim(),
      authorUsername: currentAccount?.username ?? session.username,
      authorProfile: currentAccount?.profile,
      participantProfiles,
    };

    const { error } = await insertCalendarEvent(client, nextEvent);

    if (error) {
      setDataError(getRemoteErrorMessage(error));
      return;
    }

    setEvents((previousEvents) => [...previousEvents, nextEvent]);
    void publishPushNotification({
      body: `${PROFILE_META[currentAccount?.profile ?? 'boyfriend'].displayName}님이 "${nextEvent.title}" 일정을 추가했어요.`,
      tag: `calendar-${nextEvent.id}`,
      targetProfiles: getNotificationTargetProfiles(getEventParticipantProfiles(nextEvent)),
      title: '새 일정',
      type: 'calendar-event',
    });
    closeEventModal();
  }

  async function deleteEvent(eventId: number) {
    const client = getRemoteClient();
    if (!client) {
      return;
    }

    const targetEvent = events.find((event) => event.id === eventId);
    const { error } = await client.from('calendar_events').delete().eq('id', eventId);

    if (error) {
      setDataError(getRemoteErrorMessage(error));
      return;
    }

    setEvents((previousEvents) => previousEvents.filter((event) => event.id !== eventId));
    if (targetEvent) {
      void publishPushNotification({
        body: `${PROFILE_META[currentAccount?.profile ?? 'boyfriend'].displayName}님이 "${targetEvent.title}" 일정을 삭제했어요.`,
        tag: `calendar-${targetEvent.id}`,
        targetProfiles: getNotificationTargetProfiles(getEventParticipantProfiles(targetEvent)),
        title: '일정 삭제',
        type: 'calendar-event',
      });
    }
  }

  async function toggleBucketStatus(itemId: number) {
    const client = getRemoteClient();
    if (!client) {
      return;
    }

    const currentItem = bucketList.find((item) => item.id === itemId);

    if (!currentItem) {
      return;
    }

    const statuses: BucketStatus[] = ['pending', 'ready', 'completed'];
    const nextItem = {
      ...currentItem,
      status: statuses[(statuses.indexOf(currentItem.status) + 1) % statuses.length],
    };
    const { error } = await client.from('bucket_items').upsert(toBucketItemRow(nextItem));

    if (error) {
      setDataError(getRemoteErrorMessage(error));
      return;
    }

    setBucketList((previousItems) =>
      previousItems.map((item) => (item.id === itemId ? nextItem : item)),
    );
    void publishPushNotification({
      body: `${PROFILE_META[currentAccount?.profile ?? 'boyfriend'].displayName}님이 "${nextItem.text}" 상태를 바꿨어요.`,
      tag: `bucket-${nextItem.id}`,
      targetProfiles: getNotificationTargetProfiles(),
      title: '버킷리스트 업데이트',
      type: 'bucket-item',
    });
  }

  async function deleteBucketItem(itemId: number) {
    const client = getRemoteClient();
    if (!client) {
      return;
    }

    const targetItem = bucketList.find((item) => item.id === itemId);
    const { error } = await client.from('bucket_items').delete().eq('id', itemId);

    if (error) {
      setDataError(getRemoteErrorMessage(error));
      return;
    }

    setBucketList((previousItems) => previousItems.filter((item) => item.id !== itemId));
    if (targetItem) {
      void publishPushNotification({
        body: `${PROFILE_META[currentAccount?.profile ?? 'boyfriend'].displayName}님이 "${targetItem.text}" 항목을 삭제했어요.`,
        tag: `bucket-${targetItem.id}`,
        targetProfiles: getNotificationTargetProfiles(),
        title: '버킷리스트 삭제',
        type: 'bucket-item',
      });
    }
  }

  async function addBucketItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const text = bucketDraft.text.trim();
    if (!text || !session) {
      return;
    }

    const client = getRemoteClient();
    if (!client) {
      return;
    }

    if (editingBucketItem) {
      const nextItem: BucketItem = {
        ...editingBucketItem,
        text,
        status: bucketDraft.status,
      };
      const { error } = await client.from('bucket_items').upsert(toBucketItemRow(nextItem));

      if (error) {
        setDataError(getRemoteErrorMessage(error));
        return;
      }

      setBucketList((previousItems) =>
        previousItems.map((item) => (item.id === nextItem.id ? nextItem : item)),
      );
      setBucketFilter(nextItem.status);
      void publishPushNotification({
        body: `${PROFILE_META[currentAccount?.profile ?? 'boyfriend'].displayName}님이 "${nextItem.text}" 항목을 수정했어요.`,
        tag: `bucket-${nextItem.id}`,
        targetProfiles: getNotificationTargetProfiles(),
        title: '버킷리스트 수정',
        type: 'bucket-item',
      });
      closeBucketModal();
      return;
    }

    const nextItem: BucketItem = {
      id: Date.now(),
      text,
      status: bucketDraft.status,
    };
    const { error } = await client.from('bucket_items').insert(toBucketItemRow(nextItem));

    if (error) {
      setDataError(getRemoteErrorMessage(error));
      return;
    }

    setBucketList((previousItems) => [nextItem, ...previousItems]);
    setBucketFilter(nextItem.status);
    void publishPushNotification({
      body: `${PROFILE_META[currentAccount?.profile ?? 'boyfriend'].displayName}님이 "${nextItem.text}" 항목을 추가했어요.`,
      tag: `bucket-${nextItem.id}`,
      targetProfiles: getNotificationTargetProfiles(),
      title: '새 버킷리스트',
      type: 'bucket-item',
    });
    closeBucketModal();
  }

  function renderMannerProfile(profile: AccountProfile) {
    const profileMeta = PROFILE_META[profile];
    const profileTone = CALENDAR_EVENT_TONES[profile];
    const isCurrentProfile = currentAccount?.profile === profile;
    const profileReviews = mannerReviews
      .filter((review) => review.targetProfile === profile)
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
    const recentReviews = profileReviews.slice(0, 3);
    const temperature = calculateMannerTemperature(profile, mannerReviews);
    const temperatureColor = temperature < MANNER_BASE_TEMPERATURE ? '#918679' : profileTone.bg;
    const temperatureOpacity = temperature >= MANNER_BASE_TEMPERATURE + 1 ? 0.82 : 0.68;

    return (
      <section
        key={profile}
        className="rounded-[28px] bg-[#FDFBF8] p-5 shadow-[0_12px_36px_rgba(66,45,18,0.05)]"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-2xl text-2xl"
              style={{ backgroundColor: `${profileTone.bg}22` }}
            >
              {profileMeta.emoji}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-bold text-[#2f2417]">
                  {profileMeta.displayName}
                </h3>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    isCurrentProfile
                      ? 'bg-[#F0EDFF] text-[#7D6DE0]'
                      : 'bg-[#F8F5EF] text-[#918679]'
                  }`}
                >
                  {isCurrentProfile ? '내 프로필' : '상대 프로필'}
                </span>
              </div>
              <p className="mt-1 text-xs text-[#8d7558]">{profileMeta.label}에게 남겨진 칭찬</p>
            </div>
          </div>

          <div className="text-right">
            <div
              className="flex items-center justify-end gap-1 rounded-2xl px-3 py-2 text-2xl font-black"
              style={{
                backgroundColor: `${profileTone.bg}14`,
                color: temperatureColor,
                opacity: temperatureOpacity,
              }}
            >
              <Thermometer size={20} />
              {temperature.toFixed(1)}°C
            </div>
            <p className="mt-1 text-[11px] font-semibold text-gray-400">
              기준 {MANNER_BASE_TEMPERATURE.toFixed(1)}°C
            </p>
          </div>
        </div>

        {!isCurrentProfile ? (
          <button
            type="button"
            onClick={openMannerReviewModal}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#A594F9] px-4 py-3 text-sm font-bold text-white"
          >
            <Heart size={15} fill="currentColor" />
            {profileMeta.displayName} 칭찬 남기기
          </button>
        ) : null}

        <div className="mt-5">
          <div className="mb-1 flex items-center justify-between">
            <h4 className="text-sm font-bold text-[#2f2417]">칭찬해요</h4>
            <span className="text-[10px] font-bold text-gray-400">최근 3개</span>
          </div>

          {recentReviews.length > 0 ? (
            <div>
              {recentReviews.map((review) => {
                const authorMeta = PROFILE_META[review.authorProfile];
                const canManageReview = currentAccount?.profile === review.authorProfile;
                const reviewDelta = getMannerReviewTemperatureDelta();

                return (
                  <div
                    key={review.id}
                    className="border-t border-[#f2e8da] py-4 first:border-t-0"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-semibold text-[#8d7558]">
                          {authorMeta.emoji} {authorMeta.displayName}가 남김
                          <span className="ml-2 text-gray-400">
                            {formatReviewDate(review.createdAt)}
                          </span>
                        </p>
                      </div>
                      <div className="flex shrink-0 items-start gap-1">
                        <div className="mr-1 text-right">
                          <span
                            className="rounded-full px-2 py-0.5 text-[10px] font-black"
                            style={{
                              backgroundColor: reviewDelta >= 0 ? '#FBEFEF' : '#EEF4FB',
                              color: reviewDelta >= 0 ? '#D48787' : '#6F99C7',
                            }}
                          >
                            {formatSignedTemperatureDelta(reviewDelta)}
                          </span>
                          <div className="mt-1 text-[10px] font-bold text-gray-400">
                            {MANNER_STATUS_LABELS[review.status]}
                          </div>
                        </div>
                        {canManageReview ? (
                          <button
                            type="button"
                            onClick={() => openEditMannerReviewModal(review)}
                            className="flex h-7 w-7 items-center justify-center rounded-full text-gray-300 transition hover:bg-gray-100 hover:text-[#918679]"
                            aria-label="칭찬 수정"
                            title="수정"
                          >
                            <Pencil size={13} />
                          </button>
                        ) : null}
                      </div>
                    </div>

                    <p className="mt-3 text-sm leading-6 text-[#6f5b43]">{review.strengths}</p>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="mt-3 rounded-2xl border-2 border-dashed border-[#f0e3d0] bg-[#fffaf4] py-8 text-center text-sm text-[#a0896d]">
              아직 남겨진 칭찬이 없습니다.
            </div>
          )}
        </div>
      </section>
    );
  }

  function renderScheduleColumn(profile: AccountProfile, profileEvents: CalendarEvent[]) {
    const profileMeta = PROFILE_META[profile];
    const profileTone = CALENDAR_EVENT_TONES[profile];

    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex shrink-0 items-center gap-2 pb-3">
          <span
            className="flex h-7 w-7 items-center justify-center rounded-xl text-sm"
            style={{ backgroundColor: `${profileTone.bg}24` }}
          >
            {profileMeta.emoji}
          </span>
          <h4 className="text-base font-bold text-[#2f2417]">{profileMeta.displayName}</h4>
        </div>

        <div className="scrollbar-hide min-h-0 flex-1 space-y-3 overflow-y-auto pr-1 pb-3">
          {profileEvents.length > 0 ? (
            profileEvents.map((event) => {
              const importanceColor = IMPORTANCE_COLORS[event.importance];
              const authorMeta = event.authorProfile ? PROFILE_META[event.authorProfile] : null;
              const taggedProfiles = getEventParticipantProfiles(event).filter(
                (participantProfile) => participantProfile !== event.authorProfile,
              );

              return (
                <div
                  key={`${profile}-${event.id}`}
                  className="rounded-[22px] p-4 shadow-[0_10px_30px_rgba(66,45,18,0.04)]"
                  style={{ backgroundColor: `${profileTone.bg}12` }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-bold" style={{ color: profileTone.bg }}>
                        {event.time}
                      </p>
                      <h5 className="mt-1 font-bold text-[#2f2417]">{event.title}</h5>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEditModal(event)}
                        className="text-gray-300 transition hover:text-[#8c6b47]"
                        aria-label="일정 수정"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteEvent(event.id)}
                        className="text-gray-300 transition hover:text-[#8D7558]"
                        aria-label="일정 삭제"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {authorMeta && event.authorUsername ? (
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                        style={{
                          backgroundColor: `${profileTone.bg}24`,
                          color: profileTone.bg,
                        }}
                      >
                        {authorMeta.emoji} {authorMeta.displayName}
                      </span>
                    ) : null}

                    {taggedProfiles.map((taggedProfile) => (
                      <span
                        key={`${event.id}-${taggedProfile}`}
                        className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                        style={{
                          backgroundColor: `${CALENDAR_EVENT_TONES[taggedProfile].bg}22`,
                          color: CALENDAR_EVENT_TONES[taggedProfile].bg,
                        }}
                      >
                        {PROFILE_META[taggedProfile].emoji}{' '}
                        {PROFILE_META[taggedProfile].displayName} 태그
                      </span>
                    ))}

                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                      style={{
                        backgroundColor: importanceColor.bg,
                        color: importanceColor.text,
                      }}
                    >
                      {importanceColor.label}
                    </span>
                  </div>

                  <p className="mt-3 text-sm text-[#7f6a52]">{event.memo || '메모 없음'}</p>
                </div>
              );
            })
          ) : (
            <div className="flex min-h-[140px] items-center justify-center rounded-[22px] border-2 border-dashed border-[#f0e3d0] bg-[#fffaf4] px-4 text-center text-sm text-[#a0896d]">
              일정이 없습니다.
            </div>
          )}
        </div>
      </div>
    );
  }

  const calendarDays = useMemo(() => {
    const days = [];
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const startDay = firstDayOfMonth(year, month);
    const currentMonthDays = daysInMonth(year, month);
    const selectedDateKey = formatYMD(selectedDate);
    const todayKey = formatYMD(new Date());
    const visibleCellCount = Math.max(35, Math.ceil((startDay + currentMonthDays) / 7) * 7);
    const visibleDates = Array.from({ length: visibleCellCount }, (_, index) =>
      formatYMD(new Date(year, month, 1 - startDay + index)),
    );
    const visibleStart = visibleDates[0];
    const visibleEnd = visibleDates[visibleDates.length - 1];
    const eventLanes = new Map<number, number>();
    const laneEnds: string[] = [];

    events
      .filter((event) => doesEventIntersectDateRange(event, visibleStart, visibleEnd))
      .sort((left, right) => {
        const leftEndDate = normalizeEventEndDate(left.date, left.endDate);
        const rightEndDate = normalizeEventEndDate(right.date, right.endDate);
        const leftIsMultiDay = leftEndDate > left.date;
        const rightIsMultiDay = rightEndDate > right.date;

        return (
          left.date.localeCompare(right.date) ||
          Number(!leftIsMultiDay) - Number(!rightIsMultiDay) ||
          rightEndDate.localeCompare(leftEndDate) ||
          left.time.localeCompare(right.time)
        );
      })
      .forEach((event) => {
        const endDate = normalizeEventEndDate(event.date, event.endDate);
        const laneIndex = laneEnds.findIndex((laneEnd) => laneEnd < event.date);
        const nextLaneIndex = laneIndex >= 0 ? laneIndex : laneEnds.length;

        eventLanes.set(event.id, nextLaneIndex);
        laneEnds[nextLaneIndex] = endDate;
      });

    for (let index = 0; index < visibleCellCount; index += 1) {
      const dateObject = new Date(year, month, 1 - startDay + index);
      const dateKey = formatYMD(dateObject);
      const day = dateObject.getDate();
      const isCurrentMonth = dateObject.getMonth() === month;
      const isSelected = dateKey === selectedDateKey;
      const isToday = dateKey === todayKey;
      const dateEvents = events
        .filter((event) => isDateInEventRange(event, dateKey))
        .sort(
          (left, right) =>
            Math.min(eventLanes.get(left.id) ?? 99, 3) -
              Math.min(eventLanes.get(right.id) ?? 99, 3) ||
            left.time.localeCompare(right.time),
        );

      days.push(
        <button
          key={dateKey}
          onClick={() => setSelectedDate(dateObject)}
          className={`min-h-[124px] px-1.5 py-2 text-left transition ${
            isSelected
              ? 'bg-[#F4F2FF] shadow-[inset_0_0_0_1px_rgba(165,148,249,0.2)]'
              : 'hover:bg-[#fffaf4]'
          } ${index >= 7 ? 'border-t border-[#f3eadf]' : ''} ${
            index % 7 === 0 ? '' : 'border-l border-[#f7efe5]'
          } ${!isCurrentMonth ? 'text-gray-300' : 'text-[#2f2417]'}`}
        >
          <div className="flex items-center justify-center">
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-black ${
                isSelected
                  ? 'bg-[#A594F9] text-white'
                  : isToday
                    ? 'bg-[#2f2417] text-white'
                    : isCurrentMonth
                      ? 'text-[#2f2417]'
                      : 'text-gray-300'
              }`}
            >
              {day}
            </span>
          </div>

          <div className="mt-2 grid grid-rows-[repeat(4,28px)] gap-1">
            {Array.from({ length: 4 }, (_, lane) => {
              const event = dateEvents.find(
                (item) => Math.min(eventLanes.get(item.id) ?? 0, 3) === lane,
              );

              if (!event) {
                return <span key={`empty-lane-${dateKey}-${lane}`} className="block h-[28px]" />;
              }

              const tone = getCalendarEventTone(event);
              const shouldKeepSingleLine = event.title.trim().length <= 6;
              const title = shouldKeepSingleLine ? event.title.trim() : truncateMiddle(event.title);
              const segment = getCalendarRangeSegment(event, dateKey);
              const segmentClass =
                segment === 'single'
                  ? '-mx-1.5 rounded-[4px]'
                  : segment === 'start'
                    ? '-ml-1.5 -mr-1.5 rounded-l-[4px] rounded-r-none pr-2'
                    : segment === 'end'
                      ? '-ml-1.5 -mr-1.5 rounded-l-none rounded-r-[4px] pl-2'
                      : '-mx-1.5 rounded-none';

              return (
                <span
                  key={event.id}
                  className={`relative z-10 flex h-[28px] items-center justify-center overflow-hidden px-0.5 py-1 text-center text-[9.5px] font-black leading-[1.05] shadow-sm ${segmentClass}`}
                  style={{
                    backgroundColor: tone.bg,
                    color: tone.text,
                  }}
                  title={event.title}
                >
                  <span
                    className={`w-full overflow-hidden ${
                      shouldKeepSingleLine ? 'px-0 text-[8px]' : 'px-1.5'
                    }`}
                    style={
                      shouldKeepSingleLine
                        ? {
                            textOverflow: 'clip',
                            whiteSpace: 'nowrap',
                          }
                        : {
                            display: '-webkit-box',
                            WebkitBoxOrient: 'vertical',
                            WebkitLineClamp: 2,
                          }
                    }
                  >
                    {title}
                  </span>
                </span>
              );
            })}
          </div>
            {dateEvents.length > 4 ? (
              <span className="mt-1 block truncate rounded-md bg-[#f7f1e8] px-1.5 py-1 text-[9px] font-black leading-none text-[#9d7b52]">
                +{dateEvents.length - 4}개
              </span>
            ) : null}
        </button>,
      );
    }

    return days;
  }, [currentDate, events, selectedDate]);

  if (!isAuthReady) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5efe6] px-4 text-gray-900">
        <div className="rounded-[28px] bg-white px-6 py-5 text-sm font-semibold text-[#7b6142] shadow-[0_18px_50px_rgba(44,32,20,0.12)]">
          로그인 상태를 확인하는 중입니다.
        </div>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="min-h-screen bg-[#f5efe6] px-4 py-8 text-gray-900">
        <div className="mx-auto max-w-md overflow-hidden rounded-[32px] bg-white shadow-[0_24px_80px_rgba(44,32,20,0.14)]">
          <div className="bg-[linear-gradient(135deg,#fffaf4_0%,#f6e7cf_100%)] px-6 py-8">
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[#9d7b52]">
              Dating
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#2f2417]">
              우리 일정 로그인
            </h1>
            <p className="mt-2 text-sm leading-6 text-[#6c5840]">
              한 번 로그인하면 이 기기에서는 계속 유지됩니다. 다른 기기에서는 다시 로그인하면 됩니다.
            </p>
          </div>

          <div className="px-6 py-6">
            <div className="mb-5 flex flex-wrap gap-2">
              {accounts.map((account) => (
                <button
                  key={account.profile}
                  type="button"
                  onClick={() => {
                    setLoginForm((previousForm) => ({
                      ...previousForm,
                      username: account.username,
                    }));
                    setLoginError(null);
                  }}
                  className="rounded-full border border-[#e8dac6] bg-[#fff8ef] px-3 py-1.5 text-xs font-semibold text-[#7c6142]"
                >
                  {PROFILE_META[account.profile].emoji} {PROFILE_META[account.profile].displayName}
                </button>
              ))}
            </div>

            <form className="space-y-4" onSubmit={handleLogin}>
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[#9d7b52]">
                  ID
                </span>
                <input
                  type="text"
                  value={loginForm.username}
                  onChange={(event) =>
                    setLoginForm((previousForm) => ({
                      ...previousForm,
                      username: event.target.value,
                    }))
                  }
                  className="w-full rounded-2xl border border-[#eadcc9] bg-[#fffdf9] px-4 py-3 outline-none transition focus:border-[#c8a47a]"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[#9d7b52]">
                  Password
                </span>
                <input
                  type="password"
                  value={loginForm.password}
                  onChange={(event) =>
                    setLoginForm((previousForm) => ({
                      ...previousForm,
                      password: event.target.value,
                    }))
                  }
                  className="w-full rounded-2xl border border-[#eadcc9] bg-[#fffdf9] px-4 py-3 outline-none transition focus:border-[#c8a47a]"
                />
              </label>

              {loginError ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                  {loginError}
                </div>
              ) : null}

              {!isSupabaseConfigured ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                  Supabase URL과 publishable key를 확인해 주세요.
                </div>
              ) : null}

              <button
                type="submit"
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#2f2417] px-4 py-3 font-semibold text-white"
              >
                <LockKeyhole size={16} />
                로그인
              </button>
            </form>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f5efe6] px-4 py-6 text-gray-900">
      <div className="mx-auto flex min-h-[820px] max-w-md flex-col overflow-hidden rounded-[32px] bg-white shadow-[0_24px_80px_rgba(44,32,20,0.14)]">
        <div className="flex items-center justify-between gap-3 border-b border-[#f1e6d8] px-4 py-5">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-[#9d7b52]">
              Dear Days
            </p>
            <h1 className="mt-1 truncate text-lg font-semibold tracking-tight text-[#2f2417]">
              우리 데이트 캘린더
            </h1>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <div className="flex shrink-0 items-center gap-1.5 rounded-full bg-[#fff5e8] px-2.5 py-2 text-xs font-semibold text-[#7b6142]">
              <UserRound size={14} />
              <span className="whitespace-nowrap">
                {currentAccount
                  ? PROFILE_META[currentAccount.profile].displayName
                  : session.username}
              </span>
              {currentMannerTemperature != null ? (
                <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-white px-1.5 py-0.5 text-[10px] font-black text-[#7D6DE0] shadow-sm">
                  <Thermometer size={12} />
                  {currentMannerTemperature.toFixed(1)}°
                </span>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => setIsAccountModalOpen(true)}
              className="rounded-full border border-[#f1e6d8] p-2 text-[#7b6142]"
              aria-label="계정 설정"
            >
              <Settings size={18} />
            </button>
          </div>
        </div>

        {activeTab === 'calendar' ? (
          <div className="border-b border-[#f1e6d8] bg-[#FDFBF8] px-4 pb-5 pt-4">
            <div className="mb-3 flex items-end justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#9d7b52]">
                  Love Run
                </p>
                <h2 className="mt-1 text-sm font-black text-[#2f2417]">
                  2026.02.14 시작
                </h2>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[10px] font-bold text-[#918679]">1000일 여정</p>
                <p className="mt-0.5 text-xs font-black text-[#A594F9]">
                  {Math.round(loveProgressPercent)}%
                </p>
              </div>
            </div>

            <div className="relative pb-9 pt-8">
              <div className="absolute left-0 right-0 top-8 h-3 overflow-hidden rounded-full bg-[#F4F1EC]">
                <div
                  className="h-full rounded-full bg-[#A594F9]"
                  style={{ width: `${loveProgressPercent}%` }}
                />
              </div>

              {LOVE_MILESTONE_DAYS.map((day) => {
                const markerPosition = (day / LOVE_GOAL_DAYS) * 100;
                const markerLabelPosition = Math.min(98, Math.max(2, markerPosition));
                const milestoneDate = formatLoveMilestoneDate(getLoveMilestoneDate(day));

                return (
                  <div
                    key={day}
                    className="absolute top-7 flex w-10 -translate-x-1/2 flex-col items-center"
                    style={{ left: `${markerLabelPosition}%` }}
                  >
                    <span className="h-5 w-px bg-[#ded6c9]" />
                    <span className="mt-1 whitespace-nowrap text-[8px] font-black leading-none text-[#b3a696]">
                      {day}일
                    </span>
                    <span className="mt-0.5 whitespace-nowrap text-[7px] font-bold leading-none text-[#c1b5a7]">
                      {milestoneDate}
                    </span>
                  </div>
                );
              })}

              <div
                className="absolute top-0 flex -translate-x-1/2 flex-col items-center"
                style={{ left: `${loveRunnerPosition}%` }}
              >
                <div className="rounded-full bg-white px-2 py-0.5 text-[10px] font-black text-[#7D6DE0] shadow-[0_6px_16px_rgba(66,45,18,0.1)]">
                  +{loveDayCount}일
                </div>
                <div className="mt-1 flex h-8 items-center justify-center text-2xl leading-none">
                  <span aria-hidden="true">👫</span>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <div className="relative flex-1 overflow-hidden">
          <div className="h-full overflow-y-auto pb-28">
            {isDataLoading ? (
              <div className="border-b border-[#f1e6d8] bg-blue-50 px-6 py-3 text-sm font-semibold text-blue-600">
                Supabase 데이터를 불러오는 중입니다.
              </div>
            ) : null}

            {dataError ? (
              <div className="border-b border-red-100 bg-red-50 px-6 py-3 text-sm font-semibold text-red-600">
                {dataError}
              </div>
            ) : null}

            {activeTab === 'calendar' ? (
              <>
                <WeatherWidget
                  condition={weatherSummary.condition}
                  errorMessage={weatherError ?? locationError}
                  humidity={weatherSummary.humidity}
                  isLoading={isWeatherLoading}
                  isRefreshingLocation={isRefreshingLocation}
                  locationHelperText={weatherSummary.locationHelperText}
                  locationLabel={weatherSummary.locationLabel}
                  rainChance={weatherSummary.rainChance}
                  temperatureText={weatherSummary.temperatureText}
                  updatedText={weatherSummary.updatedText}
                  wind={weatherSummary.wind}
                  onOpen={() => setIsWeatherPopupOpen(true)}
                  onRefreshLocation={refreshCurrentLocation}
                />

                <section className="border-b border-[#f1e6d8] bg-white px-4 py-4">
                  <div className="mb-3 flex items-center justify-between px-1">
                    <div>
                      <h2 className="text-base font-black text-[#2f2417]">다가오는 일정</h2>
                      <p className="mt-0.5 text-xs font-medium text-[#8d7558]">
                        {currentAccount
                          ? `${PROFILE_META[currentAccount.profile].displayName} 기준 가까운 일정`
                          : '오늘 기준 가까운 일정'}
                      </p>
                    </div>
                    <span className="rounded-full bg-[#F8F5EF] px-2.5 py-1 text-[10px] font-black text-[#918679]">
                      {upcomingEvents.length}개
                    </span>
                  </div>

                  {upcomingEvents.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2">
                      {upcomingEvents.slice(0, 4).map((event) => {
                        const tone = getCalendarEventTone(event);
                        const participants = getEventParticipantProfiles(event);
                        const isShared =
                          participants.includes('boyfriend') && participants.includes('girlfriend');
                        const endDate = normalizeEventEndDate(event.date, event.endDate);
                        const dateText =
                          event.date === endDate
                            ? formatCalendarDateLabel(event.date)
                            : `${formatCalendarDateLabel(event.date)}-${formatCalendarDateLabel(
                                endDate,
                              )}`;
                        const ownerText = isShared
                          ? '공통'
                          : participants[0]
                            ? PROFILE_META[participants[0]].displayName
                            : '일정';

                        return (
                          <button
                            key={`upcoming-${event.id}`}
                            type="button"
                            onClick={() => setSelectedDate(new Date(event.date))}
                            className="min-w-0 rounded-[18px] bg-[#FDFBF8] px-3 py-3 text-left shadow-[0_8px_22px_rgba(66,45,18,0.04)]"
                          >
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <span className="truncate text-[10px] font-black text-[#8d7558]">
                                {dateText}
                              </span>
                              <span
                                className="shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black text-white"
                                style={{ backgroundColor: tone.bg }}
                              >
                                {ownerText}
                              </span>
                            </div>
                            <p className="truncate text-sm font-black text-[#2f2417]">
                              {event.title}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-[18px] bg-[#F8F5EF] px-4 py-4 text-center text-xs font-bold text-[#918679]">
                      예정된 일정이 없습니다.
                    </div>
                  )}
                </section>

                <div className="px-4 pb-10 pt-4">
                  <div className="mb-6 flex items-end justify-between px-2">
                    <div>
                      <h2 className="text-2xl font-bold text-[#2f2417]">
                        {currentDate.getFullYear()}년 {currentDate.getMonth() + 1}월
                      </h2>
                      <p className="mt-1 text-sm text-[#8d7558]">이번 달 일정 {monthEvents.length}개</p>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() =>
                          setCurrentDate(
                            new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1),
                          )
                        }
                        className="rounded-full p-2 hover:bg-[#fff5e8]"
                        aria-label="이전 달"
                      >
                        <ChevronLeft size={20} />
                      </button>
                      <button
                        onClick={() =>
                          setCurrentDate(
                            new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1),
                          )
                        }
                        className="rounded-full p-2 hover:bg-[#fff5e8]"
                        aria-label="다음 달"
                      >
                        <ChevronRight size={20} />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-7 text-center">
                    {['일', '월', '화', '수', '목', '금', '토'].map((day, index) => (
                      <span
                        key={day}
                        className={`mb-2 text-[11px] font-bold ${
                          index === 0
                            ? 'text-red-400'
                            : index === 6
                              ? 'text-blue-400'
                              : 'text-gray-300'
                        }`}
                      >
                        {day}
                      </span>
                    ))}
                  </div>

                  <div className="mb-3 flex flex-wrap gap-2 px-1">
                    {(['boyfriend', 'girlfriend', 'shared'] as const).map((toneKey) => {
                      const tone = CALENDAR_EVENT_TONES[toneKey];

                      return (
                        <span
                          key={toneKey}
                          className="rounded-full px-2.5 py-1 text-[10px] font-black"
                          style={{
                            backgroundColor: tone.bg,
                            color: tone.text,
                          }}
                        >
                          {tone.label}
                        </span>
                      );
                    })}
                  </div>

                  <div className="grid grid-cols-7 overflow-hidden rounded-[22px] border border-[#f1e6d8] bg-white">
                    {calendarDays}
                  </div>

                  <div className="mt-8 px-2">
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-bold text-[#2f2417]">
                          {selectedDate.getMonth() + 1}월 {selectedDate.getDate()}일 일정
                        </h3>
                        <p className="text-sm text-[#8d7558]">선택한 날짜의 계획을 정리해 두세요.</p>
                      </div>
                      <button
                        type="button"
                        onClick={openAddModal}
                        className="flex items-center gap-1 rounded-full bg-[#F0EDFF] px-3 py-1.5 text-xs font-bold text-[#7D6DE0]"
                      >
                        <Plus size={14} />
                        추가
                      </button>
                    </div>

                    <div className="grid h-[320px] grid-cols-2 gap-4 overflow-hidden">
                      <div className="min-h-0 pr-3">
                        {renderScheduleColumn('boyfriend', boyfriendEvents)}
                      </div>
                      <div className="min-h-0 border-l border-[#efe1cf] pl-3">
                        {renderScheduleColumn('girlfriend', girlfriendEvents)}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : activeTab === 'manner' ? (
              <div className="px-6 pb-10 pt-8">
                <div className="mb-6 flex items-end justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#9d7b52]">
                      Love Temperature
                    </p>
                    <h2 className="mt-1 text-2xl font-bold text-[#2f2417]">러브온도</h2>
                    <p className="mt-2 text-sm leading-6 text-[#8d7558]">
                      서로에게 남긴 따뜻한 칭찬을 모아둡니다.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={openMannerReviewModal}
                    className="flex shrink-0 items-center gap-1 rounded-full bg-[#F0EDFF] px-3 py-1.5 text-xs font-bold text-[#7D6DE0]"
                  >
                    <Heart size={14} fill="currentColor" />
                    칭찬
                  </button>
                </div>

                {currentAccount && currentPartnerProfile ? (
                  <div className="mb-5 rounded-[24px] bg-[#F8F5EF] px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold text-[#9d7b52]">현재 로그인</p>
                        <p className="mt-1 text-sm font-bold text-[#2f2417]">
                          {PROFILE_META[currentAccount.profile].emoji}{' '}
                          {PROFILE_META[currentAccount.profile].displayName}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-[#9d7b52]">칭찬 대상</p>
                        <p className="mt-1 text-sm font-bold text-[#2f2417]">
                          {PROFILE_META[currentPartnerProfile].emoji}{' '}
                          {PROFILE_META[currentPartnerProfile].displayName}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : null}

                <div className="space-y-4">
                  {(['boyfriend', 'girlfriend'] as AccountProfile[]).map((profile) =>
                    renderMannerProfile(profile),
                  )}
                </div>
              </div>
            ) : (
              <div className="px-6 pb-10 pt-8">
                <div className="mb-8 flex items-end justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-[#2f2417]">버킷리스트</h2>
                    <p className="mt-2 text-sm text-[#8d7558]">함께하고 싶은 모든 것</p>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-black text-[#A594F9]">{bucketStats.percentage}%</span>
                    <p className="text-[10px] font-bold text-gray-400">
                      ({bucketStats.completed}/{bucketStats.total}) 완료됨
                    </p>
                  </div>
                </div>

                <div className="mb-5 h-3 w-full overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full bg-[#A594F9] transition-[width]"
                    style={{ width: `${bucketStats.percentage}%` }}
                  />
                </div>

                <div className="mb-6 flex flex-wrap gap-2">
                  {(['all', 'pending', 'ready', 'completed'] as BucketFilter[]).map((filter) => (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setBucketFilter(filter)}
                      className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                        bucketFilter === filter
                          ? 'bg-[#F0EDFF] text-[#7D6DE0]'
                          : 'bg-[#F8F5EF] text-[#9A8F82]'
                      }`}
                    >
                      {BUCKET_FILTER_LABELS[filter]}
                    </button>
                  ))}
                </div>

                <div className="space-y-3">
                  {filteredBucketList.length > 0 ? (
                    filteredBucketList.map((item) => (
                      <div
                        key={item.id}
                        className={`flex items-center justify-between gap-3 rounded-[24px] p-4 transition ${
                          item.status === 'completed'
                            ? 'bg-[#FBF7F7]'
                            : 'bg-[#FDFBF8] shadow-sm'
                        }`}
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <button
                            type="button"
                            onClick={() => toggleBucketStatus(item.id)}
                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-colors ${
                              item.status === 'completed'
                                ? 'bg-[#FBEFEF] text-[#D48787]'
                                : item.status === 'ready'
                                  ? 'bg-[#EEF4FB] text-[#6F99C7]'
                                  : 'bg-[#F4F1EC] text-[#918679]'
                            }`}
                          >
                            {item.status === 'completed' ? <Check size={14} strokeWidth={3} /> : null}
                            {item.status === 'ready' ? <Clock size={14} strokeWidth={3} /> : null}
                          </button>
                          <span
                            className={`font-medium ${
                              item.status === 'completed'
                                ? 'text-gray-400 line-through'
                                : 'text-gray-700'
                            } truncate`}
                          >
                            {item.text}
                          </span>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span
                            className="rounded-full px-2.5 py-1 text-[10px] font-bold"
                            style={{
                              backgroundColor: BUCKET_STATUS_TONES[item.status].bg,
                              color: BUCKET_STATUS_TONES[item.status].text,
                            }}
                          >
                            {BUCKET_STATUS_TONES[item.status].label}
                          </span>
                          <button
                            type="button"
                            onClick={() => openEditBucketModal(item)}
                            className="p-1 text-[#B8AEA5] transition hover:text-[#7F766E]"
                            aria-label="버킷리스트 수정"
                            title="수정"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteBucketItem(item.id)}
                            className="p-1 text-[#B8AEA5] transition hover:text-[#7F766E]"
                            aria-label="버킷리스트 삭제"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-[24px] border-2 border-dashed border-[#f0e3d0] bg-[#fffaf4] py-10 text-center text-sm text-[#a0896d]">
                      선택한 상태의 버킷리스트가 없습니다.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {activeTab !== 'manner' ? (
            <button
              type="button"
              onClick={activeTab === 'calendar' ? openAddModal : openBucketModal}
              className="absolute bottom-[5.75rem] left-1/2 z-20 flex h-14 w-14 -translate-x-1/2 items-center justify-center rounded-2xl bg-[#A594F9] text-white shadow-[0_16px_32px_rgba(165,148,249,0.3)]"
              aria-label={activeTab === 'calendar' ? '일정 추가' : '버킷리스트 추가'}
            >
              <Plus size={26} />
            </button>
          ) : null}

          <div className="absolute bottom-0 left-0 right-0 grid h-20 grid-cols-3 items-center border-t border-gray-100 bg-white/90 px-6 pb-4 backdrop-blur-lg">
            <button
              type="button"
              onClick={() => setActiveTab('calendar')}
              className={`flex flex-col items-center gap-1 ${
                activeTab === 'calendar' ? 'text-[#A594F9]' : 'text-gray-300'
              }`}
            >
              <CalendarIcon size={24} />
              <span className="text-[10px] font-bold">캘린더</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('manner')}
              className={`flex flex-col items-center gap-1 ${
                activeTab === 'manner' ? 'text-[#A594F9]' : 'text-gray-300'
              }`}
            >
              <Thermometer size={24} />
              <span className="text-[10px] font-bold">온도</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('bucket')}
              className={`flex flex-col items-center gap-1 ${
                activeTab === 'bucket' ? 'text-[#A594F9]' : 'text-gray-300'
              }`}
            >
              <CheckCircle2 size={24} />
              <span className="text-[10px] font-bold">버킷리스트</span>
            </button>
          </div>

          <GoogleWeatherPopup
            coordsLabel={location.coordsLabel}
            errorMessage={weatherError}
            isLoading={isWeatherLoading}
            isOpen={isWeatherPopupOpen}
            locationLabel={location.label}
            onClose={() => setIsWeatherPopupOpen(false)}
            weatherData={weatherData}
          />

          {isAddModalOpen ? (
            <div className="absolute inset-0 z-40 flex items-end justify-center bg-black/20 backdrop-blur-sm">
              <div className="w-full rounded-t-[32px] bg-white p-8">
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-[#2f2417]">
                      {selectedDate.getMonth() + 1}월 {selectedDate.getDate()}일{' '}
                      {editingEventId != null ? '일정 수정' : '일정 추가'}
                    </h3>
                    {currentAccount ? (
                      <p className="mt-1 text-sm text-[#8d7558]">
                        작성자: {PROFILE_META[currentAccount.profile].emoji}{' '}
                        {PROFILE_META[currentAccount.profile].displayName}
                      </p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={closeEventModal}
                    className="rounded-full bg-gray-100 p-2"
                    aria-label="닫기"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="space-y-4">
                  <input
                    type="text"
                    placeholder="일정 제목"
                    value={newEvent.title}
                    onChange={(event) =>
                      setNewEvent((previousEvent) => ({
                        ...previousEvent,
                        title: event.target.value,
                      }))
                    }
                    className="w-full rounded-2xl bg-gray-50 px-4 py-4 outline-none"
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.18em] text-[#9d7b52]">
                        시간
                      </span>
                      <input
                        type="time"
                        value={newEvent.time}
                        onChange={(event) =>
                          setNewEvent((previousEvent) => ({
                            ...previousEvent,
                            time: event.target.value,
                          }))
                        }
                        className="w-full rounded-2xl bg-gray-50 px-4 py-4 outline-none"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.18em] text-[#9d7b52]">
                        종료일
                      </span>
                      <input
                        type="date"
                        min={eventModalStartDate}
                        value={newEvent.endDate || eventModalStartDate}
                        onChange={(event) =>
                          setNewEvent((previousEvent) => ({
                            ...previousEvent,
                            endDate: event.target.value,
                          }))
                        }
                        className="w-full rounded-2xl bg-gray-50 px-3 py-4 text-sm outline-none"
                      />
                    </label>
                    <select
                      value={newEvent.importance}
                      onChange={(event) =>
                        setNewEvent((previousEvent) => ({
                          ...previousEvent,
                          importance: Number(event.target.value) as CalendarEvent['importance'],
                        }))
                      }
                      className="col-span-2 rounded-2xl bg-gray-50 px-4 py-4 outline-none"
                    >
                      <option value={1}>매우 중요</option>
                      <option value={2}>중요</option>
                      <option value={3}>보통</option>
                    </select>
                  </div>

                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#9d7b52]">
                      태그
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {(['boyfriend', 'girlfriend'] as AccountProfile[]).map((profile) => {
                        const isSelected = newEvent.participantProfiles.includes(profile);

                        return (
                          <button
                            key={profile}
                            type="button"
                            onClick={() => toggleEventParticipant(profile)}
                            className={`rounded-full px-3 py-2 text-xs font-bold transition ${
                              isSelected
                                ? 'bg-[#A594F9] text-white'
                                : 'bg-[#fff5e8] text-[#7b6142]'
                            }`}
                          >
                            {PROFILE_META[profile].emoji} {PROFILE_META[profile].displayName}
                          </button>
                        );
                      })}
                    </div>
                    <p className="mt-2 text-xs text-[#8d7558]">
                      같이 보는 일정이면 두 사람 모두 태그하세요.
                    </p>
                  </div>

                  <textarea
                    placeholder="메모"
                    value={newEvent.memo}
                    onChange={(event) =>
                      setNewEvent((previousEvent) => ({
                        ...previousEvent,
                        memo: event.target.value,
                      }))
                    }
                    className="min-h-[110px] w-full rounded-2xl bg-gray-50 px-4 py-4 outline-none"
                  />

                  <button
                    type="button"
                    onClick={addEvent}
                    className="w-full rounded-2xl bg-[#A594F9] py-4 font-bold text-white"
                  >
                    {editingEventId != null ? '수정 완료' : '완료'}
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {isBucketModalOpen ? (
            <div className="absolute inset-0 z-40 flex items-end justify-center bg-black/20 backdrop-blur-sm">
              <form className="w-full rounded-t-[32px] bg-white p-8" onSubmit={addBucketItem}>
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-[#2f2417]">
                      {editingBucketItem ? '버킷리스트 수정' : '버킷리스트 추가'}
                    </h3>
                    <p className="mt-1 text-sm text-[#8d7558]">
                      {editingBucketItem
                        ? '내용과 상태를 다시 정리해 두세요.'
                        : '함께하고 싶은 일을 하나씩 쌓아두세요.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={closeBucketModal}
                    className="rounded-full bg-gray-100 p-2"
                    aria-label="닫기"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="space-y-4">
                  <input
                    type="text"
                    placeholder="예: 겨울 바다 보러 가기"
                    value={bucketDraft.text}
                    onChange={(event) =>
                      setBucketDraft((previousDraft) => ({
                        ...previousDraft,
                        text: event.target.value,
                      }))
                    }
                    className="w-full rounded-2xl bg-gray-50 px-4 py-4 outline-none"
                    autoFocus
                  />

                  <div className="grid grid-cols-3 gap-2">
                    {(['pending', 'ready', 'completed'] as BucketStatus[]).map((status) => (
                      <button
                        key={status}
                        type="button"
                        onClick={() =>
                          setBucketDraft((previousDraft) => ({
                            ...previousDraft,
                            status,
                          }))
                        }
                        className={`rounded-2xl px-3 py-3 text-xs font-black transition ${
                          bucketDraft.status === status
                            ? 'bg-[#F0EDFF] text-[#7D6DE0]'
                            : 'bg-[#F8F5EF] text-[#9A8F82]'
                        }`}
                      >
                        {status === 'completed'
                          ? '완료'
                          : status === 'ready'
                            ? '준비중'
                            : '미완료'}
                      </button>
                    ))}
                  </div>

                  <button
                    type="submit"
                    className="w-full rounded-2xl bg-[#A594F9] py-4 font-bold text-white"
                  >
                    {editingBucketItem ? '수정 완료' : '추가 완료'}
                  </button>
                </div>
              </form>
            </div>
          ) : null}

          {isMannerModalOpen ? (
            <div className="absolute inset-0 z-40 flex items-end justify-center bg-black/20 backdrop-blur-sm">
              <form className="w-full rounded-t-[32px] bg-white p-8" onSubmit={submitMannerReview}>
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-[#2f2417]">
                      {editingMannerReview ? '칭찬 수정하기' : '칭찬 남기기'}
                    </h3>
                    {(editingMannerReview || currentPartnerProfile) ? (
                      <p className="mt-1 text-sm text-[#8d7558]">
                        {
                          PROFILE_META[
                            editingMannerReview?.targetProfile ?? currentPartnerProfile!
                          ].emoji
                        }{' '}
                        {
                          PROFILE_META[
                            editingMannerReview?.targetProfile ?? currentPartnerProfile!
                          ].displayName
                        }에게만 남겨집니다.
                      </p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={closeMannerReviewModal}
                    className="rounded-full bg-gray-100 p-2"
                    aria-label="닫기"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="space-y-4">
                  <label className="block">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[#9d7b52]">
                      칭찬해요
                    </span>
                    <textarea
                      placeholder="고마웠던 점, 예뻤던 말, 칭찬하고 싶은 순간을 적어주세요."
                      value={mannerReviewDraft.strengths}
                      onChange={(event) =>
                        setMannerReviewDraft((previousDraft) => ({
                          ...previousDraft,
                          strengths: event.target.value,
                        }))
                      }
                      className="min-h-[92px] w-full rounded-2xl bg-gray-50 px-4 py-4 outline-none"
                    />
                  </label>

                  {mannerReviewError ? (
                    <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                      {mannerReviewError}
                    </div>
                  ) : null}

                  <button
                    type="submit"
                    className="w-full rounded-2xl bg-[#A594F9] py-4 font-bold text-white"
                  >
                    {editingMannerReview ? '수정 완료' : '칭찬 남기기'}
                  </button>
                </div>
              </form>
            </div>
          ) : null}

          {isAccountModalOpen ? (
            <div className="absolute inset-0 z-40 flex items-start justify-center bg-black/20 px-5 pt-10 backdrop-blur-sm">
              <div className="max-h-[calc(100%-5rem)] w-full overflow-y-auto rounded-[28px] bg-white p-5 shadow-[0_24px_70px_rgba(44,32,20,0.2)]">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-[#2f2417]">계정 설정</h3>
                    <p className="mt-1 text-sm text-[#8d7558]">
                      로그인은 Supabase Auth로 관리됩니다.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsAccountModalOpen(false)}
                    className="rounded-full bg-gray-100 p-2"
                    aria-label="닫기"
                  >
                    <X size={20} />
                  </button>
                </div>

                {currentAccount ? (
                  <div className="rounded-2xl bg-gray-50 px-4 py-3.5">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#9d7b52]">
                      Account
                    </p>
                    <p className="mt-2 font-bold text-[#2f2417]">
                      {PROFILE_META[currentAccount.profile].emoji}{' '}
                      {PROFILE_META[currentAccount.profile].displayName}
                    </p>
                    <p className="mt-1 text-sm text-[#8d7558]">{currentAccount.email}</p>
                  </div>
                ) : null}

                <div className="mt-3 rounded-2xl bg-[#F8F5EF] px-4 py-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#9d7b52]">
                        Push
                      </p>
                      <p className="mt-2 font-bold text-[#2f2417]">푸시 알림</p>
                      <p className="mt-1 text-sm leading-5 text-[#8d7558]">
                        {getPushNotificationStatusText(pushNotificationStatus)}
                      </p>
                    </div>
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-[#A594F9]">
                      <Bell size={18} />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void enablePushNotifications()}
                    disabled={
                      pushNotificationStatus === 'loading' ||
                      pushNotificationStatus === 'unsupported' ||
                      pushNotificationStatus === 'missing-key' ||
                      pushNotificationStatus === 'denied'
                    }
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#A594F9] py-3 text-sm font-bold text-white disabled:bg-[#ded6c9] disabled:text-[#918679]"
                  >
                    <Bell size={15} />
                    {pushNotificationStatus === 'subscribed' ? '알림 다시 연결' : '알림 켜기'}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-[#f0ddd2] py-3.5 font-semibold text-[#9a4d32]"
                >
                  <LogOut size={16} />
                  로그아웃
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}
