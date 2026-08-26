import { ConflictException, NotFoundException } from '@nestjs/common';
import type { TrefaroEnv } from '../../core/config/env';
import { AdminUserService } from './admin-user.service';
import type { PasswordHasher } from './password-hasher.service';
import {
  AdminEmailTakenError,
  type AdminUserRecord,
  type AdminUserRepository,
  type NewAdminUser,
} from './ports/admin-user.repository';

class FakeAdminUserRepository implements AdminUserRepository {
  readonly rows: AdminUserRecord[] = [];
  readonly logins: { id: string; at: Date }[] = [];
  private nextId = 1;

  async count(): Promise<number> {
    return this.rows.length;
  }

  async findAll(): Promise<readonly AdminUserRecord[]> {
    return this.rows;
  }

  async findById(id: string): Promise<AdminUserRecord | null> {
    return this.rows.find((row) => row.id === id) ?? null;
  }

  async findByEmail(email: string): Promise<AdminUserRecord | null> {
    const wanted = email.toLowerCase();
    return this.rows.find((row) => row.email.toLowerCase() === wanted) ?? null;
  }

  async create(user: NewAdminUser): Promise<AdminUserRecord> {
    if (await this.findByEmail(user.email)) {
      throw new AdminEmailTakenError(user.email);
    }
    const created: AdminUserRecord = {
      id: `admin-${this.nextId++}`,
      email: user.email,
      name: user.name,
      passwordHash: user.passwordHash,
      createdAt: new Date('2026-08-26T09:00:00Z'),
      lastLoginAt: null,
    };
    this.rows.push(created);
    return created;
  }

  async delete(id: string): Promise<boolean> {
    const index = this.rows.findIndex((row) => row.id === id);
    if (index < 0) return false;
    this.rows.splice(index, 1);
    return true;
  }

  async recordLogin(id: string, at: Date): Promise<void> {
    this.logins.push({ id, at });
  }
}

describe('AdminUserService', () => {
  let admins: FakeAdminUserRepository;
  let equalized: string[];
  let hasher: PasswordHasher;

  function serviceWith(env: Partial<TrefaroEnv> = {}): AdminUserService {
    return new AdminUserService(
      admins,
      {
        adminAuth: { sessionTtlHours: 12, bootstrap: null },
        ...env,
      } as TrefaroEnv,
      hasher,
    );
  }

  beforeEach(() => {
    admins = new FakeAdminUserRepository();
    equalized = [];
    hasher = {
      hash: (password: string) => Promise.resolve(`hashed:${password}`),
      verify: (passwordHash: string, password: string) =>
        Promise.resolve(passwordHash === `hashed:${password}`),
      equalizeTiming: (password: string) => {
        equalized.push(password);
        return Promise.resolve();
      },
    } as unknown as PasswordHasher;
  });

  describe('authenticate', () => {
    beforeEach(async () => {
      await admins.create({
        email: 'Organizer@example.org',
        name: 'Alex Weber',
        passwordHash: 'hashed:a-long-enough-secret',
      });
    });

    it('accepts the right password regardless of how the address is spelled', async () => {
      const service = serviceWith();

      const admin = await service.authenticate(
        'organizer@EXAMPLE.org',
        'a-long-enough-secret',
      );

      expect(admin?.email).toBe('Organizer@example.org');
      expect(admins.logins).toHaveLength(1);
    });

    it('rejects a wrong password without recording a login', async () => {
      const service = serviceWith();

      await expect(
        service.authenticate('organizer@example.org', 'wrong'),
      ).resolves.toBeNull();
      expect(admins.logins).toHaveLength(0);
    });

    it('spends the same time on an unknown address, so the form cannot be used to find accounts', async () => {
      const service = serviceWith();

      await expect(
        service.authenticate('nobody@example.org', 'whatever'),
      ).resolves.toBeNull();
      expect(equalized).toEqual(['whatever']);
    });
  });

  describe('create', () => {
    it('refuses a password shorter than the policy allows', async () => {
      const service = serviceWith();

      await expect(
        service.create({
          email: 'new@example.org',
          name: 'New',
          password: 'short',
        }),
      ).rejects.toThrow(ConflictException);
      expect(admins.rows).toHaveLength(0);
    });

    it('turns a taken address into a conflict rather than a server error', async () => {
      const service = serviceWith();
      await service.create({
        email: 'new@example.org',
        name: 'New',
        password: 'a-long-enough-secret',
      });

      await expect(
        service.create({
          email: 'NEW@example.org',
          name: 'Someone else',
          password: 'another-long-secret',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('never returns the password hash', async () => {
      const service = serviceWith();

      const created = await service.create({
        email: 'new@example.org',
        name: 'New',
        password: 'a-long-enough-secret',
      });

      expect(created).not.toHaveProperty('passwordHash');
    });
  });

  describe('delete', () => {
    it('refuses deleting your own account, which is what keeps the last administrator alive', async () => {
      const service = serviceWith();
      const created = await service.create({
        email: 'only@example.org',
        name: 'Only',
        password: 'a-long-enough-secret',
      });

      await expect(service.delete(created.id, created.id)).rejects.toThrow(
        ConflictException,
      );
      expect(admins.rows).toHaveLength(1);
    });

    it('deletes a colleague', async () => {
      const service = serviceWith();
      const first = await service.create({
        email: 'first@example.org',
        name: 'First',
        password: 'a-long-enough-secret',
      });
      const second = await service.create({
        email: 'second@example.org',
        name: 'Second',
        password: 'a-long-enough-secret',
      });

      await service.delete(second.id, first.id);

      expect(admins.rows.map((row) => row.id)).toEqual([first.id]);
    });

    it('answers 404 for an account that is already gone', async () => {
      const service = serviceWith();

      await expect(service.delete('admin-99', 'admin-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('bootstrap administrator', () => {
    const bootstrap = {
      email: 'first@example.org',
      password: 'a-long-enough-secret',
    };

    it('creates the first account so a fresh instance can be entered at all', async () => {
      const service = serviceWith({
        adminAuth: { sessionTtlHours: 12, bootstrap },
      });

      await service.onApplicationBootstrap();

      expect(admins.rows).toHaveLength(1);
      expect(admins.rows[0].email).toBe('first@example.org');
    });

    it('keeps its hands off an instance that already has administrators', async () => {
      await admins.create({
        email: 'existing@example.org',
        name: 'Existing',
        passwordHash: 'hashed:x',
      });
      const service = serviceWith({
        adminAuth: { sessionTtlHours: 12, bootstrap },
      });

      await service.onApplicationBootstrap();

      expect(admins.rows).toHaveLength(1);
      expect(admins.rows[0].email).toBe('existing@example.org');
    });

    it('fails the start rather than create an account nobody can defend', async () => {
      const service = serviceWith({
        adminAuth: {
          sessionTtlHours: 12,
          bootstrap: { email: 'first@example.org', password: 'short' },
        },
      });

      await expect(service.onApplicationBootstrap()).rejects.toThrow(
        /ADMIN_BOOTSTRAP_PASSWORD/,
      );
      expect(admins.rows).toHaveLength(0);
    });

    it('does nothing at all when no bootstrap account is configured', async () => {
      const service = serviceWith();

      await service.onApplicationBootstrap();

      expect(admins.rows).toHaveLength(0);
    });
  });
});
