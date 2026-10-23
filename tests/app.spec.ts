import { test, expect } from "@playwright/test";
test("계좌와 거래 CRUD, 새 브라우저 세션의 저장, 이체와 카드, 백업 복원", async ({
  page,
  browser,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: "자산", exact: true }).click();
  await page.getByRole("button", { name: "계좌 등록", exact: true }).click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("계좌 별칭").fill("생활 통장");
  await dialog.getByLabel("금융기관").fill("신한은행");
  await dialog.getByLabel("시작 잔액 (원)").fill("1000000");
  await dialog.getByRole("button", { name: "계좌 저장" }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole("button", { name: "계좌 등록", exact: true }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("계좌 별칭").fill("여행 적금");
  await dialog.getByLabel("자산 유형").selectOption("적금");
  await dialog.getByLabel("시작 잔액 (원)").fill("200000");
  await dialog.getByRole("button", { name: "계좌 저장" }).click();
  await expect(dialog).not.toBeVisible();
  async function transaction(kind: string, amount: string, title: string) {
    await page.getByRole("button", { name: "거래 추가", exact: true }).click();
    const d = page.getByRole("dialog");
    await d.getByRole("button", { name: kind, exact: true }).click();
    await d.getByLabel("금액").fill(amount);
    await d.getByLabel("거래명 / 사용처").fill(title);
    return d;
  }
  dialog = await transaction("수입", "500000", "테스트 월급");
  await dialog.getByRole("button", { name: "기록 저장하기" }).click();
  await expect(dialog).not.toBeVisible();
  dialog = await transaction("지출", "10000", "테스트 점심");
  await dialog.getByRole("button", { name: "기록 저장하기" }).click();
  await expect(dialog).not.toBeVisible();
  dialog = await transaction("계좌이체", "300000", "적금 납입");
  await dialog.getByLabel("입금 계좌").selectOption({ label: "여행 적금" });
  await dialog.getByRole("button", { name: "기록 저장하기" }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole("button", { name: "홈", exact: true }).click();
  await expect(
    page.locator(".metric").filter({ hasText: "현재 총자산" }),
  ).toContainText("₩1,690,000");
  await expect(
    page.locator(".metric").filter({ hasText: "이번 달 소비" }),
  ).toContainText("₩10,000");
  await page.getByRole("button", { name: "가계부", exact: true }).click();
  await page.getByRole("button", { name: "테스트 점심 수정" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("금액").fill("20000");
  await dialog.getByRole("button", { name: "기록 저장하기" }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole("button", { name: "테스트 점심 수정" }).click();
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "삭제", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "테스트 점심 수정" }),
  ).toHaveCount(0);
  dialog = await transaction("지출", "70000", "카드 쇼핑");
  await dialog.getByLabel("결제 수단").selectOption("credit");
  await dialog.getByRole("button", { name: "기록 저장하기" }).click();
  await expect(dialog).not.toBeVisible();
  dialog = await transaction("카드대금", "70000", "카드 출금");
  await dialog.getByRole("button", { name: "기록 저장하기" }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole("button", { name: "홈", exact: true }).click();
  await expect(
    page.locator(".metric").filter({ hasText: "이번 달 소비" }),
  ).toContainText("₩70,000");
  await expect(
    page.locator(".metric").filter({ hasText: "현재 총자산" }),
  ).toContainText("₩1,630,000");
  await page.getByRole("button", { name: "설정", exact: true }).click();
  const csvPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "내보내기", exact: true }).click();
  const csvDownload = await csvPromise;
  const { readFile } = await import("node:fs/promises");
  const csvText = await readFile((await csvDownload.path())!, "utf8");
  expect(csvText).toContain("카드 쇼핑");
  expect(csvText).toContain("금액(원)");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "백업", exact: true }).click();
  const download = await downloadPromise;
  const path = await download.path();
  expect(path).toBeTruthy();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "한눈에 보는 나의 하루" }),
  ).toBeVisible();
  await expect(
    page.locator(".metric").filter({ hasText: "현재 총자산" }),
  ).toContainText("₩1,630,000");
  const state = await page.context().storageState({ indexedDB: true });
  const ctx = await browser.newContext({ storageState: state });
  const fresh = await ctx.newPage();
  await fresh.goto("/");
  await expect(
    fresh.locator(".metric").filter({ hasText: "현재 총자산" }),
  ).toContainText("₩1,630,000");
  await ctx.close();
  await page.getByRole("button", { name: "설정", exact: true }).click();
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "전체 데이터 삭제", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("모든 데이터를 삭제");
  page.once("dialog", (d) => d.accept());
  await page.locator("input[type=file]").setInputFiles(path!);
  await expect(page.getByRole("status")).toContainText("백업을 복원");
  await page.locator("input[type=file]").setInputFiles({
    name: "broken.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"version":99}'),
  });
  await expect(page.getByRole("alert")).toContainText(
    "지원하는 모구 백업 파일이 아닙니다",
  );
  await page.getByRole("button", { name: "홈", exact: true }).click();
  await expect(
    page.locator(".metric").filter({ hasText: "현재 총자산" }),
  ).toContainText("₩1,630,000");
  expect(errors).toEqual([]);
});
test("샘플 데이터, 5개 화면과 모바일 레이아웃", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: "설정", exact: true }).click();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "샘플 데이터 불러오기" }).click();
  await expect(page.getByRole("status")).toContainText("샘플 데이터를");
  await page.getByRole("button", { name: "홈", exact: true }).click();
  await page.screenshot({ path: ".local/desktop.png", fullPage: true });
  for (const name of ["가계부", "소비 분석", "자산", "설정"]) {
    await page.getByRole("button", { name, exact: true }).click();
    await expect(page.locator("h1")).toBeVisible();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "홈", exact: true }).click();
  await page.screenshot({ path: ".local/mobile.png", fullPage: true });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "거래 추가", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  expect(errors).toEqual([]);
});
test("실제 브라우저를 종료하고 다시 열어도 IndexedDB 기록이 유지된다", async () => {
  const { chromium } = await import("@playwright/test");
  const { mkdtemp } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const dir = await mkdtemp(join(tmpdir(), "mogu-persistence-"));
  const options = {
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox"],
    headless: true,
  };
  let context = await chromium.launchPersistentContext(dir, options);
  let page = await context.newPage();
  await page.goto("http://127.0.0.1:5173");
  await page.getByRole("button", { name: "설정", exact: true }).click();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "샘플 데이터 불러오기" }).click();
  await expect(page.getByRole("status")).toContainText("샘플 데이터를");
  await context.close();
  context = await chromium.launchPersistentContext(dir, options);
  page = await context.newPage();
  await page.goto("http://127.0.0.1:5173");
  await expect(
    page.locator(".metric").filter({ hasText: "현재 총자산" }),
  ).not.toContainText("₩0");
  await expect(page.locator(".transaction")).toHaveCount(5);
  await expect(page.locator(".recharts-pie-sector")).not.toHaveCount(0);
  await context.close();
});
