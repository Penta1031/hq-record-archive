"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  BarChart3,
  Archive, Bookmark, CalendarDays, ChevronLeft, ChevronRight, Crown, Flame, Heart,
  ArrowUpDown, ExternalLink, Home, Languages, LockKeyhole, Medal, Pencil, Play, Plus, RefreshCw, Search, Share2, Shuffle, Trash2, Trophy, Video, X
} from "lucide-react";
import { adminService, analyticsService, appTabService, archiveService, keywordService, recommendedVideoService, tweetMediaService, worldcupService } from "../lib/services";
import { ARCHIVE_LANGUAGE_OPTIONS, archiveCategoryLabel, archiveKeywordLabel, archiveText } from "../lib/archive-i18n";

const pad = (n) => String(n).padStart(2, "0");
const formatDate = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const KST_DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});
const getKstDate = (date = new Date()) => {
  const parts = Object.fromEntries(KST_DATE_FORMATTER.formatToParts(date).map(({ type, value }) => [type, value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
};
const kstDateFromValue = (value) => {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isNaN(date.getTime())) return getKstDate(date);
  const dateOnly = String(value || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(dateOnly) ? dateOnly : "";
};
const displayKstDate = (value, fallback = "날짜 없음") => {
  const date = kstDateFromValue(value);
  return date ? date.replace(/-/g, ".") : fallback;
};
function useKstToday() {
  const [date, setDate] = useState("");
  useEffect(() => {
    const sync = () => setDate((current) => {
      const next = getKstDate();
      return current === next ? current : next;
    });
    sync();
    const timer = window.setInterval(sync, 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);
  return date;
}
const cn = (...classes) => classes.filter(Boolean).join(" ");
const MAIN_CATEGORY_ORDER = ["전체", "무대영상", "라이브", "유튜브", "미디어", "SNS", "메시지", "기타"];
const CATEGORY_MAP = {
  "무대영상": ["음악방송", "직캠", "콘서트", "페스티벌", "대학축제", "버스킹", "쇼케이스", "팬미팅", "팬싸인회", "공항/퇴근길", "해외투어", "킹덤"],
  "라이브": ["하루의 마무리", "승협이 라이브", "승구리당당", "우리 얘기 좀 합시다", "개인 라이브", "단체 라이브", "인스타그램 라이브", "기타 라이브"],
  "유튜브": ["뮤직비디오", "메이킹", "비하인드", "레코딩로그", "승캠", "승협이", "합주일지", "커버곡", "스페셜클립", "쇼츠", "엔킷리스트", "버킷리스트", "냉탕과온탕사이"],
  "미디어": ["방송/예능", "뮤직웨이브", "라디오", "인터뷰", "잡지/화보", "웹예능/웹컨텐츠"],
  "SNS": ["공식 트위터", "개인 인스타그램", "공식 인스타그램", "릴스", "틱톡", "공식 카페", "공식 블로그"],
  "메시지": ["버블", "프롬"],
  "기타": ["연말결산", "기타", "백업", "목격담", "모음집"]
};
const SUB_CATEGORY_OPTIONS = Object.values(CATEGORY_MAP).flat();
const mainCategoryFor = (subCategory) => Object.entries(CATEGORY_MAP).find(([, values]) => values.includes(subCategory))?.[0] || "기타";
const parseKeywordText = (value) => String(value || "").split(/[,#]/).map((word) => word.trim()).filter(Boolean);
const uniqueKeywords = (values) => [...new Set((values || []).map((word) => String(word || "").trim()).filter(Boolean))];
const APP_TABS = [
  { key: "home", label: "홈", icon: Home, description: "홈/오늘의 기록/검색" },
  { key: "calendar", label: "캘린더", icon: CalendarDays, description: "날짜별 아카이브" },
  { key: "recommended", label: "추천", icon: Video, description: "추천 영상 탭" },
  { key: "postype", label: "포타", icon: Search, description: "포타 검색기 탭" }
];
const DEFAULT_TAB_VISIBILITY = Object.fromEntries(APP_TABS.map((item) => [item.key, true]));
const normalizeTabVisibility = (rowsOrSettings = []) => {
  const next = { ...DEFAULT_TAB_VISIBILITY };
  if (Array.isArray(rowsOrSettings)) {
    rowsOrSettings.forEach((row) => {
      const key = String(row.tab_key || row.key || "").trim();
      if (key in next) next[key] = row.is_visible !== false;
    });
  } else if (rowsOrSettings && typeof rowsOrSettings === "object") {
    APP_TABS.forEach(({ key }) => { if (key in rowsOrSettings) next[key] = rowsOrSettings[key] !== false; });
  }
  if (!Object.values(next).some(Boolean)) next.home = true;
  return next;
};
const visibleAppTabs = (settings) => APP_TABS.filter(({ key }) => settings[key] !== false);
const POSTYPE_APP_URL = "https://penta1031.github.io/HQ-POSTYPE-SEARCH/";
const POSTYPE_APP_ORIGIN = new URL(POSTYPE_APP_URL).origin;
const TAB_LABELS = { home: "홈", calendar: "캘린더", recommended: "추천", postype: "포타" };
const CONTENT_TYPE_LABELS = { hq_archive: "아카이브", recommended_video: "추천 영상", postype: "포타" };
const trackContentView = (item, { tabKey = "home", contentType = "hq_archive", urlKey = "link", titleKey = "title" } = {}) => {
  analyticsService.track({
    eventType: "content",
    tabKey,
    contentType,
    contentId: String(item?.id || item?.youtubeId || item?.link || item?.youtubeUrl || ""),
    contentTitle: String(item?.[titleKey] || item?.title || item?.name || ""),
    contentUrl: String(item?.[urlKey] || item?.link || item?.youtubeUrl || item?.sourceUrl || "")
  });
};

export default function Page() {
  const [tab, setTab] = useState("home");
  const [tabVisibility, setTabVisibility] = useState(DEFAULT_TAB_VISIBILITY);
  const [archiveLanguage, setArchiveLanguage] = useState("ko");
  const [selectedKeyword, setSelectedKeyword] = useState("");
  const [adminOpen, setAdminOpen] = useState(false);
  const [postypeAdminRequest, setPostypeAdminRequest] = useState(0);
  const [postypeExcerptOpen, setPostypeExcerptOpen] = useState(false);
  const contentRef = useRef(null);
  const visibleTabs = useMemo(() => visibleAppTabs(tabVisibility), [tabVisibility]);
  const navigate = (next, keyword = "") => {
    if (tabVisibility[next] === false) return;
    setTab(next);
    setSelectedKeyword(keyword);
  };
  const scrollContentToTop = () => window.requestAnimationFrame(() => contentRef.current?.scrollTo({ top: 0, left: 0, behavior: "auto" }));
  const openAdmin = () => { setAdminOpen(true); };
  const closeAdmin = () => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    setAdminOpen(false);
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: "auto" }));
  };
  const openPostypeAdmin = (credential = "") => {
    closeAdmin();
    setTab("postype");
    setPostypeAdminRequest({ id: Date.now(), credential });
  };
  useEffect(() => {
    let active = true;
    appTabService.list()
      .then((rows) => { if (active) setTabVisibility(normalizeTabVisibility(rows)); })
      .catch(() => { if (active) setTabVisibility(DEFAULT_TAB_VISIBILITY); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (tab !== "postype") setPostypeExcerptOpen(false);
  }, [tab]);
  useEffect(() => {
    analyticsService.track({ eventType: "tab", tabKey: tab });
  }, [tab]);

  return (
    <main className="min-h-screen bg-neutral-950 md:bg-[#111]">
      <div className="relative mx-auto flex h-[100dvh] w-full max-w-md flex-col overflow-hidden border-x border-white/5 bg-black shadow-2xl">
        <Header onAdmin={openAdmin} showLanguage={tab === "home"} language={archiveLanguage} onLanguage={setArchiveLanguage} />
        <section ref={contentRef} className={cn("min-h-0 flex-1 overscroll-contain no-scrollbar", tab === "postype" ? (postypeExcerptOpen ? "overflow-hidden pb-0" : "overflow-hidden pb-[76px]") : "overflow-y-auto pb-28")}>
          <div key={tab} className={cn("animate-fade-in", tab === "postype" && "h-full")}>
            {tab === "home" && <HomeView language={archiveLanguage} initialKeyword={selectedKeyword} onKeywordConsumed={() => setSelectedKeyword("")} />}
            {tab === "calendar" && <CalendarView />}
            {tab === "recommended" && <RecommendedView onScrollTop={scrollContentToTop} />}
            {tab === "postype" && <PostypeView adminRequest={postypeAdminRequest} onExcerptOpenChange={setPostypeExcerptOpen} />}
          </div>
        </section>
        {!postypeExcerptOpen && <BottomNav tab={tab} onChange={navigate} items={visibleTabs} />}
        {adminOpen && <AdminHub onClose={closeAdmin} onOpenPostype={openPostypeAdmin} tabVisibility={tabVisibility} onTabVisibilityChange={setTabVisibility} />}
      </div>
    </main>
  );
}

function Header({ onAdmin, showLanguage = false, language = "ko", onLanguage }) {
  const [languageOpen, setLanguageOpen] = useState(false);
  useEffect(() => { if (!showLanguage) setLanguageOpen(false); }, [showLanguage]);
  return (
    <header className="relative z-30 flex h-[58px] shrink-0 items-center border-b border-white/10 bg-black/90 px-4 backdrop-blur-xl">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-accent shadow-[0_0_14px_#e50000]" />
        <h1 className="text-[16px] font-black tracking-[-.03em]">HQ ARCHIVE</h1>
      </div>
      <div className="ml-auto flex items-center gap-2">
        {showLanguage && <div className="relative">
          <button onClick={() => setLanguageOpen((open) => !open)} aria-label="아카이브 번역" aria-expanded={languageOpen} className={cn("rounded-xl border p-2 transition", languageOpen ? "border-accent/50 bg-accent/10 text-accent" : "border-white/10 bg-white/5 text-neutral-500")}><Languages size={16}/></button>
          {languageOpen && <div className="absolute right-0 top-11 z-50 flex gap-1 rounded-xl border border-white/10 bg-neutral-950 p-1.5 shadow-2xl">
            {ARCHIVE_LANGUAGE_OPTIONS.map((option) => <button key={option.code} onClick={() => { onLanguage(option.code); setLanguageOpen(false); }} aria-label={option.label} title={option.label} className={cn("flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-[10px] font-black", language === option.code ? "bg-accent text-white" : "bg-white/5 text-neutral-400")}>{option.short}</button>)}
          </div>}
        </div>}
        <button onClick={() => window.location.reload()} aria-label="데이터 새로고침" title="데이터 새로고침" className="rounded-xl border border-white/10 bg-white/5 p-2 text-neutral-500 transition active:text-accent"><RefreshCw size={16}/></button>
        <button onClick={onAdmin} aria-label="관리자 모드" className="rounded-xl border border-white/10 bg-white/5 p-2 text-neutral-500 transition active:text-accent"><LockKeyhole size={16} /></button>
      </div>
    </header>
  );
}

function SearchBar({ value, onChange, placeholder = "제목, 키워드, 날짜로 검색" }) {
  return (
    <label className="flex h-12 items-center gap-3 rounded-2xl border border-white/10 bg-neutral-900 px-4 focus-within:border-accent/70">
      <Search size={17} className="shrink-0 text-neutral-500" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none placeholder:text-neutral-600" />
      {value && <button onClick={() => onChange("")} aria-label="검색어 지우기"><X size={15} className="text-neutral-500" /></button>}
    </label>
  );
}

function HomeView({ language = "ko", initialKeyword, onKeywordConsumed }) {
  const [subTab, setSubTab] = useState("archive");
  const [query, setQuery] = useState(initialKeyword ? `#${initialKeyword}` : "");
  const [requestQuery, setRequestQuery] = useState(initialKeyword ? `#${initialKeyword}` : "");
  const [mainCategory, setMainCategory] = useState("전체");
  const [subCategory, setSubCategory] = useState("전체");
  const [sortOrder, setSortOrder] = useState("desc");
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [keywordData, setKeywordData] = useState({ items: [], tags: [] });
  const [keywordLoading, setKeywordLoading] = useState(false);
  const [keywordLoaded, setKeywordLoaded] = useState(false);
  const [todayItems, setTodayItems] = useState([]);
  const [todayLoading, setTodayLoading] = useState(false);
  const [todayLoadedDate, setTodayLoadedDate] = useState("");
  const [randomItem, setRandomItem] = useState(null);
  const [randomLoading, setRandomLoading] = useState(false);
  const todayDate = useKstToday();
  const t = (key, values) => archiveText(language, key, values);
  const categoryLabel = (value) => archiveCategoryLabel(language, value);
  const mains = MAIN_CATEGORY_ORDER;
  const subs = ["전체", ...(mainCategory === "전체" ? SUB_CATEGORY_OPTIONS : (CATEGORY_MAP[mainCategory] || []))];

  useEffect(() => { const timer = setTimeout(() => setRequestQuery(query), 350); return () => clearTimeout(timer); }, [query]);
  useEffect(() => {
    let active = true;
    setLoading(true); setError(""); setItems([]); setPage(1);
    archiveService.page({ page: 1, limit: 30, query: requestQuery, mainCategory, subCategory, sortOrder })
      .then((result) => { if (!active) return; setItems(result.items); setTotal(result.total); setHasMore(result.hasMore); })
      .catch((reason) => { if (!active) return; setError(reason.message || "기록을 불러오지 못했어요."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [requestQuery, mainCategory, subCategory, sortOrder]);
  useEffect(() => {
    if (subTab !== "keywords" || keywordLoaded || keywordLoading) return;
    setKeywordLoading(true);
    keywordService.list().then(setKeywordData).catch(() => setKeywordData({items:[],tags:[]})).finally(() => { setKeywordLoading(false); setKeywordLoaded(true); });
  }, [subTab, keywordLoaded, keywordLoading]);
  useEffect(() => {
    if (!todayDate || subTab !== "today" || todayLoadedDate === todayDate || todayLoading) return;
    const requestedDate = todayDate;
    setTodayLoading(true);
    archiveService.today({ monthDay: requestedDate.slice(5) }).then((result) => setTodayItems(result.items.filter((item) => item.date !== requestedDate))).catch(() => setTodayItems([])).finally(() => { setTodayLoading(false); setTodayLoadedDate(requestedDate); });
  }, [subTab, todayDate, todayLoadedDate, todayLoading]);
  useEffect(() => { if (initialKeyword) { setQuery(`#${initialKeyword}`); setSubTab("archive"); onKeywordConsumed(); } }, [initialKeyword, onKeywordConsumed]);

  const loadMore = async () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    try { const result = await archiveService.page({ page: page + 1, limit: 30, query: requestQuery, mainCategory, subCategory, sortOrder }); setItems((current) => [...current, ...result.items]); setPage(result.page); setHasMore(result.hasMore); setTotal(result.total); }
    catch (reason) { setError(reason.message || "다음 기록을 불러오지 못했어요."); }
    finally { setLoadingMore(false); }
  };

  const pickRandom = async () => {
    if (!total || randomLoading) return;
    setRandomLoading(true);
    try {
      const result = await archiveService.page({ page: Math.floor(Math.random() * total) + 1, limit: 1, query: requestQuery, mainCategory, subCategory, sortOrder });
      setRandomItem(result.items[0] || null);
    } catch (reason) {
      setError(reason.message || "랜덤 기록을 불러오지 못했어요.");
    } finally {
      setRandomLoading(false);
    }
  };

  const pickKeyword = (tag) => { setQuery(`#${tag}`); setSubTab("archive"); onKeywordConsumed(); };
  return (
    <div>
      <div className="px-4 pt-4"><SearchBar value={query} onChange={setQuery} placeholder={t("searchPlaceholder")} /></div>
      <div className="sticky top-0 z-20 mt-3 border-b border-white/10 bg-black/95 px-4 backdrop-blur-xl">
        <div className="grid grid-cols-3">
          {[["archive", Archive, t("archive")], ["keywords", Heart, t("keywords")], ["today", CalendarDays, t("today")]].map(([key, Icon, label]) => (
            <button key={key} onClick={() => setSubTab(key)} className={cn("relative py-3 text-[13px] font-bold transition", subTab === key ? "text-white" : "text-neutral-600")}>
              <span className="flex items-center justify-center gap-1.5"><Icon size={14}/>{label}</span>{subTab === key && <span className="absolute inset-x-4 bottom-0 h-0.5 rounded-full bg-accent" />}
            </button>
          ))}
        </div>
      </div>
      {subTab === "archive" && <div className="px-4 pt-4">
        <p className="mb-2 text-[10px] font-bold text-neutral-600">{t("categoryHint")}</p>
        <FilterRow values={mains} active={mainCategory} onChange={(v) => { setMainCategory(v); setSubCategory("전체"); }} getLabel={categoryLabel} />
        {mainCategory !== "전체" && <div className="mt-3"><FilterRow values={subs} active={subCategory} onChange={setSubCategory} getLabel={categoryLabel} secondary /></div>}
        <SectionLabel label={t("all")} count={total} unit={t("unit")} sortOrder={sortOrder} sortLabels={{ desc: t("latest"), asc: t("oldest") }} onSort={() => setSortOrder((order) => order === "desc" ? "asc" : "desc")} />
        {loading ? <ArchiveSkeleton /> : error && !items.length ? <LoadError message={error}/> : <ArchiveGrid items={items} categoryLabel={categoryLabel} emptyText={t("empty")} />}
        {hasMore && !loading && <button disabled={loadingMore} onClick={loadMore} className="mt-6 w-full rounded-xl border border-white/10 bg-neutral-900 py-3 text-xs font-bold text-neutral-400 disabled:opacity-60">{loadingMore ? t("loadingMore") : t("more")}</button>}
      </div>}
      {subTab === "keywords" && (keywordLoading ? <div className="px-4 pt-5"><ArchiveSkeleton/></div> : <KeywordView items={keywordData.items} tags={keywordData.tags} query={query} language={language} />)}
      {subTab === "today" && <TodayView items={todayItems} loading={todayLoading} todayDate={todayDate} language={language} />}
      {subTab === "archive" && <FloatingPortal><button disabled={randomLoading || !total} onClick={pickRandom} className="fixed bottom-24 right-4 z-30 flex min-h-10 items-center gap-1.5 rounded-full border border-accent/40 bg-[#120000]/95 px-4 text-[11px] font-black text-[#ff5a5a] shadow-[0_10px_30px_rgba(0,0,0,.38)] backdrop-blur-md transition active:border-accent active:bg-accent active:text-white disabled:opacity-50 md:right-[calc((100vw-28rem)/2+1rem)]"><Shuffle size={13}/>{t("random")}</button></FloatingPortal>}
      {randomItem && <RandomArchiveModal item={randomItem} language={language} onAgain={pickRandom} loading={randomLoading} onClose={() => setRandomItem(null)} />}
    </div>
  );
}

function FloatingPortal({ children }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted ? createPortal(children, document.body) : null;
}

function RandomArchiveModal({ item, language = "ko", onAgain, loading = false, onClose }) {
  const t = (key) => archiveText(language, key);
  const categoryLabel = (value) => archiveCategoryLabel(language, value);
  return <AppOverlay className="z-[75]"><div onClick={onClose} className="flex h-full items-end justify-center bg-black/80 p-3 backdrop-blur-md"><div onClick={(event) => event.stopPropagation()} className="w-full max-w-md rounded-[28px] border border-white/10 bg-neutral-950 p-5 shadow-2xl animate-pop-in">
    <div className="flex items-center"><h2 className="text-xl font-black">{t("randomTitle")}</h2><button onClick={onClose} aria-label="랜덤 추천 닫기" className="ml-auto rounded-full bg-white/5 p-2 text-neutral-500"><X size={18}/></button></div>
    <div className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-neutral-900">{item.thumbnailUrl ? <img src={item.thumbnailUrl} alt="" className="aspect-video w-full object-cover"/> : <div className="flex aspect-video items-center justify-center bg-gradient-to-br from-neutral-900 to-neutral-800"><Archive size={28} className="text-neutral-700"/></div>}<div className="p-4"><div className="flex items-center text-[10px] font-bold"><span className="rounded border border-accent/60 px-1.5 py-0.5 text-accent">{categoryLabel(item.subCategory)}</span><time className="ml-auto text-neutral-600">{item.date}</time></div><h3 className="mt-3 text-sm font-black leading-6">{item.title}</h3></div></div>
    <div className="mt-4 grid grid-cols-2 gap-2"><button disabled={loading} onClick={onAgain} className="flex items-center justify-center gap-2 rounded-xl bg-white/5 py-3 text-xs font-black text-neutral-300 disabled:opacity-50"><Shuffle size={14}/>{t("randomAgain")}</button>{item.link ? <a href={item.link} target="_blank" rel="noreferrer" onClick={() => trackContentView(item, { tabKey: "home", contentType: "hq_archive" })} className="flex items-center justify-center gap-2 rounded-xl bg-accent py-3 text-xs font-black"><ExternalLink size={14}/>{t("openOriginal")}</a> : <button disabled className="rounded-xl bg-neutral-900 py-3 text-xs font-black text-neutral-700">{t("openOriginal")}</button>}</div>
  </div></div></AppOverlay>;
}

function FilterRow({ values, active, onChange, secondary = false, getLabel = (value) => value }) {
  return <div className={cn("flex gap-2", secondary ? "flex-wrap" : "-mx-4 overflow-x-auto px-4 no-scrollbar")}>{values.map((value) => (
    <button key={value} onClick={() => onChange(value)} className={cn("shrink-0 font-bold transition", secondary ? "rounded-md px-2 py-1 text-[10px] leading-none" : "rounded-full px-3 py-2 text-xs", active === value ? (secondary ? "bg-accent text-white" : "border border-white/30 bg-neutral-800 text-white") : "border border-white/10 bg-neutral-900 text-neutral-500")}>{getLabel(value)}</button>
  ))}</div>;
}

function SectionLabel({ label, count, unit = "개", sortOrder, sortLabels = { desc: "최신순", asc: "과거순" }, onSort }) {
  return <div className="mb-3 mt-6 flex items-center gap-3"><p className="text-xs text-neutral-400">{label} <b className="text-white">{count}{unit}</b></p>{onSort && <button onClick={onSort} className="ml-auto flex items-center gap-1 text-xs font-bold text-neutral-400"><ArrowUpDown size={13}/>{sortOrder === "desc" ? sortLabels.desc : sortLabels.asc}</button>}</div>;
}

function ArchiveGrid({ items, categoryLabel, emptyText = "조건에 맞는 기록이 없어요.", sourceTab = "home" }) {
  if (!items.length) return <EmptyState text={emptyText} />;
  return <div className="grid grid-cols-2 gap-x-3 gap-y-5">{items.map((item, index) => <ArchiveCard key={item.id} item={item} index={index} categoryLabel={categoryLabel} sourceTab={sourceTab} />)}</div>;
}

function ArchiveCard({ item, index = 0, categoryLabel = (value) => value, sourceTab = "home" }) {
  const open = () => {
    if (!item.link) return;
    trackContentView(item, { tabKey: sourceTab, contentType: "hq_archive" });
    window.open(item.link, "_blank", "noopener,noreferrer");
  };
  return <article onClick={open} className={cn("group min-w-0 animate-fade-in", item.link && "cursor-pointer")} style={{ animationDelay: `${index * 35}ms` }}>
    <div className="relative aspect-[16/9] overflow-hidden rounded-xl bg-neutral-900">
      {item.thumbnailUrl ? <img src={item.thumbnailUrl} alt="" className="h-full w-full object-cover transition duration-500 group-active:scale-105" /> : <div className="flex h-full items-center justify-center bg-gradient-to-br from-neutral-900 to-neutral-800"><Archive size={22} className="text-neutral-700" /></div>}
    </div>
    <div className="mt-2 flex items-center gap-2 text-[9px] font-bold"><span className="rounded border border-accent/60 px-1 py-px leading-none text-accent">{categoryLabel(item.subCategory)}</span><time className="ml-auto whitespace-nowrap text-neutral-600">{item.date}</time></div>
    <h3 className="mt-1.5 line-clamp-2 text-[12px] font-bold leading-[1.45] tracking-[-.02em]">{item.title}</h3>
  </article>;
}

function KeywordView({ items, tags, query, language = "ko" }) {
  const [active, setActive] = useState("전체");
  const [sortOrder, setSortOrder] = useState("desc");
  const [displayLimit, setDisplayLimit] = useState(30);
  const t = (key) => archiveText(language, key);
  const keywordLabel = (value) => value === "전체" ? t("all") : archiveKeywordLabel(language, value);
  const categoryLabel = (value) => archiveCategoryLabel(language, value);
  const filtered = items.filter((item) => (active === "전체" || item.keywords?.includes(active) || item.rawKeywords === active) && (!query || [item.title, item.date, ...(item.keywords || [])].join(" ").toLowerCase().includes(query.replace(/^#/, "").toLowerCase()))).sort((a,b) => sortOrder === "desc" ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date));
  return <div className="px-4 pb-6 pt-4">
    <p className="mb-2 text-[10px] font-bold text-neutral-600">{t("keywordHint")}</p>
    <FilterRow values={["전체", ...tags]} active={active} onChange={(value) => { setActive(value); setDisplayLimit(30); }} getLabel={keywordLabel}/>
    <SectionLabel label={keywordLabel(active)} count={filtered.length} unit={t("unit")} sortOrder={sortOrder} sortLabels={{ desc: t("latest"), asc: t("oldest") }} onSort={() => setSortOrder((order) => order === "desc" ? "asc" : "desc")}/>
    <ArchiveGrid items={filtered.slice(0, displayLimit)} categoryLabel={categoryLabel} emptyText={t("empty")}/>
    {filtered.length > displayLimit && <button onClick={() => setDisplayLimit((limit) => limit + 30)} className="mt-6 w-full rounded-xl border border-white/10 bg-neutral-900 py-3 text-xs font-bold text-neutral-400">{t("more")}</button>}
  </div>;
}

function TodayView({ items, loading = false, todayDate = "", language = "ko" }) {
  const [year, month, day] = (todayDate || "0-0-0").split("-").map(Number);
  return <div className="px-4 pt-5"><div className="relative overflow-hidden rounded-3xl bg-accent p-5"><div className="absolute -right-6 -top-8 text-[100px] font-black text-white/10">{day || ""}</div><p className="text-xs font-bold text-white/70">ON THIS DAY</p><h2 className="mt-2 text-2xl font-black">{todayDate ? archiveText(language, "todayTitle", { month, day }) : archiveText(language, "today")}</h2></div>
    {loading ? <div className="mt-6"><ListSkeleton/></div> : <div className="mt-6 space-y-3">{items.map((item) => { const ago = year - Number(item.date.slice(0, 4)); const open = () => { if (!item.link) return; trackContentView(item, { tabKey: "home", contentType: "hq_archive" }); window.open(item.link, "_blank", "noopener,noreferrer"); }; return <article key={item.id} onClick={open} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") open(); }} role={item.link ? "link" : undefined} tabIndex={item.link ? 0 : undefined} className={cn("flex items-center gap-3 rounded-2xl border border-white/10 bg-neutral-900/70 p-3 transition", item.link && "cursor-pointer active:border-accent/60")}><img src={item.thumbnailUrl} alt="" className="h-16 w-14 rounded-xl object-cover" /><div className="min-w-0 flex-1"><div className="flex items-center"><time className="text-[10px] font-bold text-neutral-500">{item.date}</time><span className="ml-auto rounded-full bg-accent/15 px-2 py-1 text-[10px] font-black text-accent">{archiveText(language, "yearsAgo", { years: ago })}</span></div><h3 className="mt-2 truncate text-[13px] font-bold">{item.title}</h3></div></article>; })}</div>}
  </div>;
}

function CalendarView() {
  const liveToday = useKstToday();
  const [[initialYear, initialMonth]] = useState(() => getKstDate().split("-").map(Number));
  const [year, setYear] = useState(initialYear); const [month, setMonth] = useState(initialMonth); const [day, setDay] = useState(null);
  const [displayLimit, setDisplayLimit] = useState(30);
  const [monthly, setMonthly] = useState([]);
  const [monthTotal, setMonthTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const monthKey = `${year}-${pad(month)}`;
  const [todayYear, todayMonth, todayDay] = (liveToday || getKstDate()).split("-").map(Number);
  const filtered = (day ? monthly.filter((x) => x.date === `${monthKey}-${pad(day)}`) : monthly).sort((a,b) => b.date.localeCompare(a.date));
  const firstDay = new Date(year, month - 1, 1).getDay(); const days = new Date(year, month, 0).getDate();
  const changeMonth = (delta) => { const d = new Date(year, month - 1 + delta, 1); setYear(d.getFullYear()); setMonth(d.getMonth() + 1); setDay(null); setDisplayLimit(30); };
  useEffect(() => { let active = true; setLoading(true); setError(""); setMonthly([]); archiveService.calendar({year,month}).then((result)=>{if(!active)return;setMonthly(result.items);setMonthTotal(result.total);}).catch((reason)=>{if(!active)return;setError(reason.message||"캘린더 기록을 불러오지 못했어요.");}).finally(()=>{if(active)setLoading(false);}); return()=>{active=false;}; },[year,month]);
  return <div className="px-4 pt-4"><div className="flex items-center"><h2 className="text-2xl font-black tracking-tight">캘린더</h2><span className="ml-auto text-sm font-black text-neutral-500">{monthTotal}개</span></div>
    <div className="mt-5 rounded-3xl border border-white/10 bg-neutral-900/70 p-4">
      <div className="flex items-center justify-between"><button onClick={() => changeMonth(-1)} className="rounded-full bg-white/5 p-2"><ChevronLeft size={17} /></button><div className="flex gap-2"><select value={year} onChange={(e) => { setYear(+e.target.value); setDay(null); setDisplayLimit(30); }} className="rounded-lg bg-black px-2 py-1.5 text-sm font-black outline-none">{Array.from({length:Math.max(2028,todayYear+1)-2017+1},(_,i)=>2017+i).map((y) => <option key={y}>{y}</option>)}</select><select value={month} onChange={(e) => { setMonth(+e.target.value); setDay(null); setDisplayLimit(30); }} className="rounded-lg bg-black px-2 py-1.5 text-sm font-black outline-none">{Array.from({length:12},(_,i)=>i+1).map((m) => <option key={m} value={m}>{pad(m)}</option>)}</select></div><button onClick={() => changeMonth(1)} className="rounded-full bg-white/5 p-2"><ChevronRight size={17} /></button></div>
      <div className="mt-5 grid grid-cols-7 text-center text-[10px] font-bold text-neutral-600">{["일","월","화","수","목","금","토"].map((x)=><span key={x}>{x}</span>)}</div>
      <div className="mt-2 grid grid-cols-7 gap-y-1">{Array.from({length:firstDay}).map((_,i)=><span key={`e${i}`} />)}{Array.from({length:days},(_,i)=>i+1).map((d)=>{const has=monthly.some((x)=>x.date===`${monthKey}-${pad(d)}`);const isToday=d===todayDay&&month===todayMonth&&year===todayYear;return <button key={d} onClick={()=>{setDay(day===d?null:d);setDisplayLimit(30);}} className={cn("relative mx-auto flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold",day===d?"bg-accent text-white":isToday?"bg-white text-black":"text-neutral-400")}>{d}{has&&day!==d&&<span className="absolute bottom-1 h-1 w-1 rounded-full bg-accent"/>}</button>})}</div>
    </div>
    <div className="mt-6 flex items-end"><div><p className="text-[10px] font-black tracking-[.18em] text-neutral-600">{day ? "SELECTED DAY" : "MONTHLY ARCHIVE"}</p><h3 className="mt-1 text-lg font-black">{day ? `${month}월 ${day}일` : `${year}년 ${month}월`}</h3></div><button onClick={()=>{setDay(null);setDisplayLimit(30);}} className={cn("ml-auto text-xs font-bold text-accent",!day&&"invisible")}>전체 보기</button></div>
    <div className="mt-4">{loading ? <ArchiveSkeleton/> : error ? <LoadError message={error}/> : <ArchiveGrid items={filtered.slice(0, displayLimit)} sourceTab="calendar" />}{!loading && filtered.length > displayLimit && <button onClick={() => setDisplayLimit((limit) => limit + 30)} className="mt-6 w-full rounded-xl border border-white/10 bg-neutral-900 py-3 text-xs font-bold text-neutral-400">더보기 (+30)</button>}</div>
  </div>;
}

const shuffle = (items) => [...items].sort(() => Math.random() - 0.5);
const itemKey = (item) => `${item.originalCupId || "cup"}-${item.id}`;
const tweetMediaCache = new Map();

function AppOverlay({ children, className = "z-[70]" }) {
  const [mounted,setMounted]=useState(false);
  useEffect(()=>setMounted(true),[]);
  return mounted ? createPortal(<div className={cn("fixed inset-0",className)}>{children}</div>,document.body) : null;
}

const mediaFromTweetData = (data = {}) => {
  const asArray = (value) => Array.isArray(value) ? value : value ? [value] : [];
  const vxMedia = asArray(data.mediaURLs)[0] || asArray(data.media_urls)[0];
  const vxUrl = typeof vxMedia === "string" ? vxMedia : vxMedia?.url || "";
  if (vxUrl) return { url: vxUrl, thumbnailUrl: typeof vxMedia === "string" ? "" : String(vxMedia?.thumbnail_url || vxMedia?.preview_image_url || vxMedia?.poster || vxMedia?.media_url_https || ""), isVideo: /video\.twimg\.com|\.(mp4|m3u8)(?:$|\?)/i.test(vxUrl) };
  const candidates = [
    ...asArray(data.media_extended),
    ...asArray(data.tweet?.media?.all),
    ...asArray(data.media?.all)
  ];
  const detailed = candidates.find((media)=>/video|gif/i.test(media?.type || "") && (media?.url || media?.thumbnail_url))
    || candidates.find((media)=>media?.url || media?.thumbnail_url);
  const thumbnailUrl = detailed?.thumbnail_url || detailed?.preview_image_url || detailed?.poster || detailed?.media_url_https || detailed?.media_url || data.thumbnail_url || data.preview_image_url || data.poster || data.tweet?.media?.thumbnail_url || data.tweet?.video?.thumbnail_url || data.tweet?.video?.preview_image_url || "";
  const url = detailed?.url || thumbnailUrl || data.video_url || data.tweet?.video?.url || "";
  return url ? { url, thumbnailUrl: String(thumbnailUrl || ""), isVideo: /video|gif/i.test(detailed?.type || "") || /\.(mp4|m3u8)(?:$|\?)/i.test(url) } : null;
};

async function resolveTweetMedia(sourceUrl) {
  if (!sourceUrl) return null;
  if (tweetMediaCache.has(sourceUrl)) return tweetMediaCache.get(sourceUrl);
  const request = (async()=>{
    try {
      const source = new URL(sourceUrl);
      if (/pbs\.twimg\.com|video\.twimg\.com/i.test(source.hostname)) {
        const isVideo = /video\.twimg\.com|\.(mp4|m3u8)(?:$|\?)/i.test(sourceUrl);
        return { url: sourceUrl, thumbnailUrl: isVideo ? "" : sourceUrl, isVideo };
      }
      const match = source.pathname.match(/\/([^/]+)\/(?:status|statuses)\/(\d+)/i);
      if (!match) return null;
      const path = `/${match[1]}/status/${match[2]}`;
      let fallbackMedia = null;
      for (const endpoint of [`https://api.vxtwitter.com${path}`,`https://api.fxtwitter.com${path}`]) {
        try {
          const response = await fetch(endpoint);
          if (!response.ok) continue;
          const resolved = mediaFromTweetData(await response.json());
          if (resolved?.thumbnailUrl || (resolved && !resolved.isVideo)) return resolved;
          if (resolved && !fallbackMedia) fallbackMedia = resolved;
        } catch {}
      }
      try {
        const serverMedia = await Promise.race([
          tweetMediaService.resolve(sourceUrl),
          new Promise((_,reject)=>setTimeout(()=>reject(new Error("media resolver timeout")),8000))
        ]);
        if (serverMedia?.url) return { ...serverMedia, thumbnailUrl: serverMedia.thumbnailUrl || serverMedia.thumbnail_url || serverMedia.preview_image_url || serverMedia.poster || "", isVideo: Boolean(serverMedia.isVideo || serverMedia.type === "video") };
      } catch {}
      if (fallbackMedia) return fallbackMedia;
    } catch {}
    return null;
  })();
  tweetMediaCache.set(sourceUrl,request);
  const resolved = await request;
  if (!resolved) tweetMediaCache.delete(sourceUrl);
  return resolved;
}

function unifiedWorldcup(cups) {
  return {
    id: "all",
    title: "🦊 혚쾌 월드컵 🐰",
    icon: "❣️",
    items: cups.flatMap((cup) => cup.items.map((item) => ({ ...item, originalCupId: cup.id })))
  };
}

function CandidateMedia({ item, className = "", controls = false, fit = "cover" }) {
  const [media, setMedia] = useState(item.mediaUrl ? {url:item.mediaUrl,isVideo:Boolean(item.isVideo||/\.(mp4|m3u8)(?:$|\?)/i.test(item.mediaUrl))} : null);
  const [failed, setFailed] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [refreshAttempted, setRefreshAttempted] = useState(false);
  const resolveSequence = useRef(0);
  useEffect(() => {
    let active = true;
    const sequence = ++resolveSequence.current;
    setMedia(item.mediaUrl ? {url:item.mediaUrl,isVideo:Boolean(item.isVideo||/\.(mp4|m3u8)(?:$|\?)/i.test(item.mediaUrl))} : null);
    setFailed(false); setResolving(false); setRefreshAttempted(false);
    if (!item.mediaUrl && item.sourceUrl) {
      setResolving(true);
      resolveTweetMedia(item.sourceUrl).then((resolved)=>{
        if (!active || sequence !== resolveSequence.current) return;
        if (resolved) setMedia(resolved); else setFailed(true);
      }).finally(()=>{if(active&&sequence===resolveSequence.current)setResolving(false);});
    }
    return () => { active = false; resolveSequence.current += 1; };
  }, [item.id, item.mediaUrl, item.sourceUrl]);
  const refreshMedia = () => {
    if (!item.sourceUrl || resolving || refreshAttempted) { setFailed(true); return; }
    const sequence = ++resolveSequence.current;
    setRefreshAttempted(true); setResolving(true); setFailed(false);
    tweetMediaCache.delete(item.sourceUrl);
    resolveTweetMedia(item.sourceUrl).then((resolved)=>{
      if (sequence !== resolveSequence.current) return;
      if (resolved) setMedia(resolved); else setFailed(true);
    }).finally(()=>{if(sequence===resolveSequence.current)setResolving(false);});
  };
  const mediaClass = fit === "contain" ? "max-h-[72dvh] h-auto w-full object-contain" : "h-full w-full object-cover";
  if (resolving) return <div className={cn("flex h-full w-full items-center justify-center bg-neutral-950 p-4 text-center text-xs font-black text-neutral-500",className)}>미디어 불러오는 중…</div>;
  if (!media || failed) return <div className={cn("flex h-full w-full items-center justify-center bg-gradient-to-br from-neutral-800 to-neutral-950 p-4 text-center text-sm font-black leading-5 text-neutral-300",className)}>{item.name}</div>;
  if (media.isVideo) return <video src={media.url} autoPlay={!controls} controls={controls} loop muted={!controls} playsInline onError={refreshMedia} className={cn(mediaClass,className)}/>;
  return <img src={media.url} alt="" onError={refreshMedia} className={cn(mediaClass,className)}/>;
}

function WorldcupView() {
  const [cups, setCups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [rankingCup, setRankingCup] = useState(null);
  const [bracketCup, setBracketCup] = useState(null);
  const [game, setGame] = useState(null);
  const [winner, setWinner] = useState(null);
  const [deepLinkHandled, setDeepLinkHandled] = useState(false);

  useEffect(() => {
    let active = true;
    worldcupService.list().then((items) => { if (active) setCups(items); }).catch((reason) => { if (active) setError(reason.message || "월드컵 데이터를 불러오지 못했어요."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const unified = useMemo(() => unifiedWorldcup(cups), [cups]);

  useEffect(() => {
    if (loading || deepLinkHandled) return;
    const params = new URLSearchParams(window.location.search);
    const cupId = params.get("cupId"); const winnerId = params.get("winnerId");
    if (cupId && winnerId) {
      const cup = cupId === "all" ? unified : cups.find((item) => String(item.id) === cupId);
      const found = cup?.items.find((item) => String(item.id) === winnerId);
      if (cup && found) { setSelected(cup); setWinner(found); }
      window.history.replaceState({}, "", window.location.pathname);
    }
    setDeepLinkHandled(true);
  }, [cups, unified, loading, deepLinkHandled]);

  const start = (cup, size) => {
    const roundItems = shuffle(cup.items).slice(0, size);
    setSelected(cup); setWinner(null); setBracketCup(null);
    setGame({ roundItems, nextRound: [], matchIndex: 0 });
  };

  const recordWinner = async (picked) => {
    const originId = picked.originalCupId || selected.id;
    const originCup = cups.find((cup) => String(cup.id) === String(originId));
    const updatedCup = originCup ? { ...originCup, items: originCup.items.map((item) => String(item.id) === String(picked.id) ? { ...item, winCount: Number(item.winCount || 0) + 1 } : item) } : null;
    if (updatedCup) setCups((current) => current.map((cup) => String(cup.id) === String(originId) ? updatedCup : cup));
    setWinner({ ...picked, winCount: Number(picked.winCount || 0) + 1 }); setGame(null);
    worldcupService.incrementWin(picked.supabaseId || picked.id).catch(() => {});
  };

  const choose = (picked) => {
    const advanced = [...game.nextRound, picked];
    const nextIndex = game.matchIndex + 2;
    if (nextIndex >= game.roundItems.length) {
      if (advanced.length === 1) recordWinner(advanced[0]);
      else setGame({ roundItems: shuffle(advanced), nextRound: [], matchIndex: 0 });
    } else setGame({ ...game, nextRound: advanced, matchIndex: nextIndex });
  };

  if (winner) return <WinnerView winner={winner} cup={selected} onBack={()=>{setWinner(null);setSelected(null);}} onAgain={()=>{setWinner(null);setBracketCup(selected);}}/>;
  if (game) {
    const candidates = game.roundItems.slice(game.matchIndex, game.matchIndex + 2);
    return <GameView cup={selected} candidates={candidates} total={game.roundItems.length} matchIndex={game.matchIndex} onChoose={choose} onClose={()=>{setGame(null);setSelected(null);}}/>;
  }

  return <div className="px-4 pb-6 pt-4"><h2 className="text-xl font-black">혚쾌 월드컵</h2>
    {loading ? <div className="mt-5"><ListSkeleton/></div> : error ? <div className="mt-5"><LoadError message={error}/></div> : <div className="mt-4 space-y-3">{[...(unified.items.length>=4?[unified]:[]),...cups].map((cup)=><article key={cup.id} className="overflow-hidden rounded-3xl border border-white/10 bg-neutral-900"><button onClick={()=>setSelected(cup)} className="flex w-full items-center gap-4 p-4 text-left"><span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-accent/10 text-3xl">{cup.icon}</span><span className="min-w-0 flex-1"><strong className="block truncate text-sm font-black">{cup.title}</strong><span className="mt-1 block text-[11px] font-bold text-neutral-500">후보 {cup.items.length}개</span></span><Play size={17} className="text-accent" fill="#e50000"/></button><button onClick={()=>setRankingCup(cup)} className="w-full border-t border-white/10 py-3 text-[11px] font-black text-neutral-500"><Crown size={13} className="mr-1.5 inline text-accent"/>랭킹 보기</button></article>)}</div>}
    {selected&&<WorldcupSheet cup={selected} onClose={()=>setSelected(null)} onStart={()=>setBracketCup(selected)} onRanking={()=>setRankingCup(selected)}/>}
    {bracketCup&&<BracketSheet cup={bracketCup} onClose={()=>setBracketCup(null)} onStart={start}/>}
    {rankingCup&&<RankingSheet cup={rankingCup} onClose={()=>setRankingCup(null)}/>}
  </div>;
}

function WorldcupSheet({cup,onClose,onStart,onRanking}) {
  return <AppOverlay className="z-[50]"><div className="h-full bg-black/80 backdrop-blur-sm" onClick={onClose}><div className="mx-auto flex h-full w-full max-w-md items-end p-3"><div onClick={(event)=>event.stopPropagation()} className="w-full animate-pop-in rounded-[28px] border border-white/10 bg-neutral-900 p-5 shadow-2xl"><div className="mx-auto h-1 w-10 rounded bg-neutral-700"/><div className="mt-5 flex aspect-[16/7] items-center justify-center rounded-2xl bg-[radial-gradient(circle,#e5000038,transparent_65%)] text-6xl">{cup.icon}</div><h3 className="mt-4 text-xl font-black">{cup.title}</h3><p className="mt-2 text-xs font-bold text-neutral-500">후보 {cup.items.length}개</p><button disabled={cup.items.length<2} onClick={onStart} className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-accent py-4 text-sm font-black disabled:bg-neutral-800 disabled:text-neutral-600"><Play size={16} fill="white"/>시작하기</button><button onClick={onRanking} className="mt-2 w-full rounded-2xl bg-white/5 py-4 text-sm font-bold text-neutral-400">이 월드컵 결과 보기</button></div></div></div></AppOverlay>;
}

function BracketSheet({cup,onClose,onStart}) {
  const sizes = [128,64,32,16,8,4].filter((size)=>size<cup.items.length);
  return <AppOverlay className="z-[60]"><div className="h-full bg-black/85 backdrop-blur-sm" onClick={onClose}><div className="mx-auto flex h-full w-full max-w-md items-end p-3"><div onClick={(event)=>event.stopPropagation()} className="w-full animate-pop-in rounded-[28px] border border-white/10 bg-neutral-900 p-5 shadow-2xl"><h3 className="text-lg font-black">진행할 대진을 선택하세요</h3><p className="mt-1 text-xs text-neutral-500">후보를 무작위로 섞어 시작합니다.</p><div className="mt-5 grid grid-cols-2 gap-2"><button onClick={()=>onStart(cup,cup.items.length)} className="col-span-2 rounded-2xl bg-accent py-4 text-sm font-black">전체 ({cup.items.length}강)</button>{sizes.map((size)=><button key={size} onClick={()=>onStart(cup,size)} className="rounded-2xl border border-white/10 bg-white/5 py-3.5 text-sm font-black">{size}강</button>)}</div><button onClick={onClose} className="mt-3 w-full py-3 text-xs font-bold text-neutral-500">취소</button></div></div></div></AppOverlay>;
}

function RankingSheet({cup,onClose}) {
  const [preview,setPreview]=useState(null);
  const ranking=[...cup.items].sort((a,b)=>Number(b.winCount||0)-Number(a.winCount||0));
  return <><AppOverlay className="z-[60]"><div className="h-full bg-black/85 backdrop-blur-sm" onClick={onClose}><div className="mx-auto flex h-full w-full max-w-md items-end p-3"><div onClick={(event)=>event.stopPropagation()} className="flex max-h-[88dvh] w-full flex-col rounded-[28px] border border-white/10 bg-neutral-900 p-5 shadow-2xl animate-pop-in"><div className="flex shrink-0 items-start"><div><p className="text-[10px] font-black tracking-[.18em] text-accent">LOCAL RANKING</p><h3 className="mt-1 text-lg font-black">{cup.title}</h3><p className="mt-2 text-[10px] text-neutral-600">목록을 누르면 떡밥 미디어를 확인할 수 있어요.</p></div><button onClick={onClose} className="ml-auto rounded-full bg-white/5 p-2"><X size={16}/></button></div><div className="mt-5 min-h-0 space-y-2 overflow-y-auto no-scrollbar">{ranking.map((item,index)=><button key={itemKey(item)} onClick={()=>setPreview(item)} className="flex w-full items-center gap-3 rounded-2xl bg-black/40 p-3 text-left active:bg-white/10"><span className={cn("w-6 text-center text-sm font-black",index<3?"text-accent":"text-neutral-600")}>{index+1}</span><p className="min-w-0 flex-1 truncate text-xs font-bold">{item.name}</p><span className="text-[10px] font-black text-neutral-500">{Number(item.winCount||0)}승</span></button>)}</div></div></div></div></AppOverlay>{preview&&<MediaPreviewModal item={preview} onClose={()=>setPreview(null)}/>}</>;
}

function MediaPreviewModal({item,onClose}) {
  return <AppOverlay className="z-[80]"><div className="flex h-full items-center justify-center bg-black/90 p-4 backdrop-blur-md" onClick={onClose}><div onClick={(event)=>event.stopPropagation()} className="w-full max-w-md animate-pop-in rounded-[28px] border border-white/10 bg-neutral-900 p-4 shadow-2xl"><div className="flex items-start gap-3"><div className="min-w-0 flex-1"><h3 className="text-balance text-sm font-black leading-5">{item.name}</h3>{item.date&&<time className="mt-1 block text-[10px] font-bold text-neutral-600">{item.date}</time>}</div><button onClick={onClose} aria-label="미디어 닫기" className="rounded-full bg-white/5 p-2 text-neutral-500"><X size={16}/></button></div><div className="mt-4 flex max-h-[72dvh] min-h-[220px] items-center justify-center overflow-hidden rounded-2xl bg-black"><CandidateMedia item={item} controls fit="contain" className="!text-base"/></div>{item.sourceUrl&&<a href={item.sourceUrl} target="_blank" rel="noreferrer" className="mt-3 block w-full rounded-xl bg-white/5 py-3 text-center text-xs font-black text-neutral-400">원본 링크 열기</a>}</div></div></AppOverlay>;
}

function GameView({cup,candidates,total,matchIndex,onChoose,onClose}) {
  const [preview,setPreview]=useState(null);
  const roundTitle=total===2?"결승전":`${total}강`;
  if(candidates.length===1) return <AppOverlay><div className="mx-auto flex h-[100dvh] w-full max-w-md flex-col items-center justify-center bg-black p-6 text-center"><Flame size={32} className="text-accent"/><h2 className="mt-4 text-xl font-black">부전승 발생!</h2><p className="mt-2 text-sm leading-6 text-neutral-500"><b className="text-white">{candidates[0].name}</b>이(가)<br/>다음 라운드로 진출합니다.</p><button onClick={()=>onChoose(candidates[0])} className="mt-7 w-full rounded-2xl bg-accent py-4 text-sm font-black">다음 라운드 이동</button></div></AppOverlay>;
  return <><AppOverlay><div className="mx-auto flex h-[100dvh] w-full max-w-md flex-col overflow-hidden bg-black"><header className="flex h-14 shrink-0 items-center border-b border-white/5 px-4"><button onClick={onClose} className="rounded-full p-2 text-neutral-400"><ChevronLeft size={21}/></button><h2 className="mx-auto min-w-0 truncate pr-10 text-sm font-black">{cup?.title}</h2></header><div className="shrink-0 py-4 text-center"><p className="text-xs font-black tracking-widest text-neutral-500">{roundTitle} {Math.floor(matchIndex/2)+1}/{Math.ceil(total/2)}</p></div><div className="relative mx-4 grid h-[46dvh] min-h-[280px] grid-cols-2 gap-2">{candidates.map((candidate)=><button key={itemKey(candidate)} onClick={()=>setPreview(candidate)} aria-label={`${candidate.name} 미디어 전체 보기`} className="overflow-hidden rounded-3xl border border-white/10 bg-neutral-900"><CandidateMedia item={candidate} className="!text-base"/></button>)}<div className="pointer-events-none absolute left-1/2 top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-4 border-black bg-white text-xs font-black italic text-black shadow-2xl">VS</div></div><div className="flex flex-1 flex-col justify-start gap-3 p-4 pt-6">{candidates.map((candidate)=><button key={itemKey(candidate)} onClick={()=>onChoose(candidate)} className="flex min-h-16 w-full items-center rounded-2xl border border-white/10 bg-neutral-900 px-5 py-4 text-left text-sm font-black leading-5 active:border-accent active:bg-accent"><span className="text-balance">{candidate.name}</span>{candidate.date&&<time className="ml-auto shrink-0 pl-3 text-[10px] font-bold text-neutral-500">{candidate.date}</time>}</button>)}</div></div></AppOverlay>{preview&&<MediaPreviewModal item={preview} onClose={()=>setPreview(null)}/>}</>;
}

function WinnerView({winner,cup,onBack,onAgain}) {
  const [preview,setPreview]=useState(null);
  const shareUrl=()=>{const url=new URL(window.location.origin+window.location.pathname);url.searchParams.set("cupId",cup.id);url.searchParams.set("winnerId",winner.id);return url.toString();};
  const share=async()=>{const data={title:`${cup.title} 결과`,text:`🏆 나의 ${cup.title} 우승 떡밥은 [ ${winner.name} ].ᐟ`,url:shareUrl()};if(navigator.share) await navigator.share(data).catch(()=>{});else{await navigator.clipboard.writeText(data.url);alert("우승 결과 링크가 복사되었습니다!");}};
  return <><AppOverlay><div className="relative mx-auto h-[100dvh] w-full max-w-md overflow-y-auto bg-black px-5 pt-8 text-center no-scrollbar"><div className="absolute inset-x-0 top-0 h-80 bg-[radial-gradient(circle_at_top,#e5000044,transparent_70%)]"/><Medal size={34} className="relative mx-auto text-accent"/><p className="relative mt-3 text-xs font-black tracking-[.25em] text-accent">THE WINNER IS</p><h2 className="relative mt-2 text-3xl font-black">최종 우승</h2><button onClick={()=>setPreview(winner)} aria-label={`${winner.name} 미디어 전체 보기`} className="relative mx-auto mt-6 aspect-square w-[72%] rotate-1 overflow-hidden rounded-[32px] border-2 border-accent shadow-[0_0_60px_#e5000044]"><CandidateMedia item={winner}/><div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent"/><p className="pointer-events-none absolute inset-x-5 bottom-5 text-lg font-black">{winner.name}</p></button><button onClick={share} className="relative mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-accent py-4 text-sm font-black"><Share2 size={17}/>공유하기</button><button onClick={onAgain} className="relative mt-2 w-full rounded-2xl bg-white/5 py-3 text-sm font-bold text-neutral-400">다시 하기</button><button onClick={onBack} className="relative w-full py-3 text-sm font-bold text-neutral-600">월드컵으로 돌아가기</button></div></AppOverlay>{preview&&<MediaPreviewModal item={winner} onClose={()=>setPreview(null)}/>}</>;
}

function PostypeView({ adminRequest = null, onExcerptOpenChange }) {
  const frameRef = useRef(null);
  useEffect(() => {
    if (!adminRequest) return;
    const openAdmin = () => frameRef.current?.contentWindow?.postMessage({ type: "hq-open-postype-admin", credential: adminRequest.credential || "" }, POSTYPE_APP_ORIGIN);
    const frame = frameRef.current;
    const timer = window.setTimeout(openAdmin, 0);
    frame?.addEventListener("load", openAdmin);
    return () => { window.clearTimeout(timer); frame?.removeEventListener("load", openAdmin); };
  }, [adminRequest?.id, adminRequest?.credential]);
  useEffect(() => {
    const handleMessage = (event) => {
      if (event.origin !== POSTYPE_APP_ORIGIN) return;
      if (event.data?.type === "hq-postype-excerpt-modal") onExcerptOpenChange?.(Boolean(event.data.open));
    };
    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
      onExcerptOpenChange?.(false);
    };
  }, [onExcerptOpenChange]);
  return <iframe ref={frameRef} src={`${POSTYPE_APP_URL}?v=20260629-excerpt-spacing-v1`} title="혚쾌 포타 검색기" allow="clipboard-read; clipboard-write" className="h-full w-full border-0 bg-black" />;
}

function AdminHub({ onClose, onOpenPostype, tabVisibility, onTabVisibilityChange }) {
  const [authenticated, setAuthenticated] = useState(() => adminService.hasSession());
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [section, setSection] = useState("hub");
  const sectionTitle = { hub: "관리자 모드", tabs: "탭 노출 관리", archive: "아카이브 관리", recommended: "추천 영상 관리", stats: "통계" }[section] || "관리자 모드";
  const authenticate = async (event) => {
    event.preventDefault();
    try {
      await adminService.login(password);
      setAuthenticated(true);
      setError("");
    } catch (reason) {
      setError(reason.message || "비밀번호가 맞지 않습니다.");
    }
  };

  return <div className="absolute inset-0 z-[80] flex items-end bg-black/80 p-3 backdrop-blur-md" onClick={onClose}>
    <div onClick={(event) => event.stopPropagation()} className="max-h-[92dvh] w-full overflow-y-auto rounded-[28px] border border-white/10 bg-neutral-950 p-5 shadow-2xl no-scrollbar animate-pop-in">
      <div className="flex items-center"><div><p className="text-[10px] font-black tracking-[.18em] text-accent">ADMIN CENTER</p><h2 className="mt-1 text-xl font-black">{sectionTitle}</h2></div><button onClick={onClose} aria-label="관리자 닫기" className="ml-auto rounded-full bg-white/5 p-2 text-neutral-500"><X size={18}/></button></div>
      {!authenticated ? <form onSubmit={authenticate} className="py-10">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/15 text-accent"><LockKeyhole size={24}/></div>
        <p className="mt-4 text-center text-sm font-bold">관리자 비밀번호를 입력하세요.</p>
        <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} className={cn("mt-5 w-full rounded-2xl border bg-black p-4 text-center text-sm outline-none", error ? "border-accent" : "border-white/10")} placeholder="Password" />
        {error && <p className="mt-2 text-center text-xs font-bold text-accent">{error}</p>}
        <button className="mt-3 w-full rounded-2xl bg-accent py-4 text-sm font-black">접속하기</button>
      </form> : section === "hub" ? <div className="grid gap-3 py-6">
        <AdminPortalCard icon={Bookmark} label="탭 노출 관리" description="홈·캘린더·추천·포타 탭 ON/OFF" active onClick={() => setSection("tabs")}/>
        <AdminPortalCard icon={Archive} label="아카이브" description="Supabase 기록 추가·수정·삭제" active onClick={() => setSection("archive")}/>
        <AdminPortalCard icon={Video} label="추천 영상 관리" description="수집된 추천 영상과 노출 상태 확인" active onClick={() => setSection("recommended")}/>
        <AdminPortalCard icon={BarChart3} label="통계" description="데일리·탭별·데이터별 조회수 확인" active onClick={() => setSection("stats")}/>
        <AdminPortalCard icon={Search} label="포타 검색기" description="작품과 태그 데이터 관리" active onClick={() => onOpenPostype(password)} />
      </div> : section === "tabs" ? <TabVisibilityAdmin onBack={() => setSection("hub")} tabVisibility={tabVisibility} onChange={onTabVisibilityChange}/> : section === "recommended" ? <RecommendedVideosAdmin onBack={() => setSection("hub")}/> : section === "stats" ? <StatsAdmin onBack={() => setSection("hub")}/> : <ArchiveAdmin onBack={() => setSection("hub")}/>}
    </div>
  </div>;
}

function TabVisibilityAdmin({ onBack, tabVisibility, onChange }) {
  const [settings, setSettings] = useState(() => normalizeTabVisibility(tabVisibility));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    setLoading(true);
    appTabService.list()
      .then((rows) => {
        if (!active) return;
        const next = normalizeTabVisibility(rows);
        setSettings(next);
        onChange?.(next);
      })
      .catch((reason) => { if (active) setMessage(reason.message || "탭 설정을 불러오지 못했습니다."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [onChange]);
  const toggle = (key) => setSettings((current) => {
    const next = normalizeTabVisibility({ ...current, [key]: current[key] === false });
    return Object.values(next).some(Boolean) ? next : { ...next, home: true };
  });
  const save = async () => {
    if (!Object.values(settings).some(Boolean)) {
      setMessage("최소 1개 탭은 ON 상태여야 합니다.");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      const rows = await appTabService.update(settings);
      const next = normalizeTabVisibility(rows);
      setSettings(next);
      onChange?.(next);
      setMessage("탭 노출 설정을 저장했습니다.");
    } catch (reason) {
      setMessage(reason.message || "탭 노출 설정 저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };
  return <div className="py-5">
    <button type="button" onClick={onBack} className="mb-4 flex items-center gap-1 text-xs font-bold text-neutral-500"><ChevronLeft size={15}/>관리자 홈</button>
    <div className="rounded-2xl border border-white/10 bg-white/[.03] p-3">
      <p className="text-xs font-black">하단 탭 노출</p>
      <p className="mt-1 text-[10px] font-bold leading-4 text-neutral-600">OFF로 둔 탭은 방문자 하단 메뉴에서 숨겨집니다. 관리자 허브의 포타 검색기 진입은 유지됩니다.</p>
      <div className="mt-4 space-y-2">
        {APP_TABS.map(({ key, label, icon: Icon, description }) => {
          const active = settings[key] !== false;
          return <button key={key} type="button" disabled={loading || saving} onClick={() => toggle(key)} aria-pressed={active} className={cn("flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition disabled:opacity-50", active ? "border-accent/40 bg-accent/10" : "border-white/10 bg-black/40")}>
            <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", active ? "bg-accent/15 text-accent" : "bg-white/5 text-neutral-600")}><Icon size={18}/></span>
            <span className="min-w-0 flex-1"><strong className="block text-sm font-black">{label}</strong><span className="mt-0.5 block text-[10px] font-bold text-neutral-600">{description}</span></span>
            <span className={cn("rounded-full px-2.5 py-1 text-[10px] font-black", active ? "bg-accent text-white" : "bg-white/10 text-neutral-500")}>{active ? "ON" : "OFF"}</span>
          </button>;
        })}
      </div>
      <button type="button" onClick={save} disabled={loading || saving} className="mt-4 w-full rounded-2xl bg-accent py-3 text-xs font-black disabled:opacity-40">{saving ? "저장 중…" : "탭 설정 저장"}</button>
      {message && <p className={cn("mt-3 text-center text-[10px] font-bold", message.includes("실패") || message.includes("못했습니다") ? "text-accent" : "text-neutral-500")}>{message}</p>}
    </div>
  </div>;
}

function StatsAdmin({ onBack }) {
  const pageSize = 30;
  const today = getKstDate();
  const defaultFrom = useMemo(() => {
    const [year, month, day] = today.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day - 13));
    return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
  }, [today]);
  const [dateFrom, setDateFrom] = useState(defaultFrom);
  const [dateTo, setDateTo] = useState(today);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [page, setPage] = useState(0);
  const [stats, setStats] = useState({ totals: { views: 0, tabViews: 0, contentViews: 0 }, daily: [], tabs: [], content: [], contentTotal: 0, hasMore: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const requestId = useRef(0);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query), 300);
    return () => window.clearTimeout(timer);
  }, [query]);
  useEffect(() => { setPage(0); }, [dateFrom, dateTo, debouncedQuery]);
  useEffect(() => {
    let active = true;
    const id = ++requestId.current;
    setLoading(true);
    setError("");
    analyticsService.stats({ dateFrom, dateTo, query: debouncedQuery, offset: page * pageSize, limit: pageSize })
      .then((result) => { if (active && id === requestId.current) setStats(result); })
      .catch((reason) => { if (active && id === requestId.current) setError(reason.message || "통계를 불러오지 못했습니다."); })
      .finally(() => { if (active && id === requestId.current) setLoading(false); });
    return () => { active = false; };
  }, [dateFrom, dateTo, debouncedQuery, page]);

  const dailyMax = Math.max(1, ...stats.daily.map((row) => Number(row.views || 0)));
  const tabMax = Math.max(1, ...stats.tabs.map((row) => Number(row.views || 0)));
  const tabsByKey = new Map(stats.tabs.map((row) => [row.tab_key, row]));
  const totalPages = Math.max(1, Math.ceil(Number(stats.contentTotal || 0) / pageSize));
  const formatNumber = (value) => Number(value || 0).toLocaleString("ko-KR");
  const formatSeenAt = (value) => value ? new Date(value).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : "-";
  const resetRange = () => { setDateFrom(defaultFrom); setDateTo(today); setQuery(""); };

  return <div className="py-5">
    <button type="button" onClick={onBack} className="mb-4 flex items-center gap-1 text-xs font-bold text-neutral-500"><ChevronLeft size={15}/>관리자 홈</button>
    <div className="rounded-2xl border border-white/10 bg-white/[.03] p-3">
      <div className="flex items-start gap-3">
        <div><p className="text-[10px] font-black tracking-[.18em] text-accent">VIEW STATS</p><h3 className="mt-1 text-base font-black">조회수 통계</h3><p className="mt-1 text-[10px] font-bold leading-4 text-neutral-600">방문자가 탭을 열거나 데이터를 클릭한 기록을 Supabase 기준으로 집계합니다.</p></div>
        <button type="button" onClick={resetRange} className="ml-auto shrink-0 rounded-xl bg-white/5 px-3 py-2 text-[10px] font-black text-neutral-400">초기화</button>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <AdminInput label="시작일" type="date" value={dateFrom} onChange={setDateFrom}/>
        <AdminInput label="종료일" type="date" value={dateTo} onChange={setDateTo}/>
      </div>
      <div className="mt-3"><SearchBar value={query} onChange={setQuery} placeholder="제목, 링크, 탭, ID 검색"/></div>
    </div>

    {error && <p className="mt-3 rounded-xl border border-accent/30 bg-accent/10 p-3 text-[10px] font-bold text-accent">{error}</p>}
    <div className={cn("transition-opacity", loading && "opacity-45")}>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <div className="rounded-2xl border border-white/10 bg-white/[.03] p-3"><p className="text-[9px] font-black text-neutral-600">전체 조회</p><p className="mt-2 text-lg font-black">{formatNumber(stats.totals.views)}</p></div>
        <div className="rounded-2xl border border-white/10 bg-white/[.03] p-3"><p className="text-[9px] font-black text-neutral-600">탭 조회</p><p className="mt-2 text-lg font-black">{formatNumber(stats.totals.tabViews)}</p></div>
        <div className="rounded-2xl border border-white/10 bg-white/[.03] p-3"><p className="text-[9px] font-black text-neutral-600">데이터 조회</p><p className="mt-2 text-lg font-black">{formatNumber(stats.totals.contentViews)}</p></div>
      </div>

      <section className="mt-5">
        <div className="mb-2 flex items-center"><h4 className="text-sm font-black">데일리 조회수</h4><span className="ml-auto text-[10px] font-bold text-neutral-600">{stats.dateFrom || dateFrom} ~ {stats.dateTo || dateTo}</span></div>
        <div className="space-y-2">{stats.daily.length ? stats.daily.map((row) => {
          const views = Number(row.views || 0);
          return <div key={row.viewed_on} className="rounded-2xl border border-white/10 bg-white/[.03] p-3">
            <div className="flex items-center text-xs"><time className="font-black text-neutral-300">{row.viewed_on}</time><span className="ml-auto font-black text-accent">{formatNumber(views)}</span></div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/5"><span className="block h-full rounded-full bg-accent" style={{ width: `${Math.max(4, Math.round((views / dailyMax) * 100))}%` }}/></div>
            <p className="mt-1 text-[9px] font-bold text-neutral-600">탭 {formatNumber(row.tab_views)} · 데이터 {formatNumber(row.content_views)}</p>
          </div>;
        }) : <div className="rounded-2xl border border-dashed border-white/10 py-10 text-center text-xs font-bold text-neutral-600">아직 기록된 조회수가 없습니다.</div>}</div>
      </section>

      <section className="mt-6">
        <h4 className="mb-2 text-sm font-black">탭별 조회수</h4>
        <div className="space-y-2">{APP_TABS.map((tabItem) => {
          const row = tabsByKey.get(tabItem.key) || { views: 0, content_views: 0 };
          const views = Number(row.views || 0);
          return <div key={tabItem.key} className="rounded-2xl border border-white/10 bg-white/[.03] p-3">
            <div className="flex items-center"><span className="text-xs font-black">{TAB_LABELS[tabItem.key] || tabItem.label}</span><span className="ml-auto text-xs font-black text-accent">{formatNumber(views)}</span></div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/5"><span className="block h-full rounded-full bg-accent" style={{ width: `${views ? Math.max(4, Math.round((views / tabMax) * 100)) : 0}%` }}/></div>
            <p className="mt-1 text-[9px] font-bold text-neutral-600">이 탭에서 열린 데이터 {formatNumber(row.content_views)}</p>
          </div>;
        })}</div>
      </section>

      <section className="mt-6">
        <div className="mb-2 flex items-center"><h4 className="text-sm font-black">데이터별 조회수</h4><span className="ml-auto text-[10px] font-bold text-neutral-600">{formatNumber(stats.contentTotal)}개</span></div>
        <div className="space-y-2">{stats.content.length ? stats.content.map((item) => <article key={`${item.content_type}-${item.content_id}`} className="rounded-2xl border border-white/10 bg-white/[.03] p-3">
          <div className="flex items-start gap-2">
            <span className="shrink-0 rounded-full bg-accent/15 px-2 py-1 text-[8px] font-black text-accent">{CONTENT_TYPE_LABELS[item.content_type] || item.content_type || "데이터"}</span>
            <div className="min-w-0 flex-1"><h5 className="line-clamp-2 text-xs font-black leading-5">{item.content_title || "(제목 없음)"}</h5><p className="mt-1 truncate text-[9px] font-bold text-neutral-600">{item.content_url || item.content_id}</p></div>
            <span className="shrink-0 text-sm font-black text-accent">{formatNumber(item.views)}</span>
          </div>
          <p className="mt-2 text-[9px] font-bold text-neutral-600">마지막 조회 {formatSeenAt(item.last_viewed_at)} · {TAB_LABELS[item.tab_key] || item.tab_key}</p>
        </article>) : <div className="rounded-2xl border border-dashed border-white/10 py-10 text-center text-xs font-bold text-neutral-600">{debouncedQuery ? "검색 조건에 맞는 데이터 조회수가 없습니다." : "아직 데이터 클릭 기록이 없습니다."}</div>}</div>
        <div className="mt-4 flex items-center justify-between rounded-xl border border-white/10 bg-white/[.03] px-3 py-2.5">
          <button type="button" onClick={() => setPage((current) => Math.max(0, current - 1))} disabled={page === 0 || loading} className="rounded-lg px-2 py-1 text-[10px] font-black text-neutral-400 disabled:opacity-30">이전</button>
          <span className="text-[10px] font-black text-neutral-500">{page + 1} / {totalPages}</span>
          <button type="button" onClick={() => setPage((current) => Math.min(totalPages - 1, current + 1))} disabled={page >= totalPages - 1 || loading} className="rounded-lg px-2 py-1 text-[10px] font-black text-neutral-400 disabled:opacity-30">다음</button>
        </div>
      </section>
    </div>
  </div>;
}

function normalizeRecommendedDateQuery(value) {
  const query = String(value || "").trim();
  let match = query.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  match = query.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/);
  if (match) return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
  match = query.match(/^(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일$/);
  if (match) return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
  match = query.match(/^(\d{4})[-./](\d{1,2})$/);
  if (match) return `${match[1]}-${match[2].padStart(2, "0")}`;
  return "";
}

function RecommendedView({ onScrollTop }) {
  const [items, setItems] = useState([]);
  const [videoCategories, setVideoCategories] = useState(DEFAULT_RECOMMENDED_VIDEO_CATEGORIES);
  const [mainCategories, setMainCategories] = useState(DEFAULT_RECOMMENDED_VIDEO_MAIN_CATEGORIES);
  const [featuredItems, setFeaturedItems] = useState([]);
  const [featuredIndex, setFeaturedIndex] = useState(0);
  const [previousFeaturedIndex, setPreviousFeaturedIndex] = useState(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("전체");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [categorySort, setCategorySort] = useState("latest");
  const [hyeopMainCategory, setHyeopMainCategory] = useState("전체");
  const [hyeopSubCategory, setHyeopSubCategory] = useState("전체");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const pickTouchStartX = useRef(null);
  const featuredTransitionTimer = useRef(null);
  const featuredIndexRef = useRef(0);

  useEffect(() => {
    let active = true;
    recommendedVideoService.publicList()
      .then((rows) => { if (active) setItems(rows); })
      .catch((reason) => { if (active) setError(reason.message || "추천 영상을 불러오지 못했습니다."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([recommendedVideoService.mainCategories(), recommendedVideoService.categories()])
      .then(([mains, children]) => { if (active) { setMainCategories(mains); setVideoCategories(children); } })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (category !== "전체" && !mainCategories.some((item) => item.name === category)) setCategory("전체");
  }, [category, mainCategories]);

  useEffect(() => {
    let active = true;
    recommendedVideoService.featuredList()
      .then((rows) => { if (active) { setFeaturedItems(rows.slice(0, 10)); featuredIndexRef.current = 0; setFeaturedIndex(0); } })
      .catch(() => { if (active) setFeaturedItems([]); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (featuredItems.length < 3) return undefined;
    const timer = window.setInterval(() => {
      const current = featuredIndexRef.current;
      const next = (current + 1) % featuredItems.length;
      setPreviousFeaturedIndex(current);
      featuredIndexRef.current = next;
      setFeaturedIndex(next);
      window.clearTimeout(featuredTransitionTimer.current);
      featuredTransitionTimer.current = window.setTimeout(() => setPreviousFeaturedIndex(null), 520);
    }, 3000);
    return () => window.clearInterval(timer);
  }, [featuredItems.length]);

  useEffect(() => () => window.clearTimeout(featuredTransitionTimer.current), []);

  const searchedItems = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("ko-KR");
    const dateNeedle = normalizeRecommendedDateQuery(query);
    return items.filter((item) => {
      const publishedDate = kstDateFromValue(item.publishedAt);
      const matchesSearch = !needle
        || item.title.toLocaleLowerCase("ko-KR").includes(needle)
        || Boolean(dateNeedle && publishedDate.startsWith(dateNeedle));
      return matchesSearch;
    });
  }, [items, query]);

  const categorySections = useMemo(() => {
    const categories = category === "전체" ? videoCategories : videoCategories.filter((item) => item.mainCategoryName === category);
    const sections = categories.map((categoryItem) => ({
      key: categoryItem.name,
      title: `${categoryItem.name} 모아보기`,
      items: searchedItems.filter((item) => item.categories.includes(categoryItem.name))
    })).filter((section) => section.items.length);
    const selectedMain = mainCategories.find((item) => item.name === category);
    if (category === "전체" || selectedMain?.isFallback) {
      const knownNames = new Set(videoCategories.map((item) => item.name));
      const uncategorized = searchedItems.filter((item) => !item.categories.some((value) => knownNames.has(value)));
      if (uncategorized.length) sections.push({ key: "__uncategorized__", title: "미분류 모아보기", items: uncategorized });
    }
    return sections;
  }, [searchedItems, category, videoCategories, mainCategories]);

  const hyeopSubCategories = useMemo(() => videoCategories
    .filter((item) => hyeopMainCategory === "전체" || item.mainCategoryName === hyeopMainCategory)
    .map((item) => item.name), [videoCategories, hyeopMainCategory]);

  useEffect(() => {
    if (hyeopMainCategory !== "전체" && !mainCategories.some((item) => item.name === hyeopMainCategory)) {
      setHyeopMainCategory("전체");
      setHyeopSubCategory("전체");
      return;
    }
    if (hyeopSubCategory !== "전체" && !hyeopSubCategories.includes(hyeopSubCategory)) setHyeopSubCategory("전체");
  }, [hyeopMainCategory, hyeopSubCategory, hyeopSubCategories, mainCategories]);

  const displayDate = (value) => displayKstDate(value);
  const selectedCategoryItems = useMemo(() => {
    if (!selectedCategory) return [];
    const knownNames = new Set(videoCategories.map((item) => item.name));
    let categoryItems = selectedCategory === "__hyeopkwae_pick__"
      ? items.filter((item) => item.isHyeopkwaePick)
      : selectedCategory === "__uncategorized__"
      ? items.filter((item) => !item.categories.some((value) => knownNames.has(value)))
      : items.filter((item) => item.categories.includes(selectedCategory));
    if (selectedCategory === "__hyeopkwae_pick__") {
      if (hyeopMainCategory !== "전체") {
        const selectedMain = mainCategories.find((item) => item.name === hyeopMainCategory);
        const childNames = new Set(videoCategories.filter((item) => item.mainCategoryName === hyeopMainCategory).map((item) => item.name));
        categoryItems = selectedMain?.isFallback
          ? categoryItems.filter((item) => !item.categories.some((value) => knownNames.has(value)))
          : categoryItems.filter((item) => item.categories.some((value) => childNames.has(value)));
      }
      if (hyeopSubCategory !== "전체") categoryItems = categoryItems.filter((item) => item.categories.includes(hyeopSubCategory));
    }
    const filteredItems = categorySort === "hyeop-pick" ? categoryItems.filter((item) => item.isHyeopkwaePick) : categoryItems;
    const timestamp = (item) => {
      const value = new Date(item.publishedAt || "").getTime();
      return Number.isNaN(value) ? null : value;
    };
    return [...filteredItems].sort((a, b) => {
      const aTime = timestamp(a);
      const bTime = timestamp(b);
      if (aTime === null) return bTime === null ? 0 : 1;
      if (bTime === null) return -1;
      return categorySort === "oldest" ? aTime - bTime : bTime - aTime;
    });
  }, [items, selectedCategory, categorySort, videoCategories, mainCategories, hyeopMainCategory, hyeopSubCategory]);
  const hyeopkwaePickItems = useMemo(() => searchedItems.filter((item) => item.isHyeopkwaePick), [searchedItems]);
  const selectedCategoryDateGroups = useMemo(() => {
    const groups = [];
    selectedCategoryItems.forEach((item) => {
      const date = displayDate(item.publishedAt);
      const current = groups[groups.length - 1];
      if (current?.date === date) current.items.push(item);
      else groups.push({ date, items: [item] });
    });
    return groups;
  }, [selectedCategoryItems]);
  const trackRecommendedOpen = (item) => trackContentView(item, { tabKey: "recommended", contentType: "recommended_video", urlKey: "youtubeUrl" });
  const openCategoryList = (value) => {
    setSelectedCategory(value);
    setCategorySort("latest");
    setHyeopMainCategory("전체");
    setHyeopSubCategory("전체");
    onScrollTop?.();
  };
  const moveFeatured = (direction) => {
    if (featuredItems.length < 3) return;
    const current = featuredIndexRef.current;
    const next = (current + direction + featuredItems.length) % featuredItems.length;
    setPreviousFeaturedIndex(current);
    featuredIndexRef.current = next;
    setFeaturedIndex(next);
    window.clearTimeout(featuredTransitionTimer.current);
    featuredTransitionTimer.current = window.setTimeout(() => setPreviousFeaturedIndex(null), 520);
  };
  const selectFeatured = (index) => {
    if (index === featuredIndex) return;
    setPreviousFeaturedIndex(featuredIndex);
    featuredIndexRef.current = index;
    setFeaturedIndex(index);
    window.clearTimeout(featuredTransitionTimer.current);
    featuredTransitionTimer.current = window.setTimeout(() => setPreviousFeaturedIndex(null), 520);
  };
  const finishFeaturedSwipe = (event) => {
    if (pickTouchStartX.current === null) return;
    const distance = event.changedTouches[0].clientX - pickTouchStartX.current;
    pickTouchStartX.current = null;
    if (Math.abs(distance) < 40) return;
    moveFeatured(distance < 0 ? 1 : -1);
  };
  const showFeatured = featuredItems.length >= 3;
  const featuredItem = showFeatured ? featuredItems[featuredIndex % featuredItems.length] : null;
  const previousFeaturedItem = showFeatured && previousFeaturedIndex !== null ? featuredItems[previousFeaturedIndex % featuredItems.length] : null;
  const featuredCard = (item, leaving = false) => <article key={`${leaving ? "leaving" : "active"}-${item.id}`} aria-hidden={leaving || undefined} onTouchStart={leaving ? undefined : (event) => { pickTouchStartX.current = event.touches[0].clientX; }} onTouchEnd={leaving ? undefined : finishFeaturedSwipe} onTouchCancel={leaving ? undefined : () => { pickTouchStartX.current = null; }} className={cn("col-start-1 row-start-1 touch-pan-y select-none overflow-hidden border-y border-accent/25 bg-neutral-900 shadow-[0_16px_50px_#e5000014]", leaving ? "pointer-events-none animate-banner-out" : "relative z-10 animate-banner-in")}>
    <a href={item.youtubeUrl} target="_blank" rel="noopener noreferrer" onClick={() => trackRecommendedOpen(item)} className="block aspect-video w-full overflow-hidden bg-black">{item.thumbnailUrl ? <img src={item.thumbnailUrl} alt="" className="h-full w-full object-cover"/> : <div className="flex h-full items-center justify-center text-neutral-700"><Video size={28}/></div>}</a>
    <div className="h-[132px] overflow-hidden px-4 py-3"><a href={item.youtubeUrl} target="_blank" rel="noopener noreferrer" onClick={() => trackRecommendedOpen(item)} className="line-clamp-2 h-10 text-sm font-black leading-5 active:text-accent">{item.title || "제목 없음"}</a><p className="mt-1.5 h-4 truncate text-[9px] font-bold leading-4 text-neutral-600">{displayDate(item.publishedAt)}</p>
      <div className="mt-2 flex h-[26px] flex-wrap gap-1.5 overflow-hidden">{item.categories.length ? item.categories.map((value) => <span key={value} className="h-6 shrink-0 rounded-full bg-white/5 px-2 py-1 text-[9px] font-bold text-neutral-400">{value}</span>) : <span className="text-[9px] font-bold text-neutral-700">미분류</span>}</div>
    </div>
  </article>;

  if (selectedCategory) return <div className="px-4 pb-6 pt-4">
    <button type="button" onClick={() => setSelectedCategory("")} className="flex items-center gap-1 text-xs font-bold text-neutral-500"><ChevronLeft size={15}/>추천탭으로</button>
    <div className="mt-5 flex items-end"><div><p className="text-[10px] font-black tracking-[.18em] text-accent">CONTENT</p><h2 className="mt-1 text-xl font-black">{selectedCategory === "__hyeopkwae_pick__" ? "혚쾌 PICK" : selectedCategory === "__uncategorized__" ? "미분류" : selectedCategory}</h2><p className="mt-1 text-[10px] font-bold text-neutral-600">{selectedCategoryItems.length}개의 추천 영상</p></div></div>
    {selectedCategory === "__hyeopkwae_pick__" && <details className="group mt-4" aria-label="혚쾌 PICK 카테고리 필터">
      <summary className="flex cursor-pointer list-none items-center py-2 text-xs font-black text-neutral-400 [&::-webkit-details-marker]:hidden"><span>카테고리 필터</span><ChevronRight size={16} className="ml-auto text-neutral-600 transition-transform group-open:rotate-90"/></summary>
      <div className="mt-2">
        <p className="text-[9px] font-black text-neutral-600">상위 카테고리</p>
        <div className="mt-2"><FilterRow values={["전체", ...mainCategories.map((item) => item.name)]} active={hyeopMainCategory} onChange={(value) => { setHyeopMainCategory(value); setHyeopSubCategory("전체"); }}/></div>
        <p className="mt-4 text-[9px] font-black text-neutral-600">하위 카테고리</p>
        <div className="mt-2"><FilterRow values={["전체", ...hyeopSubCategories]} active={hyeopSubCategory} onChange={setHyeopSubCategory} secondary/></div>
      </div>
    </details>}
    <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl border border-white/10 bg-white/[.03] p-1.5" role="group" aria-label="영상 정렬 및 필터">
      {[["latest","최신순"],["oldest","과거순"],["hyeop-pick","혚쾌 PICK"]].map(([value,label]) => <button type="button" key={value} aria-pressed={categorySort === value} onClick={() => setCategorySort(value)} className={cn("rounded-xl py-2.5 text-[10px] font-black transition", categorySort === value ? "bg-accent text-white" : "text-neutral-500")}>{label}</button>)}
    </div>
    <div className="mt-6 space-y-7">{selectedCategoryDateGroups.length ? selectedCategoryDateGroups.map((group) => <section key={group.date}>
      <div className="mb-3 flex items-center gap-3"><time className="text-xs font-black text-neutral-300">{group.date}</time><span className="h-px flex-1 bg-white/10"/><span className="text-[9px] font-bold text-neutral-600">{group.items.length}개</span></div>
      <div className="space-y-3">{group.items.map((item) => <article key={`${selectedCategory}-${item.id}`} className="overflow-hidden rounded-2xl border border-white/10 bg-neutral-900/70">
        <a href={item.youtubeUrl} target="_blank" rel="noopener noreferrer" onClick={() => trackRecommendedOpen(item)} className="block active:bg-white/5">
          <div className="flex aspect-video w-full items-center justify-center overflow-hidden bg-black text-neutral-700">{item.thumbnailUrl ? <img src={item.thumbnailUrl} alt="" className="h-full w-full object-cover"/> : <Video size={24}/>}</div>
          <div className="p-3"><div className="flex items-start gap-2"><h3 className="min-w-0 flex-1 text-sm font-black leading-5">{item.title || "제목 없음"}</h3>{item.isHyeopkwaePick && <span className="shrink-0 rounded-full bg-accent/15 px-2 py-1 text-[8px] font-black text-accent">혚쾌 PICK</span>}</div><p className="mt-2 text-[9px] font-bold text-neutral-600">{displayDate(item.publishedAt)}</p></div>
        </a>
        <div className="flex min-h-10 flex-wrap gap-1.5 border-t border-white/5 px-3 py-2">{item.categories.length ? item.categories.map((value) => <span key={value} className="rounded-full bg-white/5 px-2 py-1 text-[8px] font-bold text-neutral-500">{value}</span>) : <span className="text-[9px] font-bold text-neutral-700">미분류</span>}</div>
      </article>)}</div>
    </section>) : <div className="rounded-2xl border border-dashed border-white/10 py-14 text-center text-xs font-bold text-neutral-600">조건에 맞는 추천 영상이 없습니다.</div>}</div>
  </div>;

  return <div className="px-4 pb-6 pt-4">
    <h2 className="text-xl font-black">추천 영상</h2>
    <div className="mt-4"><SearchBar value={query} onChange={setQuery} placeholder="제목 또는 날짜로 검색"/></div>
    <div className="-mx-4 mt-3 overflow-x-auto px-4 no-scrollbar"><div className="flex w-max gap-2">{["전체", ...mainCategories.map((item) => item.name)].map((value) => <button key={value} onClick={() => setCategory(value)} className={cn("shrink-0 rounded-full border px-3.5 py-2 text-[10px] font-black transition", category === value ? "border-accent bg-accent text-white" : "border-white/10 bg-white/5 text-neutral-500")}>{value}</button>)}</div></div>
    {category === "전체" && featuredItem && <section className="-mx-4 mt-5"><div className="mb-2 flex items-center px-4"><div><p className="text-[10px] font-black tracking-[.18em] text-accent">TODAY&apos;S PICK</p><h3 className="mt-1 text-sm font-black">오늘의 PICK</h3></div><span className="ml-auto text-[10px] font-black text-neutral-600">{featuredIndex + 1} / {featuredItems.length}</span></div>
      <div className="grid">{previousFeaturedItem && featuredCard(previousFeaturedItem, true)}{featuredCard(featuredItem)}</div>
      <div className="mt-3 flex justify-center gap-1.5 px-4">{featuredItems.map((item, index) => <button key={item.id} onClick={() => selectFeatured(index)} aria-label={`오늘의 PICK ${index + 1}`} className={cn("h-1.5 rounded-full transition-all", index === featuredIndex ? "w-5 bg-accent" : "w-1.5 bg-neutral-700")}/>)}</div>
    </section>}
    {category === "전체" && !loading && !error && hyeopkwaePickItems.length > 0 && <section className="mt-7">
      <div className="mb-3 flex items-center"><div><h3 className="text-base font-black">혚쾌 PICK 모아보기</h3><p className="mt-1 text-[9px] font-bold text-neutral-600">{hyeopkwaePickItems.length}개의 추천 영상</p></div><button type="button" onClick={() => openCategoryList("__hyeopkwae_pick__")} aria-label="혚쾌 PICK 전체 목록 보기" className="ml-auto flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-neutral-500 transition active:bg-accent/15 active:text-accent"><ChevronRight size={18}/></button></div>
      <div className="-mx-4 overflow-x-auto px-4 no-scrollbar"><div className="flex w-max snap-x snap-mandatory gap-3 pb-1">{hyeopkwaePickItems.map((item) => <article key={`hyeop-pick-${item.id}`} className="w-[68vw] min-w-[210px] max-w-[250px] snap-start overflow-hidden rounded-2xl border border-accent/25 bg-neutral-900/70">
        <a href={item.youtubeUrl} target="_blank" rel="noopener noreferrer" onClick={() => trackRecommendedOpen(item)} className="block active:bg-white/5">
          <div className="flex aspect-video w-full items-center justify-center overflow-hidden bg-black text-neutral-700">{item.thumbnailUrl ? <img src={item.thumbnailUrl} alt="" className="h-full w-full object-cover"/> : <Video size={22}/>}</div>
          <div className="p-3"><div className="mb-2 inline-flex rounded-full bg-accent/15 px-2 py-1 text-[8px] font-black text-accent">혚쾌 PICK</div><h4 className="line-clamp-2 min-h-10 text-xs font-black leading-5">{item.title || "제목 없음"}</h4><p className="mt-2 text-[9px] font-bold text-neutral-600">{displayDate(item.publishedAt)}</p></div>
        </a>
        <div className="flex min-h-10 flex-wrap gap-1.5 border-t border-white/5 px-3 py-2">{item.categories.length ? item.categories.map((value) => <span key={value} className="rounded-full bg-white/5 px-2 py-1 text-[8px] font-bold text-neutral-500">{value}</span>) : <span className="text-[9px] font-bold text-neutral-700">미분류</span>}</div>
      </article>)}</div></div>
    </section>}
    {loading ? <div className="mt-5"><ListSkeleton/></div> : error ? <div className="mt-5"><LoadError message={error}/></div> : categorySections.length ? <div className="mt-7 space-y-8">{categorySections.map((section) => <section key={section.key}>
      <div className="mb-3 flex items-center"><div><h3 className="text-base font-black">{section.title}</h3><p className="mt-1 text-[9px] font-bold text-neutral-600">{section.items.length}개의 추천 영상</p></div><button type="button" onClick={() => openCategoryList(section.key)} aria-label={`${section.key === "__uncategorized__" ? "미분류" : section.key} 전체 목록 보기`} className="ml-auto flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-neutral-500 transition active:bg-accent/15 active:text-accent"><ChevronRight size={18}/></button></div>
      <div className="-mx-4 overflow-x-auto px-4 no-scrollbar"><div className="flex w-max snap-x snap-mandatory gap-3 pb-1">{section.items.map((item) => <article key={`${section.key}-${item.id}`} className="w-[68vw] min-w-[210px] max-w-[250px] snap-start overflow-hidden rounded-2xl border border-white/10 bg-neutral-900/70">
        <a href={item.youtubeUrl} target="_blank" rel="noopener noreferrer" onClick={() => trackRecommendedOpen(item)} className="block active:bg-white/5">
          <div className="flex aspect-video w-full items-center justify-center overflow-hidden bg-black text-neutral-700">{item.thumbnailUrl ? <img src={item.thumbnailUrl} alt="" className="h-full w-full object-cover"/> : <Video size={22}/>}</div>
          <div className="p-3"><h4 className="line-clamp-2 min-h-10 text-xs font-black leading-5">{item.title || "제목 없음"}</h4><p className="mt-2 text-[9px] font-bold text-neutral-600">{displayDate(item.publishedAt)}</p></div>
        </a>
        <div className="flex min-h-10 flex-wrap gap-1.5 border-t border-white/5 px-3 py-2">{item.categories.length ? item.categories.map((value) => <span key={value} className="rounded-full bg-white/5 px-2 py-1 text-[8px] font-bold text-neutral-500">{value}</span>) : <span className="text-[9px] font-bold text-neutral-700">미분류</span>}</div>
      </article>)}</div></div>
    </section>)}</div> : <div className="mt-5 rounded-2xl border border-dashed border-white/10 py-14 text-center text-xs font-bold text-neutral-600">조건에 맞는 추천 영상이 없습니다.</div>}
  </div>;
}

const DEFAULT_RECOMMENDED_VIDEO_MAIN_CATEGORIES = ["엔플라잉", "승협이", "유회승", "라이브", "에딧", "미분류"].map((name, index) => ({ id: `default-main-${index}`, name, sortOrder: index + 1, isFallback: name === "미분류" }));
const DEFAULT_RECOMMENDED_VIDEO_CATEGORIES = [
  ["엔플라잉", "메이킹"], ["엔플라잉", "비하인드"], ["엔플라잉", "레코딩로그"], ["엔플라잉", "승캠"],
  ["엔플라잉", "합주일지"], ["엔플라잉", "엔킷리스트"], ["엔플라잉", "버킷리스트"], ["엔플라잉", "냉탕과온탕사이"],
  ["승협이", "라이브"], ["승협이", "기록"], ["승협이", "하기"], ["유회승", "소작실"], ["유회승", "하루의마무리"],
  ["유회승", "승구리당당수다당"], ["라이브", "우리 얘기 좀 합시다"], ["에딧", "연말결산"], ["에딧", "모음집"]
].map(([mainCategoryName, name], index) => ({ id: `default-child-${index}`, name, mainCategoryName, sortOrder: index + 1 }));

function RecommendedVideosAdmin({ onBack }) {
  const pageSize = 30;
  const [items, setItems] = useState([]);
  const [mainCategories, setMainCategories] = useState([]);
  const [videoCategories, setVideoCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [summary, setSummary] = useState({ total: 0, featuredActiveCount: 0, hyeopkwaePickActiveCount: 0, featuredItems: [] });
  const [page, setPage] = useState(0);
  const [totalItems, setTotalItems] = useState(0);
  const [error, setError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [savingId, setSavingId] = useState("");
  const [deletingId, setDeletingId] = useState("");
  const [savedId, setSavedId] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [channelUrl, setChannelUrl] = useState("");
  const [playlistUrl, setPlaylistUrl] = useState("");
  const [collectBusy, setCollectBusy] = useState("");
  const [collectNotice, setCollectNotice] = useState("");
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [bulkBusy, setBulkBusy] = useState("");
  const [bulkSortOrder, setBulkSortOrder] = useState("");
  const [bulkFeaturedOrder, setBulkFeaturedOrder] = useState("");
  const [adminQuery, setAdminQuery] = useState("");
  const [debouncedAdminQuery, setDebouncedAdminQuery] = useState("");
  const [adminVisibilityFilter, setAdminVisibilityFilter] = useState("all");
  const [adminFeaturedFilter, setAdminFeaturedFilter] = useState("all");
  const [adminHyeopkwaePickFilter, setAdminHyeopkwaePickFilter] = useState("all");
  const [adminCategoryFilter, setAdminCategoryFilter] = useState("");
  const [newMainCategoryName, setNewMainCategoryName] = useState("");
  const [newMainCategoryOrder, setNewMainCategoryOrder] = useState("");
  const [mainCategoryDrafts, setMainCategoryDrafts] = useState({});
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryMainId, setNewCategoryMainId] = useState("");
  const [newCategoryOrder, setNewCategoryOrder] = useState("");
  const [categoryBusy, setCategoryBusy] = useState("");
  const [categoryDrafts, setCategoryDrafts] = useState({});
  const [categoryMainDrafts, setCategoryMainDrafts] = useState({});
  const [categoryOrderDrafts, setCategoryOrderDrafts] = useState({});

  const matchingCategory = useMemo(() => {
    const needle = debouncedAdminQuery.trim().toLocaleLowerCase("ko-KR");
    return videoCategories.find((item) => item.name.toLocaleLowerCase("ko-KR") === needle)?.name || "";
  }, [debouncedAdminQuery, videoCategories]);
  const effectiveCategoryFilter = adminCategoryFilter || matchingCategory;
  const loadRequest = useRef(0);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedAdminQuery(adminQuery), 300);
    return () => window.clearTimeout(timer);
  }, [adminQuery]);

  useEffect(() => { setPage(0); }, [debouncedAdminQuery, effectiveCategoryFilter, adminVisibilityFilter, adminFeaturedFilter, adminHyeopkwaePickFilter]);

  useEffect(() => {
    let active = true;
    Promise.all([recommendedVideoService.mainCategories(), recommendedVideoService.categories(), recommendedVideoService.adminSummary()])
      .then(([mains, categories, nextSummary]) => { if (active) { setMainCategories(mains); setVideoCategories(categories); setSummary(nextSummary); setNewCategoryMainId((current) => current || mains[0]?.id || ""); } })
      .catch((reason) => { if (active) setError(reason.message || "추천 영상 목록을 불러오지 못했습니다."); })
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    const requestId = ++loadRequest.current;
    setListLoading(true); setError("");
    recommendedVideoService.list({
      offset: page * pageSize,
      limit: pageSize,
      query: debouncedAdminQuery,
      category: effectiveCategoryFilter,
      isActive: adminVisibilityFilter,
      isFeatured: adminFeaturedFilter,
      isHyeopkwaePick: adminHyeopkwaePickFilter
    })
      .then((result) => {
        if (!active || requestId !== loadRequest.current) return;
        setItems(result.items); setTotalItems(result.total); setSelectedIds(new Set());
      })
      .catch((reason) => { if (active && requestId === loadRequest.current) setError(reason.message || "추천 영상 목록을 불러오지 못했습니다."); })
      .finally(() => { if (active && requestId === loadRequest.current) { setLoading(false); setListLoading(false); } });
    return () => { active = false; };
  }, [page, debouncedAdminQuery, effectiveCategoryFilter, adminVisibilityFilter, adminFeaturedFilter, adminHyeopkwaePickFilter]);

  const refreshSummary = async () => {
    const nextSummary = await recommendedVideoService.adminSummary();
    setSummary(nextSummary);
  };
  const refreshItems = async ({ resetPage = false } = {}) => {
    if (resetPage && page !== 0) { setPage(0); return; }
    const result = await recommendedVideoService.list({
      offset: (resetPage ? 0 : page) * pageSize,
      limit: pageSize,
      query: debouncedAdminQuery,
      category: effectiveCategoryFilter,
      isActive: adminVisibilityFilter,
      isFeatured: adminFeaturedFilter,
      isHyeopkwaePick: adminHyeopkwaePickFilter
    });
    setItems(result.items); setTotalItems(result.total); setSelectedIds(new Set());
    await refreshSummary();
  };
  const refreshAfterCollection = async () => {
    try { await refreshItems({ resetPage: true }); }
    catch { setSaveError("수집은 완료됐지만 목록 새로고침에 실패했습니다."); }
  };
  const addYoutubeVideo = async (event) => {
    event.preventDefault();
    const value = youtubeUrl.trim();
    if (!value) { setSaveError("추가할 YouTube 링크를 입력해주세요."); return; }
    setCollectBusy("manual"); setCollectNotice(""); setSaveError("");
    try {
      await recommendedVideoService.addYoutubeUrl(value);
      setYoutubeUrl("");
      setCollectNotice("YouTube 영상을 수집했습니다. 신규 영상은 노출 OFF 상태입니다.");
      await refreshAfterCollection();
    } catch (reason) {
      setSaveError(reason.message || "YouTube 영상을 수집하지 못했습니다.");
    } finally {
      setCollectBusy("");
    }
  };
  const collectChannelVideos = async (customChannelUrl = "") => {
    const value = String(customChannelUrl || "").trim();
    setCollectBusy(value ? "custom-channel" : "channels"); setCollectNotice(""); setSaveError("");
    try {
      const result = await recommendedVideoService.collectChannels(value);
      if (value) setChannelUrl("");
      setCollectNotice(`${value ? "입력한 채널" : "기본 채널"}에서 신규 영상 ${Number(result.totalInserted || 0)}개를 수집했습니다. 기존 영상은 건너뛰며 신규 영상은 노출 OFF 상태입니다.`);
      await refreshAfterCollection();
    } catch (reason) {
      setSaveError(reason.message || "채널 영상을 수집하지 못했습니다.");
    } finally {
      setCollectBusy("");
    }
  };
  const refreshCategories = async () => {
    const [mains, categories] = await Promise.all([recommendedVideoService.mainCategories(), recommendedVideoService.categories()]);
    setMainCategories(mains);
    setVideoCategories(categories);
    setNewCategoryMainId((current) => mains.some((item) => item.id === current) ? current : (mains[0]?.id || ""));
    setMainCategoryDrafts({});
    setCategoryDrafts({});
    setCategoryMainDrafts({});
    setCategoryOrderDrafts({});
  };
  const collectCustomChannel = async (event) => {
    event.preventDefault();
    const value = channelUrl.trim();
    if (!value) { setSaveError("수집할 YouTube 채널 링크를 입력해주세요."); return; }
    await collectChannelVideos(value);
  };
  const collectPlaylistVideos = async (customPlaylistUrl = "") => {
    const value = String(customPlaylistUrl || "").trim();
    if (!value) { setSaveError("수집할 YouTube 플레이리스트 링크를 입력해주세요."); return; }
    setCollectBusy("playlist"); setCollectNotice(""); setSaveError("");
    try {
      const result = await recommendedVideoService.collectPlaylist(value);
      setPlaylistUrl("");
      setCollectNotice(`플레이리스트에서 신규 영상 ${Number(result.totalInserted || 0)}개를 수집했습니다. 기존 영상은 건너뛰며 신규 영상은 노출 OFF 상태입니다.`);
      await refreshAfterCollection();
    } catch (reason) {
      setSaveError(reason.message || "플레이리스트 영상을 수집하지 못했습니다.");
    } finally {
      setCollectBusy("");
    }
  };
  const collectCustomPlaylist = async (event) => {
    event.preventDefault();
    await collectPlaylistVideos(playlistUrl.trim());
  };
  const refreshPublishedDates = async () => {
    setCollectBusy("refresh-dates"); setCollectNotice(""); setSaveError("");
    try {
      const result = await recommendedVideoService.refreshPublishedDates();
      setCollectNotice(`업로드일자 재확인 완료: ${Number(result.checked || 0)}개 확인 · ${Number(result.updated || 0)}개 보정 · ${Number(result.missing || 0)}개 미확인`);
      await refreshAfterCollection();
    } catch (reason) {
      setSaveError(reason.message || "추천 영상 업로드일자를 재확인하지 못했습니다.");
    } finally {
      setCollectBusy("");
    }
  };
  const updateMainCategoryDraft = (id, field, value) => setMainCategoryDrafts((current) => ({ ...current, [id]: { ...(current[id] || {}), [field]: value } }));
  const updateCategoryDraft = (id, name) => setCategoryDrafts((current) => ({ ...current, [id]: name }));
  const createMainCategory = async (event) => {
    event.preventDefault();
    const name = newMainCategoryName.trim(); const sortOrder = Number(newMainCategoryOrder);
    if (!name) { setSaveError("추가할 메인 카테고리 이름을 입력해주세요."); return; }
    if (newMainCategoryOrder === "" || !Number.isInteger(sortOrder)) { setSaveError("메인 카테고리 순서를 정수로 입력해주세요."); return; }
    setCategoryBusy("create-main"); setSaveError(""); setCollectNotice("");
    try {
      await recommendedVideoService.createMainCategory(name, sortOrder);
      setNewMainCategoryName(""); setNewMainCategoryOrder("");
      await refreshCategories();
      setCollectNotice(`'${name}' 메인 카테고리를 추가했습니다.`);
    } catch (reason) { setSaveError(reason.message || "메인 카테고리를 추가하지 못했습니다."); }
    finally { setCategoryBusy(""); }
  };
  const saveMainCategory = async (categoryItem) => {
    const draft = mainCategoryDrafts[categoryItem.id] || {};
    const name = String(draft.name ?? categoryItem.name).trim(); const sortOrder = Number(draft.sortOrder ?? categoryItem.sortOrder);
    if (!name || !Number.isInteger(sortOrder)) { setSaveError("메인 카테고리 이름과 정수 순서를 확인해주세요."); return; }
    setCategoryBusy(`main-${categoryItem.id}`); setSaveError(""); setCollectNotice("");
    try { await recommendedVideoService.updateMainCategory(categoryItem.id, name, sortOrder); await refreshCategories(); setCollectNotice(`메인 카테고리 '${name}'을(를) 수정했습니다.`); }
    catch (reason) { setSaveError(reason.message || "메인 카테고리를 수정하지 못했습니다."); await refreshCategories().catch(() => {}); }
    finally { setCategoryBusy(""); }
  };
  const deleteMainCategory = async (categoryItem) => {
    if (!window.confirm(`'${categoryItem.name}' 메인 카테고리를 삭제할까요? 연결된 하위 콘텐츠는 미분류로 이동합니다.`)) return;
    setCategoryBusy(`main-${categoryItem.id}`); setSaveError(""); setCollectNotice("");
    try { await recommendedVideoService.removeMainCategory(categoryItem.id); await refreshCategories(); setCollectNotice(`'${categoryItem.name}' 메인 카테고리를 삭제하고 하위 콘텐츠를 미분류로 이동했습니다.`); }
    catch (reason) { setSaveError(reason.message || "메인 카테고리를 삭제하지 못했습니다."); }
    finally { setCategoryBusy(""); }
  };
  const createCategory = async (event) => {
    event.preventDefault();
    const name = newCategoryName.trim(); const sortOrder = Number(newCategoryOrder);
    if (!name) { setSaveError("추가할 카테고리 이름을 입력해주세요."); return; }
    if (!newCategoryMainId) { setSaveError("연결할 메인 카테고리를 선택해주세요."); return; }
    if (newCategoryOrder === "" || !Number.isInteger(sortOrder)) { setSaveError("하위 콘텐츠 노출 순서를 정수로 입력해주세요."); return; }
    setCategoryBusy("create"); setSaveError(""); setCollectNotice("");
    try {
      await recommendedVideoService.createCategory(name, newCategoryMainId, sortOrder);
      setNewCategoryName(""); setNewCategoryOrder("");
      await refreshCategories();
      setCollectNotice(`'${name}' 하위 콘텐츠를 추가했습니다.`);
    } catch (reason) {
      setSaveError(reason.message || "카테고리를 추가하지 못했습니다.");
    } finally {
      setCategoryBusy("");
    }
  };
  const saveCategory = async (categoryItem) => {
    const name = String(categoryDrafts[categoryItem.id] ?? categoryItem.name).trim();
    const mainCategoryId = String(categoryMainDrafts[categoryItem.id] ?? categoryItem.mainCategoryId);
    const sortOrder = Number(categoryOrderDrafts[categoryItem.id] ?? categoryItem.sortOrder);
    if (!name || !mainCategoryId || !Number.isInteger(sortOrder)) { setSaveError("하위 콘텐츠 이름, 메인 카테고리, 정수 순서를 확인해주세요."); return; }
    setCategoryBusy(categoryItem.id); setSaveError(""); setCollectNotice("");
    try {
      await recommendedVideoService.updateCategory(categoryItem.id, name, mainCategoryId, sortOrder);
      await Promise.all([refreshCategories(), refreshItems()]);
      setCollectNotice(`하위 콘텐츠 '${name}'의 연결과 순서를 수정했습니다. 이름 변경은 기존 영상에도 반영됐습니다.`);
    } catch (reason) {
      setSaveError(reason.message || "카테고리를 수정하지 못했습니다.");
      await refreshCategories().catch(() => {});
    } finally {
      setCategoryBusy("");
    }
  };
  const deleteCategory = async (categoryItem) => {
    if (!window.confirm(`'${categoryItem.name}' 하위 콘텐츠를 삭제할까요? 기존 영상에서도 이 연결이 제거됩니다.`)) return;
    setCategoryBusy(categoryItem.id); setSaveError(""); setCollectNotice("");
    try {
      await recommendedVideoService.removeCategory(categoryItem.id);
      await Promise.all([refreshCategories(), refreshItems()]);
      setCollectNotice(`'${categoryItem.name}' 하위 콘텐츠를 삭제했습니다.`);
    } catch (reason) {
      setSaveError(reason.message || "카테고리를 삭제하지 못했습니다.");
    } finally {
      setCategoryBusy("");
    }
  };

  const updateItem = (id, changes) => {
    setItems((current) => current.map((item) => item.id === id ? { ...item, ...changes } : item));
    setSavedId("");
    setSaveError("");
  };
  const toggleCategory = (item, category) => {
    const categories = item.categories.includes(category)
      ? item.categories.filter((value) => value !== category)
      : [...item.categories, category];
    updateItem(item.id, { categories });
  };
  const settingsFrom = (item) => ({
    isActive: item.isActive,
    isFeatured: item.isFeatured,
    isHyeopkwaePick: item.isHyeopkwaePick,
    categories: item.categories,
    sortOrder: Number(item.sortOrder),
    featuredOrder: Number(item.featuredOrder),
    adminComment: item.adminComment
  });
  const validOrders = (targetItems) => targetItems.every((item) => Number.isInteger(Number(item.sortOrder)) && Number.isInteger(Number(item.featuredOrder)));
  const saveItem = async (item) => {
    if (!validOrders([item])) {
      setSaveError("추천 목록 순서와 PICK 순서는 정수로 입력해주세요.");
      return;
    }
    setSavingId(item.id); setSavedId(""); setSaveError("");
    try {
      const saved = await recommendedVideoService.update(item.id, settingsFrom(item));
      setItems((current) => current.map((value) => value.id === item.id ? saved : value));
      await refreshSummary();
      setSavedId(item.id);
    } catch (reason) {
      setSaveError(reason.message || "추천 영상 설정을 저장하지 못했습니다.");
    } finally {
      setSavingId("");
    }
  };
  const removeFeaturedItem = async (item) => {
    const nextItem = { ...item, isFeatured: false };
    setSavingId(item.id); setSavedId(""); setSaveError(""); setCollectNotice("");
    try {
      const saved = await recommendedVideoService.update(item.id, settingsFrom(nextItem));
      setItems((current) => current.map((value) => value.id === item.id ? saved : value));
      await refreshSummary();
      setSavedId(item.id);
      setCollectNotice("롤링배너 노출을 해제했습니다.");
    } catch (reason) {
      setSaveError(reason.message || "롤링배너 노출을 해제하지 못했습니다.");
    } finally {
      setSavingId("");
    }
  };

  const categoriesByMain = useMemo(() => mainCategories.map((main) => ({
    ...main,
    children: videoCategories.filter((categoryItem) => categoryItem.mainCategoryId === main.id)
  })), [mainCategories, videoCategories]);
  const filteredAdminItems = items;
  const selectedItems = useMemo(() => items.filter((item) => selectedIds.has(item.id)), [items, selectedIds]);
  const visibleSelectedCount = filteredAdminItems.filter((item) => selectedIds.has(item.id)).length;
  const allVisibleSelected = filteredAdminItems.length > 0 && visibleSelectedCount === filteredAdminItems.length;
  const toggleSelected = (id) => setSelectedIds((current) => {
    const next = new Set(current);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const toggleAllVisible = () => setSelectedIds((current) => {
    const next = new Set(current);
    filteredAdminItems.forEach((item) => allVisibleSelected ? next.delete(item.id) : next.add(item.id));
    return next;
  });
  const applyToSelected = (changes) => {
    if (!selectedIds.size) return;
    setItems((current) => current.map((item) => {
      if (!selectedIds.has(item.id)) return item;
      const next = typeof changes === "function" ? changes(item) : changes;
      return { ...item, ...next };
    }));
    setSavedId(""); setSaveError(""); setCollectNotice("");
  };
  const applyBulkCategory = (category) => {
    const remove = selectedItems.length > 0 && selectedItems.every((item) => item.categories.includes(category));
    applyToSelected((item) => ({
      categories: remove ? item.categories.filter((value) => value !== category) : [...new Set([...item.categories, category])]
    }));
  };
  const applyBulkOrders = () => {
    const sortOrder = bulkSortOrder === "" ? null : Number(bulkSortOrder);
    const featuredOrder = bulkFeaturedOrder === "" ? null : Number(bulkFeaturedOrder);
    if (sortOrder === null && featuredOrder === null) { setSaveError("일괄 적용할 순서를 하나 이상 입력해주세요."); return; }
    if ((sortOrder !== null && !Number.isInteger(sortOrder)) || (featuredOrder !== null && !Number.isInteger(featuredOrder))) { setSaveError("일괄 순서는 정수로 입력해주세요."); return; }
    applyToSelected({ ...(sortOrder === null ? {} : { sortOrder }), ...(featuredOrder === null ? {} : { featuredOrder }) });
  };
  const saveSelected = async () => {
    if (!selectedItems.length) return;
    if (!validOrders(selectedItems)) { setSaveError("추천 목록 순서와 PICK 순서는 정수로 입력해주세요."); return; }
    setBulkBusy("save"); setSaveError(""); setCollectNotice(""); setSavedId("");
    try {
      const saved = await recommendedVideoService.updateMany(selectedItems.map((item) => ({ id: item.id, updates: settingsFrom(item) })));
      const savedById = new Map(saved.map((item) => [item.id, item]));
      setItems((current) => current.map((item) => savedById.get(item.id) || item));
      await refreshSummary();
      setCollectNotice(`선택한 영상 ${saved.length}개의 설정을 저장했습니다.`);
    } catch (reason) {
      setSaveError(reason.message || "선택한 영상 설정을 저장하지 못했습니다.");
    } finally {
      setBulkBusy("");
    }
  };
  const deleteSelected = async () => {
    if (!selectedItems.length || !window.confirm(`선택한 추천 영상 ${selectedItems.length}개를 삭제할까요? 삭제 후에는 복구할 수 없습니다.`)) return;
    const ids = selectedItems.map((item) => item.id);
    setBulkBusy("delete"); setSaveError(""); setCollectNotice("");
    try {
      const deletedCount = await recommendedVideoService.removeMany(ids);
      setItems((current) => current.filter((item) => !selectedIds.has(item.id)));
      setSelectedIds(new Set());
      await refreshItems();
      setCollectNotice(`추천 영상 ${deletedCount}개를 삭제했습니다.`);
    } catch (reason) {
      setSaveError(reason.message || "선택한 추천 영상을 삭제하지 못했습니다.");
    } finally {
      setBulkBusy("");
    }
  };
  const deleteItem = async (item) => {
    if (!window.confirm(`'${item.title || "제목 없음"}' 추천 영상을 삭제할까요? 삭제 후에는 복구할 수 없습니다.`)) return;
    setDeletingId(item.id); setSaveError(""); setCollectNotice(""); setSavedId("");
    try {
      const deletedCount = await recommendedVideoService.removeMany([item.id]);
      setItems((current) => current.filter((value) => value.id !== item.id));
      setSelectedIds((current) => {
        const next = new Set(current);
        next.delete(item.id);
        return next;
      });
      await refreshItems();
      setCollectNotice(`추천 영상 ${deletedCount}개를 삭제했습니다.`);
    } catch (reason) {
      setSaveError(reason.message || "추천 영상을 삭제하지 못했습니다.");
    } finally {
      setDeletingId("");
    }
  };

  const uploadDate = (value) => displayKstDate(value, "업로드일 없음");

  const featuredActiveCount = summary.featuredActiveCount;
  const featuredAdminItems = summary.featuredItems;
  const hyeopkwaePickAdminCount = summary.hyeopkwaePickActiveCount;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const activeAdminFilterCount = [
    adminVisibilityFilter !== "all",
    adminFeaturedFilter !== "all",
    adminHyeopkwaePickFilter !== "all",
    Boolean(adminCategoryFilter)
  ].filter(Boolean).length;
  const hasAdminListFilter = Boolean(adminQuery.trim()) || activeAdminFilterCount > 0;
  const resetAdminFilters = () => {
    setAdminVisibilityFilter("all");
    setAdminFeaturedFilter("all");
    setAdminHyeopkwaePickFilter("all");
    setAdminCategoryFilter("");
  };

  return <div className="pt-5">
    <button onClick={onBack} className="flex items-center gap-1 text-xs font-bold text-neutral-500"><ChevronLeft size={15}/>관리자 선택</button>
    <div className="mt-5 flex items-end"><div><p className="text-[10px] font-black tracking-wider text-neutral-600">RECOMMENDED VIDEOS</p><p className="mt-1 text-xs font-black">등록 영상 <span className="text-accent">{summary.total}</span>개 · 혚쾌 PICK <span className="text-accent">{hyeopkwaePickAdminCount}</span>개</p></div><p className="ml-auto text-[9px] font-bold text-neutral-600">업로드일 최신순</p></div>
    <div className="mt-4"><SearchBar value={adminQuery} onChange={setAdminQuery} placeholder="제목, 채널명, 날짜, 카테고리로 검색"/></div>
    <details className="group mt-3 rounded-2xl border border-white/10 bg-white/[.03]">
      <summary className="flex cursor-pointer list-none items-center p-3 [&::-webkit-details-marker]:hidden"><div><p className="text-xs font-black">목록 필터</p><p className="mt-1 text-[9px] font-bold text-neutral-600">{activeAdminFilterCount ? `${activeAdminFilterCount}개 필터 적용 중` : "노출, PICK, 하위 콘텐츠 기준으로 보기"}</p></div><ChevronRight size={16} className="ml-auto text-neutral-600 transition-transform group-open:rotate-90"/></summary>
      <div className="grid grid-cols-2 gap-2 border-t border-white/5 p-3">
        <label className="rounded-xl bg-black/40 px-3 py-2.5"><span className="block text-[9px] font-black text-neutral-600">노출</span><select value={adminVisibilityFilter} onChange={(event) => setAdminVisibilityFilter(event.target.value)} className="mt-1 w-full bg-transparent text-[10px] font-black outline-none"><option value="all">전체</option><option value="true">노출 ON</option><option value="false">노출 OFF</option></select></label>
        <label className="rounded-xl bg-black/40 px-3 py-2.5"><span className="block text-[9px] font-black text-neutral-600">오늘의 PICK</span><select value={adminFeaturedFilter} onChange={(event) => setAdminFeaturedFilter(event.target.value)} className="mt-1 w-full bg-transparent text-[10px] font-black outline-none"><option value="all">전체</option><option value="true">지정</option><option value="false">해제</option></select></label>
        <label className="rounded-xl bg-black/40 px-3 py-2.5"><span className="block text-[9px] font-black text-neutral-600">혚쾌 PICK</span><select value={adminHyeopkwaePickFilter} onChange={(event) => setAdminHyeopkwaePickFilter(event.target.value)} className="mt-1 w-full bg-transparent text-[10px] font-black outline-none"><option value="all">전체</option><option value="true">지정</option><option value="false">해제</option></select></label>
        <label className="rounded-xl bg-black/40 px-3 py-2.5"><span className="block text-[9px] font-black text-neutral-600">하위 콘텐츠</span><select value={adminCategoryFilter} onChange={(event) => setAdminCategoryFilter(event.target.value)} className="mt-1 w-full bg-transparent text-[10px] font-black outline-none"><option value="">전체</option>{categoriesByMain.map((main) => <optgroup key={main.id} label={main.name}>{main.children.map((categoryItem) => <option key={categoryItem.id} value={categoryItem.name}>{categoryItem.name}</option>)}</optgroup>)}</select></label>
        <button type="button" onClick={resetAdminFilters} disabled={!activeAdminFilterCount} className="col-span-2 rounded-xl border border-white/10 bg-black/40 py-2.5 text-[10px] font-black text-neutral-400 disabled:opacity-40">필터 초기화</button>
      </div>
    </details>
    {(hasAdminListFilter || listLoading) && <p className="mt-2 text-right text-[9px] font-bold text-neutral-600">{listLoading ? "검색 중…" : `목록 결과 ${totalItems}개`}</p>}
    <details className="group mt-3 rounded-2xl border border-white/10 bg-white/[.03]">
      <summary className="flex cursor-pointer list-none items-center p-3 [&::-webkit-details-marker]:hidden"><div><p className="text-xs font-black">영상 추가/수집</p><p className="mt-1 text-[9px] font-bold text-neutral-600">링크 추가, 채널 수집, 플레이리스트 수집</p></div><ChevronRight size={16} className="ml-auto text-neutral-600 transition-transform group-open:rotate-90"/></summary>
      <div className="space-y-2 border-t border-white/5 p-3">
      <form onSubmit={addYoutubeVideo} className="flex gap-2"><input type="url" value={youtubeUrl} onChange={(event) => setYoutubeUrl(event.target.value)} placeholder="YouTube 영상 링크" disabled={Boolean(collectBusy)} className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black px-3 text-[10px] outline-none focus:border-accent disabled:opacity-50"/><button disabled={Boolean(collectBusy) || !youtubeUrl.trim()} className="shrink-0 rounded-xl bg-accent px-3 py-3 text-[10px] font-black disabled:opacity-40">{collectBusy === "manual" ? "추가 중…" : "링크 추가"}</button></form>
      <form onSubmit={collectCustomChannel} className="flex gap-2"><input type="url" value={channelUrl} onChange={(event) => setChannelUrl(event.target.value)} placeholder="YouTube 채널 링크" disabled={Boolean(collectBusy)} className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black px-3 text-[10px] outline-none focus:border-accent disabled:opacity-50"/><button disabled={Boolean(collectBusy) || !channelUrl.trim()} className="shrink-0 rounded-xl border border-accent/30 bg-accent/10 px-3 py-3 text-[10px] font-black text-accent disabled:opacity-40">{collectBusy === "custom-channel" ? "수집 중…" : "채널 수집"}</button></form>
      <form onSubmit={collectCustomPlaylist} className="flex gap-2"><input type="url" value={playlistUrl} onChange={(event) => setPlaylistUrl(event.target.value)} placeholder="YouTube 플레이리스트 링크" disabled={Boolean(collectBusy)} className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black px-3 text-[10px] outline-none focus:border-accent disabled:opacity-50"/><button disabled={Boolean(collectBusy) || !playlistUrl.trim()} className="shrink-0 rounded-xl border border-[#ff0000]/30 bg-[#ff0000]/10 px-3 py-3 text-[10px] font-black text-[#ff6666] disabled:opacity-40">{collectBusy === "playlist" ? "수집 중…" : "플레이리스트 수집"}</button></form>
      <button type="button" onClick={() => collectChannelVideos()} disabled={Boolean(collectBusy)} className="w-full rounded-xl border border-white/10 bg-black/40 py-3 text-[10px] font-black text-neutral-400 disabled:opacity-40">{collectBusy === "channels" ? "기본 채널 수집 중…" : "기본 4개 채널 신규 영상 수집"}</button>
      <button type="button" onClick={refreshPublishedDates} disabled={Boolean(collectBusy)} className="w-full rounded-xl border border-[#55acee]/30 bg-[#1DA1F2]/10 py-3 text-[10px] font-black text-[#55acee] disabled:opacity-40">{collectBusy === "refresh-dates" ? "업로드일자 재확인 중…" : "기존 추천 영상 업로드일자 재확인"}</button>
      <p className="text-[9px] leading-4 text-neutral-600">채널 수집은 기존 영상이 확인되면 이전 페이지 탐색을 멈춥니다. 플레이리스트 수집은 목록 전체를 확인해 기존 영상은 건너뛰고 신규 영상만 노출 OFF 상태로 저장합니다.</p>
      </div>
    </details>
    <details className="group mt-4 rounded-2xl border border-white/10 bg-white/[.03]">
      <summary className="flex cursor-pointer list-none items-center p-3 [&::-webkit-details-marker]:hidden"><div><p className="text-xs font-black">추천 카테고리 2단계 관리</p><p className="mt-1 text-[9px] font-bold text-neutral-600">메인 {mainCategories.length}개 · 하위 콘텐츠 {videoCategories.length}개</p></div><ChevronRight size={16} className="ml-auto text-neutral-600 transition-transform group-open:rotate-90"/></summary>
      <div className="space-y-5 border-t border-white/5 p-3">
        <section>
          <div><p className="text-[10px] font-black">메인 카테고리</p><p className="mt-1 text-[9px] font-bold leading-4 text-neutral-600">추천탭 상단 필터에 노출됩니다. 삭제 시 하위 콘텐츠는 미분류로 이동합니다.</p></div>
          <form onSubmit={createMainCategory} className="mt-3 grid grid-cols-[1fr_72px_auto] gap-2"><input value={newMainCategoryName} onChange={(event) => setNewMainCategoryName(event.target.value)} placeholder="새 메인 이름" disabled={Boolean(categoryBusy)} className="min-w-0 rounded-xl border border-white/10 bg-black px-3 text-[10px] outline-none focus:border-accent disabled:opacity-50"/><input type="number" step="1" value={newMainCategoryOrder} onChange={(event) => setNewMainCategoryOrder(event.target.value)} placeholder="순서" aria-label="새 메인 카테고리 순서" disabled={Boolean(categoryBusy)} className="min-w-0 rounded-xl border border-white/10 bg-black px-3 text-[10px] outline-none focus:border-accent disabled:opacity-50"/><button disabled={Boolean(categoryBusy) || !newMainCategoryName.trim()} className="rounded-xl bg-accent px-3 py-3 text-[10px] font-black disabled:opacity-40">{categoryBusy === "create-main" ? "추가 중…" : "추가"}</button></form>
          <div className="mt-3 space-y-2">{mainCategories.map((main) => { const draft = mainCategoryDrafts[main.id] || {}; const draftName = draft.name ?? main.name; const draftOrder = draft.sortOrder ?? main.sortOrder; return <div key={main.id} className="grid grid-cols-[1fr_64px_auto_auto] gap-2"><input value={draftName} onChange={(event) => updateMainCategoryDraft(main.id, "name", event.target.value)} disabled={Boolean(categoryBusy)} aria-label="메인 카테고리 이름" className="min-w-0 rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-[10px] font-bold outline-none focus:border-accent disabled:opacity-50"/><input type="number" step="1" value={draftOrder} onChange={(event) => updateMainCategoryDraft(main.id, "sortOrder", event.target.value)} disabled={Boolean(categoryBusy)} aria-label={`${main.name} 메인 순서`} className="min-w-0 rounded-xl border border-white/10 bg-black/40 px-2 text-center text-[10px] font-black outline-none focus:border-accent disabled:opacity-50"/><button type="button" onClick={() => saveMainCategory(main)} disabled={Boolean(categoryBusy) || !String(draftName).trim()} className="rounded-xl border border-accent/30 bg-accent/10 px-3 text-[9px] font-black text-accent disabled:opacity-40">{categoryBusy === `main-${main.id}` ? "처리 중…" : "저장"}</button><button type="button" onClick={() => deleteMainCategory(main)} disabled={Boolean(categoryBusy) || main.isFallback} aria-label={`${main.name} 메인 카테고리 삭제`} className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 text-red-400 disabled:opacity-25"><Trash2 size={14}/></button></div>; })}</div>
        </section>
        <section className="border-t border-white/5 pt-5">
          <div><p className="text-[10px] font-black">하위 콘텐츠</p><p className="mt-1 text-[9px] font-bold leading-4 text-neutral-600">모아보기는 순서 오름차순으로 노출됩니다. 이름 변경은 기존 영상에도 반영됩니다.</p></div>
          <form onSubmit={createCategory} className="mt-3 grid grid-cols-2 gap-2"><input value={newCategoryName} onChange={(event) => setNewCategoryName(event.target.value)} placeholder="새 하위 콘텐츠" disabled={Boolean(categoryBusy)} className="min-w-0 rounded-xl border border-white/10 bg-black px-3 py-3 text-[10px] outline-none focus:border-accent disabled:opacity-50"/><select value={newCategoryMainId} onChange={(event) => setNewCategoryMainId(event.target.value)} disabled={Boolean(categoryBusy)} aria-label="새 하위 콘텐츠 메인 카테고리" className="min-w-0 rounded-xl border border-white/10 bg-black px-3 text-[10px] font-bold outline-none focus:border-accent disabled:opacity-50">{mainCategories.map((main) => <option key={main.id} value={main.id}>{main.name}</option>)}</select><input type="number" step="1" value={newCategoryOrder} onChange={(event) => setNewCategoryOrder(event.target.value)} placeholder="모아보기 순서" aria-label="새 하위 콘텐츠 노출 순서" disabled={Boolean(categoryBusy)} className="min-w-0 rounded-xl border border-white/10 bg-black px-3 py-3 text-[10px] outline-none focus:border-accent disabled:opacity-50"/><button disabled={Boolean(categoryBusy) || !newCategoryName.trim()} className="rounded-xl bg-accent px-3 py-3 text-[10px] font-black disabled:opacity-40">{categoryBusy === "create" ? "추가 중…" : "하위 추가"}</button></form>
          <div className="mt-4 space-y-4">{categoriesByMain.map((main) => <div key={main.id}><p className="mb-2 text-[9px] font-black text-neutral-500">{main.name} · {main.children.length}개</p><div className="space-y-2">{main.children.map((categoryItem) => { const draftName = categoryDrafts[categoryItem.id] ?? categoryItem.name; const draftMainId = categoryMainDrafts[categoryItem.id] ?? categoryItem.mainCategoryId; const draftOrder = categoryOrderDrafts[categoryItem.id] ?? categoryItem.sortOrder; return <div key={categoryItem.id} className="rounded-xl border border-white/5 bg-black/30 p-2"><div className="grid grid-cols-[1fr_66px] gap-2"><input value={draftName} onChange={(event) => updateCategoryDraft(categoryItem.id, event.target.value)} disabled={Boolean(categoryBusy)} aria-label="하위 콘텐츠 이름" className="min-w-0 rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-[10px] font-bold outline-none focus:border-accent disabled:opacity-50"/><input type="number" step="1" value={draftOrder} onChange={(event) => setCategoryOrderDrafts((current) => ({ ...current, [categoryItem.id]: event.target.value }))} disabled={Boolean(categoryBusy)} aria-label={`${categoryItem.name} 모아보기 순서`} className="min-w-0 rounded-lg border border-white/10 bg-black/40 px-2 text-center text-[10px] font-black outline-none focus:border-accent disabled:opacity-50"/></div><div className="mt-2 grid grid-cols-[1fr_auto_auto] gap-2"><select value={draftMainId} onChange={(event) => setCategoryMainDrafts((current) => ({ ...current, [categoryItem.id]: event.target.value }))} disabled={Boolean(categoryBusy)} aria-label={`${categoryItem.name} 메인 카테고리`} className="min-w-0 rounded-lg border border-white/10 bg-black/40 px-3 text-[10px] font-bold outline-none focus:border-accent disabled:opacity-50">{mainCategories.map((mainOption) => <option key={mainOption.id} value={mainOption.id}>{mainOption.name}</option>)}</select><button type="button" onClick={() => saveCategory(categoryItem)} disabled={Boolean(categoryBusy) || !String(draftName).trim()} className="rounded-lg border border-accent/30 bg-accent/10 px-3 text-[9px] font-black text-accent disabled:opacity-40">{categoryBusy === categoryItem.id ? "처리 중…" : "저장"}</button><button type="button" onClick={() => deleteCategory(categoryItem)} disabled={Boolean(categoryBusy)} aria-label={`${categoryItem.name} 하위 콘텐츠 삭제`} className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 text-red-400 disabled:opacity-40"><Trash2 size={14}/></button></div></div>; })}</div></div>)}</div>
        </section>
      </div>
    </details>
    {collectNotice && <p className="mt-3 rounded-xl border border-white/10 bg-white/[.03] p-3 text-[10px] font-bold text-neutral-400">{collectNotice}</p>}
    {!loading && !error && <details className={cn("group mt-4 rounded-2xl border", featuredActiveCount < 3 ? "border-accent/30 bg-accent/10" : "border-white/10 bg-white/[.03]")}>
      <summary className="flex cursor-pointer list-none items-center p-3 [&::-webkit-details-marker]:hidden"><div><p className="text-[10px] font-black text-neutral-500">롤링배너 노출 현황</p><strong className={cn("mt-1 block text-lg font-black", featuredActiveCount < 3 ? "text-accent" : "text-white")}>{featuredActiveCount < 3 ? "노출 안 됨" : `${featuredActiveCount}개 노출`}</strong></div><ChevronRight size={16} className="ml-auto text-neutral-600 transition-transform group-open:rotate-90"/></summary>
      <div className="border-t border-white/5 p-3">{featuredActiveCount < 3 && <p className="mb-3 text-[10px] font-bold leading-4 text-accent">오늘의 PICK은 최소 3개 이상 선택해야 추천 탭에 노출됩니다.</p>}{featuredAdminItems.length ? <div className="space-y-2">{featuredAdminItems.map((item, index) => <div key={item.id} className="flex items-center gap-3 rounded-xl bg-black/40 p-2"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-[10px] font-black text-accent">{index + 1}</span><div className="flex aspect-video w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-black text-neutral-700">{item.thumbnailUrl ? <img src={item.thumbnailUrl} alt="" className="h-full w-full object-cover"/> : <Video size={14}/>}</div><div className="min-w-0 flex-1"><p className="truncate text-[10px] font-black">{item.title || "제목 없음"}</p><p className="mt-1 truncate text-[9px] font-bold text-neutral-600">PICK 순서 {item.featuredOrder}</p></div><button type="button" disabled={savingId === item.id} onClick={() => removeFeaturedItem(item)} className="shrink-0 rounded-lg border border-accent/30 bg-accent/10 px-2.5 py-2 text-[9px] font-black text-accent disabled:opacity-40">{savingId === item.id ? "해제 중…" : "노출 해제"}</button></div>)}</div> : <p className="py-4 text-center text-[10px] font-bold text-neutral-600">현재 노출 중인 롤링배너가 없습니다.</p>}</div>
    </details>}
    {!loading && !error && filteredAdminItems.length > 0 && <div className="mt-4 flex items-center rounded-xl border border-white/10 bg-white/[.03] px-3 py-2.5"><label className="flex cursor-pointer items-center gap-2 text-[10px] font-black text-neutral-400"><input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible} className="h-4 w-4 accent-accent"/>{adminQuery.trim() ? "검색 결과 전체 선택" : "전체 선택"}</label><span className="ml-auto text-[10px] font-black text-accent">{selectedItems.length}개 선택</span></div>}
    {selectedItems.length > 0 && <section className="mt-3 rounded-2xl border border-accent/30 bg-accent/5 p-3">
      <div className="flex items-center"><div><p className="text-xs font-black">선택 항목 일괄 설정</p><p className="mt-1 text-[9px] font-bold text-neutral-500">수정 후 아래 ‘선택 설정 저장’을 눌러 반영하세요.</p></div><button type="button" onClick={() => setSelectedIds(new Set())} className="ml-auto rounded-lg border border-white/10 px-2 py-1 text-[9px] font-black text-neutral-500">선택 해제</button></div>
      <div className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={() => applyToSelected({ isActive: true })} className="rounded-xl border border-white/10 bg-black/40 py-2.5 text-[10px] font-black">노출 ON</button><button type="button" onClick={() => applyToSelected({ isActive: false })} className="rounded-xl border border-white/10 bg-black/40 py-2.5 text-[10px] font-black text-neutral-500">노출 OFF</button><button type="button" onClick={() => applyToSelected({ isFeatured: true })} className="rounded-xl border border-white/10 bg-black/40 py-2.5 text-[10px] font-black">오늘의 PICK 지정</button><button type="button" onClick={() => applyToSelected({ isFeatured: false })} className="rounded-xl border border-white/10 bg-black/40 py-2.5 text-[10px] font-black text-neutral-500">오늘의 PICK 해제</button><button type="button" onClick={() => applyToSelected({ isHyeopkwaePick: true })} className="rounded-xl border border-white/10 bg-black/40 py-2.5 text-[10px] font-black">혚쾌 PICK 지정</button><button type="button" onClick={() => applyToSelected({ isHyeopkwaePick: false })} className="rounded-xl border border-white/10 bg-black/40 py-2.5 text-[10px] font-black text-neutral-500">혚쾌 PICK 해제</button></div>
      <div className="mt-3"><p className="text-[9px] font-black text-neutral-500">하위 콘텐츠 전체 추가/해제</p><div className="mt-2 space-y-2">{categoriesByMain.map((main) => <div key={main.id}><p className="mb-1 text-[8px] font-black text-neutral-700">{main.name}</p><div className="flex flex-wrap gap-1.5">{main.children.map((categoryItem) => { const selected = selectedItems.every((item) => item.categories.includes(categoryItem.name)); return <button type="button" key={categoryItem.id} onClick={() => applyBulkCategory(categoryItem.name)} className={cn("rounded-full border px-2.5 py-1.5 text-[9px] font-bold", selected ? "border-accent/40 bg-accent/15 text-accent" : "border-white/10 bg-black/30 text-neutral-500")}>{categoryItem.name}</button>; })}</div></div>)}</div></div>
      <div className="mt-3 grid grid-cols-2 gap-2"><label className="rounded-xl bg-black/40 px-3 py-2"><span className="block text-[9px] font-black text-neutral-600">추천 목록 순서</span><input type="number" step="1" value={bulkSortOrder} onChange={(event) => setBulkSortOrder(event.target.value)} placeholder="유지" className="mt-1 w-full bg-transparent text-xs font-black outline-none placeholder:text-neutral-700"/></label><label className="rounded-xl bg-black/40 px-3 py-2"><span className="block text-[9px] font-black text-neutral-600">PICK 순서</span><input type="number" step="1" value={bulkFeaturedOrder} onChange={(event) => setBulkFeaturedOrder(event.target.value)} placeholder="유지" className="mt-1 w-full bg-transparent text-xs font-black outline-none placeholder:text-neutral-700"/></label></div>
      <button type="button" onClick={applyBulkOrders} className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 py-2.5 text-[10px] font-black">입력한 순서 일괄 적용</button>
      <div className="mt-3 grid grid-cols-[1fr_auto] gap-2"><button type="button" disabled={Boolean(bulkBusy)} onClick={saveSelected} className="rounded-xl bg-accent py-3 text-xs font-black disabled:opacity-50">{bulkBusy === "save" ? "저장 중…" : `선택 설정 저장 (${selectedItems.length})`}</button><button type="button" disabled={Boolean(bulkBusy)} onClick={deleteSelected} aria-label="선택 영상 삭제" className="flex items-center justify-center rounded-xl border border-red-500/30 bg-red-500/10 px-4 text-red-400 disabled:opacity-50">{bulkBusy === "delete" ? <RefreshCw size={16} className="animate-spin"/> : <Trash2 size={16}/>}</button></div>
    </section>}
    {saveError && <p className="mt-3 rounded-xl border border-accent/30 bg-accent/10 p-3 text-[10px] font-bold text-accent">{saveError}</p>}
    {loading ? <div className="mt-4"><ListSkeleton/></div> : error ? <div className="mt-4"><LoadError message={error}/></div> : filteredAdminItems.length ? <><div className={cn("mt-4 space-y-3 transition-opacity", listLoading && "opacity-40")}>{filteredAdminItems.map((item) => <article key={item.id} className={cn("overflow-hidden rounded-2xl border bg-white/[.03]", selectedIds.has(item.id) ? "border-accent/50" : "border-white/10")}>
      <div className="flex gap-3 p-3"><label className="flex shrink-0 cursor-pointer items-start pt-1" aria-label={`${item.title || "제목 없음"} 선택`}><input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggleSelected(item.id)} className="h-4 w-4 accent-accent"/></label>
        <div className="flex aspect-video w-28 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-black text-neutral-700">{item.thumbnailUrl ? <img src={item.thumbnailUrl} alt="" className="h-full w-full object-cover"/> : <Video size={20}/>}</div>
        <div className="min-w-0 flex-1"><h3 className="line-clamp-2 text-xs font-black leading-5">{item.title || "제목 없음"}</h3><p className="mt-1 truncate text-[10px] font-bold text-neutral-500">{item.channelTitle || "채널명 없음"}</p><p className="mt-1 text-[9px] text-neutral-600">{uploadDate(item.publishedAt)}</p></div>
      </div>
      <div className="border-t border-white/5 px-3 py-3">
        <div className="grid grid-cols-3 gap-2">
          <button type="button" aria-pressed={item.isActive} onClick={() => updateItem(item.id, { isActive: !item.isActive })} className={cn("rounded-xl border px-3 py-2.5 text-left", item.isActive ? "border-accent/40 bg-accent/10" : "border-white/10 bg-black/40")}><span className="block text-[9px] font-black text-neutral-600">노출 여부</span><span className={cn("mt-1 block text-[10px] font-black", item.isActive ? "text-accent" : "text-neutral-400")}>{item.isActive ? "ON" : "OFF"}</span></button>
          <button type="button" aria-pressed={item.isFeatured} onClick={() => updateItem(item.id, { isFeatured: !item.isFeatured })} className={cn("rounded-xl border px-3 py-2.5 text-left", item.isFeatured ? "border-accent/40 bg-accent/10" : "border-white/10 bg-black/40")}><span className="block text-[9px] font-black text-neutral-600">오늘의 PICK</span><span className={cn("mt-1 block text-[10px] font-black", item.isFeatured ? "text-accent" : "text-neutral-400")}>{item.isFeatured ? "지정" : "해제"}</span></button>
          <button type="button" aria-pressed={item.isHyeopkwaePick} onClick={() => updateItem(item.id, { isHyeopkwaePick: !item.isHyeopkwaePick })} className={cn("rounded-xl border px-3 py-2.5 text-left", item.isHyeopkwaePick ? "border-accent/40 bg-accent/10" : "border-white/10 bg-black/40")}><span className="block text-[9px] font-black text-neutral-600">혚쾌 PICK</span><span className={cn("mt-1 block text-[10px] font-black", item.isHyeopkwaePick ? "text-accent" : "text-neutral-400")}>{item.isHyeopkwaePick ? "지정" : "해제"}</span></button>
        </div>
        <div className="mt-3"><p className="text-[9px] font-black text-neutral-600">하위 콘텐츠</p><div className="mt-2 space-y-2">{categoriesByMain.map((main) => <div key={main.id}><p className="mb-1 text-[8px] font-black text-neutral-700">{main.name}</p><div className="flex flex-wrap gap-1.5">{main.children.map((categoryItem) => { const selected = item.categories.includes(categoryItem.name); return <button type="button" aria-pressed={selected} key={categoryItem.id} onClick={() => toggleCategory(item, categoryItem.name)} className={cn("rounded-full border px-2.5 py-1.5 text-[9px] font-bold", selected ? "border-accent/40 bg-accent/15 text-accent" : "border-white/10 bg-white/5 text-neutral-500")}>{categoryItem.name}</button>; })}</div></div>)}</div></div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <label className="rounded-xl bg-black/40 px-3 py-2.5"><span className="block text-[9px] font-black text-neutral-600">추천 목록 순서</span><input type="number" step="1" value={item.sortOrder} onChange={(event) => updateItem(item.id, { sortOrder: event.target.value })} className="mt-1 w-full bg-transparent text-xs font-black text-neutral-300 outline-none"/></label>
          <label className="rounded-xl bg-black/40 px-3 py-2.5"><span className="block text-[9px] font-black text-neutral-600">PICK 순서</span><input type="number" step="1" value={item.featuredOrder} onChange={(event) => updateItem(item.id, { featuredOrder: event.target.value })} className="mt-1 w-full bg-transparent text-xs font-black text-neutral-300 outline-none"/></label>
        </div>
        <div className="mt-3 grid grid-cols-[1fr_auto] gap-2"><button type="button" disabled={Boolean(savingId) || Boolean(deletingId) || Boolean(bulkBusy)} onClick={() => saveItem(item)} className="rounded-xl bg-accent py-3 text-xs font-black disabled:opacity-50">{savingId === item.id ? "저장 중…" : savedId === item.id ? "저장됨" : "설정 저장"}</button><button type="button" disabled={Boolean(savingId) || Boolean(deletingId) || Boolean(bulkBusy)} onClick={() => deleteItem(item)} aria-label={`${item.title || "제목 없음"} 삭제`} className="flex items-center justify-center rounded-xl border border-red-500/30 bg-red-500/10 px-4 text-red-400 disabled:opacity-50">{deletingId === item.id ? <RefreshCw size={16} className="animate-spin"/> : <Trash2 size={16}/>}</button></div>
      </div>
    </article>)}</div><div className="mt-4 flex items-center justify-between rounded-xl border border-white/10 bg-white/[.03] px-3 py-2.5"><button type="button" onClick={() => setPage((current) => Math.max(0, current - 1))} disabled={page === 0 || listLoading} className="rounded-lg px-2 py-1 text-[10px] font-black text-neutral-400 disabled:opacity-30">이전</button><span className="text-[10px] font-black text-neutral-500">{page + 1} / {totalPages} · {totalItems}개</span><button type="button" onClick={() => setPage((current) => Math.min(totalPages - 1, current + 1))} disabled={page >= totalPages - 1 || listLoading} className="rounded-lg px-2 py-1 text-[10px] font-black text-neutral-400 disabled:opacity-30">다음</button></div></> : <div className="mt-4 rounded-2xl border border-dashed border-white/10 py-12 text-center text-xs font-bold text-neutral-600">{hasAdminListFilter ? "검색/필터 조건에 맞는 추천 영상이 없습니다." : "등록된 추천 영상이 없습니다."}</div>}
  </div>;
}

function AdminPortalCard({ icon: Icon, label, description, active, onClick, badge }) {
  return <button disabled={!active} onClick={onClick} className={cn("flex items-center gap-4 rounded-2xl border p-4 text-left", active ? "border-accent/30 bg-accent/10" : "border-white/10 bg-white/[.03] opacity-60")}>
    <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", active ? "bg-accent text-white" : "bg-white/5 text-neutral-500")}><Icon size={20}/></span>
    <span><span className="flex items-center gap-2 text-sm font-black">{label}{badge && <em className="not-italic rounded-full bg-white/5 px-2 py-0.5 text-[9px] text-neutral-500">{badge}</em>}</span><span className="mt-1 block text-[11px] text-neutral-500">{description}</span></span>
    {active && <ChevronRight size={17} className="ml-auto text-accent"/>}
  </button>;
}

function WorldcupAdmin({ onBack }) {
  const emptyCandidate = { id: "", name: "", date: "", sourceUrl: "", mediaUrl: "", isVideo: false, winCount: 0 };
  const [cups,setCups]=useState([]);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [editing,setEditing]=useState(null);
  const [selectedIds,setSelectedIds]=useState([]);
  const [candidateForm,setCandidateForm]=useState(null);
  const [bulkOpen,setBulkOpen]=useState(false);
  const [bulkText,setBulkText]=useState("");

  const load=async()=>{setLoading(true);setError("");try{setCups(await worldcupService.list());}catch(reason){setError(reason.message||"월드컵 데이터를 불러오지 못했어요.");}finally{setLoading(false);}};
  useEffect(()=>{load();},[]);
  const updateCupList=(cup)=>setCups((current)=>{const exists=current.some((item)=>String(item.id)===String(cup.id));return (exists?current.map((item)=>String(item.id)===String(cup.id)?cup:item):[...current,cup]).sort((a,b)=>Number(a.id)-Number(b.id));});
  const persist=async(next,message="저장되었습니다.")=>{setBusy(true);setError("");try{const saved=await worldcupService.save(next);setEditing(saved);updateCupList(saved);setNotice(message);return saved;}catch(reason){setError(reason.message||"저장하지 못했어요.");return null;}finally{setBusy(false);}};
  const openCup=(cup)=>{setEditing(JSON.parse(JSON.stringify(cup)));setSelectedIds([]);setCandidateForm(null);setBulkOpen(false);setNotice("");setError("");};
  const createCup=()=>openCup({id:Date.now(),title:"새로운 혚쾌 월드컵",icon:"🏆",items:[]});
  const removeCup=async(cup)=>{if(!window.confirm(`'${cup.title}'을(를) 삭제할까요?`))return;setBusy(true);try{await worldcupService.remove(cup.id);setCups((current)=>current.filter((item)=>String(item.id)!==String(cup.id)));setNotice("월드컵을 삭제했습니다.");}catch(reason){setError(reason.message||"삭제하지 못했어요.");}finally{setBusy(false);}};
  const saveCup=()=>{if(!editing.title.trim())return setError("월드컵 제목을 입력해주세요.");persist(editing,"월드컵을 저장하고 배포했습니다.");};
  const saveCandidate=async(event)=>{event.preventDefault();if(!candidateForm.name.trim())return setError("후보 이름을 입력해주세요.");const existing=editing.items.find((item)=>String(item.id)===String(candidateForm.id));const candidate={id:candidateForm.id||Date.now(),name:candidateForm.name.trim(),date:candidateForm.date||"",sourceUrl:candidateForm.sourceUrl.trim(),mediaUrl:candidateForm.mediaUrl.trim(),isVideo:/\.mp4(?:$|\?)/i.test(candidateForm.mediaUrl),winCount:Number(existing?.winCount||candidateForm.winCount||0)};const next={...editing,items:existing?editing.items.map((item)=>String(item.id)===String(candidate.id)?candidate:item):[...editing.items,candidate]};const saved=await persist(next,existing?"후보를 수정했습니다.":"후보를 추가했습니다.");if(saved)setCandidateForm(null);};
  const removeCandidates=async(ids)=>{if(!ids.length)return;if(!window.confirm(`${ids.length}개 후보를 삭제할까요?`))return;const keys=new Set(ids.map(String));const saved=await persist({...editing,items:editing.items.filter((item)=>!keys.has(String(item.id)))},`${ids.length}개 후보를 삭제했습니다.`);if(saved)setSelectedIds([]);};
  const processBulk=async()=>{const blocks=bulkText.trim().split(/\n\s*\n/).map((block)=>block.split("\n").map((line)=>line.trim()).filter(Boolean)).filter((lines)=>lines.length);if(!blocks.length)return setError("추가할 텍스트를 입력해주세요.");const now=Date.now();const additions=blocks.map((lines,index)=>({id:now+index,name:lines[0],date:"",sourceUrl:lines[1]||"",mediaUrl:"",isVideo:false,winCount:0}));const saved=await persist({...editing,items:[...editing.items,...additions]},`${additions.length}개 후보를 추가했습니다.`);if(saved){setBulkOpen(false);setBulkText("");}};

  if(loading)return <div className="py-12"><ListSkeleton/><p className="mt-4 text-center text-xs font-bold text-neutral-500">기존 월드컵 데이터를 불러오는 중…</p></div>;
  if(!editing)return <div className="pt-5"><button onClick={onBack} className="flex items-center gap-1 text-xs font-bold text-neutral-500"><ChevronLeft size={15}/>관리자 선택</button>{error&&<p className="mt-4 rounded-xl border border-accent/30 bg-accent/10 p-3 text-xs font-bold text-accent">{error}</p>}{notice&&<p className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3 text-xs font-bold text-neutral-400">{notice}</p>}<button onClick={createCup} className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-accent/50 bg-accent/10 py-3.5 text-xs font-black text-accent"><Plus size={16}/>새 월드컵 만들기</button><p className="mb-2 mt-5 text-[10px] font-black tracking-wider text-neutral-600">생성된 월드컵 목록</p><div className="space-y-2">{cups.map((cup)=><div key={cup.id} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[.03] p-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-xl">{cup.icon}</span><div className="min-w-0 flex-1"><p className="truncate text-xs font-black">{cup.title}</p><p className="mt-1 text-[10px] text-neutral-600">후보 {cup.items.length}개</p></div><button onClick={()=>openCup(cup)} className="rounded-lg bg-white/5 p-2 text-neutral-400"><Pencil size={14}/></button><button disabled={busy} onClick={()=>removeCup(cup)} className="rounded-lg bg-accent/10 p-2 text-accent"><Trash2 size={14}/></button></div>)}</div></div>;

  const allSelected=editing.items.length>0&&editing.items.every((item)=>selectedIds.includes(String(item.id)));
  return <div className="pt-5"><div className="flex items-center"><button onClick={()=>setEditing(null)} className="flex items-center gap-1 text-xs font-bold text-neutral-500"><ChevronLeft size={15}/>월드컵 목록</button><button disabled={busy} onClick={saveCup} className="ml-auto rounded-full bg-accent px-4 py-2 text-[11px] font-black disabled:opacity-50">저장 및 배포</button></div>{error&&<p className="mt-4 rounded-xl border border-accent/30 bg-accent/10 p-3 text-xs font-bold text-accent">{error}</p>}{notice&&<p className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3 text-xs font-bold text-neutral-400">{notice}</p>}<div className="mt-4 rounded-2xl border border-white/10 bg-white/[.03] p-4"><AdminInput label="월드컵 제목" value={editing.title} onChange={(value)=>setEditing((current)=>({...current,title:value}))}/><div className="mt-2"><AdminInput label="아이콘 (이모지 1개)" value={editing.icon} onChange={(value)=>setEditing((current)=>({...current,icon:value}))}/></div></div><div className="mt-5 flex items-center"><label className="flex items-center gap-2 text-xs font-black"><input type="checkbox" checked={allSelected} onChange={()=>setSelectedIds(allSelected?[]:editing.items.map((item)=>String(item.id)))} className="h-4 w-4 accent-[#e50000]"/>후보 <span className="text-accent">{editing.items.length}</span></label><div className="ml-auto flex gap-1.5"><button disabled={!selectedIds.length||busy} onClick={()=>removeCandidates(selectedIds)} className="rounded-lg bg-accent/10 px-2.5 py-2 text-[10px] font-black text-accent disabled:opacity-40">선택삭제</button><button onClick={()=>{setBulkOpen(true);setBulkText("");}} className="rounded-lg bg-white/5 px-2.5 py-2 text-[10px] font-black text-neutral-400">대량추가</button><button onClick={()=>setCandidateForm(emptyCandidate)} className="rounded-lg bg-accent px-2.5 py-2 text-[10px] font-black">+ 후보추가</button></div></div>
    {candidateForm&&<form onSubmit={saveCandidate} className="mt-4 rounded-2xl border border-accent/30 bg-accent/5 p-4"><div className="flex items-center"><h3 className="text-sm font-black">{candidateForm.id?"후보 수정":"후보 추가"}</h3><button type="button" onClick={()=>setCandidateForm(null)} className="ml-auto"><X size={16}/></button></div><div className="mt-3 space-y-2"><AdminInput label="후보 이름" value={candidateForm.name} onChange={(value)=>setCandidateForm((current)=>({...current,name:value}))} required/><AdminInput label="날짜 (YYYY-MM-DD)" type="date" value={candidateForm.date} onChange={(value)=>setCandidateForm((current)=>({...current,date:value}))}/><AdminInput label="원본 링크 (X/Twitter 등)" type="url" value={candidateForm.sourceUrl} onChange={(value)=>setCandidateForm((current)=>({...current,sourceUrl:value}))}/><AdminInput label="미디어 URL (선택)" type="url" value={candidateForm.mediaUrl} onChange={(value)=>setCandidateForm((current)=>({...current,mediaUrl:value}))}/></div><button disabled={busy} className="mt-3 w-full rounded-xl bg-accent py-3 text-xs font-black disabled:opacity-50">{busy?"저장 중…":"저장"}</button></form>}
    {bulkOpen&&<div className="mt-4 rounded-2xl border border-white/10 bg-white/[.03] p-4"><div className="flex items-center"><div><h3 className="text-sm font-black">대량 항목 추가</h3><p className="mt-1 text-[10px] leading-4 text-neutral-500">후보 이름 다음 줄에 링크를 넣고, 후보 사이는 빈 줄로 구분하세요.<br/>텍스트 후보는 링크를 생략할 수 있습니다.</p></div><button onClick={()=>setBulkOpen(false)} className="ml-auto"><X size={16}/></button></div><textarea rows={8} value={bulkText} onChange={(event)=>setBulkText(event.target.value)} placeholder={`후보 이름\nhttps://x.com/...\n\n텍스트 후보 이름`} className="mt-3 w-full resize-none rounded-xl border border-white/10 bg-black p-3 text-xs leading-5 outline-none focus:border-accent"/><button disabled={busy} onClick={processBulk} className="mt-2 w-full rounded-xl bg-accent py-3 text-xs font-black disabled:opacity-50">일괄 추가</button></div>}
    <div className="mt-4 space-y-2">{editing.items.length?editing.items.map((item)=><div key={item.id} className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[.03] p-2.5"><input type="checkbox" checked={selectedIds.includes(String(item.id))} onChange={()=>setSelectedIds((current)=>current.includes(String(item.id))?current.filter((id)=>id!==String(item.id)):[...current,String(item.id)])} className="h-4 w-4 shrink-0 accent-[#e50000]"/><div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/5 text-xs font-black text-neutral-500">{item.mediaUrl?<img src={item.mediaUrl} alt="" className="h-full w-full object-cover"/>:"T"}</div><div className="min-w-0 flex-1"><p className="truncate text-xs font-black">{item.name}</p><p className="mt-1 truncate text-[9px] text-neutral-600">{item.date||item.sourceUrl||"텍스트 항목"} · {Number(item.winCount||0)}승</p></div><button onClick={()=>setCandidateForm({...item})} className="rounded-lg bg-white/5 p-2 text-neutral-400"><Pencil size={13}/></button><button disabled={busy} onClick={()=>removeCandidates([item.id])} className="rounded-lg bg-accent/10 p-2 text-accent"><Trash2 size={13}/></button></div>):<p className="rounded-2xl border border-dashed border-white/10 py-10 text-center text-xs text-neutral-600">등록된 후보가 없습니다.</p>}</div>
  </div>;
}

function ArchiveAdmin({ onBack }) {
  const adminToday = getKstDate();
  const [adminTodayYear, adminTodayMonth] = adminToday.split("-").map(Number);
  const blank = { title: "", date: adminToday, link: "", account: "", mainCategory: "무대영상", subCategory: "음악방송", rawKeywords: "", thumbnailUrl: "" };
  const [adminTab, setAdminTab] = useState("list");
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const listRequestRef = useRef(0);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blank);
  const [formOpen, setFormOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [thumbnailBusy, setThumbnailBusy] = useState(false);
  const [thumbnailMessage, setThumbnailMessage] = useState("");
  const [adminKeywordOptions, setAdminKeywordOptions] = useState([]);
  const [keywordSelectValue, setKeywordSelectValue] = useState("");
  const [query, setQuery] = useState("");
  const [mainFilter, setMainFilter] = useState("전체");
  const [subFilter, setSubFilter] = useState("전체");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedMain, setSelectedMain] = useState([]);
  const [bulkDate, setBulkDate] = useState("");
  const [bulkSub, setBulkSub] = useState("");
  const [adminYear, setAdminYear] = useState(adminTodayYear);
  const [adminMonth, setAdminMonth] = useState(adminTodayMonth);
  const [adminDate, setAdminDate] = useState(adminToday);
  const [calendarMonthItems, setCalendarMonthItems] = useState([]);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarError, setCalendarError] = useState("");
  const calendarRequestRef = useRef(0);
  const [rawItems, setRawItems] = useState([]);
  const [rawLoaded, setRawLoaded] = useState(false);
  const [selectedRaw, setSelectedRaw] = useState([]);
  const [rawAccount, setRawAccount] = useState("");
  const [rawFrom, setRawFrom] = useState("");
  const [rawTo, setRawTo] = useState("");
  const [rawBulkDate, setRawBulkDate] = useState("");
  const [rawBulkSub, setRawBulkSub] = useState("");
  const [twitterId, setTwitterId] = useState("");
  const [twitterFrom, setTwitterFrom] = useState("");
  const [twitterTo, setTwitterTo] = useState("");
  const calendarMonthKey = `${adminYear}-${pad(adminMonth)}`;
  const formKeywords = useMemo(() => uniqueKeywords(Array.isArray(form.keywords) && form.keywords.length ? form.keywords : parseKeywordText(form.rawKeywords)), [form.keywords, form.rawKeywords]);
  const keywordOptions = useMemo(() => uniqueKeywords([...adminKeywordOptions, ...formKeywords]).sort((a, b) => a.localeCompare(b, "ko")), [adminKeywordOptions, formKeywords]);
  const calendarItems = calendarMonthItems.filter((item) => item.date === adminDate);
  const rawFiltered = rawItems.filter((item) => (!rawAccount || item.account.toLowerCase().includes(rawAccount.toLowerCase())) && (!rawFrom || item.date >= rawFrom) && (!rawTo || item.date <= rawTo));
  const selectedMainItems = items.filter((item) => selectedMain.includes(item.id));
  const selectedRawItems = rawItems.filter((item) => selectedRaw.includes(item.id));
  const adminYears = Array.from({ length: 12 }, (_, index) => 2017 + index);
  const loadList = async (nextPage = page) => {
    const requestId = ++listRequestRef.current;
    setLoading(true); setLoadError("");
    try {
      const result = await archiveService.adminPage({ page: nextPage, limit: 100, query, mainCategory: mainFilter, subCategory: subFilter, dateFrom, dateTo, status: "published" });
      if (requestId !== listRequestRef.current) return;
      setItems(result.items || []); setTotal(result.total || 0); setPage(nextPage); setSelectedMain([]);
    } catch (error) { if (requestId === listRequestRef.current) setLoadError(error.message || "관리자 기록을 불러오지 못했습니다."); }
    finally { if (requestId === listRequestRef.current) setLoading(false); }
  };
  const loadCalendar = async () => {
    const requestId = ++calendarRequestRef.current;
    const start = `${adminYear}-${pad(adminMonth)}-01`;
    const end = `${adminYear}-${pad(adminMonth)}-${pad(new Date(adminYear, adminMonth, 0).getDate())}`;
    setCalendarLoading(true); setCalendarError("");
    try {
      const result = await archiveService.adminAll({ dateFrom: start, dateTo: end, status: "published" });
      if (requestId !== calendarRequestRef.current) return;
      setCalendarMonthItems(result.items || []);
    } catch (error) { if (requestId === calendarRequestRef.current) { setCalendarError(error.message || "관리자 캘린더를 불러오지 못했습니다."); setCalendarMonthItems([]); } }
    finally { if (requestId === calendarRequestRef.current) setCalendarLoading(false); }
  };
  useEffect(() => {
    if (adminTab !== "list") return undefined;
    const timer = window.setTimeout(() => loadList(1), 250);
    return () => window.clearTimeout(timer);
  }, [adminTab, query, mainFilter, subFilter, dateFrom, dateTo]);
  useEffect(() => {
    let active = true;
    keywordService.list().then((result) => {
      if (active) setAdminKeywordOptions(Array.isArray(result.tags) ? result.tags : []);
    }).catch(() => {
      if (active) setAdminKeywordOptions([]);
    });
    return () => { active = false; };
  }, []);
  useEffect(() => { if (adminTab === "calendar") loadCalendar(); }, [adminTab, adminYear, adminMonth]);
  const reloadCurrent = async () => { if (adminTab === "calendar") await loadCalendar(); else await loadList(page); };
  const openForm = (item = null, date = null) => { setEditing(item); setForm(item ? { ...item, rawKeywords: item.rawKeywords || item.keywords?.join(", ") || "" } : { ...blank, date: date || blank.date }); setThumbnailMessage(""); setFormOpen(true); };
  const update = (key, value) => { setThumbnailMessage(""); setForm((current) => key === "subCategory" ? { ...current, subCategory: value, mainCategory: mainCategoryFor(value) } : { ...current, [key]: value }); };
  const updateKeywords = (nextKeywords) => {
    const keywords = uniqueKeywords(nextKeywords);
    setKeywordSelectValue("");
    setForm((current) => ({ ...current, keywords, rawKeywords: keywords.join(", ") }));
  };
  const addKeyword = (value) => { if (value) updateKeywords([...formKeywords, value]); };
  const removeKeyword = (value) => updateKeywords(formKeywords.filter((keyword) => keyword !== value));
  const loadTweetThumbnail = async () => {
    const sourceUrl = String(form.link || "").trim();
    if (!sourceUrl) return alert("먼저 트위터/X 랜딩 링크를 입력해주세요.");
    setThumbnailBusy(true); setThumbnailMessage("");
    try {
      tweetMediaCache.delete(sourceUrl);
      const resolved = await resolveTweetMedia(sourceUrl);
      const thumbnailUrl = resolved?.thumbnailUrl || resolved?.thumbnail_url || resolved?.preview_image_url || resolved?.poster || (!resolved?.isVideo ? resolved?.url : "") || "";
      if (!thumbnailUrl) {
        setThumbnailMessage("불러올 썸네일을 찾지 못했습니다.");
        return;
      }
      update("thumbnailUrl", thumbnailUrl);
      setThumbnailMessage("트위터 미디어 썸네일을 불러왔습니다. 저장을 눌러 반영하세요.");
    } catch (error) {
      setThumbnailMessage(error.message || "썸네일을 불러오지 못했습니다.");
    } finally {
      setThumbnailBusy(false);
    }
  };
  const save = async (event) => {
    event.preventDefault(); setBusy(true);
    try {
      const wasRaw = editing?._raw;
      if (wasRaw) await archiveService.updateRaw(editing.id, form);
      else if (editing) await archiveService.update(editing.id, form);
      else await archiveService.create(form);
      if (wasRaw) await loadRaw(); else await reloadCurrent();
      setEditing(null); setForm(blank); setThumbnailMessage(""); setFormOpen(false); alert(editing ? "수정했습니다." : "추가했습니다.");
    } catch (error) { alert(error.message); } finally { setBusy(false); }
  };
  const remove = async (item) => {
    if (!confirm(`「${item.title}」 기록을 삭제할까요?`)) return;
    setBusy(true); try { await archiveService.remove(item.id); await reloadCurrent(); } catch (error) { alert(error.message); } finally { setBusy(false); }
  };
  const loadRaw = async () => { setBusy(true); try { setRawItems(await archiveService.rawList()); setRawLoaded(true); setSelectedRaw([]); } catch (error) { alert(error.message); } finally { setBusy(false); } };
  const runMany = async (targets, action) => { let success = 0; let failed = 0; for (const item of targets) { try { await action(item); success++; } catch { failed++; } } return { success, failed }; };
  const applyBulk = async (source) => {
    const isRaw = source === "raw"; const targets = isRaw ? selectedRawItems : selectedMainItems; const nextDate = isRaw ? rawBulkDate : bulkDate; const nextSub = isRaw ? rawBulkSub : bulkSub;
    if (!targets.length) return alert("선택된 항목이 없습니다.");
    if (!nextDate && !nextSub) return alert("변경할 날짜 또는 소분류를 선택해주세요.");
    if (!confirm(`선택한 ${targets.length}개 항목을 일괄 수정할까요?`)) return;
    setBusy(true);
    const result = await runMany(targets, (item) => { const updated = { ...item, date: nextDate || item.date, subCategory: nextSub || item.subCategory, mainCategory: nextSub ? mainCategoryFor(nextSub) : item.mainCategory }; return isRaw ? archiveService.updateRaw(item.id, updated) : archiveService.update(item.id, updated); });
    if (isRaw) { await loadRaw(); setRawBulkDate(""); setRawBulkSub(""); } else { await reloadCurrent(); setSelectedMain([]); setBulkDate(""); setBulkSub(""); }
    setBusy(false); alert(`완료 ${result.success}건${result.failed ? ` · 실패 ${result.failed}건` : ""}`);
  };
  const refreshSelectedThumbnails = async (source = "main") => {
    const isRaw = source === "raw";
    const targets = isRaw ? selectedRawItems : selectedMainItems;
    if (!targets.length) return alert("선택된 항목이 없습니다.");
    if (!confirm(`선택한 ${targets.length}개 기록의 썸네일 URL을 다시 불러올까요? 기존 썸네일 URL은 새 값으로 교체됩니다.`)) return;
    setBusy(true);
    try {
      const result = await archiveService.refreshThumbnails(targets.map((item) => item.id));
      const updates = new Map((result.items || []).map((item) => [item.id, item.thumbnailUrl]));
      const applyUpdates = (current) => current.map((item) => updates.has(item.id) ? { ...item, thumbnailUrl: updates.get(item.id) || "" } : item);
      if (isRaw) setRawItems(applyUpdates);
      else {
        setItems(applyUpdates);
        setCalendarMonthItems(applyUpdates);
      }
      alert(`썸네일 갱신 ${result.updated || 0}건${result.skipped ? ` · 실패/건너뜀 ${result.skipped}건` : ""}`);
    } catch (error) {
      alert(error.message || "썸네일을 불러오지 못했습니다.");
    } finally {
      setBusy(false);
    }
  };
  const removeSelectedMain = async () => {
    if (!selectedMainItems.length || !confirm(`선택한 ${selectedMainItems.length}개 기록을 영구 삭제할까요?`)) return;
    setBusy(true); const result = await runMany(selectedMainItems, (item) => archiveService.remove(item.id)); await reloadCurrent(); setSelectedMain([]); setBusy(false); alert(`삭제 ${result.success}건${result.failed ? ` · 실패 ${result.failed}건` : ""}`);
  };
  const publishRaw = async (item) => { setBusy(true); try { await archiveService.publishRaw(item.id); setRawItems((current) => current.filter((raw) => raw.id !== item.id)); setSelectedRaw((current) => current.filter((id) => id !== item.id)); await loadList(1); alert("메인 아카이브에 게시했습니다."); } catch (error) { alert(error.message); } finally { setBusy(false); } };
  const publishSelectedRaw = async () => {
    if (!selectedRawItems.length || !confirm(`선택한 ${selectedRawItems.length}개를 메인 시트에 게시할까요?`)) return;
    setBusy(true); const result = await runMany(selectedRawItems, (item) => archiveService.publishRaw(item.id)); const done = new Set(selectedRawItems.map((item) => item.id)); setRawItems((current) => current.filter((item) => !done.has(item.id))); setSelectedRaw([]); await loadList(1); setBusy(false); alert(`게시 ${result.success}건${result.failed ? ` · 실패 ${result.failed}건` : ""}`);
  };
  const removeRaw = async (item) => { if (!confirm(`「${item.title}」 임시 데이터를 삭제할까요?`)) return; setBusy(true); try { await archiveService.removeRaw(item.id); setRawItems((current) => current.filter((raw) => raw.id !== item.id)); } catch (error) { alert(error.message); } finally { setBusy(false); } };
  const removeSelectedRaw = async () => {
    if (!selectedRawItems.length || !confirm(`선택한 ${selectedRawItems.length}개를 Raw 시트에서 영구 삭제할까요?`)) return;
    setBusy(true); const result = await runMany(selectedRawItems, (item) => archiveService.removeRaw(item.id)); const done = new Set(selectedRawItems.map((item) => item.id)); setRawItems((current) => current.filter((item) => !done.has(item.id))); setSelectedRaw([]); setBusy(false); alert(`삭제 ${result.success}건${result.failed ? ` · 실패 ${result.failed}건` : ""}`);
  };
  const fetchTwitter = async () => {
    if (!twitterId || !twitterFrom || !twitterTo) return alert("트위터 계정과 시작·종료 날짜를 모두 입력해주세요.");
    if (twitterFrom > twitterTo) return alert("시작 날짜가 종료 날짜보다 늦을 수 없습니다.");
    setBusy(true); try { const result = await archiveService.fetchTwitter({ twitterId, startDate: twitterFrom, endDate: twitterTo }); alert(`${result.count || 0}개의 트윗을 Raw 시트에 추가했습니다.`); await loadRaw(); } catch (error) { alert(error.message); } finally { setBusy(false); }
  };
  const toggle = (id, raw = false) => { const setter = raw ? setSelectedRaw : setSelectedMain; setter((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]); };
  const toggleAll = (rows, raw = false) => { const setter = raw ? setSelectedRaw : setSelectedMain; const ids = rows.map((item) => item.id); setter((current) => ids.every((id) => current.includes(id)) ? current.filter((id) => !ids.includes(id)) : [...new Set([...current, ...ids])]); };
  const recordRows = (rows, raw = false, selectable = false) => <div className="mt-4 space-y-2">{rows.map((item)=><article key={item.id} className={cn("flex items-center gap-2 rounded-2xl border bg-white/[.03] p-3", (raw ? selectedRaw : selectedMain).includes(item.id) ? "border-accent/60" : "border-white/10")}>{selectable && <input aria-label={`${item.title} 선택`} type="checkbox" checked={(raw ? selectedRaw : selectedMain).includes(item.id)} onChange={()=>toggle(item.id,raw)} className="h-4 w-4 shrink-0 accent-[#e50000]"/>}{item.thumbnailUrl ? <img src={item.thumbnailUrl} alt="" className="h-12 w-16 shrink-0 rounded-lg object-cover"/> : <div className="h-12 w-16 shrink-0 rounded-lg bg-neutral-900"/>}<div className="min-w-0 flex-1"><div className="flex text-[9px] font-bold"><span className="text-accent">{item.subCategory}</span><time className="ml-auto text-neutral-600">{item.date}</time></div><p className="mt-1 line-clamp-2 text-xs font-bold">{item.title}</p></div>{raw ? <><button disabled={busy} onClick={()=>publishRaw(item)} className="rounded-lg bg-accent px-2 py-2 text-[10px] font-black">게시</button><button disabled={busy} onClick={()=>openForm({...item,_raw:true})} className="rounded-lg bg-white/5 p-2 text-neutral-400"><Pencil size={14}/></button><button disabled={busy} onClick={()=>removeRaw(item)} className="rounded-lg bg-accent/10 p-2 text-accent"><Trash2 size={14}/></button></> : <><button disabled={busy} onClick={()=>openForm(item)} className="rounded-lg bg-white/5 p-2 text-neutral-400"><Pencil size={14}/></button><button disabled={busy} onClick={()=>remove(item)} className="rounded-lg bg-accent/10 p-2 text-accent"><Trash2 size={14}/></button></>}</article>)}</div>;
  const inlineEditForm = () => <form onSubmit={save} className="mt-2 rounded-2xl border border-accent/30 bg-accent/5 p-4">
    <div className="mb-3 flex items-center"><h3 className="text-sm font-black">기록 수정</h3><button type="button" aria-label="수정 닫기" onClick={() => {setEditing(null);setForm(blank);setThumbnailMessage("");setFormOpen(false);}} className="ml-auto"><X size={16}/></button></div>
    <div className="grid grid-cols-2 gap-2">
      <AdminInput label="날짜" type="date" value={form.date} onChange={(v)=>update("date",v)} required/>
      <AdminInput label="계정" value={form.account} onChange={(v)=>update("account",v)}/>
      <AdminSelect label="대분류" value={form.mainCategory} onChange={(value)=>setForm((current)=>({...current,mainCategory:value,subCategory:CATEGORY_MAP[value]?.includes(current.subCategory)?current.subCategory:CATEGORY_MAP[value]?.[0]||"기타"}))} options={Object.keys(CATEGORY_MAP)}/>
      <AdminSelect label="소분류" value={form.subCategory} onChange={(v)=>update("subCategory",v)} options={SUB_CATEGORY_OPTIONS}/>
    </div>
    <div className="mt-2 space-y-2"><AdminInput label="제목" value={form.title} onChange={(v)=>update("title",v)} required/><AdminInput label="트윗 링크" type="url" value={form.link} onChange={(v)=>update("link",v)} required/><div><span className="mb-1 ml-1 block text-[9px] font-bold text-neutral-600">트위터 썸네일 링크</span><div className="flex gap-2"><input type="url" value={form.thumbnailUrl || ""} onChange={(event)=>update("thumbnailUrl",event.target.value)} className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black px-3 py-2.5 text-xs outline-none focus:border-accent"/><button type="button" disabled={busy || thumbnailBusy || !form.link} onClick={loadTweetThumbnail} className="shrink-0 rounded-xl border border-[#1DA1F2]/40 bg-[#1DA1F2]/10 px-3 text-[10px] font-black text-[#55acee] disabled:opacity-40">{thumbnailBusy ? "불러오는 중…" : "썸네일 불러오기"}</button></div>{thumbnailMessage && <p className="mt-1 ml-1 text-[9px] font-bold text-neutral-500">{thumbnailMessage}</p>}</div><ArchiveKeywordSelect selected={formKeywords} options={keywordOptions} value={keywordSelectValue} onChange={(value)=>{setKeywordSelectValue(value);addKeyword(value);}} onRemove={removeKeyword}/></div>
    <button disabled={busy} className="mt-3 w-full rounded-xl bg-white py-3 text-xs font-black text-black disabled:opacity-50">{busy ? "저장 중…" : "Supabase에 저장"}</button>
  </form>;
  const recordRowsInline = (rows, raw = false, selectable = false) => <div className="mt-4 space-y-2">{rows.map((item) => {
    const selected = (raw ? selectedRaw : selectedMain).includes(item.id);
    const isEditing = formOpen && editing && String(editing.id) === String(item.id) && Boolean(editing._raw) === raw;
    const editItem = () => openForm(raw ? { ...item, _raw: true } : item);
    return <div key={item.id}>
      <article className={cn("flex items-center gap-2 rounded-2xl border bg-white/[.03] p-3", selected ? "border-accent/60" : "border-white/10", isEditing && "border-accent/40 bg-accent/5")}>
        {selectable && <input aria-label={`${item.title} 선택`} type="checkbox" checked={selected} onChange={()=>toggle(item.id,raw)} className="h-4 w-4 shrink-0 accent-[#e50000]"/>}
        <button type="button" onClick={editItem} className="flex min-w-0 flex-1 items-center gap-2 text-left">
          {item.thumbnailUrl ? <img src={item.thumbnailUrl} alt="" className="h-12 w-16 shrink-0 rounded-lg object-cover"/> : <span className="h-12 w-16 shrink-0 rounded-lg bg-neutral-900"/>}
          <span className="min-w-0 flex-1"><span className="flex text-[9px] font-bold"><span className="text-accent">{item.subCategory}</span><time className="ml-auto text-neutral-600">{item.date}</time></span><span className="mt-1 line-clamp-2 block text-xs font-bold">{item.title}</span></span>
        </button>
        {raw ? <><button disabled={busy} onClick={()=>publishRaw(item)} className="rounded-lg bg-accent px-2 py-2 text-[10px] font-black">게시</button><button aria-label={`${item.title} 수정`} disabled={busy} onClick={editItem} className="rounded-lg bg-white/5 p-2 text-neutral-400"><Pencil size={14}/></button><button disabled={busy} onClick={()=>removeRaw(item)} className="rounded-lg bg-accent/10 p-2 text-accent"><Trash2 size={14}/></button></> : <><button aria-label={`${item.title} 수정`} disabled={busy} onClick={editItem} className="rounded-lg bg-white/5 p-2 text-neutral-400"><Pencil size={14}/></button><button disabled={busy} onClick={()=>remove(item)} className="rounded-lg bg-accent/10 p-2 text-accent"><Trash2 size={14}/></button></>}
      </article>
      {isEditing && inlineEditForm()}
    </div>;
  })}</div>;
  const bulkPanel = (raw = false) => { const count = raw ? selectedRaw.length : selectedMain.length; const date = raw ? rawBulkDate : bulkDate; const sub = raw ? rawBulkSub : bulkSub; return <div className={cn("mt-3 rounded-2xl border p-3",count ? "border-accent/40 bg-accent/5" : "border-white/10 bg-white/[.02]")}><div className="flex items-center"><p className="text-xs font-black">선택 항목 일괄 수정 <span className="text-accent">{count}개</span></p>{count>0&&<button onClick={()=>raw?setSelectedRaw([]):setSelectedMain([])} className="ml-auto text-[10px] font-bold text-neutral-500">선택 해제</button>}</div><div className="mt-3 grid grid-cols-2 gap-2"><AdminInput label="날짜 변경" type="date" value={date} onChange={raw?setRawBulkDate:setBulkDate}/><AdminSelect label="소분류 변경" value={sub} onChange={raw?setRawBulkSub:setBulkSub} options={["변경 안 함",...SUB_CATEGORY_OPTIONS]} emptyValue/></div>{sub&&<p className="mt-2 text-[10px] font-bold text-neutral-500">대분류는 <span className="text-accent">{mainCategoryFor(sub)}</span>로 자동 설정됩니다.</p>}<div className="mt-3 grid grid-cols-2 gap-2"><button disabled={!count||busy} onClick={()=>applyBulk(raw?"raw":"main")} className="rounded-xl bg-accent py-2.5 text-xs font-black disabled:bg-neutral-800 disabled:text-neutral-600">선택한 {count}개에 적용</button><button disabled={!count||busy} onClick={()=>refreshSelectedThumbnails(raw?"raw":"main")} className="rounded-xl border border-[#1DA1F2]/40 bg-[#1DA1F2]/10 py-2.5 text-xs font-black text-[#55acee] disabled:opacity-40">썸네일 URL 불러오기</button></div></div>; };

  return <div className="pt-5">
    <div className="flex items-center"><button onClick={onBack} className="flex items-center gap-1 text-xs font-bold text-neutral-500"><ChevronLeft size={15}/>관리자 선택</button></div>
    <div className="mt-4 grid grid-cols-3 border-b border-white/10">{[["list","목록 관리"],["calendar","캘린더 관리"],["import","불러오기"]].map(([key,label])=><button key={key} onClick={()=>{setAdminTab(key);setFormOpen(false);}} className={cn("border-b-2 py-3 text-[11px] font-black",adminTab===key?"border-accent text-white":"border-transparent text-neutral-600")}>{label}</button>)}</div>
    {adminTab === "list" && <><button onClick={() => openForm()} className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-accent py-3.5 text-xs font-black"><Plus size={16}/>새 기록 추가</button><div className="mt-3"><SearchBar value={query} onChange={setQuery} placeholder="관리할 기록 검색"/></div><div className="mt-3 grid grid-cols-2 gap-2"><AdminSelect label="대분류 필터" value={mainFilter} onChange={(value)=>{setMainFilter(value);setSubFilter("전체");}} options={["전체",...Object.keys(CATEGORY_MAP)]}/><AdminSelect label="소분류 필터" value={subFilter} onChange={(value)=>{setSubFilter(value);if(value!=="전체")setMainFilter(mainCategoryFor(value));}} options={["전체",...SUB_CATEGORY_OPTIONS]}/><AdminInput label="시작 날짜" type="date" value={dateFrom} onChange={setDateFrom}/><AdminInput label="종료 날짜" type="date" value={dateTo} onChange={setDateTo}/></div><div className="mt-3 flex items-center"><label className="flex items-center gap-2 text-[11px] font-bold text-neutral-400"><input type="checkbox" checked={items.length>0&&items.every((item)=>selectedMain.includes(item.id))} onChange={()=>toggleAll(items)} className="h-4 w-4 accent-[#e50000]"/>현재 페이지 전체 선택</label><button disabled={!selectedMain.length||busy} onClick={removeSelectedMain} className="ml-auto rounded-lg bg-accent/10 px-3 py-2 text-[10px] font-black text-accent disabled:opacity-40">선택 삭제</button></div>{bulkPanel()}<p className="mt-2 text-right text-[10px] font-bold text-neutral-600">검색 결과 {total}개 · {page}페이지</p></>}
    {adminTab === "calendar" && <div className="mt-4"><div className="rounded-2xl border border-white/10 bg-white/[.03] p-3"><div className="flex items-center justify-center gap-2"><AdminSelect label="년도" value={String(adminYear)} onChange={(value)=>{setAdminYear(+value);setAdminDate(`${value}-${pad(adminMonth)}-01`);}} options={adminYears.map(String)}/><AdminSelect label="월" value={String(adminMonth)} onChange={(value)=>{setAdminMonth(+value);setAdminDate(`${adminYear}-${pad(value)}-01`);}} options={Array.from({length:12},(_,i)=>String(i+1))}/></div><div className="mt-4 grid grid-cols-7 text-center text-[9px] font-bold text-neutral-600">{["일","월","화","수","목","금","토"].map((value)=><span key={value}>{value}</span>)}</div><div className="mt-2 grid grid-cols-7 gap-y-1">{Array.from({length:new Date(adminYear,adminMonth-1,1).getDay()}).map((_,i)=><span key={`admin-empty-${i}`}/>)}{Array.from({length:new Date(adminYear,adminMonth,0).getDate()},(_,i)=>i+1).map((value)=>{const date=`${calendarMonthKey}-${pad(value)}`;const has=calendarMonthItems.some((item)=>item.date===date);return <button key={value} onClick={()=>setAdminDate(date)} className={cn("relative mx-auto flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold",adminDate===date?"bg-accent text-white":"text-neutral-400")}>{value}{has&&adminDate!==date&&<span className="absolute bottom-1 h-1 w-1 rounded-full bg-accent"/>}</button>})}</div></div><div className="mt-4 flex items-center"><p className="text-xs font-black">{adminDate} <span className="text-neutral-500">{calendarItems.length}개</span></p><button onClick={()=>openForm(null,adminDate)} className="ml-auto rounded-lg bg-accent px-3 py-2 text-[10px] font-black">+ 추가</button></div></div>}
    {adminTab === "import" && <div className="mt-4"><div className="rounded-2xl border border-[#1DA1F2]/30 bg-[#1DA1F2]/5 p-4"><h3 className="text-sm font-black text-[#55acee]">트위터 데이터 수집</h3><AdminInput label="트위터 계정 ID (@ 제외)" value={twitterId} onChange={setTwitterId}/><div className="mt-2 grid grid-cols-2 gap-2"><AdminInput label="시작 날짜" type="date" value={twitterFrom} onChange={setTwitterFrom}/><AdminInput label="종료 날짜" type="date" value={twitterTo} onChange={setTwitterTo}/></div><button disabled={busy} onClick={fetchTwitter} className="mt-3 w-full rounded-xl bg-[#1DA1F2] py-3 text-xs font-black disabled:opacity-50">{busy?"수집 중…":"트윗 수집하여 Raw 시트에 추가"}</button></div><div className="mt-4 rounded-2xl border border-white/10 bg-white/[.03] p-4"><h3 className="text-sm font-black">Raw 데이터 조회 및 게시</h3><AdminInput label="계정 필터 (선택)" value={rawAccount} onChange={setRawAccount}/><div className="mt-2 grid grid-cols-2 gap-2"><AdminInput label="시작 날짜" type="date" value={rawFrom} onChange={setRawFrom}/><AdminInput label="종료 날짜" type="date" value={rawTo} onChange={setRawTo}/></div><button disabled={busy} onClick={loadRaw} className="mt-3 w-full rounded-xl bg-accent py-3 text-xs font-black">{busy?"불러오는 중…":"Raw 데이터 조회하기"}</button></div>{rawLoaded&&<><div className="mt-3 flex items-center"><label className="flex items-center gap-2 text-[11px] font-bold text-neutral-400"><input type="checkbox" checked={rawFiltered.length>0&&rawFiltered.every((item)=>selectedRaw.includes(item.id))} onChange={()=>toggleAll(rawFiltered,true)} className="h-4 w-4 accent-[#e50000]"/>전체 선택</label><span className="ml-2 text-[10px] font-bold text-neutral-600">{rawFiltered.length}개</span><button disabled={!selectedRaw.length||busy} onClick={removeSelectedRaw} className="ml-auto rounded-lg bg-accent/10 px-2.5 py-2 text-[10px] font-black text-accent disabled:opacity-40">삭제</button><button disabled={!selectedRaw.length||busy} onClick={publishSelectedRaw} className="ml-2 rounded-lg bg-accent px-2.5 py-2 text-[10px] font-black disabled:opacity-40">게시 ({selectedRaw.length})</button></div>{bulkPanel(true)}</>}</div>}
    {formOpen && !editing && <form onSubmit={save} className="mt-4 rounded-2xl border border-accent/30 bg-accent/5 p-4">
      <div className="mb-3 flex items-center"><h3 className="text-sm font-black">{editing ? "기록 수정" : "새 기록"}</h3><button type="button" onClick={() => {setEditing(null);setForm(blank);setThumbnailMessage("");setFormOpen(false);}} className="ml-auto"><X size={16}/></button></div>
      <div className="grid grid-cols-2 gap-2">
        <AdminInput label="날짜" type="date" value={form.date} onChange={(v)=>update("date",v)} required/>
        <AdminInput label="계정" value={form.account} onChange={(v)=>update("account",v)}/>
        <AdminSelect label="대분류" value={form.mainCategory} onChange={(value)=>setForm((current)=>({...current,mainCategory:value,subCategory:CATEGORY_MAP[value]?.includes(current.subCategory)?current.subCategory:CATEGORY_MAP[value]?.[0]||"기타"}))} options={Object.keys(CATEGORY_MAP)}/>
        <AdminSelect label="소분류" value={form.subCategory} onChange={(v)=>update("subCategory",v)} options={SUB_CATEGORY_OPTIONS}/>
      </div>
      <div className="mt-2 space-y-2"><AdminInput label="제목" value={form.title} onChange={(v)=>update("title",v)} required/><AdminInput label="랜딩 링크" type="url" value={form.link} onChange={(v)=>update("link",v)} required/><div><span className="mb-1 ml-1 block text-[9px] font-bold text-neutral-600">트위터 썸네일 링크</span><div className="flex gap-2"><input type="url" value={form.thumbnailUrl || ""} onChange={(event)=>update("thumbnailUrl",event.target.value)} className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black px-3 py-2.5 text-xs outline-none focus:border-accent"/><button type="button" disabled={busy || thumbnailBusy || !form.link} onClick={loadTweetThumbnail} className="shrink-0 rounded-xl border border-[#1DA1F2]/40 bg-[#1DA1F2]/10 px-3 text-[10px] font-black text-[#55acee] disabled:opacity-40">{thumbnailBusy ? "불러오는 중…" : "썸네일 불러오기"}</button></div>{thumbnailMessage && <p className="mt-1 ml-1 text-[9px] font-bold text-neutral-500">{thumbnailMessage}</p>}</div><ArchiveKeywordSelect selected={formKeywords} options={keywordOptions} value={keywordSelectValue} onChange={(value)=>{setKeywordSelectValue(value);addKeyword(value);}} onRemove={removeKeyword}/></div>
      <button disabled={busy} className="mt-3 w-full rounded-xl bg-white py-3 text-xs font-black text-black disabled:opacity-50">{busy ? "저장 중…" : "Supabase에 저장"}</button>
    </form>}
    {adminTab === "list" && (loading ? <div className="mt-4"><ListSkeleton/></div> : loadError ? <LoadError message={loadError}/> : <>{recordRowsInline(items,false,true)}<div className="mt-4 grid grid-cols-2 gap-2"><button disabled={page<=1||loading} onClick={()=>loadList(page-1)} className="rounded-xl bg-white/5 py-3 text-xs font-bold disabled:opacity-30">이전</button><button disabled={page*100>=total||loading} onClick={()=>loadList(page+1)} className="rounded-xl bg-white/5 py-3 text-xs font-bold disabled:opacity-30">다음</button></div></>)}
    {adminTab === "calendar" && (calendarLoading ? <div className="mt-4"><ListSkeleton/></div> : calendarError ? <LoadError message={calendarError}/> : recordRowsInline(calendarItems))}
    {adminTab === "import" && rawLoaded && recordRowsInline(rawFiltered.slice(0,100), true, true)}
  </div>;
}

function AdminInput({ label, value, onChange, type = "text", required = false }) {
  return <label className="block"><span className="mb-1 ml-1 block text-[9px] font-bold text-neutral-600">{label}</span><input required={required} type={type} value={value || ""} onChange={(event)=>onChange(event.target.value)} className="w-full rounded-xl border border-white/10 bg-black px-3 py-2.5 text-xs outline-none focus:border-accent"/></label>;
}

function AdminSelect({ label, value, onChange, options, emptyValue = false }) {
  return <label className="block min-w-0"><span className="mb-1 ml-1 block text-[9px] font-bold text-neutral-600">{label}</span><select value={value} onChange={(event)=>onChange(event.target.value)} className="w-full rounded-xl border border-white/10 bg-black px-2 py-2.5 text-xs outline-none focus:border-accent">{options.map((option,index)=><option key={`${option}-${index}`} value={emptyValue&&index===0?"":option}>{option}</option>)}</select></label>;
}

function ArchiveKeywordSelect({ selected = [], options = [], value = "", onChange, onRemove }) {
  const available = options.filter((option) => !selected.includes(option));
  return <div>
    <span className="mb-1 ml-1 block text-[9px] font-bold text-neutral-600">키워드</span>
    <div className="mb-2 flex min-h-10 flex-wrap gap-1.5 rounded-xl border border-white/10 bg-black p-2">
      {selected.length ? selected.map((keyword) => <button key={keyword} type="button" onClick={()=>onRemove(keyword)} className="rounded-full border border-accent/30 bg-accent/10 px-2.5 py-1 text-[10px] font-black text-accent">{keyword} ×</button>) : <span className="px-1 py-1.5 text-[10px] font-bold text-neutral-600">선택된 키워드 없음</span>}
    </div>
    <select value={value} onChange={(event)=>onChange(event.target.value)} className="w-full rounded-xl border border-white/10 bg-black px-2 py-2.5 text-xs outline-none focus:border-accent">
      <option value="">키워드 선택</option>
      {available.map((option) => <option key={option} value={option}>{option}</option>)}
    </select>
  </div>;
}

function ArchiveSkeleton() {
  return <div aria-label="기록 불러오는 중" className="grid grid-cols-2 gap-x-3 gap-y-5">{Array.from({length:6},(_,index)=><div key={index} className="animate-pulse"><div className="aspect-[16/9] rounded-xl bg-neutral-900"/><div className="mt-2 flex items-center"><span className="h-3 w-12 rounded bg-neutral-900"/><span className="ml-auto h-2.5 w-16 rounded bg-neutral-900"/></div><div className="mt-2 h-3 w-full rounded bg-neutral-900"/><div className="mt-1.5 h-3 w-2/3 rounded bg-neutral-900"/></div>)}</div>;
}

function ListSkeleton() {
  return <div aria-label="데이터 불러오는 중" className="space-y-3">{Array.from({length:4},(_,index)=><div key={index} className="flex animate-pulse gap-3 rounded-2xl border border-white/5 bg-white/[.02] p-3"><div className="h-14 w-16 rounded-xl bg-neutral-900"/><div className="flex-1"><div className="h-3 w-1/3 rounded bg-neutral-900"/><div className="mt-3 h-3 w-full rounded bg-neutral-900"/><div className="mt-2 h-3 w-2/3 rounded bg-neutral-900"/></div></div>)}</div>;
}

function LoadError({ message }) {
  return <div className="rounded-2xl border border-accent/20 bg-accent/5 px-4 py-10 text-center"><p className="text-xs font-bold text-neutral-400">{message}</p><p className="mt-2 text-[10px] text-neutral-600">잠시 후 다시 시도해주세요.</p></div>;
}

function EmptyState({text}) { return <div className="flex flex-col items-center py-20 text-center"><Archive size={28} className="text-neutral-800"/><p className="mt-3 text-xs font-bold text-neutral-600">{text}</p></div> }

function BottomNav({tab,onChange,items = APP_TABS}) {
  const visibleItems = items.length ? items : APP_TABS.filter((item) => item.key === "home");
  return <nav className="safe-bottom absolute inset-x-0 bottom-0 z-40 border-t border-white/10 bg-black/90 px-3 pt-2 backdrop-blur-2xl"><div className="grid" style={{ gridTemplateColumns: `repeat(${visibleItems.length}, minmax(0, 1fr))` }}>{visibleItems.map(({ key, icon: Icon, label })=><button key={key} onClick={()=>onChange(key)} className={cn("relative flex flex-col items-center gap-1 py-1 text-[10px] font-bold transition",tab===key?"text-white":"text-neutral-600")}><span className={cn("rounded-2xl px-4 py-1.5 transition",tab===key&&"bg-accent/15 text-accent")}><Icon size={20} strokeWidth={tab===key?2.6:2}/></span>{label}{tab===key&&<span className="absolute -bottom-1 h-1 w-1 rounded-full bg-accent"/>}</button>)}</div></nav>;
}
