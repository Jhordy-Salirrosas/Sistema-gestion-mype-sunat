import { CustomsModule } from '../../../src/modules/customs/customsModule';

describe('CustomsModule', () => {
  it('debe estar definido e inicializarse correctamente', () => {
    const module = new CustomsModule();
    expect(module).toBeDefined();
  });
});
