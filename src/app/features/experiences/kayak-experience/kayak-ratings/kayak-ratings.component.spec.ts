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

  it('should allow user to submit a review and receive immediate provider feedback', () => {
    const initialCount = component.reviewsList().length;
    component.newTitle.set('Travesía maravillosa en Catamarca');
    component.newComment.set('Excelente atención y kayak de primera calidad en Las Pirquitas.');
    component.newUserName.set('Juan Pérez');
    component.submitReview();
    fixture.detectChanges();

    expect(component.reviewsList().length).toBe(initialCount + 1);
    expect(component.reviewSubmitted()).toBe(true);

    const latestReview = component.reviewsList()[0];
    expect(latestReview.title).toBe('Travesía maravillosa en Catamarca');
    expect(latestReview.providerReply).toBeDefined();
    expect(latestReview.providerReply?.responderName).toContain('Lucas Nieto');
  });
});
