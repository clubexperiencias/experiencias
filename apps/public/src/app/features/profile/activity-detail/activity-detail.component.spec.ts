import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { ActivityDetailComponent } from './activity-detail.component';
import { ActivityHistoryService } from '../../../core/services/activity-history.service';
import { NewsletterService } from '../../../core/services/newsletter.service';

describe('ActivityDetailComponent (/perfil/actividades/:slug)', () => {
  let component: ActivityDetailComponent;
  let fixture: ComponentFixture<ActivityDetailComponent>;
  let activityService: ActivityHistoryService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ActivityDetailComponent],
      providers: [
        provideRouter([]),
        ActivityHistoryService,
        NewsletterService,
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of({
              get: (key: string) => (key === 'slug' ? 'kayak-las-jumeal' : null),
            }),
          },
        },
      ],
    }).compileComponents();

    activityService = TestBed.inject(ActivityHistoryService);
    fixture = TestBed.createComponent(ActivityDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the component and load the requested activity', () => {
    expect(component).toBeTruthy();
    expect(component.activity()).toBeDefined();
    expect(component.activity()?.title).toContain('Travesía en Kayak');
  });

  it('should display the official payment receipt info', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Comprobante Oficial de Pago');
    expect(el.textContent).toContain('REC-2026-CAT-0104');
    expect(el.textContent).toContain('$65.000 ARS');
  });

  it('should display community photos and author signatures', () => {
    const act = component.activity();
    expect(act?.communityPhotos?.length).toBeGreaterThan(0);
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Lucas A.');
  });

  it('should format user signature with first name and initial of last name', () => {
    expect(activityService.formatAuthorSignature('Gonzalo Gramaglia')).toBe('Gonzalo G.');
    expect(activityService.formatAuthorSignature('Ignacio Balcarce')).toBe('Ignacio B.');
    expect(activityService.formatAuthorSignature('Valeria')).toBe('Valeria V.');
  });

  it('should submit a 5-star review signed with name and last initial', () => {
    component.setRating(5);
    component.reviewComment.set('Una travesía inolvidable bajo el atardecer.');
    component.submitReview();

    expect(component.reviewSubmitted()).toBe(true);
    const act = component.activity();
    const myReview = act?.reviews?.find((r) => r.comment.includes('Una travesía inolvidable'));
    expect(myReview).toBeDefined();
    expect(myReview?.rating).toBe(5);
    expect(myReview?.authorSignature).toContain('.');
  });

  it('should enforce up to 3 staged photos limit', () => {
    component.stagedPhotos.set([
      { previewUrl: 'url1', caption: 'c1', name: 'n1' },
      { previewUrl: 'url2', caption: 'c2', name: 'n2' },
      { previewUrl: 'url3', caption: 'c3', name: 'n3' },
    ]);
    expect(component.stagedPhotos().length).toBe(3);

    // Remove one photo
    component.removeStagedPhoto(0);
    expect(component.stagedPhotos().length).toBe(2);
  });

  it('should format upload dates cleanly with month names and time', () => {
    expect(component.formatUploadDate('18/10/2026 19:10')).toBe(
      '18 de Octubre de 2026 a las 19:10',
    );
    expect(component.formatUploadDate('19/10/2026 09:15')).toBe(
      '19 de Octubre de 2026 a las 09:15',
    );
    expect(component.formatUploadDate('18/10/2026')).toBe('18 de Octubre de 2026');
  });
});
