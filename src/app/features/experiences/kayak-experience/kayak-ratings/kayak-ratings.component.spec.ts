import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { KayakRatingsComponent } from './kayak-ratings.component';

describe('KayakRatingsComponent (/experiencias/kayak/calificaciones)', () => {
  let component: KayakRatingsComponent;
  let fixture: ComponentFixture<KayakRatingsComponent>;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [KayakRatingsComponent],
      providers: [provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(KayakRatingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the component and display main heading', () => {
    expect(component).toBeTruthy();
    const heading = fixture.nativeElement.querySelector('.page-title');
    expect(heading).toBeTruthy();
    expect(heading.textContent).toContain('Calificaciones & Reseñas de la Travesía');
  });

  it('should display the summary rating and verified reviews count', () => {
    const scoreVal = fixture.nativeElement.querySelector('.big-score-val');
    expect(scoreVal).toBeTruthy();
    expect(scoreVal.textContent).toContain('4.95');

    const reviewsCount = fixture.nativeElement.querySelector('.score-reviews-count');
    expect(reviewsCount).toBeTruthy();
    expect(reviewsCount.textContent).toContain('62 valoraciones verificadas');
  });

  it('should render reviews with provider replies', () => {
    const reviewCards = fixture.nativeElement.querySelectorAll('.review-item-card');
    expect(reviewCards.length).toBeGreaterThan(0);

    const providerReplies = fixture.nativeElement.querySelectorAll('.provider-reply-box');
    expect(providerReplies.length).toBeGreaterThan(0);

    const firstReply = providerReplies[0];
    expect(firstReply.textContent).toContain('Lucas Nieto');
    expect(firstReply.textContent).toContain('Prestador Oficial Habilitado');
  });

  it('should filter reviews correctly', () => {
    component.setFilter('5-stars');
    fixture.detectChanges();
    const fiveStarReviews = component.filteredReviews();
    expect(fiveStarReviews.every((r) => r.rating === 5)).toBe(true);

    component.setFilter('with-reply');
    fixture.detectChanges();
    const withReplyReviews = component.filteredReviews();
    expect(withReplyReviews.every((r) => !!r.providerReply)).toBe(true);
  });

  it('should display profile invitation button opening /perfil in another tab and keep fields locked when profile is incomplete', () => {
    // Member has no profile data initially
    expect(component.hasProfileCompleted()).toBe(false);

    const notice = fixture.nativeElement.querySelector('.profile-incomplete-notice');
    expect(notice).toBeTruthy();
    expect(notice.textContent).toContain('Completá tu perfil para publicar una reseña');

    const profileLink = fixture.nativeElement.querySelector('.complete-profile-btn');
    expect(profileLink).toBeTruthy();
    expect(profileLink.getAttribute('href')).toBe('/perfil');
    expect(profileLink.getAttribute('target')).toBe('_blank');

    const nameInput = fixture.nativeElement.querySelector('#rev-inline-name');
    const locInput = fixture.nativeElement.querySelector('#rev-inline-loc');
    expect(nameInput.hasAttribute('disabled')).toBe(true);
    expect(nameInput.hasAttribute('readonly')).toBe(true);
    expect(locInput.hasAttribute('disabled')).toBe(true);
    expect(locInput.hasAttribute('readonly')).toBe(true);

    const submitBtn = fixture.nativeElement.querySelector('.submit-review-btn');
    expect(submitBtn.disabled).toBe(true);
  });

  it('should allow user to submit a review with profile data once profile is completed and receive immediate provider feedback', async () => {
    await component.newsletter.joinWaitlist({
      email: 'juan@ejemplo.com',
      fullName: 'Juan Pérez',
      nationality: 'Córdoba, Argentina'
    });
    fixture.detectChanges();

    expect(component.hasProfileCompleted()).toBe(true);
    expect(component.memberProfileName()).toBe('Juan Pérez');
    expect(component.memberProfileLocation()).toBe('Córdoba, Argentina');

    const notice = fixture.nativeElement.querySelector('.profile-incomplete-notice');
    expect(notice).toBeFalsy();

    const initialCount = component.reviewsList().length;
    component.newTitle.set('Travesía maravillosa en Catamarca');
    component.newComment.set('Excelente atención y kayak de primera calidad en Las Pirquitas.');
    component.submitReview();
    fixture.detectChanges();

    expect(component.reviewsList().length).toBe(initialCount + 1);
    expect(component.reviewSubmitted()).toBe(true);

    const latestReview = component.reviewsList()[0];
    expect(latestReview.title).toBe('Travesía maravillosa en Catamarca');
    expect(latestReview.userName).toBe('Juan Pérez');
    expect(latestReview.userLocation).toBe('Córdoba, Argentina');
    expect(latestReview.providerReply).toBeDefined();
    expect(latestReview.providerReply?.responderName).toContain('Lucas Nieto');
  });

  it('should display ad banner linking to /socios/fundadores', () => {
    const adWrapper = fixture.nativeElement.querySelector('.kayak-ad-wrapper');
    expect(adWrapper).toBeTruthy();
    const adLink = fixture.nativeElement.querySelector('.ad-banner-link');
    expect(adLink).toBeTruthy();
    expect(adLink.getAttribute('routerlink') || adLink.getAttribute('href')).toBe('/socios/fundadores');
    const adImg = fixture.nativeElement.querySelector('.ad-banner-img');
    expect(adImg).toBeTruthy();
    expect(adImg.getAttribute('src')).toContain('ad.png');
  });

  it('should display the review creation box with 3 voting aspects and clean user location', () => {
    const createReviewBox = fixture.nativeElement.querySelector('.create-review-card');
    expect(createReviewBox).toBeTruthy();

    const aspectCards = fixture.nativeElement.querySelectorAll('.aspect-vote-card');
    expect(aspectCards.length).toBe(3);
    expect(createReviewBox.textContent).toContain('Entorno Natural & Travesía en Kayak');
    expect(createReviewBox.textContent).toContain('Equipamiento Náutico');
    expect(createReviewBox.textContent).toContain('Guías & Asistencia Técnica');

    // Test aspect rating interaction
    component.setAspectRating('equipment', 4);
    expect(component.ratingEquipment()).toBe(4);

    // Verify clean user location without activityDate
    const firstUserLoc = fixture.nativeElement.querySelector('.user-location');
    expect(firstUserLoc).toBeTruthy();
    expect(firstUserLoc.textContent.trim()).toBe('Córdoba, Argentina');

    // Verify provider avatar placeholder matches socio styling with initial
    const providerAvatar = fixture.nativeElement.querySelector('.provider-avatar-initials');
    expect(providerAvatar).toBeTruthy();
    expect(providerAvatar.textContent.trim()).toBe('L');
  });
});
