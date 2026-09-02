/**
 * ERC-8004 identity registration, prepared but never signed.
 *
 * Bazar is a reader, not a registry: an agent is not "listed on Bazar", it is
 * registered on the Identity Registry on BNB Chain and Bazar reads it from the
 * index like every other client. So this service does exactly what the hire
 * service does for jobs - validates the inputs, builds the agent card, encodes
 * the call, and hands back unsigned calldata for the owner's wallet to submit.
 * Bazar holds no keys and broadcasts nothing.
 *
 * The card is embedded as a base64 data URI rather than an HTTPS link. That is
 * a deliberate trade: a data URI costs more gas because the whole document is
 * written onchain as a string, but it has no host to expire, no certificate to
 * lapse and no server to go down. An agent whose card 404s is an agent nobody
 * can read, and the registry's own guidance is that the tokenURI must resolve.
 * Callers who would rather host it themselves can pass `agentURI` directly.
 */

import { encodeFunctionData } from 'viem';
import { IDENTITY_REGISTRY_ABI } from '@/lib/abi';
import { getDeployment, type SupportedChainId } from '@/lib/chain/addresses';
import { DEFAULT_CHAIN_ID } from '@/lib/chain/addresses';
import type { Address } from '@/lib/types';

/** The registration-v1 document the ERC-8004 spec defines. */
export const REGISTRATION_TYPE = 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1';

/**
 * Protocols the index recognises. An endpoint named anything else still
 * registers fine onchain, but 8004scan will not surface it as a protocol chip,
 * so the caller is told rather than left wondering.
 */
export const KNOWN_PROTOCOLS = ['A2A', 'MCP', 'Web', 'OASF', 'Email', 'ENS'] as const;

/**
 * Onchain strings are not free. A registration is a single `string` argument,
 * so every byte of the card is calldata the owner pays for; a 32KB card is a
 * very expensive transaction and a sign of a document that belongs off chain.
 */
const MAX_CARD_BYTES = 16_384;

/**
 * A logo embedded in the card is calldata the owner pays for on every byte, so
 * only a small mark is worth carrying onchain. Anything larger belongs on a
 * host, referenced by URL.
 */
const MAX_IMAGE_BYTES = 24_576;

export interface AgentService {
  name: string;
  endpoint: string;
  version?: string;
  capabilities?: string[];
}

export interface RegisterAgentRequest {
  owner: Address;
  name?: string;
  description?: string;
  image?: string;
  services?: AgentService[];
  /** Supply this to host the card yourself; Bazar then embeds nothing. */
  agentURI?: string;
  chainId?: SupportedChainId;
}

export interface ValidationIssue {
  path: string;
  message: string;
}

export type RegisterValidation =
  | { ok: true; value: Required<Pick<RegisterAgentRequest, 'owner'>> & RegisterAgentRequest }
  | { ok: false; errors: ValidationIssue[] };

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;

function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

export function validateRegisterRequest(input: unknown): RegisterValidation {
  const errors: ValidationIssue[] = [];
  if (typeof input !== 'object' || input === null) {
    return { ok: false, errors: [{ path: '', message: 'Body must be a JSON object.' }] };
  }
  const { owner, name, description, image, services, agentURI, chainId } = input as RegisterAgentRequest;

  if (typeof owner !== 'string' || !ADDRESS.test(owner)) {
    errors.push({ path: 'owner', message: 'owner is required and must be a 0x-prefixed address - it receives the identity NFT.' });
  }

  // Either Bazar builds the card, or the caller supplies a URI. Not neither.
  const buildingCard = agentURI === undefined;
  if (!buildingCard) {
    if (typeof agentURI !== 'string' || (!isHttpUrl(agentURI) && !agentURI.startsWith('data:'))) {
      errors.push({ path: 'agentURI', message: 'agentURI must be an http(s) URL or a data: URI that resolves to a registration file.' });
    }
  } else {
    if (typeof name !== 'string' || name.trim().length < 2) {
      errors.push({ path: 'name', message: 'name is required (2 characters or more) when Bazar builds the card.' });
    }
    if (typeof description !== 'string' || description.trim().length < 10) {
      errors.push({ path: 'description', message: 'description is required (10 characters or more) - it is what a hirer reads before trusting the agent.' });
    }
    if (!Array.isArray(services) || services.length === 0) {
      errors.push({ path: 'services', message: 'At least one service endpoint is required - an agent with no endpoint cannot be hired.' });
    } else {
      services.forEach((s, i) => {
        if (!s || typeof s.name !== 'string' || !s.name.trim()) {
          errors.push({ path: `services[${i}].name`, message: `Protocol name is required, e.g. one of ${KNOWN_PROTOCOLS.join(', ')}.` });
        }
        if (!s || typeof s.endpoint !== 'string' || !isHttpUrl(s.endpoint)) {
          errors.push({ path: `services[${i}].endpoint`, message: 'endpoint must be an http(s) URL.' });
        }
      });
    }
    if (image !== undefined && image !== '') {
      if (typeof image !== 'string') {
        errors.push({ path: 'image', message: 'image must be a string.' });
      } else if (image.startsWith('data:')) {
        // An embedded logo is written onchain byte for byte, so it is the most
        // expensive thing a registration can carry. Small marks only.
        if (!/^data:image\/(png|jpeg|webp|svg\+xml);base64,/.test(image)) {
          errors.push({ path: 'image', message: 'An embedded image must be a base64 data URI of type png, jpeg, webp or svg+xml.' });
        } else if (Buffer.byteLength(image, 'utf8') > MAX_IMAGE_BYTES) {
          errors.push({
            path: 'image',
            message: `An embedded image must stay under ${Math.floor(MAX_IMAGE_BYTES / 1024)}KB - it is written onchain as calldata and the owner pays for every byte. Host it and pass a URL instead.`,
          });
        }
      } else if (!isHttpUrl(image)) {
        errors.push({ path: 'image', message: 'image must be an http(s) URL, or a base64 data URI for a small mark.' });
      }
    }
  }

  if (chainId !== undefined && chainId !== DEFAULT_CHAIN_ID) {
    errors.push({ path: 'chainId', message: `chainId must be ${DEFAULT_CHAIN_ID} - Bazar registers on BNB Smart Chain mainnet only.` });
  }

  if (errors.length) return { ok: false, errors };
  return { ok: true, value: input as RegisterAgentRequest & { owner: Address } };
}

