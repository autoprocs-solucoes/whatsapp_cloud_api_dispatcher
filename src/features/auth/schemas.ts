import { z } from "zod";

export const signUpSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Informe seu nome completo")
    .max(120, "Nome muito longo"),
  email: z.string().trim().email("Email inválido"),
  password: z
    .string()
    .min(8, "Senha precisa ter pelo menos 8 caracteres")
    .max(72, "Senha muito longa"),
});

export type SignUpInput = z.infer<typeof signUpSchema>;

export const signInSchema = z.object({
  email: z.string().trim().email("Email inválido"),
  password: z.string().min(1, "Informe a senha"),
});

export type SignInInput = z.infer<typeof signInSchema>;
