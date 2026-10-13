export const HASHER_PORT = Symbol('HASHER_PORT');

export interface HasherPort {
  hash(plainText: string): Promise<string>;
  compare(plainText: string, hashed: string): Promise<boolean>;
}