/** The registration document, exactly as the spec and the BNB SDK shape it. */
export function buildRegistrationFile(req: RegisterAgentRequest, chainId: SupportedChainId) {
  const registry = getDeployment(chainId).identityRegistry;
  return {
    type: REGISTRATION_TYPE,
    name: req.name?.trim() ?? '',
    description: req.description?.trim() ?? '',
    image: req.image?.trim() ?? '',
    services: (req.services ?? []).map((s) => ({
      name: s.name.trim(),
      endpoint: s.endpoint.trim(),
      ...(s.version ? { version: s.version } : {}),
      ...(s.capabilities?.length ? { capabilities: s.capabilities } : {}),
    })),
    // agentId is unknown until the mint returns it, so registrations carries the
    // registry and chain only. Callers who want the id inside the card can
    // setAgentURI once, after registering.
    registrations: [{ agentRegistry: `eip155:${chainId}:${registry}` }],
  };
}

export function toDataUri(card: unknown): string {
  const json = JSON.stringify(card);
  const b64 = Buffer.from(json, 'utf8').toString('base64');
  return `data:application/json;base64,${b64}`;
}

export interface RegisterIntent {
  ok: true;
  standard: 'ERC-8004';
  chainId: SupportedChainId;
  chainName: string;
  registry: Address;
  /** The document that will resolve at tokenURI. Null when the caller hosts it. */
  card: ReturnType<typeof buildRegistrationFile> | null;
  agentURI: string;
  agentURIBytes: number;
  transaction: {
    call: 'register';
    signature: string;
    to: Address;
    calldata: `0x${string}`;
    value: '0x0';
    actor: 'owner';
    emits: string;
    description: string;
    reverts: string[];
  };
  next: string[];
  notes: string[];
}

export function buildRegisterIntent(req: RegisterAgentRequest): RegisterIntent {
  const chainId = (req.chainId ?? DEFAULT_CHAIN_ID) as SupportedChainId;
  const deployment = getDeployment(chainId);

  const card = req.agentURI ? null : buildRegistrationFile(req, chainId);
  const agentURI = req.agentURI ?? toDataUri(card);
  const agentURIBytes = Buffer.byteLength(agentURI, 'utf8');

  const calldata = encodeFunctionData({
    abi: IDENTITY_REGISTRY_ABI,
    functionName: 'register',
    args: [agentURI],
  }) as `0x${string}`;

  const notes: string[] = [
    'Bazar does not hold the identity. register() mints the ERC-721 to whoever sends the transaction, so send it from the owner address.',
    'Bazar does not gate listing. Once the mint is indexed, the agent appears in the marketplace with no submission or approval step.',
  ];
  if (agentURIBytes > MAX_CARD_BYTES) {
    notes.push(
      `The card is ${agentURIBytes} bytes and will be written onchain as calldata, which is expensive above ~${MAX_CARD_BYTES}. Host it and pass agentURI instead.`,
    );
  }
  if (card) {
    const unknown = card.services.map((s) => s.name).filter((n) => !KNOWN_PROTOCOLS.includes(n as never));
    if (unknown.length) {
      notes.push(`The index surfaces protocol chips for ${KNOWN_PROTOCOLS.join(', ')}; ${unknown.join(', ')} will register but not be shown as a chip.`);
    }
  }

  return {
    ok: true,
    standard: 'ERC-8004',
    chainId,
    chainName: deployment.name,
    registry: deployment.identityRegistry,
    card,
    agentURI,
    agentURIBytes,
    transaction: {
      call: 'register',
      signature: 'register(string)',
      to: deployment.identityRegistry,
      calldata,
      value: '0x0',
      actor: 'owner',
      emits: 'Registered(uint256 indexed agentId, string agentURI, address indexed owner)',
      description:
        'Mints the ERC-8004 identity NFT and returns its agentId. Read the id from the Registered event on the receipt rather than from a counter, which races.',
      reverts: ['The registry rejects an empty agentURI.'],
    },
    next: [
      'Submit the transaction from the owner address and read agentId from the Registered event.',
      'The index picks the agent up on its next pass; Bazar then lists it with no further action.',
      'To embed the agentId in the card, call setAgentURI(agentId, newURI) once afterwards.',
    ],
    notes,
  };
}
