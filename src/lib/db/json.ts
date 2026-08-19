import { mkdir, readFile, rename, writeFile } from "fs/promises";
import path from "path";
import type { QueryResult, Row, SqlDriver } from "@/lib/db/types";
import { getSeedData } from "@/lib/db/seed";

/**
 * JSON datastore — FALLBACK UNTUK LOCAL DEVELOPMENT SAJA.
 *
 * Dipakai ketika DATABASE_URL belum dikonfigurasi dan NODE_ENV=development.
 * BUKAN production datastore. Preview/Production tanpa DATABASE_URL akan
 * gagal secara eksplisit (lihat src/lib/db/index.ts).
 *
 * Menjamin: atomic write (temp + rename), serialized write queue, auto seed,
 * dan dukungan transaction (snapshot + commit/rollback).
 */

interface DbState {
  version: number;
  tables: Record<string, Row[]>;
}

type Tok =
  | { t: "word"; v: string }
  | { t: "ident"; v: string }
  | { t: "string"; v: string }
  | { t: "number"; v: number }
  | { t: "param"; v: number }
  | { t: "op"; v: string }
  | { t: "lparen" }
  | { t: "rparen" }
  | { t: "comma" }
  | { t: "star" };


function tokVal(t: Tok | null | undefined): string {
  return t && "v" in t ? String(t.v) : "";
}

function tokenize(sql: string): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  const s = sql;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (c === '"') {
      let j = i + 1;
      while (j < s.length && s[j] !== '"') j++;
      toks.push({ t: "ident", v: s.slice(i + 1, j) });
      i = j + 1;
      continue;
    }
    if (c === "'") {
      let j = i + 1;
      let out = "";
      while (j < s.length) {
        if (s[j] === "'" && s[j + 1] === "'") {
          out += "'";
          j += 2;
          continue;
        }
        if (s[j] === "'") break;
        out += s[j];
        j++;
      }
      toks.push({ t: "string", v: out });
      i = j + 1;
      continue;
    }
    if (c === "$") {
      let j = i + 1;
      while (j < s.length && /\d/.test(s[j])) j++;
      toks.push({ t: "param", v: Number(s.slice(i + 1, j)) });
      i = j;
      continue;
    }
    if (/\d/.test(c)) {
      let j = i + 1;
      while (j < s.length && /[\d.]/.test(s[j])) j++;
      toks.push({ t: "number", v: Number(s.slice(i, j)) });
      i = j;
      continue;
    }
    if (/[a-zA-Z_]/.test(c)) {
      let j = i + 1;
      while (j < s.length && /[a-zA-Z0-9_]/.test(s[j])) j++;
      toks.push({ t: "word", v: s.slice(i, j) });
      i = j;
      continue;
    }
    if (c === "(") {
      toks.push({ t: "lparen" });
      i++;
      continue;
    }
    if (c === ")") {
      toks.push({ t: "rparen" });
      i++;
      continue;
    }
    if (c === ",") {
      toks.push({ t: "comma" });
      i++;
      continue;
    }
    if (c === "*") {
      toks.push({ t: "star" });
      i++;
      continue;
    }
    const two = s.slice(i, i + 2);
    if (["!=", "<>", ">=", "<="].includes(two)) {
      toks.push({ t: "op", v: two });
      i += 2;
      continue;
    }
    if (["=", ">", "<"].includes(c)) {
      toks.push({ t: "op", v: c });
      i++;
      continue;
    }
    throw new Error(`JSON datastore: token tidak dikenal di posisi ${i}: ${c}`);
  }
  return toks;
}

type Expr = { kind: "param"; n: number } | { kind: "literal"; value: unknown } | { kind: "col"; name: string };

type Cond =
  | { kind: "and"; left: Cond; right: Cond }
  | { kind: "or"; left: Cond; right: Cond }
  | { kind: "cmp"; col: string; op: string; right: Expr }
  | { kind: "isNull"; col: string; neg: boolean }
  | { kind: "in"; col: string; neg: boolean; values: Expr[] }
  | { kind: "between"; col: string; a: Expr; b: Expr }
  | { kind: "like"; col: string; neg: boolean; pattern: Expr; insensitive: boolean };

