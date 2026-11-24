interface Entry<T> {
  value?: T;
  pending?: Promise<T>;
  expires: number;
}

export class ResourceCache<T> {
  private entries = new Map<string, Entry<T>>();
  private maxAge: number;
  constructor(maxAge = Infinity) {
    this.maxAge = maxAge;
  }

  peek(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (entry && entry.expires > Date.now()) return entry.value;
    return undefined;
  }

  seed(key: string, value: T) {
    this.entries.set(key, { value, expires: Date.now() + this.maxAge });
  }

  load(key: string, loader: () => Promise<T>): Promise<T> {
    const current = this.entries.get(key);
    if (current?.pending) return current.pending;
    if (current && current.expires > Date.now())
      return Promise.resolve(current.value as T);
    const entry: Entry<T> = { expires: 0 };
    const pending = Promise.resolve()
      .then(loader)
      .then((value) => {
        if (this.entries.get(key) === entry) {
          entry.value = value;
          entry.expires = Date.now() + this.maxAge;
          entry.pending = undefined;
        }
        return value;
      })
      .catch((error) => {
        if (this.entries.get(key) === entry) this.entries.delete(key);
        throw error;
      });
    entry.pending = pending;
    this.entries.set(key, entry);
    return pending;
  }

  delete(key: string) {
    this.entries.delete(key);
  }
  clear() {
    this.entries.clear();
  }
}
