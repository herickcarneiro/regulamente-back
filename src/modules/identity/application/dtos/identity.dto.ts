import type { Role } from '../../core/value-objects/role';

export type LoginRequestDto = {
  email: string;
  password: string;
};

export type SessionDto = {
  id: string;
  name: string;
  email: string;
  role: Role;
};

export type AdminUserDto = {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
};

export type LoginSuccess = {
  session: SessionDto;
  rawToken: string;
  expiresAt: Date;
};
