const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

async function runCase({ hash = '', search = '', draft = null, session = null, sessionError = null }) {
  const effects = [], redirects = [], calls = [], messages = [];
  const auth = {
    getSession: async () => ({ data: { session }, error: sessionError }),
    setSession: async (tokens) => { calls.push(['tokens', tokens]); return { data: { session }, error: sessionError }; },
    exchangeCodeForSession: async (code) => { calls.push(['code', code]); return { data: { session }, error: sessionError }; },
  };
  const requireMock = (name) => {
    if (name === 'react') return { useEffect: (effect) => effects.push(effect), useState: () => ['', value => messages.push(value)] };
    if (name === 'react/jsx-runtime') return { jsx: () => null, jsxs: () => null };
    if (name === 'react-native') return { StyleSheet: { create: v => v } };
    if (name === 'expo-router') return { useRouter: () => ({ replace: route => redirects.push(route) }) };
    if (name === '@/lib/supabase') return { supabase: { auth } };
    if (name === '@/lib/ticketPurchase') return { readTicketDraft: async () => draft };
    throw new Error('Unexpected import ' + name);
  };
  const source = fs.readFileSync('src/app/auth-callback.tsx', 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, require: requireMock, URLSearchParams, window: { location: { hash, search }, history: { replaceState() {} } } });
  exports.default();
  effects[0]();
  for (let i = 0; i < 8; i++) await new Promise(resolve => setImmediate(resolve));
  return { redirects: JSON.parse(JSON.stringify(redirects)), calls: JSON.parse(JSON.stringify(calls)), messages };
}

(async () => {
  const session = { user: { id: 'isolated-fixture' } };
  const draft = { productId: 'isolated-pass' };
  let r = await runCase({ hash: '#access_token=fixture-access&refresh_token=fixture-refresh', draft, session });
  assert.equal(r.calls[0][0], 'tokens');
  assert.deepEqual(r.redirects, ['/recover-tickets']);
  r = await runCase({ search: '?code=fixture-code', draft, session });
  assert.equal(r.calls[0][0], 'code');
  assert.equal(r.redirects[0], '/recover-tickets');
  r = await runCase({ draft, session });
  assert.equal(r.redirects[0], '/recover-tickets');
  r = await runCase({ session });
  assert.deepEqual(r.redirects, ['/recover-tickets']);
  r = await runCase({ draft });
  assert.equal(r.redirects.length, 0);
  r = await runCase({ hash: '#error=access_denied', draft, session });
  assert.equal(r.redirects.length, 0);
  console.log('6 isolated callback cases passed; no account or payment created.');
})().catch(error => { console.error(error); process.exit(1); });
