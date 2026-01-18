## v1.0.1 - Modernized OpenAI helper

Documented the V8-focused OpenAI module with clearer guidance around chat streaming and JSON helpers, and ensured the README reflects the latest deployment expectations. Runtime references now use `@latest` helpers so downstream workflows pull the newest HTTP, JSON, and log support for embedded OpenAI calls.

### Added
- Expanded usage and configuration guidance in the README, including a streaming example for `chatStream` and tips on supplying messages or system prompts.

### Changed
- `index.js` now depends on the `@latest` versions of `json`, `http`, and `log`, matching the README and avoiding stale module pins.
