import { Injectable, inject, signal } from '@angular/core';
import { ApiClient } from '@trefaro/shared-http';
import type { AdminAccount } from '@trefaro/shared-models';
import { firstValueFrom } from 'rxjs';

/** Administrator accounts, as the organizer client sees them (FR 1.2). */
@Injectable({ providedIn: 'root' })
export class AdminAccountsService {
  private readonly api = inject(ApiClient);
  private readonly state = signal<readonly AdminAccount[]>([]);
  private readonly loading = signal(false);

  readonly accounts = this.state.asReadonly();
  readonly isLoading = this.loading.asReadonly();

  async reload(): Promise<void> {
    this.loading.set(true);
    try {
      this.state.set(
        await firstValueFrom(this.api.get<AdminAccount[]>('admin/admins')),
      );
    } finally {
      this.loading.set(false);
    }
  }

  async create(input: {
    email: string;
    name: string;
    password: string;
  }): Promise<void> {
    await firstValueFrom(this.api.post<AdminAccount>('admin/admins', input));
    await this.reload();
  }

  async remove(id: string): Promise<void> {
    await firstValueFrom(this.api.delete<void>(`admin/admins/${id}`));
    await this.reload();
  }
}
