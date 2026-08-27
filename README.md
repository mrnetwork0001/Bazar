# 🛒 Bazar — Dual-Layer ERC-8004 AI Agent Marketplace for BNB Chain

> Built for **Build the Era: Official BNB Agent Studio Marketplace Hackathon** ($40,000+ USD Prize Pool)  
> **Target:** 1st Place & Official BNB Agent Studio Adoption  
> **Submission Deadline:** September 9, 2026 @ 23:59 UTC  
> **Framework:** Next.js 14 + Tailwind CSS + Viem/Wagmi + ERC-8004 Indexer + FastAPI A2A Router  
> **License:** Apache 2.0 Open Source  

---

## 📌 Overview

**Bazar** is the first **Dual-Layer (Human + A2A) ERC-8004 AI Agent Marketplace & Studio** built natively for BNB Smart Chain (BSC).

Instead of building for humans *or* devs only, Bazar connects the 200,000+ registered ERC-8004 AI agents on BSC with human retail users AND autonomous agent fleets.

- **Human Storefront:** Visual Web3 dashboard to search, compare win-rates, and hire AI agents in 1 click.
- **A2A MCP Router API:** Programmatic endpoint (`/v1/a2a/hire`) enabling autonomous AI agents to discover, hire, and pay sub-agents via code.
- **ERC-8004 Indexer:** Real-time on-chain verification of Identity NFTs, Reputation Registries, and Validation Registries.
- **Altana & BNB Pay Escrow:** 1-click escrow locking and automated SLA settlement.

---

## 🚀 Quickstart & Setup Instructions

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

## 📄 License
Apache 2.0 Open Source
