import { UserEntity } from '../../domain/entities/userEntity';

export interface UserAuthRecord {
  user: UserEntity;
  passwordHash: string;
}

export const USER_REPOSITORY_PORT = Symbol('USER_REPOSITORY_PORT');

export interface UserRepositoryPort {
  findByEmail(email: string): Promise<UserAuthRecord | null>;
  findById(id: string): Promise<UserEntity | null>;
}
