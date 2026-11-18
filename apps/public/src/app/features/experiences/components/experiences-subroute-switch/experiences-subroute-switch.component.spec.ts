import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ExperiencesSubrouteSwitchComponent } from './experiences-subroute-switch.component';

describe('ExperiencesSubrouteSwitchComponent', () => {
  let component: ExperiencesSubrouteSwitchComponent;
  let fixture: ComponentFixture<ExperiencesSubrouteSwitchComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExperiencesSubrouteSwitchComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(ExperiencesSubrouteSwitchComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the subroute switch component', () => {
    expect(component).toBeTruthy();
  });

  it('should render both subroute tabs', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const tabs = compiled.querySelectorAll('.subroute-tab');
    expect(tabs.length).toBe(2);
    expect(tabs[0].textContent).toContain('Expediciones & Aventuras');
    expect(tabs[1].textContent).toContain('Hospedajes & Refugios');
  });

  it('should default to expediciones tab if active not specified', () => {
    expect(component.currentTab()).toBe('expediciones');
    const compiled = fixture.nativeElement as HTMLElement;
    const activeTab = compiled.querySelector('.subroute-tab.is-active');
    expect(activeTab?.textContent).toContain('Expediciones & Aventuras');
  });

  it('should update currentTab immediately on onSelect without waiting', () => {
    component.onSelect('hospedajes');
    expect(component.currentTab()).toBe('hospedajes');
    fixture.detectChanges();
    const activeTab = fixture.nativeElement.querySelector('.subroute-tab.is-active');
    expect(activeTab?.textContent).toContain('Hospedajes & Refugios');
  });

  it('should update tab on mousedown event for instantaneous feedback', () => {
    const tabs = fixture.nativeElement.querySelectorAll('.subroute-tab');
    const hospedajesTab = tabs[1] as HTMLElement;
    hospedajesTab.dispatchEvent(new MouseEvent('mousedown'));
    expect(component.currentTab()).toBe('hospedajes');
    fixture.detectChanges();
    const activeTab = fixture.nativeElement.querySelector('.subroute-tab.is-active');
    expect(activeTab?.textContent).toContain('Hospedajes & Refugios');
  });
});

