export const categories = [
  "식비",
  "카페·간식",
  "쇼핑",
  "교통",
  "생활",
  "주거·통신",
  "건강",
  "문화·여가",
  "급여",
  "기타",
];
export const assetTypes = [
  "입출금통장",
  "파킹통장",
  "예금",
  "적금",
  "주택청약",
  "주식 계좌",
  "ISA",
  "기타 자산",
];
export type Account = {
  id: string;
  bank: string;
  name: string;
  type: string;
  opening: number;
  date: string;
};
export type Transaction = {
  id: string;
  date: string;
  kind: "income" | "expense" | "transfer" | "settlement";
  amount: number;
  title: string;
  category: string;
  accountId: string;
  toId?: string;
  payment: "cash" | "credit";
  fixed: boolean;
  memo: string;
};
export type Valuation = {
  id: string;
  accountId: string;
  date: string;
  delta: number;
};
export type Snapshot = {
  month: string;
  total: number;
  balances: Record<string, number>;
  recordedAt: string;
};
export type Data = {
  version: 1;
  accounts: Account[];
  transactions: Transaction[];
  valuations: Valuation[];
  snapshots: Snapshot[];
};
export const emptyData = (): Data => ({
  version: 1,
  accounts: [],
  transactions: [],
  valuations: [],
  snapshots: [],
});
export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export const money = (n: number) =>
  `${n < 0 ? "−" : ""}₩${Math.abs(n).toLocaleString("ko-KR")}`;
export function balance(data: Data, id: string, until = "9999-12-31") {
  const a = data.accounts.find((a) => a.id === id);
  if (!a || a.date > until) return 0;
  let v = a.opening;
  for (const t of data.transactions.filter((t) => t.date <= until)) {
    if (t.accountId === id) {
      if (t.kind === "income") v += t.amount;
      else if (
        t.kind === "transfer" ||
        t.kind === "settlement" ||
        (t.kind === "expense" && t.payment === "cash")
      )
        v -= t.amount;
    }
    if (t.kind === "transfer" && t.toId === id) v += t.amount;
  }
  return (
    v +
    data.valuations
      .filter((v) => v.accountId === id && v.date <= until)
      .reduce((s, v) => s + v.delta, 0)
  );
}
export const totalAssets = (d: Data, until?: string) =>
  d.accounts.reduce((s, a) => s + balance(d, a.id, until), 0);
export const creditDue = (d: Data, until = "9999-12-31") =>
  d.transactions
    .filter((t) => t.date <= until)
    .reduce(
      (s, t) =>
        s +
        (t.kind === "expense" && t.payment === "credit"
          ? t.amount
          : t.kind === "settlement"
            ? -t.amount
            : 0),
      0,
    );
export function monthStats(d: Data, month: string) {
  const ts = d.transactions.filter((t) => t.date.startsWith(month));
  const income = ts
    .filter((t) => t.kind === "income")
    .reduce((s, t) => s + t.amount, 0);
  const expense = ts
    .filter((t) => t.kind === "expense")
    .reduce((s, t) => s + t.amount, 0);
  const cashOut = ts
    .filter(
      (t) =>
        (t.kind === "expense" && t.payment === "cash") ||
        t.kind === "settlement",
    )
    .reduce((s, t) => s + t.amount, 0);
  return { income, expense, cashFlow: income - cashOut, cashOut };
}
export function previousMonth(m: string) {
  const [y, n] = m.split("-").map(Number);
  return new Date(y, n - 2, 1).toLocaleDateString("sv-SE").slice(0, 7);
}
export const endOfMonth = (m: string) => {
  const [y, n] = m.split("-").map(Number);
  return `${m}-${new Date(y, n, 0).getDate()}`;
};
const dateValid = (s: unknown): s is string =>
  typeof s === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(s) &&
  !isNaN(Date.parse(s)) &&
  new Date(s).toISOString().slice(0, 10) === s;
const str = (v: unknown) => typeof v === "string" && v.length <= 1000;
const int = (v: unknown) =>
  typeof v === "number" &&
  Number.isSafeInteger(v) &&
  Math.abs(v) <= 1_000_000_000_000;
