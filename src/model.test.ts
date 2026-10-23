import { describe, it, expect } from "vitest";
import {
  type Data,
  type Transaction,
  emptyData,
  validateData,
  saveTransaction,
  balance,
  totalAssets,
  monthStats,
  creditDue,
  recordSnapshot,
  csv,
} from "./model";
function base(): Data {
  return {
    ...emptyData(),
    accounts: [
      {
        id: "a",
        name: "자금",
        bank: "신한",
        type: "입출금통장",
        opening: 1000000,
        date: "2025-01-01",
      },
      {
        id: "b",
        name: "적금",
        bank: "카카오",
        type: "적금",
        opening: 200000,
        date: "2025-01-01",
      },
      {
        id: "c",
        name: "투자",
        bank: "삼성",
        type: "ISA",
        opening: 100000,
        date: "2025-01-01",
      },
    ],
  };
}
function t(v: Partial<Transaction> = {}): Transaction {
  return {
    id: "t",
    date: "2025-01-10",
    kind: "expense",
    amount: 10000,
    title: "점심",
    category: "식비",
    accountId: "a",
    payment: "cash",
    fixed: false,
    memo: "",
    ...v,
  };
}
describe("잔액과 통계", () => {
  it("수입과 지출을 원 단위로 반영한다", () => {
    let d = saveTransaction(base(), t());
    d = saveTransaction(d, t({ id: "in", kind: "income", amount: 3000000 }));
    expect(balance(d, "a")).toBe(3990000);
    expect(monthStats(d, "2025-01")).toEqual({
      income: 3000000,
      expense: 10000,
      cashOut: 10000,
      cashFlow: 2990000,
    });
  });
  it("적금 납입은 하나의 이체로 저장하고 총자산과 소비를 보존한다", () => {
    const b = base();
    const d = saveTransaction(
      b,
      t({ kind: "transfer", toId: "b", amount: 500000 }),
    );
    expect(d.transactions).toHaveLength(1);
    expect(balance(d, "a")).toBe(500000);
    expect(balance(d, "b")).toBe(700000);
    expect(totalAssets(d)).toBe(totalAssets(b));
    expect(monthStats(d, "2025-01").expense).toBe(0);
    expect(monthStats(d, "2025-01").cashFlow).toBe(0);
  });
  it("이체 수정과 삭제는 두 잔액을 재계산한다", () => {
    let d = saveTransaction(
      base(),
      t({ kind: "transfer", toId: "b", amount: 500000 }),
    );
    d = saveTransaction(d, t({ kind: "transfer", toId: "c", amount: 200000 }));
    expect(balance(d, "b")).toBe(200000);
    expect(balance(d, "c")).toBe(300000);
    d = { ...d, transactions: [] };
    expect(balance(d, "a")).toBe(1000000);
    expect(balance(d, "c")).toBe(100000);
  });
  it("과거 거래 날짜 수정은 해당 월 통계를 함께 바꾼다", () => {
    let d = saveTransaction(base(), t());
    d = saveTransaction(d, t({ date: "2025-02-10", amount: 20000 }));
    expect(monthStats(d, "2025-01").expense).toBe(0);
    expect(monthStats(d, "2025-02").expense).toBe(20000);
    expect(balance(d, "a", "2025-01-31")).toBe(1000000);
    expect(balance(d, "a")).toBe(980000);
  });
  it("카드 사용과 대금 결제를 이중 집계하지 않는다", () => {
    let d = saveTransaction(base(), t({ payment: "credit", amount: 70000 }));
    expect(balance(d, "a")).toBe(1000000);
    expect(creditDue(d)).toBe(70000);
    expect(monthStats(d, "2025-01").cashFlow).toBe(0);
    d = saveTransaction(
      d,
      t({ id: "s", date: "2025-02-01", kind: "settlement", amount: 70000 }),
    );
    expect(creditDue(d)).toBe(0);
    expect(balance(d, "a")).toBe(930000);
    expect(monthStats(d, "2025-01").expense).toBe(70000);
    expect(monthStats(d, "2025-02").expense).toBe(0);
    expect(monthStats(d, "2025-02").cashFlow).toBe(-70000);
  });
  it("카드 사용 이전의 결제와 과다 결제를 거부한다", () => {
    let d = saveTransaction(base(), t({ payment: "credit" }));
    expect(() =>
      saveTransaction(d, t({ id: "s", kind: "settlement", amount: 10001 })),
    ).toThrow();
    expect(() =>
      saveTransaction(
        d,
        t({ id: "s", kind: "settlement", date: "2025-01-09" }),
      ),
    ).toThrow();
  });
  it("결제된 카드 사용 삭제·금액 감소로 무결성이 깨지면 거부한다", () => {
    let d = saveTransaction(base(), t({ payment: "credit" }));
    d = saveTransaction(d, t({ id: "s", kind: "settlement" }));
    expect(() =>
      validateData({
        ...d,
        transactions: d.transactions.filter((x) => x.id !== "t"),
      }),
    ).toThrow();
    expect(() =>
      saveTransaction(d, t({ payment: "credit", amount: 100 })),
    ).toThrow();
  });
  it("평가손익은 자산에만 반영된다", () => {
    const d = validateData({
      ...base(),
      valuations: [
        { id: "v", accountId: "c", date: "2025-01-20", delta: 30000 },
      ],
    });
    expect(balance(d, "c")).toBe(130000);
    expect(totalAssets(d)).toBe(1330000);
    expect(monthStats(d, "2025-01").income).toBe(0);
    expect(monthStats(d, "2025-01").expense).toBe(0);
  });
  it("월말 스냅샷은 해당 월말의 잔액을 기록하며 과거 거래 수정 시 갱신한다", () => {
    let d = saveTransaction(base(), t());
    d = recordSnapshot(d, "2025-01");
    expect(d.snapshots[0].total).toBe(1290000);
    d = saveTransaction(d, t({ amount: 20000 }));
    expect(d.snapshots[0].total).toBe(1280000);
    d = recordSnapshot(d, "2025-01");
    expect(d.snapshots).toHaveLength(1);
    expect(d.snapshots[0].total).toBe(1280000);
  });
});
describe("입력과 백업 무결성", () => {
  it("정상 JSON 백업을 왕복 복원한다", () => {
    const d = recordSnapshot(saveTransaction(base(), t()), "2025-01");
    expect(validateData(JSON.parse(JSON.stringify(d)))).toEqual(d);
  });
  it.each([0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER])(
    "잘못된 거래 금액 %s을 거부한다",
    (amount) => {
      expect(() => saveTransaction(base(), t({ amount }))).toThrow();
    },
  );
  it("없는 계좌, 자기 자신으로 이체, 기준일 이전 거래를 거부한다", () => {
    for (const v of [
      { accountId: "missing" },
      { kind: "transfer" as const, toId: "a" },
      { date: "2024-12-31" },
      { date: "2025-02-30" },
    ])
      expect(() => saveTransaction(base(), t(v))).toThrow();
  });
  it("중복 ID, 잘못된 버전, 손상된 스냅샷을 거부한다", () => {
    const d = saveTransaction(base(), t());
    expect(() => validateData({ ...d, transactions: [t(), t()] })).toThrow();
    expect(() => validateData({ ...d, version: 2 })).toThrow();
    expect(() =>
      validateData({
        ...d,
        snapshots: [
          {
            month: "2025-01",
            total: 1,
            balances: { a: 100 },
            recordedAt: "2025-02-01",
          },
        ],
      }),
    ).toThrow();
  });
  it("CSV의 한글·줄바꿈·따옴표를 보존하고 수식 실행을 방지한다", () => {
    const d = saveTransaction(
      base(),
      t({ title: "=SUM(A1)", memo: '메모,"줄\n바꿈"' }),
    );
    const out = csv(d);
    expect(out.startsWith("\uFEFF")).toBe(true);
    expect(out).toContain("'=SUM(A1)");
    expect(out).toContain('메모,""줄\n바꿈""');
  });
});
