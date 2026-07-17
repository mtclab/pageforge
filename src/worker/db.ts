import type { SiteData } from '../engine/types.js';
import type { BusinessProfile } from './business-profile.js';

/**
 * Minimal D1 type shim, kept local like the KV/R2 shims so unit tests can run
 * the real schema against better-sqlite3 (D1 is SQLite). Mirrors the subset of
 * the Cloudflare D1 API this control plane uses: prepare().bind().first/all/run
 * and batch() for atomic multi-statement mutations.
 */
export interface D1Result<T = Record<string, unknown>> {
  results: T[];
  success: boolean;
  meta: { last_row_id?: number; changes?: number };
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  run<T = Record<string, unknown>>(): Promise<D1Result<T>>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = Record<string, unknown>>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
  exec(query: string): Promise<{ count: number; duration: number }>;
}

export type AuditActor = 'operator' | 'approval-key' | 'mcp' | 'system';

export interface AuditEvent {
  actor: AuditActor;
  action: string;
  entity: string;
  entityId: string;
  detail?: unknown;
}

/** A row from `sites` (source of truth for the current published data). */
export interface SiteRow {
  id: number;
  public_id: string;
  prospect_id: number | null;
  approval_key_hash: string;
  current_version: number;
  data: string;
  status: SiteStatus;
  created_at: number;
  updated_at: number;
}

export type SiteStatus = 'draft' | 'staged' | 'approved' | 'published' | 'archived';

export const SITE_STATUSES: readonly SiteStatus[] = [
  'draft',
  'staged',
  'approved',
  'published',
  'archived',
];

/** Public view of a site, with data parsed. */
export interface Site {
  id: number;
  publicId: string;
  prospectId?: number;
  approvalKeyHash: string;
  currentVersion: number;
  data: SiteData;
  status: SiteStatus;
  createdAt: number;
  updatedAt: number;
}

/** Snapshot metadata as returned in the external version list (no data). */
export interface SnapshotMeta {
  n: number;
  at: number;
  note?: string;
}

export interface Snapshot extends SnapshotMeta {
  data: SiteData;
}

export interface Proposal {
  publicId: string;
  candidate: SiteData;
  summary: string[];
  status: 'open' | 'approved' | 'rejected' | 'superseded';
  at: number;
  note?: string;
}

export interface OpenProposal {
  proposalId: string;
  summary: string[];
  at: number;
}

export interface PhotoMeta {
  r2Key: string;
  contentType: string;
  bytes: number;
}

export type ProspectStatus =
  | 'loytynyt'
  | 'arvioitu'
  | 'luonnos'
  | 'yhteydenotto'
  | 'vastasi'
  | 'myyty'
  | 'julkaistu'
  | 'yllapidossa'
  | 'hylatty';

export const PROSPECT_STATUSES: readonly ProspectStatus[] = [
  'loytynyt',
  'arvioitu',
  'luonnos',
  'yhteydenotto',
  'vastasi',
  'myyty',
  'julkaistu',
  'yllapidossa',
  'hylatty',
];

export interface Prospect {
  id: number;
  publicId: string;
  name: string;
  status: ProspectStatus;
  yTunnus?: string;
  municipality?: string;
  vertical?: string;
  source?: string;
  statusReason?: string;
  contactEmail?: string;
  contactPhone?: string;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export interface BusinessProfileRecord {
  id: number;
  publicId: string;
  prospectId: number;
  data: BusinessProfile;
  consentNote?: string;
  createdAt: number;
  updatedAt: number;
}

interface BusinessProfileRow {
  id: number;
  public_id: string;
  prospect_id: number;
  data: string;
  consent_note: string | null;
  created_at: number;
  updated_at: number;
}

export interface SiteListItem extends Site {
  openProposalCount: number;
}

export interface StatusCounts {
  prospects: Record<ProspectStatus, number>;
  sites: Record<SiteStatus, number>;
  openProposals: number;
}

export interface AuditEventRecord extends AuditEvent {
  id: number;
  at: number;
}

export interface AuditEventOptions {
  entity?: string;
  entityId?: string;
  before?: number;
  limit: number;
}

interface AuditRow {
  id: number;
  at: number;
  actor: AuditActor;
  action: string;
  entity: string;
  entity_id: string;
  detail: string | null;
}

/** Newest-first snapshots are capped, matching the documented KV-era behavior. */
const MAX_SNAPSHOTS = 20;

/**
 * Repository over the D1 control plane. All multi-statement mutations run
 * through `batch()` so a partially-applied state can never be observed, and
 * every state change appends an append-only `audit_events` row.
 */
export class ControlPlane {
  constructor(private readonly db: D1Database) {}