export function validateData(value: unknown): Data {
  const d = value as Data;
  if (
    !d ||
    d.version !== 1 ||
    !Array.isArray(d.accounts) ||
    !Array.isArray(d.transactions) ||
    !Array.isArray(d.valuations) ||
    !Array.isArray(d.snapshots)
  )
    throw Error("지원하는 모구 백업 파일이 아닙니다.");
  if (d.accounts.length > 1000 || d.transactions.length > 100000)
    throw Error("백업 데이터가 너무 큽니다.");
  const ids = new Set<string>();
  for (const a of d.accounts) {
    if (
      !a ||
      !str(a.id) ||
      !a.id ||
      ids.has(a.id) ||
      !str(a.bank) ||
      !str(a.name) ||
      !a.name.trim() ||
      !assetTypes.includes(a.type) ||
      !int(a.opening) ||
      a.opening < 0 ||
      !dateValid(a.date) ||
      a.date > today()
    )
      throw Error("계좌 데이터가 올바르지 않습니다.");
    ids.add(a.id);
  }
  const txIds = new Set<string>();
  for (const t of d.transactions) {
    const a = d.accounts.find((a) => a.id === t.accountId);
    const b = d.accounts.find((a) => a.id === t.toId);
    if (
      !t ||
      !str(t.id) ||
      !t.id ||
      txIds.has(t.id) ||
      !dateValid(t.date) ||
      t.date > today() ||
      !int(t.amount) ||
      t.amount <= 0 ||
      !str(t.title) ||
      !t.title.trim() ||
      !str(t.memo) ||
      !categories.includes(t.category) ||
      !a ||
      t.date < a.date ||
      !["income", "expense", "transfer", "settlement"].includes(t.kind) ||
      !["cash", "credit"].includes(t.payment) ||
      typeof t.fixed !== "boolean" ||
      (t.kind !== "expense" && t.payment !== "cash") ||
      (t.kind === "transfer" && (!b || a.id === b.id || t.date < b.date)) ||
      (t.kind !== "transfer" && t.toId !== undefined)
    )
      throw Error("거래 정보, 날짜 또는 연결된 계좌를 확인해 주세요.");
    txIds.add(t.id);
  }
  const valIds = new Set<string>();
  for (const v of d.valuations) {
    const a = d.accounts.find((a) => a.id === v.accountId);
    if (
      !v ||
      !str(v.id) ||
      !v.id ||
      valIds.has(v.id) ||
      !a ||
      !["주식 계좌", "ISA"].includes(a.type) ||
      !dateValid(v.date) ||
      v.date > today() ||
      v.date < a.date ||
      !int(v.delta)
    )
      throw Error("평가금액 기록이 올바르지 않습니다.");
    valIds.add(v.id);
  }
  const months = new Set<string>();
  for (const s of d.snapshots) {
    if (
      !s ||
      !/^\d{4}-(0[1-9]|1[0-2])$/.test(s.month) ||
      months.has(s.month) ||
      !int(s.total) ||
      !str(s.recordedAt) ||
      isNaN(Date.parse(s.recordedAt)) ||
      !s.balances ||
      typeof s.balances !== "object" ||
      Object.entries(s.balances).some(([id, n]) => !ids.has(id) || !int(n)) ||
      Object.values(s.balances).reduce((a, b) => a + b, 0) !== s.total
    )
      throw Error("스냅샷 데이터가 올바르지 않습니다.");
    months.add(s.month);
  }
  const magnitude =
    d.accounts.reduce((sum, a) => sum + a.opening, 0) +
    d.transactions.reduce((sum, t) => sum + t.amount, 0) +
    d.valuations.reduce((sum, v) => sum + Math.abs(v.delta), 0);
  if (!Number.isSafeInteger(magnitude))
    throw Error("원화 정수 계산의 안전 범위를 초과했습니다.");
  let due = 0;
  for (const t of [...d.transactions].sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      (a.kind === "settlement" ? 1 : 0) - (b.kind === "settlement" ? 1 : 0),
  )) {
    if (t.kind === "expense" && t.payment === "credit") due += t.amount;
    if (t.kind === "settlement") due -= t.amount;
    if (due < 0)
      throw Error(
        "카드대금 결제가 해당 시점의 미결제액을 초과합니다. 연결된 카드 사용·결제 기록을 함께 확인해 주세요.",
      );
  }
  for (const a of d.accounts)
    if (!int(balance(d, a.id)))
      throw Error("계좌 잔액이 허용 범위를 넘었습니다.");
  return structuredClone(d);
}
export function saveTransaction(d: Data, t: Transaction) {
  return validateData(
    refreshSnapshots({
      ...d,
      transactions: [...d.transactions.filter((x) => x.id !== t.id), t],
    }),
  );
}
export function refreshSnapshots(d: Data): Data {
  return {
    ...d,
    snapshots: d.snapshots.map((s) => {
      const balances = Object.fromEntries(
        d.accounts.map((a) => [a.id, balance(d, a.id, endOfMonth(s.month))]),
      );
      return {
        ...s,
        balances,
        total: Object.values(balances).reduce((sum, n) => sum + n, 0),
      };
    }),
  };
}
export function recordSnapshot(d: Data, month: string): Data {
  if (endOfMonth(month) >= today())
    throw Error("완료된 지난달까지만 월말 스냅샷을 기록할 수 있어요.");
  const balances = Object.fromEntries(
    d.accounts.map((a) => [a.id, balance(d, a.id, endOfMonth(month))]),
  );
  return {
    ...d,
    snapshots: [
      ...d.snapshots.filter((s) => s.month !== month),
      {
        month,
        total: Object.values(balances).reduce((a, b) => a + b, 0),
        balances,
        recordedAt: new Date().toISOString(),
      },
    ],
  };
}
export function sampleData(): Data {
  const m = today().slice(0, 7),
    p = previousMonth(m);
  const accounts: Account[] = [
    {
      id: "a1",
      bank: "신한은행",
      name: "매일 쓰는 통장",
      type: "입출금통장",
      opening: 2840000,
      date: `${p}-01`,
    },
    {
      id: "a2",
      bank: "카카오뱅크",
      name: "차곡차곡 비상금",
      type: "파킹통장",
      opening: 5000000,
      date: `${p}-01`,
    },
    {
      id: "a3",
      bank: "토스뱅크",
      name: "여행 적금",
      type: "적금",
      opening: 2400000,
      date: `${p}-01`,
    },
    {
      id: "a4",
      bank: "삼성증권",
      name: "미래를 위한 투자",
      type: "ISA",
      opening: 3500000,
      date: `${p}-01`,
    },
  ];
  const transactions: Transaction[] = [];
  const add = (
    date: string,
    amount: number,
    title: string,
    category: string,
    kind: Transaction["kind"] = "expense",
    fixed = false,
    toId?: string,
  ) =>
    transactions.push({
      id: crypto.randomUUID(),
      date,
      amount,
      title,
      category,
      kind,
      fixed,
      accountId: "a1",
      payment: "cash",
      memo: "",
      ...(toId ? { toId } : {}),
    });
  add(`${m}-01`, 3200000, "월급", "급여", "income");
  const day = Number(today().slice(-2));
  for (let i = 1; i <= Math.min(day, 24); i++) {
    add(
      `${m}-${String(i).padStart(2, "0")}`,
      8000 + (i % 5) * 3500,
      ["오늘의 점심", "동네 마트", "따뜻한 저녁"][i % 3],
      "식비",
    );
    if (i % 3 === 0)
      add(`${m}-${String(i).padStart(2, "0")}`, 5500, "단골 카페", "카페·간식");
  }
  add(`${m}-01`, 550000, "월세", "주거·통신", "expense", true);
  add(`${m}-01`, 300000, "여행 적금 납입", "기타", "transfer", false, "a3");
  add(`${m}-01`, 89000, "봄날의 옷장", "쇼핑");
  add(`${p}-02`, 3200000, "지난달 월급", "급여", "income");
  add(`${p}-05`, 550000, "월세", "주거·통신", "expense", true);
  add(`${p}-12`, 460000, "한 달 식비", "식비");
  add(`${p}-20`, 240000, "생활용품", "생활");
  add(`${p}-22`, 170000, "쇼핑", "쇼핑");
  return { version: 1, accounts, transactions, valuations: [], snapshots: [] };
}
export function csv(d: Data) {
  const rows = [
    [
      "날짜",
      "유형",
      "금액(원)",
      "거래명",
      "카테고리",
      "출금/자금 계좌",
      "입금 계좌",
      "결제수단",
      "고정비",
      "메모",
    ],
    ...d.transactions.map((t) => [
      t.date,
      {
        income: "수입",
        expense: "지출",
        transfer: "계좌이체",
        settlement: "카드대금 결제",
      }[t.kind],
      t.amount,
      t.title,
      t.category,
      d.accounts.find((a) => a.id === t.accountId)?.name ?? "",
      d.accounts.find((a) => a.id === t.toId)?.name ?? "",
      t.payment === "credit" ? "신용카드" : "계좌",
      t.fixed ? "예" : "아니오",
      t.memo,
    ]),
  ];
  return (
    "\uFEFF" +
    rows
      .map((r) =>
        r
          .map(
            (v) =>
              `"${String(v)
                .replace(/^[=+@\-]/, "'$&")
                .replaceAll('"', '""')}"`,
          )
          .join(","),
      )
      .join("\r\n")
  );
}