class WhereParser {
  private pos = 0;
  constructor(private toks: Tok[]) {}

  parse(): Cond | null {
    if (this.toks.length === 0) return null;
    const c = this.parseOr();
    if (this.pos !== this.toks.length) {
      throw new Error("JSON datastore: token sisa pada WHERE");
    }
    return c;
  }

  private peek(): Tok | null {
    return this.toks[this.pos] ?? null;
  }

  private next(): Tok {
    const t = this.toks[this.pos];
    if (!t) throw new Error("JSON datastore: akhir token tidak terduga");
    this.pos++;
    return t;
  }

  private isWord(v: string): boolean {
    const t = this.peek();
    return !!t && t.t === "word" && t.v.toUpperCase() === v;
  }

  private expectWord(v: string) {
    const t = this.next();
    if (t.t !== "word" || t.v.toUpperCase() !== v) {
      throw new Error(`JSON datastore: mengharapkan ${v}`);
    }
  }

  private parseOr(): Cond {
    let left = this.parseAnd();
    while (this.isWord("OR")) {
      this.next();
      left = { kind: "or", left, right: this.parseAnd() };
    }
    return left;
  }

  private parseAnd(): Cond {
    let left = this.parsePrimary();
    while (this.isWord("AND")) {
      this.next();
      left = { kind: "and", left, right: this.parsePrimary() };
    }
    return left;
  }

  private parsePrimary(): Cond {
    if (this.isWord("NOT")) {
      throw new Error("JSON datastore: NOT tidak didukung, gunakan != / NOT IN / IS NOT NULL");
    }
    if (this.peek()?.t === "lparen") {
      this.next();
      const inner = this.parseOr();
      const close = this.next();
      if (close.t !== "rparen") throw new Error("JSON datastore: ) hilang");
      return inner;
    }
    const colTok = this.next();
    if (colTok.t !== "ident" && colTok.t !== "word") {
      throw new Error("JSON datastore: kolom WHERE tidak valid");
    }
    const col = colTok.v;

    if (this.isWord("IS")) {
      this.next();
      const neg = this.isWord("NOT");
      if (neg) this.next();
      this.expectWord("NULL");
      return { kind: "isNull", col, neg };
    }

    if (this.isWord("IN") || this.isWord("NOT")) {
      let neg = false;
      if (this.isWord("NOT")) {
        this.next();
        neg = true;
      }
      this.expectWord("IN");
      this.next(); // (
      const values: Expr[] = [];
      while (this.peek()?.t !== "rparen") {
        values.push(this.parseExpr());
        if (this.peek()?.t === "comma") this.next();
      }
      this.next(); // )
      return { kind: "in", col, neg, values };
    }

    if (this.isWord("BETWEEN")) {
      this.next();
      const a = this.parseExpr();
      this.expectWord("AND");
      const b = this.parseExpr();
      return { kind: "between", col, a, b };
    }

    if (this.isWord("LIKE") || this.isWord("ILIKE")) {
      const t = this.next();
      const insensitive = tokVal(t).toUpperCase() === "ILIKE";
      const pattern = this.parseExpr();
      return { kind: "like", col, neg: false, pattern, insensitive };
    }

    const opTok = this.next();
    if (opTok.t !== "op") throw new Error("JSON datastore: operator perbandingan hilang");
    const right = this.parseExpr();
    return { kind: "cmp", col, op: opTok.v, right };
  }

  private parseExpr(): Expr {
    const t = this.next();
    if (t.t === "param") return { kind: "param", n: t.v };
    if (t.t === "number") return { kind: "literal", value: t.v };
    if (t.t === "string") return { kind: "literal", value: t.v };
    if (t.t === "ident" || t.t === "word") return { kind: "col", name: t.v };
    throw new Error("JSON datastore: ekspresi tidak valid");
  }
}

