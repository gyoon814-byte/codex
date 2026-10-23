import "fake-indexeddb/auto";
import { expect, it } from "vitest";
import { loadData, persistData } from "./storage";
import { emptyData, sampleData } from "./model";
it("새 저장소는 빈 상태이며 저장 후 다시 열어도 기록을 보존한다", async () => {
  expect(await loadData()).toEqual(emptyData());
  const data = sampleData();
  await persistData(data);
  expect(await loadData()).toEqual(data);
  await persistData(emptyData());
  expect(await loadData()).toEqual(emptyData());
});
