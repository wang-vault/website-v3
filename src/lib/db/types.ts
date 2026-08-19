/** Tipe dasar untuk lapisan database (shared antara Postgres & JSON fallback). */

export type Row = Record<string, unknown>;

export interface QueryResult<T extends Row = Row> {
  rows: T[];
  rowCount: number;
}

/** Nilai kondisi WHERE yang kompleks. */
export type WhereValue =
  | { op: "in"; value: unknown[] }
  | { op: "notIn"; value: unknown[] }
  | { op: "ilike"; value: string }
  | { op: "like"; value: string }
  | { op: "between"; value: [unknown, unknown] }
  | { op: "ne" | "gt" | "gte" | "lt" | "lte"; value: unknown }
  | { op: "isNull"; value: boolean };

export type Where = Record<string, WhereValue | unknown>;

export interface OrderBy {
  column: string;
  dir: "asc" | "desc";
}

export interface SqlDriver {
  query<T extends Row = Row>(sql: string, params: unknown[]): Promise<QueryResult<T>>;
  execute<T extends Row = Row>(sql: string, params: unknown[]): Promise<QueryResult<T>>;
  tx<T>(fn: (d: SqlDriver) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

/** Mengubah objek `Where` menjadi SQL + params (dipakai bersama kedua driver). */
export function whereToSql(where: Where | undefined, params: unknown[], tableAlias?: string): string {
  if (!where) return "";
  const parts: string[] = [];
  for (const [col, raw] of Object.entries(where)) {
    if (raw === undefined) continue;
    const column = quoteIdent(col, tableAlias);
    if (raw && typeof raw === "object" && "op" in raw) {
      const cond = raw as WhereValue;
      switch (cond.op) {
        case "in": {
          const items = cond.value as unknown[];
          if (items.length === 0) {
            parts.push("1 = 0");
          } else {
            const ph = items.map((v) => `$${params.push(v)}`);
            parts.push(`${column} IN (${ph.join(", ")})`);
          }
          break;
        }
        case "notIn": {
          const items = cond.value as unknown[];
          if (items.length === 0) {
            parts.push("1 = 1");
          } else {
            const ph = items.map((v) => `$${params.push(v)}`);
            parts.push(`${column} NOT IN (${ph.join(", ")})`);
          }
          break;
        }
        case "ilike":
          parts.push(`${column} ILIKE $${params.push(cond.value)}`);
          break;
        case "like":
          parts.push(`${column} LIKE $${params.push(cond.value)}`);
          break;
        case "between":
          parts.push(`${column} BETWEEN $${params.push(cond.value[0])} AND $${params.push(cond.value[1])}`);
          break;
        case "ne":
          parts.push(`${column} != $${params.push(cond.value)}`);
          break;
        case "gt":
          parts.push(`${column} > $${params.push(cond.value)}`);
          break;
        case "gte":
          parts.push(`${column} >= $${params.push(cond.value)}`);
          break;
        case "lt":
          parts.push(`${column} < $${params.push(cond.value)}`);
          break;
        case "lte":
          parts.push(`${column} <= $${params.push(cond.value)}`);
          break;
        case "isNull":
          parts.push(cond.value ? `${column} IS NULL` : `${column} IS NOT NULL`);
          break;
        default:
          throw new Error(`Operator WHERE tidak didukung: ${String((cond as { op?: string }).op)}`);
      }
    } else {
      parts.push(`${column} = $${params.push(raw)}`);
    }
  }
  if (parts.length === 0) return "";
  return ` WHERE ${parts.join(" AND ")}`;
}

export function quoteIdent(col: string, tableAlias?: string): string {
  const clean = col.replace(/"/g, "").split(".").map((c) => `"${c}"`).join(".");
  return tableAlias ? `${tableAlias}.${clean}` : clean;
}

/** Helper type-safe CRUD di atas SqlDriver. */
export function table<T extends Row = Row>(name: string, driver: SqlDriver) {
  return {
    async all(opts?: { orderBy?: OrderBy[] }): Promise<T[]> {
      const orderBy = opts?.orderBy;
      const order = orderBy?.length ? ` ORDER BY ${orderBy.map((o) => `${quoteIdent(o.column)} ${o.dir.toUpperCase()}`).join(", ")}` : "";
      const res = await driver.query<T>(`SELECT * FROM ${name}${order}`, []);
      return res.rows;
    },
    async find(where: Where, opts?: { orderBy?: OrderBy[]; limit?: number; offset?: number }): Promise<T[]> {
      const params: unknown[] = [];
      const order = opts?.orderBy?.length
        ? ` ORDER BY ${opts.orderBy.map((o) => `${quoteIdent(o.column)} ${o.dir.toUpperCase()}`).join(", ")}`
        : "";
      const limit = opts?.limit !== undefined ? ` LIMIT $${params.push(opts.limit)}` : "";
      const offset = opts?.offset !== undefined ? ` OFFSET $${params.push(opts.offset)}` : "";
      const res = await driver.query<T>(
        `SELECT * FROM ${name}${whereToSql(where, params)}${order}${limit}${offset}`,
        params,
      );
      return res.rows;
    },
    async findOne(where: Where): Promise<T | null> {
      const rows = await this.find(where, { limit: 1 });
      return rows[0] ?? null;
    },
    async findById(id: string): Promise<T | null> {
      return this.findOne({ id } as Where);
    },
    async insert(row: Row, opts?: { returning?: boolean }): Promise<T> {
      const cols = Object.keys(row);
      const params = Object.values(row);
      const colSql = cols.map((c) => quoteIdent(c)).join(", ");
      const ph = cols.map((_, i) => `$${i + 1}`).join(", ");
      const returning = opts?.returning === false ? "" : " RETURNING *";
      const res = await driver.execute<T>(`INSERT INTO ${name} (${colSql}) VALUES (${ph})${returning}`, params);
      return res.rows[0] as T;
    },
    async update(id: string, patch: Row): Promise<T | null> {
      return this.updateWhere({ id } as Where, patch);
    },
    async updateWhere(where: Where, patch: Row): Promise<T | null> {
      const params: unknown[] = [];
      const sets = Object.entries(patch)
        .filter(([, v]) => v !== undefined)
        .map(([col, v]) => `${quoteIdent(col)} = $${params.push(v)}`)
        .join(", ");
      if (!sets) {
        const existing = await this.find(where, { limit: 1 });
        return existing[0] ?? null;
      }
      const res = await driver.execute<T>(
        `UPDATE ${name} SET ${sets}${whereToSql(where, params)} RETURNING *`,
        params,
      );
      return res.rows[0] ?? null;
    },
    async remove(id: string): Promise<boolean> {
      return this.removeWhere({ id } as Where);
    },
    async removeWhere(where: Where): Promise<boolean> {
      const params: unknown[] = [];
      const res = await driver.execute(`DELETE FROM ${name}${whereToSql(where, params)}`, params);
      return res.rowCount > 0;
    },
    async count(where?: Where): Promise<number> {
      const params: unknown[] = [];
      const res = await driver.query<{ count: number | string }>(
        `SELECT COUNT(*) AS count FROM ${name}${whereToSql(where, params)}`,
        params,
      );
      return Number(res.rows[0]?.count ?? 0);
    },
    /** SUM kolom numerik (0 jika kosong). */
    async sum(col: string, where?: Where): Promise<number> {
      const params: unknown[] = [];
      const res = await driver.query<{ total: number | string | null }>(
        `SELECT COALESCE(SUM(${quoteIdent(col)}), 0) AS total FROM ${name}${whereToSql(where, params)}`,
        params,
      );
      return Number(res.rows[0]?.total ?? 0);
    },
  };
}
