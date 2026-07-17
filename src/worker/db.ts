import type { SiteData } from '../engine/types.js';
import type { BusinessProfile } from './business-profile.js';
import type { CheckResult } from './qa.js';

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
  published_version: number | null;
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
  publishedVersion?: number;
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

export interface QaRun {
  id: number;
  siteId: number;
  version: number;
  results: CheckResult[];
  passed: boolean;
  createdAt: number;
}

export interface LaunchChecklistRecord {
  siteId: number;
  item: string;
  checkedAt: number;
  checkedBy: string;
}

export interface PreviewToken {
  id: number;
  tokenHash: string;
  siteId: number;
  proposalPublicId?: string;
  label: string;
  expiresAt: number;
  revokedAt?: number;
  createdAt: number;
}

export type UpdateRequestChannel = 'email' | 'panel' | 'mcp';
export type UpdateRequestStatus = 'uusi' | 'ehdotettu' | 'suljettu';

export interface UpdateRequest {
  id: number;
  siteId: number;
  sitePublicId: string;
  siteName: string;
  channel: UpdateRequestChannel;
  fromAddr?: string;
  subject?: string;
  body: string;
  status: UpdateRequestStatus;
  proposalPublicId?: string;
  createdAt: number;
}

export interface PanelToken {
  id: number;
  tokenHash: string;
  siteId: number;
  expiresAt: number;
  revokedAt?: number;
  createdAt: number;
}

export type OrderStatus =
  | 'luotu'
  | 'maksettu'
  | 'peruttu'
  | 'maksu_epaonnistui'
  | 'irtisanottu';

export const ORDER_STATUSES: readonly OrderStatus[] = [
  'luotu',
  'maksettu',
  'peruttu',
  'maksu_epaonnistui',
  'irtisanottu',
];

export interface Order {
  id: number;
  publicId: string;
  siteId: number;
  kind: 'build_and_host';
  status: OrderStatus;
  provider: string;
  providerSessionId?: string;
  providerSubId?: string;
  amountBuildCents: number;
  amountMonthlyCents: number;
  currency: string;
  createdAt: number;
  updatedAt: number;
}

interface OrderRow {
  id: number;
  public_id: string;
  site_id: number;
  kind: 'build_and_host';
  status: OrderStatus;
  provider: string;
  provider_session_id: string | null;
  provider_sub_id: string | null;
  amount_build_cents: number;
  amount_monthly_cents: number;
  currency: string;
  created_at: number;
  updated_at: number;
}

export type ProvisioningRunStatus = 'kaynnissa' | 'valmis' | 'keskeytetty';
export type ProvisioningStepStatus = 'odottaa' | 'tehty' | 'ohitettu' | 'epaonnistui';
export type RenewalKind = 'domain' | 'postilaatikko';
export type RenewalStatus = 'tulossa' | 'hoidettu';

export interface ProvisioningRun {
  id: number;
  publicId: string;
  siteId: number;
  orderId?: number;
  domain: string;
  status: ProvisioningRunStatus;
  createdAt: number;
  updatedAt: number;
  sitePublicId?: string;
  siteName?: string;
}

export interface ProvisioningStep {
  id: number;
  runId: number;
  step: string;
  ord: number;
  status: ProvisioningStepStatus;
  evidence?: string;
  updatedAt: number;
}

export interface Renewal {
  id: number;
  siteId: number;
  kind: RenewalKind;
  label: string;
  dueAt: number;
  status: RenewalStatus;
  createdAt: number;
  sitePublicId?: string;
  siteName?: string;
}

interface ProvisioningRunRow {
  id: number;
  public_id: string;
  site_id: number;
  order_id: number | null;
  domain: string;
  status: ProvisioningRunStatus;
  created_at: number;
  updated_at: number;
  site_public_id?: string;
  site_data?: string;
}

interface ProvisioningStepRow {
  id: number;
  run_id: number;
  step: string;
  ord: number;
  status: ProvisioningStepStatus;
  evidence: string | null;
  updated_at: number;
}

interface RenewalRow {
  id: number;
  site_id: number;
  kind: RenewalKind;
  label: string;
  due_at: number;
  status: RenewalStatus;
  created_at: number;
  site_public_id?: string;
  site_data?: string;
}

export interface BillingEvent {
  id: number;
  orderId?: number;
  type: string;
  payload: string;
  createdAt: number;
}

export type CommentAuthor = 'operator' | 'customer';

export interface DraftComment {
  id: number;
  siteId: number;
  proposalPublicId?: string;
  author: CommentAuthor;
  body: string;
  createdAt: number;
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

export interface PublishedSite {
  publicId: string;
  updatedAt: number;
}

export interface StatusCounts {
  prospects: Record<ProspectStatus, number>;
  sites: Record<SiteStatus, number>;
  openProposals: number;
  openUpdateRequests: number;
  orders: Record<OrderStatus, number>;
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

export interface DeletionLogRecord {
  id: number;
  siteId: number;
  sitePublicId: string;
  item: string;
  detail?: unknown;
  actor: string;
  createdAt: number;
}

export interface DeletionLogOptions {
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
export const PROPOSAL_TTL_MS = 14 * 24 * 60 * 60 * 1000;

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

