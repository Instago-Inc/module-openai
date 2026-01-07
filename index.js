// modules_cache/openai/1.0.0/index.js
// Lightweight OpenAI helper for JSON-mode chat completions.
// Usage:
//   const openai = require('openai@1.0.0');
//   openai.configure({ apiKey: '<key>', model: 'gpt-4o-mini' });
//   const out = await openai.chatJSON({ system: 'You are...', user: 'Prompt', debug: true });

(function() {
  const j = require('json@1.0.0');
  const httpx = require('http@1.0.0');
  const log = require('log@1.0.0').create('openai');
  let cfg = {
    apiKey: null,
    model: 'gpt-4o-mini',
    baseUrl: 'https://api.openai.com/v1'
  };
  const getEnv = (k) => sys.env.get(`openai.${k}`);

  // No task-specific prompts baked in; workflows provide prompts.

  function configure(opts) {
    if (!opts || typeof opts !== 'object') return;
    if (opts.apiKey) cfg.apiKey = opts.apiKey;
    if (opts.model) cfg.model = opts.model;
    if (opts.baseUrl) cfg.baseUrl = opts.baseUrl.replace(/\/$/, '');
  }

  function pickApiKey(local) {
    return (local && local.apiKey) || cfg.apiKey || getEnv('apiKey') || null;
  }

  async function chat({ apiKey, model, messages, system, user, response_format, baseUrl, temperature, debug }) {
    const dbg = !!(debug || getEnv('debug', 'openaiDebug'));
    try {
      const key = pickApiKey({ apiKey });
      if (!key) throw new Error('openai: missing apiKey (call openai.configure or pass { apiKey })');
      const finalMessages = [];
      if (Array.isArray(messages) && messages.length) {
        for (const entry of messages) {
          if (!entry || typeof entry !== 'object') continue;
          const role = entry.role || entry.Role || entry.type;
          if (!role) continue;
          let content = entry.content;
          if (Array.isArray(content)) {
            content = content.map((chunk) => (typeof chunk === 'string' ? chunk : (chunk && chunk.content) || '')).join('\n');
          } else if (typeof content !== 'string') {
            content = content == null ? '' : String(content);
          }
          finalMessages.push({ role, content });
        }
      }
      if (!finalMessages.length) {
        if (system) finalMessages.push({ role: 'system', content: system });
        finalMessages.push({ role: 'user', content: user || '' });
      }
      if (!finalMessages.length) throw new Error('openai.chat: no messages to send');
      const url = ((baseUrl || cfg.baseUrl || 'https://api.openai.com/v1') + '/chat/completions')
        .replace(/\/+$/, '')
        .replace(/(?<!:)\/+/g, '/');
      const body = {
        model: model || cfg.model,
        messages: finalMessages
      };
      if (response_format) body.response_format = response_format;
      if (typeof temperature === 'number') body.temperature = temperature;
      const r = await httpx.json({
        url,
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
        bodyObj: body,
        debug: dbg
      });
      const raw = (r && (r.raw || '')) || '';
      const json = j.parseSafe(raw);
      if (!json || !json.choices || !json.choices.length) throw new Error('openai.chat: bad response');
      return json;
    } catch (e) {
      if (dbg) log.error('chat:fatal', (e && (e.message || e)) || 'unknown');
      throw e;
    }
  }

  async function chatStream({ apiKey, model, messages, system, user, response_format, baseUrl, temperature, onToken, onDone, debug }) {
    const dbg = !!(debug || getEnv('debug', 'openaiDebug'));
    const key = pickApiKey({ apiKey });
    if (!key) throw new Error('openai: missing apiKey (call openai.configure or pass { apiKey })');
    const finalMessages = [];
    if (Array.isArray(messages) && messages.length) {
      for (const entry of messages) {
        if (!entry || typeof entry !== 'object') continue;
        const role = entry.role || entry.Role || entry.type;
        if (!role) continue;
        let content = entry.content;
        if (Array.isArray(content)) {
          content = content.map((chunk) => (typeof chunk === 'string' ? chunk : (chunk && chunk.content) || '')).join('\n');
        } else if (typeof content !== 'string') {
          content = content == null ? '' : String(content);
        }
        finalMessages.push({ role, content });
      }
    }
    if (!finalMessages.length) {
      if (system) finalMessages.push({ role: 'system', content: system });
      finalMessages.push({ role: 'user', content: user || '' });
    }
    if (!finalMessages.length) throw new Error('openai.chatStream: no messages to send');
    const url = ((baseUrl || cfg.baseUrl || 'https://api.openai.com/v1') + '/chat/completions')
      .replace(/\/+$/, '')
      .replace(/(?<!:)\/+/g, '/');
    const body = {
      model: model || cfg.model,
      messages: finalMessages,
      stream: true
    };
    if (response_format) body.response_format = response_format;
    if (typeof temperature === 'number') body.temperature = temperature;
    let buffer = '';
    let text = '';
    let done = false;
    const handleChunk = (chunk) => {
      if (typeof chunk !== 'string' || !chunk) return;
      buffer += chunk;
      while (true) {
        const idx = buffer.indexOf('\n');
        if (idx < 0) break;
        let line = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 1);
        line = line.trim();
        if (!line) continue;
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (!payload) continue;
        if (payload === '[DONE]') { done = true; return; }
        let data;
        try { data = JSON.parse(payload); } catch { data = null; }
        if (!data || !data.choices || !data.choices.length) continue;
        const delta = data.choices[0] && data.choices[0].delta && data.choices[0].delta.content;
        if (typeof delta === 'string' && delta.length) {
          text += delta;
          if (typeof onToken === 'function') onToken(delta);
        }
      }
    };
    if (dbg) log.debug('chatStream:fetch', { url, model: body.model, msgs: body.messages.length });
    await httpx.stream({
      url,
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      debug: dbg,
      retry: false
    }, handleChunk);
    if (!done && buffer) handleChunk('\n');
    if (typeof onDone === 'function') onDone(text);
    return { text };
  }

  async function chatJSON({ apiKey, model, system, user, baseUrl, temperature, debug }) {
    const dbg = !!(debug || getEnv('debug', 'openaiDebug'));
    const startedAll = Date.now();
    try {
      if (dbg) log.debug('chatJSON:start');
      const key = pickApiKey({ apiKey });
      if (!key) {
        if (dbg) console.error('openai.chatJSON[config]: missing apiKey');
        throw new Error('openai: missing apiKey (call openai.configure or pass { apiKey })');
      }
      const url = ((baseUrl || cfg.baseUrl || 'https://api.openai.com/v1') + '/chat/completions')
        .replace(/\/+$/, '')
        .replace(/(?<!:)\/+/g, '/');
      const body = {
        model: model || cfg.model,
        messages: [
          system ? { role: 'system', content: system } : null,
          { role: 'user', content: user || '' }
        ].filter(Boolean),
        response_format: { type: 'json_object' },
        temperature: typeof temperature === 'number' ? temperature : 0
      };
      if (dbg) log.debug('chatJSON:build', { url, model: body.model, msgs: body.messages.length, userLen: (user||'').length });
      // Serialize request
      let payload;
      try {
        payload = JSON.stringify(body);
      } catch (serr) {
        if (dbg) log.error('chatJSON:serialize', (serr && (serr.message || serr)) || 'unknown');
        throw serr;
      }
      // HTTP call
      const startedFetch = Date.now();
      let raw, status;
      try {
        if (dbg) log.debug('chatJSON:fetch', { method: 'POST', url });
        const r = await httpx.json({ url, method: 'POST', headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' }, bodyObj: body, debug: dbg });
        raw = (r && (r.raw || ''));
        status = r && r.status;
      } catch (ferr) {
        if (dbg) log.error('chatJSON:fetch:error', (ferr && (ferr.message || ferr)) || 'unknown');
        throw ferr;
      }
      const elapsedFetch = Date.now() - startedFetch;
      if (dbg) log.debug('chatJSON:fetch:done', { status: (status||'unknown'), ms: elapsedFetch, bytes: (typeof raw === 'string') ? raw.length : 0 });
      // Parse HTTP JSON
      let json;
      try {
        json = j.parseSafe(raw);
      } catch (jerr) {
        if (dbg) log.error('chatJSON:parse:http', (typeof raw === 'string') ? raw.slice(0, 400) : '');
        throw jerr;
      }
      if (!json || !json.choices || !json.choices.length) {
        if (dbg) log.error('chatJSON:validate', 'missing choices');
        throw new Error('openai: bad response');
      }
      // Extract content
      let content = json.choices[0] && json.choices[0].message && json.choices[0].message.content;
      if (typeof content !== 'string') content = '';
      const contentBefore = content.length;
      content = content.trim().replace(/^```(json)?\s*/i, '').replace(/\s*```\s*$/, '');
      if (dbg) log.debug('chatJSON:content', { lenBefore: contentBefore, lenAfter: content.length });
      // Parse model JSON
      let parsed;
      try {
        parsed = j.tryParse(content);
      } catch (perr) {
        if (dbg) log.error('chatJSON:parse:model', content.slice(0, 400));
        parsed = undefined;
      }
      if (dbg) { const usage = json.usage || {}; log.debug('chatJSON:done', { parsedOk: !!parsed, promptTokens: usage.prompt_tokens||0, completionTokens: usage.completion_tokens||0, totalMs: (Date.now()-startedAll) }); }
      return { raw: json, data: parsed };
    } catch (e) {
      // Final catch to ensure crash points are logged when debug on
      if (dbg) log.error('chatJSON:fatal', (e && (e.message || e)) || 'unknown');
      throw e;
    }
  }

  module.exports = {
    configure,
    chat,
    chatStream,
    chatJSON
  };
})();
