import { describe, expect, it } from 'vitest';
import {
  hasPermission,
  isAppRole,
  isValidCuit,
  isValidEmail,
  validateProviderApplication,
  validateWaitlistSubmission,
} from './index';

describe('roles', () => {
  it('recognizes valid roles only', () => {
    expect(isAppRole('admin')).toBe(true);
    expect(isAppRole('superuser')).toBe(false);
  });

  it('scopes permissions per role', () => {
    expect(hasPermission('admin', 'approve_providers')).toBe(true);
    expect(hasPermission('provider', 'approve_providers')).toBe(false);
    expect(hasPermission('member', 'book_experience')).toBe(true);
    expect(hasPermission(null, 'book_experience')).toBe(false);
  });
});

describe('validation', () => {
  it('validates emails', () => {
    expect(isValidEmail('  Socio@Experiencias.Club ')).toBe(true);
    expect(isValidEmail('no-es-un-email')).toBe(false);
  });

  it('validates CUIT check digit', () => {
    expect(isValidCuit('20-12345678-6')).toBe(true);
    expect(isValidCuit('20-12345678-0')).toBe(false);
    expect(isValidCuit('123')).toBe(false);
  });

  it('validates waitlist submissions', () => {
    expect(validateWaitlistSubmission({ email: 'a@b.co' }).valid).toBe(true);
    expect(validateWaitlistSubmission({ email: 'mal' }).errors.email).toBeDefined();
  });

  it('validates provider applications', () => {
    const result = validateProviderApplication({
      email: 'guia@experiencias.club',
      fullName: 'Lucas Nieto',
      category: 'guia_nautico',
      region: 'Catamarca',
      description: 'Guía náutico homologado con 10 años de experiencia en kayak.',
    });
    expect(result.valid).toBe(true);

    const invalid = validateProviderApplication({
      email: 'x',
      fullName: 'L',
      category: 'piloto',
      region: '',
      description: 'corta',
      cuit: '1',
    });
    expect(Object.keys(invalid.errors).sort()).toEqual(
      ['category', 'cuit', 'description', 'email', 'fullName', 'region'].sort(),
    );
  });
});
