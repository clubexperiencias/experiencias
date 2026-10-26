import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ExperiencesComponent } from './experiences.component';

describe('ExperiencesComponent (/experiencias)', () => {
  let component: ExperiencesComponent;
  let fixture: ComponentFixture<ExperiencesComponent>;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [ExperiencesComponent],
      providers: [provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(ExperiencesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the component and display main title and experience catalog items', () => {
    expect(component).toBeTruthy();
    const heading = fixture.nativeElement.querySelector('.section-main-title');
    expect(heading).toBeTruthy();
    expect(heading.textContent).toContain('Expediciones de Alta Montaña & Náuticas');

    const expCards = fixture.nativeElement.querySelectorAll('.exp-catalog-item');
    expect(expCards.length).toBeGreaterThanOrEqual(2);
  });

  it('should toggle technical details when clicking details button', () => {
    const firstExp = component.experienceService.experiences()[0];
    component.toggleExperienceDetails(firstExp);
    fixture.detectChanges();

    expect(component.selectedExperience()?.id).toBe(firstExp.id);
    const detailsPanel = fixture.nativeElement.querySelector('.exp-details-panel');
    expect(detailsPanel).toBeTruthy();
    expect(detailsPanel.textContent).toContain(firstExp.title);

    // Toggle off
    component.toggleExperienceDetails(firstExp);
    fixture.detectChanges();
    expect(component.selectedExperience()).toBeNull();
  });

  it('should link back to root / from the logo', () => {
    const brandLink = fixture.nativeElement.querySelector('.brand');
    expect(brandLink.getAttribute('routerlink') || brandLink.getAttribute('href')).toBe('/');
  });

  it('should link to /socios in the desktop nav and not include Prestadores', () => {
    const navLinks = fixture.nativeElement.querySelectorAll('.nav-actions a');
    const hrefs = Array.from(navLinks).map((a: any) => a.getAttribute('routerlink') || a.getAttribute('href'));
    expect(hrefs).toContain('/socios');
    expect(hrefs).not.toContain('/prestadores');
  });
});
