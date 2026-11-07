export const SOL_CREDENTIAL_CIPHER = Symbol('SOL_CREDENTIAL_CIPHER');

export interface SolCredentialCipherPort {
  encrypt(plainText: string): string;
  decrypt(cipherText: string): string;
}
