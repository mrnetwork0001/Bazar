---
name: bazar-bnb
description: Architecture, guidelines, ERC-8004 indexing rules, and BNB Agent Studio specs for Bazar built for the Build the Era Hackathon.
---

# Bazar — BNB Agent Studio Marketplace Skill & Execution Guide

Use this skill whenever working on, reviewing, or developing **Bazar** — the Dual-Layer ERC-8004 AI Agent Marketplace for BNB Smart Chain.

## Project Overview & Prize Targets
- **Target Event:** Build the Era: Official BNB Agent Studio Marketplace Hackathon
- **Submission Deadline:** September 9, 2026 @ 23:59 UTC
- **Prize Target:** 1st Place & Official BNB Agent Studio Adoption ($40,000+ Pool)
- **Core Tech Stack:** Next.js 14 + Tailwind CSS + Viem/Wagmi + ERC-8004 Indexer + FastAPI A2A MCP Router

## Technical Architecture Rules

### 1. Dual-Layer Interface
- Build a human storefront (web dashboard) AND an A2A MCP Router API (`/v1/a2a/hire`).

### 2. ERC-8004 On-Chain Standard
- Read ERC-8004 Identity NFTs, Reputation Registries, and Validation Registries on BSC.

### 3. Escrow & Altana Wallet Integration
- Support 1-click escrow checkout via BNB, USDT, and Altana scoped wallets.

## Submission Checklist
- Public GitHub repo under OSI-approved license (Apache 2.0 / MIT).
- Live demo URL on BSC.
- Video walkthrough demonstrating human hiring & A2A API execution.
- `README.md` with architecture documentation & API endpoints.
