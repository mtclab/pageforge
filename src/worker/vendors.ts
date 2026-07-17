import type { Env } from './shared.js';

export type VendorResult =
  | { mode: 'manual' }
  | { mode: 'done'; evidence: string }
  | { mode: 'failed'; error: string };

export interface DomainAdapter {
  register(domain: string): Promise<VendorResult>;
}

export interface MailAdapter {
  provision(address: string): Promise<VendorResult>;
}

export interface HostnameAdapter {
  attach(domain: string): Promise<VendorResult>;
}

export interface VendorAdapters {
  domain: DomainAdapter;
  mail: MailAdapter;
  hostname: HostnameAdapter;
}

/**
 * V1 deliberately records supervised operator work. Returning manual leaves
 * the corresponding step waiting until an operator supplies evidence.
 */
export class ManualAdapter implements DomainAdapter, MailAdapter, HostnameAdapter {
  async register(_domain: string): Promise<VendorResult> {
    return { mode: 'manual' };
  }

  async provision(_address: string): Promise<VendorResult> {
    return { mode: 'manual' };
  }

  async attach(_domain: string): Promise<VendorResult> {
    return { mode: 'manual' };
  }
}

export function vendorAdapters(env: Pick<Env, 'VENDOR_MODE'>): VendorAdapters {
  const mode = env.VENDOR_MODE?.trim() || 'manual';
  if (mode !== 'manual') {
    throw new Error(`Unsupported VENDOR_MODE: ${mode}`);
  }
  const manual = new ManualAdapter();
  return { domain: manual, mail: manual, hostname: manual };
}

// TODO(S9 gate register — no Openprovider account): add OpenproviderDomainAdapter.
// TODO(S9 gate register — no CF-for-SaaS zone): add CloudflareForSaaSHostnameAdapter.
