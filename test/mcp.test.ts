import { beforeEach, describe, expect, it } from 'vitest';
import type { SiteData } from '../src/engine/types.js';
import { ControlPlane } from '../src/worker/db.js';
import worker from '../src/worker/index.js';
import minimal from './fixtures/minimal.json';
import { jsonRequest, workerEnv } from './worker-fixture.js';

const operatorKey = 'operator-secret';
const base = minimal as SiteData;

function rpc(method: string, params?: unknown, id = 1, token?: string): Request {
  return jsonRequest('/api/mcp', 'POST', {
    jsonrpc: '2.0',
    id,
    method,
    ...(params === undefined ? {} : { params }),
  }, token);
}

describe('Mikoshi MCP endpoint', () => {
  let env: ReturnType<typeof workerEnv>;

  beforeEach(() => {
    env = workerEnv();
  });

  async function createSite(): Promise<{ id: string; approvalKey: string }> {
    const response = await worker.fetch(
      jsonRequest('/api/biz/sites', 'POST', { data: { ...base, name: 'MCP Site' } }, operatorKey),
      env,
    );
    return response.json() as Promise<{ id: string; approvalKey: string }>;
  }

  async function callTool(name: string, args: Record<string, unknown>): Promise<{
    content: { type: 'text'; text: string }[];
    isError?: boolean;
  }> {
    const response = await worker.fetch(rpc('tools/call', { name, arguments: args }, 2, operatorKey), env);
    expect(response.status).toBe(200);
    const body = await response.json() as {
      result: { content: { type: 'text'; text: string }[]; isError?: boolean };
    };
    return body.result;
  }

  it('initializes and exposes the propose-only and update-request tools', async () => {
    const initialized = await worker.fetch(rpc('initialize', undefined, 1, operatorKey), env);
    expect(await initialized.json()).toMatchObject({
      jsonrpc: '2.0',
      id: 1,
      result: {
        protocolVersion: '2025-06-18',
        capabilities: { tools: {} },
        serverInfo: { name: 'pageforge-mikoshi' },
      },
    });

    const response = await worker.fetch(rpc('tools/list', undefined, 2, operatorKey), env);
    const body = await response.json() as {
      result: { tools: { name: string; description: string; inputSchema: unknown }[] };
    };
    expect(body.result.tools.map(({ name }) => name)).toEqual([
      'get_site',
      'propose_update',
      'list_proposals',
      'list_update_requests',
      'get_update_request',
    ]);
    expect(body.result.tools).toHaveLength(5);
    for (const tool of body.result.tools) {
      expect(tool.inputSchema).toBeTypeOf('object');
      expect(tool.description).toContain('human approval outside MCP');
    }
  });

  it('reads a REST-created site and proposes through the shared KV workflow', async () => {
    const { id } = await createSite();
    const initial = await callTool('get_site', { siteId: id });
    expect(initial.isError).toBeUndefined();
    expect(JSON.parse(initial.content[0]!.text)).toMatchObject({
      data: { name: 'MCP Site' },
      versions: [],
      openProposals: [],
    });

    const candidate: SiteData = { ...base, name: 'Agentin ehdotus', tagline: 'Luonnos' };
    const proposed = await callTool('propose_update', { siteId: id, candidate, note: 'Agent update' });
    expect(proposed.isError).toBeUndefined();
    const proposal = JSON.parse(proposed.content[0]!.text) as {
      proposalId: string;
      previewPath: string;
      summary: string[];
    };
    const previewUrl = new URL(proposal.previewPath, 'https://example.test');
    expect(previewUrl.pathname).toBe(`/p/${id}/${proposal.proposalId}`);
    expect(previewUrl.searchParams.get('t')).toMatch(/^[a-f0-9]{32}$/);
    expect((await worker.fetch(new Request(previewUrl.origin + previewUrl.pathname), env)).status).toBe(404);
    expect((await worker.fetch(new Request(previewUrl), env)).status).toBe(200);
    expect(proposal.summary).toContain('name changed');

    const listed = await callTool('list_proposals', { siteId: id });
    expect(JSON.parse(listed.content[0]!.text)).toEqual([
      expect.objectContaining({ proposalId: proposal.proposalId, summary: proposal.summary }),
    ]);

    const rest = await worker.fetch(jsonRequest(`/api/biz/sites/${id}`, 'GET', undefined, operatorKey), env);
    const restBody = await rest.json() as { openProposals: string[] };
    expect(restBody.openProposals).toEqual([proposal.proposalId]);
  });

  it('reads update requests and links a proposal to one', async () => {
    const { id } = await createSite();
    const cp = new ControlPlane(env.DB);
    const site = (await cp.getSiteByPublicId(id))!;
    const request = await cp.createUpdateRequest({
      site,
      channel: 'mcp',
      fromAddr: 'owner@example.fi',
      body: 'Vaihda iskulause',
      actor: 'mcp',
    });

    const listed = await callTool('list_update_requests', { siteId: id, status: 'uusi' });
    expect(JSON.parse(listed.content[0]!.text)).toEqual([
      expect.objectContaining({ id: request.id, fromAddr: 'owner@example.fi', status: 'uusi' }),
    ]);
    const read = await callTool('get_update_request', { siteId: id, requestId: request.id });
    expect(JSON.parse(read.content[0]!.text)).toMatchObject({ id: request.id, body: 'Vaihda iskulause' });

    const candidate: SiteData = { ...base, name: 'MCP Site', tagline: 'Uusi iskulause' };
    const proposed = await callTool('propose_update', {
      siteId: id,
      candidate,
      updateRequestId: request.id,
    });
    expect(proposed.isError).toBeUndefined();
    const proposalId = (JSON.parse(proposed.content[0]!.text) as { proposalId: string }).proposalId;
    expect(await cp.getUpdateRequest(request.id)).toMatchObject({
      status: 'ehdotettu',
      proposalPublicId: proposalId,
    });
  });

  it('does not expose or execute approval through MCP', async () => {
    const { id } = await createSite();
    const result = await callTool('approve', { siteId: id, proposalId: '12345678' });
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain('human approval outside MCP');
    const current = await worker.fetch(new Request(`https://example.test/b/${id}`), env);
    expect(await current.text()).toContain('MCP Site');
  });

  it('accepts the initialized notification and rejects unknown methods', async () => {
    const notification = jsonRequest('/api/mcp', 'POST', {
      jsonrpc: '2.0',
      method: 'notifications/initialized',
    }, operatorKey);
    expect((await worker.fetch(notification, env)).status).toBe(202);

    const unknown = await worker.fetch(rpc('resources/list', undefined, 9, operatorKey), env);
    expect(await unknown.json()).toEqual({
      jsonrpc: '2.0',
      id: 9,
      error: { code: -32601, message: 'Method not found' },
    });
  });

  it('requires operator auth and stays hidden when mutation mode is off', async () => {
    expect((await worker.fetch(rpc('tools/list'), env)).status).toBe(401);
    expect((await worker.fetch(rpc('tools/list', undefined, 1, 'wrong'), env)).status).toBe(403);
    const closed = workerEnv({ MUTATION_API_ENABLED: 'false' });
    expect((await worker.fetch(rpc('tools/list', undefined, 1, operatorKey), closed)).status).toBe(404);
  });
});
