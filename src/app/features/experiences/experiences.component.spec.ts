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
      providers: [provideRouter([])],
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
    const hrefs = Array.from(navLinks).map(
      (a: any) => a.getAttribute('routerlink') || a.getAttribute('href'),
    );
    expect(hrefs).toContain('/socios');
    expect(hrefs).not.toContain('/prestadores');
  });

  it('should map provider slug "club" alias to "club-de-experiencias" and preserve other slugs', () => {
    const expWithClub = {
      id: 'test-1',
      title: 'Test',
      providerSlug: 'club',
    } as any;
    expect(component.getProviderSlug(expWithClub)).toBe('club-de-experiencias');

    const expCustom = {
      id: 'test-2',
      title: 'Test 2',
      providerSlug: 'guia-montana',
    } as any;
    expect(component.getProviderSlug(expCustom)).toBe('guia-montana');
  });

  it('should include Ninguna in difficulty filter options', () => {
    const diffSelect: HTMLSelectElement = fixture.nativeElement.querySelector('#filter-difficulty');
    expect(diffSelect).toBeTruthy();
    const options = Array.from(diffSelect.options).map((opt) => opt.value);
    expect(options).toContain('Ninguna');
  });

  it('should not display difficulty stat when difficulty is Ninguna', () => {
    const exp = component.experienceService.publishedExperiences()[0];
    (component.experienceService as any)._experiences.set([
      {
        ...exp,
        id: 'test-ninguna',
        title: 'Expedición Ninguna',
        difficulty: 'Ninguna',
        isLocked: false,
        status: 'publicada',
      },
    ]);
    fixture.detectChanges();

    const catalogItems = fixture.nativeElement.querySelectorAll('.exp-catalog-item');
    expect(catalogItems.length).toBeGreaterThan(0);
    const metaRowText = catalogItems[0].querySelector('.exp-meta-row')?.textContent || '';
    expect(metaRowText).not.toContain('Dificultad');
  });
});
