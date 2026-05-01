import { type FormEvent, useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  Calendar as CalendarIcon,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  LockKeyhole,
  LogOut,
  MessageCircle,
  Pencil,
  Plus,
  Settings,
  Star,
  Thermometer,
  TrendingUp,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';

import { GoogleWeatherPopup } from './components/GoogleWeatherPopup';
import { WeatherWidget } from './components/WeatherWidget';
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
  importance: 1 | 2 | 3;
  memo: string;
  participantProfiles: AccountProfile[];
  time: string;
  title: string;
}

interface MannerReviewDraft {
  improvements: string;
  rating: MannerRating;
  strengths: string;
}

const LOCATION_STORAGE_KEY = 'dating:location';
const MANNER_BASE_TEMPERATURE = 36.5;
const MANNER_RATING_STEP = 0.35;
const MANNER_IMPROVEMENT_BONUS = 0.4;
const MANNER_MIN_TEMPERATURE = 30;
const MANNER_MAX_TEMPERATURE = 45;

const IMPORTANCE_COLORS: Record<
  CalendarEvent['importance'],
  { bg: string; label: string; text: string }
> = {
  1: { bg: '#FEE2E2', text: '#EF4444', label: '매우 중요' },
  2: { bg: '#FFEDD5', text: '#F97316', label: '중요' },
  3: { bg: '#DBEAFE', text: '#3B82F6', label: '보통' },
};

const PROFILE_META: Record<
  AccountProfile,
  { displayName: string; emoji: string; label: string }
> = {
  boyfriend: { emoji: '👨', label: '남자친구', displayName: '태준씌' },
  girlfriend: { emoji: '👩', label: '여자친구', displayName: '영주씌' },
};

const BUCKET_FILTER_LABELS: Record<BucketFilter, string> = {
  all: '전체',
  pending: '미완료',
  ready: '준비중',
  completed: '완료',
};

const MANNER_STATUS_LABELS: Record<MannerReviewStatus, string> = {
  open: '개선 대기',
  requested: '확인 대기',
  improved: '개선 완료',
};

const MANNER_RATING_LABELS: Record<MannerRating, string> = {
  1: '아쉬웠어요',
  2: '조금 아쉬워요',
  3: '괜찮아요',
  4: '좋았어요',
  5: '최고예요',
};

