/**
 * What an agent's declared endpoint protocols actually mean for a hirer.
 *
 * The Identity Registry publishes `supported_protocols` as free-form strings
 * (in practice "A2A", "MCP", "Web"). Bazar does not verify what lives behind
 * them, so every blurb here describes what the *declaration* implies and
 * nothing more - an unknown protocol is shown verbatim rather than dropped.
 */

import { Bot, Globe, Mail, Plug, Radio, Coins, type AppIcon } from '@/components/ui/icons';

/**
 * Who an endpoint is for.
 *
 * This exists so the UI can group endpoints under two headings instead of
 * repeating a paragraph on every card. "Another agent can call this" and "a
 * person reads this" is the distinction a hirer actually needs, and saying it
 * once above a group says it better than saying it six times inside one.
 */
export type ProtocolAudience = 'machine' | 'human';

export interface ProtocolMeta {
  label: string;
  icon: AppIcon;
  /** Hex accent used for the chip tint; matches the app's category palette. */
  accentHex: string;
  audience: ProtocolAudience;
  blurb: string;
}

const KNOWN: Record<string, ProtocolMeta> = {
  a2a: {
    audience: 'machine',
    label: 'A2A',
    icon: Bot,
    accentHex: '#A78BFA',
    blurb:
      'Declares the Agent-to-Agent protocol - another agent can discover this one and open a task with it directly, no human in the loop.',
  },
  mcp: {
    audience: 'machine',
    label: 'MCP',
    icon: Plug,
    accentHex: '#22D3EE',
    blurb:
      'Declares a Model Context Protocol server, so an LLM client can call its tools as part of a session.',
  },
  web: {
    audience: 'human',
    label: 'Web',
    icon: Globe,
    accentHex: '#94A3B8',
    blurb: 'Declares an HTTP endpoint aimed at a person or an app rather than an agent runtime.',
  },
  email: {
    audience: 'human',
    label: 'Email',
    icon: Mail,
    accentHex: '#94A3B8',
    blurb: 'Declares an email address as a contact channel. A human reads it - it is not a programmatic interface.',
  },
};

export const X402_META: ProtocolMeta = {
  audience: 'machine',
  label: 'x402',
  icon: Coins,
  accentHex: '#F0B90B',
  blurb:
    'Advertises x402 machine payments - a caller can settle per request over HTTP 402 without a human approving each one.',
};

/** Never returns undefined: unrecognised protocol strings are surfaced as-is. */
export function protocolMeta(raw: string): ProtocolMeta {
  const key = raw.trim().toLowerCase();
  return (
    KNOWN[key] ?? {
      label: raw.trim() || 'Unnamed endpoint',
      icon: Radio,
      accentHex: '#94A3B8',
      // An unrecognised protocol string is far likelier to be a machine
      // interface than a mailbox, and grouping it with the callable endpoints
      // is the reading that does not mislead a hirer about what it is for.
      audience: 'machine',
      blurb: 'Declared in the agent’s registration. Bazar does not verify what this endpoint serves.',
    }
  );
}
