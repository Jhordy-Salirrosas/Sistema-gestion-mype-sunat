export class SerieCorrelativoVo {
  public readonly serie: string;
  public readonly correlativo: number;

  constructor(serie: string, correlativo: number) {
    if (!/^[FB][0-9A-Z]{3}$/.test(serie)) {
      throw new Error(`La serie ${serie} no cumple con el formato oficial SUNAT (F### o B###)`);
    }
    if (!Number.isInteger(correlativo) || correlativo < 1 || correlativo > 99999999) {
      throw new Error(`El correlativo ${correlativo} debe ser un número entero entre 1 y 99999999`);
    }
    this.serie = serie;
    this.correlativo = correlativo;
  }

  get formatted(): string {
    return `${this.serie}-${String(this.correlativo).padStart(8, '0')}`;
  }
}
