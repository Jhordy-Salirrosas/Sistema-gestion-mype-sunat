import { IsIn, IsOptional } from 'class-validator';

export class UpdateCostMethodDto {
  @IsIn(['PROMEDIO', 'FIFO'], {
    message: 'Método de costeo inválido. Debe ser PROMEDIO o FIFO.',
  })
  method!: 'PROMEDIO' | 'FIFO';
}

export class RecalculateCostingDto {
  @IsOptional()
  @IsIn(['PROMEDIO', 'FIFO'], {
    message: 'Método de costeo inválido. Debe ser PROMEDIO o FIFO.',
  })
  method?: 'PROMEDIO' | 'FIFO';
}

