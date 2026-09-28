import { createHash } from 'node:crypto';
import type { z } from 'zod';
import { LluError } from './errors.js';
import {
  ConnectionsResponseSchema,
  GraphResponseSchema,
  hostFor,
  LLU_HOSTS,
  LoginResponseSchema,
  LogbookResponseSchema,
  regionOf,
  type ConnectionsResponse,
  type GraphResponse,
  type LluApi,
  type LluSession,
  type LogbookResponse,
} from './types.js';

/**
 * LibreLinkUp istemcisi — resmi olmayan API'ye yapılan TÜM istekler buradan geçer.
 * API değişirse (başlıklar, sürüm, uç noktalar) yalnızca bu modül güncellenir.
 */

export interface LluClientOptions {
  email: string;
  password: string;
  region?: string | null;
  product: string;
  version: string;
  session?: LluSession | null;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
  /** status 920 sonrası yükseltilmiş sürümle başarılı istekte çağrılır (DB'ye yazmak için). */
  onVersionUpgrade?: (version: string, minimumVersion: string) => void | Promise<void>;
  /** oturum/token değiştiğinde çağrılır (şifreli saklamak için). */
  onSession?: (session: LluSession) => void | Promise<void>;
}

const RELOGIN_BEFORE_SEC = 86_400; // bitişten 1 gün önce yeniden giriş
const MAX_REDIRECTS = 2;

export function accountIdFor(userId: string): string {
  return createHash('sha256').update(userId).digest('hex');
}

export class LluClient implements LluApi {
  private host: string;
  private session: LluSession | null;
  private currentVersion: string;
  private versionRetried = false;
  private readonly fetchFn: typeof fetch;

  constructor(private readonly opts: LluClientOptions) {
    this.host = opts.region ? hostFor(opts.region) : LLU_HOSTS.global;
    this.session = opts.session ?? null;
    this.currentVersion = opts.version;
    this.fetchFn = opts.fetchFn ?? fetch;
  }

  get version(): string {
    return this.currentVersion;
  }

  getSession(): LluSession | null {
    return this.session;
  }

  private baseHeaders(): Record<string, string> {
    return {
      accept: 'application/json',
      'accept-encoding': 'gzip',
      'cache-control': 'no-cache',
      connection: 'Keep-Alive',
      'content-type': 'application/json',
      product: this.opts.product,
      version: this.currentVersion,
    };
  }

  private async send(url: string, init: RequestInit): Promise<Response> {
    try {
      return await this.fetchFn(url, {
        ...init,
        signal: AbortSignal.timeout(this.opts.timeoutMs ?? 15_000),
      });
    } catch {
      throw new LluError('LLU_NETWORK', 'LibreLinkUp sunucusuna ulaşılamadı');
    }
  }

  private static async readJson(res: Response): Promise<unknown> {
    try {
      return await res.json();
    } catch {
      const type = (res.headers.get('content-type') ?? '?').split(';')[0];
      throw new LluError(
        'LLU_BAD_RESPONSE',
        `LibreLinkUp yanıtı JSON değil (HTTP ${res.status}, ${type})`,
        {
          httpStatus: res.status,
        },
      );
    }
  }

  /** Yanıtın yapısı (anahtarlar ve türler; değerler değil) — teşhis için. */
  private static shapeOf(json: unknown): string {
    if (!json || typeof json !== 'object') return typeof json;
    return Object.entries(json as Record<string, unknown>)
      .map(([k, v]) => {
        const kind = Array.isArray(v) ? 'array' : v === null ? 'null' : typeof v;
        // iç içe nesnede yalnızca anahtar adları (değerler asla)
        return kind === 'object'
          ? `${k}:{${Object.keys(v as object)
              .slice(0, 8)
              .join('|')}}`
          : `${k}:${kind}`;
      })
      .join(',')
      .slice(0, 160);
  }

