import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { ActivitiesHistoryComponent } from './activities-history.component';
import { ActivityHistoryService } from '../../../core/services/activity-history.service';
import { ActivityRecord } from '../../../core/models/activity-history.model';

const mockActivities: ActivityRecord[] = [
  {
    id: 'act_001',
    slug: 'kayak-sunset',
    userId: 'user_1',
    experienceId: 'exp_kayak_jumeal',
    title: 'Travesía en Kayak & Sunset en el Dique El Jumeal',
    region: 'Valle Central y Ambato',
    altitude: '850 msnm',
    coverImage: '/assets/images/kayak-club-de-experiencias.jpg',
    dateLabel: '24 de Noviembre, 2026',
    status: 'confirmada',
    provider: { name: 'Travesías Náuticas Ambato', category: 'Kayak', contactPhone: '' },
    receipt: {
      receiptNumber: 'REC-001',
      transactionId: 'TX-001',
      gateway: 'custom',
      gatewayDisplayName: 'Transferencia',
      amountArs: 65000,
      amountUsd: 0,
      paidAt: '2026-11-20',
      paymentMethodSummary: 'Transferencia',
      payerEmail: 'socio@catamarca.ar',
      payerName: 'Socio Test',
      authCode: 'AUTH-1',
      status: 'aprobado',
    },
    memoriesCount: 0,
    memoryPhotos: [],
  },
  {
    id: 'act_002',
    slug: 'dunas-taton',
    userId: 'user_1',
    experienceId: 'exp_taton',
    title: 'Sandboard en las Dunas de Tatón',
    region: 'Fiambalá',
    altitude: '1.980 msnm',
    coverImage: '/assets/images/kayak-club-de-experiencias.jpg',
    dateLabel: '12 de Diciembre, 2026',
    status: 'confirmada',
    provider: { name: 'Fiambalá Aventura', category: 'Sandboard', contactPhone: '' },
    receipt: {
      receiptNumber: 'REC-002',
      transactionId: 'TX-002',
      gateway: 'custom',
      gatewayDisplayName: 'Transferencia',
      amountArs: 55000,
      amountUsd: 0,
      paidAt: '2026-12-05',
      paymentMethodSummary: 'Transferencia',
      payerEmail: 'socio@catamarca.ar',
      payerName: 'Socio Test',
      authCode: 'AUTH-2',
      status: 'aprobado',
    },
    memoriesCount: 0,
    memoryPhotos: [],
  },
];

class MockActivityHistoryService {
  readonly activities = signal<ActivityRecord[]>(mockActivities).asReadonly();
  readonly selectedReceipt = signal(null);
  viewReceipt(): void {}
  closeReceipt(): void {}
  downloadReceiptPrint(): void {}
}

describe('ActivitiesHistoryComponent (/perfil/actividades)', () => {
  let component: ActivitiesHistoryComponent;
  let fixture: ComponentFixture<ActivitiesHistoryComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ActivitiesHistoryComponent],
      providers: [
        provideRouter([]),
        { provide: ActivityHistoryService, useClass: MockActivityHistoryService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ActivitiesHistoryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the activities history component', () => {
    expect(component).toBeTruthy();
  });

  it('should render page title and activity cards', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Actividades: Salidas & Expediciones');
    expect(el.textContent).toContain('Travesía en Kayak & Sunset en el Dique El Jumeal');
  });

  it('should not contain the Mi Perfil return button in box header', () => {
    const el = fixture.nativeElement as HTMLElement;
    const returnBtn = el.querySelector('.btn-return-profile');
    expect(returnBtn).toBeNull();
  });

  it('should filter by date and order activities chronologically', () => {
    component.dateFrom.set('2026-11-01');
    component.dateTo.set('2026-12-31');
    fixture.detectChanges();

    expect(component.filteredActivities().length).toBe(2);

    component.sortOrder.set('asc');
    fixture.detectChanges();
    expect(component.filteredActivities()[0].dateLabel).toContain('24 de Noviembre');

    component.sortOrder.set('desc');
    fixture.detectChanges();
    expect(component.filteredActivities()[0].dateLabel).toContain('12 de Diciembre');
  });
});
