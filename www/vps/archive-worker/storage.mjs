import { openAsBlob } from 'node:fs';
import { UTApi } from 'uploadthing/server';

export function uploadThingStorage(token, fetchImpl = globalThis.fetch) {
  if (!token) throw new Error('UPLOADTHING_TOKEN is required');
  const api = new UTApi({ token, logLevel: 'Error', fetch: (url, options) => fetchImpl(url, { ...options, signal: AbortSignal.any([AbortSignal.timeout(10 * 60 * 1000), ...(options?.signal ? [options.signal] : [])]) }) });
  return {
    async upload(file) {
      const blob = await openAsBlob(file.path, { type: 'application/zip' });
      const result = await api.uploadFiles(new File([blob], file.filename, { type: 'application/zip' }), {
        contentDisposition: 'attachment', acl: 'public-read',
      });
      if (result.error || !result.data) throw new Error('UploadThing upload failed; check account limits and ACL settings');
      if (!result.data.ufsUrl?.startsWith('https://')) throw new Error('UploadThing returned an invalid public URL');
      return { key: result.data.key, url: result.data.ufsUrl };
    },
    async remove(keys) {
      if (!keys.length) return;
      const result = await api.deleteFiles(keys);
      if (!result.success) throw new Error('UploadThing cleanup failed');
    },
  };
}
