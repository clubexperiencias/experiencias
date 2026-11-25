import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CLUB_PROFILE,
  getStoredUsdExchangeRate,
  isClubExperience,
  isClubProvider,
} from './club-profile.model';

describe('ClubProfile Model Helpers', () => {
  describe('isClubExperience', () => {
    it('returns false for null/undefined experience', () => {
      expect(isClubExperience(null)).toBe(false);
      expect(isClubExperience(undefined)).toBe(false);
    });

    it('rejects Club classification when providerName is an external provider even if providerSlug was defaulted to Club', () => {
      const exp = {
        providerSlug: 'club-de-experiencias',
        providerName: 'Alquileres de Kayak e hidropedales',
        providerEmail: 'admin@experiencias.club',
      };
      expect(isClubExperience(exp)).toBe(false);
    });

    it('rejects Club classification when providerName is customized and external without email', () => {
      const exp = {
        providerSlug: 'club',
        providerName: 'Aventuras Especiales',
      };
      expect(isClubExperience(exp)).toBe(false);
    });

    it('rejects Club classification when providerSlug is Club but providerEmail belongs to external provider', () => {
      const exp = {
        providerSlug: 'club-de-experiencias',
        providerName: 'Experiencias de Montaña',
        providerEmail: 'externo@empresa.com',
      };
      expect(isClubExperience(exp)).toBe(false);
    });

    it('rejects Club classification when providerSlug is external even if providerName mentions Club', () => {
      const exp = {
        providerSlug: 'prestador-externo',
        providerName: 'Club de Experiencias',
        providerEmail: 'admin@experiencias.club',
      };
      expect(isClubExperience(exp)).toBe(false);
    });

    it('preserves Club classification when providerEmail is admin@experiencias.club and slug is absent', () => {
      const exp = {
        providerEmail: 'admin@experiencias.club',
        providerName: 'Club de Experiencias',
      };
      expect(isClubExperience(exp)).toBe(true);
    });

    it('preserves Club classification when providerEmail is hola@experiencias.club and slug is absent', () => {
      const exp = {
        providerEmail: 'hola@experiencias.club',
      };
      expect(isClubExperience(exp)).toBe(true);
    });

    it('rejects external provider when providerName is external and no Club slug/email are set', () => {
      const exp = {
        providerName: 'Guía de Pesca Juan',
      };
      expect(isClubExperience(exp)).toBe(false);
    });

    it('honors isClubExperience boolean flag when no external provider identities are present', () => {
      expect(isClubExperience({ isClubExperience: true })).toBe(true);
      expect(isClubExperience({ isClubExperience: false })).toBe(false);
    });
  });

  describe('isClubProvider', () => {
    it('returns true for prov-club id', () => {
      expect(isClubProvider({ id: 'prov-club' })).toBe(true);
    });

    it('returns true for admin email', () => {
      expect(isClubProvider({ email: 'admin@experiencias.club' })).toBe(true);
      expect(isClubProvider({ email: 'gonzagramaglia@gmail.com' })).toBe(true);
    });

    it('returns true for club slugs', () => {
      expect(isClubProvider({ slug: 'club-de-experiencias' })).toBe(true);
      expect(isClubProvider({ slug: 'club' })).toBe(true);
    });

    it('returns false for external provider', () => {
      expect(
        isClubProvider({
          id: 'prov-123',
          email: 'guia@gmail.com',
          slug: 'guia-catamarca',
        })
      ).toBe(false);
    });
  });

  describe('getStoredUsdExchangeRate', () => {
    it('returns rate from standalone localStorage key first', () => {
      localStorage.setItem('catamarca_usd_exchange_rate_v1', '1250');
      localStorage.setItem(
        'catamarca_club_official_profile_v1',
        JSON.stringify({ usdExchangeRate: 1100 })
      );
      expect(getStoredUsdExchangeRate()).toBe(1250);
      localStorage.removeItem('catamarca_usd_exchange_rate_v1');
      localStorage.removeItem('catamarca_club_official_profile_v1');
    });

    it('falls back to official profile in localStorage when standalone is absent', () => {
      localStorage.removeItem('catamarca_usd_exchange_rate_v1');
      localStorage.setItem(
        'catamarca_club_official_profile_v1',
        JSON.stringify({ usdExchangeRate: 1150 })
      );
      expect(getStoredUsdExchangeRate()).toBe(1150);
      localStorage.removeItem('catamarca_club_official_profile_v1');
    });

    it('returns default rate when no stored values exist', () => {
      localStorage.removeItem('catamarca_usd_exchange_rate_v1');
      localStorage.removeItem('catamarca_club_official_profile_v1');
      localStorage.removeItem('catamarca_club_profile_v1');
      expect(getStoredUsdExchangeRate()).toBe(DEFAULT_CLUB_PROFILE.usdExchangeRate);
    });
  });
});
