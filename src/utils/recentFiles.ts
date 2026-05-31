export type RecentFile = {
  id: string;
  name: string;
  size: number;
  openedAt: number;
};

const databaseName = "markdown-viewer";
const storeName = "recent-files";
const metadataKey = "markdown-viewer:recent-files";
const maxRecentFiles = 10;

type StoredFile = RecentFile & {
  content: string;
};

export function getRecentFiles(): RecentFile[] {
  try {
    const storedValue = localStorage.getItem(metadataKey);
    if (!storedValue) {
      return [];
    }

    return JSON.parse(storedValue) as RecentFile[];
  } catch {
    return [];
  }
}

export async function saveRecentFile(file: {
  name: string;
  size: number;
  content: string;
}) {
  const recentFile: RecentFile = {
    id: createFileId(file.name, file.size, file.content),
    name: file.name,
    size: file.size,
    openedAt: Date.now(),
  };

  const nextRecentFiles = [
    recentFile,
    ...getRecentFiles().filter((item) => item.id !== recentFile.id),
  ].slice(0, maxRecentFiles);

  localStorage.setItem(metadataKey, JSON.stringify(nextRecentFiles));
  await putStoredFile({ ...recentFile, content: file.content });

  return nextRecentFiles;
}

export async function openRecentFile(id: string) {
  return getStoredFile(id);
}

export async function clearRecentFiles() {
  localStorage.removeItem(metadataKey);
  const database = await openDatabase();

  await requestToPromise(database.clear(storeName, "readwrite"));
  database.close();
}

export async function deleteRecentFile(id: string) {
  const nextRecentFiles = getRecentFiles().filter((item) => item.id !== id);
  localStorage.setItem(metadataKey, JSON.stringify(nextRecentFiles));

  const database = await openDatabase();
  await requestToPromise(database.delete(storeName, id, "readwrite"));
  database.close();

  return nextRecentFiles;
}

function createFileId(name: string, size: number, content: string) {
  let hash = 0;
  const value = `${name}:${size}:${content.length}:${content.slice(0, 2000)}`;

  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(31, hash) + value.charCodeAt(index);
  }

  return `${name}-${size}-${Math.abs(hash)}`;
}

async function putStoredFile(file: StoredFile) {
  const database = await openDatabase();

  await requestToPromise(database.put(storeName, file, "readwrite"));
  database.close();
}

async function getStoredFile(id: string) {
  const database = await openDatabase();
  const result = await requestToPromise<StoredFile | undefined>(
    database.get(storeName, id),
  );

  database.close();
  return result;
}

function openDatabase() {
  return new Promise<RecentDatabase>((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);

    request.onupgradeneeded = () => {
      request.result.createObjectStore(storeName, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(new RecentDatabase(request.result));
    request.onerror = () => reject(request.error);
  });
}

function requestToPromise<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

class RecentDatabase {
  constructor(private readonly database: IDBDatabase) {}

  get(store: string, key: string) {
    return this.transaction(store, "readonly").get(key);
  }

  put(store: string, value: StoredFile, mode: IDBTransactionMode) {
    return this.transaction(store, mode).put(value);
  }

  clear(store: string, mode: IDBTransactionMode) {
    return this.transaction(store, mode).clear();
  }

  delete(store: string, key: string, mode: IDBTransactionMode) {
    return this.transaction(store, mode).delete(key);
  }

  close() {
    this.database.close();
  }

  private transaction(store: string, mode: IDBTransactionMode) {
    return this.database.transaction(store, mode).objectStore(store);
  }
}
