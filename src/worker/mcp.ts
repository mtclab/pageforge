import type { SiteData } from '../engine/types.js';
import { createProposal, getBizSite, listOpenProposals } from './biz.js';
import { type Env, json, readJson, requireOperator } from './shared.js';

interface RpcRequest {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: unknown;
}

interface ToolCallParams {
  name?: string;
  arguments?: Record<string, unknown>;
}

const HUMAN_APPROVAL = 'publishing requires human approval outside MCP';

const TOOLS = [
  {
    name: 'get_site',
    description: `Read the current site, version metadata, and open proposal ids. ${HUMAN_APPROVAL}`,
    inputSchema: {
      type: 'object',
      properties: { siteId: { type: 'string', pattern: '^[a-z0-9]{8}$' } },
      required: ['siteId'],
      additionalProperties: false,
    },
  },
  {
    name: 'propose_update',
    description: `Stage a complete SiteData candidate for preview. ${HUMAN_APPROVAL}`,
    inputSchema: {
      type: 'object',
      properties: {
        siteId: { type: 'string', pattern: '^[a-z0-9]{8}$' },
        candidate: { type: 'object', description: 'Complete validated SiteData version 1.' },
        note: { type: 'string', maxLength: 300 },
      },
      required: ['siteId', 'candidate'],
      additionalProperties: false,
    },
  },
  {
    name: 'list_proposals',
    description: `List open staged proposals and their summaries. ${HUMAN_APPROVAL}`,
    inputSchema: {
      type: 'object',
      properties: { siteId: { type: 'string', pattern: '^[a-z0-9]{8}$' } },
      required: ['siteId'],
      additionalProperties: false,
    },
  },
] as const;

function rpcResult(id: RpcRequest['id'], result: unknown): Response {
  return json(200, { jsonrpc: '2.0', id: id ?? null, result });
}

function rpcError(id: RpcRequest['id'], code: number, message: string): Response {
  return json(200, { jsonrpc: '2.0', id: id ?? null, error: { code, message } });
}

function toolContent(value: unknown, isError = false): { content: { type: 'text'; text: string }[]; isError?: true } {
  return {
    content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value) }],
    ...(isError ? { isError: true as const } : {}),
  };
}

function validSiteId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-z0-9]{8}$/.test(value);
}

async function callTool(env: Env, params: unknown): Promise<ReturnType<typeof toolContent>> {
  if (!params || typeof params !== 'object') return toolContent('Invalid tool call parameters.', true);
  const { name, arguments: args = {} } = params as ToolCallParams;
  if (!args || typeof args !== 'object') return toolContent('Invalid tool arguments.', true);
  const siteId = args.siteId;
  if (!validSiteId(siteId)) return toolContent('A valid siteId is required.', true);

  if (name === 'get_site') {
    const site = await getBizSite(env, siteId);
    if (!site) return toolContent('Site not found.', true);
    const proposals = await listOpenProposals(env, siteId);
    return toolContent({
      data: site.data,
      versions: site.versions.map(({ n, at, note }) => ({ n, at, ...(note === undefined ? {} : { note }) })),
      openProposals: proposals.map(({ proposalId }) => proposalId),
    });
  }

  if (name === 'propose_update') {
    const result = await createProposal(
      env,
      siteId,
      args.candidate as SiteData,
      args.note as string | undefined,
    );
    return result.ok ? toolContent(result.value) : toolContent(result.error, true);
  }

  if (name === 'list_proposals') {
    const site = await getBizSite(env, siteId);
    if (!site) return toolContent('Site not found.', true);
    return toolContent(await listOpenProposals(env, siteId));
  }

  // Approval, rejection, rollback, and publishing deliberately remain outside MCP.
  return toolContent(`Unknown tool; ${HUMAN_APPROVAL}.`, true);
}

export async function handleMcpRequest(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return json(405, { error: 'Method not allowed.' });
  const denied = await requireOperator(request, env);
  if (denied) return denied;
  const parsed = await readJson<RpcRequest>(request);
  if ('error' in parsed) return rpcError(null, -32700, 'Parse error');
  const message = parsed.value;
  if (!message || message.jsonrpc !== '2.0' || typeof message.method !== 'string') {
    return rpcError(message?.id, -32600, 'Invalid Request');
  }

  if (message.method === 'notifications/initialized') return new Response(null, { status: 202 });
  if (message.method === 'initialize') {
    return rpcResult(message.id, {
      protocolVersion: '2025-06-18',
      capabilities: { tools: {} },
      serverInfo: { name: 'pageforge-mikoshi', version: '0.1.0' },
    });
  }
  if (message.method === 'tools/list') return rpcResult(message.id, { tools: TOOLS });
  if (message.method === 'tools/call') return rpcResult(message.id, await callTool(env, message.params));
  return rpcError(message.id, -32601, 'Method not found');
}
