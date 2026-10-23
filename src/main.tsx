import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Home,
  BookOpen,
  ChartNoAxesCombined,
  Wallet,
  Settings,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowLeftRight,
  ChevronLeft,
  ChevronRight,
  Search,
  Download,
  X,
  Pencil,
  Trash2,
  Check,
  Leaf,
  ArrowRight,
  CalendarDays,
  LayoutList,
  TrendingUp,
  Landmark,
  ShieldCheck,
} from "lucide-react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line,
} from "recharts";
import {
  type Data,
  type Transaction,
  type Account,
  emptyData,
  today,
  money,
  balance,
  totalAssets,
  creditDue,
  monthStats,
  previousMonth,
  endOfMonth,
  categories,
  assetTypes,
  validateData,
  refreshSnapshots,
  saveTransaction,
  recordSnapshot,
  sampleData,
  csv,
} from "./model";
import { loadData, persistData } from "./storage";
import "./style.css";
import { Character } from "./Character";
const colors = [
  "#8eb5a0",
  "#f4c87e",
  "#a7c9df",
  "#d3b7d7",
  "#e7b3a3",
  "#b6bc8c",
  "#a6b1d2",
  "#dbcaab",
];
const pages = ["홈", "가계부", "소비 분석", "자산", "설정"];
const icons = [Home, BookOpen, ChartNoAxesCombined, Wallet, Settings];
function App() {
  const [data, setData] = useState<Data>(emptyData),
    [ready, setReady] = useState(false),
    [fatal, setFatal] = useState(""),
    [page, setPage] = useState(0),
    [month, setMonth] = useState(today().slice(0, 7)),
    [toast, setToast] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [tx, setTx] = useState<Partial<Transaction> | null>(null),
    [account, setAccount] = useState<Partial<Account> | null>(null),
    [query, setQuery] = useState(""),
    [cat, setCat] = useState(""),
    [accFilter, setAccFilter] = useState(""),
    [calendar, setCalendar] = useState(false);
  const restoreRef = useRef<HTMLInputElement>(null);
  const lock = useRef(false);
  useEffect(() => {
    loadData()
      .then((d) => {
        setData(d);
        setReady(true);
      })
      .catch((e) => setFatal(String(e.message)));
  }, []);
  useEffect(() => {
    if (toast) {
      const id = setTimeout(() => setToast(""), 3500);
      return () => clearTimeout(id);
    }
  }, [toast]);
  async function commit(next: Data, message = "저장했어요") {
    if (lock.current) return false;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const valid = validateData(refreshSnapshots(validateData(next)));
      await persistData(valid);
      setData(valid);
      setToast(message);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function shift(n: number) {
    const [y, m] = month.split("-").map(Number);
    setMonth(new Date(y, m - 1 + n, 1).toLocaleDateString("sv-SE").slice(0, 7));
  }
  const stats = monthStats(data, month),
    prev = monthStats(data, previousMonth(month)),
    monthly = data.transactions.filter((t) => t.date.startsWith(month)),
    expenses = monthly.filter((t) => t.kind === "expense"),
    total = totalAssets(data, today()),
    prevTotal = totalAssets(data, endOfMonth(previousMonth(month))),
    assetChange = totalAssets(data, endOfMonth(month)) - prevTotal,
    delta = prev.expense
      ? Math.round(((stats.expense - prev.expense) / prev.expense) * 100)
      : null;
  const grouped = categories
    .map((name) => ({
      name,
      value: expenses
        .filter((t) => t.category === name)
        .reduce((s, t) => s + t.amount, 0),
    }))
    .filter((x) => x.value)
    .sort((a, b) => b.value - a.value);
  const recent = [...monthly].sort(
    (a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id),
  );
  const days = new Date(
    Number(month.slice(0, 4)),
    Number(month.slice(5)),
    0,
  ).getDate();
  const daily = Array.from({ length: days }, (_, i) => ({
    day: i + 1,
    amount: expenses
      .filter((t) => Number(t.date.slice(-2)) === i + 1)
      .reduce((s, t) => s + t.amount, 0),
  }));
  function addTx() {
    if (!data.accounts.length) {
      setAccount({ date: today(), type: assetTypes[0], opening: 0 });
      setToast("먼저 자금 계좌를 하나 등록해 주세요.");
      return;
    }
    setTx({
      date: today(),
      kind: "expense",
      accountId: data.accounts[0].id,
      payment: "cash",
      category: "식비",
      fixed: false,
      memo: "",
    });
    setError("");
  }
  function download(content: string, name: string, type: string) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function restore(file?: File) {
    if (!file) return;
    try {
      if (file.size > 20_000_000)
        throw Error("백업 파일은 20MB 이하만 지원합니다.");
      const d = validateData(JSON.parse(await file.text()));
      if (
        confirm(
          `현재 데이터를 백업 파일의 계좌 ${d.accounts.length}개, 거래 ${d.transactions.length}개로 교체할까요? 기존 데이터는 덮어씁니다.`,
        )
      )
        await commit(d, "백업을 복원했어요.");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function txRows(items: Transaction[]) {
    return (
      <div className="transactions">
        {items.length ? (
          items.map((t) => (
            <div className="transaction" key={t.id}>
              <span className={`transaction-icon ${t.kind}`}>
                {t.kind === "income" ? (
                  <ArrowDownLeft size={19} />
                ) : t.kind === "transfer" || t.kind === "settlement" ? (
                  <ArrowLeftRight size={19} />
                ) : (
                  <span>
                    {(
                      {
                        식비: "🍚",
                        "카페·간식": "☕",
                        쇼핑: "🛍",
                        교통: "🚎",
                        "주거·통신": "🏠",
                      } as Record<string, string>
                    )[t.category] || "🌿"}
                  </span>
                )}
              </span>
              <div className="transaction-name">
                <b>{t.title}</b>
                <small>
                  {t.date.slice(5).replace("-", ".")} ·{" "}
                  {t.kind === "transfer"
                    ? "계좌이체"
                    : t.kind === "settlement"
                      ? "카드대금"
                      : t.category}{" "}
                  · {data.accounts.find((a) => a.id === t.accountId)?.name}
                  {t.payment === "credit" ? " · 신용카드" : ""}
                  {t.toId
                    ? ` → ${data.accounts.find((a) => a.id === t.toId)?.name}`
                    : ""}
                </small>
              </div>
              <strong className={t.kind === "income" ? "positive" : ""}>
                {t.kind === "income"
                  ? "+"
                  : t.kind === "expense" || t.kind === "settlement"
                    ? "−"
                    : ""}
                {money(t.amount)}
              </strong>
              <button
                className="icon-btn edit"
                aria-label={`${t.title} 수정`}
                onClick={() => {
                  setTx(t);
                  setError("");
                }}
              >
                <Pencil size={15} />
              </button>
            </div>
          ))
        ) : (
          <Empty
            text="아직 기록이 없어요. 첫 거래를 남겨볼까요?"
            action={addTx}
          />
        )}
      </div>
    );
  }
  if (fatal)
    return (
      <main className="fatal">
        <ShieldCheck />
        <h1>저장소를 열지 못했어요</h1>
        <p>{fatal}</p>
        <p>데이터 보호를 위해 임시 저장 모드로 전환하지 않습니다.</p>
        <button onClick={() => location.reload()}>다시 시도</button>
      </main>
    );
  if (!ready) return <main className="fatal">가계부를 불러오고 있어요…</main>;
  return (
    <div className="app">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setPage(0);
          }}
        >
          <span className="brand-mark">
            <Leaf size={23} />
          </span>
          모구<span className="brand-sub">가계부</span>
        </a>
        <span className="nav-label">나의 작은 금융 일기</span>
        <nav>
          {pages.map((p, i) => {
            const Icon = icons[i];
            return (
              <button
                className={page === i ? "active" : ""}
                key={p}
                onClick={() => setPage(i)}
              >
                <Icon size={19} />
                <span>{p}</span>
                {page === i && <i />}
              </button>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <Character name="hachiware" size={94} />
          <p>
            작은 기록이 모여
            <br />
            <b>든든한 내일이 돼요.</b>
          </p>
          <div>
            <ShieldCheck size={14} /> 이 브라우저에 안전하게 저장
          </div>
        </div>
        <span className="version">MOGU LEDGER · ver 1.0</span>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <span>
            나의 돈 이야기 <span className="slash">/</span> <b>{pages[page]}</b>
          </span>
          <div className="top-status">
            <span className="local-dot" />
            로컬 저장 모드<span className="avatar">나</span>
          </div>
        </header>
        <main className="main">
          <div className="page-heading">
            <div>
              <div className="eyebrow">MY LITTLE MONEY JOURNAL</div>
              <h1>
                {
                  [
                    "한눈에 보는 나의 하루",
                    "차곡차곡, 나의 기록",
                    "나의 소비를 알아가는 시간",
                    "든든하게 자라는 나의 자산",
                    "나에게 맞는 가계부",
                  ][page]
                }
              </h1>
              <p>
                {
                  [
                    "작은 기록부터 시작하는 건강한 소비 습관 🌱",
                    "오늘 쓴 돈도, 들어온 돈도 잊지 않도록.",
                    "숫자 속에 숨어 있는 나의 소비 습관을 발견해요.",
                    "흩어져 있는 계좌를 한곳에서 살펴봐요.",
                    "내 기록을 안전하게 관리해요.",
                  ][page]
                }
              </p>
            </div>
            <button className="primary add-button" onClick={addTx}>
              <Plus size={18} /> 거래 추가
            </button>
          </div>
          {error && (
            <div className="error" role="alert">
              {error}
              <button aria-label="오류 닫기" onClick={() => setError("")}>
                <X size={16} />
              </button>
            </div>
          )}
          {page !== 4 && (
            <div className="period-row">
              <div className="month-picker">
                <button
                  className="icon-btn"
                  aria-label="이전 달"
                  onClick={() => shift(-1)}
                >
                  <ChevronLeft size={17} />
                </button>
                <label className="month-label">
                  <span>
                    {Number(month.slice(0, 4))}년 {Number(month.slice(5))}월
                  </span>
                  <input
                    aria-label="조회 월"
                    type="month"
                    value={month}
                    onChange={(e) => e.target.value && setMonth(e.target.value)}
                  />
                </label>
                <button
                  className="icon-btn"
                  aria-label="다음 달"
                  onClick={() => shift(1)}
                >
                  <ChevronRight size={17} />
                </button>
              </div>
              <span className="period-note">
                {month === today().slice(0, 7)
                  ? "이번 달의 기록을 살펴보세요"
                  : "선택한 달의 기록이에요"}
              </span>
              <button
                className="text-button export"
                onClick={() =>
                  download(
                    csv({ ...data, transactions: monthly }),
                    `모구-${month}.csv`,
                    "text/csv;charset=utf-8",
                  )
                }
              >
                <Download size={15} /> 내역 다운로드
              </button>
            </div>
          )}
          {page === 0 && (
            <>
              <section className="greeting">
                <div>
                  <span className="pill">오늘도 차곡차곡</span>
                  <h2>내 돈의 흐름, 잘 자라고 있나요?</h2>
                  <p>
                    한 번의 기록이 더 나은 소비의 시작이에요.
                    <br className="mobile-break" /> 오늘도 모구와 함께 가볍게
                    살펴봐요.
                  </p>
                </div>
                <div className="greeting-art">
                  <span className="spark one">✦</span>
                  <Character />
                  <Character name="hachiware" size={100} />
                  <Character name="usagi" size={112} />
                  <span className="spark two">✧</span>
                  <span className="art-caption">작은 기록, 커다란 안심</span>
                </div>
              </section>
              <section className="summary-grid">
                <Metric
                  label="현재 총자산"
                  value={money(total)}
                  icon={<Wallet size={18} />}
                  accent
                  sub={`오늘 기준 · 부채 차감 전`}
                />
                <Metric
                  label="이번 달 수입"
                  value={money(stats.income)}
                  icon={<ArrowDownLeft size={18} />}
                  sub="자금 계좌로 들어온 돈"
                />
                <Metric
                  label="이번 달 소비"
                  value={money(stats.expense)}
                  icon={<ArrowUpRight size={18} />}
                  sub={
                    delta === null
                      ? "전월 기록이 없어 비교할 수 없어요"
                      : `지난달보다 ${Math.abs(delta)}% ${delta > 0 ? "더 썼어요" : "덜 썼어요"}`
                  }
                  down={delta !== null && delta <= 0}
                />
                <Metric
                  label="순현금흐름"
                  value={money(stats.cashFlow)}
                  icon={<ArrowLeftRight size={18} />}
                  sub="실제 수입 − 현금 유출"
                />
              </section>
              <div className="dashboard-grid">
                <section className="panel spending-panel">
                  <PanelTitle
                    title="이번 달, 어디에 썼을까요?"
                    subtitle="카테고리별 소비"
                    action={() => setPage(2)}
                  />
                  {grouped.length ? (
                    <div className="donut-content">
                      <div className="donut-wrap">
                        <ResponsiveContainer width="100%" height={220}>
                          <PieChart>
                            <Pie
                              isAnimationActive={false}
                              data={grouped}
                              innerRadius={72}
                              outerRadius={95}
                              paddingAngle={4}
                              dataKey="value"
                              stroke="none"
                            >
                              {grouped.map((v, i) => (
                                <Cell
                                  key={v.name}
                                  fill={colors[i % colors.length]}
                                />
                              ))}
                            </Pie>
                            <Tooltip formatter={(v) => money(Number(v))} />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="donut-center">
                          <small>총 소비</small>
                          <b>{money(stats.expense)}</b>
                        </div>
                      </div>
                      <div className="legend">
                        {grouped.slice(0, 3).map((v, i) => (
                          <div key={v.name}>
                            <span>
                              <i style={{ background: colors[i] }} />
                              {v.name}
                            </span>
                            <strong>
                              {money(v.value)}
                              <small>
                                {Math.round((v.value / stats.expense) * 100)}%
                              </small>
                            </strong>
                          </div>
                        ))}
                        <div className="legend-note">
                          상위 3개 카테고리 · 전체 차트
                        </div>
                      </div>
                    </div>
                  ) : (
                    <Empty
                      text="소비를 기록하면 이곳에 모아드려요."
                      action={addTx}
                    />
                  )}
                </section>
                <section className="panel flow-panel">
                  <PanelTitle
                    title="이번 달의 돈 흐름"
                    subtitle="소비와 현금 유출은 다를 수 있어요"
                  />
                  <div className="flow-row">
                    <span>
                      <i className="dot green" />
                      들어온 돈
                    </span>
                    <b>{money(stats.income)}</b>
                  </div>
                  <div className="flow-track">
                    <div style={{ width: "100%" }} />
                  </div>
                  <div className="flow-row">
                    <span>
                      <i className="dot yellow" />
                      나간 현금
                    </span>
                    <b>{money(stats.cashOut)}</b>
                  </div>
                  <div className="flow-track yellow">
                    <div
                      style={{
                        width: `${Math.min(100, stats.income ? (stats.cashOut / stats.income) * 100 : stats.cashOut ? 100 : 0)}%`,
                      }}
                    />
                  </div>
                  <div className="flow-bottom">
                    <span>이번 달 남은 흐름</span>
                    <b>{money(stats.cashFlow)}</b>
                  </div>
                  <p className="footnote">계좌이체 제외 · 카드대금 결제 포함</p>
                </section>
                <section className="panel recent-panel">
                  <PanelTitle
                    title="최근 거래 내역"
                    subtitle={`${month.replace("-", "년 ")}월의 작은 기록들`}
                    action={() => setPage(1)}
                  />
                  {txRows(recent.slice(0, 5))}
                </section>
                <section className="panel asset-preview">
                  <PanelTitle
                    title="차곡차곡 나의 자산"
                    action={() => setPage(3)}
                  />
                  <small>선택한 달 말 기준 총자산</small>
                  <h2>{money(totalAssets(data, endOfMonth(month)))}</h2>
                  <div className="asset-change">
                    <TrendingUp size={16} /> 전월 말 대비{" "}
                    {assetChange >= 0 ? "+" : ""}
                    {money(assetChange)}
                  </div>
                  <div className="mini-accounts">
                    {data.accounts.slice(0, 3).map((a) => (
                      <div key={a.id}>
                        <span>{a.name}</span>
                        <b>{money(balance(data, a.id, endOfMonth(month)))}</b>
                      </div>
                    ))}
                  </div>
                  <div className="asset-tip">
                    🌼 자산의 변화에는 평가손익도 포함돼요.
                  </div>
                </section>
              </div>
              <div className="bottom-note">
                <Leaf size={14} /> 완벽한 기록보다, 꾸준한 기록이 더 중요해요.
              </div>
            </>
          )}
          {page === 1 && (
            <>
              <div className="compact-stats">
                <Metric label="선택한 달 총소비" value={money(stats.expense)} />
                <Metric
                  label="일 평균 소비"
                  value={money(Math.round(stats.expense / days))}
                />
                <Metric
                  label="주 평균 소비 (7일 환산)"
                  value={money(Math.round((stats.expense / days) * 7))}
                />
              </div>
              <div className="weekly-strip">
                {Array.from({ length: Math.ceil(days / 7) }, (_, i) => {
                  const amount = expenses
                    .filter((t) => {
                      const day = Number(t.date.slice(-2));
                      return day > i * 7 && day <= i * 7 + 7;
                    })
                    .reduce((s, t) => s + t.amount, 0);
                  return (
                    <div key={i}>
                      <small>
                        {i * 7 + 1}–{Math.min(days, i * 7 + 7)}일
                      </small>
                      <b>{money(amount)}</b>
                    </div>
                  );
                })}
              </div>
              <section className="panel">
                <div className="filters">
                  <div className="search">
                    <Search size={17} />
                    <input
                      placeholder="사용처, 거래명 검색"
                      aria-label="사용처 검색"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </div>
                  <select
                    aria-label="카테고리 필터"
                    value={cat}
                    onChange={(e) => setCat(e.target.value)}
                  >
                    <option value="">모든 카테고리</option>
                    {categories.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                  <select
                    aria-label="계좌 필터"
                    value={accFilter}
                    onChange={(e) => setAccFilter(e.target.value)}
                  >
                    <option value="">모든 계좌·수단</option>
                    <option value="credit">신용카드</option>
                    {data.accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                  <button
                    className="icon-btn"
                    aria-label={calendar ? "목록 보기" : "달력 보기"}
                    onClick={() => setCalendar(!calendar)}
                  >
                    {calendar ? <LayoutList /> : <CalendarDays />}
                  </button>
                </div>
                {calendar ? (
                  <>
                    <div className="calendar">
                      {["일", "월", "화", "수", "목", "금", "토"].map((d) => (
                        <b className="weekday" key={d}>
                          {d}
                        </b>
                      ))}
                      {Array.from(
                        { length: new Date(`${month}-01T00:00:00`).getDay() },
                        (_, i) => (
                          <div key={`blank-${i}`} />
                        ),
                      )}
                      {daily.map((d) => {
                        const items = recent.filter(
                          (t) =>
                            Number(t.date.slice(-2)) === d.day &&
                            t.title.includes(query) &&
                            (!cat || t.category === cat) &&
                            (!accFilter ||
                              (accFilter === "credit"
                                ? t.payment === "credit"
                                : t.accountId === accFilter ||
                                  t.toId === accFilter)),
                        );
                        const amount = items
                          .filter((t) => t.kind === "expense")
                          .reduce((s, t) => s + t.amount, 0);
                        return (
                          <div key={d.day} className="calendar-day">
                            <span>{d.day}</span>
                            {amount > 0 && <strong>{money(amount)}</strong>}
                            <small>
                              {items.length ? `${items.length}건` : ""}
                            </small>
                          </div>
                        );
                      })}
                    </div>
                    <p className="footnote">
                      달력 금액은 필터에 해당하는 일별 소비 합계예요. 수정은
                      목록 보기에서 할 수 있어요.
                    </p>
                  </>
                ) : (
                  txRows(
                    recent.filter(
                      (t) =>
                        t.title.includes(query) &&
                        (!cat || t.category === cat) &&
                        (!accFilter ||
                          (accFilter === "credit"
                            ? t.payment === "credit"
                            : t.accountId === accFilter ||
                              t.toId === accFilter)),
                    ),
                  )
                )}
              </section>
            </>
          )}
          {page === 2 && (
            <>
              <div className="compact-stats">
                <Metric
                  label="이번 달 총소비"
                  value={money(stats.expense)}
                  sub={
                    delta === null
                      ? "전월 비교 데이터 없음"
                      : `전월 대비 ${delta > 0 ? "+" : ""}${delta}%`
                  }
                />
                <Metric
                  label="고정비"
                  value={money(
                    expenses
                      .filter((t) => t.fixed)
                      .reduce((s, t) => s + t.amount, 0),
                  )}
                />
                <Metric
                  label="변동비"
                  value={money(
                    expenses
                      .filter((t) => !t.fixed)
                      .reduce((s, t) => s + t.amount, 0),
                  )}
                />
              </div>
              <div className="analysis-grid">
                <section className="panel">
                  <PanelTitle
                    title="일별 지출 추이"
                    subtitle={`${month} · 단위: 원`}
                  />
                  <div className="chart">
                    <ResponsiveContainer>
                      <LineChart data={daily}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis
                          dataKey="day"
                          tickFormatter={(v) => `${v}일`}
                          fontSize={11}
                        />
                        <YAxis
                          width={65}
                          tickFormatter={(v) => Number(v).toLocaleString()}
                          fontSize={10}
                        />
                        <Tooltip
                          formatter={(v) => money(Number(v))}
                          labelFormatter={(v) => `${month}-${v}`}
                        />
                        <Line
                          isAnimationActive={false}
                          name="지출"
                          type="monotone"
                          dataKey="amount"
                          stroke="#7a9f8a"
                          strokeWidth={2.5}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </section>
                <section className="panel">
                  <PanelTitle
                    title="월별 총지출"
                    subtitle="최근 6개월 · 단위: 원"
                  />
                  <div className="chart">
                    <ResponsiveContainer>
                      <BarChart
                        data={Array.from({ length: 6 }, (_, i) => {
                          let m = month;
                          for (let j = 0; j < 5 - i; j++) m = previousMonth(m);
                          return { month: m, ...monthStats(data, m) };
                        })}
                      >
                        <CartesianGrid vertical={false} strokeDasharray="3 3" />
                        <XAxis dataKey="month" fontSize={10} />
                        <YAxis
                          width={65}
                          tickFormatter={(v) => Number(v).toLocaleString()}
                          fontSize={10}
                        />
                        <Tooltip formatter={(v) => money(Number(v))} />
                        <Bar
                          isAnimationActive={false}
                          name="총지출"
                          dataKey="expense"
                          fill="#a3bfae"
                          radius={[6, 6, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </section>
                <section className="panel">
                  <PanelTitle
                    title="소비 카테고리 TOP 5"
                    subtitle="금액 · 비중 · 전월 대비"
                  />
                  {grouped.length ? (
                    grouped.slice(0, 5).map((g, i) => {
                      const old = data.transactions
                        .filter(
                          (t) =>
                            t.date.startsWith(previousMonth(month)) &&
                            t.kind === "expense" &&
                            t.category === g.name,
                        )
                        .reduce((s, t) => s + t.amount, 0);
                      return (
                        <div className="category-row" key={g.name}>
                          <span className="rank">{i + 1}</span>
                          <div>
                            <b>{g.name}</b>
                            <div className="category-track">
                              <i
                                style={{
                                  width: `${(g.value / stats.expense) * 100}%`,
                                  background: colors[i],
                                }}
                              />
                            </div>
                          </div>
                          <div className="category-amount">
                            <b>{money(g.value)}</b>
                            <small>
                              {Math.round((g.value / stats.expense) * 100)}% ·{" "}
                              {old
                                ? `${Math.round(((g.value - old) / old) * 100) > 0 ? "+" : ""}${Math.round(((g.value - old) / old) * 100)}%`
                                : "전월 없음"}
                            </small>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <Empty
                      text="소비 기록이 쌓이면 분석을 시작해요."
                      action={addTx}
                    />
                  )}
                </section>
                <section className="panel">
                  <PanelTitle
                    title="자주 쓰는 곳"
                    subtitle="선택한 달 사용처별 누적 소비"
                  />
                  {Object.entries(
                    expenses.reduce(
                      (a, t) => ({
                        ...a,
                        [t.title]:
                          (Object.hasOwn(a, t.title) ? a[t.title] : 0) +
                          t.amount,
                      }),
                      {} as Record<string, number>,
                    ),
                  )
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 8)
                    .map(([name, value], i) => (
                      <div className="merchant" key={name}>
                        <span>
                          <small>{i + 1}</small>
                          {name}
                        </span>
                        <b>{money(value)}</b>
                      </div>
                    ))}
                  {!expenses.length && (
                    <p className="muted">아직 사용처 기록이 없어요.</p>
                  )}
                </section>
              </div>
            </>
          )}
          {page === 3 && (
            <>
              <div className="compact-stats">
                <Metric
                  label="현금성 자산"
                  value={money(
                    data.accounts
                      .filter((a) =>
                        ["입출금통장", "파킹통장"].includes(a.type),
                      )
                      .reduce((s, a) => s + balance(data, a.id, today()), 0),
                  )}
                />
                <Metric
                  label="예적금·청약"
                  value={money(
                    data.accounts
                      .filter((a) =>
                        ["예금", "적금", "주택청약"].includes(a.type),
                      )
                      .reduce((s, a) => s + balance(data, a.id, today()), 0),
                  )}
                />
                <Metric
                  label="투자자산"
                  value={money(
                    data.accounts
                      .filter((a) => ["주식 계좌", "ISA"].includes(a.type))
                      .reduce((s, a) => s + balance(data, a.id, today()), 0),
                  )}
                />
              </div>
              <div className="section-heading">
                <h2>
                  나의 계좌 <span>{data.accounts.length}</span>
                </h2>
                <button
                  className="secondary"
                  onClick={() => {
                    setAccount({
                      date: today(),
                      type: assetTypes[0],
                      opening: 0,
                    });
                    setError("");
                  }}
                >
                  <Plus size={16} /> 계좌 등록
                </button>
              </div>
              <div className="accounts-grid">
                {data.accounts.map((a, i) => (
                  <section className="panel account-card" key={a.id}>
                    <div className="account-bank">
                      <span style={{ background: colors[i % colors.length] }}>
                        <Landmark size={20} />
                      </span>
                      <div>
                        <small>
                          {a.bank} · {a.type}
                        </small>
                        <h3>{a.name}</h3>
                      </div>
                      <button
                        className="icon-btn"
                        aria-label={`${a.name} 수정`}
                        onClick={() => {
                          setAccount(a);
                          setError("");
                        }}
                      >
                        <Pencil size={15} />
                      </button>
                    </div>
                    <h2>{money(balance(data, a.id, today()))}</h2>
                    <small className="muted">오늘 기준 · 시작 {a.date}</small>
                    {["주식 계좌", "ISA"].includes(a.type) && (
                      <button
                        className="valuation-button"
                        onClick={async () => {
                          const s = prompt(
                            "오늘 기준 평가금액을 원 단위 정수로 입력하세요.",
                          );
                          if (s === null) return;
                          if (
                            !/^\d+$/.test(s) ||
                            !Number.isSafeInteger(Number(s))
                          ) {
                            setError("0 이상의 정수 금액을 입력해 주세요.");
                            return;
                          }
                          await commit(
                            {
                              ...data,
                              valuations: [
                                ...data.valuations,
                                {
                                  id: crypto.randomUUID(),
                                  accountId: a.id,
                                  date: today(),
                                  delta:
                                    Number(s) - balance(data, a.id, today()),
                                },
                              ],
                            },
                            "평가금액을 갱신했어요. 수입·소비에는 포함하지 않아요.",
                          );
                        }}
                      >
                        평가금액 갱신 <ArrowRight size={14} />
                      </button>
                    )}
                  </section>
                ))}
              </div>
              {!data.accounts.length && (
                <section className="panel">
                  <Empty
                    text="첫 계좌를 등록하고 돈의 흐름을 살펴봐요."
                    action={() =>
                      setAccount({
                        date: today(),
                        type: assetTypes[0],
                        opening: 0,
                      })
                    }
                  />
                </section>
              )}
              <div className="analysis-grid asset-lower">
                <section className="panel">
                  <PanelTitle
                    title="자산 유형별 비율"
                    subtitle="오늘 기준 · 기타 자산 포함"
                  />
                  {assetTypes.map((type, i) => {
                    const amount = data.accounts
                      .filter((a) => a.type === type)
                      .reduce((s, a) => s + balance(data, a.id, today()), 0);
                    return (
                      amount !== 0 && (
                        <div className="merchant" key={type}>
                          <span>
                            <i
                              className="dot"
                              style={{ background: colors[i] }}
                            />
                            {type}
                          </span>
                          <b>
                            {money(amount)}{" "}
                            <small>
                              ({total ? Math.round((amount / total) * 100) : 0}
                              %)
                            </small>
                          </b>
                        </div>
                      )
                    );
                  })}
                  <div className="notice">
                    총자산은 부채를 차감하지 않은 금액입니다. 신용카드 미결제
                    합계: <b>{money(creditDue(data, today()))}</b>
                    <br />
                    카드별 청구주기·한도·할부 및 기존 미결제액은 지원하지
                    않아요. 등록한 사용·결제 내역만 추적합니다.
                  </div>
                </section>
                <section className="panel">
                  <PanelTitle
                    title="월말 자산 스냅샷"
                    subtitle="과거 거래를 수정하면 기록된 월말 잔액도 다시 계산해요"
                  />
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={async () => {
                      try {
                        if (
                          data.snapshots.some((s) => s.month === month) &&
                          !confirm(
                            "기존 스냅샷을 현재 기록으로 다시 계산할까요?",
                          )
                        )
                          return;
                        await commit(
                          recordSnapshot(data, month),
                          "월말 스냅샷을 기록했어요.",
                        );
                      } catch (e) {
                        setError((e as Error).message);
                      }
                    }}
                  >
                    {month} 월말 기록
                  </button>
                  {data.snapshots.length ? (
                    <div className="chart">
                      <ResponsiveContainer>
                        <LineChart
                          data={[...data.snapshots].sort((a, b) =>
                            a.month.localeCompare(b.month),
                          )}
                        >
                          <XAxis dataKey="month" fontSize={11} />
                          <YAxis
                            width={65}
                            tickFormatter={(v) => `${Math.round(v / 10000)}만`}
                            fontSize={10}
                          />
                          <Tooltip formatter={(v) => money(Number(v))} />
                          <Line
                            isAnimationActive={false}
                            name="총자산"
                            dataKey="total"
                            stroke="#7b9f89"
                            strokeWidth={2}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <p className="muted snapshot-empty">
                      지난달을 선택해 첫 월말 기록을 남겨보세요.
                    </p>
                  )}
                  {[...data.snapshots]
                    .sort((a, b) => b.month.localeCompare(a.month))
                    .map((s) => (
                      <div className="merchant" key={s.month}>
                        <span>{s.month}</span>
                        <b>{money(s.total)}</b>
                      </div>
                    ))}
                </section>
              </div>
            </>
          )}
          {page === 4 && (
            <div className="settings-grid">
              <section className="panel">
                <PanelTitle
                  title="나의 기록, 안전하게 보관하기"
                  subtitle="서버 전송 없이 파일로 직접 관리해요"
                />
                <div className="setting-row">
                  <div>
                    <b>JSON 전체 백업</b>
                    <p>계좌·거래·평가손익·스냅샷을 모두 저장합니다.</p>
                  </div>
                  <button
                    className="secondary"
                    onClick={() =>
                      download(
                        JSON.stringify(data, null, 2),
                        `모구-전체백업-${today()}.json`,
                        "application/json",
                      )
                    }
                  >
                    <Download size={16} /> 백업
                  </button>
                </div>
                <div className="setting-row">
                  <div>
                    <b>백업 복원</b>
                    <p>검증한 JSON 파일로 현재 데이터를 교체합니다.</p>
                  </div>
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={() => restoreRef.current?.click()}
                  >
                    파일 선택
                  </button>
                  <input
                    hidden
                    ref={restoreRef}
                    type="file"
                    accept=".json,application/json"
                    onChange={(e) => {
                      restore(e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                </div>
                <div className="setting-row">
                  <div>
                    <b>전체 거래 CSV 내보내기</b>
                    <p>엑셀에서 읽을 수 있는 원화 거래 내역입니다.</p>
                  </div>
                  <button
                    className="secondary"
                    onClick={() =>
                      download(
                        csv(data),
                        `모구-거래-${today()}.csv`,
                        "text/csv;charset=utf-8",
                      )
                    }
                  >
                    내보내기
                  </button>
                </div>
                <div className="notice">
                  <ShieldCheck size={18} /> 금융 기록은 이 브라우저의
                  IndexedDB에만 저장됩니다. 다른 기기와 자동 동기화되지 않으며,
                  사이트 데이터 삭제·시크릿 모드 종료 시 사라질 수 있어요.
                  주기적으로 JSON 백업을 보관하세요.
                </div>
              </section>
              <section className="panel">
                <PanelTitle title="가볍게 둘러보기" />
                <p className="muted">
                  샘플 데이터로 모구의 화면과 계산을 체험해 보세요. 현재 기록이
                  있다면 먼저 백업해 주세요.
                </p>
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() => {
                    if (
                      confirm(
                        "현재 데이터를 샘플 데이터로 교체할까요? 기존 기록은 덮어씁니다.",
                      )
                    )
                      commit(sampleData(), "샘플 데이터를 불러왔어요.");
                  }}
                >
                  샘플 데이터 불러오기
                </button>
                <hr />
                <h3>나만의 캐릭터</h3>
                <p className="muted">
                  보내주신 치이카와·하치와레·우사기 이미지와 함께해요. 이미지는
                  앱에 포함되어 외부 사이트에 접속하지 않고 표시됩니다.
                </p>
                <div className="mascot-row">
                  <Character size={70} />
                  <Character name="hachiware" size={70} />
                  <Character name="usagi" size={70} />
                </div>
                <div className="friends-card">
                  <Character name="friends" size={160} />
                  <p>오늘도 함께, 차곡차곡 🌱</p>
                </div>
                <hr />
                <h3>데이터 초기화</h3>
                <p className="muted">
                  모든 기록을 영구 삭제합니다. 백업 파일 없이는 복구할 수
                  없어요.
                </p>
                <button
                  className="danger"
                  disabled={busy}
                  onClick={() => {
                    if (
                      confirm(
                        "모든 계좌, 거래, 평가손익, 스냅샷을 영구 삭제할까요?",
                      )
                    )
                      commit(emptyData(), "모든 데이터를 삭제했어요.");
                  }}
                >
                  <Trash2 size={15} /> 전체 데이터 삭제
                </button>
              </section>
            </div>
          )}
        </main>
        <footer>
          모구와 함께, 오늘도 조금 더 가벼운 돈 관리{" "}
          <span>내 기록은 내 브라우저에만.</span>
        </footer>
      </div>
      {toast && (
        <div role="status" className="toast">
          <Check size={17} />
          {toast}
        </div>
      )}
      {tx && (
        <Modal
          title={tx.id ? "거래 수정" : "새로운 거래 기록"}
          close={() => {
            setTx(null);
            setError("");
          }}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                const t = {
                  ...tx,
                  id: tx.id || crypto.randomUUID(),
                  amount: Number(tx.amount),
                  title: tx.title?.trim(),
                  memo: tx.memo || "",
                  ...(tx.kind !== "transfer" ? { toId: undefined } : {}),
                } as Transaction;
                if (t.date > today()) {
                  setError("미래 거래는 기록할 수 없어요.");
                  return;
                }
                if (t.kind === "settlement") {
                  const without = {
                    ...data,
                    transactions: data.transactions.filter(
                      (x) => x.id !== t.id,
                    ),
                  };
                  if (t.amount > creditDue(without, t.date)) {
                    setError("결제 금액이 해당 날짜의 미결제액보다 커요.");
                    return;
                  }
                }
                if (await commit(saveTransaction(data, t))) {
                  setTx(null);
                }
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            <div className="type-tabs">
              {(
                [
                  ["expense", "지출"],
                  ["income", "수입"],
                  ["transfer", "계좌이체"],
                  ["settlement", "카드대금"],
                ] as const
              ).map(([k, label]) => (
                <button
                  type="button"
                  className={tx.kind === k ? "selected" : ""}
                  key={k}
                  onClick={() =>
                    setTx({
                      ...tx,
                      kind: k,
                      payment: "cash",
                      category:
                        k === "income"
                          ? "급여"
                          : k === "expense"
                            ? "식비"
                            : "기타",
                    })
                  }
                >
                  {label}
                </button>
              ))}
            </div>
            <label>
              금액 <span>원</span>
              <input
                autoFocus
                type="number"
                min="1"
                max="1000000000000"
                step="1"
                required
                className="amount-input"
                placeholder="0"
                value={tx.amount ?? ""}
                onChange={(e) =>
                  setTx({ ...tx, amount: Number(e.target.value) })
                }
              />
            </label>
            <div className="form-grid">
              <label>
                날짜
                <input
                  required
                  type="date"
                  max={today()}
                  value={tx.date || today()}
                  onChange={(e) => setTx({ ...tx, date: e.target.value })}
                />
              </label>
              <label>
                {tx.kind === "transfer" ? "출금 계좌" : "자금 계좌"}
                <select
                  required
                  value={tx.accountId}
                  onChange={(e) => setTx({ ...tx, accountId: e.target.value })}
                >
                  {data.accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {tx.kind === "transfer" && (
              <label>
                입금 계좌
                <select
                  required
                  value={tx.toId || ""}
                  onChange={(e) => setTx({ ...tx, toId: e.target.value })}
                >
                  <option value="">계좌 선택</option>
                  {data.accounts
                    .filter((a) => a.id !== tx.accountId)
                    .map((a) => (
                      <option value={a.id} key={a.id}>
                        {a.name}
                      </option>
                    ))}
                </select>
              </label>
            )}
            <label>
              거래명 / 사용처
              <input
                required
                maxLength={100}
                list="merchants"
                placeholder="어디에 사용했나요?"
                value={tx.title || ""}
                onChange={(e) => {
                  const old = data.transactions.find(
                    (t) => t.title === e.target.value && t.kind === tx.kind,
                  );
                  setTx({
                    ...tx,
                    title: e.target.value,
                    ...(old
                      ? {
                          category: old.category,
                          accountId: old.accountId,
                          payment: old.payment,
                          fixed: old.fixed,
                        }
                      : {}),
                  });
                }}
              />
              <datalist id="merchants">
                {[
                  ...new Set(
                    data.transactions
                      .filter((t) => t.kind === tx.kind)
                      .map((t) => t.title),
                  ),
                ].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </datalist>
            </label>
            {(tx.kind === "expense" || tx.kind === "income") && (
              <div className="form-grid">
                <label>
                  카테고리
                  <select
                    value={tx.category}
                    onChange={(e) => setTx({ ...tx, category: e.target.value })}
                  >
                    {categories.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </label>
                {tx.kind === "expense" && (
                  <label>
                    결제 수단
                    <select
                      value={tx.payment}
                      onChange={(e) =>
                        setTx({
                          ...tx,
                          payment: e.target.value as "cash" | "credit",
                        })
                      }
                    >
                      <option value="cash">계좌 / 현금 / 체크카드</option>
                      <option value="credit">신용카드 (미결제)</option>
                    </select>
                  </label>
                )}
              </div>
            )}
            {tx.payment === "credit" && (
              <p className="notice">
                소비와 미결제액에 반영하고 자금 계좌는 차감하지 않아요. 실제
                출금은 ‘카드대금’으로 기록하세요. 카드별·할부 관리는 지원하지
                않아요.
              </p>
            )}
            {tx.kind === "settlement" && (
              <p className="notice">
                미결제 합계 {money(creditDue(data, tx.date))} · 계좌에서만
                차감하며 소비에 다시 포함하지 않아요.
              </p>
            )}
            {tx.kind === "expense" && (
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={tx.fixed || false}
                  onChange={(e) => setTx({ ...tx, fixed: e.target.checked })}
                />{" "}
                매달 반복되는 고정비예요
              </label>
            )}
            <label>
              메모 <span>선택</span>
              <input
                maxLength={500}
                value={tx.memo || ""}
                placeholder="남겨두고 싶은 이야기"
                onChange={(e) => setTx({ ...tx, memo: e.target.value })}
              />
            </label>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <div className="form-actions">
              {tx.id && (
                <button
                  type="button"
                  className="danger"
                  disabled={busy}
                  onClick={async () => {
                    if (
                      confirm(
                        "이 거래를 영구 삭제할까요? 연결 계좌의 잔액도 다시 계산합니다.",
                      )
                    ) {
                      if (
                        await commit(
                          {
                            ...data,
                            transactions: data.transactions.filter(
                              (t) => t.id !== tx.id,
                            ),
                          },
                          "거래를 삭제했어요.",
                        )
                      )
                        setTx(null);
                    }
                  }}
                >
                  <Trash2 size={16} /> 삭제
                </button>
              )}
              <button className="primary" disabled={busy}>
                {busy ? "저장 중…" : "기록 저장하기"} <Check size={16} />
              </button>
            </div>
          </form>
        </Modal>
      )}
      {account && (
        <Modal
          title={account.id ? "계좌 수정" : "나의 계좌 등록"}
          close={() => {
            setAccount(null);
            setError("");
          }}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if ((account.date || "") > today()) {
                setError("시작일은 오늘까지 입력할 수 있어요.");
                return;
              }
              const a = {
                ...account,
                id: account.id || crypto.randomUUID(),
                opening: Number(account.opening),
                name: account.name?.trim(),
                bank: account.bank?.trim() || "직접 관리",
              } as Account;
              if (
                await commit({
                  ...data,
                  accounts: [...data.accounts.filter((x) => x.id !== a.id), a],
                })
              )
                setAccount(null);
            }}
          >
            <label>
              계좌 별칭
              <input
                autoFocus
                required
                maxLength={60}
                placeholder="예: 매일 쓰는 통장"
                value={account.name || ""}
                onChange={(e) =>
                  setAccount({ ...account, name: e.target.value })
                }
              />
            </label>
            <div className="form-grid">
              <label>
                금융기관
                <input
                  maxLength={60}
                  placeholder="예: 신한은행"
                  value={account.bank || ""}
                  onChange={(e) =>
                    setAccount({ ...account, bank: e.target.value })
                  }
                />
              </label>
              <label>
                자산 유형
                <select
                  value={account.type}
                  onChange={(e) =>
                    setAccount({ ...account, type: e.target.value })
                  }
                >
                  {assetTypes.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              시작 잔액 (원)
              <input
                type="number"
                required
                min="0"
                max="1000000000000"
                step="1"
                value={account.opening ?? 0}
                onChange={(e) =>
                  setAccount({ ...account, opening: Number(e.target.value) })
                }
              />
            </label>
            <label>
              시작 잔액 기준일
              <input
                type="date"
                required
                max={today()}
                value={account.date}
                onChange={(e) =>
                  setAccount({ ...account, date: e.target.value })
                }
              />
            </label>
            <p className="notice">
              시작 잔액은 기준일의 첫 거래 직전 금액입니다. 이후 거래와
              평가손익으로 현재 잔액을 자동 계산해요. 현금을 쓰려면 ‘기타
              자산’으로 현금 지갑을 등록하세요.
            </p>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <div className="form-actions">
              {account.id && (
                <button
                  type="button"
                  className="danger"
                  disabled={busy}
                  onClick={async () => {
                    if (
                      data.transactions.some(
                        (t) =>
                          t.accountId === account.id || t.toId === account.id,
                      ) ||
                      data.valuations.some((v) => v.accountId === account.id) ||
                      data.snapshots.some((s) => account.id! in s.balances)
                    ) {
                      setError(
                        "연결된 거래·평가손익·스냅샷이 있는 계좌는 삭제할 수 없어요. 기록을 보존해 주세요.",
                      );
                      return;
                    }
                    if (
                      confirm("이 계좌를 영구 삭제할까요?") &&
                      (await commit(
                        {
                          ...data,
                          accounts: data.accounts.filter(
                            (a) => a.id !== account.id,
                          ),
                        },
                        "계좌를 삭제했어요.",
                      ))
                    )
                      setAccount(null);
                  }}
                >
                  계좌 삭제
                </button>
              )}
              <button className="primary" disabled={busy}>
                계좌 저장 <Check size={16} />
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
function Metric({
  label,
  value,
  sub,
  icon,
  accent,
  down,
}: {
  label: string;
  value: string;
  sub?: string;
  icon?: React.ReactNode;
  accent?: boolean;
  down?: boolean;
}) {
  return (
    <article className={`metric ${accent ? "accent" : ""}`}>
      <div className="metric-label">
        {label}
        {icon}
      </div>
      <strong>{value}</strong>
      {sub && (
        <small className={down ? "positive" : ""}>
          {down ? "↘ " : ""}
          {sub}
        </small>
      )}
    </article>
  );
}
function PanelTitle({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: () => void;
}) {
  return (
    <div className="panel-title">
      <div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action && (
        <button className="text-button" onClick={action}>
          전체 보기 <ChevronRight size={14} />
        </button>
      )}
    </div>
  );
}
function Empty({ text, action }: { text: string; action: () => void }) {
  return (
    <div className="empty">
      <Character name="chiikawa-rest" size={120} />
      <p>{text}</p>
      <button className="secondary" onClick={action}>
        <Plus size={15} /> 첫 기록 시작하기
      </button>
      <small>설정에서 샘플 데이터로 먼저 둘러볼 수도 있어요.</small>
    </div>
  );
}
function Modal({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement;
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "Tab") {
        const list = ref.current?.querySelectorAll<HTMLElement>(
          "button,input,select",
        );
        if (!list?.length) return;
        const first = list[0],
          last = list[list.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", key);
      document.body.style.overflow = old;
      prev?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="modal"
      >
        <div className="modal-heading">
          <h2>{title}</h2>
          <button className="icon-btn" aria-label="닫기" onClick={close}>
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
