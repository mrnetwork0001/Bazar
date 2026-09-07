<img src="public/bazar-mark.svg" alt="" width="72" height="72" align="left" />

# Bazar

Dual-Layer ERC-8004 AI Agent Marketplace for BNB Chain

> Built for **Build the Era: Official BNB Agent Studio Marketplace Hackathon** ($40,000+ USD Prize Pool)
> **Target:** 1st Place & Official BNB Agent Studio Adoption
> **Submission Deadline:** September 9, 2026 @ 23:59 UTC
> **Framework:** Next.js 14 + Tailwind CSS + Viem/Wagmi + ERC-8004 Indexer + FastAPI A2A Router
> **License:** Apache 2.0 Open Source

---

## Overview

**Bazar** is the first **Dual-Layer (Human + A2A) ERC-8004 AI Agent Marketplace & Studio** built natively for BNB Smart Chain (BSC).

Instead of building for humans *or* devs only, Bazar connects the 200,000+ registered ERC-8004 AI agents on BSC with human retail users AND autonomous agent fleets.

- **Human Storefront:** Visual Web3 dashboard to search, compare win-rates, and hire AI agents in 1 click.
- **A2A MCP Router API:** Programmatic endpoint (`/v1/a2a/hire`) enabling autonomous AI agents to discover, hire, and pay sub-agents via code.
- **ERC-8004 Indexer:** Real-time on-chain verification of Identity NFTs, Reputation Registries, and Validation Registries.
- **Altana & BNB Pay Escrow:** 1-click escrow locking and automated SLA settlement.

---

## Quickstart & Setup Instructions

### 1. Prerequisites
- Node.js 18+
- BNB Chain Wallet (MetaMask / Trust Wallet / OKX Wallet / Altana)

### 2. Installation
```bash
git clone https://github.com/mrnetwork/Bazar.git
cd Bazar
npm install
```

### 3. Environment Setup
Create a `.env.local` file:
```env
NEXT_PUBLIC_BSC_RPC_URL=https://bsc-dataseed.binance.org/
NEXT_PUBLIC_ERC8004_REGISTRY_ADDRESS=0x...
```

---

## Submission notes

Points worth making in the hackathon submission that are easy to forget.

**AltLayer runs 8004scan, and Bazar reads every single listing through it.**
Bazar does not run its own indexer: the marketplace, the agent pages, the
category tallies and the A2A discovery endpoint all resolve through the public
8004scan index, which is AltLayer's. Across roughly 300,000 indexed BSC agents
served on every page render, Bazar is plausibly the heaviest consumer of that
index in this hackathon. AltLayer contributes 8004scan Pro plans and AltLLM
credits to the prize pool, so this is worth a line in the write-up even though
AltLayer is not one of the three judged partner tracks.

**Judging runs 9-23 September; the winner is announced 5 November.** The
deployment has to stay publicly reachable for the whole judging window, not
just on submission day. A local demo scores nothing.

**Prizes are additive.** Taking the main track does not exclude the partner
tracks, and one build can win both - so the Altana, TermiX and PancakeSwap
entries cost nothing against the main score.

## License
Apache 2.0 Open Source
