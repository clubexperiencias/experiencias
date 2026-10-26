import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { BreadcrumbComponent } from './breadcrumb.component';

describe('BreadcrumbComponent', () => {
  let component: BreadcrumbComponent;
  let fixture: ComponentFixture<BreadcrumbComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BreadcrumbComponent],
      providers: [provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(BreadcrumbComponent);
    component = fixture.componentInstance;
  });

  it('should render breadcrumb with #FFCC00 yellow background and proper links', () => {
    fixture.componentRef.setInput('items', [
      { label: 'Inicio', url: '/' },
      { label: 'Niveles de Socio', url: '/socios' },
      { label: 'Socio Activo' }
    ]);
    fixture.detectChanges();

    const bar = fixture.nativeElement.querySelector('.breadcrumb-bar');
    expect(bar).toBeTruthy();

    const links = fixture.nativeElement.querySelectorAll('.bc-link');
    expect(links.length).toBe(2);
    expect(links[0].getAttribute('routerlink') || links[0].getAttribute('href')).toBe('/');
    expect(links[1].getAttribute('routerlink') || links[1].getAttribute('href')).toBe('/socios');

    const current = fixture.nativeElement.querySelector('.bc-current');
    expect(current).toBeTruthy();
    expect(current.textContent).toContain('Socio Activo');
  });
});