  private now(): number {
    return Date.now();
  }

  private auditStatement(at: number, event: AuditEvent): D1PreparedStatement {
    return this.db
      .prepare(
        'INSERT INTO audit_events (at, actor, action, entity, entity_id, detail) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .bind(
        at,
        event.actor,
        event.action,
        event.entity,
        event.entityId,
        event.detail === undefined ? null : JSON.stringify(event.detail),
      );
  }

  async recordAudit(event: AuditEvent): Promise<void> {
    await this.auditStatement(this.now(), event).run();
  }

  private rowToSite(row: SiteRow): Site {
    return {
      id: row.id,
      publicId: row.public_id,
      ...(row.prospect_id === null ? {} : { prospectId: row.prospect_id }),
      approvalKeyHash: row.approval_key_hash,
      currentVersion: row.current_version,
      data: JSON.parse(row.data) as SiteData,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  // --- sites -------------------------------------------------------------

  async createSite(input: {
    publicId: string;
    approvalKeyHash: string;
    data: SiteData;
    prospectId?: number;
    actor: AuditActor;
  }): Promise<void> {
    const at = this.now();
    await this.db.batch([
      this.db
        .prepare(
          `INSERT INTO sites
             (public_id, prospect_id, approval_key_hash, current_version, data, status, created_at, updated_at)
           VALUES (?, ?, ?, 0, ?, 'draft', ?, ?)`,
        )
        .bind(
          input.publicId,
          input.prospectId ?? null,
          input.approvalKeyHash,
          JSON.stringify(input.data),
          at,
          at,
        ),
      this.auditStatement(at, {
        actor: input.actor,
        action: 'site.create',
        entity: 'site',
        entityId: input.publicId,
      }),
    ]);
  }

  async getSiteByPublicId(publicId: string): Promise<Site | null> {
    const row = await this.db
      .prepare('SELECT * FROM sites WHERE public_id = ?')
      .bind(publicId)
      .first<SiteRow>();
    return row ? this.rowToSite(row) : null;
  }

  async getSiteByProspectId(prospectId: number): Promise<Site | null> {
    const row = await this.db
      .prepare('SELECT * FROM sites WHERE prospect_id = ?')
      .bind(prospectId)
      .first<SiteRow>();
    return row ? this.rowToSite(row) : null;
  }

  async countsByStatus(): Promise<StatusCounts> {
    const [prospectRows, siteRows, proposalRow] = await Promise.all([
      this.db
        .prepare('SELECT status, COUNT(*) AS count FROM prospects GROUP BY status')
        .all<{ status: ProspectStatus; count: number }>(),
      this.db
        .prepare('SELECT status, COUNT(*) AS count FROM sites GROUP BY status')
        .all<{ status: SiteStatus; count: number }>(),
      this.db
        .prepare("SELECT COUNT(*) AS count FROM draft_versions WHERE kind = 'proposal' AND status = 'open'")
        .first<{ count: number }>(),
    ]);
    const prospects = Object.fromEntries(PROSPECT_STATUSES.map((status) => [status, 0])) as
      Record<ProspectStatus, number>;
    const sites = Object.fromEntries(SITE_STATUSES.map((status) => [status, 0])) as
      Record<SiteStatus, number>;
    for (const row of prospectRows.results) prospects[row.status] = row.count;
    for (const row of siteRows.results) sites[row.status] = row.count;
    return { prospects, sites, openProposals: proposalRow?.count ?? 0 };
  }

  /** Site list and open-proposal totals in one JOIN query (no per-site reads). */
  async listSites(): Promise<SiteListItem[]> {
    const { results } = await this.db
      .prepare(
        `SELECT s.*,
                SUM(CASE WHEN d.kind = 'proposal' AND d.status = 'open' THEN 1 ELSE 0 END)
                  AS open_proposal_count
           FROM sites s
           LEFT JOIN draft_versions d ON d.site_id = s.id
          GROUP BY s.id
          ORDER BY s.updated_at DESC, s.id DESC`,
      )
      .all<SiteRow & { open_proposal_count: number }>();
    return results.map((row) => ({
      ...this.rowToSite(row),
      openProposalCount: row.open_proposal_count,
    }));
  }

  async listSnapshots(siteId: number): Promise<SnapshotMeta[]> {
    const { results } = await this.db
      .prepare(
        `SELECT n, created_at, note FROM draft_versions
           WHERE site_id = ? AND kind = 'snapshot'
           ORDER BY n DESC`,
      )
      .bind(siteId)
      .all<{ n: number; created_at: number; note: string | null }>();
    return results.map((row) => ({
      n: row.n,
      at: row.created_at,
      ...(row.note === null ? {} : { note: row.note }),
    }));
  }

  private async getSnapshot(siteId: number, n: number): Promise<Snapshot | null> {
    const row = await this.db
      .prepare(
        `SELECT n, data, created_at, note FROM draft_versions
           WHERE site_id = ? AND kind = 'snapshot' AND n = ?`,
      )
      .bind(siteId, n)
      .first<{ n: number; data: string; created_at: number; note: string | null }>();
    if (!row) return null;
    return {
      n: row.n,
      at: row.created_at,
      data: JSON.parse(row.data) as SiteData,
      ...(row.note === null ? {} : { note: row.note }),
    };
  }

  /**
   * Bump current_version, store the OLD current data as an immutable snapshot,
   * and make `newData` current - all atomically. Optionally closes a proposal
   * (on approve). Prunes snapshots beyond the newest MAX_SNAPSHOTS. Returns the
   * new version number.
   */
  private async promote(
    site: Site,
    newData: SiteData,
    audit: AuditEvent,
    opts: { note?: string; closeProposalPublicId?: string } = {},
  ): Promise<number> {
    const at = this.now();
    const newN = site.currentVersion + 1;
    const statements: D1PreparedStatement[] = [
      this.db
        .prepare(
          `INSERT INTO draft_versions (site_id, n, data, note, kind, created_at)
           VALUES (?, ?, ?, ?, 'snapshot', ?)`,
        )
        .bind(site.id, newN, JSON.stringify(site.data), opts.note ?? null, at),
      this.db
        .prepare(
          `UPDATE sites SET data = ?, current_version = ?, status = 'published', updated_at = ?
             WHERE id = ?`,
        )
        .bind(JSON.stringify(newData), newN, at, site.id),
      this.db
        .prepare(
          `DELETE FROM draft_versions
             WHERE site_id = ? AND kind = 'snapshot' AND n <= ?`,
        )
        .bind(site.id, newN - MAX_SNAPSHOTS),
    ];
    if (opts.closeProposalPublicId !== undefined) {
      statements.push(
        this.db
          .prepare(
            `UPDATE draft_versions SET status = 'approved'
               WHERE site_id = ? AND kind = 'proposal' AND public_id = ?`,
          )
          .bind(site.id, opts.closeProposalPublicId),
      );
    }
    statements.push(this.auditStatement(at, audit));
    await this.db.batch(statements);
    return newN;
  }

  async updateSiteData(
    site: Site,
    newData: SiteData,
    audit: AuditEvent,
    note?: string,
  ): Promise<number> {
    return this.promote(site, newData, audit, note === undefined ? {} : { note });
  }

  // --- proposals ---------------------------------------------------------

  async createProposal(input: {
    site: Site;
    publicId: string;
    candidate: SiteData;
    summary: string[];
    note?: string;
    actor: AuditActor;
  }): Promise<void> {
    const at = this.now();
    await this.db.batch([
      this.db
        .prepare(
          `INSERT INTO draft_versions (site_id, data, note, kind, status, summary, public_id, created_at)
           VALUES (?, ?, ?, 'proposal', 'open', ?, ?, ?)`,
        )
        .bind(
          input.site.id,
          JSON.stringify(input.candidate),
          input.note ?? null,
          JSON.stringify(input.summary),
          input.publicId,
          at,
        ),
      this.auditStatement(at, {
        actor: input.actor,
        action: 'proposal.create',
        entity: 'proposal',
        entityId: input.publicId,
        detail: { siteId: input.site.publicId, summary: input.summary },
      }),
    ]);
  }

  async getProposal(siteId: number, proposalPublicId: string): Promise<Proposal | null> {
    const row = await this.db
      .prepare(
        `SELECT public_id, data, note, status, summary, created_at FROM draft_versions
           WHERE site_id = ? AND kind = 'proposal' AND public_id = ?`,
      )
      .bind(siteId, proposalPublicId)
      .first<{
        public_id: string;
        data: string;
        note: string | null;
        status: Proposal['status'];
        summary: string | null;
        created_at: number;
      }>();
    if (!row) return null;
    return {
      publicId: row.public_id,
      candidate: JSON.parse(row.data) as SiteData,
      summary: row.summary ? (JSON.parse(row.summary) as string[]) : [],
      status: row.status,
      at: row.created_at,
      ...(row.note === null ? {} : { note: row.note }),
    };
  }

  async listOpenProposals(siteId: number): Promise<OpenProposal[]> {
    const { results } = await this.db
      .prepare(
        `SELECT public_id, summary, created_at FROM draft_versions
           WHERE site_id = ? AND kind = 'proposal' AND status = 'open'
           ORDER BY created_at ASC, public_id ASC`,
      )
      .bind(siteId)
      .all<{ public_id: string; summary: string | null; created_at: number }>();
    return results.map((row) => ({
      proposalId: row.public_id,
      summary: row.summary ? (JSON.parse(row.summary) as string[]) : [],
      at: row.created_at,
    }));
  }

  /** Approve: snapshot current + promote candidate. Returns new version number. */
  async approveProposal(
    site: Site,
    proposal: Proposal,
    audit: AuditEvent,
  ): Promise<number> {
    return this.promote(site, proposal.candidate, audit, {
      ...(proposal.note === undefined ? {} : { note: proposal.note }),
      closeProposalPublicId: proposal.publicId,
    });
  }

  async rejectProposal(
    siteId: number,
    proposalPublicId: string,
    audit: AuditEvent,
  ): Promise<void> {
    const at = this.now();
    await this.db.batch([
      this.db
        .prepare(
          `UPDATE draft_versions SET status = 'rejected'
             WHERE site_id = ? AND kind = 'proposal' AND public_id = ? AND status = 'open'`,
        )
        .bind(siteId, proposalPublicId),
      this.auditStatement(at, audit),
    ]);
  }

  // --- rollback ----------------------------------------------------------

  /** Restore snapshot `n` (snapshotting the replaced current state first). */
  async rollbackSite(site: Site, n: number, audit: AuditEvent): Promise<number | null> {
    const target = await this.getSnapshot(site.id, n);
    if (!target) return null;
    return this.promote(site, target.data, audit);
  }

  // --- photos ------------------------------------------------------------

  async getPhotoMeta(r2Key: string): Promise<PhotoMeta | null> {
    const row = await this.db
      .prepare('SELECT r2_key, content_type, bytes FROM photos WHERE r2_key = ?')
      .bind(r2Key)
      .first<{ r2_key: string; content_type: string; bytes: number }>();
    if (!row) return null;
    return { r2Key: row.r2_key, contentType: row.content_type, bytes: row.bytes };
  }

  async putPhotoMeta(input: {
    r2Key: string;
    siteId?: number;
    contentType: string;
    bytes: number;
    actor: AuditActor;
  }): Promise<void> {
    const at = this.now();
    await this.db.batch([
      this.db
        .prepare(
          `INSERT INTO photos (r2_key, site_id, content_type, bytes, created_at)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .bind(input.r2Key, input.siteId ?? null, input.contentType, input.bytes, at),
      this.auditStatement(at, {
        actor: input.actor,
        action: 'photo.upload',
        entity: 'photo',
        entityId: input.r2Key,
        detail: { bytes: input.bytes, contentType: input.contentType },
      }),
    ]);
  }

  async photoCountForSite(siteId: number): Promise<number> {
    const row = await this.db
      .prepare('SELECT COUNT(*) AS count FROM photos WHERE site_id = ?')
      .bind(siteId)
      .first<{ count: number }>();
    return row?.count ?? 0;
  }

  // --- audit -------------------------------------------------------------

  private rowToAuditEvent(row: AuditRow): AuditEventRecord {
    return {
      id: row.id,
      at: row.at,
      actor: row.actor,
      action: row.action,
      entity: row.entity,
      entityId: row.entity_id,
      ...(row.detail === null ? {} : { detail: JSON.parse(row.detail) as unknown }),
    };
  }

  async listAuditEvents(opts: AuditEventOptions): Promise<AuditEventRecord[]> {
    const where: string[] = [];
    const values: unknown[] = [];
    if (opts.entity !== undefined) {
      where.push('entity = ?');
      values.push(opts.entity);
    }
    if (opts.entityId !== undefined) {
      where.push('entity_id = ?');
      values.push(opts.entityId);
    }
    if (opts.before !== undefined) {
      where.push('id < ?');
      values.push(opts.before);
    }
    const limit = Math.max(1, Math.min(100, Math.floor(opts.limit)));
    values.push(limit);
    const { results } = await this.db
      .prepare(
        `SELECT id, at, actor, action, entity, entity_id, detail
           FROM audit_events
          ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
          ORDER BY id DESC
          LIMIT ?`,
      )
      .bind(...values)
      .all<AuditRow>();
    return results.map((row) => this.rowToAuditEvent(row));
  }

  /** Includes direct site events and proposal events whose detail names this site. */
  async listAuditEventsForSite(sitePublicId: string, limit: number): Promise<AuditEventRecord[]> {
    const cappedLimit = Math.max(1, Math.min(100, Math.floor(limit)));
    const { results } = await this.db
      .prepare(
        `SELECT id, at, actor, action, entity, entity_id, detail
           FROM audit_events
          WHERE (entity = 'site' AND entity_id = ?)
             OR (detail IS NOT NULL AND json_extract(detail, '$.siteId') = ?)
          ORDER BY id DESC
          LIMIT ?`,
      )
      .bind(sitePublicId, sitePublicId, cappedLimit)
      .all<AuditRow>();
    return results.map((row) => this.rowToAuditEvent(row));
  }

  // --- business profiles -------------------------------------------------

  private rowToBusinessProfile(row: BusinessProfileRow): BusinessProfileRecord {
    return {
      id: row.id,
      publicId: row.public_id,
      prospectId: row.prospect_id,
      data: JSON.parse(row.data) as BusinessProfile,
      ...(row.consent_note === null ? {} : { consentNote: row.consent_note }),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async getBusinessProfileByPublicId(publicId: string): Promise<BusinessProfileRecord | null> {
    const row = await this.db
      .prepare('SELECT * FROM business_profiles WHERE public_id = ?')
      .bind(publicId)
      .first<BusinessProfileRow>();
    return row ? this.rowToBusinessProfile(row) : null;
  }

  async getBusinessProfileByProspectId(prospectId: number): Promise<BusinessProfileRecord | null> {
    const row = await this.db
      .prepare('SELECT * FROM business_profiles WHERE prospect_id = ?')
      .bind(prospectId)
      .first<BusinessProfileRow>();
    return row ? this.rowToBusinessProfile(row) : null;
  }

  async upsertBusinessProfile(input: {
    publicId: string;
    prospectId: number;
    data: BusinessProfile;
    actor: AuditActor;
  }): Promise<BusinessProfileRecord> {
    const existing = await this.getBusinessProfileByProspectId(input.prospectId);
    const at = this.now();
    const publicId = existing?.publicId ?? input.publicId;
    const consentNote = input.data.consent.note ?? null;
    const mutation = existing
      ? this.db
          .prepare(
            `UPDATE business_profiles
                SET data = ?, consent_note = ?, updated_at = ?
              WHERE prospect_id = ?`,
          )
          .bind(JSON.stringify(input.data), consentNote, at, input.prospectId)
      : this.db
          .prepare(
            `INSERT INTO business_profiles
               (public_id, prospect_id, data, consent_note, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
          )
          .bind(publicId, input.prospectId, JSON.stringify(input.data), consentNote, at, at);
    await this.db.batch([
      mutation,
      this.auditStatement(at, {
        actor: input.actor,
        action: existing ? 'profile.update' : 'profile.create',
        entity: 'profile',
        entityId: publicId,
        detail: { prospectId: input.prospectId },
      }),
    ]);
    return (await this.getBusinessProfileByProspectId(input.prospectId))!;
  }

  // --- prospects ---------------------------------------------------------

  private rowToProspect(row: Record<string, unknown>): Prospect {
    const optional = (value: unknown): string | undefined =>
      typeof value === 'string' ? value : undefined;
    return {
      id: row.id as number,
      publicId: row.public_id as string,
      name: row.name as string,
      status: row.status as ProspectStatus,
      ...(optional(row.y_tunnus) === undefined ? {} : { yTunnus: optional(row.y_tunnus) }),
      ...(optional(row.municipality) === undefined ? {} : { municipality: optional(row.municipality) }),
      ...(optional(row.vertical) === undefined ? {} : { vertical: optional(row.vertical) }),
      ...(optional(row.source) === undefined ? {} : { source: optional(row.source) }),
      ...(optional(row.status_reason) === undefined ? {} : { statusReason: optional(row.status_reason) }),
      ...(optional(row.contact_email) === undefined ? {} : { contactEmail: optional(row.contact_email) }),
      ...(optional(row.contact_phone) === undefined ? {} : { contactPhone: optional(row.contact_phone) }),
      ...(optional(row.notes) === undefined ? {} : { notes: optional(row.notes) }),
      createdAt: row.created_at as number,
      updatedAt: row.updated_at as number,
    };
  }

  async createProspect(input: {
    publicId: string;
    name: string;
    status: ProspectStatus;
    yTunnus?: string;
    municipality?: string;
    vertical?: string;
    source?: string;
    contactEmail?: string;
    contactPhone?: string;
    notes?: string;
    actor: AuditActor;
  }): Promise<void> {
    const at = this.now();
    await this.db.batch([
      this.db
        .prepare(
          `INSERT INTO prospects
             (public_id, name, y_tunnus, municipality, vertical, source, status,
              contact_email, contact_phone, notes, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          input.publicId,
          input.name,
          input.yTunnus ?? null,
          input.municipality ?? null,
          input.vertical ?? null,
          input.source ?? null,
          input.status,
          input.contactEmail ?? null,
          input.contactPhone ?? null,
          input.notes ?? null,
          at,
          at,
        ),
      this.auditStatement(at, {
        actor: input.actor,
        action: 'prospect.create',
        entity: 'prospect',
        entityId: input.publicId,
      }),
    ]);
  }

  async listProspects(status?: ProspectStatus): Promise<Prospect[]> {
    const statement = status
      ? this.db
          .prepare('SELECT * FROM prospects WHERE status = ? ORDER BY created_at DESC')
          .bind(status)
      : this.db.prepare('SELECT * FROM prospects ORDER BY created_at DESC');
    const { results } = await statement.all<Record<string, unknown>>();
    return results.map((row) => this.rowToProspect(row));
  }

  async getProspect(publicId: string): Promise<Prospect | null> {
    const row = await this.db
      .prepare('SELECT * FROM prospects WHERE public_id = ?')
      .bind(publicId)
      .first<Record<string, unknown>>();
    return row ? this.rowToProspect(row) : null;
  }

  async updateProspectStatus(input: {
    publicId: string;
    status: ProspectStatus;
    statusReason?: string;
    actor: AuditActor;
  }): Promise<boolean> {
    const at = this.now();
    const [update] = await this.db.batch([
      this.db
        .prepare('UPDATE prospects SET status = ?, status_reason = ?, updated_at = ? WHERE public_id = ?')
        .bind(input.status, input.statusReason ?? null, at, input.publicId),
      this.auditStatement(at, {
        actor: input.actor,
        action: 'prospect.status',
        entity: 'prospect',
        entityId: input.publicId,
        detail: {
          status: input.status,
          ...(input.statusReason === undefined ? {} : { statusReason: input.statusReason }),
        },
      }),
    ]);
    return (update?.meta.changes ?? 0) > 0;
  }
}
