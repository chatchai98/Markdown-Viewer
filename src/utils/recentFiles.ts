export type RecentFile = {
  id: string;
  name: string;
  path?: string;
  size: number;
  openedAt: number;
  lastModified?: number;
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
  id?: string;
  name: string;
  path?: string;
  size: number;
  content: string;
  lastModified?: number;
}) {
  const fileId = file.id || createFileId(file.name, file.path, file.size, file.content, file.lastModified);
  const recentFile: RecentFile = {
    id: fileId,
    name: file.name,
    path: file.path,
    size: file.size,
    openedAt: Date.now(),
    lastModified: file.lastModified,
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

export async function updateRecentFilePath(id: string, path: string) {
  const nextRecentFiles = getRecentFiles().map((item) => {
    if (item.id === id) {
      return { ...item, path };
    }
    return item;
  });
  localStorage.setItem(metadataKey, JSON.stringify(nextRecentFiles));

  const storedFile = await getStoredFile(id);
  if (storedFile) {
    await putStoredFile({ ...storedFile, path });
  }

  return nextRecentFiles;
}


export function createFileId(
  name: string,
  path: string | undefined,
  size: number,
  content: string,
  lastModified: number | undefined,
) {
  let hash = 0;
  const value = path || `${name}:${size}:${lastModified ?? 0}:${content.slice(0, 2000)}`;

  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(31, hash) + value.charCodeAt(index);
  }

  return `${name}-${Math.abs(hash)}`;
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
