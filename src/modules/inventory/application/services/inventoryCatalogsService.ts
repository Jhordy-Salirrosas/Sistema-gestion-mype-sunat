import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../../database/prismaService';

export const SUNAT_OFFICIAL_UNITS = [
  { code: 'NIU', name: 'UNIDAD (BIENES)', symbol: 'u' },
  { code: 'KGM', name: 'KILOGRAMO', symbol: 'kg' },
  { code: 'LTR', name: 'LITRO', symbol: 'L' },
  { code: 'MTR', name: 'METRO LINEAL', symbol: 'm' },
  { code: 'BX', name: 'CAJA', symbol: 'cja' },
  { code: 'DZN', name: 'DOCENA', symbol: 'doc' },
  { code: 'GRM', name: 'GRAMO', symbol: 'g' },
  { code: 'SET', name: 'JUEGO / CONJUNTO', symbol: 'jgo' },
  { code: 'FDO', name: 'FARDO', symbol: 'fdo' },
  { code: 'BLS', name: 'BOLSA', symbol: 'bls' },
  { code: 'CIL', name: 'CILINDRO', symbol: 'cil' },
  { code: 'BAL', name: 'BALDE', symbol: 'bde' },
  { code: 'BOT', name: 'BOTELLA', symbol: 'bot' },
  { code: 'PK', name: 'PAQUETE', symbol: 'paq' },
  { code: 'ROL', name: 'ROLLO', symbol: 'rol' },
  { code: 'TNE', name: 'TONELADA METRICA', symbol: 't' },
  { code: 'MTK', name: 'METRO CUADRADO', symbol: 'm²' },
  { code: 'MTQ', name: 'METRO CUBICO', symbol: 'm³' },
  { code: 'GLL', name: 'US GALON (3.785 L)', symbol: 'gal' },
  { code: 'ZZ', name: 'SERVICIO / UNIDAD MUTUA', symbol: 'srv' },
];

export const SUNAT_EXISTENCE_TYPES = [
  { code: '01', name: '01 - Mercaderías', description: 'Bienes adquiridos para su venta sin transformación' },
  { code: '02', name: '02 - Productos Terminados', description: 'Bienes fabricados por la empresa listos para venta' },
  { code: '03', name: '03 - Materias Primas', description: 'Insumos que se transformarán en producto terminado' },
  { code: '04', name: '04 - Envases y Embalajes', description: 'Recipientes o empaques para comercialización' },
  { code: '05', name: '05 - Materiales Auxiliares y Suministros', description: 'Materiales complementarios de operación' },
  { code: '99', name: '99 - Otros', description: 'Otros bienes inventariables no clasificados' },
];

@Injectable()
export class InventoryCatalogsService {
  constructor(private readonly prisma: PrismaService) {}

  // -------------------------------------------------------------
  // Unidades de Medida SUNAT (Tabla 6)
  // -------------------------------------------------------------
  async listSunatUnits() {
    const dbUnits = await this.prisma.sunatUnitMeasurement.findMany({
      where: { is_active: true },
      orderBy: { code: 'asc' },
    });

    if (dbUnits.length === 0) {
      for (const u of SUNAT_OFFICIAL_UNITS) {
        await this.prisma.sunatUnitMeasurement.upsert({
          where: { code: u.code },
          update: { name: u.name, symbol: u.symbol },
          create: { code: u.code, name: u.name, symbol: u.symbol },
        }).catch(() => {});
      }

      return this.prisma.sunatUnitMeasurement.findMany({
        where: { is_active: true },
        orderBy: { code: 'asc' },
      });
    }

    return dbUnits;
  }

  // -------------------------------------------------------------
  // Tipos de Existencia SUNAT (Tabla 5)
  // -------------------------------------------------------------
  async listSunatExistenceTypes() {
    return SUNAT_EXISTENCE_TYPES;
  }

