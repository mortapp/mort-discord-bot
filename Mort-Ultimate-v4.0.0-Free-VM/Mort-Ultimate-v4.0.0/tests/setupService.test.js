const test = require('node:test');
const assert = require('node:assert/strict');
const { applyOverwrites } = require('../src/services/setupService');

test('permission refresh preserves custom overwrites outside Mort blueprint roles', async () => {
  let submitted = null;
  const target = {
    permissionOverwrites: {
      cache: [
        { id: 'custom-member', allow: {}, deny: {} },
        { id: 'mort-member', allow: {}, deny: {} }
      ],
      set: async (overwrites) => { submitted = overwrites; }
    }
  };
  const mortOverwrites = [{ id: 'mort-member', allow: ['send'], deny: [] }, { id: 'everyone', allow: [], deny: ['view'] }];
  await applyOverwrites(target, mortOverwrites);
  assert.deepEqual(submitted.map((overwrite) => overwrite.id), ['custom-member', 'mort-member', 'everyone']);
});
