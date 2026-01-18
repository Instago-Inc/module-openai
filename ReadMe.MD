# module/openai - V8 module

Make OpenAI chat calls from workflows without extra glue code. This module keeps the surface area small while handling the common JSON-response pattern and basic streaming support.

It is designed for the embedded V8 runtime used by Instago. Learn more at https://instago.ai.

## Technical reference

Exports
- `configure({ apiKey?, model?, baseUrl? })`
- `chat({ apiKey?, model?, messages?, system?, user?, response_format?, baseUrl?, temperature?, debug? })`
- `chatStream({ apiKey?, model?, messages?, system?, user?, response_format?, baseUrl?, temperature?, onToken?, onDone?, debug? })`
- `chatJSON({ apiKey?, model?, system?, user?, baseUrl?, temperature?, debug? })`

Usage
- `chat` returns the raw OpenAI JSON response.
- `chatStream` streams tokens and returns `{ text }`; `onToken(delta)` fires per chunk, `onDone(text)` fires at completion.
- `chatJSON` enforces JSON-mode, strips code fences, and returns `{ raw, data }` where `data` is parsed JSON or `undefined`.
- Pass `messages` as an array of `{ role, content }` objects, or supply `system` and `user` strings.

Configuration
- `configure({ apiKey?, model?, baseUrl? })` sets shared defaults for the module.
- `apiKey` can also be provided per call; if omitted, the module reads `openai.apiKey` from `env`.
- `debug` enables extra logs and also reads `openai.debug` from `env`.

Examples
```js
const openai = require('openai@latest');

openai.configure({ apiKey: env.openai.apiKey, model: 'gpt-4o-mini' });

const result = await openai.chatJSON({
  system: 'You are concise.',
  user: 'Return {"ok": true}',
  debug: false
});
```

```js
const openai = require('openai@latest');

const res = await openai.chatStream({
  apiKey: env.openai.apiKey,
  user: 'Stream me a short poem.',
  onToken: (delta) => console.log(delta),
  onDone: (text) => console.log('done:', text)
});
```
