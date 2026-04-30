<p align="center">
  <img src="src/assets/logo.png" width="128" height="128" alt="HermesClaw Logo" />
</p>

<h1 align="center">HermesClaw</h1>

<p align="center">
  <strong>An open-source desktop workspace for OpenClaw and Hermes agents</strong>
</p>

<p align="center">
  <a href="#overview">Overview</a> ·
  <a href="#features">Features</a> ·
  <a href="#quick-start">Quick Start</a> ·
  <a href="#acknowledgements">Acknowledgements</a>
</p>

<p align="center">
  <a href="README.md">中文</a> · English
</p>

<p align="center">
  <img src="https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-blue" alt="Platform" />
  <img src="https://img.shields.io/badge/electron-40+-47848F?logo=electron" alt="Electron" />
  <img src="https://img.shields.io/badge/react-19-61DAFB?logo=react" alt="React" />
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License" />
</p>

---

## Overview

This README introduces HermesClaw as an open-source GitHub project. HermesClaw is an open-source desktop application for AI agents. It brings the runtime, configuration, and daily use of OpenClaw and Hermes into a visual workspace. Users can configure model providers, chat with agents, manage skills, connect channels, schedule tasks, and inspect runtime status without relying on the command line for everyday work.

HermesClaw is designed for users and developers who want to manage local AI-agent workflows. General users can get started through the graphical interface, while developers can read the source code, adjust runtime integrations, and extend the existing architecture.

OpenClaw-to-Hermes subprocess data flow:

```mermaid
graph LR
  A[User message] --> OC(OpenClaw main process)
  OC -->|Parse message| B{Need Hermes?}
  B -- Yes --> CallHermes[Call Hermes subprocess]
  CallHermes -->|STDIN/HTTP| HermesCore[Hermes Core]
  HermesCore -->|Result| CallHermes
  CallHermes -->|Return| OC
  B -- No --> OCAgent[OC Agent]
  OCAgent -->|Generate reply| OC
  OC -->|Send| C[User]
```

## Features

- **Graphical onboarding**: Configure language, model providers, and built-in skills through the first-run setup flow; the runtime defaults to the combined OpenClaw + Hermes mode.
- **Agent chat workspace**: Use Markdown messages, conversation history, and `@agent` routing to switch between agent contexts.
- **Runtime management**: Manage OpenClaw and Hermes through the primary `hermesclaw-both` mode, including Settings-based install, update checks, update application, rollback, and startup update prompts.
- **Model provider configuration**: Manage API keys, OAuth, custom OpenAI-compatible endpoints, GitHub Copilot authorization, and compatibility settings.
- **Skill and plugin management**: Browse, install, enable, and inspect OpenClaw skills and their on-disk directories.
- **Channels and scheduled tasks**: Configure external channels, account bindings, agent bindings, and recurring jobs.
- **Cross-platform desktop experience**: Built with Electron, React, and TypeScript for macOS, Windows, and Linux.

## Screenshots

<p align="center">
  <img src="resources/screenshot/en/chat.png" style="width: 100%; height: auto;" alt="HermesClaw chat" />
</p>

<p align="center">
  <img src="resources/screenshot/en/settings.png" style="width: 100%; height: auto;" alt="HermesClaw settings" />
</p>

## Quick Start

### Runtime environment

- **Node.js**: Node.js 24 is recommended to match the CI environment.
- **Python**: HermesAgent packaging uses Python 3.11.10; `pnpm run init` downloads the uv runtime, and HermesAgent builds/packages create the matching Python virtual environment through uv.
- **Package manager**: Use pnpm 10.31.0, as locked by the project's `packageManager` field.
- **Operating systems**: macOS, Windows, and Linux are supported; local development needs the Electron runtime environment for the target platform.
- **Ports**: The development server uses `5173` by default, and OpenClaw Gateway uses `18789` by default. See `.env.example` if you need to change them.
- **OpenClaw version**: The packaged baseline is pinned by `package.json` to `openclaw@2026.4.27`; builds can override it with `OPENCLAW_VERSION` or `OPENCLAW_PACKAGE_SPEC`, and third-party OpenClaw plugin mirrors are packaged by `pnpm run bundle:openclaw-plugins`.
- **First-time initialization**: Run `pnpm run init` before first use. It installs dependencies and downloads the uv runtime resources required by the project.

Clone this repository, then run the following commands in the project directory:

```bash
cd HermesClaw
pnpm run init
pnpm dev
```

## Development

Common commands:

```bash
pnpm install
pnpm run init
pnpm dev
pnpm run typecheck
pnpm run build:vite
```

Project structure:

```text
HermesClaw/
├── electron/        # Electron main process, runtime services, gateway management
├── src/             # React renderer application
├── resources/       # Runtime resources, CLI wrapper scripts, screenshots, and context files
├── scripts/         # Build, packaging, installer, and maintenance scripts
├── shared/          # Shared constants and types
└── tests/           # Unit and end-to-end tests
```

## Contributing

Issues, documentation improvements, translations, bug fixes, and feature suggestions are welcome. Before submitting a pull request, keep the change focused and explain how it affects users or developers.

## Acknowledgements

HermesClaw was made possible with thanks to OpenClaw, HermesAgent, and ClawX.

We also thank the broader open-source community:

- **OpenClaw**: Provides the agent runtime foundation for HermesClaw.
- **HermesAgent**: Inspired Hermes integration, agent runtime design, and bridge direction.
- **ClawX**: Provided important references for the desktop product shape, interaction experience, and project foundation.

Thanks to everyone who contributes ideas, code, tests, and feedback.

## License

HermesClaw is open source under the [MIT License](LICENSE).
