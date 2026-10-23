import { type Data, validateData, emptyData } from "./model";
function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open("mogu-ledger", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("ledger");
    r.onsuccess = () => resolve(r.result);
    r.onerror = () =>
      reject(
        Error(
          "브라우저 저장소를 열 수 없습니다. 개인정보 보호 설정을 확인해 주세요.",
        ),
      );
  });
}
export async function loadData(): Promise<Data> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("ledger", "readonly");
    const r = tx.objectStore("ledger").get("data");
    r.onsuccess = () => {
      try {
        resolve(r.result ? validateData(r.result) : emptyData());
      } catch (e) {
        reject(e);
      }
    };
    r.onerror = () => reject(r.error);
    tx.oncomplete = () => db.close();
  });
}
export async function persistData(d: Data) {
  validateData(d);
  const db = await open();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction("ledger", "readwrite");
    tx.objectStore("ledger").put(d, "data");
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(
        Error(
          "저장하지 못했습니다. 저장 공간과 브라우저 설정을 확인해 주세요.",
        ),
      );
    };
    tx.onabort = () => reject(Error("저장이 취소되었습니다."));
  });
}
