import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { BreadcrumbComponent } from './breadcrumb.component';

describe('BreadcrumbComponent', () => {
  let component: BreadcrumbComponent;
  let fixture: ComponentFixture<BreadcrumbComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BreadcrumbComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(BreadcrumbComponent);
    component = fixture.componentInstance;
  });

  it('should render breadcrumb with #FFCC00 yellow background and proper links', () => {
    fixture.componentRef.setInput('items', [
      { label: 'Inicio', url: '/' },
      { label: 'Niveles de Socio', url: '/socios' },
      { label: 'Socios Plenos' },
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
    expect(current.textContent).toContain('Socios Plenos');
  });

  it('should not render a home icon in the breadcrumb', () => {
    fixture.componentRef.setInput('items', [
      { label: 'Inicio', url: '/' },
      { label: 'Experiencias' },
    ]);
    fixture.detectChanges();

    const homeIcon = fixture.nativeElement.querySelector('.bc-icon');
    expect(homeIcon).toBeNull();
  });

  it('should render National Geographic style mega-menu on all breadcrumb items including the last one', () => {
    fixture.componentRef.setInput('items', [
      { label: 'Inicio', url: '/' },
      { label: 'Experiencias' },
    ]);
    fixture.detectChanges();

    const wrappers = fixture.nativeElement.querySelectorAll('.bc-step-wrapper');
    expect(wrappers.length).toBe(2);

    // Primer item (Inicio): tiene menú desplegable
    expect(wrappers[0].classList.contains('has-dropdown')).toBe(true);
    const firstMenu = wrappers[0].querySelector('.natgeo-mega-menu');
    expect(firstMenu).toBeTruthy();
    const topics = firstMenu.querySelectorAll('.natgeo-topic-link');
    expect(topics.length).toBeGreaterThan(0);

    // Segundo item (Experiencias, último de la ruta): también tiene menú desplegable
    expect(wrappers[1].classList.contains('has-dropdown')).toBe(true);
    const secondMenu = wrappers[1].querySelector('.natgeo-mega-menu');
    expect(secondMenu).toBeTruthy();
  });

  it('should activate mega-menu on Inicio even when it is the only breadcrumb item', () => {
    fixture.componentRef.setInput('items', [{ label: 'Inicio' }]);
    fixture.detectChanges();

    const wrappers = fixture.nativeElement.querySelectorAll('.bc-step-wrapper');
    expect(wrappers.length).toBe(1);
    expect(wrappers[0].classList.contains('has-dropdown')).toBe(true);
    expect(wrappers[0].querySelector('.natgeo-mega-menu')).toBeTruthy();
  });

  it('should use sumate.png for secondaryCard founder card in mega-menu', () => {
    fixture.componentRef.setInput('items', [
      { label: 'Inicio', url: '/' },
      { label: 'Experiencias' },
    ]);
    fixture.detectChanges();

    const founderImg = fixture.nativeElement.querySelector('.natgeo-founder-col .featured-img');
    expect(founderImg).toBeTruthy();
    expect(founderImg.getAttribute('src')).toContain('sumate.png');
  });
});
