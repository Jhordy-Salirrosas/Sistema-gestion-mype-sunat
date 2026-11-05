const { Client } = require('pg');
const { randomUUID } = require('crypto');
require('dotenv').config();

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const compRes = await client.query('SELECT id FROM companies LIMIT 1');
  const companyId = compRes.rows[0]?.id;
  if (!companyId) {
    console.error('No company found');
    await client.end();
    return;
  }

  // 1. Asegurar proveedor Shenzhen Tech Ltd
  let partnerRes = await client.query("SELECT id FROM business_partners WHERE doc_number = '91440300MA5'");
  let partnerId = partnerRes.rows[0]?.id;

  if (!partnerId) {
    partnerId = randomUUID();
    await client.query(`
      INSERT INTO business_partners (
        id, company_id, doc_type, doc_number, legal_name, trade_name, country_code,
        address, email, phone, website, roles, is_active
      ) VALUES (
        $1, $2, 'TAX_ID', '91440300MA5', 'SHENZHEN TECH ELECTRONICS CO., LTD.', 'Shenzhen Tech Ltd (China)', 'CN',
        'High-Tech Industrial Park, Nanshan, Shenzhen, Guangdong, China',
        'sales@shenzhen-tech.cn', '+86 755 8888 9999', 'https://shenzhen-tech.cn',
        ARRAY['PROVEEDOR'], true
      )
    `, [partnerId, companyId]);
  }

  // 1.1 Asegurar cuenta bancaria internacional para Shenzhen Tech
  const bankRes = await client.query('SELECT id FROM partner_bank_accounts WHERE partner_id = $1', [partnerId]);
  if (bankRes.rows.length === 0) {
    await client.query(`
      INSERT INTO partner_bank_accounts (
        id, partner_id, bank_name, bank_country, account_number, swift, iban, beneficiary, currency_code, is_default
      ) VALUES (
        $1, $2, 'BANK OF CHINA (HONG KONG) LIMITED', 'HK', '012-875-1-098234-7', 'BKCHHKHHXXX', 'HK29BKCH01287510982347',
        'SHENZHEN TECH ELECTRONICS CO., LTD.', 'USD', true
      )
    `, [randomUUID(), partnerId]);
  }

  // 2. Asegurar orden ORD-2026-00042
  const orderRes = await client.query("SELECT id FROM import_orders WHERE order_number = 'ORD-2026-00042'");
  let orderId = orderRes.rows[0]?.id;

  if (!orderId) {
    orderId = randomUUID();
    await client.query(`
      INSERT INTO import_orders (
        id, company_id, order_number, supplier_name, supplier_country, supplier_tax_id, supplier_address,
        supplier_condition, is_related, supplier_email, supplier_phone,
        incoterm, currency_code, issue_date, expected_arrival_date, port_of_origin, port_of_destination,
        transport_mode, total_fob, estimated_freight, estimated_insurance, total_cif,
        current_stage, current_stage_index, status, proforma_number, notes, responsible
      ) VALUES (
        $1, $2, 'ORD-2026-00042', 'SHENZHEN TECH ELECTRONICS CO., LTD.', 'CN', '91440300MA5',
        'High-Tech Industrial Park, Nanshan, Shenzhen, Guangdong, China',
        'FABRICANTE', false, 'sales@shenzhen-tech.cn', '+86 755 8888 9999',
        'FOB', 'USD', '2026-10-10', '2026-10-22', 'SHANGHAI', 'CALLAO',
        'MARITIMO', 50000.00, 1200.00, 300.00, 51500.00,
        'DAM', 7, 'APROBADA', 'PI-2026-SZ892',
        'Lote de 100 Laptops Gaming Core i7 16GB SSD 512GB RTX 4060. Incoterm FOB Puerto de Shanghai.',
        'Operador Comercio Exterior'
      )
    `, [orderId, companyId]);

    // Ítems
    await client.query(`
      INSERT INTO import_order_items (
        id, order_id, product_code, description, hs_code, quantity, unit_price_fob, total_fob, unit_code
      ) VALUES (
        $1, $2, 'LAP-GAM-001', 'LAPTOP GAMING CORE I7 16GB RAM 512GB SSD RTX 4060 15.6 PULG', '8471.30.00.00', 100, 500.00, 50000.00, 'NIU'
      )
    `, [randomUUID(), orderId]);

    // Documento comercial adjunto (Factura comercial y Proforma con hash)
    await client.query(`
      INSERT INTO import_order_documents (
        id, order_id, stage_index, stage_name, document_type, document_number, file_name,
        storage_url, file_hash, file_size_bytes, mime_type, is_mandatory, is_verified, uploaded_by
      ) VALUES
      ($1, $2, 0, 'Solicitud', 'PROFORMA', 'PI-2026-SZ892', 'proforma_invoice_sztech.pdf',
       'https://storage.sunat-mype.pe/orders/PI-2026-SZ892.pdf', 'a5c88b7f83e29cf46132049e0b2e38c944719f2a', 245100, 'application/pdf', true, true, 'Carlos Ahumada'),
      ($3, $2, 1, 'Aprobación / OC', 'ORDEN_COMPRA', 'ORD-2026-00042', 'orden_compra_internacional_00042.pdf',
       'https://storage.sunat-mype.pe/orders/OC-00042.pdf', 'c18d992e5a40bf5e229a1b145690dfa12b49c001', 312000, 'application/pdf', true, true, 'Carlos Ahumada'),
      ($4, $2, 2, 'Proforma', 'FACTURA_COMERCIAL', 'INV-2026-90412', 'commercial_invoice_90412.pdf',
       'https://storage.sunat-mype.pe/orders/INV-90412.pdf', 'f491290bb341029cba8e990bbfac2231c51888df', 450000, 'application/pdf', true, true, 'Carlos Ahumada')
    `, [randomUUID(), orderId, randomUUID(), randomUUID()]);
  }

  // 3. Vincular con shipment EXP-2026-00042 si existe
  const shipRes = await client.query("SELECT id FROM customs_shipments WHERE shipment_number = 'EXP-2026-00042'");
  if (shipRes.rows.length > 0) {
    await client.query("UPDATE customs_shipments SET order_reference = 'ORD-2026-00042' WHERE id = $1", [shipRes.rows[0].id]);
  }

  console.log('Seed completed successfully for order ORD-2026-00042 (ID:', orderId, ')');
  await client.end();
}

run().catch(console.error);
