export type Role = 'USER' | 'ADMIN';

/** A user as stored, including the password hash. Never send this over HTTP. */
export type UserRecord = {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  role: Role;
  createdAt: Date;
  updatedAt: Date;
};

/** The only user shape that leaves the API. */
export type PublicUser = Pick<UserRecord, 'id' | 'email' | 'name' | 'role' | 'createdAt'>;

export function toPublicUser(user: UserRecord): PublicUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    createdAt: user.createdAt,
  };
}
