import { z } from 'zod';
import { validateRucModulo11 } from './rucValidator';

/**
 * Esquema de validación para inicio de sesión.
 */
export const loginSchema = z.object({
  email: z
    .string()
    .min(1, { message: 'El correo electrónico es obligatorio' })
    .email({ message: 'Ingresa un correo electrónico válido' }),
  password: z
    .string()
    .min(6, { message: 'La contraseña debe tener al menos 6 caracteres' }),
});

export type LoginFormData = z.infer<typeof loginSchema>;

/**
 * Esquema de validación para registro de nueva MYPE (Fase 8).
 */
export const registerSchema = z.object({
  ruc: z
    .string()
    .length(11, { message: 'El RUC debe tener exactamente 11 dígitos' })
    .regex(/^\d+$/, { message: 'El RUC solo debe contener números' })
    .refine((val) => validateRucModulo11(val), {
      message: 'El RUC no es válido ante SUNAT (dígito verificador Módulo 11 incorrecto)',
    }),
  legalName: z
    .string()
    .min(3, { message: 'La Razón Social debe tener al menos 3 caracteres' })
    .max(200, { message: 'La Razón Social no puede exceder 200 caracteres' }),
  tradeName: z.string().optional(),
  solUser: z.string().min(1, { message: 'El usuario SOL de SUNAT es obligatorio' }),
  solPassword: z.string().min(1, { message: 'La clave SOL de SUNAT es obligatoria' }),
  fullName: z
    .string()
    .min(3, { message: 'El nombre completo debe tener al menos 3 caracteres' })
    .max(150, { message: 'El nombre completo no puede exceder 150 caracteres' }),
  email: z
    .string()
    .min(1, { message: 'El correo electrónico es obligatorio' })
    .email({ message: 'Ingresa un correo electrónico corporativo válido' }),
  password: z
    .string()
    .min(8, { message: 'Mínimo 8 caracteres' })
    .regex(/[A-Z]/, { message: 'Debe incluir al menos 1 letra mayúscula' })
    .regex(/[a-z]/, { message: 'Debe incluir al menos 1 letra minúscula' })
    .regex(/[0-9]/, { message: 'Debe incluir al menos 1 número' })
    .regex(/[^A-Za-z0-9]/, { message: 'Debe incluir al menos 1 símbolo especial (!@#$%^&*)' }),
});

export type RegisterFormData = z.infer<typeof registerSchema>;

/**
 * Esquema de cambio de contraseña.
 */
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, { message: 'Ingresa tu contraseña actual' }),
    newPassword: z
      .string()
      .min(8, { message: 'Mínimo 8 caracteres' })
      .regex(/[A-Z]/, { message: 'Debe incluir al menos 1 mayúscula' })
      .regex(/[a-z]/, { message: 'Debe incluir al menos 1 minúscula' })
      .regex(/[0-9]/, { message: 'Debe incluir al menos 1 número' })
      .regex(/[^A-Za-z0-9]/, { message: 'Debe incluir al menos 1 símbolo especial' }),
    confirmPassword: z.string().min(1, { message: 'Confirma la nueva contraseña' }),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
  });

export type ChangePasswordFormData = z.infer<typeof changePasswordSchema>;

/**
 * Esquema de edición de perfil.
 */
export const updateProfileSchema = z.object({
  fullName: z
    .string()
    .min(3, { message: 'El nombre completo debe tener al menos 3 caracteres' })
    .max(150, { message: 'Máximo 150 caracteres' }),
});

export type UpdateProfileFormData = z.infer<typeof updateProfileSchema>;
