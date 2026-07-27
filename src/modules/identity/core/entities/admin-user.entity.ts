import type { Role } from '../value-objects/role';

export type AdminUserProps = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export class AdminUser {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly passwordHash: string;
  readonly role: Role;
  readonly active: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  private constructor(props: AdminUserProps) {
    this.id = props.id;
    this.name = props.name;
    this.email = props.email;
    this.passwordHash = props.passwordHash;
    this.role = props.role;
    this.active = props.active;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static restore(props: AdminUserProps): AdminUser {
    return new AdminUser({
      ...props,
      email: props.email.toLowerCase(),
    });
  }

  static normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }
}
