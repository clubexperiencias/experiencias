import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ProfileComponent } from './profile.component';

describe('ProfileComponent', () => {
  let component: ProfileComponent;
  let fixture: ComponentFixture<ProfileComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProfileComponent],
      providers: [
        provideRouter([
          { path: 'perfil', component: ProfileComponent },
          { path: 'ingresar', component: ProfileComponent },
        ]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ProfileComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should display the green registration success notification replacing breadcrumb when logging in', () => {
    component.newsletter.setLoginSuccessFlag();
    component.ngOnInit();
    fixture.detectChanges();

    const notification = fixture.nativeElement.querySelector('.registration-success-bar');
    expect(notification).toBeTruthy();
    expect(notification.textContent).toContain('¡PERFIL DE SOCIO REGISTRADO CON ÉXITO!');
    expect(notification.textContent).toContain('Socio Emergente');
    expect(component.newsletter.profileSuccessHighlight()).toBe(true);
  });

  it('should NOT display the green registration success notification when navigating normally via breadcrumb', () => {
    // Normal navigation: login flag was not set
    const notification = fixture.nativeElement.querySelector('.registration-success-bar');
    expect(notification).toBeFalsy();
    const breadcrumb = fixture.nativeElement.querySelector('.breadcrumb-bar');
    expect(breadcrumb).toBeTruthy();
  });

  it('should reset profileSuccessHighlight in ngOnDestroy when cancelling successTimer', () => {
    component.newsletter.setLoginSuccessFlag();
    component.ngOnInit();
    expect(component.newsletter.profileSuccessHighlight()).toBe(true);

    component.ngOnDestroy();
    expect(component.newsletter.profileSuccessHighlight()).toBe(false);
  });

  it('should only show the last 2 activities in profile preview and link to full history when activities exist', () => {
    component.activityService.addActivity({
      id: 'act-1',
      userId: 'user-1',
      experienceId: 'exp-1',
      title: 'Trekking Laguna Blanca',
      region: 'Catamarca',
      altitude: '1200m',
      coverImage: '/assets/images/kayak.jpg',
      dateLabel: '15 Nov 2026',
      status: 'confirmada',
      provider: {
        name: 'Prestador',
        category: 'Aventura',
        contactPhone: '+5493834123456',
      },
      receipt: {
        receiptNumber: 'REC-001',
        transactionId: 'TX-001',
        gateway: 'mercadopago',
        gatewayDisplayName: 'Mercado Pago',
        amountArs: 50000,
        amountUsd: 50,
        paidAt: '2026-11-15',
        paymentMethodSummary: 'Transferencia',
        payerEmail: 'test@gmail.com',
        payerName: 'Test User',
        authCode: 'AUTH-1',
        status: 'aprobado',
      },
      memoriesCount: 0,
      memoryPhotos: [],
    });
    fixture.detectChanges();

    const cards = fixture.nativeElement.querySelectorAll('.activities-list .activity-card');
    expect(cards.length).toBeLessThanOrEqual(2);

    const viewAllBtn = fixture.nativeElement.querySelector('.btn-view-all-activities');
    expect(viewAllBtn).toBeTruthy();
    expect(viewAllBtn.tagName.toLowerCase()).toBe('a');
    expect(viewAllBtn.getAttribute('routerlink')).toBe('/perfil/actividades');
    expect(viewAllBtn.textContent).toContain('Ver actividades reservadas (1 experiencia)');
  });

  it('should display disabled button with zero-count label and no routerlink when there are no activities', () => {
    // When activityService has no activities
    fixture.detectChanges();

    const viewAllBtn = fixture.nativeElement.querySelector('.btn-view-all-activities');
    expect(viewAllBtn).toBeTruthy();
    expect(viewAllBtn.tagName.toLowerCase()).toBe('button');
    expect(viewAllBtn.hasAttribute('disabled')).toBe(true);
    expect(viewAllBtn.getAttribute('routerlink')).toBeNull();
    expect(viewAllBtn.textContent).toContain('Ver actividades reservadas (0 experiencias)');
  });

  it('should display the membership info box with updated copy', () => {
    const card = fixture.nativeElement.querySelector('.profile-completion-card');
    expect(card).toBeTruthy();
    expect(card.textContent).toContain('DATOS DE MEMBRESÍA');
    expect(card.textContent).toContain('Socio Emergente');
    expect(card.textContent).toContain('Registramos tu suscripción con');
    expect(card.textContent).toContain('Ya formás parte del club como');
  });

  it('should link back to root / from the header logo', () => {
    const brandLink = fixture.nativeElement.querySelector('.brand');
    expect(brandLink.getAttribute('routerlink') || brandLink.getAttribute('href')).toBe('/');
  });

  it('should have an Inicio button in the header pointing to root /', () => {
    const homeBtn = fixture.nativeElement.querySelector('.home-header-btn');
    expect(homeBtn).toBeTruthy();
    expect(homeBtn.textContent).toContain('Inicio');
    expect(homeBtn.getAttribute('routerlink') || homeBtn.getAttribute('href')).toBe('/');
  });

  it('should have a logout button that resets current subscription', async () => {
    vi.spyOn(component.router, 'url', 'get').mockReturnValue('/perfil');
    (component.newsletter as any)._currentMember.set({
      id: 'socio-1',
      email: 'perfil@test.com',
      fullName: 'Perfil Test',
      status: 'confirmed',
      createdAt: new Date().toISOString(),
    });
    fixture.detectChanges();

    const logoutBtn = fixture.nativeElement.querySelector('.logout-header-btn, .logout-btn') as HTMLElement;
    expect(logoutBtn).toBeTruthy();
    expect(logoutBtn.textContent).toContain('Cerrar Sesión');

    logoutBtn.click();
    fixture.detectChanges();

    const confirmBtn = fixture.nativeElement.querySelector('.logout-confirm-btn') as HTMLElement;
    if (confirmBtn) {
      confirmBtn.click();
      fixture.detectChanges();
    }

    expect(component.newsletter.isSubscribed()).toBe(false);
  });

  it('should remove matching experience from selectedExperiences when favorite is removed', () => {
    component.selectedExperiences.set(['kayak-las-jumeal', 'trekking-antofagasta', 'otra-exp']);

    const mockExpToRemove: any = {
      id: 'exp-kayak-1',
      slug: 'kayak-las-jumeal',
      title: 'Kayak en Las Jumeal',
    };

    component.removeFavorite(mockExpToRemove);

    expect(component.selectedExperiences()).toEqual(['trekking-antofagasta', 'otra-exp']);
  });

  it('should display favorite count in title parentheses and not show fav-count-pill', () => {
    localStorage.clear();
    (component.newsletter as any)._currentMember.set({
      id: 'socio-1',
      email: 'socio@experiencias.club',
      fullName: 'Socio Test',
      status: 'confirmed',
      createdAt: new Date().toISOString(),
    });
    (component.favoritesService as any).activeMemberIdentity = 'socio@experiencias.club';
    (component.favoritesService as any)._favoriteSlugs.set([]);
    (component.favoritesService as any)._removedSlugs.set(new Set());

    const titleEl = fixture.nativeElement.querySelector('#favoritos .section-title');
    expect(titleEl).toBeTruthy();
    expect(titleEl.textContent).toContain('Mis Experiencias Favoritas (0)');

    const pill = fixture.nativeElement.querySelector('.fav-count-pill');
    expect(pill).toBeFalsy();

    const mockExp: any = {
      id: 'exp-1',
      slug: 'kayak-las-jumeal',
      title: 'Kayak en Las Jumeal',
      region: 'Catamarca',
      difficulty: 'Baja',
      durationLabel: '2 horas',
      priceArs: 15000,
      coverImage: '/assets/images/kayak.jpg',
    };
    (component.experienceService as any)._experiences.set([mockExp]);
    component.favoritesService.toggleFavorite(mockExp);
    fixture.detectChanges();

    expect(titleEl.textContent).toContain('Mis Experiencias Favoritas (1)');
    expect(fixture.nativeElement.querySelector('.fav-count-pill')).toBeFalsy();
    expect(fixture.nativeElement.querySelector('.fav-carousel-wrap')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.fav-carousel-track')).toBeTruthy();
  });

  it('should navigate carousel on prev and next and update scroll position', () => {
    localStorage.clear();
    (component.newsletter as any)._currentMember.set({
      id: 'socio-1',
      email: 'socio@experiencias.club',
      fullName: 'Socio Test',
      status: 'confirmed',
      createdAt: new Date().toISOString(),
    });
    (component.favoritesService as any).activeMemberIdentity = 'socio@experiencias.club';
    (component.favoritesService as any)._favoriteSlugs.set([]);
    (component.favoritesService as any)._removedSlugs.set(new Set());

    const mockExp1: any = {
      id: 'exp-1',
      slug: 'kayak-1',
      title: 'Kayak 1',
      region: 'Catamarca',
      difficulty: 'Baja',
      durationLabel: '2 horas',
      priceArs: 15000,
      coverImage: '/assets/images/kayak.jpg',
    };
    const mockExp2: any = {
      id: 'exp-2',
      slug: 'kayak-2',
      title: 'Kayak 2',
      region: 'Catamarca',
      difficulty: 'Media',
      durationLabel: '3 horas',
      priceArs: 20000,
      coverImage: '/assets/images/kayak2.jpg',
    };
    (component.experienceService as any)._experiences.set([mockExp1, mockExp2]);
    component.favoritesService.toggleFavorite(mockExp1);
    component.favoritesService.toggleFavorite(mockExp2);
    fixture.detectChanges();

    const track = fixture.nativeElement.querySelector('.fav-carousel-track') as HTMLElement;
    expect(track).toBeTruthy();

    const items = track.querySelectorAll<HTMLElement>('.carousel-item');
    if (items[0]) {
      Object.defineProperty(items[0], 'offsetLeft', { value: 0, configurable: true });
    }
    if (items[1]) {
      Object.defineProperty(items[1], 'offsetLeft', { value: 240, configurable: true });
    }

    const scrollBySpy = vi.fn((options: any) => {
      const delta = typeof options === 'object' ? (options.left ?? 0) : options;
      track.scrollLeft = (track.scrollLeft || 0) + delta;
    });
    track.scrollBy = scrollBySpy;

    const initialScroll = track.scrollLeft;
    component.onCarouselNav('next');
    expect(scrollBySpy).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'smooth' }));
    expect(scrollBySpy.mock.calls[0][0].left).toBeGreaterThan(0);
    expect(track.scrollLeft).toBeGreaterThan(initialScroll);

    const nextScroll = track.scrollLeft;
    component.onCarouselNav('prev');
    expect(scrollBySpy).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'smooth' }));
    expect(scrollBySpy.mock.calls[1][0].left).toBeLessThan(0);
    expect(track.scrollLeft).toBeLessThan(nextScroll);

    expect((component as any).isUserHovering).toBe(false);
    component.onCarouselMouseEnter();
    expect((component as any).isUserHovering).toBe(true);
    component.onCarouselMouseLeave();
    expect((component as any).isUserHovering).toBe(false);

    component.stopAutoplay();
  });

  it('should schedule carousel initialization when carouselFavoriteExperiences changes from empty to non-empty', () => {
    localStorage.clear();
    (component.newsletter as any)._currentMember.set({
      id: 'socio-1',
      email: 'socio@experiencias.club',
      fullName: 'Socio Test',
      status: 'confirmed',
      createdAt: new Date().toISOString(),
    });
    (component.favoritesService as any).activeMemberIdentity = 'socio@experiencias.club';
    (component.favoritesService as any)._favoriteSlugs.set([]);
    (component.favoritesService as any)._removedSlugs.set(new Set());
    (component.experienceService as any)._experiences.set([]);
    fixture.detectChanges();

    const scheduleSpy = vi.spyOn(component as any, 'scheduleCarouselInit');

    const mockExp: any = {
      id: 'exp-1',
      slug: 'kayak-1',
      title: 'Kayak 1',
      region: 'Catamarca',
      difficulty: 'Baja',
      durationLabel: '2 horas',
      priceArs: 15000,
      coverImage: '/assets/images/kayak.jpg',
    };
    (component.experienceService as any)._experiences.set([mockExp]);
    component.favoritesService.toggleFavorite(mockExp);
    fixture.detectChanges();

    expect(scheduleSpy).toHaveBeenCalled();
  });

  it('should remove experience from selectedExperiences when favorite is toggled off via onCardFavoriteToggled', () => {
    const mockExp: any = {
      id: 'exp-wishlist-1',
      slug: 'kayak-wishlist',
      title: 'Kayak Wishlist',
      region: 'Catamarca',
      priceArs: 15000,
    };
    component.selectedExperiences.set(['exp-wishlist-1', 'other-exp']);

    // Experience is NOT a favorite
    vi.spyOn(component, 'isFavorite').mockReturnValue(false);
    const scheduleSpy = vi.spyOn(component as any, 'scheduleCarouselInit');

    component.onCardFavoriteToggled({ experience: mockExp });

    expect(component.selectedExperiences()).toEqual(['other-exp']);
    expect(scheduleSpy).toHaveBeenCalled();
  });

  it('should preserve selectedExperiences when favorite is toggled on or remains a favorite via onCardFavoriteToggled', () => {
    const mockExp: any = {
      id: 'exp-wishlist-1',
      slug: 'kayak-wishlist',
      title: 'Kayak Wishlist',
      region: 'Catamarca',
      priceArs: 15000,
    };
    component.selectedExperiences.set(['exp-wishlist-1', 'other-exp']);

    // Experience IS a favorite
    vi.spyOn(component, 'isFavorite').mockReturnValue(true);
    const scheduleSpy = vi.spyOn(component as any, 'scheduleCarouselInit');

    component.onCardFavoriteToggled({ experience: mockExp });

    expect(component.selectedExperiences()).toEqual(['exp-wishlist-1', 'other-exp']);
    expect(scheduleSpy).toHaveBeenCalled();
  });
});
