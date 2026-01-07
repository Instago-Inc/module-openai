# @instago/openai

Call OpenAI chat models from your workflow with minimal setup. Add your API key, choose a model, and ask for plain text or JSON-formatted answers.

- Version: 1.0.0
- Entry: index.js
- Exports: `{ configure, chat, chatJSON }`
- Dependencies: `http@1.0.0`, `json@1.0.0`, `log@1.0.0`, `env@1.0.0`
- Env (via `env@1.0.0`): `openai.apiKey`, `openai.debug`

## API
- `configure({ apiKey?, model?, baseUrl? })`
- `chat({ messages?, system?, user?, model?, response_format?, baseUrl?, temperature?, debug? })` → raw OpenAI response
- `chatJSON({ system, user, model?, baseUrl?, temperature?, debug? })` → `{ raw, data }` with JSON parsed content

## Example
```js
const openai = require('openai@1.0.0');

openai.configure({ apiKey: env.openai.apiKey, model: 'gpt-4o-mini' });

const out = await openai.chatJSON({
  system: 'You are concise.',
  user: 'Return {"ok":true}',
  debug: false
});
```

## Notes
- Uses `sys.http.fetch` via `http@1.0.0`.
- Trims code fences from model output before JSON parse in `chatJSON`.
