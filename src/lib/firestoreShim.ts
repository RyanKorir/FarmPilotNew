/**
 * Firestore-compatible shim over Supabase.
 *
 * Every component imports Firestore symbols from 'firebase/firestore'
 * which our firebase.ts re-exports from here. The shim translates:
 *   - collection / doc / query / where / orderBy / limit
 *   - addDoc / updateDoc / deleteDoc / getDoc / getDocs
 *   - onSnapshot (real-time subscriptions via Supabase Realtime)
 *   - serverTimestamp / writeBatch / increment
 *
 * camelCase ↔ snake_case conversion is handled transparently.
 */

import { supabase } from './supabaseClient';
import { auth } from './supabaseAuth';
import { toCamelCaseDeep, toSnakeCaseDeep } from './caseConvert';
import type { RealtimeChannel } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

type WhereOp = '==' | '!=' | '<' | '<=' | '>' | '>=' | 'in' | 'not-in' | 'array-contains';

interface WhereConstraint {
  type: 'where';
  field: string;
  op: WhereOp;
  value: unknown;
}

interface OrderByConstraint {
  type: 'orderBy';
  field: string;
  direction: 'asc' | 'desc';
}

interface LimitConstraint {
  type: 'limit';
  n: number;
}

type QueryConstraint = WhereConstraint | OrderByConstraint | LimitConstraint;

// Firestore operators → Supabase PostgREST operators
const OP_MAP: Record<WhereOp, string> = {
  '==': 'eq',
  '!=': 'neq',
  '<': 'lt',
  '<=': 'lte',
  '>': 'gt',
  '>=': 'gte',
  'in': 'in',
  'not-in': 'not.in',
  'array-contains': 'cs',
};

function toSnakeField(field: string): string {
  return field.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
}

// ---------------------------------------------------------------------------
// Collection / document references (opaque descriptors)
// ---------------------------------------------------------------------------

export interface CollectionRef {
  _type: 'collection';
  table: string;
}

export interface DocRef {
  _type: 'doc';
  table: string;
  id: string;
}

export interface QueryRef {
  _type: 'query';
  table: string;
  constraints: QueryConstraint[];
}

export type Ref = CollectionRef | DocRef | QueryRef;

/** Returns a collection reference (mirrors Firestore's `collection(db, 'table')`) */
export function collection(_db: unknown, table: string): CollectionRef {
  // Handle sub-collections: 'inventory/itemId/history' → table = 'inventory_history'
  const parts = table.split('/');
  if (parts.length === 3) {
    // e.g. inventory/{id}/history → inventory_history
    const resolvedTable = `${parts[0]}_${parts[2]}`;
    return { _type: 'collection', table: resolvedTable };
  }
  return { _type: 'collection', table };
}

/** Returns a document reference (mirrors `doc(db, 'table', id)`) */
export function doc(_db: unknown, table: string, id: string): DocRef;
export function doc(collectionRef: CollectionRef, id: string): DocRef;
export function doc(refOrDb: unknown, tableOrId: string, id?: string): DocRef {
  if (typeof refOrDb === 'object' && refOrDb !== null && (refOrDb as CollectionRef)._type === 'collection') {
    const ref = refOrDb as CollectionRef;
    return { _type: 'doc', table: ref.table, id: tableOrId };
  }
  // doc(db, 'table', id)
  return { _type: 'doc', table: tableOrId, id: id! };
}

// ---------------------------------------------------------------------------
// Query builders
// ---------------------------------------------------------------------------

export function query(ref: CollectionRef | QueryRef, ...constraints: QueryConstraint[]): QueryRef {
  const existing = ref._type === 'query' ? ref.constraints : [];
  return { _type: 'query', table: ref.table, constraints: [...existing, ...constraints] };
}

export function where(field: string, op: WhereOp, value: unknown): WhereConstraint {
  return { type: 'where', field, op, value };
}

export function orderBy(field: string, direction: 'asc' | 'desc' = 'asc'): OrderByConstraint {
  return { type: 'orderBy', field, direction };
}

export function limit(n: number): LimitConstraint {
  return { type: 'limit', n };
}

// ---------------------------------------------------------------------------
// Apply constraints to a Supabase query builder
// ---------------------------------------------------------------------------

function applyConstraints(
  builder: ReturnType<typeof supabase.from>['select'] extends (...args: any[]) => infer R ? R : never,
  constraints: QueryConstraint[]
): typeof builder {
  let q: any = builder;
  for (const c of constraints) {
    if (c.type === 'where') {
      const col = toSnakeField(c.field);
      const supaOp = OP_MAP[c.op];
      if (c.op === 'in' || c.op === 'not-in') {
        q = q.filter(col, supaOp, `(${(c.value as unknown[]).join(',')})`);
      } else {
        q = q[supaOp]?.(col, c.value) ?? q.filter(col, supaOp, c.value);
      }
    } else if (c.type === 'orderBy') {
      q = q.order(toSnakeField(c.field), { ascending: c.direction === 'asc' });
    } else if (c.type === 'limit') {
      q = q.limit(c.n);
    }
  }
  return q;
}