function evalExpr(e: Expr, params: unknown[], row: Row): unknown {
  switch (e.kind) {
    case "param":
      return params[e.n - 1];
    case "literal":
      return e.value;
    case "col":
      return row[e.name];
  }
}

function compareValues(a: unknown, b: unknown): number {
  if (a === null || a === undefined) return b === null || b === undefined ? 0 : -1;
  if (b === null || b === undefined) return 1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (a instanceof Date || b instanceof Date) {
    return new Date(String(a)).getTime() - new Date(String(b)).getTime();
  }
  const sa = String(a);
  const sb = String(b);
  const na = Number(sa);
  const nb = Number(sb);
  if (!Number.isNaN(na) && !Number.isNaN(nb) && sa.trim() !== "" && sb.trim() !== "") return na - nb;
  return sa < sb ? -1 : sa > sb ? 1 : 0;
}

function likeToRegex(pattern: string, insensitive: boolean): RegExp {
  let re = "^";
  for (const ch of pattern) {
    if (ch === "%") re += ".*";
    else if (ch === "_") re += ".";
    else re += ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  re += "$";
  return new RegExp(re, insensitive ? "i" : "");
}

function matchCond(cond: Cond, row: Row, params: unknown[]): boolean {
  switch (cond.kind) {
    case "and":
      return matchCond(cond.left, row, params) && matchCond(cond.right, row, params);
    case "or":
      return matchCond(cond.left, row, params) || matchCond(cond.right, row, params);
    case "cmp": {
      const a = row[cond.col];
      const b = evalExpr(cond.right, params, row);
      switch (cond.op) {
        case "=":
          return a === b || (a != null && b != null && compareValues(a, b) === 0);
        case "!=":
        case "<>":
          return !(a === b || (a != null && b != null && compareValues(a, b) === 0));
        case ">":
          return a != null && b != null && compareValues(a, b) > 0;
        case ">=":
          return a != null && b != null && compareValues(a, b) >= 0;
        case "<":
          return a != null && b != null && compareValues(a, b) < 0;
        case "<=":
          return a != null && b != null && compareValues(a, b) <= 0;
        default:
          throw new Error(`Operator tidak didukung: ${cond.op}`);
      }
    }
    case "isNull":
      return cond.neg ? row[cond.col] !== null && row[cond.col] !== undefined : row[cond.col] === null || row[cond.col] === undefined;
    case "in": {
      const vals = cond.values.map((v) => evalExpr(v, params, row));
      return cond.neg ? !vals.includes(row[cond.col]) : vals.includes(row[cond.col]);
    }
    case "between": {
      const a = evalExpr(cond.a, params, row) as number | string;
      const b = evalExpr(cond.b, params, row) as number | string;
      const v = row[cond.col] as number | string;
      return v != null && compareValues(v, a) >= 0 && compareValues(v, b) <= 0;
    }
    case "like": {
      const v = row[cond.col];
      if (v === null || v === undefined) return cond.neg;
      const pattern = String(evalExpr(cond.pattern, params, row));
      const matched = likeToRegex(pattern, cond.insensitive).test(String(v));
      return cond.neg ? !matched : matched;
    }
  }
}

interface SelectSpec {
  table: string;
  star: boolean;
  cols: { name: string; alias: string }[];
  agg: { fn: string; arg: string | null; alias: string } | null;
  where: Cond | null;
  orderBy: { col: string; dir: "asc" | "desc" }[];
  limit: number | null;
  offset: number | null;
}

/** Indeks token pertama (top-level, di luar tanda kurung) yang merupakan salah satu keyword. */
function indexOfTopLevelKeyword(toks: Tok[], keywords: string[], start = 0): number {
  let depth = 0;
  for (let i = start; i < toks.length; i++) {
    const t = toks[i];
    if (t.t === "lparen") depth++;
    else if (t.t === "rparen") depth--;
    else if (depth === 0 && t.t === "word" && keywords.includes(t.v.toUpperCase())) return i;
  }
  return -1;
}

function parseSelect(sql: string): SelectSpec {
  const toks = tokenize(sql);
  let i = 0;
  const kw = () => toks[i]?.t === "word" ? tokVal(toks[i]).toUpperCase() : "";
  if (kw() !== "SELECT") throw new Error("Bukan SELECT");
  i++;
  const spec: SelectSpec = { table: "", star: false, cols: [], agg: null, where: null, orderBy: [], limit: null, offset: null };

  // select list
  for (;;) {
    const t = toks[i];
    if (!t) throw new Error("SELECT tidak lengkap");
    if (t.t === "star") {
      spec.star = true;
      i++;
    } else if (t.t === "word" && ["COUNT", "SUM", "MIN", "MAX"].includes(t.v.toUpperCase())) {
      const fn = t.v.toUpperCase();
      i++;
      if (toks[i]?.t !== "lparen") throw new Error("( hilang");
      i++;
      let arg: string | null = null;
      if (toks[i]?.t === "star") {
        arg = null;
        i++;
      } else {
        arg = tokVal(toks[i]) || null;
        i++;
      }
      if (toks[i]?.t !== "rparen") throw new Error(") hilang");
      i++;
      let alias = fn.toLowerCase();
      if (toks[i]?.t === "word" && tokVal(toks[i]).toUpperCase() === "AS") {
        i++;
        alias = tokVal(toks[i]) || alias;
        i++;
      }
      spec.agg = { fn, arg, alias };
    } else if (t.t === "ident" || t.t === "word") {
      const name = t.v;
      i++;
      let alias = name;
      if (toks[i]?.t === "word" && tokVal(toks[i]).toUpperCase() === "AS") {
        i++;
        alias = tokVal(toks[i]) || name;
        i++;
      }
      spec.cols.push({ name, alias });
    } else {
      throw new Error("Kolom SELECT tidak valid");
    }
    if (toks[i]?.t === "comma") {
      i++;
      continue;
    }
    break;
  }

  if (kw() !== "FROM") throw new Error("FROM hilang");
  i++;
  spec.table = tokVal(toks[i]);
  i++;

  if (kw() === "WHERE") {
    const whereEnd = indexOfTopLevelKeyword(toks, ["ORDER", "LIMIT", "OFFSET"], i + 1);
    const whereSlice = whereEnd === -1 ? toks.slice(i + 1) : toks.slice(i + 1, whereEnd);
    const parser = new WhereParser(whereSlice);
    spec.where = parser.parse();
    if (whereEnd === -1) return spec;
    return finishOrder(spec, toks.slice(whereEnd));
  }

  return finishOrder(spec, toks.slice(i));
}

function finishOrder(spec: SelectSpec, rest: Tok[]): SelectSpec {
  let i = 0;
  const kw = () => rest[i]?.t === "word" ? tokVal(rest[i]).toUpperCase() : "";
  if (kw() === "ORDER") {
    i++;
    if (kw() !== "BY") throw new Error("BY hilang");
    i++;
    for (;;) {
      const col = tokVal(rest[i]);
      if (!col) throw new Error("kolom ORDER BY hilang");
      i++;
      let dir: "asc" | "desc" = "asc";
      if (kw() === "ASC" || kw() === "DESC") {
        dir = kw() === "DESC" ? "desc" : "asc";
        i++;
      }
      spec.orderBy.push({ col, dir });
      if (rest[i]?.t === "comma") {
        i++;
        continue;
      }
      break;
    }
  }
  if (kw() === "LIMIT") {
    i++;
    const t = rest[i];
    spec.limit = t?.t === "param" ? t.v : (t?.t === "number" ? t.v : null);
    i++;
  }
  if (kw() === "OFFSET") {
    i++;
    const t = rest[i];
    spec.offset = t?.t === "param" ? t.v : (t?.t === "number" ? t.v : null);
    i++;
  }
  if (i < rest.length) throw new Error("SQL SELECT tidak dikenali oleh JSON datastore");
  return spec;
}

function evalSelect(spec: SelectSpec, tables: Record<string, Row[]>, params: unknown[]): Row[] {
  const rows = (tables[spec.table] ?? []) as Row[];
  const filtered = spec.where ? rows.filter((r) => matchCond(spec.where as Cond, r, params)) : rows;

  if (spec.agg) {
    const { fn, arg, alias } = spec.agg;
    let value: unknown;
    if (fn === "COUNT") {
      value = arg ? filtered.filter((r) => r[arg] !== null && r[arg] !== undefined).length : filtered.length;
    } else if (fn === "SUM") {
      value = filtered.reduce((acc, r) => acc + (Number(r[arg ?? ""]) || 0), 0);
    } else if (fn === "MIN") {
      value = filtered.length ? Math.min(...filtered.map((r) => Number(r[arg ?? ""]) || 0)) : null;
    } else if (fn === "MAX") {
      value = filtered.length ? Math.max(...filtered.map((r) => Number(r[arg ?? ""]) || 0)) : null;
    } else {
      throw new Error(`Agregat tidak didukung: ${fn}`);
    }
    return [{ [alias]: value } as Row];
  }

  let out = filtered;
  if (spec.orderBy.length) {
    out = [...filtered].sort((a, b) => {
      for (const ob of spec.orderBy) {
        const c = compareValues(a[ob.col], b[ob.col]);
        if (c !== 0) return ob.dir === "desc" ? -c : c;
      }
      return 0;
    });
  }
  if (spec.offset) out = out.slice(spec.offset);
  if (spec.limit !== null && spec.limit !== undefined) out = out.slice(0, spec.limit);

  if (spec.star) return out;
  return out.map((r) => {
    const row: Row = {};
    for (const c of spec.cols) row[c.alias] = r[c.name];
    return row;
  });
}

interface InsertSpec {
  table: string;
  cols: string[];
  params: number[];
  returning: boolean;
}

function parseInsert(sql: string): InsertSpec {
  const toks = tokenize(sql);
  let i = 0;
  const kw = () => toks[i]?.t === "word" ? tokVal(toks[i]).toUpperCase() : "";
  if (kw() !== "INSERT") throw new Error("Bukan INSERT");
  i++;
  if (kw() !== "INTO") throw new Error("INTO hilang");
  i++;
  const table = tokVal(toks[i]);
  i++;
  if (toks[i]?.t !== "lparen") throw new Error("( kolom hilang");
  i++;
  const cols: string[] = [];
  while (toks[i]?.t !== "rparen") {
    cols.push(tokVal(toks[i]));
    i++;
    if (toks[i]?.t === "comma") i++;
  }
  i++;
  if (kw() !== "VALUES") throw new Error("VALUES hilang");
  i++;
  if (toks[i]?.t !== "lparen") throw new Error("( nilai hilang");
  i++;
  const params: number[] = [];
  while (toks[i]?.t !== "rparen") {
    const t = toks[i];
    if (t?.t === "param") params.push(t.v);
    else throw new Error("Hanya $n yang didukung di VALUES");
    i++;
    if (toks[i]?.t === "comma") i++;
  }
  i++;
  let returning = false;
  if (kw() === "RETURNING") {
    returning = true;
  }
  return { table, cols, params, returning };
}

interface UpdateSpec {
  table: string;
  sets: { col: string; param: number }[];
  where: Cond | null;
  returning: boolean;
}

function parseUpdate(sql: string): UpdateSpec {
  const toks = tokenize(sql);
  let i = 0;
  const kw = () => toks[i]?.t === "word" ? tokVal(toks[i]).toUpperCase() : "";
  if (kw() !== "UPDATE") throw new Error("Bukan UPDATE");
  i++;
  const table = tokVal(toks[i]);
  i++;
  if (kw() !== "SET") throw new Error("SET hilang");
  i++;
  const sets: { col: string; param: number }[] = [];
  for (;;) {
    const col = tokVal(toks[i]);
    i++;
    if (toks[i]?.t !== "op" || tokVal(toks[i]) !== "=") throw new Error("= hilang");
    i++;
    const t = toks[i];
    if (t?.t !== "param") throw new Error("Hanya $n didukung di SET");
    sets.push({ col, param: t.v });
    i++;
    if (toks[i]?.t === "comma") {
      i++;
      continue;
    }
    break;
  }
  let where: Cond | null = null;
  if (kw() === "WHERE") {
    const whereEnd = indexOfTopLevelKeyword(toks, ["RETURNING"], i + 1);
    const whereSlice = whereEnd === -1 ? toks.slice(i + 1) : toks.slice(i + 1, whereEnd);
    const parser = new WhereParser(whereSlice);
    where = parser.parse();
    if (whereEnd !== -1) {
      const rest = toks.slice(whereEnd);
      if (rest[0]?.t === "word" && rest[0].v.toUpperCase() === "RETURNING") return { table, sets, where, returning: true };
    }
    return { table, sets, where, returning: false };
  }
  let returning = false;
  if (kw() === "RETURNING") returning = true;
  return { table, sets, where, returning };
}

function parseDelete(sql: string): { table: string; where: Cond | null; returning: boolean } {
  const toks = tokenize(sql);
  let i = 0;
  const kw = () => toks[i]?.t === "word" ? tokVal(toks[i]).toUpperCase() : "";
  if (kw() !== "DELETE") throw new Error("Bukan DELETE");
  i++;
  if (kw() !== "FROM") throw new Error("FROM hilang");
  i++;
  const table = tokVal(toks[i]);
  i++;
  let where: Cond | null = null;
  if (kw() === "WHERE") {
    i++;
    const parser = new WhereParser(toks.slice(i));
    where = parser.parse();
    return { table, where, returning: false };
  }
  let returning = false;
  if (kw() === "RETURNING") returning = true;
  return { table, where, returning };
}

const FILE_VERSION = 1;

export class JsonDriver implements SqlDriver {
  private state: DbState | null = null;
  private chain: Promise<unknown> = Promise.resolve();

  constructor(private filePath: string) {}

  private runExclusive<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.chain.then(fn, fn);
    this.chain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private async load(): Promise<DbState> {
    if (this.state) return this.state;
    let data: string | null = null;
    try {
      data = await readFile(this.filePath, "utf8");
    } catch {
      data = null;
    }
    if (data) {
      const parsed = JSON.parse(data) as DbState;
      this.state = parsed;
      return parsed;
    }
    // Auto-seed pertama kali
    const seeded: DbState = { version: FILE_VERSION, tables: getSeedData() };
    await this.save(seeded);
    this.state = seeded;
    return seeded;
  }

  private async save(state: DbState): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    const tmp = `${this.filePath}.${process.pid}.tmp`;
    await writeFile(tmp, JSON.stringify(state), "utf8");
    await rename(tmp, this.filePath);
  }

  async query<T extends Row = Row>(sql: string, params: unknown[]): Promise<QueryResult<T>> {
    await this.chain;
    const state = await this.load();
    const spec = parseSelect(sql);
    const rows = evalSelect(spec, state.tables, params) as T[];
    return { rows, rowCount: rows.length };
  }

  async execute<T extends Row = Row>(sql: string, params: unknown[]): Promise<QueryResult<T>> {
    return this.runExclusive(async () => {
      const state = await this.load();
      const trimmed = sql.trim();
      let table: string;
      let rows: Row[];

      if (/^INSERT/i.test(trimmed)) {
        const spec = parseInsert(sql);
        table = spec.table;
        rows = state.tables[table] ?? [];
        const row: Row = {};
        spec.cols.forEach((col, idx) => {
          row[col] = params[spec.params[idx] - 1];
        });
        rows.push(row);
        state.tables[table] = rows;
        await this.save(state);
        return { rows: (spec.returning ? [row] : []) as T[], rowCount: 1 };
      }

      if (/^UPDATE/i.test(trimmed)) {
        const spec = parseUpdate(sql);
        table = spec.table;
        rows = state.tables[table] ?? [];
        let changed = 0;
        const updated: Row[] = [];
        for (const r of rows) {
          if (spec.where && !matchCond(spec.where, r, params)) continue;
          const patch: Row = {};
          for (const s of spec.sets) patch[s.col] = params[s.param - 1];
          Object.assign(r, patch);
          updated.push(r);
          changed++;
        }
        state.tables[table] = rows;
        await this.save(state);
        return { rows: (spec.returning ? updated : []) as T[], rowCount: changed };
      }

      if (/^DELETE/i.test(trimmed)) {
        const spec = parseDelete(sql);
        table = spec.table;
        rows = state.tables[table] ?? [];
        const kept: Row[] = [];
        const removed: Row[] = [];
        for (const r of rows) {
          if (spec.where && !matchCond(spec.where, r, params)) {
            kept.push(r);
          } else {
            removed.push(r);
          }
        }
        state.tables[table] = kept;
        await this.save(state);
        return { rows: (spec.returning ? removed : []) as T[], rowCount: removed.length };
      }

      throw new Error("Statement SQL tidak didukung oleh JSON datastore");
    });
  }

  async tx<T>(fn: (d: SqlDriver) => Promise<T>): Promise<T> {
    return this.runExclusive(async () => {
      const state = await this.load();
      const snapshot: DbState = structuredClone(state);
      const txDriver: SqlDriver = {
        query: async <T extends Row = Row>(q: string, p: unknown[]) => {
          const spec = parseSelect(q);
          const rows = evalSelect(spec, snapshot.tables, p) as T[];
          return { rows, rowCount: rows.length };
        },
        execute: async <T extends Row = Row>(q: string, p: unknown[]) => {
          const trimmed = q.trim();
          if (/^INSERT/i.test(trimmed)) {
            const spec = parseInsert(q);
            const row: Row = {};
            spec.cols.forEach((col, idx) => {
              row[col] = p[spec.params[idx] - 1];
            });
            (snapshot.tables[spec.table] ??= []).push(row);
            return { rows: (spec.returning ? [row] : []) as T[], rowCount: 1 };
          }
          if (/^UPDATE/i.test(trimmed)) {
            const spec = parseUpdate(q);
            let changed = 0;
            const updated: Row[] = [];
            for (const r of snapshot.tables[spec.table] ?? []) {
              if (spec.where && !matchCond(spec.where, r, p)) continue;
              const patch: Row = {};
              for (const s of spec.sets) patch[s.col] = p[s.param - 1];
              Object.assign(r, patch);
              updated.push(r);
              changed++;
            }
            return { rows: (spec.returning ? updated : []) as T[], rowCount: changed };
          }
          if (/^DELETE/i.test(trimmed)) {
            const spec = parseDelete(q);
            const kept: Row[] = [];
            const removed: Row[] = [];
            for (const r of snapshot.tables[spec.table] ?? []) {
              if (spec.where && !matchCond(spec.where, r, p)) kept.push(r);
              else removed.push(r);
            }
            snapshot.tables[spec.table] = kept;
            return { rows: (spec.returning ? removed : []) as T[], rowCount: removed.length };
          }
          throw new Error("Statement SQL tidak didukung oleh JSON datastore");
        },
        tx: async (inner) => inner(txDriver),
        close: async () => undefined,
      };
      const result = await fn(txDriver);
      this.state = snapshot;
      await this.save(snapshot);
      return result;
    });
  }

  async close(): Promise<void> {
    // Tidak ada resource yang perlu ditutup
  }
}

export function createJsonDriver(dataDir?: string): SqlDriver {
  const dir = dataDir ?? path.join(process.cwd(), "data");
  return new JsonDriver(path.join(dir, "wangstore.json"));
}
