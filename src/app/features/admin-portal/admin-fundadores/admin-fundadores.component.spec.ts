import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { AdminFundadoresComponent } from './admin-fundadores.component';
import { AdminStoreService } from '../../../core/services/admin-store.service';
import { ProviderStoreService } from '../../../core/services/provider-store.service';

describe('AdminFundadoresComponent', () => {
  let component: AdminFundadoresComponent;
  let fixture: ComponentFixture<AdminFundadoresComponent>;
  const applicationsSignal = signal<any[]>([]);
  const membersSignal = signal<any[]>([]);
  const providersSignal = signal<any[]>([]);

  beforeEach(async () => {
    applicationsSignal.set([]);
    membersSignal.set([]);
    providersSignal.set([]);

    await TestBed.configureTestingModule({
      imports: [AdminFundadoresComponent],
      providers: [
        provideRouter([]),
        {
          provide: AdminStoreService,
          useValue: {
            applications: applicationsSignal,
            members: membersSignal,
            updateApplicationStatus: async () => true,
            updateMemberProfile: async () => ({ success: true }),
          },
        },
        {
          provide: ProviderStoreService,
          useValue: {
            providers: providersSignal,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminFundadoresComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should deduplicate equivalent founder emails across loops regardless of case and whitespace', () => {
    applicationsSignal.set([
      {
        id: 'app-1',
        type: 'fundador',
        fullName: 'Juan Fundador',
        email: '  Juan.Fundador@Club.com  ',
        status: 'aprobado',
        createdAt: '2026-01-01T00:00:00Z',
      },
    ]);
    membersSignal.set([
      {
        id: 'mem-1',
        membershipTier: 'fundador',
        fullName: 'Juan Socio',
        email: 'juan.fundador@club.com',
        createdAt: '2026-01-02T00:00:00Z',
      },
    ]);
    providersSignal.set([
      {
        id: 'prov-1',
        tier: 'fundador',
        name: 'Juan Prestador',
        email: '  JUAN.FUNDADOR@CLUB.COM ',
        joinedAt: '2026-01-03T00:00:00Z',
      },
    ]);

    const rows = component.rows();
    // Only one row should be produced because the emails are equivalent
    expect(rows.length).toBe(1);
    expect(rows[0].id).toBe('app-fundador-app-1');
  });

  it('should keep rows with blank or whitespace-only emails separate instead of deduplicating them', () => {
    applicationsSignal.set([
      {
        id: 'app-blank-1',
        type: 'fundador',
        fullName: 'Postulante Sin Email 1',
        email: '',
        status: 'en_evaluacion',
        createdAt: '2026-01-01T00:00:00Z',
      },
      {
        id: 'app-blank-2',
        type: 'fundador',
        fullName: 'Postulante Sin Email 2',
        email: '   ',
        status: 'en_evaluacion',
        createdAt: '2026-01-02T00:00:00Z',
      },
    ]);
    membersSignal.set([
      {
        id: 'mem-blank-1',
        membershipTier: 'fundador',
        fullName: 'Socio Sin Email',
        email: '',
        createdAt: '2026-01-03T00:00:00Z',
      },
    ]);
    providersSignal.set([
      {
        id: 'prov-blank-1',
        tier: 'fundador',
        name: 'Prestador Sin Email',
        email: undefined,
        joinedAt: '2026-01-04T00:00:00Z',
      },
    ]);

    const rows = component.rows();
    // All 4 rows with blank emails should be preserved separately
    expect(rows.length).toBe(4);
    const ids = rows.map((r) => r.id);
    expect(ids).toContain('app-fundador-app-blank-1');
    expect(ids).toContain('app-fundador-app-blank-2');
    expect(ids).toContain('socio-fundador-mem-blank-1');
    expect(ids).toContain('prestador-fundador-prov-blank-1');
  });
});

