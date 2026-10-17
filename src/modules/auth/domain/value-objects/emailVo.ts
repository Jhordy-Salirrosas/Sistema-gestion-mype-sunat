export class EmailVo {
  private readonly value: string;
  private static readonly EMAIL_REGEX =
    /^[a-zA-Z0-9_!#$%&'*+/=?`{|}~^.-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

  constructor(email: string) {
    if (!email || typeof email !== 'string') {
      throw new Error('El correo electrónico no puede estar vacío.');
    }

    const trimmed = email.trim().toLowerCase();

    if (
      trimmed.length === 0 ||
      trimmed.length > 150 ||
      trimmed.includes('..') ||
      trimmed.startsWith('.') ||
      trimmed.startsWith('@') ||
      !EmailVo.EMAIL_REGEX.test(trimmed)
    ) {
      throw new Error(`El formato del correo electrónico es inválido: ${email}`);
    }

    this.value = trimmed;
  }

  getValue(): string {
    return this.value;
  }

  equals(other: EmailVo): boolean {
    return this.value === other.getValue();
  }

  toString(): string {
    return this.value;
  }
}