  /** Hata zarfındaki mesaj (yalnızca metin; kişisel veri içermez), kısaltılmış. */
  private static errorText(json: unknown): string {
    const err = (json as { error?: { message?: unknown } })?.error?.message;
    return typeof err === 'string' ? err.slice(0, 120) : 'ayrıntı yok';
  }

  private static rateLimited(res: Response): LluError {
    const retryAfter = Number(res.headers.get('retry-after'));
    return new LluError('LLU_RATE_LIMITED', 'LibreLinkUp istek sınırı aşıldı', {
      httpStatus: 429,
      retryAfterSec: Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : undefined,
    });
  }

  /** status 920: minimumVersion varsa bir kez yükseltip tekrar dener; yoksa tipli hata. */
  private handleVersionTooOld(json: unknown): string {
    const min = (json as { data?: { minimumVersion?: unknown } })?.data?.minimumVersion;
    const minimumVersion = typeof min === 'string' ? min : undefined;
    if (!minimumVersion || this.versionRetried) {
      throw new LluError(
        'LLU_VERSION_TOO_OLD',
        `LibreLinkUp istemci sürümü eski (en az ${minimumVersion ?? '?'})`,
        {
          minimumVersion,
          httpStatus: 403,
        },
      );
    }
    this.versionRetried = true;
    this.currentVersion = minimumVersion;
    return minimumVersion;
  }

  private async confirmVersionUpgrade(minimumVersion: string | null): Promise<void> {
    if (minimumVersion) await this.opts.onVersionUpgrade?.(this.currentVersion, minimumVersion);
    this.versionRetried = false;
  }

  async login(): Promise<LluSession> {
    return this.loginInternal(0, null);
  }

  private async loginInternal(redirects: number, upgradedTo: string | null): Promise<LluSession> {
    const res = await this.send(`${this.host}/llu/auth/login`, {
      method: 'POST',
      headers: this.baseHeaders(),
      body: JSON.stringify({ email: this.opts.email, password: this.opts.password }),
    });
    if (res.status === 429) throw LluClient.rateLimited(res);
    const json = await LluClient.readJson(res);
    const parsed = LoginResponseSchema.safeParse(json);
    if (!parsed.success)
      throw new LluError('LLU_BAD_RESPONSE', 'Giriş yanıtı beklenen biçimde değil');
    const { status, data } = parsed.data;

    if (status === 920) {
      const v = this.handleVersionTooOld(json);
      return this.loginInternal(redirects, v);
    }
    if (data?.redirect && data.region) {
      if (redirects >= MAX_REDIRECTS)
        throw new LluError('LLU_BAD_RESPONSE', 'Çok fazla bölge yönlendirmesi');
      this.host = hostFor(data.region);
      return this.loginInternal(redirects + 1, upgradedTo);
    }
    if (status === 2)
      throw new LluError('LLU_BAD_CREDENTIALS', 'LibreLinkUp e-posta veya şifresi hatalı');
    if (status === 4) {
      const step = JSON.stringify(data?.step ?? null).slice(0, 200);
      throw new LluError(
        'LLU_ACTION_REQUIRED',
        'LibreLinkUp hesabında bekleyen onay var (ör. kullanım koşulları); mobil uygulamadan onaylayın',
        { step },
      );
    }
    if (res.status === 401 || res.status === 403) {
      throw new LluError('LLU_HTTP', `LibreLinkUp girişi reddetti (HTTP ${res.status})`, {
        httpStatus: res.status,
      });
    }
    if (status !== 0 || !data?.authTicket || !data.user) {
      throw new LluError('LLU_BAD_RESPONSE', `Beklenmeyen giriş yanıtı (status ${status})`, {
        httpStatus: res.status,
      });
    }
    const session: LluSession = {
      region: regionOf(this.host),
      userId: data.user.id,
      token: data.authTicket.token,
      expires: data.authTicket.expires,
    };
    this.session = session;
    await this.confirmVersionUpgrade(upgradedTo);
    await this.opts.onSession?.(session);
    return session;
  }

