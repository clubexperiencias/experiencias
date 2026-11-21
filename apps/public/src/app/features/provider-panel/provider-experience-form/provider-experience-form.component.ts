import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { ProviderStoreService } from '../../../core/services/provider-store.service';
import { ExperienceService } from '../../../core/services/experience.service';
import { StorageService } from '../../../core/services/storage.service';
import { ExperienceStatus, ProviderExperience } from '../../../core/models/bank-transfer.model';
import {
  ALTITUDE_OPTIONS,
  EXPERIENCE_CATEGORY_OPTIONS,
  ExperienceAlbumPhoto,
  ExperiencePricingPack,
} from '../../../core/models/experience.model';
import { ExperiencePricingPacksEditorComponent } from '../../../shared/components/experience-pricing-packs-editor/experience-pricing-packs-editor.component';
import { FechaPipe } from '../../../shared/pipes/format.pipes';

const MAX_DATES = 25;

@Component({
  selector: 'app-provider-experience-form',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    FormsModule,
    RouterLink,
    MatIconModule,
    FechaPipe,
    ExperiencePricingPacksEditorComponent,
  ],
  templateUrl: './provider-experience-form.component.html',
  styleUrl: './provider-experience-form.component.css',
})
export class ProviderExperienceFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly store = inject(ProviderStoreService);
  private readonly expService = inject(ExperienceService);
  private readonly storageService = inject(StorageService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly isEditMode = signal(false);
  readonly editingExpId = signal<string | null>(null);
  readonly currentStatus = signal<ExperienceStatus>('borrador');
  readonly notFound = signal(false);

  readonly backLink = computed(() => {
    const isPanel =
      typeof window !== 'undefined' && window.location.pathname.includes('/prestadores/panel');
    return isPanel ? '/prestadores/panel/experiencias' : '/experiencias';
  });

  static readonly DRAFT_STORAGE_KEY = 'experiencias_provider_experience_form_draft';
  readonly hasDraft = signal<boolean>(false);

  readonly difficulties: ProviderExperience['difficulty'][] = [
    'Ninguna',
    'Baja',
    'Moderada',
    'Exigente',
    'Alta Montaña',
  ];

  readonly durationOptions: readonly string[] = [
    '30 minutos',
    '1 hora',
    '2 horas',
    '3 horas',
    '4 horas (Media jornada)',
    '5 horas',
    '6 horas',
    '7 horas',
    '8 horas (Jornada completa)',
    'Día completo (10 h)',
    'Día y noche (24hs)',
    '2 días',
    '3 días',
    '4 días o más',
  ];

  isCustomDuration(val: string | null | undefined): boolean {
    return Boolean(val && !this.durationOptions.includes(val));
  }

  readonly altitudeOptions = ALTITUDE_OPTIONS;

  isCustomAltitude(val: any): boolean {
    if (val === null || val === undefined || val === '') return false;
    const num = Number(val);
    if (isNaN(num)) return true;
    return !this.altitudeOptions.some((opt) => opt.value === num);
  }

  readonly categoryOptions = EXPERIENCE_CATEGORY_OPTIONS;

  isCustomCategory(val: string | null | undefined): boolean {
    if (!val) return false;
    return !this.categoryOptions.some((opt) => opt.value === val);
  }

  readonly regions = [
    'Valle Central y Ambato',
    'Puna de Atacama',
    'Antofagasta de la Sierra',
    'Fiambalá y Seismiles',
    'Belén y Ruta del Telar',
    'Andalgalá y Cuesta de Zapata',
  ];

  isCustomRegion(val: string | null | undefined): boolean {
    const clean = (val || '').trim();
    return clean !== '' && !this.regions.includes(clean);
  }

  readonly today = new Date().toISOString().slice(0, 10);

  // Multimedia & Album State
  readonly coverImageUrl = signal<string>('');
  readonly uploadingCover = signal<boolean>(false);
  readonly coverUrlInput = signal<string>('');

  readonly videoUrl = signal<string>('');
  readonly uploadingVideo = signal<boolean>(false);
  readonly videoUrlInput = signal<string>('');

  readonly albumPhotos = signal<ExperienceAlbumPhoto[]>([]);
  readonly uploadingAlbum = signal<boolean>(false);
  readonly newAlbumPhotoUrl = signal<string>('');
  private albumUploadQueue: Promise<void> = Promise.resolve();

  readonly featuredPhotos = computed(() => this.albumPhotos().filter((p) => p.isFeatured));
  readonly galleryPhotos = computed(() => this.albumPhotos().filter((p) => !p.isFeatured && !p.isCover));
  readonly totalAlbumCount = computed(() => this.albumPhotos().length);

  // Additional details (Services, Highlights, Requirements, Itinerary)
  readonly includedRaw = signal<string>('');
  readonly highlightsRaw = signal<string>('');
  readonly requirementsRaw = signal<string>('');
  readonly itinerary = signal<string>('');

  readonly toastMessage = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(100)]],
    tagline: ['', [Validators.required, Validators.maxLength(160)]],
    description: ['', [Validators.required, Validators.minLength(30), Validators.maxLength(2500)]],
    category: ['expediciones', Validators.required],
    region: [this.regions[0], Validators.required],
    meetingPoint: ['', [Validators.required, Validators.maxLength(160)]],
    meetingPointUrl: [''],
    difficulty: this.fb.nonNullable.control<ProviderExperience['difficulty']>(
      'Ninguna',
      Validators.required,
    ),
    durationLabel: ['', [Validators.required, Validators.maxLength(50)]],
    altitudeMeters: [850, [Validators.required, Validators.min(0)]],
    priceArs: [65000, [Validators.required, Validators.min(1000), Validators.max(20_000_000)]],
    capacityPerDate: [12, [Validators.required, Validators.min(1), Validators.max(999)]],
  });

  readonly dates = signal<string[]>([]);
  readonly pricingPacks = signal<ExperiencePricingPack[]>([]);
  readonly newDate = signal('');
  readonly datesError = signal<string | null>(null);
  readonly saving = signal(false);
  readonly saveError = signal<string | null>(null);
  readonly loadError = signal(false);

  readonly editingExpSlug = signal<string | null>(null);

  showToast(msg: string): void {
    this.toastMessage.set(msg);
    setTimeout(() => {
      if (this.toastMessage() === msg) {
        this.toastMessage.set(null);
      }
    }, 3500);
  }

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEditMode.set(true);
      this.editingExpId.set(id);
      let exp = this.store.getExperienceById(id) || this.store.getExperienceBySlug(id);
      if (!exp) {
        const [loadOk] = await Promise.all([
          this.expService.remoteLoadPromise,
          this.store.loadProposalsFromSupabase(),
        ]);
        exp = this.store.getExperienceById(id) || this.store.getExperienceBySlug(id);
        if (!exp && !loadOk) {
          this.loadError.set(true);
          return;
        }
      }
      if (exp) {
        this.editingExpId.set(exp.id);
        this.editingExpSlug.set(exp.slug || exp.id);
        this.populateForm(exp);
      } else {
        this.notFound.set(true);
      }
    } else {
      this.loadDraft();
      this.form.valueChanges.subscribe(() => {
        if (!this.isEditMode()) {
          this.saveDraft();
        }
      });
    }
  }

  private populateForm(exp: ProviderExperience | any): void {
    this.currentStatus.set(exp.status || 'borrador');
    this.coverImageUrl.set(exp.coverImage || '');
    this.videoUrl.set(exp.videoUrl || exp.coverVideoUrl || '');
    this.albumPhotos.set(
      Array.isArray(exp.albumPhotos) && exp.albumPhotos.length > 0
        ? exp.albumPhotos.map((p: any) => ({ ...p }))
        : (Array.isArray(exp.galleryImages) && exp.galleryImages.length > 0
          ? exp.galleryImages.map((u: string, idx: number) => ({
              id: `photo_${idx + 1}`,
              url: u,
              title: exp.title || 'Foto de experiencia',
              isCover: Boolean(
                typeof exp.coverImage === 'string' &&
                  exp.coverImage.trim() !== '' &&
                  u.trim() === exp.coverImage.trim(),
              ),
              order: idx + 1,
            }))
          : []),
    );
    this.dates.set(Array.isArray(exp.dates) ? [...exp.dates] : []);
    this.pricingPacks.set(
      Array.isArray(exp.pricingPacks)
        ? exp.pricingPacks.map((p: any) => ({ ...p }))
        : [],
    );

    // Populate Included & Highlights & Requirements & Itinerary
    if (Array.isArray(exp.included) && exp.included.length > 0) {
      this.includedRaw.set(exp.included.join('\n'));
    } else if (typeof exp.includedServices === 'string') {
      this.includedRaw.set(exp.includedServices);
    } else {
      this.includedRaw.set('');
    }

    if (Array.isArray(exp.highlights) && exp.highlights.length > 0) {
      this.highlightsRaw.set(exp.highlights.join('\n'));
    } else if (typeof exp.highlights === 'string') {
      this.highlightsRaw.set(exp.highlights);
    } else {
      this.highlightsRaw.set('');
    }

    if (typeof exp.participantRequirements === 'string') {
      this.requirementsRaw.set(exp.participantRequirements);
    } else if (Array.isArray(exp.participantRequirements)) {
      this.requirementsRaw.set((exp.participantRequirements as string[]).join('\n'));
    } else {
      this.requirementsRaw.set('');
    }

    this.itinerary.set(typeof exp.itinerary === 'string' ? exp.itinerary : '');

    this.form.patchValue({
      title: exp.title || '',
      tagline: exp.tagline || '',
      description: exp.description || '',
      category: exp.category || 'expediciones',
      region: exp.region || this.regions[0],
      meetingPoint: exp.meetingPoint || '',
      meetingPointUrl: exp.meetingPointUrl || '',
      difficulty: exp.difficulty || 'Ninguna',
      durationLabel: exp.durationLabel || '',
      altitudeMeters: exp.altitudeMeters ?? 850,
      priceArs: exp.priceArs ?? 65000,
      capacityPerDate: exp.capacityPerDate ?? 12,
    });
  }

  async retryLoad(): Promise<void> {
    const id = this.editingExpId();
    if (!id) return;
    this.loadError.set(false);
    this.notFound.set(false);
    const [loadOk] = await Promise.all([
      this.expService.reloadFromSupabase(),
      this.store.loadProposalsFromSupabase(),
    ]);
    const exp = this.store.getExperienceById(id) || this.store.getExperienceBySlug(id);
    if (exp) {
      this.populateForm(exp);
    } else if (!loadOk) {
      this.loadError.set(true);
    } else {
      this.notFound.set(true);
    }
  }

  // Cover Image Handlers
  async onUploadCoverImage(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.uploadingCover.set(true);
    try {
      const slug = this.editingExpSlug() || 'exp';
      const res = await this.storageService.uploadFile(file, `COVER-${slug}`);
      this.coverImageUrl.set(res.url);
      this.showToast('Foto de portada subida con éxito.');
      if (!this.isEditMode()) {
        this.saveDraft();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al subir imagen de portada';
      this.showToast(msg);
    } finally {
      this.uploadingCover.set(false);
      input.value = '';
    }
  }

  applyCoverFromUrl(): void {
    const url = this.coverUrlInput().trim();
    if (!url) return;
    this.coverImageUrl.set(url);
    this.coverUrlInput.set('');
    this.showToast('Foto de portada configurada.');
    if (!this.isEditMode()) {
      this.saveDraft();
    }
  }

  removeCoverImage(): void {
    this.coverImageUrl.set('');
    if (!this.isEditMode()) {
      this.saveDraft();
    }
  }

  // Video Handlers
  async onUploadVideo(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.uploadingVideo.set(true);
    try {
      const slug = this.editingExpSlug() || 'exp';
      const res = await this.storageService.uploadFile(file, `VID-${slug}`);
      this.videoUrl.set(res.url);
      this.showToast('Video oficial subido con éxito.');
      if (!this.isEditMode()) {
        this.saveDraft();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al subir video';
      this.showToast(msg);
    } finally {
      this.uploadingVideo.set(false);
      input.value = '';
    }
  }

  applyVideoFromUrl(): void {
    const url = this.videoUrlInput().trim();
    if (!url) return;
    this.videoUrl.set(url);
    this.videoUrlInput.set('');
    this.showToast('Video configurado.');
    if (!this.isEditMode()) {
      this.saveDraft();
    }
  }

  removeVideo(): void {
    this.videoUrl.set('');
    if (!this.isEditMode()) {
      this.saveDraft();
    }
  }

  // Album Photos Handlers
  async onUploadAlbumPhotos(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files || []);
    input.value = '';
    if (!files.length) return;

    this.albumUploadQueue = this.albumUploadQueue
      .then(async () => {
        const currentGalleryCount = this.galleryPhotos().length;
        const currentTotalCount = this.albumPhotos().length;
        const remainingGallerySlots = Math.max(0, 9 - currentGalleryCount);
        const remainingTotalSlots = Math.max(0, 12 - currentTotalCount);
        const availableSlots = Math.min(remainingGallerySlots, remainingTotalSlots);

        if (availableSlots <= 0) {
          this.showToast('El álbum ya alcanzó el límite máximo de fotos disponibles.');
          return;
        }

        let filesToUpload = files;
        if (files.length > availableSlots) {
          filesToUpload = files.slice(0, availableSlots);
          this.showToast(
            `Se seleccionaron ${files.length} fotos. Solo se procesarán las primeras ${availableSlots} para respetar los límites del álbum.`,
          );
        }

        this.uploadingAlbum.set(true);
        try {
          const slug = this.editingExpSlug() || 'exp';
          const newPhotos: ExperienceAlbumPhoto[] = [];
          for (const file of filesToUpload) {
            const res = await this.storageService.uploadFile(file, `ALBUM-${slug}`);
            newPhotos.push({
              id: `photo-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
              url: res.url,
              caption: '',
              isCover: false,
              isFeatured: false,
              order: 0,
            });
          }

          let addedCount = 0;
          this.albumPhotos.update((current) => {
            const currentGallery = current.filter((p) => !p.isFeatured && !p.isCover).length;
            const currentTotal = current.length;
            const freeGallery = Math.max(0, 9 - currentGallery);
            const freeTotal = Math.max(0, 12 - currentTotal);
            const maxAllowed = Math.min(freeGallery, freeTotal);

            if (maxAllowed <= 0) {
              addedCount = 0;
              return current;
            }

            const accepted = newPhotos.slice(0, maxAllowed).map((p, idx) => ({
              ...p,
              order: currentTotal + idx + 1,
            }));
            addedCount = accepted.length;
            return [...current, ...accepted];
          });

          if (addedCount > 0) {
            this.showToast(`${addedCount} foto(s) agregada(s) al álbum.`);
            if (addedCount < newPhotos.length) {
              this.showToast(
                `Se omitieron ${newPhotos.length - addedCount} foto(s) porque se completó la capacidad del álbum durante la subida.`,
              );
            }
            if (!this.isEditMode()) {
              this.saveDraft();
            }
          } else if (newPhotos.length > 0) {
            this.showToast('No se pudieron agregar fotos: se alcanzó el límite máximo de capacidad.');
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Error al subir fotos al álbum';
          this.showToast(msg);
        } finally {
          this.uploadingAlbum.set(false);
        }
      })
      .catch((err) => {
        console.error('[ExperienceForm] Error en cola de subida de álbum:', err);
      });

    await this.albumUploadQueue;
  }

  addAlbumPhotoFromUrl(): void {
    const url = this.newAlbumPhotoUrl().trim();
    if (!url) return;
    if (this.albumPhotos().length >= 12) {
      this.showToast('Se alcanzó el límite máximo de 12 fotos en el álbum.');
      return;
    }
    if (this.galleryPhotos().length >= 9) {
      this.showToast('La galería común ya alcanzó el límite máximo de 9 fotos.');
      return;
    }
    const newPhoto: ExperienceAlbumPhoto = {
      id: `photo-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      url,
      caption: '',
      isCover: false,
      isFeatured: false,
      order: this.albumPhotos().length + 1,
    };
    this.albumPhotos.update((list) => [...list, newPhoto]);
    this.newAlbumPhotoUrl.set('');
    this.showToast('Foto agregada al álbum.');
    if (!this.isEditMode()) {
      this.saveDraft();
    }
  }

  toggleFeaturedPhoto(index: number): void {
    const photo = this.albumPhotos()[index];
    if (!photo) return;

    if (photo.isFeatured) {
      if (this.galleryPhotos().length >= 9) {
        this.showToast('No se puede desmarcar: la galería común ya tiene el límite máximo de 9 fotos.');
        return;
      }
      this.albumPhotos.update((photos) =>
        photos.map((p, i) => (i === index ? { ...p, isFeatured: false } : p)),
      );
      this.showToast('Foto desmarcada como destacada.');
    } else {
      if (this.featuredPhotos().length >= 2) {
        this.showToast('Ya tenés 2 fotos seleccionadas como destacadas. Desmarcá una primero.');
        return;
      }
      this.albumPhotos.update((photos) =>
        photos.map((p, i) => (i === index ? { ...p, isFeatured: true } : p)),
      );
      this.showToast('Foto marcada como destacada (máx 2).');
    }
    if (!this.isEditMode()) {
      this.saveDraft();
    }
  }

  updatePhotoCaption(index: number, caption: string): void {
    this.albumPhotos.update((photos) => {
      const updated = [...photos];
      if (updated[index]) {
        updated[index] = { ...updated[index], caption };
      }
      return updated;
    });
    if (!this.isEditMode()) {
      this.saveDraft();
    }
  }

  removeAlbumPhoto(index: number): void {
    this.albumPhotos.update((photos) => photos.filter((_, i) => i !== index));
    this.showToast('Foto eliminada del álbum.');
    if (!this.isEditMode()) {
      this.saveDraft();
    }
  }

  onIncludedChange(value: string): void {
    this.includedRaw.set(value);
    if (!this.isEditMode()) {
      this.saveDraft();
    }
  }

  onHighlightsChange(value: string): void {
    this.highlightsRaw.set(value);
    if (!this.isEditMode()) {
      this.saveDraft();
    }
  }

  onRequirementsChange(value: string): void {
    this.requirementsRaw.set(value);
    if (!this.isEditMode()) {
      this.saveDraft();
    }
  }

  onItineraryChange(value: string): void {
    this.itinerary.set(value);
    if (!this.isEditMode()) {
      this.saveDraft();
    }
  }

  onDatePicked(value: string): void {
    this.newDate.set(value);
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      this.addDate();
    }
  }

  addDate(): void {
    const value = this.newDate();
    if (!value) return;
    if (value < this.today) {
      this.datesError.set('La fecha tiene que ser futura.');
      return;
    }
    if (this.dates().includes(value)) {
      this.datesError.set('Esa fecha ya está cargada.');
      return;
    }
    if (this.dates().length >= MAX_DATES) {
      this.datesError.set(`Podés cargar hasta ${MAX_DATES} fechas.`);
      return;
    }
    this.dates.update((list) => [...list, value].sort());
    this.newDate.set('');
    this.datesError.set(null);
    if (!this.isEditMode()) {
      this.saveDraft();
    }
  }

  removeDate(date: string): void {
    this.dates.update((list) => list.filter((d) => d !== date));
    if (!this.isEditMode()) {
      this.saveDraft();
    }
  }

  onPricingPacksChange(packs: ExperiencePricingPack[]): void {
    this.pricingPacks.set(packs);
    if (!this.isEditMode()) {
      this.saveDraft();
    }
  }

  loadDraft(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const raw = localStorage.getItem(ProviderExperienceFormComponent.DRAFT_STORAGE_KEY);
      if (!raw) {
        this.hasDraft.set(false);
        return;
      }
      const data = JSON.parse(raw);
      if (!data || typeof data !== 'object') {
        this.hasDraft.set(false);
        return;
      }
      if (data.formValue && typeof data.formValue === 'object') {
        this.form.patchValue(data.formValue);
      }
      if (Array.isArray(data.dates)) {
        this.dates.set(data.dates);
      }
      if (Array.isArray(data.pricingPacks)) {
        this.pricingPacks.set(data.pricingPacks);
      }
      if (typeof data.coverImageUrl === 'string') {
        this.coverImageUrl.set(data.coverImageUrl);
      }
      if (typeof data.videoUrl === 'string') {
        this.videoUrl.set(data.videoUrl);
      }
      if (Array.isArray(data.albumPhotos)) {
        this.albumPhotos.set(data.albumPhotos);
      }
      if (typeof data.includedRaw === 'string') {
        this.includedRaw.set(data.includedRaw);
      }
      if (typeof data.highlightsRaw === 'string') {
        this.highlightsRaw.set(data.highlightsRaw);
      }
      if (typeof data.requirementsRaw === 'string') {
        this.requirementsRaw.set(data.requirementsRaw);
      }
      if (typeof data.itinerary === 'string') {
        this.itinerary.set(data.itinerary);
      }
      this.hasDraft.set(true);
    } catch (err) {
      console.warn('[ExperienceForm] Error al cargar borrador:', err);
      this.hasDraft.set(false);
    }
  }

  saveDraft(): void {
    if (typeof localStorage === 'undefined' || this.isEditMode()) return;
    try {
      const val = this.form.getRawValue();
      const hasContent = Boolean(
        val.title?.trim() ||
        val.tagline?.trim() ||
        val.description?.trim() ||
        val.meetingPoint?.trim() ||
        val.meetingPointUrl?.trim() ||
        val.durationLabel?.trim() ||
        this.coverImageUrl()?.trim() ||
        this.videoUrl()?.trim() ||
        this.albumPhotos().length > 0 ||
        this.dates().length > 0 ||
        this.pricingPacks().length > 0 ||
        this.includedRaw()?.trim() ||
        this.highlightsRaw()?.trim() ||
        this.requirementsRaw()?.trim() ||
        this.itinerary()?.trim()
      );

      if (!hasContent) {
        return;
      }

      const payload = {
        formValue: val,
        dates: this.dates(),
        pricingPacks: this.pricingPacks(),
        coverImageUrl: this.coverImageUrl(),
        videoUrl: this.videoUrl(),
        albumPhotos: this.albumPhotos(),
        includedRaw: this.includedRaw(),
        highlightsRaw: this.highlightsRaw(),
        requirementsRaw: this.requirementsRaw(),
        itinerary: this.itinerary(),
        updatedAt: Date.now(),
      };
      localStorage.setItem(ProviderExperienceFormComponent.DRAFT_STORAGE_KEY, JSON.stringify(payload));
      this.hasDraft.set(true);
    } catch (err) {
      console.warn('[ExperienceForm] Error al guardar borrador:', err);
    }
  }

  clearDraft(): void {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem(ProviderExperienceFormComponent.DRAFT_STORAGE_KEY);
      } catch {
        // ignore
      }
    }
    this.hasDraft.set(false);
  }

  discardDraft(): void {
    this.form.reset(
      {
        title: '',
        tagline: '',
        description: '',
        category: 'expediciones',
        region: this.regions[0],
        meetingPoint: '',
        meetingPointUrl: '',
        difficulty: 'Ninguna',
        durationLabel: '',
        altitudeMeters: 850,
        priceArs: 65000,
        capacityPerDate: 12,
      },
      { emitEvent: false },
    );
    this.pricingPacks.set([]);
    this.dates.set([]);
    this.coverImageUrl.set('');
    this.videoUrl.set('');
    this.albumPhotos.set([]);
    this.includedRaw.set('');
    this.highlightsRaw.set('');
    this.requirementsRaw.set('');
    this.itinerary.set('');
    this.clearDraft();
  }

  fieldInvalid(name: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[name];
    return control.invalid && (control.touched || control.dirty);
  }

  async save(requestPublication: boolean): Promise<void> {
    this.form.markAllAsTouched();
    if (requestPublication && this.dates().length === 0) {
      this.datesError.set('Agregá al menos una fecha futura para solicitar publicación.');
      if (typeof document !== 'undefined') {
        const dateInput = document.querySelector('.input-date-control, .dates-chips-container');
        dateInput?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }
    if (this.form.invalid) {
      if (typeof document !== 'undefined') {
        const firstInvalid = document.querySelector(
          '.panel-form input.ng-invalid, .panel-form select.ng-invalid, .panel-form textarea.ng-invalid',
        );
        if (firstInvalid) {
          firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
          if (firstInvalid instanceof HTMLElement) {
            firstInvalid.focus();
          }
        }
      }
      return;
    }

    const value = this.form.getRawValue();
    const rawAlt = value.altitudeMeters;
    const parsedAlt =
      rawAlt !== null && rawAlt !== undefined && String(rawAlt).trim() !== ''
        ? Number(rawAlt)
        : NaN;
    const altitudeMeters =
      Number.isFinite(parsedAlt) && parsedAlt >= 0 ? Math.round(parsedAlt) : 850;

    const included = this.includedRaw()
      .split('\n')
      .map((i) => i.trim())
      .filter((i) => i.length > 0);

    const highlights = this.highlightsRaw()
      .split('\n')
      .map((i) => i.trim())
      .filter((i) => i.length > 0);

    const safeAlbumPhotos = this.albumPhotos().map((p) => ({
      ...p,
      url: p.url?.startsWith('blob:') ? '/assets/images/kayak-club-de-experiencias.jpg' : p.url,
    }));

    const cover = this.coverImageUrl().trim() || (safeAlbumPhotos.length > 0 ? safeAlbumPhotos[0].url : '/assets/images/kayak-club-de-experiencias.jpg');

    const payload = {
      title: value.title.trim(),
      shortTitle: value.title.trim(),
      tagline: value.tagline.trim(),
      description: value.description.trim(),
      category: value.category || 'expediciones',
      region: value.region,
      meetingPoint: value.meetingPoint.trim(),
      meetingPointUrl: value.meetingPointUrl?.trim() || '',
      difficulty: value.difficulty,
      durationLabel: value.durationLabel.trim(),
      altitudeMeters,
      priceArs: Math.round(Number(value.priceArs)),
      capacityPerDate: Math.round(Number(value.capacityPerDate)),
      dates: this.dates(),
      pricingPacks: this.pricingPacks(),
      coverImage: cover,
      videoUrl: this.videoUrl().trim(),
      coverVideoUrl: this.videoUrl().trim(),
      albumPhotos: safeAlbumPhotos,
      galleryImages: safeAlbumPhotos.map((p) => p.url),
      included,
      includedServices: this.includedRaw().trim(),
      highlights,
      participantRequirements: this.requirementsRaw().trim(),
      itinerary: this.itinerary().trim(),
    };

    this.saveError.set(null);
    this.saving.set(true);

    try {
      if (this.isEditMode() && this.editingExpId()) {
        await this.store.saveExperienceChanges(this.editingExpId()!, {
          ...payload,
          status: requestPublication ? 'pendiente_publicacion' : this.currentStatus(),
          ...(requestPublication
            ? {
                moderation: {
                  action: 'publicar',
                  requestedAt: new Date().toISOString(),
                  status: 'pendiente',
                },
              }
            : {}),
        });
      } else {
        this.store.createExperience(
          {
            ...payload,
            status: requestPublication ? 'pendiente_publicacion' : 'borrador',
            providerId: this.store.currentProvider()?.id || 'prov-default',
            providerName: this.store.currentProvider()?.agency || 'Prestador Catamarca',
          },
          requestPublication,
        );
        this.clearDraft();
      }

      if (this.isEditMode() && (this.editingExpSlug() || this.editingExpId())) {
        this.router.navigate([this.backLink(), this.editingExpSlug() || this.editingExpId()]);
      } else {
        this.router.navigate([this.backLink()]);
      }
    } catch (err) {
      console.error('[ProviderExperienceForm] Error guardando experiencia:', err);
      this.saveError.set(
        'No se pudieron guardar los cambios en el servidor. Por favor verificá tu conexión e intentá nuevamente.',
      );
    } finally {
      this.saving.set(false);
    }
  }
}
