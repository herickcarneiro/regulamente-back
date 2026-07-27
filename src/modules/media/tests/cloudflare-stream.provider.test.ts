import { describe, expect, it } from 'bun:test';
import {
  CloudflareStreamPlaybackProvider,
  UnavailableMediaPlaybackProvider,
} from '../infrastructure/providers/cloudflare-stream-playback.provider';
import {
  CloudflareStreamUploadProvider,
  UnavailableMediaUploadProvider,
} from '../infrastructure/providers/cloudflare-stream-upload.provider';

describe('CloudflareStreamUploadProvider', () => {
    it('maps direct upload and sends expiry + maxDurationSeconds', async () => {
    let capturedBody: unknown;
    const provider = new CloudflareStreamUploadProvider({
      accountId: 'acct',
      apiToken: 'token',
      fetchImpl: (async (_url: string | URL | Request, init?: RequestInit) => {
        capturedBody = JSON.parse(String(init?.body));
        return new Response(
          JSON.stringify({
            success: true,
            result: {
              uploadURL: 'https://upload.cloudflarestream.com/once',
              uid: 'uid-1',
            },
          }),
          { status: 200 },
        );
      }) as unknown as typeof fetch,
    });

    const expiresAt = new Date('2026-07-27T15:15:00.000Z');
    const result = await provider.createDirectVideoUpload({
      title: 'Clip',
      originalFileName: 'clip.mp4',
      maxDurationSeconds: 900,
      uploadUrlExpiresAt: expiresAt,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual({
      uploadUrl: 'https://upload.cloudflarestream.com/once',
      providerRef: 'uid-1',
    });
    expect(capturedBody).toMatchObject({
      maxDurationSeconds: 900,
      expiry: '2026-07-27T15:15:00.000Z',
    });
  });

  it('maps stream ready state and duration', async () => {
    const provider = new CloudflareStreamUploadProvider({
      accountId: 'acct',
      apiToken: 'token',
      fetchImpl: (async () =>
        new Response(
          JSON.stringify({
            success: true,
            result: {
              duration: 12.4,
              status: { state: 'ready' },
            },
          }),
          { status: 200 },
        )) as unknown as typeof fetch,
    });

    const result = await provider.getVideoStatus('uid-1');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual({
      status: 'ready',
      durationSeconds: 12,
    });
  });

  it('UnavailableMediaUploadProvider fails create', async () => {
    const provider = new UnavailableMediaUploadProvider();
    const result = await provider.createDirectVideoUpload({
      title: 'x',
      originalFileName: 'x.mp4',
      maxDurationSeconds: 900,
      uploadUrlExpiresAt: new Date('2026-07-27T15:15:00.000Z'),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('MEDIA_PROVIDER_UNAVAILABLE');
  });

  it('passes AbortSignal on create and status requests', async () => {
    const signals: AbortSignal[] = [];
    const provider = new CloudflareStreamUploadProvider({
      accountId: 'acct',
      apiToken: 'token',
      timeoutMs: 5_000,
      fetchImpl: (async (
        _url: string | URL | Request,
        init?: RequestInit,
      ) => {
        if (!init?.signal) {
          throw new Error('missing signal');
        }
        signals.push(init.signal);
        return new Response(
          JSON.stringify({
            success: true,
            result: {
              uploadURL: 'https://upload.example/once',
              uid: 'uid-1',
              duration: 1,
              status: { state: 'ready' },
            },
          }),
          { status: 200 },
        );
      }) as unknown as typeof fetch,
    });

    await provider.createDirectVideoUpload({
      title: 'Clip',
      originalFileName: 'clip.mp4',
      maxDurationSeconds: 900,
      uploadUrlExpiresAt: new Date('2026-07-27T15:15:00.000Z'),
    });
    await provider.getVideoStatus('uid-1');

    expect(signals).toHaveLength(2);
    expect(signals[0]).toBeInstanceOf(AbortSignal);
    expect(signals[1]).toBeInstanceOf(AbortSignal);
  });

  it('maps create timeout to MEDIA_PROVIDER_UNAVAILABLE', async () => {
    const provider = new CloudflareStreamUploadProvider({
      accountId: 'acct',
      apiToken: 'token',
      timeoutMs: 15,
      fetchImpl: ((_url: string | URL | Request, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('The operation was aborted.', 'AbortError'));
          });
        })) as unknown as typeof fetch,
    });

    const result = await provider.createDirectVideoUpload({
      title: 'Clip',
      originalFileName: 'clip.mp4',
      maxDurationSeconds: 900,
      uploadUrlExpiresAt: new Date('2026-07-27T15:15:00.000Z'),
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('MEDIA_PROVIDER_UNAVAILABLE');
  });

  it('maps status timeout to MEDIA_PROVIDER_UNAVAILABLE', async () => {
    const provider = new CloudflareStreamUploadProvider({
      accountId: 'acct',
      apiToken: 'token',
      timeoutMs: 15,
      fetchImpl: ((_url: string | URL | Request, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('The operation was aborted.', 'AbortError'));
          });
        })) as unknown as typeof fetch,
    });

    const result = await provider.getVideoStatus('uid-1');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('MEDIA_PROVIDER_UNAVAILABLE');
  });
});

describe('CloudflareStreamPlaybackProvider', () => {
  it('creates signed iframe URL with customer code and exp', async () => {
    let capturedUrl = '';
    let capturedBody: unknown;
    const provider = new CloudflareStreamPlaybackProvider({
      accountId: 'acct',
      apiToken: 'token',
      customerCode: 'abc123',
      fetchImpl: (async (url: string | URL | Request, init?: RequestInit) => {
        capturedUrl = String(url);
        capturedBody = JSON.parse(String(init?.body));
        return new Response(
          JSON.stringify({
            success: true,
            result: { token: 'signed-jwt-token' },
          }),
          { status: 200 },
        );
      }) as unknown as typeof fetch,
    });

    const expiresAt = new Date('2026-07-27T15:15:00.000Z');
    const result = await provider.createSignedPlayback({
      providerRef: 'uid-1',
      expiresAt,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.playbackUrl).toBe(
      'https://customer-abc123.cloudflarestream.com/signed-jwt-token/iframe',
    );
    expect(result.value.expiresAt).toEqual(expiresAt);
    expect(capturedUrl).toContain('/stream/uid-1/token');
    expect(capturedBody).toEqual({ exp: Math.floor(expiresAt.getTime() / 1000) });
  });

  it('UnavailableMediaPlaybackProvider fails create', async () => {
    const provider = new UnavailableMediaPlaybackProvider();
    const result = await provider.createSignedPlayback({
      providerRef: 'uid-1',
      expiresAt: new Date('2026-07-27T15:15:00.000Z'),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('MEDIA_PROVIDER_UNAVAILABLE');
  });
});
