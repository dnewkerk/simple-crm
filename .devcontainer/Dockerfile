FROM node:22-bookworm

# --- System deps for Playwright (Chromium) + general tooling ---
RUN apt-get update && apt-get install -y --no-install-recommends \
    git curl ca-certificates jq sqlite3 ripgrep \
    libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 \
    libdrm2 libdbus-1-3 libxkbcommon0 libxcomposite1 libxdamage1 \
    libxfixes3 libxrandr2 libgbm1 libasound2 libpango-1.0-0 \
    libcairo2 libatspi2.0-0 \
  && rm -rf /var/lib/apt/lists/*

# --- Claude Code (global) ---
RUN npm install -g @anthropic-ai/claude-code

# --- Playwright CLI + browser (cached in the image, not at runtime) ---
RUN npm install -g playwright && npx playwright install chromium

WORKDIR /workspace
# node user ships with the base image; run as non-root
USER node
