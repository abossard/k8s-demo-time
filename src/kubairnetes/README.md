# ☸️ KubAIrnetes

**Interactive Kubernetes tutorial presenter powered by AI**

KubAIrnetes turns README files and Kubernetes YAML manifests into interactive guided presentations with live command execution and cluster visualization.

## Features

- **📖 Slide-based presentation** — Auto-parses README.md into navigable slides
- **▶️ Live command execution** — Run kubectl commands directly from slides with streaming output
- **🤖 AI chat** — Ask questions about the current content using GitHub Models API
- **🗺️ Cluster visualization** — D3.js force-directed graph of pods, nodes, and services
- **📊 Status dashboard** — Card-based live view of cluster resources
- **📐 Architecture diagrams** — Auto-generated Mermaid diagrams from K8s YAML files
- **📜 Command history** — Full log of all executed commands with re-run capability
- **🛡️ Safety controls** — Dry-run mode, dangerous command confirmation, allowlisted commands only

## Quick Start

```bash
cd src/kubairnetes

# Install dependencies
npm install && cd server && npm install && cd ../client && npm install && cd ..

# Start both server and client in dev mode
npm run dev
```

Then open **http://localhost:5173** and select a README to begin.

## Architecture

```
┌─────────────────────────────────────────────────┐
│  Browser (localhost:5173)                        │
│  ┌──────────────┐  ┌──────────────────────────┐ │
│  │  Slide Panel  │  │  Right Panel             │ │
│  │  - Markdown   │  │  - Terminal (SSE stream) │ │
│  │  - Commands   │  │  - Cluster Viz (D3)      │ │
│  │  - Navigation │  │  - Status Grid           │ │
│  │              │  │  - Architecture (Mermaid) │ │
│  └──────────────┘  └──────────────────────────┘ │
│  ┌──────────────────────────────────────────────┐│
│  │  Chat Panel / Command History                ││
│  └──────────────────────────────────────────────┘│
└─────────────────────────────────────────────────┘
          │ /api/*
┌─────────┴───────────────────────────────────────┐
│  Express Server (localhost:3001)                  │
│  - /api/files     File browsing                  │
│  - /api/content   README parsing + YAML scanning │
│  - /api/commands  Command execution (SSE)        │
│  - /api/chat      AI chat (GitHub Models API)    │
│  - /api/cluster   K8s cluster state              │
└──────────────────────────────────────────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite, Tailwind CSS v4 |
| Visualization | D3.js, Mermaid |
| Markdown | react-markdown, remark-gfm |
| Backend | Express 5, TypeScript |
| AI | GitHub Models API (gpt-4o via `gh auth token`) |
| Commands | Child process execution with SSE streaming |

## Usage

1. **Select a README** — Browse the file tree and click any README.md
2. **Navigate slides** — Use arrow keys or click the progress bar
3. **Run commands** — Hover over any command block and click ▶️ Run
4. **Toggle dry-run** — Enable in the header to append `--dry-run=client`
5. **Chat with AI** — Click "Chat" and ask about the current content
6. **View cluster** — Switch to Cluster/Status tabs and click Refresh
7. **Review history** — Click "History" to see all executed commands

## Command Safety

- Only allowlisted commands can run: `kubectl`, `helm`, `az`, `curl`, `cat`, `echo`, `grep`, `jq`, `watch`
- Destructive commands (`delete`, `drain`, `taint`) require confirmation
- Dry-run mode available for safe exploration
- 120-second timeout on all commands