// ---------------------------------------------------------------------------
// Document snapshot wrapper (mirrors Firestore's DocumentSnapshot)
// ---------------------------------------------------------------------------

class DocumentSnapshot {
  readonly id: string;
  readonly exists: boolean;
  private _data: Record<string, unknown> | null;

  constructor(id: string, data: Record<string, unknown> | null) {
    this.id = id;
    this.exists = data !== null;
    this._data = data ? (toCamelCaseDeep(data) as Record<string, unknown>) : null;
  }

  data(): Record<string, unknown> | undefined {
    return this._data ?? undefined;
  }
}

class QueryDocumentSnapshot extends DocumentSnapshot {
  data(): Record<string, unknown> {
    return super.data()!;
  }
}

class QuerySnapshot {
  readonly docs: QueryDocumentSnapshot[];
  readonly empty: boolean;

  constructor(rows: Record<string, unknown>[]) {
    this.docs = rows.map((r) => new QueryDocumentSnapshot(r.id as string, r));
    this.empty = this.docs.length === 0;
  }

  forEach(cb: (doc: QueryDocumentSnapshot) => void): void {
    this.docs.forEach(cb);
  }
}

// ---------------------------------------------------------------------------
// Read operations
// ---------------------------------------------------------------------------

/** Mirrors `getDoc(docRef)` */
export async function getDoc(ref: DocRef): Promise<DocumentSnapshot> {
  const { data, error } = await supabase
    .from(ref.table)
    .select('*')
    .eq('id', ref.id)
    .single();
  if (error && error.code !== 'PGRST116') throw error; // PGRST116 = not found
  return new DocumentSnapshot(ref.id, data ?? null);
}

/** Mirrors `getDocs(queryRef | collectionRef)` */
export async function getDocs(ref: QueryRef | CollectionRef): Promise<QuerySnapshot> {
  const constraints = ref._type === 'query' ? ref.constraints : [];
  let q: any = supabase.from(ref.table).select('*');
  q = applyConstraints(q, constraints);
  const { data, error } = await q;
  if (error) throw error;
  return new QuerySnapshot((data ?? []) as Record<string, unknown>[]);
}

// ---------------------------------------------------------------------------
// Write operations
// ---------------------------------------------------------------------------

/** Mirrors `addDoc(collectionRef, data)` — returns a doc-ref-like object with id */
export async function addDoc(
  ref: CollectionRef,
  data: Record<string, unknown>
): Promise<{ id: string }> {
  const user = auth.currentUser;
  const payload = toSnakeCaseDeep({
    ...data,
    // Supabase uses created_at/updated_at; strip Firestore-specific sentinels
    createdAt: undefined,
    updatedAt: undefined,
  }) as Record<string, unknown>;

  // Remove undefined values
  Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);

  const { data: inserted, error } = await supabase
    .from(ref.table)
    .insert(payload)
    .select('id')
    .single();
  if (error) throw error;
  return { id: inserted.id as string };
}

/** Mirrors `updateDoc(docRef, data)` */
export async function updateDoc(
  ref: DocRef,
  data: Record<string, unknown>
): Promise<void> {
  // Separate increment sentinels from regular fields
  const incrementFields: Record<string, number> = {};
  const regularData: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    if (value && typeof value === 'object' && '_increment' in (value as object)) {
      incrementFields[toSnakeField(key)] = (value as IncrementSentinel)._increment;
    } else {
      regularData[key] = value;
    }
  }

  // Apply regular fields first
  if (Object.keys(regularData).length > 0) {
    const payload = toSnakeCaseDeep(regularData) as Record<string, unknown>;
    Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);

    const { error } = await supabase
      .from(ref.table)
      .update(payload)
      .eq('id', ref.id);
    if (error) throw error;
  }

  // Apply increments via RPC or a read-then-write
  for (const [col, delta] of Object.entries(incrementFields)) {
    const { data: row, error: fetchErr } = await supabase
      .from(ref.table)
      .select(col)
      .eq('id', ref.id)
      .single();
    if (fetchErr) throw fetchErr;

    const current = (row as Record<string, unknown>)[col] as number ?? 0;
    const { error: updateErr } = await supabase
      .from(ref.table)
      .update({ [col]: current + delta })
      .eq('id', ref.id);
    if (updateErr) throw updateErr;
  }
}

/** Mirrors `deleteDoc(docRef)` */
export async function deleteDoc(ref: DocRef): Promise<void> {
  const { error } = await supabase.from(ref.table).delete().eq('id', ref.id);
  if (error) throw error;
}

