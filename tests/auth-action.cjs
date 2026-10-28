const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

async function verify(search, rejected = false) {
  const state = [], effects = [], redirects = [], calls = [];
  const source = ts.transpileModule(fs.readFileSync('app/auth/action/page.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX }
  }).outputText;
  const module = { exports: {} };
  const context = {
    module, exports: module.exports, URL,
    window: { location: { href: 'https://example.com/conductor/auth/action' + search } },
    console: { error() {} }, setTimeout: fn => { fn(); return 1; },
    require(name) {
      if (name === 'react') return {
        useState(initial) { const index = state.length; state.push(initial); return [initial, value => { state[index] = value; }]; },
        useEffect(fn) { effects.push(fn); }
      };
      if (name === 'react/jsx-runtime') return { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
      if (name === 'firebase/auth') return { applyActionCode: async (_, code) => { calls.push(code); if (rejected) throw Error('expired'); } };
      if (name.endsWith('firebase')) return { auth: {} };
      if (name.endsWith('useAppRouter')) return { useAppRouter: () => ({ replace: path => redirects.push(path) }) };
      return { default: () => null };
    }
  };
  vm.runInNewContext(source, context);
  module.exports.default();
  effects.forEach(fn => fn());
  await new Promise(resolve => setImmediate(resolve));
  return { status: state[0], failed: state[1], success: state[2], redirects, calls };
}

test('missing verification code never reports a verified account', async () => {
  const r = await verify('');
  assert.equal(r.success, false); assert.equal(r.failed, true); assert.equal(r.calls.length, 0); assert.equal(r.redirects.length, 0);
});
test('wrong email action does not apply a verification code', async () => {
  const r = await verify('?mode=resetPassword&oobCode=sample');
  assert.equal(r.success, false); assert.equal(r.failed, true); assert.equal(r.calls.length, 0);
});
test('expired or invalid verification code remains an error', async () => {
  const r = await verify('?mode=verifyEmail&oobCode=sample', true);
  assert.equal(r.success, false); assert.equal(r.failed, true); assert.equal(r.redirects.length, 0);
});
test('only a successfully applied email code reports success and routes to login', async () => {
  const r = await verify('?mode=verifyEmail&oobCode=sample');
  assert.equal(r.success, true); assert.equal(r.failed, false); assert.deepEqual(r.calls, ['sample']); assert.deepEqual(r.redirects, ['/login']);
});
