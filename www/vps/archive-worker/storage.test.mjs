import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { uploadThingStorage } from './storage.mjs';

test('UploadThing SDK publishes a disk-backed file as a public attachment and deletes by key', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'upload-test-'));
  try {
    const filePath = path.join(directory, 'test.zip');
    await writeFile(filePath, 'archive bytes');
    const requests = [];
    const token = Buffer.from(JSON.stringify({ apiKey: 'sk_test_only', appId: 'testapp', regions: ['fra1'] })).toString('base64');
    const storage = uploadThingStorage(token, async (input, options) => {
      const url = new URL(input instanceof Request ? input.url : input);
      requests.push({ url, options });
      if (options.method === 'PUT') {
        assert.equal(url.searchParams.get('x-ut-acl'), 'public-read');
        assert.equal(url.searchParams.get('x-ut-content-disposition'), 'attachment');
        assert.equal(url.searchParams.get('x-ut-file-name'), 'test.zip');
        assert.equal(await options.body.get('file').text(), 'archive bytes');
        return Response.json({ ufsUrl: 'https://testapp.ufs.sh/f/test', url: 'https://testapp.ufs.sh/f/test', appUrl: 'https://testapp.ufs.sh/f/test', fileHash: 'test' });
      }
      assert.equal(url.pathname, '/v6/deleteFiles');
      return Response.json({ success: true, deletedCount: 1 });
    });
    const uploaded = await storage.upload({ path: filePath, filename: 'test.zip' });
    assert.equal(uploaded.url, 'https://testapp.ufs.sh/f/test');
    assert.ok(uploaded.key);
    await storage.remove([uploaded.key]);
    assert.equal(requests.length, 2);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
