import { ConflictException, NotFoundException } from '@nestjs/common';
import { GetSireProposalUseCase } from '../../../src/modules/sire/application/use-cases/getSireProposalUseCase';
import { ExcludeSireRecordUseCase } from '../../../src/modules/sire/application/use-cases/excludeSireRecordUseCase';
import { RestoreSireRecordUseCase } from '../../../src/modules/sire/application/use-cases/restoreSireRecordUseCase';
import { AcceptSireProposalUseCase } from '../../../src/modules/sire/application/use-cases/acceptSireProposalUseCase';
import { ReplaceSireProposalUseCase } from '../../../src/modules/sire/application/use-cases/replaceSireProposalUseCase';
import { RegisterSirePreliminaryUseCase } from '../../../src/modules/sire/application/use-cases/registerSirePreliminaryUseCase';
import { DeleteSirePreliminaryUseCase } from '../../../src/modules/sire/application/use-cases/deleteSirePreliminaryUseCase';
import { GenerateSireRecordUseCase } from '../../../src/modules/sire/application/use-cases/generateSireRecordUseCase';
import { SireTicketManagerService } from '../../../src/modules/sire/application/sireTicketManagerService';
import { MockSireSunatGateway } from '../../../src/modules/sire/infrastructure/sunat/mockSireSunatGateway';
import { UnsupportedSireSunatGateway } from '../../../src/modules/sire/infrastructure/sunat/unsupportedSireSunatGateway';

const dto = { period: '202611', bookType: 'RCE_COMPRAS' as const };
const proposal = {
  companyId: 'company-a',
  period: '202611',
  bookType: 'RCE' as const,
  carSunat: 'CAR-1',
  emitterRuc: '20123456789',
  documentType: '01',
  series: 'F001',
  correlative: '1',
  issueDate: new Date('2026-11-01'),
  taxableBase: 100,
  igvAmount: 18,
  totalAmount: 118,
};

function dependencies() {
  const repository = {
    getPeriod: jest.fn(),
    saveSunatProposal: jest.fn(),
    getProposal: jest.fn(),
    excludeSunatProposal: jest.fn(),
    restoreProposal: jest.fn(),
    getPeriodProposals: jest.fn().mockResolvedValue([proposal]),
    setPeriodTicket: jest.fn(),
    setPeriodState: jest.fn(),
  };
  const sunat = {
    getProposal: jest.fn().mockResolvedValue([proposal]),
    excludeRecord: jest.fn(),
    restoreRecord: jest.fn(),
    acceptProposal: jest.fn().mockResolvedValue({ ticket: 'T-ACCEPT' }),
    replaceProposal: jest.fn().mockResolvedValue({ ticket: 'T-REPLACE' }),
    registerPreliminary: jest.fn().mockResolvedValue({ ticket: 'T-PRELIM' }),
    deletePreliminary: jest.fn().mockResolvedValue({ ticket: 'T-DELETE' }),
    generateRecord: jest.fn().mockResolvedValue({ ticket: 'T-GENERATE' }),
    getTicketStatus: jest.fn(),
  };
  return { repository, sunat };
}

