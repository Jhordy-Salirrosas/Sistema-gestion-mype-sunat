import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Client } from 'pg';
import { rolesDatabase } from '../../fixtures/rolesDatabase';
(process.env.ROLES_TEST_DATABASE_URL?describe:describe.skip)('SQL de correo único global en esquema PostgreSQL efímero',()=>{
 let client:Client;const schema='roles_email_'+randomUUID().replaceAll('-','');
 const sql=readFileSync(join(__dirname,'../../../scripts/manual/users-email-global.sql'),'utf8');
 beforeAll(async()=>{
  const checked=await rolesDatabase();await checked.$disconnect();client=new Client({connectionString:process.env.ROLES_TEST_DATABASE_URL});await client.connect();
  await client.query(`CREATE SCHEMA "${schema}"; SET search_path TO "${schema}"; CREATE TABLE users(id TEXT PRIMARY KEY, company_id TEXT NOT NULL, email TEXT NOT NULL); CREATE UNIQUE INDEX users_company_id_email_key ON users(company_id,email);`);
  await client.query('INSERT INTO users VALUES ($1,$2,$3),($4,$5,$3)',['u1','empresa-a','duplicado@example.invalid','u2','empresa-b']);
 });
 afterAll(async()=>{if(client){await client.query('ROLLBACK');await client.query(`SET search_path TO public; DROP SCHEMA IF EXISTS "${schema}" CASCADE;`);await client.end();}});
 it('aborta ante duplicados existentes sin borrar usuarios ni perder la restricción previa',async()=>{
  expect(sql).toBe(readFileSync(join(__dirname,'../../../prisma/migrations/20261116120000_users_email_global/migration.sql'),'utf8'));
  await client.query('BEGIN');await expect(client.query(sql)).rejects.toMatchObject({code:'P0001'});await client.query('ROLLBACK');
  expect((await client.query('SELECT COUNT(*)::int AS count FROM users')).rows[0].count).toBe(2);
  expect((await client.query("SELECT to_regclass('users_company_id_email_key') AS name")).rows[0].name).not.toBeNull();
 });
 it('sin duplicados preserva la fila existente y sustituye el índice compuesto por el global',async()=>{
  // Se retira exclusivamente el fixture negativo; el SQL de entrega no borra datos.
  await client.query('DELETE FROM users WHERE id=$1',['u2']);
  await client.query('BEGIN');await client.query(sql);await client.query('COMMIT');
  expect((await client.query('SELECT id,email FROM users')).rows).toEqual([{id:'u1',email:'duplicado@example.invalid'}]);
  expect((await client.query("SELECT to_regclass('users_email_key') AS name")).rows[0].name).not.toBeNull();
  expect((await client.query("SELECT to_regclass('users_company_id_email_key') AS name")).rows[0].name).toBeNull();
 });
 it('la unicidad resultante impide repetir correo entre empresas',async()=>{
  await expect(client.query('INSERT INTO users VALUES ($1,$2,$3)',['u3','empresa-b','duplicado@example.invalid'])).rejects.toMatchObject({code:'23505'});
 });
});
