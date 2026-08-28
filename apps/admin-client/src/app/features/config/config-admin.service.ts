import { Injectable, inject } from '@angular/core';
import { ApiClient } from '@trefaro/shared-http';
import type {
  AppConfigChange,
  AppConfigSettings,
  BrandingImageKind,
  BrandingImages,
} from '@trefaro/shared-models';
import { BRANDING_IMAGE_PART } from '@trefaro/shared-models';
import { firstValueFrom } from 'rxjs';

/**
 * The whitelabel settings and the two branding images, from the client side
 * (FR 1.4).
 *
 * Reads from `/api/admin/config` rather than from `/api/config`, and the
 * difference matters: the public payload carries the font as an expanded CSS
 * stack, while this one answers with the catalogue *key* — which is what a
 * `<select>` holds and what a `PATCH` sends back. A page that edited the public
 * payload would write `'Inter', system-ui, sans-serif` into a column that only
 * accepts `inter`.
 *
 * Stateless: the cached configuration lives in `AppConfigService`, which the
 * design page asks to re-read after every write (E20 — the *other* client
 * learns of the change on its next start, and nothing here pretends otherwise).
 */
@Injectable({ providedIn: 'root' })
export class ConfigAdminService {
  private readonly api = inject(ApiClient);

  getSettings(): Promise<AppConfigSettings> {
    return firstValueFrom(this.api.get<AppConfigSettings>('admin/config'));
  }

  /** A `PATCH`: only the fields that are sent get written. */
  updateSettings(change: AppConfigChange): Promise<AppConfigSettings> {
    return firstValueFrom(
      this.api.patch<AppConfigSettings>('admin/config', change),
    );
  }

  /**
   * Replaces one of the two images.
   *
   * `FormData` with a single part, whose name is part of the contract
   * (`BRANDING_IMAGE_PART`). The content type is deliberately not set: the
   * browser writes it including the multipart boundary, and a hand-set header
   * loses the boundary — the same reason the registration form goes through
   * `FormData` too.
   *
   * The kind doubles as the path segment, which is why there is no mapping
   * table: the server spells out `logo` and `app-icon` as two routes, and these
   * are those two names.
   */
  uploadImage(kind: BrandingImageKind, file: File): Promise<BrandingImages> {
    const body = new FormData();
    body.append(BRANDING_IMAGE_PART, file, file.name);
    return firstValueFrom(
      this.api.put<BrandingImages>(`admin/config/${kind}`, body),
    );
  }

  removeImage(kind: BrandingImageKind): Promise<BrandingImages> {
    return firstValueFrom(
      this.api.delete<BrandingImages>(`admin/config/${kind}`),
    );
  }
}