  private deletionStatement(
    at: number,
    site: Pick<Site, 'id' | 'publicId'>,
    item: string,
    actor: AuditActor,
    detail?: unknown,
  ): D1PreparedStatement {
    return this.db
      .prepare(
        `INSERT INTO deletion_log
           (site_id, site_public_id, item, detail, actor, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        site.id,
        site.publicId,
        item,
        detail === undefined ? null : JSON.stringify(detail),
        actor,
        at,
      );
  }

  private async count(query: string, ...values: unknown[]): Promise<number> {
    const row = await this.db.prepare(query).bind(...values).first<{ count: number }>();
    return row?.count ?? 0;
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
      ...(row.published_version == null ? {} : { publishedVersion: row.published_version }),
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

  async getSiteById(id: number): Promise<Site | null> {
    const row = await this.db.prepare('SELECT * FROM sites WHERE id = ?').bind(id).first<SiteRow>();
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
    const [prospectRows, siteRows, openProposals, openUpdateRequests, orderRows] = await Promise.all([
      this.db
        .prepare('SELECT status, COUNT(*) AS count FROM prospects GROUP BY status')
        .all<{ status: ProspectStatus; count: number }>(),
      this.db
        .prepare('SELECT status, COUNT(*) AS count FROM sites GROUP BY status')
        .all<{ status: SiteStatus; count: number }>(),
      this.count(
        "SELECT COUNT(*) AS count FROM draft_versions WHERE kind = 'proposal' AND status = 'open' AND created_at >= ?",
        this.now() - PROPOSAL_TTL_MS,
      ),
      this.count("SELECT COUNT(*) AS count FROM update_requests WHERE status != 'suljettu'"),
      this.db
        .prepare('SELECT status, COUNT(*) AS count FROM orders GROUP BY status')
        .all<{ status: OrderStatus; count: number }>(),
    ]);
    const prospects = Object.fromEntries(PROSPECT_STATUSES.map((status) => [status, 0])) as
      Record<ProspectStatus, number>;
    const sites = Object.fromEntries(SITE_STATUSES.map((status) => [status, 0])) as
      Record<SiteStatus, number>;
    for (const row of prospectRows.results) prospects[row.status] = row.count;
    for (const row of siteRows.results) sites[row.status] = row.count;
    const orders = Object.fromEntries(ORDER_STATUSES.map((status) => [status, 0])) as
      Record<OrderStatus, number>;
    for (const row of orderRows.results) orders[row.status] = row.count;
    return {
      prospects,
      sites,
      openProposals,
      openUpdateRequests,
      orders,
    };
  }

  /** Site list and open-proposal totals in one JOIN query (no per-site reads). */
  async listSites(): Promise<SiteListItem[]> {
    const { results } = await this.db
      .prepare(
        `SELECT s.*,
                SUM(CASE WHEN d.kind = 'proposal' AND d.status = 'open' AND d.created_at >= ? THEN 1 ELSE 0 END)
                  AS open_proposal_count
           FROM sites s
           LEFT JOIN draft_versions d ON d.site_id = s.id
          GROUP BY s.id
          ORDER BY s.updated_at DESC, s.id DESC`,
      )
      .bind(this.now() - PROPOSAL_TTL_MS)
      .all<SiteRow & { open_proposal_count: number }>();
    return results.map((row) => ({
      ...this.rowToSite(row),
      openProposalCount: row.open_proposal_count,
    }));
  }

  /** Minimal public-site projection used by the business sitemap. */
  async listPublishedSites(): Promise<PublishedSite[]> {
    const { results } = await this.db
      .prepare(
        `SELECT public_id, updated_at FROM sites
          WHERE status = 'published'
          ORDER BY public_id ASC`,
      )
      .all<{ public_id: string; updated_at: number }>();
    return results.map((row) => ({ publicId: row.public_id, updatedAt: row.updated_at }));
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

  async getSnapshot(siteId: number, n: number): Promise<Snapshot | null> {
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
   *
   * Snapshot numbering invariant: snapshot n holds the exact content OF
   * version n, so the replaced data is stored under the version number it had
   * (site.currentVersion), never under newN. The current version has no
   * snapshot row until it is itself replaced - publish/serve paths must treat
   * publishedVersion === currentVersion as "serve live data".
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
        .bind(site.id, site.currentVersion, JSON.stringify(site.data), opts.note ?? null, at),
      this.db
        .prepare(
          `UPDATE sites SET data = ?, current_version = ?,
                    status = CASE WHEN published_version IS NULL THEN 'approved' ELSE 'published' END,
                    updated_at = ?
             WHERE id = ?`,
        )
        .bind(JSON.stringify(newData), newN, at, site.id),
      this.db
        .prepare(
          `DELETE FROM draft_versions
             WHERE site_id = ? AND kind = 'snapshot' AND n <= ? AND n != ?`,
        )
        .bind(site.id, newN - MAX_SNAPSHOTS, site.publishedVersion ?? -1),
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
    detail?: Record<string, unknown>;
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
        detail: { siteId: input.site.publicId, summary: input.summary, ...input.detail },
      }),
    ]);
  }

  // --- update requests --------------------------------------------------

  private rowToUpdateRequest(row: {
    id: number;
    site_id: number;
    site_public_id: string;
    site_name: string;
    channel: UpdateRequestChannel;
    from_addr: string | null;
    subject: string | null;
    body: string;
    status: UpdateRequestStatus;
    proposal_public_id: string | null;
    created_at: number;
  }): UpdateRequest {
    return {
      id: row.id,
      siteId: row.site_id,
      sitePublicId: row.site_public_id,
      siteName: row.site_name,
      channel: row.channel,
      ...(row.from_addr === null ? {} : { fromAddr: row.from_addr }),
      ...(row.subject === null ? {} : { subject: row.subject }),
      body: row.body,
      status: row.status,
      ...(row.proposal_public_id === null ? {} : { proposalPublicId: row.proposal_public_id }),
      createdAt: row.created_at,
    };
  }

  async createUpdateRequest(input: {
    site: Site;
    channel: UpdateRequestChannel;
    fromAddr?: string;
    subject?: string;
    body: string;
    actor?: AuditActor;
  }): Promise<UpdateRequest> {
    const at = this.now();
    const results = await this.db.batch([
      this.db
        .prepare(
          `INSERT INTO update_requests
             (site_id, channel, from_addr, subject, body, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          input.site.id,
          input.channel,
          input.fromAddr ?? null,
          input.subject ?? null,
          input.body,
          at,
        ),
      this.db
        .prepare(
          `INSERT INTO audit_events (at, actor, action, entity, entity_id, detail)
           VALUES (?, ?, 'update_request.create', 'update_request',
                   CAST(last_insert_rowid() AS TEXT), ?)`,
        )
        .bind(
          at,
          input.actor ?? (input.channel === 'mcp' ? 'mcp' : 'system'),
          JSON.stringify({ siteId: input.site.publicId, channel: input.channel }),
        ),
    ]);
    return (await this.getUpdateRequest(results[0]!.meta.last_row_id!))!;
  }

  async listUpdateRequests(
    status?: UpdateRequestStatus,
    siteId?: number,
  ): Promise<UpdateRequest[]> {
    const where: string[] = [];
    const values: unknown[] = [];
    if (status !== undefined) {
      where.push('u.status = ?');
      values.push(status);
    } else {
      where.push("u.status != 'suljettu'");
    }
    if (siteId !== undefined) {
      where.push('u.site_id = ?');
      values.push(siteId);
    }
    const { results } = await this.db
      .prepare(
        `SELECT u.*, s.public_id AS site_public_id,
                json_extract(s.data, '$.name') AS site_name
           FROM update_requests u
           JOIN sites s ON s.id = u.site_id
          ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
          ORDER BY u.created_at DESC, u.id DESC
          LIMIT 100`,
      )
      .bind(...values)
      .all<Parameters<ControlPlane['rowToUpdateRequest']>[0]>();
    return results.map((row) => this.rowToUpdateRequest(row));
  }

  async getUpdateRequest(id: number): Promise<UpdateRequest | null> {
    const row = await this.db
      .prepare(
        `SELECT u.*, s.public_id AS site_public_id,
                json_extract(s.data, '$.name') AS site_name
           FROM update_requests u
           JOIN sites s ON s.id = u.site_id
          WHERE u.id = ?`,
      )
      .bind(id)
      .first<Parameters<ControlPlane['rowToUpdateRequest']>[0]>();
    return row ? this.rowToUpdateRequest(row) : null;
  }