  // -------------------------------------------------------------
  // Marcas (inventory_brands)
  // -------------------------------------------------------------
  async listBrands(companyId: string) {
    const brands = await this.prisma.inventoryBrand.findMany({
      where: { company_id: companyId, is_active: true },
      orderBy: { name: 'asc' },
    });

    if (brands.length === 0) {
      // Precargar marcas estándar para no arrancar con lista vacía
      const defaults = [
        { code: 'SOL', name: 'Sol (UNACEM)', description: 'Cementos y aglomerantes nacionales' },
        { code: 'AND', name: 'Andino (UNACEM)', description: 'Cementos puzolánicos' },
        { code: 'YUR', name: 'Yura', description: 'Cementos de alta resistencia' },
        { code: 'AC-ARE', name: 'Aceros Arequipa', description: 'Barras y perfiles de acero corrugado' },
        { code: 'SID', name: 'Siderperú', description: 'Fierro y barras de construcción' },
        { code: 'PAV', name: 'Pavco Wavin', description: 'Tuberías y conexiones PVC' },
        { code: 'TIG', name: 'Tigre Perú', description: 'Sistemas de tuberías y sanitarios' },
        { code: 'BOS', name: 'Bosch', description: 'Herramientas eléctricas y accesorios' },
        { code: 'MAK', name: 'Makita', description: 'Herramientas y maquinaria ligera' },
        { code: 'DEC', name: 'DecorCeramica', description: 'Porcelanatos y acabados importados' },
        { code: 'GEN', name: 'Genérico / Sin Marca', description: 'Productos estándar sin marca comercial' },
      ];

      for (const b of defaults) {
        await this.prisma.inventoryBrand.create({
          data: { company_id: companyId, code: b.code, name: b.name, description: b.description },
        }).catch(() => {});
      }

      return this.prisma.inventoryBrand.findMany({
        where: { company_id: companyId, is_active: true },
        orderBy: { name: 'asc' },
      });
    }

    return brands;
  }

  async createBrand(companyId: string, data: { name: string; code?: string; description?: string }) {
    const name = data.name.trim();
    const code = (data.code || name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10)).toUpperCase();
    
    const existing = await this.prisma.inventoryBrand.findFirst({
      where: { company_id: companyId, OR: [{ name }, { code }] },
    });
    if (existing) {
      throw new ConflictException(`La marca "${name}" o código "${code}" ya existe.`);
    }

