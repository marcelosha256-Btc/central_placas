export interface PasswordValidation {
  valid: boolean;
  errors: string[];
}

export function validatePassword(password: string): PasswordValidation {
  const errors: string[] = [];
  if (password.length < 8) errors.push('mínimo 8 caracteres');
  if (!/[A-Z]/.test(password)) errors.push('uma letra maiúscula');
  if (!/[a-z]/.test(password)) errors.push('uma letra minúscula');
  if (!/[0-9]/.test(password)) errors.push('um número');
  return { valid: errors.length === 0, errors };
}

export function passwordStrength(password: string): 'fraca' | 'média' | 'forte' {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  if (score <= 3) return 'fraca';
  if (score <= 4) return 'média';
  return 'forte';
}