const DEFAULT_ACCOUNTS: Account[] = [
  {
    username: 'yeongjoo0214',
    email: 'yeongjoo0214@couple.local',
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
  importance: 3,
  memo: '',
  participantProfiles: [],
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

  return accounts.find((account) => account.email.toLowerCase() === email.toLowerCase());
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

  return {
    id: typeof row.id === 'number' ? row.id : index + 1,
    date: typeof row.date === 'string' ? row.date : formatYMD(new Date()),
    time: typeof row.time === 'string' ? row.time : '12:00',
    title: typeof row.title === 'string' ? row.title : '제목 없음',
    importance:
      row.importance === 1 || row.importance === 2 || row.importance === 3
        ? row.importance
        : 3,
    memo: typeof row.memo === 'string' ? row.memo : '',
    authorUsername: typeof row.author_username === 'string' ? row.author_username : undefined,
    authorProfile,
    participantProfiles,
  };
}

function toCalendarEventRow(event: CalendarEvent) {
  return {
    id: event.id,
    date: event.date,
    time: event.time,
    title: event.title,
    importance: event.importance,
    memo: event.memo,
    author_username: event.authorUsername ?? null,
    author_profile: event.authorProfile ?? null,
    participant_profiles: getEventParticipantProfiles(event),
  };
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

function getRatingTemperatureDelta(rating: MannerRating) {
  return (rating - 3) * MANNER_RATING_STEP;
}

function clampTemperature(value: number) {
  return Math.min(MANNER_MAX_TEMPERATURE, Math.max(MANNER_MIN_TEMPERATURE, value));
}

function calculateMannerTemperature(profile: AccountProfile, reviews: MannerReview[]) {
  const rawTemperature = reviews
    .filter((review) => review.targetProfile === profile)
    .reduce((temperature, review) => {
      const improvementBonus = review.status === 'improved' ? MANNER_IMPROVEMENT_BONUS : 0;
      return temperature + getRatingTemperatureDelta(review.rating) + improvementBonus;
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

function renderRatingStars(rating: MannerRating, size = 13) {
  return (
    <span className="flex items-center gap-0.5" aria-label={`${rating}점`}>
      {([1, 2, 3, 4, 5] as MannerRating[]).map((starRating) => (
        <Star
          key={starRating}
          size={size}
          className={starRating <= rating ? 'text-amber-400' : 'text-gray-200'}
          fill={starRating <= rating ? 'currentColor' : 'none'}
        />
      ))}
    </span>
  );
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
  const [mannerReviewDraft, setMannerReviewDraft] = useState<MannerReviewDraft>(
    EMPTY_MANNER_REVIEW_DRAFT,
  );
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isMannerModalOpen, setIsMannerModalOpen] = useState(false);
  const [isWeatherPopupOpen, setIsWeatherPopupOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState<number | null>(null);
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
      setIsMannerModalOpen(false);
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
    return events
      .filter((event) => event.date === formatYMD(selectedDate))
      .sort((left, right) => left.time.localeCompare(right.time));
  }, [events, selectedDate]);

  const monthEvents = useMemo(() => {
    const monthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(
      2,
      '0',
    )}`;

    return events.filter((event) => event.date.startsWith(monthKey));
  }, [currentDate, events]);

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

  useEffect(() => {
    if (!session || !currentAccount) {
      return;
    }

    void loadRemoteData();
  }, [currentAccount, session]);

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
      const { error } = await client
        .from('calendar_events')
        .upsert(defaultEvents.map(toCalendarEventRow));

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

  function openMannerReviewModal() {
    if (!currentAccount) {
      return;
    }

    setMannerReviewDraft(EMPTY_MANNER_REVIEW_DRAFT);
    setMannerReviewError(null);
    setIsMannerModalOpen(true);
  }

  function closeMannerReviewModal() {
    setIsMannerModalOpen(false);
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
    const improvements = mannerReviewDraft.improvements.trim();

    if (!strengths || !improvements) {
      setMannerReviewError('장점과 개선할 점을 모두 입력해 주세요.');
      return;
    }

    if (targetProfile === currentAccount.profile) {
      setMannerReviewError('자기 자신에게는 매너온도를 남길 수 없습니다.');
      return;
    }

    const nextReview: MannerReview = {
      id: Date.now(),
      authorProfile: currentAccount.profile,
      targetProfile,
      rating: mannerReviewDraft.rating,
      strengths,
      improvements,
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

    const { error } = await supabase.auth.signInWithPassword({
      email: matchedAccount.email,
      password,
    });

    if (error) {
      setLoginError('아이디 또는 비밀번호가 맞지 않습니다.');
      return;
    }

    setLoginError(null);
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
        importance: newEvent.importance,
        memo: newEvent.memo.trim(),
        participantProfiles,
      };
      const { error } = await client.from('calendar_events').upsert(toCalendarEventRow(nextEvent));

      if (error) {
        setDataError(getRemoteErrorMessage(error));
        return;
      }

      setEvents((previousEvents) =>
        previousEvents.map((event) => (event.id === editingEventId ? nextEvent : event)),
      );
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
      title: newEvent.title.trim(),
      memo: newEvent.memo.trim(),
      authorUsername: currentAccount?.username ?? session.username,
      authorProfile: currentAccount?.profile,
      participantProfiles,
    };

    const { error } = await client.from('calendar_events').insert(toCalendarEventRow(nextEvent));

    if (error) {
      setDataError(getRemoteErrorMessage(error));
      return;
    }

    setEvents((previousEvents) => [...previousEvents, nextEvent]);
    closeEventModal();
  }

  async function deleteEvent(eventId: number) {
    const client = getRemoteClient();
    if (!client) {
      return;
    }

    const { error } = await client.from('calendar_events').delete().eq('id', eventId);

    if (error) {
      setDataError(getRemoteErrorMessage(error));
      return;
    }

    setEvents((previousEvents) => previousEvents.filter((event) => event.id !== eventId));
  }

  async function requestMannerImprovement(reviewId: number) {
    if (!currentAccount) {
      return;
    }

    const client = getRemoteClient();
    if (!client) {
      return;
    }

    const requestedAt = new Date().toISOString();
    const { error } = await client
      .from('manner_reviews')
      .update({
        status: 'requested',
        improvement_requested_at: requestedAt,
      })
      .eq('id', reviewId)
      .eq('target_profile', currentAccount.profile)
      .eq('status', 'open');

    if (error) {
      setDataError(getRemoteErrorMessage(error));
      return;
    }

    setMannerReviews((previousReviews) =>
      previousReviews.map((review) => {
        if (
          review.id !== reviewId ||
          review.targetProfile !== currentAccount.profile ||
          review.status !== 'open'
        ) {
          return review;
        }

        return {
          ...review,
          status: 'requested',
          improvementRequestedAt: requestedAt,
        };
      }),
    );
  }

  async function confirmMannerImprovement(reviewId: number) {
    if (!currentAccount) {
      return;
    }

    const client = getRemoteClient();
    if (!client) {
      return;
    }

    const confirmedAt = new Date().toISOString();
    const { error } = await client
      .from('manner_reviews')
      .update({
        status: 'improved',
        improvement_confirmed_at: confirmedAt,
      })
      .eq('id', reviewId)
      .eq('author_profile', currentAccount.profile)
      .eq('status', 'requested');

    if (error) {
      setDataError(getRemoteErrorMessage(error));
      return;
    }

    setMannerReviews((previousReviews) =>
      previousReviews.map((review) => {
        if (
          review.id !== reviewId ||
          review.authorProfile !== currentAccount.profile ||
          review.status !== 'requested'
        ) {
          return review;
        }

        return {
          ...review,
          status: 'improved',
          improvementConfirmedAt: confirmedAt,
        };
      }),
    );
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
  }

  function renderMannerProfile(profile: AccountProfile) {
    const profileMeta = PROFILE_META[profile];
    const isCurrentProfile = currentAccount?.profile === profile;
    const profileReviews = mannerReviews
      .filter((review) => review.targetProfile === profile)
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
    const recentReviews = profileReviews.slice(0, 3);
    const temperature = calculateMannerTemperature(profile, mannerReviews);
    const averageRating =
      profileReviews.length === 0
        ? null
        : Number(
            (
              profileReviews.reduce((total, review) => total + review.rating, 0) /
              profileReviews.length
            ).toFixed(1),
          );
    const requestedCount = profileReviews.filter((review) => review.status === 'requested').length;
    const improvedCount = profileReviews.filter((review) => review.status === 'improved').length;
    const temperatureTone =
      temperature >= MANNER_BASE_TEMPERATURE + 1
        ? 'text-rose-500'
        : temperature < MANNER_BASE_TEMPERATURE
          ? 'text-sky-500'
          : 'text-[#2f2417]';

    return (
      <section
        key={profile}
        className={`rounded-[28px] border bg-white p-5 shadow-[0_12px_36px_rgba(66,45,18,0.06)] ${
          isCurrentProfile ? 'border-blue-100' : 'border-[#f2e8da]'
        }`}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fff4e6] text-2xl">
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
                      ? 'bg-blue-50 text-blue-500'
                      : 'bg-[#fff4e6] text-[#8b6a44]'
                  }`}
                >
                  {isCurrentProfile ? '내 프로필' : '상대 프로필'}
                </span>
              </div>
              <p className="mt-1 text-xs text-[#8d7558]">
                {profileMeta.label}에게 남겨진 매너 기록
              </p>
            </div>
          </div>

          <div className="text-right">
            <div className={`flex items-center justify-end gap-1 text-2xl font-black ${temperatureTone}`}>
              <Thermometer size={20} />
              {temperature.toFixed(1)}°C
            </div>
            <p className="mt-1 text-[11px] font-semibold text-gray-400">
              기준 {MANNER_BASE_TEMPERATURE.toFixed(1)}°C
            </p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-2xl bg-[#fff8ef] px-2 py-3">
            <div className="mx-auto mb-1 flex h-7 w-7 items-center justify-center rounded-full bg-white text-amber-500">
              <Star size={14} fill="currentColor" />
            </div>
            <p className="text-[10px] font-bold text-[#9d7b52]">평균 별점</p>
            <p className="mt-1 text-sm font-black text-[#2f2417]">
              {averageRating == null ? '-' : `${averageRating}점`}
            </p>
          </div>
          <div className="rounded-2xl bg-[#fff8ef] px-2 py-3">
            <div className="mx-auto mb-1 flex h-7 w-7 items-center justify-center rounded-full bg-white text-blue-500">
              <MessageCircle size={14} />
            </div>
            <p className="text-[10px] font-bold text-[#9d7b52]">기록</p>
            <p className="mt-1 text-sm font-black text-[#2f2417]">
              {profileReviews.length}개
            </p>
          </div>
          <div className="rounded-2xl bg-[#fff8ef] px-2 py-3">
            <div className="mx-auto mb-1 flex h-7 w-7 items-center justify-center rounded-full bg-white text-emerald-500">
              <TrendingUp size={14} />
            </div>
            <p className="text-[10px] font-bold text-[#9d7b52]">개선 완료</p>
            <p className="mt-1 text-sm font-black text-[#2f2417]">
              {improvedCount}개
            </p>
          </div>
        </div>

        {!isCurrentProfile ? (
          <button
            type="button"
            onClick={openMannerReviewModal}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#2f2417] px-4 py-3 text-sm font-bold text-white"
          >
            <Star size={15} fill="currentColor" />
            {profileMeta.displayName} 매너온도 남기기
          </button>
        ) : requestedCount > 0 ? (
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-700">
            상대방 확인을 기다리는 개선 요청이 {requestedCount}개 있습니다.
          </div>
        ) : null}

        <div className="mt-5">
          <div className="mb-1 flex items-center justify-between">
            <h4 className="text-sm font-bold text-[#2f2417]">프로필 디테일</h4>
            <span className="text-[10px] font-bold text-gray-400">최근 3개</span>
          </div>

          {recentReviews.length > 0 ? (
            <div>
              {recentReviews.map((review) => {
                const authorMeta = PROFILE_META[review.authorProfile];
                const reviewDelta =
                  getRatingTemperatureDelta(review.rating) +
                  (review.status === 'improved' ? MANNER_IMPROVEMENT_BONUS : 0);
                const canRequestImprovement =
                  currentAccount?.profile === review.targetProfile && review.status === 'open';
                const canConfirmImprovement =
                  currentAccount?.profile === review.authorProfile &&
                  review.status === 'requested';

                return (
                  <div
                    key={review.id}
                    className="border-t border-[#f2e8da] py-4 first:border-t-0"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          {renderRatingStars(review.rating)}
                          <span className="text-xs font-bold text-[#2f2417]">
                            {MANNER_RATING_LABELS[review.rating]}
                          </span>
                          <span className="text-[10px] font-bold text-gray-400">
                            {formatReviewDate(review.createdAt)}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] font-semibold text-[#8d7558]">
                          {authorMeta.emoji} {authorMeta.displayName}가 남김
                        </p>
                      </div>
                      <div className="text-right">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                            reviewDelta >= 0
                              ? 'bg-rose-50 text-rose-500'
                              : 'bg-sky-50 text-sky-500'
                          }`}
                        >
                          {formatSignedTemperatureDelta(reviewDelta)}
                        </span>
                        <div className="mt-1 text-[10px] font-bold text-gray-400">
                          {MANNER_STATUS_LABELS[review.status]}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 space-y-2 text-sm leading-6">
                      <p className="text-[#6f5b43]">
                        <span className="mr-2 font-bold text-emerald-600">장점</span>
                        {review.strengths}
                      </p>
                      <p className="text-[#6f5b43]">
                        <span className="mr-2 font-bold text-orange-500">개선점</span>
                        {review.improvements}
                      </p>
                    </div>

                    {review.status === 'improved' ? (
                      <div className="mt-3 flex items-center gap-1.5 text-xs font-bold text-emerald-600">
                        <BadgeCheck size={14} />
                        개선 확인 완료 · {MANNER_IMPROVEMENT_BONUS.toFixed(1)}°C 반영
                      </div>
                    ) : null}

                    {canRequestImprovement ? (
                      <button
                        type="button"
                        onClick={() => requestMannerImprovement(review.id)}
                        className="mt-3 rounded-full border border-[#eadcc9] px-3 py-1.5 text-xs font-bold text-[#7b6142]"
                      >
                        개선 완료 요청
                      </button>
                    ) : null}

                    {canConfirmImprovement ? (
                      <button
                        type="button"
                        onClick={() => confirmMannerImprovement(review.id)}
                        className="mt-3 rounded-full bg-emerald-500 px-3 py-1.5 text-xs font-bold text-white"
                      >
                        개선 확인하고 온도 올리기
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="mt-3 rounded-2xl border-2 border-dashed border-[#f0e3d0] bg-[#fffaf4] py-8 text-center text-sm text-[#a0896d]">
              아직 남겨진 매너 기록이 없습니다.
            </div>
          )}
        </div>
      </section>
    );
  }

  function renderScheduleColumn(profile: AccountProfile, profileEvents: CalendarEvent[]) {
    const profileMeta = PROFILE_META[profile];

    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex shrink-0 items-center gap-2 pb-3">
          <span className="text-lg">{profileMeta.emoji}</span>
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
                  className="rounded-[22px] border border-[#f2e8da] bg-white p-4 shadow-[0_10px_30px_rgba(66,45,18,0.05)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-bold text-blue-500">{event.time}</p>
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
                        className="text-gray-300 transition hover:text-red-400"
                        aria-label="일정 삭제"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {authorMeta && event.authorUsername ? (
                      <span className="rounded-full bg-[#fff4e6] px-2 py-0.5 text-[10px] font-bold text-[#7c6142]">
                        {authorMeta.emoji} {authorMeta.displayName}
                      </span>
                    ) : null}

                    {taggedProfiles.map((taggedProfile) => (
                      <span
                        key={`${event.id}-${taggedProfile}`}
                        className="rounded-full bg-[#eef6ff] px-2 py-0.5 text-[10px] font-bold text-[#3467a8]"
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

    for (let index = 0; index < startDay; index += 1) {
      days.push(<div key={`empty-${index}`} />);
    }

    for (let day = 1; day <= daysInMonth(year, month); day += 1) {
      const dateObject = new Date(year, month, day);
      const dateKey = formatYMD(dateObject);
      const isSelected = dateKey === formatYMD(selectedDate);
      const isToday = dateKey === formatYMD(new Date());
      const hasEvent = events.some((event) => event.date === dateKey);

      days.push(
        <button
          key={dateKey}
          onClick={() => setSelectedDate(dateObject)}
          className={`relative h-12 rounded-2xl transition ${
            isSelected
              ? 'bg-blue-500 text-white shadow-[0_12px_24px_rgba(59,130,246,0.25)]'
              : 'hover:bg-[#fff7ec]'
          } ${isToday && !isSelected ? 'border border-[#f1d8b5]' : ''}`}
        >
          <div className="flex h-full flex-col items-center justify-center">
            <span className="text-sm font-semibold">{day}</span>
            {hasEvent && !isSelected ? (
              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-blue-400" />
            ) : null}
          </div>
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
        <div className="flex items-center justify-between border-b border-[#f1e6d8] px-6 py-5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-[#9d7b52]">
              Dear Days
            </p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight text-[#2f2417]">
              우리 데이트 캘린더
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-full bg-[#fff5e8] px-3 py-2 text-xs font-semibold text-[#7b6142]">
              <UserRound size={14} />
              <span>
                {currentAccount
                  ? PROFILE_META[currentAccount.profile].displayName
                  : session.username}
              </span>
              {currentMannerTemperature != null ? (
                <span className="flex items-center gap-0.5 rounded-full bg-white px-2 py-0.5 text-[11px] font-black text-blue-500 shadow-sm">
                  <Thermometer size={12} />
                  {currentMannerTemperature.toFixed(1)}°C
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

                  <div className="grid grid-cols-7 gap-y-1">{calendarDays}</div>

                  <div className="mt-10 px-2">
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
                        className="flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-500"
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
                      Manner Temperature
                    </p>
                    <h2 className="mt-1 text-2xl font-bold text-[#2f2417]">매너온도</h2>
                    <p className="mt-2 text-sm leading-6 text-[#8d7558]">
                      상대방에게만 평점과 디테일을 남길 수 있고, 개선 확인이 끝나면 온도가 올라갑니다.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={openMannerReviewModal}
                    className="flex shrink-0 items-center gap-1 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-500"
                  >
                    <Star size={14} fill="currentColor" />
                    평가
                  </button>
                </div>

                {currentAccount && currentPartnerProfile ? (
                  <div className="mb-5 rounded-[24px] border border-[#f2e8da] bg-[#fffaf4] px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold text-[#9d7b52]">현재 로그인</p>
                        <p className="mt-1 text-sm font-bold text-[#2f2417]">
                          {PROFILE_META[currentAccount.profile].emoji}{' '}
                          {PROFILE_META[currentAccount.profile].displayName}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-[#9d7b52]">평가 대상</p>
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
                    <span className="text-2xl font-black text-blue-500">{bucketStats.percentage}%</span>
                    <p className="text-[10px] font-bold text-gray-400">
                      ({bucketStats.completed}/{bucketStats.total}) 완료됨
                    </p>
                  </div>
                </div>

                <div className="mb-5 h-3 w-full overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full bg-blue-500 transition-[width]"
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
                          ? 'bg-blue-500 text-white'
                          : 'bg-[#fff5e8] text-[#7b6142]'
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
                        className={`flex items-center justify-between rounded-[24px] border p-4 transition ${
                          item.status === 'completed'
                            ? 'border-transparent bg-gray-50'
                            : 'border-gray-100 bg-white shadow-sm'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => toggleBucketStatus(item.id)}
                            className={`flex h-6 w-6 items-center justify-center rounded-full transition-colors ${
                              item.status === 'completed'
                                ? 'bg-blue-500 text-white'
                                : item.status === 'ready'
                                  ? 'bg-orange-100 text-orange-500'
                                  : 'border-2 border-gray-200'
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
                            }`}
                          >
                            {item.text}
                          </span>
                        </div>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            item.status === 'completed'
                              ? 'bg-green-100 text-green-600'
                              : item.status === 'ready'
                                ? 'bg-orange-100 text-orange-600'
                                : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {item.status === 'completed'
                            ? '완료'
                            : item.status === 'ready'
                              ? '준비중'
                              : '미완료'}
                        </span>
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
              onClick={openAddModal}
              className="absolute bottom-[5.75rem] left-1/2 z-20 flex h-14 w-14 -translate-x-1/2 items-center justify-center rounded-2xl bg-blue-500 text-white shadow-[0_16px_32px_rgba(59,130,246,0.32)]"
              aria-label="일정 추가"
            >
              <Plus size={26} />
            </button>
          ) : null}

          <div className="absolute bottom-0 left-0 right-0 grid h-20 grid-cols-3 items-center border-t border-gray-100 bg-white/90 px-6 pb-4 backdrop-blur-lg">
            <button
              type="button"
              onClick={() => setActiveTab('calendar')}
              className={`flex flex-col items-center gap-1 ${
                activeTab === 'calendar' ? 'text-blue-500' : 'text-gray-300'
              }`}
            >
              <CalendarIcon size={24} />
              <span className="text-[10px] font-bold">캘린더</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('manner')}
              className={`flex flex-col items-center gap-1 ${
                activeTab === 'manner' ? 'text-blue-500' : 'text-gray-300'
              }`}
            >
              <Thermometer size={24} />
              <span className="text-[10px] font-bold">온도</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('bucket')}
              className={`flex flex-col items-center gap-1 ${
                activeTab === 'bucket' ? 'text-blue-500' : 'text-gray-300'
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

                  <div className="grid grid-cols-2 gap-4">
                    <input
                      type="time"
                      value={newEvent.time}
                      onChange={(event) =>
                        setNewEvent((previousEvent) => ({
                          ...previousEvent,
                          time: event.target.value,
                        }))
                      }
                      className="rounded-2xl bg-gray-50 px-4 py-4 outline-none"
                    />
                    <select
                      value={newEvent.importance}
                      onChange={(event) =>
                        setNewEvent((previousEvent) => ({
                          ...previousEvent,
                          importance: Number(event.target.value) as CalendarEvent['importance'],
                        }))
                      }
                      className="rounded-2xl bg-gray-50 px-4 py-4 outline-none"
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
                                ? 'bg-blue-500 text-white'
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
                    className="w-full rounded-2xl bg-blue-500 py-4 font-bold text-white"
                  >
                    {editingEventId != null ? '수정 완료' : '완료'}
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {isMannerModalOpen ? (
            <div className="absolute inset-0 z-40 flex items-end justify-center bg-black/20 backdrop-blur-sm">
              <form className="w-full rounded-t-[32px] bg-white p-8" onSubmit={submitMannerReview}>
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-[#2f2417]">매너온도 남기기</h3>
                    {currentPartnerProfile ? (
                      <p className="mt-1 text-sm text-[#8d7558]">
                        {PROFILE_META[currentPartnerProfile].emoji}{' '}
                        {PROFILE_META[currentPartnerProfile].displayName}에게만 기록됩니다.
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
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#9d7b52]">
                      Rating
                    </p>
                    <div className="grid grid-cols-5 gap-2">
                      {([1, 2, 3, 4, 5] as MannerRating[]).map((rating) => {
                        const isSelected = mannerReviewDraft.rating === rating;

                        return (
                          <button
                            key={rating}
                            type="button"
                            onClick={() =>
                              setMannerReviewDraft((previousDraft) => ({
                                ...previousDraft,
                                rating,
                              }))
                            }
                            className={`flex h-12 flex-col items-center justify-center rounded-2xl text-xs font-black transition ${
                              isSelected
                                ? 'bg-blue-500 text-white'
                                : 'bg-gray-50 text-gray-400'
                            }`}
                            aria-label={`${rating}점`}
                          >
                            <Star
                              size={15}
                              fill={isSelected ? 'currentColor' : 'none'}
                            />
                            {rating}
                          </button>
                        );
                      })}
                    </div>
                    <p className="mt-2 text-xs font-semibold text-[#8d7558]">
                      {MANNER_RATING_LABELS[mannerReviewDraft.rating]}
                    </p>
                  </div>

                  <label className="block">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[#9d7b52]">
                      장점
                    </span>
                    <textarea
                      placeholder="좋았던 점을 구체적으로 적어주세요."
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

                  <label className="block">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[#9d7b52]">
                      개선점
                    </span>
                    <textarea
                      placeholder="다음에 더 좋아지면 좋을 점을 적어주세요."
                      value={mannerReviewDraft.improvements}
                      onChange={(event) =>
                        setMannerReviewDraft((previousDraft) => ({
                          ...previousDraft,
                          improvements: event.target.value,
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
                    className="w-full rounded-2xl bg-blue-500 py-4 font-bold text-white"
                  >
                    프로필에 남기기
                  </button>
                </div>
              </form>
            </div>
          ) : null}

          {isAccountModalOpen ? (
            <div className="absolute inset-0 z-40 flex items-end justify-center bg-black/20 backdrop-blur-sm">
              <div className="w-full rounded-t-[32px] bg-white p-8">
                <div className="mb-6 flex items-center justify-between">
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
                  <div className="rounded-2xl bg-gray-50 px-4 py-4">
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

                <button
                  type="button"
                  onClick={handleLogout}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-[#f0ddd2] py-4 font-semibold text-[#9a4d32]"
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