    return this.prisma.inventoryBrand.create({
      data: { company_id: companyId, name, code, description: data.description?.trim() || null },
    });
  }

  async updateBrand(
    companyId: string,
    id: string,
    data: { name?: string; code?: string; description?: string; is_active?: boolean },
  ) {
    const brand = await this.prisma.inventoryBrand.findFirst({
      where: { id, company_id: companyId },
    });
    if (!brand) throw new NotFoundException('Marca no encontrada.');

    const name = data.name?.trim();
    const code = data.code ? data.code.trim().toUpperCase() : undefined;

    if (name || code) {
      const conflict = await this.prisma.inventoryBrand.findFirst({
        where: {
          company_id: companyId,
          id: { not: id },
          OR: [
            ...(name ? [{ name }] : []),
            ...(code ? [{ code }] : []),
          ],
        },
      });
      if (conflict) {
        throw new ConflictException('Ya existe otra marca con el mismo nombre o código.');
      }
    }

    return this.prisma.inventoryBrand.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(code && { code }),
        ...(data.description !== undefined && { description: data.description?.trim() || null }),
        ...(data.is_active !== undefined && { is_active: data.is_active }),
      },
    });
  }

  async deleteBrand(companyId: string, id: string) {
    const brand = await this.prisma.inventoryBrand.findFirst({
      where: { id, company_id: companyId },
    });
    if (!brand) throw new NotFoundException('Marca no encontrada.');
    return this.prisma.inventoryBrand.update({
      where: { id },
      data: { is_active: false },
    });
  }

  // -------------------------------------------------------------
  // Modelos (inventory_models)
  // -------------------------------------------------------------
  async listModels(companyId: string) {
    const models = await this.prisma.inventoryModel.findMany({
      where: { company_id: companyId, is_active: true },
      orderBy: { name: 'asc' },
    });

    if (models.length === 0) {
      const defaults = [
        { code: 'MOD-GSB13', name: 'GSB 13 RE (Taladro Percutor 650W)', brand_name: 'Bosch', description: 'Taladro percutor mandril 1/2"' },
        { code: 'MOD-GWS700', name: 'GWS 700 (Amoladora Angular 710W)', brand_name: 'Bosch', description: 'Esmeril angular disco 4-1/2"' },
        { code: 'MOD-HP1640', name: 'HP1640 (Taladro de Impacto 680W)', brand_name: 'Makita', description: 'Taladro de percusión para concreto y metal' },
        { code: 'MOD-GA4530', name: 'GA4530 (Esmeril Angular 720W)', brand_name: 'Makita', description: 'Amoladora cuerpo delgado' },
        { code: 'MOD-GR60', name: 'Grado 60 (Barra Corrugada ASTM A615)', brand_name: 'Aceros Arequipa', description: 'Acero de refuerzo estructural antisísmico' },
        { code: 'MOD-ALM16', name: 'Alambre N° 16 (Recocido)', brand_name: 'Aceros Arequipa', description: 'Alambre negro para amarre de estribos' },
        { code: 'MOD-SID60', name: 'Sider 60 (Fierro Habilitado)', brand_name: 'Siderperú', description: 'Fierro de construcción normalizado' },
        { code: 'MOD-DES4', name: 'Desagüe Serie Blanca 4" x 3m', brand_name: 'Pavco Wavin', description: 'Tubería sanitaria PVC con unión flexible' },
        { code: 'MOD-AGU12', name: 'Agua Fría Clase 10 1/2" x 5m', brand_name: 'Pavco Wavin', description: 'Tubería de presión roscable para agua potable' },
        { code: 'MOD-SAN4', name: 'PVC Sanitario Clase A 4"', brand_name: 'Tigre Perú', description: 'Tubería y conexiones para evacuación' },
        { code: 'MOD-POR60', name: 'Porcelanato 60x60 Pulido Rectificado', brand_name: 'DecorCeramica', description: 'Acabado vitrificado de alta resistencia' },
        { code: 'MOD-T1-425', name: 'Portland Tipo I Bolsa 42.5 kg', brand_name: 'Sol (UNACEM)', description: 'Cemento para obras generales y estructuras' },
      ];

      for (const m of defaults) {
        await this.prisma.inventoryModel.create({
          data: {
            company_id: companyId,
            code: m.code,
            name: m.name,
            brand_name: m.brand_name,
            description: m.description,
          },
        }).catch(() => {});
      }

      return this.prisma.inventoryModel.findMany({
        where: { company_id: companyId, is_active: true },
        orderBy: { name: 'asc' },
      });
    }

    return models;
  }

  async createModel(companyId: string, data: { name: string; code?: string; brand_name?: string; description?: string }) {
    const name = data.name.trim();
    const code = (data.code || name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10)).toUpperCase();

    const existing = await this.prisma.inventoryModel.findFirst({
      where: { company_id: companyId, code },
    });
    if (existing) throw new ConflictException(`El código de modelo "${code}" ya existe.`);

    return this.prisma.inventoryModel.create({
      data: {
        company_id: companyId,
        name,
        code,
        brand_name: data.brand_name?.trim() || null,
        description: data.description?.trim() || null,
      },
    });
  }

  async updateModel(
    companyId: string,
    id: string,
    data: { name?: string; code?: string; brand_name?: string; description?: string; is_active?: boolean },
  ) {
    const model = await this.prisma.inventoryModel.findFirst({
      where: { id, company_id: companyId },
    });
    if (!model) throw new NotFoundException('Modelo no encontrado.');

    const name = data.name?.trim();
    const code = data.code ? data.code.trim().toUpperCase() : undefined;

    if (code) {
      const conflict = await this.prisma.inventoryModel.findFirst({
        where: {
          company_id: companyId,
          id: { not: id },
          code,
        },
      });
      if (conflict) {
        throw new ConflictException(`El código de modelo "${code}" ya está en uso.`);
      }
    }

    return this.prisma.inventoryModel.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(code && { code }),
        ...(data.brand_name !== undefined && { brand_name: data.brand_name?.trim() || null }),
        ...(data.description !== undefined && { description: data.description?.trim() || null }),
        ...(data.is_active !== undefined && { is_active: data.is_active }),
      },
    });
  }

  async deleteModel(companyId: string, id: string) {
    const model = await this.prisma.inventoryModel.findFirst({
      where: { id, company_id: companyId },
    });
    if (!model) throw new NotFoundException('Modelo no encontrado.');
    return this.prisma.inventoryModel.update({
      where: { id },
      data: { is_active: false },
    });
  }

  // -------------------------------------------------------------
  // Categorías (inventory_categories)
  // -------------------------------------------------------------
  async listCategories(companyId: string) {
    const cats = await this.prisma.inventoryCategory.findMany({
      where: { company_id: companyId, is_active: true },
      orderBy: { name: 'asc' },
    });

    if (cats.length === 0) {
      const defaults = [
        { code: 'CEM', name: 'Cementos y Aglomerantes', sunat_code: '30111600' },
        { code: 'ACE', name: 'Aceros y Metales', sunat_code: '30102400' },
        { code: 'TUB', name: 'Tuberías y Conexiones', sunat_code: '40171500' },
        { code: 'GRI', name: 'Griferías y Sanitarios', sunat_code: '30181500' },
        { code: 'ACA', name: 'Pisos y Acabados', sunat_code: '30161700' },
        { code: 'HER', name: 'Herramientas Eléctricas y Manuales', sunat_code: '27110000' },
        { code: 'PIN', name: 'Pinturas e Impermeabilizantes', sunat_code: '31211500' },
        { code: 'ILU', name: 'Iluminación y Material Eléctrico', sunat_code: '39111500' },
        { code: 'VAL', name: 'Válvulas y Control de Fluidos', sunat_code: '40141600' },
        { code: 'SEG', name: 'Seguridad Industrial y EPP', sunat_code: '46181500' },
      ];

      for (const c of defaults) {
        await this.prisma.inventoryCategory.create({
          data: { company_id: companyId, code: c.code, name: c.name, sunat_code: c.sunat_code },
        }).catch(() => {});
      }

      return this.prisma.inventoryCategory.findMany({
        where: { company_id: companyId, is_active: true },
        orderBy: { name: 'asc' },
      });
    }

    return cats;
  }

  async createCategory(companyId: string, data: { name: string; code?: string; sunat_code?: string; description?: string }) {
    const name = data.name.trim();
    const code = (data.code || name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8)).toUpperCase();

    const existing = await this.prisma.inventoryCategory.findFirst({
      where: { company_id: companyId, code },
    });
    if (existing) throw new ConflictException(`La categoría con código "${code}" ya existe.`);

    return this.prisma.inventoryCategory.create({
      data: {
        company_id: companyId,
        name,
        code,
        sunat_code: data.sunat_code?.trim() || null,
        description: data.description?.trim() || null,
      },
    });
  }

  async updateCategory(
    companyId: string,
    id: string,
    data: { name?: string; code?: string; sunat_code?: string; description?: string; is_active?: boolean },
  ) {
    const cat = await this.prisma.inventoryCategory.findFirst({
      where: { id, company_id: companyId },
    });
    if (!cat) throw new NotFoundException('Categoría no encontrada.');

    const name = data.name?.trim();
    const code = data.code ? data.code.trim().toUpperCase() : undefined;

    if (code) {
      const conflict = await this.prisma.inventoryCategory.findFirst({
        where: {
          company_id: companyId,
          id: { not: id },
          code,
        },
      });
      if (conflict) {
        throw new ConflictException(`La categoría con código "${code}" ya existe.`);
      }
    }

    return this.prisma.inventoryCategory.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(code && { code }),
        ...(data.sunat_code !== undefined && { sunat_code: data.sunat_code?.trim() || null }),
        ...(data.description !== undefined && { description: data.description?.trim() || null }),
        ...(data.is_active !== undefined && { is_active: data.is_active }),
      },
    });
  }

  async deleteCategory(companyId: string, id: string) {
    const cat = await this.prisma.inventoryCategory.findFirst({
      where: { id, company_id: companyId },
    });
    if (!cat) throw new NotFoundException('Categoría no encontrada.');
    return this.prisma.inventoryCategory.update({
      where: { id },
      data: { is_active: false },
    });
  }

  // -------------------------------------------------------------
  // Fabricantes (inventory_manufacturers)
  // -------------------------------------------------------------
  async listManufacturers(companyId: string) {
    const mans = await this.prisma.inventoryManufacturer.findMany({
      where: { company_id: companyId, is_active: true },
      orderBy: { name: 'asc' },
    });

    if (mans.length === 0) {
      const defaults = [
        { name: 'UNACEM S.A.A.', country_code: 'PE', website: 'https://www.unacem.com.pe', contact_info: 'RUC 20100132592 - ventas@unacem.com.pe' },
        { name: 'Yura S.A.', country_code: 'PE', website: 'https://www.yura.com.pe', contact_info: 'RUC 20100180139 - atencion@yura.com.pe' },
        { name: 'Corporación Aceros Arequipa S.A.', country_code: 'PE', website: 'https://www.acerosarequipa.com', contact_info: 'RUC 20100067644 - ventas@acerosarequipa.com' },
        { name: 'Empresa Siderúrgica del Perú S.A.A. (Siderperú)', country_code: 'PE', website: 'https://www.siderperu.com.pe', contact_info: 'RUC 20100055204' },
        { name: 'Mexichem Perú S.A. (Pavco Wavin)', country_code: 'PE', website: 'https://wavin.com/pe', contact_info: 'RUC 20100152941' },
        { name: 'Tigre Perú Tubos y Conexiones S.A.', country_code: 'PE', website: 'https://www.tigre.pe', contact_info: 'RUC 20519129531' },
        { name: 'Robert Bosch Perú S.A.', country_code: 'DE', website: 'https://www.bosch-pt.com.pe', contact_info: 'RUC 20100155029 - Herramientas eléctricas' },
        { name: 'Makita Perú S.A.', country_code: 'JP', website: 'https://www.makita.pe', contact_info: 'RUC 20512803610 - Herramientas industriales' },
        { name: 'Foshan Nanhai Ceramics Co., Ltd.', country_code: 'CN', website: 'https://www.foshanceramics.com', contact_info: 'Guangdong, China - Proveedor de Porcelanatos' },
        { name: 'C&A Industrial Steel Co., Ltd.', country_code: 'CN', website: 'https://www.casteel.com', contact_info: 'Hebei, China - Aceros y perfiles' },
      ];

      for (const mf of defaults) {
        await this.prisma.inventoryManufacturer.create({
          data: {
            company_id: companyId,
            name: mf.name,
            country_code: mf.country_code,
            website: mf.website,
            contact_info: mf.contact_info,
          },
        }).catch(() => {});
      }

      return this.prisma.inventoryManufacturer.findMany({
        where: { company_id: companyId, is_active: true },
        orderBy: { name: 'asc' },
      });
    }

    return mans;
  }

  async createManufacturer(companyId: string, data: { name: string; country_code?: string; website?: string; contact_info?: string }) {
    const name = data.name.trim();
    const existing = await this.prisma.inventoryManufacturer.findFirst({
      where: { company_id: companyId, name },
    });
    if (existing) throw new ConflictException(`El fabricante "${name}" ya existe.`);

    return this.prisma.inventoryManufacturer.create({
      data: {
        company_id: companyId,
        name,
        country_code: data.country_code?.trim().toUpperCase() || 'PE',
        website: data.website?.trim() || null,
        contact_info: data.contact_info?.trim() || null,
      },
    });
  }

  async updateManufacturer(
    companyId: string,
    id: string,
    data: { name?: string; country_code?: string; website?: string; contact_info?: string; is_active?: boolean },
  ) {
    const manuf = await this.prisma.inventoryManufacturer.findFirst({
      where: { id, company_id: companyId },
    });
    if (!manuf) throw new NotFoundException('Fabricante no encontrado.');

    const name = data.name?.trim();
    if (name) {
      const conflict = await this.prisma.inventoryManufacturer.findFirst({
        where: {
          company_id: companyId,
          id: { not: id },
          name,
        },
      });
      if (conflict) {
        throw new ConflictException(`El fabricante "${name}" ya existe.`);
      }
    }

    return this.prisma.inventoryManufacturer.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(data.country_code !== undefined && { country_code: data.country_code.trim().toUpperCase() }),
        ...(data.website !== undefined && { website: data.website?.trim() || null }),
        ...(data.contact_info !== undefined && { contact_info: data.contact_info?.trim() || null }),
        ...(data.is_active !== undefined && { is_active: data.is_active }),
      },
    });
  }

  async deleteManufacturer(companyId: string, id: string) {
    const manuf = await this.prisma.inventoryManufacturer.findFirst({
      where: { id, company_id: companyId },
    });
    if (!manuf) throw new NotFoundException('Fabricante no encontrado.');
    return this.prisma.inventoryManufacturer.update({
      where: { id },
      data: { is_active: false },
    });
  }

  // -------------------------------------------------------------
  // Etiquetas / Tags (inventory_tags)
  // -------------------------------------------------------------
  async listTags(companyId: string) {
    const tags = await this.prisma.inventoryTag.findMany({
      where: { company_id: companyId },
      orderBy: { name: 'asc' },
    });

    if (tags.length === 0) {
      const defaults = [
        { name: 'alta-rotacion', color: 'emerald' },
        { name: 'rotacion-media', color: 'blue' },
        { name: 'baja-rotacion', color: 'amber' },
        { name: 'producto-importado', color: 'purple' },
        { name: 'compra-nacional', color: 'emerald' },
        { name: 'material-pesado', color: 'amber' },
        { name: 'obra-civil', color: 'blue' },
        { name: 'acabado-fino', color: 'purple' },
      ];

      for (const t of defaults) {
        await this.prisma.inventoryTag.create({
          data: {
            company_id: companyId,
            name: t.name,
            color: t.color,
          },
        }).catch(() => {});
      }

      return this.prisma.inventoryTag.findMany({
        where: { company_id: companyId },
        orderBy: { name: 'asc' },
      });
    }

    return tags;
  }

  async createTag(companyId: string, data: { name: string; color?: string }) {
    const name = data.name.trim().toLowerCase();
    const existing = await this.prisma.inventoryTag.findFirst({
      where: { company_id: companyId, name },
    });
    if (existing) return existing;

    return this.prisma.inventoryTag.create({
      data: { company_id: companyId, name, color: data.color || 'emerald' },
    });
  }

  async updateTag(companyId: string, id: string, data: { name?: string; color?: string }) {
    const tag = await this.prisma.inventoryTag.findFirst({
      where: { id, company_id: companyId },
    });
    if (!tag) throw new NotFoundException('Etiqueta no encontrada.');

    const name = data.name?.trim().toLowerCase();
    if (name) {
      const conflict = await this.prisma.inventoryTag.findFirst({
        where: {
          company_id: companyId,
          id: { not: id },
          name,
        },
      });
      if (conflict) {
        throw new ConflictException(`Ya existe una etiqueta con el nombre "${name}".`);
      }
    }

    return this.prisma.inventoryTag.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(data.color !== undefined && { color: data.color }),
      },
    });
  }

  async deleteTag(companyId: string, id: string) {
    const tag = await this.prisma.inventoryTag.findFirst({
      where: { id, company_id: companyId },
    });
    if (!tag) throw new NotFoundException('Etiqueta no encontrada.');
    return this.prisma.inventoryTag.delete({
      where: { id },
    });
  }

  // -------------------------------------------------------------
  // Responsables Autorizados para Traslados y Conteos Físicos (Obs 19 y 20)
  // -------------------------------------------------------------
  async listAuthorizedResponsibles(companyId: string) {
    const users = (await (this.prisma as any).user?.findMany({
      where: { company_id: companyId, is_active: true },
      select: { id: true, full_name: true, role: true, email: true },
      orderBy: { full_name: 'asc' },
    })) || [];

    const transporters = (await (this.prisma as any).businessPartner?.findMany({
      where: {
        company_id: companyId,
        is_active: true,
        roles: { has: 'TRANSPORTISTA' },
      },
      select: { id: true, legal_name: true, doc_number: true },
      orderBy: { legal_name: 'asc' },
    })) || [];

    return {
      users: users.map((u: any) => ({
        id: u.id,
        name: u.full_name,
        role: u.role,
        email: u.email,
        type: 'USER',
      })),
      transporters: transporters.map((t: any) => ({
        id: t.id,
        name: `${t.legal_name} (${t.doc_number})`,
        role: 'TRANSPORTISTA',
        type: 'CARRIER',
      })),
    };
  }
}

