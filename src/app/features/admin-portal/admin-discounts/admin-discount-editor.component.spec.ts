import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AdminDiscountEditorComponent } from './admin-discount-editor.component';
import { DiscountService } from '../../../core/services/discount.service';
import { ExperienceService } from '../../../core/services/experience.service';
import { signal } from '@angular/core';

describe('AdminDiscountEditorComponent', () => {
  let component: AdminDiscountEditorComponent;
  let fixture: ComponentFixture<AdminDiscountEditorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminDiscountEditorComponent],
      providers: [
        provideRouter([]),
        {
          provide: DiscountService,
          useValue: {
            discounts: signal([]),
            getDiscountById: () => undefined,
            loadDiscounts: async () => [],
            createDiscount: async (dto: any) => ({ id: 'mock-create-id', ...dto }),
            updateDiscount: async (id: string, dto: any) => ({ id, ...dto }),
          },
        },
        {
          provide: ExperienceService,
          useValue: {
            experiences: signal([]),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminDiscountEditorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the editor component', () => {
    expect(component).toBeTruthy();
  });

  it('should calculate 50% discount for 2x1 preset', () => {
    component.applyGroupPreset(2, 1);
    expect(component.groupTravelers()).toBe(2);
    expect(component.groupPayers()).toBe(1);
    expect(component.calculatedGroupPercentage()).toBe(50);
  });

  it('should calculate 33.3% discount for 3x2 preset', () => {
    component.applyGroupPreset(3, 2);
    expect(component.groupTravelers()).toBe(3);
    expect(component.groupPayers()).toBe(2);
    expect(component.calculatedGroupPercentage()).toBe(33.3);
  });

  it('should calculate 25% discount for 4x3 preset', () => {
    component.applyGroupPreset(4, 3);
    expect(component.groupTravelers()).toBe(4);
    expect(component.groupPayers()).toBe(3);
    expect(component.calculatedGroupPercentage()).toBe(25);
  });

  it('should calculate custom NxM percentages accurately', () => {
    component.groupTravelers.set(5);
    component.groupPayers.set(4);
    // (5 - 4) / 5 = 20%
    expect(component.calculatedGroupPercentage()).toBe(20);
  });

  it('should require a valid experience target when scope is experience and no target is set', async () => {
    component.scope.set('experience');
    component.experienceId.set('');
    component.experienceSlug.set('');
    component.code.set('TESTEXP');
    component.name.set('Test Promo');
    component.category.set('percentage');
    component.percentValue.set(15);

    await component.savePromotion();
    expect(component.formError()).toBe('Seleccioná la experiencia a la que aplica esta promoción.');
  });

  it('should retain existing slug when experienceId is null and target is unchanged', async () => {
    const updateSpy = jasmine.createSpy('updateDiscount').and.resolveTo({ id: 'disc-123' } as any);
    (component as any).discountService.updateDiscount = updateSpy;
    (component as any).isEditing.set(true);
    (component as any).editingId.set('disc-123');

    component.scope.set('experience');
    component.experienceId.set('');
    component.experienceSlug.set('kayak-dique-las-pirquitas');
    component.code.set('PROMO-KAYAK');
    component.name.set('Promo Kayak Renombrada');
    component.category.set('percentage');
    component.percentValue.set(20);

    await component.savePromotion();
    expect(component.formError()).toBeNull();
    expect(updateSpy).toHaveBeenCalledWith(
      'disc-123',
      jasmine.objectContaining({
        name: 'Promo Kayak Renombrada',
        scope: 'experience',
        experienceId: null,
        experienceSlug: 'kayak-dique-las-pirquitas',
      }),
    );
  });

  it('should resolve slug to catalog ID when experience exists in catalog', async () => {
    const updateSpy = jasmine.createSpy('updateDiscount').and.resolveTo({ id: 'disc-456' } as any);
    (component as any).discountService.updateDiscount = updateSpy;
    (component as any).isEditing.set(true);
    (component as any).editingId.set('disc-456');

    (component as any).experienceService.experiences.set([
      { id: 'exp-999', slug: 'dunas-taton', title: 'Dunas de Tatón' } as any,
    ]);

    component.scope.set('experience');
    component.experienceId.set('');
    component.experienceSlug.set('dunas-taton');
    component.code.set('PROMO-DUNAS');
    component.name.set('Dunas 2x1');
    component.category.set('percentage');
    component.percentValue.set(50);

    await component.savePromotion();
    expect(component.formError()).toBeNull();
    expect(component.experienceId()).toBe('exp-999');
    expect(updateSpy).toHaveBeenCalledWith(
      'disc-456',
      jasmine.objectContaining({
        scope: 'experience',
        experienceId: 'exp-999',
        experienceSlug: 'dunas-taton',
      }),
    );
  });

  it('should not navigate via goBack if the component is destroyed or no longer owns the route', async () => {
    const updateSpy = jasmine.createSpy('updateDiscount').and.resolveTo({ id: 'disc-789' } as any);
    (component as any).discountService.updateDiscount = updateSpy;
    (component as any).isEditing.set(true);
    (component as any).editingId.set('disc-789');

    const goBackSpy = spyOn(component, 'goBack');

    // Simular que el componente fue destruido o el admin navegó hacia otra ruta antes de que finalice la escritura
    (component as any).isDestroyed = true;

    component.scope.set('general');
    component.code.set('PROMO-EXIT');
    component.name.set('Promo Navegada');
    component.category.set('percentage');
    component.percentValue.set(10);

    await component.savePromotion();

    // La escritura debe completarse normalmente sin ser revertida
    expect(updateSpy).toHaveBeenCalled();
    // Pero goBack() no debe ser llamado porque ya no posee la ruta activa
    expect(goBackSpy).not.toHaveBeenCalled();
  });

  it('should require provider selection when scope is provider', async () => {
    component.scope.set('provider');
    component.providerId.set('');
    component.code.set('PROMO-PROV');
    component.name.set('Promo Guía Local');
    component.category.set('percentage');
    component.percentValue.set(10);

    await component.savePromotion();
    expect(component.formError()).toBe('Seleccioná el prestador al que aplica esta promoción.');
  });

  it('should label provider scope explicitly and preserve saved provider restriction in preview', () => {
    component.scope.set('provider');
    component.providerId.set('prov-42');
    expect(component.getSelectedProviderName()).toBe('Prestador (prov-42)');

    // Simular que el prestador está registrado
    (component as any).experienceService.experiences.set([
      { id: 'exp-1', providerId: 'prov-42', providerAgency: 'Guías de Altura Puna' } as any,
    ]);
    expect(component.getSelectedProviderName()).toBe('Guías de Altura Puna');
  });

  it('should reject an end date earlier than start date with a field error before writing', async () => {
    const createSpy = jasmine.createSpy('createDiscount').and.resolveTo(null);
    (component as any).discountService.createDiscount = createSpy;

    component.code.set('PROMO-DATES');
    component.name.set('Promo Fechas Inválidas');
    component.category.set('percentage');
    component.percentValue.set(10);
    component.startsAt.set('2026-12-15');
    component.endsAt.set('2026-12-10');

    await component.savePromotion();

    expect(component.formError()).toBe('La fecha de finalización no puede ser anterior a la fecha de inicio.');
    expect(createSpy).not.toHaveBeenCalled();
    expect(component.saving()).toBeFalse();
  });

  it('should allow same-day promotions when startsAt equals endsAt', async () => {
    const createSpy = jasmine.createSpy('createDiscount').and.resolveTo({ id: 'promo-same-day' } as any);
    (component as any).discountService.createDiscount = createSpy;

    component.code.set('BLACK-FRIDAY');
    component.name.set('Flash Sale 24hs');
    component.category.set('percentage');
    component.percentValue.set(30);
    component.startsAt.set('2026-11-27');
    component.endsAt.set('2026-11-27');

    await component.savePromotion();

    expect(component.formError()).toBeNull();
    expect(createSpy).toHaveBeenCalledWith(
      jasmine.objectContaining({
        code: 'BLACK-FRIDAY',
        startsAt: jasmine.stringMatching(/^2026-11-27/),
        endsAt: jasmine.stringMatching(/^2026-11-27/),
      }),
    );
  });

  it('should allow either startsAt or endsAt to remain unset', async () => {
    const createSpy = jasmine.createSpy('createDiscount').and.resolveTo({ id: 'promo-unset' } as any);
    (component as any).discountService.createDiscount = createSpy;

    // Solo fecha de inicio
    component.code.set('OPEN-START');
    component.name.set('Promo Desde Cierta Fecha');
    component.category.set('percentage');
    component.percentValue.set(15);
    component.startsAt.set('2026-12-01');
    component.endsAt.set('');

    await component.savePromotion();

    expect(component.formError()).toBeNull();
    expect(createSpy).toHaveBeenCalledWith(
      jasmine.objectContaining({
        code: 'OPEN-START',
        startsAt: jasmine.stringMatching(/^2026-12-01/),
        endsAt: null,
      }),
    );

    createSpy.calls.reset();

    // Solo fecha de fin
    component.code.set('OPEN-END');
    component.name.set('Promo Hasta Cierta Fecha');
    component.startsAt.set('');
    component.endsAt.set('2026-12-31');

    await component.savePromotion();

    expect(component.formError()).toBeNull();
    expect(createSpy).toHaveBeenCalledWith(
      jasmine.objectContaining({
        code: 'OPEN-END',
        startsAt: null,
        endsAt: jasmine.stringMatching(/^2026-12-31/),
      }),
    );
  });

  describe('category change and field preservation logic', () => {
    it('should refresh all untouched suggested fields when changing categories', () => {
      // Estado inicial en categoría group
      expect(component.category()).toBe('group');
      expect(component.code()).toBe('PROMO2X1');
      expect(component.name()).toBe('Promoción 2x1 en Reservas');

      // Cambiar a percentage sin haber editado ningún campo manualmente
      component.setCategory('percentage');
      expect(component.category()).toBe('percentage');
      expect(component.code()).toBe('DESCUENTO15');
      expect(component.name()).toBe('15% OFF en Experiencias');
      expect(component.description()).toBe('Aplica un 15% de descuento sobre el total de la reserva.');

      // Cambiar a fixed_amount
      component.setCategory('fixed_amount');
      expect(component.category()).toBe('fixed_amount');
      expect(component.code()).toBe('PROMO10K');
      expect(component.name()).toBe('$10.000 ARS OFF en tu Reserva');
      expect(component.description()).toBe('Descuento directo de $10.000 ARS en el total.');
    });

    it('should preserve manually edited code independently when category changes', () => {
      component.onCodeChange('MIPROMOESPECIAL');
      expect(component.code()).toBe('MIPROMOESPECIAL');

      // Al cambiar a percentage, code se preserva pero name y description se actualizan
      component.setCategory('percentage');
      expect(component.code()).toBe('MIPROMOESPECIAL');
      expect(component.name()).toBe('15% OFF en Experiencias');
      expect(component.description()).toBe('Aplica un 15% de descuento sobre el total de la reserva.');

      // Al cambiar a fixed_amount, code se sigue preservando
      component.setCategory('fixed_amount');
      expect(component.code()).toBe('MIPROMOESPECIAL');
      expect(component.name()).toBe('$10.000 ARS OFF en tu Reserva');
    });

    it('should preserve manually edited name independently when category changes', () => {
      component.onNameChange('Super Beneficio Verano');

      component.setCategory('fixed_amount');
      expect(component.name()).toBe('Super Beneficio Verano');
      expect(component.code()).toBe('PROMO10K');
      expect(component.description()).toBe('Descuento directo de $10.000 ARS en el total.');
    });

    it('should preserve manually edited description independently when category changes', () => {
      component.onDescriptionChange('Válido únicamente para reservas de lunes a jueves.');

      component.setCategory('percentage');
      expect(component.description()).toBe('Válido únicamente para reservas de lunes a jueves.');
      expect(component.code()).toBe('DESCUENTO15');
      expect(component.name()).toBe('15% OFF en Experiencias');
    });

    it('should not overwrite manually changed fields when applyGroupPreset generates group text', () => {
      component.onNameChange('Promoción Exclusiva Grupos');
      component.onCodeChange('GRUPO-VIP');

      // Cambiar preset a 3x2
      component.applyGroupPreset(3, 2);

      // code y name fueron editados manualmente, se deben preservar
      expect(component.name()).toBe('Promoción Exclusiva Grupos');
      expect(component.code()).toBe('GRUPO-VIP');
      // description no fue editada, por lo que se debe actualizar con el texto del grupo 3x2
      expect(component.description()).toContain('Viajan 3 personas y abonan únicamente 2 cupo(s)');
      expect(component.calculatedGroupPercentage()).toBe(33.3);
    });

    it('should update name and description from percentage preset while preserving admin-edited text', () => {
      component.setCategory('percentage');
      expect(component.name()).toBe('15% OFF en Experiencias');
      expect(component.description()).toBe('Aplica un 15% de descuento sobre el total de la reserva.');

      // Seleccionar preset del 25% sin editar texto
      component.setPercentValue(25);
      expect(component.percentValue()).toBe(25);
      expect(component.code()).toBe('DESCUENTO25');
      expect(component.name()).toBe('25% OFF en Experiencias');
      expect(component.description()).toBe('Aplica un 25% de descuento sobre el total de la reserva.');

      // Seleccionar preset del 50% sin editar texto
      component.setPercentValue(50);
      expect(component.code()).toBe('DESCUENTO50');
      expect(component.name()).toBe('50% OFF en Experiencias');
      expect(component.description()).toBe('Aplica un 50% de descuento sobre el total de la reserva.');

      // Editar únicamente la descripción
      component.onDescriptionChange('Condición personalizada para el 50%');
      component.setPercentValue(30);

      // Código y nombre se actualizan al 30%, descripción personalizada se preserva
      expect(component.code()).toBe('DESCUENTO30');
      expect(component.name()).toBe('30% OFF en Experiencias');
      expect(component.description()).toBe('Condición personalizada para el 50%');
    });

    it('should update name and description from fixed-amount preset while preserving admin-edited text', () => {
      component.setCategory('fixed_amount');
      expect(component.name()).toBe('$10.000 ARS OFF en tu Reserva');
      expect(component.description()).toBe('Descuento directo de $10.000 ARS en el total.');

      // Seleccionar preset de $20.000
      component.setFixedValue(20000);
      expect(component.fixedValue()).toBe(20000);
      expect(component.code()).toBe('PROMO20K');
      expect(component.name()).toBe('$20.000 ARS OFF en tu Reserva');
      expect(component.description()).toBe('Descuento directo de $20.000 ARS en el total.');

      // Seleccionar preset de $50.000
      component.setFixedValue(50000);
      expect(component.code()).toBe('PROMO50K');
      expect(component.name()).toBe('$50.000 ARS OFF en tu Reserva');
      expect(component.description()).toBe('Descuento directo de $50.000 ARS en el total.');

      // Editar únicamente el nombre
      component.onNameChange('Bono Exclusivo Monto Fijo');
      component.setFixedValue(30000);

      // Nombre editado se preserva, código y descripción se actualizan a $30.000
      expect(component.name()).toBe('Bono Exclusivo Monto Fijo');
      expect(component.code()).toBe('PROMO30K');
      expect(component.description()).toBe('Descuento directo de $30.000 ARS en el total.');
    });
  });

  describe('edit lookup flow and error states', () => {
    it('should display a not-found state and disable save when lookup has no match', async () => {
      const discountService = (component as any).discountService;
      spyOn(discountService, 'getDiscountById').and.returnValue(undefined);
      spyOn(discountService, 'loadDiscounts').and.resolveTo([]);
      const updateSpy = spyOn(discountService, 'updateDiscount');

      component.isEditing.set(true);
      component.editingId.set('non-existent-id');

      await component.loadExistingDiscount('non-existent-id');
      fixture.detectChanges();

      expect(component.discountNotFound()).toBeTrue();
      expect(component.loadError()).toBeNull();
      expect(component.isSaveDisabled()).toBeTrue();

      // Verificar que el estado not-found oculta el formulario con defaults
      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.querySelector('.state-not-found')).toBeTruthy();
      expect(compiled.querySelector('.editor-layout')).toBeNull();

      // Intentar guardar no debe ejecutar la escritura
      await component.savePromotion();
      expect(updateSpy).not.toHaveBeenCalled();
    });

    it('should display a retryable load error when read fails with an error', async () => {
      const discountService = (component as any).discountService;
      spyOn(discountService, 'getDiscountById').and.returnValue(undefined);
      const loadSpy = spyOn(discountService, 'loadDiscounts').and.rejectWith(
        new Error('Network connection timeout'),
      );
      const updateSpy = spyOn(discountService, 'updateDiscount');

      component.isEditing.set(true);
      component.editingId.set('broken-id');

      await component.loadExistingDiscount('broken-id');
      fixture.detectChanges();

      expect(component.loadError()).toBe('Network connection timeout');
      expect(component.discountNotFound()).toBeFalse();
      expect(component.isSaveDisabled()).toBeTrue();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.querySelector('.state-error')).toBeTruthy();
      expect(compiled.querySelector('.btn-retry')).toBeTruthy();
      expect(compiled.querySelector('.editor-layout')).toBeNull();

      await component.savePromotion();
      expect(updateSpy).not.toHaveBeenCalled();

      // Probar reintento con éxito
      loadSpy.and.resolveTo([
        {
          id: 'broken-id',
          code: 'RECOVERED10',
          name: 'Promo Recuperada',
          discountType: 'percentage',
          discountValue: 10,
          scope: 'general',
          active: true,
          isAutomatic: false,
        } as any,
      ]);

      component.retryLoadDiscount();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(component.loadError()).toBeNull();
      expect(component.code()).toBe('RECOVERED10');
      expect(component.name()).toBe('Promo Recuperada');
      expect(component.isSaveDisabled()).toBeFalse();
      expect(compiled.querySelector('.state-error')).toBeNull();
      expect(compiled.querySelector('.editor-layout')).toBeTruthy();
    });

    it('should display a retryable load error on empty-cache failure', async () => {
      const discountService = (component as any).discountService;
      spyOn(discountService, 'getDiscountById').and.returnValue(undefined);
      spyOn(discountService, 'loadDiscounts').and.resolveTo([]);
      // Simular que el servicio tiene un error registrado
      discountService.error = signal('Error de conexión con Supabase');

      component.isEditing.set(true);
      component.editingId.set('empty-cache-id');

      await component.loadExistingDiscount('empty-cache-id');
      fixture.detectChanges();

      expect(component.loadError()).toBe('Error de conexión con Supabase');
      expect(component.isSaveDisabled()).toBeTrue();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.querySelector('.state-error')).toBeTruthy();
      expect(compiled.querySelector('.editor-layout')).toBeNull();
    });
  });

  describe('save return verification', () => {
    it('should set form error and not navigate when createDiscount returns null', async () => {
      const discountService = (component as any).discountService;
      spyOn(discountService, 'createDiscount').and.resolveTo(null);
      const goBackSpy = spyOn(component, 'goBack');

      component.code.set('PROMO-NULL');
      component.name.set('Promo Retorno Nulo');
      component.category.set('percentage');
      component.percentValue.set(20);

      await component.savePromotion();

      expect(component.formError()).toBe('Error al guardar la promoción. Verificá los campos.');
      expect(goBackSpy).not.toHaveBeenCalled();
      // Los valores del formulario deben quedar intactos
      expect(component.code()).toBe('PROMO-NULL');
      expect(component.name()).toBe('Promo Retorno Nulo');
      expect(component.percentValue()).toBe(20);
    });

    it('should set form error and not navigate when updateDiscount returns null', async () => {
      const discountService = (component as any).discountService;
      spyOn(discountService, 'updateDiscount').and.resolveTo(null);
      const goBackSpy = spyOn(component, 'goBack');

      component.isEditing.set(true);
      component.editingId.set('edit-null-id');
      component.code.set('UPDATE-NULL');
      component.name.set('Edición Retorno Nulo');
      component.category.set('fixed_amount');
      component.fixedValue.set(15000);

      await component.savePromotion();

      expect(component.formError()).toBe('Error al guardar la promoción. Verificá los campos.');
      expect(goBackSpy).not.toHaveBeenCalled();
      // Valores intactos
      expect(component.code()).toBe('UPDATE-NULL');
      expect(component.name()).toBe('Edición Retorno Nulo');
      expect(component.fixedValue()).toBe(15000);
    });

    it('should navigate back via goBack when createDiscount returns a non-null discount', async () => {
      const discountService = (component as any).discountService;
      spyOn(discountService, 'createDiscount').and.resolveTo({ id: 'created-ok' } as any);
      const goBackSpy = spyOn(component, 'goBack');
      spyOn<any>(component, 'ownsActiveRoute').and.returnValue(true);

      component.code.set('PROMO-SUCCESS');
      component.name.set('Promo Exitosa');
      component.category.set('percentage');
      component.percentValue.set(15);

      await component.savePromotion();

      expect(component.formError()).toBeNull();
      expect(goBackSpy).toHaveBeenCalled();
    });
  });
});

