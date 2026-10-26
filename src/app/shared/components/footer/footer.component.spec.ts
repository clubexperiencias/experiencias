import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { FooterComponent } from './footer.component';

describe('FooterComponent', () => {
  let component: FooterComponent;
  let fixture: ComponentFixture<FooterComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FooterComponent],
      providers: [provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(FooterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should render location text and provider link', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.location-place')?.textContent).toContain('Laguna Blanca');
    const providerLink = compiled.querySelector('.footer-provider-link');
    expect(providerLink).toBeTruthy();
    expect(providerLink?.getAttribute('routerLink')).toBe('/experiencias/prestadores');
  });
});
