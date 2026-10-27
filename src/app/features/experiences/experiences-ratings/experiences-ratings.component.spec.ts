import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ExperiencesRatingsComponent } from './experiences-ratings.component';

describe('ExperiencesRatingsComponent (/experiencias/calificaciones)', () => {
  let component: ExperiencesRatingsComponent;
  let fixture: ComponentFixture<ExperiencesRatingsComponent>;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [ExperiencesRatingsComponent],
      providers: [provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(ExperiencesRatingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the component and display main heading and breadcrumbs', () => {
    expect(component).toBeTruthy();
    const title = fixture.nativeElement.querySelector('.editorial-title');
    expect(title).toBeTruthy();
    expect(title.textContent).toContain('Calificaciones Verificadas del Club');

    const breadcrumb = fixture.nativeElement.querySelector('.breadcrumb-bar');
    expect(breadcrumb).toBeTruthy();
    expect(breadcrumb.textContent).toContain('Calificaciones Verificadas');
  });

  it('should render the overall score and verified reviews count', () => {
    const scoreVal = fixture.nativeElement.querySelector('.score-number');
    expect(scoreVal).toBeTruthy();
    expect(scoreVal.textContent).toContain('4.96');

    const badge = fixture.nativeElement.querySelector('.score-count-badge');
    expect(badge).toBeTruthy();
    expect(badge.textContent).toContain('149 VALORACIONES VERIFICADAS');
  });

  it('should filter reviews by experience', () => {
    component.setFilter('kayak');
    fixture.detectChanges();
    const kayakReviews = component.filteredReviews();
    expect(kayakReviews.every((r) => r.experienceSlug === 'kayak')).toBe(true);

    component.setFilter('pomez');
    fixture.detectChanges();
    const pomezReviews = component.filteredReviews();
    expect(pomezReviews.every((r) => r.experienceSlug === 'pomez')).toBe(true);
  });

  it('should allow submitting a new verified review', () => {
    const initialCount = component.reviewsList().length;
    component.newExperience.set('pomez');
    component.newTitle.set('Increíble expedición a la Puna');
    component.newComment.set('El silencio y el cielo estrellado superaron todas mis expectativas.');
    component.newUserName.set('Lucas G.');

    component.submitReview();
    fixture.detectChanges();

    expect(component.reviewsList().length).toBe(initialCount + 1);
    expect(component.reviewSubmitted()).toBe(true);

    const latest = component.reviewsList()[0];
    expect(latest.title).toBe('Increíble expedición a la Puna');
    expect(latest.providerReply).toBeDefined();
  });
});
