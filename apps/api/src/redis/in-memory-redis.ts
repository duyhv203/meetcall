export class InMemoryRedis {
  private store = new Map<string, { value: string; expiresAt?: number }>();
  private lists = new Map<string, string[]>();

  private isExpired(key: string): boolean {
    const item = this.store.get(key);
    if (!item) return false;
    if (item.expiresAt && Date.now() > item.expiresAt) {
      this.store.delete(key);
      return true;
    }
    return false;
  }

  async get(key: string): Promise<string | null> {
    if (this.isExpired(key)) return null;
    const item = this.store.get(key);
    return item ? item.value : null;
  }

  async set(
    key: string,
    value: unknown,
    mode?: string,
    duration?: number,
  ): Promise<'OK'> {
    let expiresAt: number | undefined;
    if (mode === 'EX' && duration) {
      expiresAt = Date.now() + duration * 1000;
    } else if (mode === 'PX' && duration) {
      expiresAt = Date.now() + duration;
    }
    this.store.set(key, { value: String(value), expiresAt });
    return 'OK';
  }

  async del(key: string): Promise<number> {
    const deletedStore = this.store.delete(key);
    const deletedList = this.lists.delete(key);
    return deletedStore || deletedList ? 1 : 0;
  }

  async incr(key: string): Promise<number> {
    return this.incrby(key, 1);
  }

  async incrby(key: string, increment: number): Promise<number> {
    const current = await this.get(key);
    const num = (parseInt(current || '0', 10) || 0) + increment;
    await this.set(key, String(num));
    return num;
  }

  async expire(key: string, seconds: number): Promise<number> {
    const item = this.store.get(key);
    if (item) {
      item.expiresAt = Date.now() + seconds * 1000;
      return 1;
    }
    return 0;
  }

  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    const list = this.lists.get(key) || [];
    if (stop === -1) {
      return list.slice(start);
    }
    return list.slice(start, stop + 1);
  }

  async rpush(key: string, ...items: string[]): Promise<number> {
    const list = this.lists.get(key) || [];
    list.push(...items);
    this.lists.set(key, list);
    return list.length;
  }

  async lrem(key: string, count: number, value: string): Promise<number> {
    const list = this.lists.get(key);
    if (!list) return 0;
    let removed = 0;
    if (count === 0) {
      this.lists.set(
        key,
        list.filter((item) => {
          if (item === value) {
            removed++;
            return false;
          }
          return true;
        }),
      );
    } else {
      const newList: string[] = [];
      let remCount = 0;
      for (const item of list) {
        if (item === value && remCount < count) {
          remCount++;
          removed++;
        } else {
          newList.push(item);
        }
      }
      this.lists.set(key, newList);
    }
    return removed;
  }

  multi(): {
    incr: (key: string) => any;
    expire: (key: string, seconds: number) => any;
    exec: () => Promise<any[]>;
  } {
    const operations: Array<() => Promise<any>> = [];
    const chain = {
      incr: (key: string) => {
        operations.push(() => this.incr(key));
        return chain;
      },
      expire: (key: string, seconds: number) => {
        operations.push(() => this.expire(key, seconds));
        return chain;
      },
      exec: async () => {
        const results = [];
        for (const op of operations) {
          results.push([null, await op()]);
        }
        return results;
      },
    };
    return chain;
  }

  async ping(): Promise<string> {
    return 'PONG';
  }
}
