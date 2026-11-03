import { TestBed } from '@angular/core/testing';
import { NotificationService } from './notification.service';
import { TransferSubmission } from '../models/bank-transfer.model';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

describe('NotificationService', () => {
  let service: NotificationService;

  const mockSubmission: TransferSubmission = {
    id: 'sub-test-123',
    reference: 'EXP-VOLCAN-001',
    experienceId: 'exp-volcan-galan',
    experienceTitle: 'Cráter Volcán Galán',
    date: '2026-11-20',
    participants: 2,
    amountArs: 180000,
    fullName: 'Ana Exploradora',
    email: 'ana@example.com',
    dni: '35123456',
    phone: '3834112233',
    status: 'pendiente',
    submittedAt: '2026-11-01T12:00:00Z',
    receipt: {
      fileName: 'comprobante.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 1024,
      url: 'https://cdn.catamarcasecreta.com/comprobantes/receipt.jpg',
      provider: 'supabase',
    },
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [NotificationService],
    });
    service = TestBed.inject(NotificationService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getWhatsAppNotificationUrl', () => {
    it('should generate pre-filled WhatsApp link with default phone', () => {
      const url = service.getWhatsAppNotificationUrl(mockSubmission);
      expect(url).toContain('https://wa.me/5493515490431?text=');
      expect(url).toContain(encodeURIComponent('Cráter Volcán Galán'));
      expect(url).toContain(encodeURIComponent('EXP-VOLCAN-001'));
      expect(url).toContain(encodeURIComponent('Ana Exploradora'));
    });

    it('should support custom phone number and clean digits', () => {
      const customPhone = '+54 9 383 455-8812';
      const url = service.getWhatsAppNotificationUrl(mockSubmission, customPhone);
      expect(url).toContain('https://wa.me/5493834558812?text=');
    });
  });

  describe('notifyPaymentSubmitted', () => {
    it('should POST PAYMENT_SUBMITTED to /api/notify and log success', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          results: [{ target: 'user', id: 'res-1' }],
        }),
      } as Response);

      const result = await service.notifyPaymentSubmitted(mockSubmission);

      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/notify',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      const callArgs = fetchSpy.mock.calls[0];
      const sentBody = JSON.parse(callArgs[1]?.body as string);
      expect(sentBody.type).toBe('PAYMENT_SUBMITTED');
      expect(sentBody.data.reference).toBe('EXP-VOLCAN-001');
      expect(sentBody.data.amountArs).toBe(180000);
      expect(result.success).toBe(true);
      expect(service.notificationsLog().length).toBe(1);
      expect(service.notificationsLog()[0].success).toBe(true);
    });
  });

  describe('notifyPaymentApproved', () => {
    it('should POST PAYMENT_APPROVED to /api/notify', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, results: [{ target: 'user_approved' }] }),
      } as Response);

      const result = await service.notifyPaymentApproved(mockSubmission, {
        meetingPoint: 'Plaza Belén, Catamarca',
      });

      expect(result.success).toBe(true);
      const callArgs = fetchSpy.mock.calls[0];
      const sentBody = JSON.parse(callArgs[1]?.body as string);
      expect(sentBody.type).toBe('PAYMENT_APPROVED');
      expect(sentBody.data.meetingPoint).toBe('Plaza Belén, Catamarca');
    });
  });

  describe('notifyPaymentRejected', () => {
    it('should POST PAYMENT_REJECTED to /api/notify with reason', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, results: [{ target: 'user_rejected' }] }),
      } as Response);

      const result = await service.notifyPaymentRejected(
        mockSubmission,
        'Monto no coincide con el total de la reserva',
      );

      expect(result.success).toBe(true);
      const callArgs = fetchSpy.mock.calls[0];
      const sentBody = JSON.parse(callArgs[1]?.body as string);
      expect(sentBody.type).toBe('PAYMENT_REJECTED');
      expect(sentBody.data.rejectionReason).toBe('Monto no coincide con el total de la reserva');
    });
  });

  describe('notifyWelcomeMember', () => {
    it('should POST WELCOME_MEMBER to /api/notify', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      } as Response);

      const result = await service.notifyWelcomeMember({
        fullName: 'Patricio Diaz Tillar',
        email: 'patriciofacundodiaztillar@gmail.com',
        position: 4,
      });

      expect(result.success).toBe(true);
      const callArgs = fetchSpy.mock.calls[0];
      const sentBody = JSON.parse(callArgs[1]?.body as string);
      expect(sentBody.type).toBe('WELCOME_MEMBER');
      expect(sentBody.data.position).toBe(4);
    });
  });

  describe('notifyAlreadyRegistered', () => {
    it('should POST ALREADY_REGISTERED to /api/notify', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      } as Response);

      const result = await service.notifyAlreadyRegistered({
        fullName: 'Gonzalo Gramaglia',
        email: 'gonzagramaglia@gmail.com',
        position: 1,
        tier: 'fundador',
      });

      expect(result.success).toBe(true);
      const callArgs = fetchSpy.mock.calls[0];
      const sentBody = JSON.parse(callArgs[1]?.body as string);
      expect(sentBody.type).toBe('ALREADY_REGISTERED');
      expect(sentBody.data.email).toBe('gonzagramaglia@gmail.com');
      expect(sentBody.data.position).toBe(1);
      expect(sentBody.data.tier).toBe('fundador');
    });
  });

  describe('getWhatsAppNotificationUrl', () => {
    it('should generate valid WhatsApp URL with default admin phone', () => {
      const url = service.getWhatsAppNotificationUrl(mockSubmission);
      expect(url).toContain('https://wa.me/5493515490431?text=');
      expect(url).toContain(encodeURIComponent(mockSubmission.reference));
    });

    it('should format custom provider local phone to international format', () => {
      const url = service.getWhatsAppNotificationUrl(mockSubmission, '383 455-8812');
      expect(url).toContain('https://wa.me/5493834558812?text=');
    });

    it('should preserve already formatted Argentine international phone', () => {
      const url = service.getWhatsAppNotificationUrl(mockSubmission, '+54 9 383 455-8812');
      expect(url).toContain('https://wa.me/5493834558812?text=');
    });
  });

  describe('error handling', () => {
    it('should catch network failures and return success: false without throwing', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network offline'));

      const result = await service.notifyPaymentSubmitted(mockSubmission);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network offline');
      expect(service.notificationsLog().length).toBe(1);
      expect(service.notificationsLog()[0].success).toBe(false);
    });
  });
});

