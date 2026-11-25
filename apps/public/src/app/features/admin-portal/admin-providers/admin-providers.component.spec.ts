import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { AdminProvidersComponent } from './admin-providers.component';
import { AdminStoreService } from '../../../core/services/admin-store.service';
import { ExperienceService } from '../../../core/services/experience.service';
import { ProviderRatingService } from '../../../core/services/provider-rating.service';
import { NotificationService } from '../../../core/services/notification.service';
import { NewsletterService } from '../../../core/services/newsletter.service';
import { ProviderUser } from '../../../core/services/provider-store.service';
import { Experience } from '../../../core/models/experience.model';

describe('AdminProvidersComponent - lookupProvider Club resolution', () => {
  let component: AdminProvidersComponent;
  let fixture: ComponentFixture<AdminProvidersComponent>;

  const providersSignal = signal<ProviderUser[]>([]);
  const allRegisteredSignal = signal<ProviderUser[]>([]);
  const experiencesSignal = signal<Experience[]>([]);
  const clubProfileSignal = signal<any>({
    name: 'Club de Experiencias Oficial',
    email: 'admin@experiencias.club',
    phone: '+5493834000000',
    bio: 'Club Bio',
  });

  const mockProviderStore = {
    providers: providersSignal,
    getProviderBySlug: (s: string) =>
      providersSignal().find((p) => p.slug?.toLowerCase().trim() === s.toLowerCase().trim()),
    getProviderById: (id: string) =>
      providersSignal().find((p) => p.id === id),
    getProviderByEmail: (e: string) =>
      providersSignal().find((p) => p.email?.toLowerCase().trim() === e.toLowerCase().trim()),
    isProviderDeleted: () => false,
    loadProposalsFromSupabase: vi.fn().mockResolvedValue(undefined),
  };

  const mockAdminStore = {
    providerStore: mockProviderStore,
    clubProfile: clubProfileSignal,
    allRegisteredProviders: () => allRegisteredSignal(),
    applications: signal([]),
    members: signal([]),
    loadAllApplications: vi.fn().mockResolvedValue(undefined),
    loadAllMembers: vi.fn().mockResolvedValue(undefined),
  };

  const mockExpService = {
    experiences: experiencesSignal,
  };

  beforeEach(async () => {
    providersSignal.set([]);
    allRegisteredSignal.set([]);
    experiencesSignal.set([]);

    await TestBed.configureTestingModule({
      imports: [AdminProvidersComponent],
      providers: [
        provideRouter([]),
        { provide: AdminStoreService, useValue: mockAdminStore },
        { provide: ExperienceService, useValue: mockExpService },
        { provide: ProviderRatingService, useValue: { getProviderVotes: vi.fn().mockResolvedValue({ votes: [] }) } },
        { provide: NotificationService, useValue: { notifyProviderApproved: vi.fn() } },
        { provide: NewsletterService, useValue: null },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminProvidersComponent);
    component = fixture.componentInstance;
  });

  const createMockCanonicalClub = (id = 'a0000000-0000-0000-0000-000000000001'): ProviderUser => ({
    id,
    name: 'Club de Experiencias Canónico',
    agency: 'Club de Experiencias',
    slug: 'club-de-experiencias',
    email: 'admin@experiencias.club',
    phone: '+5493834000000',
    status: 'aprobado',
    role: 'prestador',
    cbuAlias: '',
    cuitDni: '',
    bankName: '',
    bio: '',
    verified: true,
    joinedAt: '2024-01-01T00:00:00Z',
  });

  it('should resolve and return canonical provider record when it exists by club-de-experiencias slug', () => {
    const canonicalClubProvider = createMockCanonicalClub();
    providersSignal.set([canonicalClubProvider]);
    allRegisteredSignal.set([canonicalClubProvider]);

    const result = (component as any).lookupProvider('club-de-experiencias');

    expect(result).toBeDefined();
    expect(result?.id).toBe('a0000000-0000-0000-0000-000000000001');
    expect(result?.name).toBe('Club de Experiencias Canónico');
  });

  it('should resolve canonical provider record when queried by "club" slug alias', () => {
    const canonicalClubProvider = createMockCanonicalClub();
    allRegisteredSignal.set([canonicalClubProvider]);

    const result = (component as any).lookupProvider('club');

    expect(result).toBeDefined();
    expect(result?.id).toBe('a0000000-0000-0000-0000-000000000001');
  });

  it('should match experiences linked only by canonical provider ID in providerExperiencesList', () => {
    const canonicalClubProvider = createMockCanonicalClub('canonical-club-uuid-1234');
    providersSignal.set([canonicalClubProvider]);
    allRegisteredSignal.set([canonicalClubProvider]);

    const expLinkedById: Experience = {
      id: 'exp-club-kayak',
      slug: 'kayak-jumeal',
      title: 'Kayak Jumeal',
      providerId: 'canonical-club-uuid-1234', // linked only by canonical ID, no providerEmail/providerSlug
      status: 'publicada',
    } as any;

    experiencesSignal.set([expLinkedById]);

    const resolved = (component as any).lookupProvider('club-de-experiencias');
    component.selectedProvider.set(resolved!);

    const list = component.providerExperiencesList();
    expect(list.length).toBe(1);
    expect(list[0].id).toBe('exp-club-kayak');
  });

  it('should fall back to synthetic Club provider when no canonical record exists', () => {
    providersSignal.set([]);
    allRegisteredSignal.set([]);

    const result = (component as any).lookupProvider('club-de-experiencias');

    expect(result).toBeDefined();
    expect(result?.id).toBe('prov-club');
    expect(result?.slug).toBe('club-de-experiencias');
    expect(result?.email).toBe('admin@experiencias.club');
    expect(result?.name).toBe('Club de Experiencias Oficial');
  });
});
