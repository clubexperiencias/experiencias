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

  describe('duration options & normalization', () => {
    it('should include 15 a 30 minutos (Express), 30 minutos, 30 a 45 minutos, and 1 hora', () => {
      expect(component.durationOptions).toContain('15 a 30 minutos (Express)');
      expect(component.durationOptions).toContain('30 minutos');
      expect(component.durationOptions).toContain('30 a 45 minutos');
      expect(component.durationOptions).toContain('1 hora');
    });

    it('should include 1 a 2 horas and not 1 a 2 horas (Paseo express)', () => {
      expect(component.durationOptions).toContain('1 a 2 horas');
      expect(component.durationOptions).not.toContain('1 a 2 horas (Paseo express)');
    });

    it('should automatically normalize legacy "1 a 2 horas (Paseo express)" to "1 a 2 horas"', () => {
      component.populateForm({
        durationLabel: '1 a 2 horas (Paseo express)',
      });
      expect(component.form.controls.durationLabel.value).toBe('1 a 2 horas');
    });
  });

  describe('provider transfer dropdown and auto-population', () => {
    const mockProviders = [
      {
        id: 'prov-patricio',
        name: 'Patricio Diaz',
        agency: 'Catamarca Kayak',
        email: 'patricio@kayak.com',
        phone: '+54 9 383 4112233',
        cbuAlias: 'PATRICIO.KAYAK.MP',
        cuitDni: '20-33445566-7',
        bankName: 'Mercado Pago',
      },
      {
        id: 'prov-juan',
        name: 'Juan Perez',
        agency: 'Trekking Puna',
        email: 'juan@puna.com',
        phone: '+54 9 383 4998877',
        cbuAlias: 'JUAN.TREKKING.BNA',
        cuitDni: '20-11223344-5',
        bankName: 'Banco Nación',
      },
    ] as any[];

    const mockClubProfile = {
      name: 'Club de Experiencias',
      phone: '+54 9 383 4000000',
      cbuAlias: 'CLUB.OFICIAL.BNA',
      cuitDni: '30-12345678-9',
      bankName: 'Banco Nación Oficial',
      email: 'admin@experiencias.club',
    };

    beforeEach(() => {
      fixture.componentRef.setInput('mode', 'admin');
      fixture.componentRef.setInput('registeredProviders', mockProviders);
      fixture.componentRef.setInput('clubProfile', mockClubProfile);
      fixture.detectChanges();
    });

    it('should render provider selector dropdown in admin mode', () => {
      const selectEl = fixture.nativeElement.querySelector('#providerSelector');
      expect(selectEl).toBeTruthy();
      expect(selectEl.textContent).toContain('Cuenta Oficial del Club de Experiencias');
      expect(selectEl.textContent).toContain('Catamarca Kayak');
      expect(selectEl.textContent).toContain('Trekking Puna');
      expect(selectEl.textContent).toContain('Prestador manual / Personalizado');
    });

    it('should auto-populate provider form fields when selecting a registered provider', () => {
      component.onSelectProvider('prov-patricio');
      fixture.detectChanges();

      expect(component.selectedProviderId()).toBe('prov-patricio');
      expect(component.isClubExperience).toBe(false);
      expect(component.form.controls.providerName.value).toBe('Catamarca Kayak');
      expect(component.form.controls.providerPhone.value).toBe('+54 9 383 4112233');
      expect(component.form.controls.providerCbuAlias.value).toBe('PATRICIO.KAYAK.MP');
      expect(component.form.controls.providerCuitDni.value).toBe('20-33445566-7');
      expect(component.form.controls.providerBankName.value).toBe('Mercado Pago');
    });

    it('should auto-populate club credentials when selecting the official club option', () => {
      component.onSelectProvider('club');
      fixture.detectChanges();

      expect(component.selectedProviderId()).toBe('club');
      expect(component.isClubExperience).toBe(true);
      expect(component.form.controls.providerName.value).toBe('Club de Experiencias');
      expect(component.form.controls.providerPhone.value).toBe('+54 9 383 4000000');
      expect(component.form.controls.providerCbuAlias.value).toBe('CLUB.OFICIAL.BNA');
      expect(component.form.controls.providerCuitDni.value).toBe('30-12345678-9');
      expect(component.form.controls.providerBankName.value).toBe('Banco Nación Oficial');
    });

    it('should auto-detect matching provider when populating form from an existing experience', () => {
      component.populateForm({
        title: 'Travesía Kayak',
        providerId: 'prov-patricio',
        providerName: 'Catamarca Kayak',
      });

      expect(component.selectedProviderId()).toBe('prov-patricio');
      expect(component.isClubExperience).toBe(false);
    });

    it('should auto-detect club when populating form from a club experience', () => {
      component.populateForm({
        title: 'Expedición Oficial',
        isClubExperience: true,
        providerName: 'Club de Experiencias',
      });

      expect(component.selectedProviderId()).toBe('club');
    });
  });
});