  async ensureSession(): Promise<LluSession> {
    const nowSec = Date.now() / 1000;
    if (this.session && this.session.expires - RELOGIN_BEFORE_SEC > nowSec) return this.session;
    return this.login();
  }

  private async authed<S extends z.ZodTypeAny>(path: string, schema: S): Promise<z.infer<S>> {
    return this.authedInternal(path, schema, false, null);
  }

  private async authedInternal<S extends z.ZodTypeAny>(
    path: string,
    schema: S,
    reloggedIn: boolean,
    upgradedTo: string | null,
  ): Promise<z.infer<S>> {
    const session = await this.ensureSession();
    const res = await this.send(`${this.host}${path}`, {
      method: 'GET',
      headers: {
        ...this.baseHeaders(),
        authorization: `Bearer ${session.token}`,
        'account-id': accountIdFor(session.userId),
      },
    });
    if (res.status === 401) {
      if (reloggedIn)
        throw new LluError('LLU_UNAUTHORIZED', 'LibreLinkUp oturumu reddedildi', {
          httpStatus: 401,
        });
      this.session = null;
      await this.login();
      return this.authedInternal(path, schema, true, upgradedTo);
    }
    if (res.status === 429) throw LluClient.rateLimited(res);
    const json = await LluClient.readJson(res);
    if ((json as { status?: unknown })?.status === 920) {
      const v = this.handleVersionTooOld(json);
      return this.authedInternal(path, schema, reloggedIn, v);
    }
    const redirect = (json as { data?: { redirect?: unknown; region?: unknown } })?.data;
    if (redirect?.redirect === true && typeof redirect.region === 'string') {
      // Veri isteğinde bölge yönlendirmesi: doğru bölge sunucusuna geçip yeniden giriş yap.
      if (reloggedIn) throw new LluError('LLU_BAD_RESPONSE', 'Bölge yönlendirmesi döngüsü');
      this.host = hostFor(redirect.region);
      this.session = null;
      await this.login();
      return this.authedInternal(path, schema, true, upgradedTo);
    }
    const apiStatus = (json as { status?: unknown })?.status;
    if (typeof apiStatus === 'number' && apiStatus !== 0) {
      // Hata zarfı (ör. geçersiz/başka ortamda alınmış token): bir kez yeniden giriş yapıp dene.
      if (!reloggedIn) {
        this.session = null;
        await this.login();
        return this.authedInternal(path, schema, true, upgradedTo);
      }
      throw new LluError(
        'LLU_HTTP',
        `LibreLinkUp hata durumu ${apiStatus}: ${LluClient.errorText(json)}`,
        {
          httpStatus: res.status,
        },
      );
    }
    if (!res.ok)
      throw new LluError('LLU_HTTP', `LibreLinkUp HTTP ${res.status}`, { httpStatus: res.status });
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      throw new LluError(
        'LLU_BAD_RESPONSE',
        `LibreLinkUp yanıtı doğrulanamadı: ${parsed.error.issues[0]?.path.join('.') ?? ''} (${LluClient.shapeOf(json)})`,
      );
    }
    await this.confirmVersionUpgrade(upgradedTo);
    const ticket = (parsed.data as { ticket?: { token: string; expires: number } }).ticket;
    if (ticket && this.session && ticket.token !== this.session.token) {
      this.session = { ...this.session, token: ticket.token, expires: ticket.expires };
      await this.opts.onSession?.(this.session);
    }
    return parsed.data;
  }

  connections(): Promise<ConnectionsResponse> {
    return this.authed('/llu/connections', ConnectionsResponseSchema);
  }

  graph(patientId: string): Promise<GraphResponse> {
    return this.authed(
      `/llu/connections/${encodeURIComponent(patientId)}/graph`,
      GraphResponseSchema,
    );
  }

  logbook(patientId: string): Promise<LogbookResponse> {
    return this.authed(
      `/llu/connections/${encodeURIComponent(patientId)}/logbook`,
      LogbookResponseSchema,
    );
  }
}