  async linkUpdateRequestProposal(
    id: number,
    proposalPublicId: string,
    actor: AuditActor = 'system',
  ): Promise<boolean> {
    const at = this.now();
    const results = await this.db.batch([
      this.db
        .prepare(
          `UPDATE update_requests
              SET proposal_public_id = ?, status = 'ehdotettu'
            WHERE id = ? AND status != 'suljettu'`,
        )
        .bind(proposalPublicId, id),
      this.db
        .prepare(
          `INSERT INTO audit_events (at, actor, action, entity, entity_id, detail)
           SELECT ?, ?, 'update_request.link', 'update_request', ?, ?
            WHERE changes() > 0`,
        )
        .bind(at, actor, String(id), JSON.stringify({ proposalPublicId })),
    ]);
    return (results[0]!.meta.changes ?? 0) > 0;
  }

  async closeUpdateRequest(id: number, actor: AuditActor = 'operator'): Promise<boolean> {
    const at = this.now();
    const results = await this.db.batch([
      this.db
        .prepare("UPDATE update_requests SET status = 'suljettu' WHERE id = ? AND status != 'suljettu'")
        .bind(id),
      this.db
        .prepare(
          `INSERT INTO audit_events (at, actor, action, entity, entity_id, detail)
           SELECT ?, ?, 'update_request.close', 'update_request', ?, NULL
            WHERE changes() > 0`,
        )
        .bind(at, actor, String(id)),
    ]);
    return (results[0]!.meta.changes ?? 0) > 0;
  }

  async findSiteByContactEmail(email: string): Promise<Site | null> {
    const row = await this.db
      .prepare(
        `SELECT s.*
           FROM business_profiles bp
           JOIN sites s ON s.prospect_id = bp.prospect_id
          WHERE lower(trim(json_extract(bp.data, '$.contact.email'))) = lower(trim(?))
          ORDER BY s.id ASC
          LIMIT 1`,
      )
      .bind(email)
      .first<SiteRow>();
    return row ? this.rowToSite(row) : null;
  }

  // --- customer panel tokens ------------------------------------------

  private rowToPanelToken(row: {
    id: number;
    token_hash: string;
    site_id: number;
    expires_at: number;
    revoked_at: number | null;
    created_at: number;
  }): PanelToken {
    return {
      id: row.id,
      tokenHash: row.token_hash,
      siteId: row.site_id,
      expiresAt: row.expires_at,
      ...(row.revoked_at === null ? {} : { revokedAt: row.revoked_at }),
      createdAt: row.created_at,
    };
  }

  async createPanelToken(input: {
    tokenHash: string;
    site: Site;
    expiresAt?: number;
    actor?: AuditActor;
  }): Promise<number> {
    const at = this.now();
    const expiresAt = input.expiresAt ?? at + 30 * 24 * 60 * 60 * 1000;
    const results = await this.db.batch([
      this.db
        .prepare(
          `INSERT INTO panel_tokens (token_hash, site_id, expires_at, created_at)
           VALUES (?, ?, ?, ?)`,
        )
        .bind(input.tokenHash, input.site.id, expiresAt, at),
      this.auditStatement(at, {
        actor: input.actor ?? 'operator',
        action: 'panel_token.create',
        entity: 'site',
        entityId: input.site.publicId,
        detail: { expiresAt },
      }),
    ]);
    return results[0]!.meta.last_row_id!;
  }

  async findPanelToken(tokenHash: string): Promise<PanelToken | null> {
    const row = await this.db
      .prepare('SELECT * FROM panel_tokens WHERE token_hash = ?')
      .bind(tokenHash)
      .first<Parameters<ControlPlane['rowToPanelToken']>[0]>();
    return row ? this.rowToPanelToken(row) : null;
  }

  async listActivePanelTokens(siteId: number): Promise<PanelToken[]> {
    const { results } = await this.db
      .prepare(
        `SELECT * FROM panel_tokens
          WHERE site_id = ? AND revoked_at IS NULL AND expires_at > ?
          ORDER BY created_at DESC, id DESC`,
      )
      .bind(siteId, this.now())
      .all<Parameters<ControlPlane['rowToPanelToken']>[0]>();
    return results.map((row) => this.rowToPanelToken(row));
  }

  async revokePanelToken(input: { id: number; site: Site; actor?: AuditActor }): Promise<boolean> {
    const at = this.now();
    const results = await this.db.batch([
      this.db
        .prepare(
          `UPDATE panel_tokens SET revoked_at = ?
            WHERE id = ? AND site_id = ? AND revoked_at IS NULL`,
        )
        .bind(at, input.id, input.site.id),
      this.db
        .prepare(
          `INSERT INTO audit_events (at, actor, action, entity, entity_id, detail)
           SELECT ?, ?, 'panel_token.revoke', 'site', ?, ? WHERE changes() > 0`,
        )
        .bind(
          at,
          input.actor ?? 'operator',
          input.site.publicId,
          JSON.stringify({ tokenId: input.id }),
        ),
    ]);
    return (results[0]!.meta.changes ?? 0) > 0;
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
    const status = row.status === 'open' && row.created_at < this.now() - PROPOSAL_TTL_MS
      ? 'superseded'
      : row.status;
    return {
      publicId: row.public_id,
      candidate: JSON.parse(row.data) as SiteData,
      summary: row.summary ? (JSON.parse(row.summary) as string[]) : [],
      status,
      at: row.created_at,
      ...(row.note === null ? {} : { note: row.note }),
    };
  }