/** Mirrors `setDoc(docRef, data)` */
export async function setDoc(
  ref: DocRef,
  data: Record<string, unknown>,
  options?: { merge?: boolean }
): Promise<void> {
  const payload = toSnakeCaseDeep({ ...data, id: ref.id }) as Record<string, unknown>;
  Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);

  if (options?.merge) {
    const { error } = await supabase.from(ref.table).upsert(payload);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from(ref.table)
      .upsert(payload, { onConflict: 'id' });
    if (error) throw error;
  }
}

// ---------------------------------------------------------------------------
// Real-time subscriptions (mirrors onSnapshot)
// ---------------------------------------------------------------------------

type SnapshotCallback = (snapshot: QuerySnapshot) => void;
type ErrorCallback = (error: Error) => void;

function buildChannelFilter(table: string, constraints: QueryConstraint[]): string {
  // Supabase Realtime filters are limited; we build a best-effort eq filter
  // on the first where('ownerId', '==', ...) / where('farmId', '==', ...) constraint
  const eqConstraints = constraints.filter(
    (c): c is WhereConstraint => c.type === 'where' && c.op === '=='
  );
  if (eqConstraints.length === 0) return '*';
  const { field, value } = eqConstraints[0];
  return `${toSnakeField(field)}=eq.${value}`;
}

/** Mirrors `onSnapshot(queryRef | collectionRef, onNext, onError?)` */
export function onSnapshot(
  ref: QueryRef | CollectionRef,
  onNext: SnapshotCallback,
  onError?: ErrorCallback
): () => void {
  const constraints = ref._type === 'query' ? ref.constraints : [];
  const table = ref.table;

  // Initial fetch
  const fetchData = async () => {
    try {
      let q: any = supabase.from(table).select('*');
      q = applyConstraints(q, constraints);
      const { data, error } = await q;
      if (error) throw error;
      onNext(new QuerySnapshot((data ?? []) as Record<string, unknown>[]));
    } catch (err) {
      onError?.(err instanceof Error ? err : new Error(String(err)));
    }
  };

  fetchData();

  // Subscribe to real-time changes and re-fetch the full filtered set
  // (Supabase Realtime sends row-level events; re-fetching is simpler and
  //  more correct than trying to apply the same filter client-side)
  const channel: RealtimeChannel = supabase
    .channel(`${table}-${Math.random().toString(36).slice(2)}`)
    .on(
      'postgres_changes' as any,
      { event: '*', schema: 'public', table },
      () => fetchData()
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

// ---------------------------------------------------------------------------
// Misc helpers
// ---------------------------------------------------------------------------

/** Mirrors Firestore's `serverTimestamp()` — returns current ISO string */
export function serverTimestamp(): string {
  return new Date().toISOString();
}

/** Mirrors Firestore's `increment(n)` — returns a plain number delta
 *  (handled server-side via RPC; for client use we just pass the value
 *   and the shim adds it in updateDoc if needed). Since most increment
 *   usages in the app are followed by a read, we expose a sentinel object
 *   that updateDoc recognises.
 */
export interface IncrementSentinel { _increment: number }
export function increment(n: number): IncrementSentinel {
  return { _increment: n };
}

/** Mirrors Firestore's `writeBatch(db)` */
export function writeBatch(_db: unknown) {
  const ops: Array<() => Promise<void>> = [];
  return {
    set(ref: DocRef, data: Record<string, unknown>, options?: { merge?: boolean }) {
      ops.push(() => setDoc(ref, data, options));
    },
    update(ref: DocRef, data: Record<string, unknown>) {
      ops.push(() => updateDoc(ref, data));
    },
    delete(ref: DocRef) {
      ops.push(() => deleteDoc(ref));
    },
    async commit() {
      for (const op of ops) await op();
    },
  };
}

/** The `db` object — kept for API compatibility (unused internally) */
export const db = { _supabase: supabase };

// ---------------------------------------------------------------------------
// Firebase compatibility stubs
// ---------------------------------------------------------------------------

/** Firestore Timestamp stub — we use ISO strings throughout */
export class Timestamp {
  readonly seconds: number;
  readonly nanoseconds: number;

  constructor(seconds: number, nanoseconds: number) {
    this.seconds = seconds;
    this.nanoseconds = nanoseconds;
  }

  static now(): Timestamp {
    return Timestamp.fromDate(new Date());
  }

  static fromDate(date: Date): Timestamp {
    const seconds = Math.floor(date.getTime() / 1000);
    return new Timestamp(seconds, 0);
  }

  toDate(): Date {
    return new Date(this.seconds * 1000);
  }

  toMillis(): number {
    return this.seconds * 1000;
  }
}
