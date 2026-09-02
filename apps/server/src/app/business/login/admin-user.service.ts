import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
} from '@nestjs/common';
import type { TrefaroEnv } from '../../core/config/env';
import { ENV } from '../../core/config/env.module';
import { PasswordHasher } from '../common/password-hasher.service';
import {
  describePasswordPolicy,
  isUsablePassword,
} from '../common/password-policy';
import {
  ADMIN_USER_REPOSITORY,
  AdminEmailTakenError,
  type AdminUserRecord,
  type AdminUserRepository,
} from './ports/admin-user.repository';

/** Name given to the account created from the environment (F22). */
const BOOTSTRAP_ADMIN_NAME = 'Administrator';

/** An administrator without their password hash — safe to hand to a client. */
export interface AdminSummary {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly createdAt: Date;
  readonly lastLoginAt: Date | null;
}

export function toAdminSummary(admin: AdminUserRecord): AdminSummary {
  return {
    id: admin.id,
    email: admin.email,
    name: admin.name,
    createdAt: admin.createdAt,
    lastLoginAt: admin.lastLoginAt,
  };
}

/**
 * Administrator accounts (FR 1.2) and the credential check behind UC 01.
 *
 * Deleting one's own account is refused, which also makes the dangerous case
 * unreachable: an instance can never end up with zero administrators, because
 * removing the last one would always be a self-deletion.
 */
@Injectable()
export class AdminUserService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AdminUserService.name);

  constructor(
    @Inject(ADMIN_USER_REPOSITORY)
    private readonly admins: AdminUserRepository,
    @Inject(ENV) private readonly env: TrefaroEnv,
    private readonly hasher: PasswordHasher,
  ) {}

  /** Runs after the migrations, so writing the first account is safe here. */
  async onApplicationBootstrap(): Promise<void> {
    await this.ensureBootstrapAdmin();
  }

  /**
   * Verifies credentials, or returns `null`.
   *
   * Never says *why* it failed: distinguishing "no such address" from "wrong
   * password" would turn the login form into a way of testing whether someone
   * works for the organization.
   */
  async authenticate(
    email: string,
    password: string,
  ): Promise<AdminUserRecord | null> {
    const admin = await this.admins.findByEmail(email);

    if (!admin) {
      // Same cost as a real check, so the response time says nothing.
      await this.hasher.equalizeTiming(password);
      return null;
    }

    if (!(await this.hasher.verify(admin.passwordHash, password))) {
      return null;
    }

    await this.admins.recordLogin(admin.id, new Date());
    return admin;
  }

  /**
   * Whether this instance has anybody who can log in.
   *
   * The one condition under which the first-run setup exists (E28), asked on
   * every call to it rather than remembered: the answer changes exactly once,
   * and a cached "no" would leave the route open after the first account was
   * created. A `COUNT` on a table with a handful of rows is not worth a cache.
   */
  async hasAny(): Promise<boolean> {
    return (await this.admins.count()) > 0;
  }

  async list(): Promise<readonly AdminSummary[]> {
    const admins = await this.admins.findAll();
    return admins.map(toAdminSummary);
  }

  async create(input: {
    email: string;
    name: string;
    password: string;
  }): Promise<AdminSummary> {
    if (!isUsablePassword(input.password)) {
      throw new ConflictException(describePasswordPolicy());
    }

    try {
      const created = await this.admins.create({
        email: input.email,
        name: input.name,
        passwordHash: await this.hasher.hash(input.password),
      });
      this.logger.log(`Created administrator ${created.email}`);
      return toAdminSummary(created);
    } catch (error: unknown) {
      if (error instanceof AdminEmailTakenError) {
        throw new ConflictException(error.message);
      }
      throw error;
    }
  }

  /** Deleting an account also ends its sessions — the foreign key cascades. */
  async delete(id: string, actingAdminId: string): Promise<void> {
    if (id === actingAdminId) {
      throw new ConflictException(
        'An administrator cannot delete their own account — ask a colleague to do it',
      );
    }

    if (!(await this.admins.delete(id))) {
      throw new NotFoundException(`No administrator with id "${id}"`);
    }

    this.logger.log(`Deleted administrator ${id}`);
  }

  private async ensureBootstrapAdmin(): Promise<void> {
    const configured = this.env.adminAuth.bootstrap;
    if (!configured) return;

    if ((await this.admins.count()) > 0) {
      this.logger.log(
        'ADMIN_BOOTSTRAP_EMAIL is set but administrators already exist — ignoring it',
      );
      return;
    }

    if (!isUsablePassword(configured.password)) {
      // Fail the start rather than create an account nobody can defend.
      throw new Error(
        `ADMIN_BOOTSTRAP_PASSWORD is not usable. ${describePasswordPolicy()}`,
      );
    }

    await this.admins.create({
      email: configured.email,
      name: BOOTSTRAP_ADMIN_NAME,
      passwordHash: await this.hasher.hash(configured.password),
    });

    this.logger.warn(
      `Created the first administrator "${configured.email}" from the environment. ` +
        'Log in, create a personal account, and remove ADMIN_BOOTSTRAP_* from the environment.',
    );
  }
}