  async listOpenProposals(siteId: number): Promise<OpenProposal[]> {
    const { results } = await this.db
      .prepare(
        `SELECT public_id, summary, created_at FROM draft_versions
           WHERE site_id = ? AND kind = 'proposal' AND status = 'open' AND created_at >= ?
           ORDER BY created_at ASC, public_id ASC`,
      )
      .bind(siteId, this.now() - PROPOSAL_TTL_MS)
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

  // --- preview tokens ---------------------------------------------------

  private rowToPreviewToken(row: {
    id: number;
    token_hash: string;
    site_id: number;
    proposal_public_id: string | null;
    label: string;
    expires_at: number;
    revoked_at: number | null;
    created_at: number;
  }): PreviewToken {
    return {
      id: row.id,
      tokenHash: row.token_hash,
      siteId: row.site_id,
      ...(row.proposal_public_id === null ? {} : { proposalPublicId: row.proposal_public_id }),
      label: row.label,
      expiresAt: row.expires_at,
      ...(row.revoked_at === null ? {} : { revokedAt: row.revoked_at }),
      createdAt: row.created_at,
    };
  }

  async createPreviewToken(input: {
    tokenHash: string;
    site: Site;
    proposalPublicId?: string;
    label: string;
    expiresAt: number;
    actor: AuditActor;
  }): Promise<number> {
    const at = this.now();
    const results = await this.db.batch([
      this.db
        .prepare(
          `INSERT INTO preview_tokens
             (token_hash, site_id, proposal_public_id, label, expires_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          input.tokenHash,
          input.site.id,
          input.proposalPublicId ?? null,
          input.label,
          input.expiresAt,
          at,
        ),
      this.auditStatement(at, {
        actor: input.actor,
        action: 'token.create',
        entity: 'site',
        entityId: input.site.publicId,
        detail: {
          label: input.label,
          proposal: input.proposalPublicId ?? null,
          expiresAt: input.expiresAt,
        },
      }),
    ]);
    return results[0]!.meta.last_row_id!;
  }

  async findPreviewToken(tokenHash: string): Promise<PreviewToken | null> {
    const row = await this.db
      .prepare('SELECT * FROM preview_tokens WHERE token_hash = ?')
      .bind(tokenHash)
      .first<{
        id: number;
        token_hash: string;
        site_id: number;
        proposal_public_id: string | null;
        label: string;
        expires_at: number;
        revoked_at: number | null;
        created_at: number;
      }>();
    return row ? this.rowToPreviewToken(row) : null;
  }

  async revokePreviewToken(input: {
    id: number;
    site: Site;
    actor: AuditActor;
  }): Promise<boolean> {
    const at = this.now();
    const results = await this.db.batch([
      this.db
        .prepare(
          `UPDATE preview_tokens SET revoked_at = ?
             WHERE id = ? AND site_id = ? AND revoked_at IS NULL`,
        )
        .bind(at, input.id, input.site.id),
      this.db
        .prepare(
          `INSERT INTO audit_events (at, actor, action, entity, entity_id, detail)
           SELECT ?, ?, 'token.revoke', 'site', ?, ? WHERE changes() > 0`,
        )
        .bind(at, input.actor, input.site.publicId, JSON.stringify({ tokenId: input.id })),
    ]);
    return (results[0]!.meta.changes ?? 0) > 0;
  }

  async listActiveTokens(siteId: number): Promise<PreviewToken[]> {
    const { results } = await this.db
      .prepare(
        `SELECT * FROM preview_tokens
          WHERE site_id = ? AND revoked_at IS NULL AND expires_at > ?
          ORDER BY created_at DESC, id DESC`,
      )
      .bind(siteId, this.now())
      .all<{
        id: number;
        token_hash: string;
        site_id: number;
        proposal_public_id: string | null;
        label: string;
        expires_at: number;
        revoked_at: number | null;
        created_at: number;
      }>();
    return results.map((row) => this.rowToPreviewToken(row));
  }

  // --- comments ---------------------------------------------------------

  async createDraftComment(input: {
    site: Site;
    proposalPublicId?: string;
    author: CommentAuthor;
    body: string;
  }): Promise<boolean> {
    const at = this.now();
    const scope = input.proposalPublicId ?? null;
    const results = await this.db.batch([
      this.db
        .prepare(
          `INSERT INTO draft_comments
             (site_id, proposal_public_id, author, body, created_at)
           SELECT ?, ?, ?, ?, ?
            WHERE (SELECT COUNT(*) FROM draft_comments
                    WHERE site_id = ? AND proposal_public_id IS ?) < 20`,
        )
        .bind(input.site.id, scope, input.author, input.body, at, input.site.id, scope),
      this.db
        .prepare(
          `INSERT INTO audit_events (at, actor, action, entity, entity_id, detail)
           SELECT ?, ?, 'comment.create', 'proposal', ?, ? WHERE changes() > 0`,
        )
        .bind(
          at,
          input.author === 'customer' ? 'system' : 'operator',
          input.proposalPublicId ?? input.site.publicId,
          JSON.stringify({ proposal: input.proposalPublicId ?? null, author: input.author }),
        ),
    ]);
    return (results[0]!.meta.changes ?? 0) > 0;
  }

  async listDraftComments(siteId: number): Promise<DraftComment[]> {
    const { results } = await this.db
      .prepare(
        `SELECT id, site_id, proposal_public_id, author, body, created_at
           FROM draft_comments WHERE site_id = ?
           ORDER BY created_at DESC, id DESC`,
      )
      .bind(siteId)
      .all<{
        id: number;
        site_id: number;
        proposal_public_id: string | null;
        author: CommentAuthor;
        body: string;
        created_at: number;
      }>();
    return results.map((row) => ({
      id: row.id,
      siteId: row.site_id,
      ...(row.proposal_public_id === null ? {} : { proposalPublicId: row.proposal_public_id }),
      author: row.author,
      body: row.body,
      createdAt: row.created_at,
    }));
  }

  // --- QA and launch checklist -----------------------------------------

  async recordQaRun(
    site: Site,
    version: number,
    results: CheckResult[],
    actor: AuditActor = 'operator',
  ): Promise<QaRun> {
    const at = this.now();
    const passed = results.every((result) => result.passed);
    const statements = await this.db.batch([
      this.db
        .prepare('INSERT INTO qa_runs (site_id, version, results, passed, created_at) VALUES (?, ?, ?, ?, ?)')
        .bind(site.id, version, JSON.stringify(results), passed ? 1 : 0, at),
      this.auditStatement(at, {
        actor,
        action: 'qa.run',
        entity: 'site',
        entityId: site.publicId,
        detail: { version, passed, failCount: results.filter((result) => !result.passed).length },
      }),
    ]);
    return { id: statements[0]!.meta.last_row_id!, siteId: site.id, version, results, passed, createdAt: at };
  }

  async latestQaRun(siteId: number): Promise<QaRun | null> {
    const row = await this.db
      .prepare('SELECT id, site_id, version, results, passed, created_at FROM qa_runs WHERE site_id = ? ORDER BY created_at DESC, id DESC LIMIT 1')
      .bind(siteId)
      .first<{ id: number; site_id: number; version: number; results: string; passed: number; created_at: number }>();
    if (!row) return null;
    return {
      id: row.id,
      siteId: row.site_id,
      version: row.version,
      results: JSON.parse(row.results) as CheckResult[],
      passed: row.passed === 1,
      createdAt: row.created_at,
    };
  }

  async listLaunchChecklist(siteId: number): Promise<LaunchChecklistRecord[]> {
    const { results } = await this.db
      .prepare('SELECT site_id, item, checked_at, checked_by FROM launch_checklist WHERE site_id = ? ORDER BY item')
      .bind(siteId)
      .all<{ site_id: number; item: string; checked_at: number; checked_by: string }>();
    return results.map((row) => ({
      siteId: row.site_id,
      item: row.item,
      checkedAt: row.checked_at,
      checkedBy: row.checked_by,
    }));
  }

  async checkLaunchChecklist(site: Site, item: string, checkedBy: string): Promise<void> {
    const at = this.now();
    await this.db.batch([
      this.db
        .prepare('INSERT INTO launch_checklist (site_id, item, checked_at, checked_by) VALUES (?, ?, ?, ?) ON CONFLICT(site_id, item) DO UPDATE SET checked_at = excluded.checked_at, checked_by = excluded.checked_by')
        .bind(site.id, item, at, checkedBy),
      this.auditStatement(at, {
        actor: 'operator',
        action: 'checklist.check',
        entity: 'site',
        entityId: site.publicId,
        detail: { item },
      }),
    ]);
  }

  async uncheckLaunchChecklist(site: Site, item: string): Promise<void> {
    const at = this.now();
    await this.db.batch([
      this.db.prepare('DELETE FROM launch_checklist WHERE site_id = ? AND item = ?').bind(site.id, item),
      this.db
        .prepare("INSERT INTO audit_events (at, actor, action, entity, entity_id, detail) SELECT ?, 'operator', 'checklist.uncheck', 'site', ?, ? WHERE changes() > 0")
        .bind(at, site.publicId, JSON.stringify({ item })),
    ]);
  }

  // --- publishing -------------------------------------------------------

  async publishSiteVersion(
    site: Site,
    n: number,
    actor: Extract<AuditActor, 'operator' | 'approval-key'>,
    overrideReason?: string,
  ): Promise<void> {
    const at = this.now();
    await this.db.batch([
      this.db
        .prepare(
          `UPDATE sites SET published_version = ?, status = 'published', updated_at = ?
             WHERE id = ?`,
        )
        .bind(n, at, site.id),
      this.auditStatement(at, {
        actor,
        action: 'site.publish',
        entity: 'site',
        entityId: site.publicId,
        detail: { n, ...(overrideReason === undefined ? {} : { override: overrideReason }) },
      }),
    ]);
  }

  async unpublishSite(
    site: Site,
    actor: Extract<AuditActor, 'operator' | 'approval-key'>,
  ): Promise<void> {
    const at = this.now();
    await this.db.batch([
      this.db
        .prepare(
          `UPDATE sites SET published_version = NULL, status = 'approved', updated_at = ?
             WHERE id = ?`,
        )
        .bind(at, site.id),
      this.auditStatement(at, {
        actor,
        action: 'site.unpublish',
        entity: 'site',
        entityId: site.publicId,
      }),
    ]);
  }

  // --- orders and billing ----------------------------------------------

  private rowToOrder(row: OrderRow): Order {
    return {
      id: row.id,
      publicId: row.public_id,
      siteId: row.site_id,
      kind: row.kind,
      status: row.status,
      provider: row.provider,
      ...(row.provider_session_id === null ? {} : { providerSessionId: row.provider_session_id }),
      ...(row.provider_sub_id === null ? {} : { providerSubId: row.provider_sub_id }),
      amountBuildCents: row.amount_build_cents,
      amountMonthlyCents: row.amount_monthly_cents,
      currency: row.currency,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async createOrder(input: {
    publicId: string;
    site: Site;
    provider: string;
    amountBuildCents: number;
    amountMonthlyCents: number;
    actor: Extract<AuditActor, 'operator' | 'approval-key'>;
  }): Promise<Order> {
    const at = this.now();
    const results = await this.db.batch([
      this.db
        .prepare(
          `INSERT INTO orders
             (public_id, site_id, kind, status, provider, amount_build_cents,
              amount_monthly_cents, currency, created_at, updated_at)
           VALUES (?, ?, 'build_and_host', 'luotu', ?, ?, ?, 'eur', ?, ?)`,
        )
        .bind(
          input.publicId,
          input.site.id,
          input.provider,
          input.amountBuildCents,
          input.amountMonthlyCents,
          at,
          at,
        ),
      this.auditStatement(at, {
        actor: input.actor,
        action: 'order.create',
        entity: 'order',
        entityId: input.publicId,
        detail: { siteId: input.site.publicId, provider: input.provider },
      }),
    ]);
    const id = results[0]?.meta.last_row_id;
    if (id === undefined) throw new Error('order insert did not return an id');
    return {
      id,
      publicId: input.publicId,
      siteId: input.site.id,
      kind: 'build_and_host',
      status: 'luotu',
      provider: input.provider,
      amountBuildCents: input.amountBuildCents,
      amountMonthlyCents: input.amountMonthlyCents,
      currency: 'eur',
      createdAt: at,
      updatedAt: at,
    };
  }

  async setOrderCheckout(orderId: number, providerSessionId: string): Promise<void> {
    await this.db
      .prepare('UPDATE orders SET provider_session_id = ?, updated_at = ? WHERE id = ?')
      .bind(providerSessionId, this.now(), orderId)
      .run();
  }

  async getOrderByPublicId(publicId: string): Promise<Order | null> {
    const row = await this.db
      .prepare('SELECT * FROM orders WHERE public_id = ?')
      .bind(publicId)
      .first<OrderRow>();
    return row ? this.rowToOrder(row) : null;
  }

  async latestOrderForSite(siteId: number): Promise<Order | null> {
    const row = await this.db
      .prepare('SELECT * FROM orders WHERE site_id = ? ORDER BY created_at DESC, id DESC LIMIT 1')
      .bind(siteId)
      .first<OrderRow>();
    return row ? this.rowToOrder(row) : null;
  }

  async openOrderForSite(siteId: number): Promise<Order | null> {
    const row = await this.db
      .prepare("SELECT * FROM orders WHERE site_id = ? AND status = 'luotu' ORDER BY id DESC LIMIT 1")
      .bind(siteId)
      .first<OrderRow>();
    return row ? this.rowToOrder(row) : null;
  }

  async siteIsEntitled(siteId: number): Promise<boolean> {
    const row = await this.db
      .prepare(
        `SELECT status FROM orders
          WHERE site_id = ?
            AND status IN ('maksettu', 'maksu_epaonnistui', 'irtisanottu')
          ORDER BY created_at DESC, id DESC
          LIMIT 1`,
      )
      .bind(siteId)
      .first<{ status: OrderStatus }>();
    return row?.status === 'maksettu';
  }

  private orderAuditAction(status: OrderStatus): 'order.paid' | 'order.failed' | 'order.cancel' {
    if (status === 'maksettu') return 'order.paid';
    if (status === 'maksu_epaonnistui') return 'order.failed';
    return 'order.cancel';
  }

  async transitionOrder(
    order: Order,
    status: Exclude<OrderStatus, 'luotu'>,
    providerSubId?: string,
  ): Promise<void> {
    const at = this.now();
    await this.db.batch([
      this.db
        .prepare(
          `UPDATE orders
              SET status = ?, provider_sub_id = COALESCE(?, provider_sub_id), updated_at = ?
            WHERE id = ?`,
        )
        .bind(status, providerSubId ?? null, at, order.id),
      this.auditStatement(at, {
        actor: 'system',
        action: this.orderAuditAction(status),
        entity: 'order',
        entityId: order.publicId,
        detail: { status },
      }),
    ]);
  }

  async recordBillingEvent(input: {
    order?: Order;
    type: string;
    payload: string;
    status?: Exclude<OrderStatus, 'luotu'>;
    providerSubId?: string;
  }): Promise<void> {
    const at = this.now();
    const statements = [
      this.db
        .prepare(
          'INSERT INTO billing_events (order_id, type, payload, created_at) VALUES (?, ?, ?, ?)',
        )
        .bind(input.order?.id ?? null, input.type, input.payload, at),
    ];
    if (input.order && input.status) {
      statements.push(
        this.db
          .prepare(
            `UPDATE orders
                SET status = ?, provider_sub_id = COALESCE(?, provider_sub_id), updated_at = ?
              WHERE id = ?`,
          )
          .bind(input.status, input.providerSubId ?? null, at, input.order.id),
        this.auditStatement(at, {
          actor: 'system',
          action: this.orderAuditAction(input.status),
          entity: 'order',
          entityId: input.order.publicId,
          detail: { status: input.status, event: input.type },
        }),
      );
    }
    await this.db.batch(statements);
  }

  async listBillingEventsForSite(siteId: number, limit = 20): Promise<BillingEvent[]> {
    const cappedLimit = Math.max(1, Math.min(100, Math.floor(limit)));
    const { results } = await this.db
      .prepare(
        `SELECT b.id, b.order_id, b.type, b.payload, b.created_at
           FROM billing_events b
           JOIN orders o ON o.id = b.order_id
          WHERE o.site_id = ?
          ORDER BY b.id DESC
          LIMIT ?`,
      )
      .bind(siteId, cappedLimit)
      .all<{
        id: number;
        order_id: number | null;
        type: string;
        payload: string;
        created_at: number;
      }>();
    return results.map((row) => ({
      id: row.id,
      ...(row.order_id === null ? {} : { orderId: row.order_id }),
      type: row.type,
      payload: row.payload,
      createdAt: row.created_at,
    }));
  }

  // --- provisioning and renewals ---------------------------------------

  private rowToProvisioningRun(row: ProvisioningRunRow): ProvisioningRun {
    const siteData = row.site_data === undefined ? undefined : JSON.parse(row.site_data) as SiteData;
    return {
      id: row.id,
      publicId: row.public_id,
      siteId: row.site_id,
      ...(row.order_id === null ? {} : { orderId: row.order_id }),
      domain: row.domain,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      ...(row.site_public_id === undefined ? {} : { sitePublicId: row.site_public_id }),
      ...(siteData === undefined ? {} : { siteName: siteData.name }),
    };
  }

  private rowToProvisioningStep(row: ProvisioningStepRow): ProvisioningStep {
    return {
      id: row.id,
      runId: row.run_id,
      step: row.step,
      ord: row.ord,
      status: row.status,
      ...(row.evidence === null ? {} : { evidence: row.evidence }),
      updatedAt: row.updated_at,
    };
  }

  private rowToRenewal(row: RenewalRow): Renewal {
    const siteData = row.site_data === undefined ? undefined : JSON.parse(row.site_data) as SiteData;
    return {
      id: row.id,
      siteId: row.site_id,
      kind: row.kind,
      label: row.label,
      dueAt: row.due_at,
      status: row.status,
      createdAt: row.created_at,
      ...(row.site_public_id === undefined ? {} : { sitePublicId: row.site_public_id }),
      ...(siteData === undefined ? {} : { siteName: siteData.name }),
    };
  }

  async createProvisioningRun(input: {
    publicId: string;
    site: Site;
    orderId?: number;
    domain: string;
    steps: readonly { id: string; ord: number }[];
  }): Promise<ProvisioningRun> {
    const at = this.now();
    const results = await this.db.batch([
      this.db
        .prepare(
          `INSERT INTO provisioning_runs
             (public_id, site_id, order_id, domain, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, 'kaynnissa', ?, ?)`,
        )
        .bind(input.publicId, input.site.id, input.orderId ?? null, input.domain, at, at),
      ...input.steps.map((step) => this.db
        .prepare(
          `INSERT INTO provisioning_steps (run_id, step, ord, status, updated_at)
           VALUES ((SELECT id FROM provisioning_runs WHERE public_id = ?), ?, ?, 'odottaa', ?)`,
        )
        .bind(input.publicId, step.id, step.ord, at)),
      this.db
        .prepare(
          `INSERT INTO renewals (site_id, kind, label, due_at, status, created_at)
           VALUES (?, 'domain', ?, ?, 'tulossa', ?)`,
        )
        .bind(input.site.id, input.domain, at + 365 * 24 * 60 * 60 * 1000, at),
      this.auditStatement(at, {
        actor: 'operator',
        action: 'provisioning.start',
        entity: 'provisioning',
        entityId: input.publicId,
        detail: { run: input.publicId, site: input.site.publicId, domain: input.domain },
      }),
    ]);
    const id = results[0]?.meta.last_row_id;
    if (id === undefined) throw new Error('provisioning run insert did not return an id');
    return {
      id,
      publicId: input.publicId,
      siteId: input.site.id,
      ...(input.orderId === undefined ? {} : { orderId: input.orderId }),
      domain: input.domain,
      status: 'kaynnissa',
      createdAt: at,
      updatedAt: at,
    };
  }

  async getProvisioningRunByPublicId(publicId: string): Promise<ProvisioningRun | null> {
    const row = await this.db
      .prepare('SELECT * FROM provisioning_runs WHERE public_id = ?')
      .bind(publicId)
      .first<ProvisioningRunRow>();
    return row ? this.rowToProvisioningRun(row) : null;
  }

  async latestProvisioningRunForSite(siteId: number): Promise<ProvisioningRun | null> {
    const row = await this.db
      .prepare('SELECT * FROM provisioning_runs WHERE site_id = ? ORDER BY created_at DESC, id DESC LIMIT 1')
      .bind(siteId)
      .first<ProvisioningRunRow>();
    return row ? this.rowToProvisioningRun(row) : null;
  }

  async activeProvisioningRunForSite(siteId: number): Promise<ProvisioningRun | null> {
    const row = await this.db
      .prepare("SELECT * FROM provisioning_runs WHERE site_id = ? AND status = 'kaynnissa' LIMIT 1")
      .bind(siteId)
      .first<ProvisioningRunRow>();
    return row ? this.rowToProvisioningRun(row) : null;
  }

  async listActiveProvisioningRuns(): Promise<ProvisioningRun[]> {
    const { results } = await this.db
      .prepare(
        `SELECT p.*, s.public_id AS site_public_id, s.data AS site_data
           FROM provisioning_runs p
           JOIN sites s ON s.id = p.site_id
          WHERE p.status = 'kaynnissa'
          ORDER BY p.created_at ASC, p.id ASC`,
      )
      .all<ProvisioningRunRow>();
    return results.map((row) => this.rowToProvisioningRun(row));
  }

  async listProvisioningSteps(runId: number): Promise<ProvisioningStep[]> {
    const { results } = await this.db
      .prepare('SELECT * FROM provisioning_steps WHERE run_id = ? ORDER BY ord ASC, id ASC')
      .bind(runId)
      .all<ProvisioningStepRow>();
    return results.map((row) => this.rowToProvisioningStep(row));
  }

  async setProvisioningStep(input: {
    run: ProvisioningRun;
    step: string;
    status: ProvisioningStepStatus;
    evidence?: string;
  }): Promise<void> {
    const at = this.now();
    await this.db.batch([
      this.db
        .prepare('UPDATE provisioning_steps SET status = ?, evidence = ?, updated_at = ? WHERE run_id = ? AND step = ?')
        .bind(input.status, input.evidence ?? null, at, input.run.id, input.step),
      this.db
        .prepare('UPDATE provisioning_runs SET updated_at = ? WHERE id = ?')
        .bind(at, input.run.id),
      this.auditStatement(at, {
        actor: 'operator',
        action: 'provisioning.step',
        entity: 'provisioning',
        entityId: input.run.publicId,
        detail: { run: input.run.publicId, step: input.step, status: input.status },
      }),
    ]);
  }

  async completeProvisioningRun(input: {
    run: ProvisioningRun;
    step: string;
    evidence?: string;
  }): Promise<void> {
    const at = this.now();
    await this.db.batch([
      this.db
        .prepare("UPDATE provisioning_steps SET status = 'tehty', evidence = ?, updated_at = ? WHERE run_id = ? AND step = ?")
        .bind(input.evidence ?? null, at, input.run.id, input.step),
      this.db
        .prepare("UPDATE provisioning_runs SET status = 'valmis', updated_at = ? WHERE id = ?")
        .bind(at, input.run.id),
      this.auditStatement(at, {
        actor: 'operator',
        action: 'provisioning.step',
        entity: 'provisioning',
        entityId: input.run.publicId,
        detail: { run: input.run.publicId, step: input.step, status: 'tehty' },
      }),
      this.auditStatement(at, {
        actor: 'operator',
        action: 'provisioning.golive',
        entity: 'provisioning',
        entityId: input.run.publicId,
        detail: { run: input.run.publicId, domain: input.run.domain },
      }),
    ]);
  }

  async abortProvisioningRun(run: ProvisioningRun): Promise<void> {
    const at = this.now();
    await this.db.batch([
      this.db
        .prepare("UPDATE provisioning_runs SET status = 'keskeytetty', updated_at = ? WHERE id = ? AND status = 'kaynnissa'")
        .bind(at, run.id),
      this.auditStatement(at, {
        actor: 'operator',
        action: 'provisioning.abort',
        entity: 'provisioning',
        entityId: run.publicId,
        detail: { run: run.publicId },
      }),
    ]);
  }

  async listRenewalsForSite(siteId: number): Promise<Renewal[]> {
    const { results } = await this.db
      .prepare('SELECT * FROM renewals WHERE site_id = ? ORDER BY due_at ASC, id ASC')
      .bind(siteId)
      .all<RenewalRow>();
    return results.map((row) => this.rowToRenewal(row));
  }

  async listUpcomingRenewals(windowMs = 90 * 24 * 60 * 60 * 1000): Promise<Renewal[]> {
    // The production cron trigger is intentionally deferred; this query is the
    // monitor model used by the operator console in v1.
    const { results } = await this.db
      .prepare(
        `SELECT r.*, s.public_id AS site_public_id, s.data AS site_data
           FROM renewals r
           JOIN sites s ON s.id = r.site_id
          WHERE r.status = 'tulossa' AND r.due_at <= ?
          ORDER BY r.due_at ASC, r.id ASC`,
      )
      .bind(this.now() + windowMs)
      .all<RenewalRow>();
    return results.map((row) => this.rowToRenewal(row));
  }

  // --- photos ------------------------------------------------------------

  async getPhotoMeta(r2Key: string): Promise<PhotoMeta | null> {
    const row = await this.db
      .prepare('SELECT r2_key, content_type, bytes FROM photos WHERE r2_key = ? ORDER BY id ASC LIMIT 1')
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
          `INSERT OR IGNORE INTO photos (r2_key, site_id, content_type, bytes, created_at)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .bind(input.r2Key, input.siteId ?? null, input.contentType, input.bytes, at),
      this.db
        .prepare(
          `INSERT INTO audit_events (at, actor, action, entity, entity_id, detail)
           SELECT ?, ?, 'photo.upload', 'photo', ?, ? WHERE changes() > 0`,
        )
        .bind(
          at,
          input.actor,
          input.r2Key,
          JSON.stringify({ bytes: input.bytes, contentType: input.contentType }),
        ),
    ]);
  }

  async photoCountForSite(siteId: number): Promise<number> {
    return this.count('SELECT COUNT(*) AS count FROM photos WHERE site_id = ?', siteId);
  }

  async listExistingPhotoKeys(r2Keys: string[]): Promise<string[]> {
    const keys = [...new Set(r2Keys)].slice(0, 40);
    if (!keys.length) return [];
    const placeholders = keys.map(() => '?').join(', ');
    const { results } = await this.db
      .prepare(`SELECT DISTINCT r2_key FROM photos WHERE r2_key IN (${placeholders})`)
      .bind(...keys)
      .all<{ r2_key: string }>();
    return results.map((row) => row.r2_key);
  }

  async listPhotoMetaForSite(siteId: number): Promise<PhotoMeta[]> {
    const { results } = await this.db
      .prepare('SELECT r2_key, content_type, bytes FROM photos WHERE site_id = ? ORDER BY id ASC')
      .bind(siteId)
      .all<{ r2_key: string; content_type: string; bytes: number }>();
    return results.map((row) => ({
      r2Key: row.r2_key,
      contentType: row.content_type,
      bytes: row.bytes,
    }));
  }

  async listExclusivePhotoKeysForSite(siteId: number): Promise<string[]> {
    const { results } = await this.db
      .prepare(
        `SELECT DISTINCT p.r2_key
           FROM photos p
          WHERE p.site_id = ?
            AND NOT EXISTS (
              SELECT 1 FROM photos other
               WHERE other.r2_key = p.r2_key AND other.site_id != ?
            )
          ORDER BY p.r2_key ASC`,
      )
      .bind(siteId, siteId)
      .all<{ r2_key: string }>();
    return results.map((row) => row.r2_key);
  }

  // --- offboarding ------------------------------------------------------

  async archiveSite(site: Site, cachePurged: number, actor: AuditActor = 'operator'): Promise<void> {
    const at = this.now();
    const [previewTokens, panelTokens, proposals] = await Promise.all([
      this.count('SELECT COUNT(*) AS count FROM preview_tokens WHERE site_id = ? AND revoked_at IS NULL', site.id),
      this.count('SELECT COUNT(*) AS count FROM panel_tokens WHERE site_id = ? AND revoked_at IS NULL', site.id),
      this.count("SELECT COUNT(*) AS count FROM draft_versions WHERE site_id = ? AND kind = 'proposal' AND status = 'open'", site.id),
    ]);
    await this.db.batch([
      this.db.prepare('UPDATE preview_tokens SET revoked_at = ? WHERE site_id = ? AND revoked_at IS NULL').bind(at, site.id),
      this.db.prepare('UPDATE panel_tokens SET revoked_at = ? WHERE site_id = ? AND revoked_at IS NULL').bind(at, site.id),
      this.db.prepare("UPDATE draft_versions SET status = 'superseded' WHERE site_id = ? AND kind = 'proposal' AND status = 'open'").bind(site.id),
      this.db.prepare("UPDATE sites SET status = 'archived', published_version = NULL, updated_at = ? WHERE id = ?").bind(at, site.id),
      this.deletionStatement(at, site, 'cache_purged', actor, { count: cachePurged }),
      this.deletionStatement(at, site, 'tokens_revoked', actor, {
        count: previewTokens + panelTokens,
        previewTokens,
        panelTokens,
      }),
      this.deletionStatement(at, site, 'proposals_superseded', actor, { count: proposals }),
      this.deletionStatement(at, site, 'site_archived', actor),
      this.auditStatement(at, {
        actor,
        action: 'site.archive',
        entity: 'site',
        entityId: site.publicId,
      }),
    ]);
  }

  async restoreSite(site: Site, actor: AuditActor = 'operator'): Promise<void> {
    const at = this.now();
    await this.db.batch([
      this.db.prepare("UPDATE sites SET status = 'approved', published_version = NULL, updated_at = ? WHERE id = ? AND status = 'archived'").bind(at, site.id),
      this.deletionStatement(at, site, 'site_restored', actor),
      this.auditStatement(at, {
        actor,
        action: 'site.restore',
        entity: 'site',
        entityId: site.publicId,
      }),
    ]);
  }

  async permanentlyDeleteSite(
    site: Site,
    actor: AuditActor = 'operator',
    deletePhotoObjects?: (r2Keys: string[]) => Promise<void>,
  ): Promise<Record<string, number>> {
    const profileWhere = site.prospectId === undefined ? 'WHERE 0' : 'WHERE prospect_id = ?';
    const profileValues = site.prospectId === undefined ? [] : [site.prospectId];
    const [photoKeys, photos, profiles, updates, comments, qaRuns, checklist, previewTokens,
      panelTokens, provisioningSteps, provisioningRuns, renewals, versions, orders] = await Promise.all([
      this.listExclusivePhotoKeysForSite(site.id),
      this.count('SELECT COUNT(*) AS count FROM photos WHERE site_id = ?', site.id),
      this.count(`SELECT COUNT(*) AS count FROM business_profiles ${profileWhere}`, ...profileValues),
      this.count('SELECT COUNT(*) AS count FROM update_requests WHERE site_id = ?', site.id),
      this.count('SELECT COUNT(*) AS count FROM draft_comments WHERE site_id = ?', site.id),
      this.count('SELECT COUNT(*) AS count FROM qa_runs WHERE site_id = ?', site.id),
      this.count('SELECT COUNT(*) AS count FROM launch_checklist WHERE site_id = ?', site.id),
      this.count('SELECT COUNT(*) AS count FROM preview_tokens WHERE site_id = ?', site.id),
      this.count('SELECT COUNT(*) AS count FROM panel_tokens WHERE site_id = ?', site.id),
      this.count('SELECT COUNT(*) AS count FROM provisioning_steps WHERE run_id IN (SELECT id FROM provisioning_runs WHERE site_id = ?)', site.id),
      this.count('SELECT COUNT(*) AS count FROM provisioning_runs WHERE site_id = ?', site.id),
      this.count('SELECT COUNT(*) AS count FROM renewals WHERE site_id = ?', site.id),
      this.count('SELECT COUNT(*) AS count FROM draft_versions WHERE site_id = ?', site.id),
      this.count('SELECT COUNT(*) AS count FROM orders WHERE site_id = ?', site.id),
    ]);
    if (photoKeys.length && deletePhotoObjects) await deletePhotoObjects(photoKeys);
    const counts = {
      photos,
      businessProfiles: profiles,
      updateRequests: updates,
      comments,
      qaRuns,
      checklist,
      previewTokens,
      panelTokens,
      provisioningSteps,
      provisioningRuns,
      renewals,
      draftVersions: versions,
      ordersRetained: orders,
      sites: 1,
    };
    const at = this.now();
    const logs: [string, unknown][] = [
      ['photos_deleted', { count: photos }],
      ['business_profile_deleted', { count: profiles }],
      ['update_requests_deleted', { count: updates }],
      ['comments_deleted', { count: comments }],
      ['qa_runs_deleted', { count: qaRuns }],
      ['checklist_deleted', { count: checklist }],
      ['tokens_deleted', { count: previewTokens + panelTokens, previewTokens, panelTokens }],
      ['provisioning_data_deleted', {
        count: provisioningSteps + provisioningRuns + renewals,
        provisioningSteps,
        provisioningRuns,
        renewals,
      }],
      ['draft_versions_deleted', { count: versions }],
      ['orders_retained', { count: orders }],
      ['site_deleted', { count: 1 }],
    ];
    const statements: D1PreparedStatement[] = [
      this.db.prepare('DELETE FROM photos WHERE site_id = ?').bind(site.id),
      this.db.prepare(`DELETE FROM business_profiles ${profileWhere}`).bind(...profileValues),
      this.db.prepare('DELETE FROM update_requests WHERE site_id = ?').bind(site.id),
      this.db.prepare('DELETE FROM draft_comments WHERE site_id = ?').bind(site.id),
      this.db.prepare('DELETE FROM qa_runs WHERE site_id = ?').bind(site.id),
      this.db.prepare('DELETE FROM launch_checklist WHERE site_id = ?').bind(site.id),
      this.db.prepare('DELETE FROM preview_tokens WHERE site_id = ?').bind(site.id),
      this.db.prepare('DELETE FROM panel_tokens WHERE site_id = ?').bind(site.id),
      this.db.prepare('DELETE FROM provisioning_steps WHERE run_id IN (SELECT id FROM provisioning_runs WHERE site_id = ?)').bind(site.id),
      this.db.prepare('DELETE FROM provisioning_runs WHERE site_id = ?').bind(site.id),
      this.db.prepare('DELETE FROM renewals WHERE site_id = ?').bind(site.id),
      ...logs.map(([item, detail]) => this.deletionStatement(at, site, item, actor, detail)),
      this.auditStatement(at, {
        actor,
        action: 'site.delete',
        entity: 'site',
        entityId: site.publicId,
        detail: counts,
      }),
      this.db.prepare('DELETE FROM draft_versions WHERE site_id = ?').bind(site.id),
      this.db.prepare('DELETE FROM sites WHERE id = ?').bind(site.id),
    ];
    await this.db.batch(statements);
    return counts;
  }

  async listDeletionLog(opts: DeletionLogOptions): Promise<DeletionLogRecord[]> {
    const limit = Math.max(1, Math.min(100, Math.floor(opts.limit)));
    const where = opts.before === undefined ? '' : 'WHERE id < ?';
    const values = opts.before === undefined ? [limit] : [opts.before, limit];
    const { results } = await this.db
      .prepare(
        `SELECT id, site_id, site_public_id, item, detail, actor, created_at
           FROM deletion_log ${where}
          ORDER BY id DESC LIMIT ?`,
      )
      .bind(...values)
      .all<{
        id: number;
        site_id: number;
        site_public_id: string;
        item: string;
        detail: string | null;
        actor: string;
        created_at: number;
      }>();
    return results.map((row) => ({
      id: row.id,
      siteId: row.site_id,
      sitePublicId: row.site_public_id,
      item: row.item,
      ...(row.detail === null ? {} : { detail: JSON.parse(row.detail) as unknown }),
      actor: row.actor,
      createdAt: row.created_at,
    }));
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
