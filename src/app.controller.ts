import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';

@Controller('health')
export class AppController {
  @Get()
  async checkSupabaseConnection() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new HttpException('Faltan credenciales de base de datos en el .env', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    try {
      const supabase = createClient(supabaseUrl, supabaseKey);
      const { error } = await supabase.from('test_conexion').select('*').limit(1);

      // Aceptamos el error de que la tabla no existe (ya sea por código 42P01 o por mensaje de schema cache)
      if (error && error.code !== '42P01' && !error.message.includes('schema cache')) {
        throw new Error(error.message);
      }

      return {
        status: '200 OK',
        message: 'Conexión a Supabase verificada exitosamente',
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      throw new HttpException(
        `Error conectando a Supabase: ${error?.message || error}`,
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }
}