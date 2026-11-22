import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ExperienceFormComponent } from './experience-form.component';

describe('ExperienceFormComponent - isLodging & calculatedUsd reactivity', () => {
  let component: ExperienceFormComponent;
  let fixture: ComponentFixture<ExperienceFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExperienceFormComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(ExperienceFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe('isLodging signal derived from valueChanges', () => {
    it('should be false initially for expediciones', () => {
      expect(component.isLodging()).toBe(false);
    });

    it('should update to true when category control changes to hospedajes', () => {
      component.form.controls.category.setValue('hospedajes');
      expect(component.isLodging()).toBe(true);
    });

    it('should update to false when category control changes from hospedajes to expediciones', () => {
      component.form.controls.category.setValue('hospedajes');
      expect(component.isLodging()).toBe(true);

      component.form.controls.category.setValue('expediciones');
      expect(component.isLodging()).toBe(false);
    });

    it('should update template labels dynamically when category changes', () => {
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      expect(el.textContent).toContain('Nivel de exigencia física / Dificultad *');
      expect(el.textContent).toContain('Duración estimada *');

      component.form.controls.category.setValue('hospedajes');
      fixture.detectChanges();

      expect(el.textContent).toContain('Tipo de Alojamiento / Accesibilidad *');
      expect(el.textContent).toContain('Estadía mínima sugerida *');
      expect(el.textContent).not.toContain('Nivel de exigencia física / Dificultad *');
    });
  });

  describe('calculatedUsd signal derived from valueChanges', () => {
    it('should calculate initial USD estimate based on default priceArs (65000 / 1300 = 50)', () => {
      expect(component.calculatedUsd()).toBe(50);
    });

    it('should update calculatedUsd when priceArs changes', () => {
      component.form.controls.priceArs.setValue(130000);
      expect(component.calculatedUsd()).toBe(100);

      component.form.controls.priceArs.setValue(260000);
      expect(component.calculatedUsd()).toBe(200);
    });

    it('should update template USD display dynamically when price changes', () => {
      component.form.controls.priceArs.setValue(130000);
      fixture.detectChanges();

      const el = fixture.nativeElement as HTMLElement;
      expect(el.textContent).toContain('~$100 USD');
    });
  });

  describe('populateForm reactivity', () => {
    it('should update isLodging and calculatedUsd when populateForm is called', () => {
      component.populateForm({
        category: 'hospedajes',
        priceArs: 390000,
        title: 'Cabaña en la Quebrada',
      });

      expect(component.isLodging()).toBe(true);
      expect(component.calculatedUsd()).toBe(300);
    });
  });
});