describe('SIRE lifecycle use cases', () => {
  it('gets and persists a SUNAT proposal', async () => {
    const { repository, sunat } = dependencies();
    const result = await new GetSireProposalUseCase(repository as never, sunat as never).execute(dto, 'company-a');
    expect(result).toEqual({ period: '202611', bookType: 'RCE_COMPRAS', state: 'PROPUESTA', count: 1 });
    expect(repository.saveSunatProposal).toHaveBeenCalledWith('company-a', '202611', 'RCE', [proposal]);
  });

  it('excludes and restores records, rejecting missing or generated periods', async () => {
    const { repository, sunat } = dependencies();
    const exclude = new ExcludeSireRecordUseCase(repository as never, sunat as never);
    const restore = new RestoreSireRecordUseCase(repository as never, sunat as never);
    repository.getProposal.mockResolvedValueOnce(null);
    await expect(exclude.execute('company-a', 'missing', 'user-a')).rejects.toBeInstanceOf(NotFoundException);
    repository.getProposal.mockResolvedValue({ id: 'p-1', origin: 'SUNAT', periodId: 'period', periodState: 'PROPUESTA' });
    expect(await exclude.execute('company-a', 'p-1', 'user-a')).toEqual({ proposalId: 'p-1', excluded: true });
    expect(await restore.execute('company-a', 'p-1')).toEqual({ proposalId: 'p-1', restored: true });
    repository.getProposal.mockResolvedValue({ id: 'p-1', origin: 'SUNAT', periodId: 'period', periodState: 'GENERADO' });
    await expect(exclude.execute('company-a', 'p-1', 'user-a')).rejects.toBeInstanceOf(ConflictException);
    await expect(restore.execute('company-a', 'p-1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('accepts only confirmed proposals', async () => {
    const { repository, sunat } = dependencies();
    const useCase = new AcceptSireProposalUseCase(repository as never, sunat as never);
    await expect(useCase.execute(dto, 'company-a', false)).rejects.toBeInstanceOf(ConflictException);
    expect(await useCase.execute(dto, 'company-a', true)).toEqual({ ticket: 'T-ACCEPT', state: 'PROCESANDO_PRELIMINAR' });
  });

  it('starts replacement and blocks generated periods', async () => {
    const { repository, sunat } = dependencies();
    const useCase = new ReplaceSireProposalUseCase(repository as never, sunat as never);
    repository.getPeriod.mockResolvedValue(null);
    expect(await useCase.execute(dto, 'company-a', Buffer.from('txt'))).toEqual({ ticket: 'T-REPLACE', state: 'PROCESANDO_REEMPLAZO' });
    repository.getPeriod.mockResolvedValue({ id: 'p', state: 'GENERADO', ticket: null, ticketOperation: null });
    await expect(useCase.execute(dto, 'company-a', Buffer.from('txt'))).rejects.toBeInstanceOf(ConflictException);
  });

  it('registers, deletes and generates with state guards', async () => {
    const { repository, sunat } = dependencies();
    const register = new RegisterSirePreliminaryUseCase(repository as never, sunat as never);
    const remove = new DeleteSirePreliminaryUseCase(repository as never, sunat as never);
    const generate = new GenerateSireRecordUseCase(repository as never, sunat as never);
    repository.getPeriod.mockResolvedValue({ id: 'p', state: 'PROPUESTA', ticket: null, ticketOperation: null });
    expect(await register.execute(dto, 'company-a')).toEqual({ ticket: 'T-PRELIM', state: 'PROCESANDO_PRELIMINAR' });
    await expect(register.execute(dto, 'company-a')).resolves.toBeDefined();
    repository.getPeriod.mockResolvedValue({ id: 'p', state: 'CON_PRELIMINAR', ticket: null, ticketOperation: null });
    expect(await remove.execute(dto, 'company-a')).toEqual({ ticket: 'T-DELETE', state: 'PROCESANDO_ELIMINACION' });
    expect(await generate.execute(dto, 'company-a')).toEqual({ ticket: 'T-GENERATE', state: 'PROCESANDO_GENERACION' });
    repository.getPeriod.mockResolvedValue({ id: 'p', state: 'PROPUESTA', ticket: null, ticketOperation: null });
    await expect(remove.execute(dto, 'company-a')).rejects.toBeInstanceOf(ConflictException);
    await expect(generate.execute(dto, 'company-a')).rejects.toBeInstanceOf(ConflictException);
    repository.getPeriod.mockResolvedValue({ id: 'p', state: 'GENERADO', ticket: null, ticketOperation: null });
    await expect(register.execute(dto, 'company-a')).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('SIRE ticket manager and gateways', () => {
  it('maps ticket states to period lifecycle states', async () => {
    const { repository, sunat } = dependencies();
    const manager = new SireTicketManagerService(repository as never, sunat as never);
    expect(await manager.getPeriod('company-a', '202611', 'RCE_COMPRAS')).toBeUndefined();
    repository.getPeriod.mockResolvedValue(null);
    expect(await manager.poll('company-a', '202611', 'RCE_COMPRAS')).toEqual({ status: 'SIN_TICKET' });
    repository.getPeriod.mockResolvedValue({ id: 'p', state: 'PROCESANDO_GENERACION', ticket: 'T-1', ticketOperation: 'GENERACION' });
    sunat.getTicketStatus.mockResolvedValue({ ticket: 'T-1', status: 'PENDIENTE' });
    expect(await manager.poll('company-a', '202611', 'RCE_COMPRAS')).toMatchObject({ status: 'PENDIENTE' });
    sunat.getTicketStatus.mockResolvedValue({ ticket: 'T-1', status: 'ERROR' });
    expect(await manager.poll('company-a', '202611', 'RCE_COMPRAS')).toMatchObject({ status: 'ERROR' });
    sunat.getTicketStatus.mockResolvedValue({ ticket: 'T-1', status: 'TERMINADO' });
    expect(await manager.poll('company-a', '202611', 'RCE_COMPRAS')).toMatchObject({ status: 'TERMINADO', state: 'GENERADO' });
    repository.getPeriod.mockResolvedValue({ id: 'p', state: 'PROCESANDO_PRELIMINAR', ticket: 'T-2', ticketOperation: 'REGISTRO_PRELIMINAR' });
    sunat.getTicketStatus.mockResolvedValue({ ticket: 'T-2', status: 'TERMINADO' });
    expect(await manager.poll('company-a', '202611', 'RCE_COMPRAS')).toMatchObject({ state: 'CON_PRELIMINAR' });
  });

  it('returns mock fixtures and resolves tickets after three seconds', async () => {
    const gateway = new MockSireSunatGateway();
    const now = jest.spyOn(Date, 'now').mockReturnValue(1000);
    expect((await gateway.getProposal('company-a', '202611', 'RCE')).map((item) => item.origin)).toEqual(['SUNAT', 'SUNAT', 'USUARIO']);
    const result = await gateway.generateRecord('company-a', '202611', 'RCE');
    expect(await gateway.getTicketStatus('company-a', result.ticket)).toMatchObject({ status: 'PENDIENTE' });
    now.mockReturnValue(4001);
    expect(await gateway.getTicketStatus('company-a', result.ticket)).toMatchObject({ status: 'TERMINADO' });
    expect(await gateway.getTicketStatus('company-a', 'missing')).toMatchObject({ status: 'ERROR' });
    await gateway.excludeRecord('company-a', 'p');
    await gateway.restoreRecord('company-a', 'p');
    await gateway.deletePreliminary('company-a', '202611', 'RCE');
    await gateway.replaceProposal('company-a', '202611', 'RCE', Buffer.from('txt'));
    await gateway.registerPreliminary('company-a', '202611', 'RCE', []);
    await gateway.acceptProposal('company-a', '202611', 'RCE');
    now.mockRestore();
  });

  it('keeps the production gateway explicitly unavailable', async () => {
    const gateway = new UnsupportedSireSunatGateway();
    const unavailable = (call: () => unknown) =>
      expect(Promise.resolve().then(call)).rejects.toThrow();
    await unavailable(() => gateway.getProposal('c', '202611', 'RCE'));
    await unavailable(() => gateway.excludeRecord('c', 'p'));
    await unavailable(() => gateway.restoreRecord('c', 'p'));
    await unavailable(() => gateway.acceptProposal('c', '202611', 'RCE'));
    await unavailable(() => gateway.replaceProposal('c', '202611', 'RCE', Buffer.from('x')));
    await unavailable(() => gateway.registerPreliminary('c', '202611', 'RCE', []));
    await unavailable(() => gateway.deletePreliminary('c', '202611', 'RCE'));
    await unavailable(() => gateway.generateRecord('c', '202611', 'RCE'));
    await unavailable(() => gateway.getTicketStatus('c', 't'));
  });
});
