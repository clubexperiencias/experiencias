import { SimpleChange } from '@angular/core';
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
        mpConnected: true,
        mpCollectorId: 'MP-PATRICIO-COLLECTOR',
        mpNickname: 'Patricio MP',
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
        mpConnected: false,
        mpCollectorId: '',
        mpNickname: '',
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

    it('should not overwrite user-selected provider when registeredProviders changes', () => {
      component.onSelectProvider('prov-juan');
      expect(component.selectedProviderId()).toBe('prov-juan');

      const updatedProviders = [
        ...mockProviders,
        {
          id: 'prov-new',
          name: 'Nuevo Guia',
          agency: 'Nueva Agencia',
          email: 'nuevo@guia.com',
          phone: '+54 9 383 1234567',
        },
      ];

      fixture.componentRef.setInput('registeredProviders', updatedProviders);
      component.ngOnChanges({
        registeredProviders: new SimpleChange(mockProviders, updatedProviders, false),
      });

      expect(component.selectedProviderId()).toBe('prov-juan');
      expect(component.form.controls.providerName.value).toBe('Trekking Puna');
    });

    it('should preserve selected provider ID and corresponding filled fields when registeredProviders list updates', () => {
      component.onSelectProvider('prov-patricio');
      component.form.controls.providerPhone.setValue('+54 9 383 9998888');

      const updatedProviders = mockProviders.map((p) =>
        p.id === 'prov-patricio' ? { ...p, phone: '+54 9 383 0000000' } : p
      );

      fixture.componentRef.setInput('registeredProviders', updatedProviders);
      component.ngOnChanges({
        registeredProviders: new SimpleChange(mockProviders, updatedProviders, false),
      });

      expect(component.selectedProviderId()).toBe('prov-patricio');
      expect(component.form.controls.providerPhone.value).toBe('+54 9 383 9998888');
      expect(component.form.controls.providerName.value).toBe('Catamarca Kayak');
    });

    it('should sync provider from initialExperience on registeredProviders change when no provider was selected', () => {
      component.initialExperience = {
        title: 'Travesía Kayak',
        providerId: 'prov-patricio',
        providerName: 'Catamarca Kayak',
      } as any;
      component.selectedProviderId.set('custom');

      component.ngOnChanges({
        registeredProviders: new SimpleChange([], mockProviders, false),
      });

      expect(component.selectedProviderId()).toBe('prov-patricio');
      expect(component.form.controls.providerName.value).toBe('Catamarca Kayak');
    });

    it('should re-sync provider when initialExperience changes', () => {
      component.onSelectProvider('prov-patricio');
      expect(component.selectedProviderId()).toBe('prov-patricio');

      const newExp = {
        title: 'Expedición Puna',
        providerId: 'prov-juan',
        providerName: 'Trekking Puna',
        providerPhone: '+54 9 383 4998877',
      } as any;
      component.initialExperience = newExp;

      component.ngOnChanges({
        initialExperience: new SimpleChange(null, newExp, false),
      });

      expect(component.selectedProviderId()).toBe('prov-juan');
      expect(component.form.controls.providerName.value).toBe('Trekking Puna');
    });

    it('should search all registeredProviders for exact provider ID match first before falling back to name/email/slug', () => {
      const providers = [
        {
          id: 'prov-imposter',
          name: 'Impostor',
          agency: 'Catamarca Kayak',
          email: 'imposter@kayak.com',
        },
        {
          id: 'prov-real',
          name: 'Real Guide',
          agency: 'Otra Agencia',
          email: 'real@guia.com',
        },
      ] as any[];

      fixture.componentRef.setInput('registeredProviders', providers);

      component.populateForm({
        title: 'Travesía Especial en Kayak',
        tagline: 'Una bajada increíble',
        description: 'Una bajada increíble por los ríos y diques de Catamarca para disfrutar en familia',
        durationLabel: '2 horas',
        meetingPoint: 'Dique El Jumeal',
        providerId: 'prov-real',
        providerName: 'Catamarca Kayak',
      });

      expect(component.selectedProviderId()).toBe('prov-real');

      let emittedPayload: any = null;
      component.saveExperience.subscribe((event) => {
        emittedPayload = event.payload;
      });

      component.onSubmit();
      expect(emittedPayload).toBeTruthy();
      expect(emittedPayload.providerId).toBe('prov-real');
      expect(emittedPayload.providerEmail).toBe('real@guia.com');
    });

    it('should match provider B when providers share an agency and the experience has provider B ID', () => {
      const providersWithSharedAgency = [
        {
          id: 'prov-a',
          name: 'Guía Uno',
          agency: 'Catamarca Kayak Expediciones',
          email: 'guia1@kayak.com',
        },
        {
          id: 'prov-b',
          name: 'Guía Dos',
          agency: 'Catamarca Kayak Expediciones',
          email: 'guia2@kayak.com',
        },
      ] as any[];

      fixture.componentRef.setInput('registeredProviders', providersWithSharedAgency);

      component.populateForm({
        title: 'Travesía Dique El Jumeal',
        tagline: 'Remada guiada en kayak',
        description: 'Recorrido en kayak por el dique con guías experimentados y equipo completo',
        durationLabel: '2 horas',
        meetingPoint: 'Dique El Jumeal',
        providerId: 'prov-b',
        providerName: 'Catamarca Kayak Expediciones',
      });

      expect(component.selectedProviderId()).toBe('prov-b');

      let emittedPayload: any = null;
      component.saveExperience.subscribe((event) => {
        emittedPayload = event.payload;
      });

      component.onSubmit();
      expect(emittedPayload).toBeTruthy();
      expect(emittedPayload.providerId).toBe('prov-b');
      expect(emittedPayload.providerEmail).toBe('guia2@kayak.com');
    });

    it('should keep Mercado Pago panel in sync with current form provider selection and emit providerChange', () => {
      let emittedChange: any = null;
      component.providerChange.subscribe((change) => {
        emittedChange = change;
      });

      // 1. Select prov-patricio (which has mpConnected: true)
      component.onSelectProvider('prov-patricio');
      fixture.detectChanges();

      expect(emittedChange).toEqual({
        providerId: 'prov-patricio',
        isClub: false,
        mpInfo: {
          connected: true,
          collectorId: 'MP-PATRICIO-COLLECTOR',
          nickname: 'Patricio MP',
        },
      });
      expect(component.activeMpInfo().connected).toBe(true);
      expect(component.activeMpInfo().collectorId).toBe('MP-PATRICIO-COLLECTOR');

      const el = fixture.nativeElement as HTMLElement;
      expect(el.textContent).toContain('Cuenta Vinculada');
      expect(el.textContent).toContain('MP-PATRICIO-COLLECTOR');
      expect(el.textContent).toContain('Patricio MP');

      // 2. Switch to prov-juan (which has mpConnected: false)
      component.onSelectProvider('prov-juan');
      fixture.detectChanges();

      expect(emittedChange.providerId).toBe('prov-juan');
      expect(emittedChange.mpInfo.connected).toBe(false);
      expect(component.activeMpInfo().connected).toBe(false);
      expect(el.textContent).toContain('No Vinculada');
      expect(el.textContent).toContain('No asignado');

      // 3. Select club
      component.onSelectProvider('club');
      fixture.detectChanges();

      expect(emittedChange.providerId).toBe('club');
      expect(emittedChange.isClub).toBe(true);
      expect(component.activeMpInfo().connected).toBe(true);
      expect(component.activeMpInfo().collectorId).toBe('CLUB_MP_OFICIAL');
      expect(el.textContent).toContain('Acreditación instantánea a la cuenta oficial del Club');
    });

    it('should search all registeredProviders for exact provider ID match first before falling back to name/email/slug', () => {
      const providers = [
        {
          id: 'prov-imposter',
          name: 'Impostor',
          agency: 'Catamarca Kayak',
          email: 'imposter@kayak.com',
        },
        {
          id: 'prov-real',
          name: 'Real Guide',
          agency: 'Otra Agencia',
          email: 'real@guia.com',
        },
      ] as any[];

      fixture.componentRef.setInput('registeredProviders', providers);

      component.populateForm({
        title: 'Travesía Especial en Kayak',
        tagline: 'Una bajada increíble',
        description: 'Una bajada increíble por los ríos y diques de Catamarca para disfrutar en familia',
        durationLabel: '2 horas',
        meetingPoint: 'Dique El Jumeal',
        providerId: 'prov-real',
        providerName: 'Catamarca Kayak',
      });

      expect(component.selectedProviderId()).toBe('prov-real');

      let emittedPayload: any = null;
      component.saveExperience.subscribe((event) => {
        emittedPayload = event.payload;
      });

      component.onSubmit();
      expect(emittedPayload).toBeTruthy();
      expect(emittedPayload.providerId).toBe('prov-real');
      expect(emittedPayload.providerEmail).toBe('real@guia.com');
    });

    it('should keep Mercado Pago panel in sync with current form provider selection and emit providerChange', () => {
      let emittedChange: any = null;
      component.providerChange.subscribe((change) => {
        emittedChange = change;
      });

      // 1. Select prov-patricio (which has mpConnected: true)
      component.onSelectProvider('prov-patricio');
      fixture.detectChanges();

      expect(emittedChange).toEqual({
        providerId: 'prov-patricio',
        isClub: false,
        mpInfo: {
          connected: true,
          collectorId: 'MP-PATRICIO-COLLECTOR',
          nickname: 'Patricio MP',
        },
      });
      expect(component.activeMpInfo().connected).toBe(true);
      expect(component.activeMpInfo().collectorId).toBe('MP-PATRICIO-COLLECTOR');

      const el = fixture.nativeElement as HTMLElement;
      expect(el.textContent).toContain('Cuenta Vinculada');
      expect(el.textContent).toContain('MP-PATRICIO-COLLECTOR');
      expect(el.textContent).toContain('Patricio MP');

      // 2. Switch to prov-juan (which has mpConnected: false)
      component.onSelectProvider('prov-juan');
      fixture.detectChanges();

      expect(emittedChange.providerId).toBe('prov-juan');
      expect(emittedChange.mpInfo.connected).toBe(false);
      expect(component.activeMpInfo().connected).toBe(false);
      expect(el.textContent).toContain('No Vinculada');
      expect(el.textContent).toContain('No asignado');

      // 3. Select club
      component.onSelectProvider('club');
      fixture.detectChanges();

      expect(emittedChange.providerId).toBe('club');
      expect(emittedChange.isClub).toBe(true);
      expect(component.activeMpInfo().connected).toBe(true);
      expect(component.activeMpInfo().collectorId).toBe('CLUB_MP_OFICIAL');
      expect(el.textContent).toContain('Acreditación instantánea a la cuenta oficial del Club');
    });
  });
});

