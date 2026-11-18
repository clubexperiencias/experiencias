import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal, WritableSignal } from '@angular/core';
import { MembersComponent } from './members.component';
import { TestimoniosService } from '../../core/services/testimonios.service';

describe('MembersComponent (/socios)', () => {
  let component: MembersComponent;
  let fixture: ComponentFixture<MembersComponent>;
  let featuredSignal: WritableSignal<any[]>;
  let communitySignal: WritableSignal<any[]>;

  beforeEach(async () => {
    localStorage.clear();
    featuredSignal = signal<any[]>([]);
    communitySignal = signal<any[]>([]);

    await TestBed.configureTestingModule({
      imports: [MembersComponent],
      providers: [
        provideRouter([]),
        {
          provide: TestimoniosService,
          useValue: {
            featuredTestimonios: featuredSignal,
            communityTestimonios: communitySignal,
            isLoading: signal(false),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MembersComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the component and display main title and 3 tiers', () => {
    expect(component).toBeTruthy();
    const heading = fixture.nativeElement.querySelector('.section-main-title');
    expect(heading).toBeTruthy();
    expect(heading.textContent).toContain('Niveles de Socio del Club');

    const tiers = fixture.nativeElement.querySelectorAll('.tier-card');
    expect(tiers.length).toBe(3);
  });

  it('should link to /socios/fundadores from the founder tier CTA button', () => {
    const founderBtn = fixture.nativeElement.querySelector('.founder-cta');
    expect(founderBtn).toBeTruthy();
    expect(founderBtn.getAttribute('routerlink') || founderBtn.getAttribute('href')).toBe(
      '/socios/fundadores',
    );
  });

  it('should link back to root / from the logo', () => {
    const brandLink = fixture.nativeElement.querySelector('.brand');
    expect(brandLink.getAttribute('routerlink') || brandLink.getAttribute('href')).toBe('/');
  });

  it('should link to /socios/emergentes from the emerging tier CTA button', () => {
    const emergingBtn = fixture.nativeElement.querySelector('.tier-card .default-action');
    expect(emergingBtn).toBeTruthy();
    expect(emergingBtn.getAttribute('routerlink') || emergingBtn.getAttribute('href')).toBe(
      '/socios/emergentes',
    );
  });

  it('should link to /experiencias in the desktop nav and not include Prestadores', () => {
    const navLinks = fixture.nativeElement.querySelectorAll('.nav-actions a');
    const hrefs = Array.from(navLinks).map(
      (a: any) => a.getAttribute('routerlink') || a.getAttribute('href'),
    );
    expect(hrefs).toContain('/experiencias');
    expect(hrefs).not.toContain('/prestadores');
  });

  it('should preserve focus when keyboard-focused share card is replaced by arriving active testimonials', fakeAsync(() => {
    // Initially featuredTestimonios is empty, so share card is displayed
    fixture.detectChanges();
    const shareCard = fixture.nativeElement.querySelector('.showcase-add-card') as HTMLElement;
    expect(shareCard).toBeTruthy();

    // User focuses the share card via keyboard
    shareCard.focus();
    expect(document.activeElement).toBe(shareCard);

    // Active testimonial arrives
    featuredSignal.set([
      {
        id: 't-1',
        authorDisplay: 'Lucía M.',
        membershipTier: 'fundador',
        content: 'Una experiencia inolvidable en Catamarca.',
        createdAt: '2026-01-01',
      },
    ]);
    fixture.detectChanges();

    // Fast forward macro/microtasks
    tick(10);
    fixture.detectChanges();

    // Focus must not be lost to body; it should be on a valid element (the arriving active testimonial or stable target)
    expect(document.activeElement).not.toBe(document.body);
    const activeTestimonial = fixture.nativeElement.querySelector('.featured-testimonial');
    expect(
      document.activeElement === activeTestimonial ||
        fixture.nativeElement.contains(document.activeElement),
    ).toBe(true);
  }));

  describe('construction notice toast', () => {
    it('should show the construction notice toast after init delay and auto-dismiss after 7 seconds', fakeAsync(() => {
      component.triggerConstructionNotice();
      expect(component.showConstructionNotice()).toBeFalse();

      tick(70);
      fixture.detectChanges();
      expect(component.showConstructionNotice()).toBeTrue();

      const toast = fixture.nativeElement.querySelector('.is-construction-toast');
      expect(toast).toBeTruthy();
      expect(toast.textContent).toContain('¡Plataforma en Construcción!');
      expect(toast.textContent).toContain('hardcodeadas');

      tick(7000);
      fixture.detectChanges();
      expect(component.showConstructionNotice()).toBeFalse();
    }));

    it('should dismiss the notice immediately when dismissConstructionNotice is called', fakeAsync(() => {
      component.triggerConstructionNotice();
      tick(70);
      fixture.detectChanges();
      expect(component.showConstructionNotice()).toBeTrue();

      component.dismissConstructionNotice();
      fixture.detectChanges();
      expect(component.showConstructionNotice()).toBeFalse();
    }));
  });
});
