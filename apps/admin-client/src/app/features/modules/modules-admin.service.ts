import { Injectable, inject } from '@angular/core';
import { ApiClient } from '@trefaro/shared-http';
import type { ModuleSummary } from '@trefaro/shared-models';
import { firstValueFrom } from 'rxjs';

/**
 * Module and plug-in administration, from the client side (FR 1.5).
 *
 * Reads from `/api/admin/modules` rather than from the cached `/api/config`, for
 * the same reason the design page reads its own endpoint: the public payload
 * carries the *enabled* modules, and a page whose job is switching the disabled
 * ones on cannot be built from it.
 *
 * Stateless. The page re-reads the list after every write, and asks
 * `AppConfigService` to re-read as well — the flag it just wrote also decides
 * what this client itself offers.
 */
@Injectable({ providedIn: 'root' })
export class ModulesAdminService {
  private readonly api = inject(ApiClient);

  list(): Promise<readonly ModuleSummary[]> {
    return firstValueFrom(this.api.get<ModuleSummary[]>('admin/modules'));
  }

  /**
   * Switches one module on or off.
   *
   * The key goes into the path, so it is encoded: every key this instance ships
   * is URL-safe, and a page that only ever sends keys it was given cannot send
   * anything else — but the encoding is what makes that a property of the code
   * rather than of the data.
   */
  setEnabled(moduleKey: string, enabled: boolean): Promise<ModuleSummary> {
    return firstValueFrom(
      this.api.patch<ModuleSummary>(
        `admin/modules/${encodeURIComponent(moduleKey)}`,
        { enabled },
      ),
    );
  }
}
