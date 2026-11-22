import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { StorageService } from '../../../core/services/storage.service';
import {
  ALTITUDE_OPTIONS,
  EXPERIENCE_CATEGORY_OPTIONS,
  Experience,
  ExperienceAlbumPhoto,
  ExperiencePricingPack,
} from '../../../core/models/experience.model';
import { ProviderExperience } from '../../../core/models/bank-transfer.model';
import { ExperiencePricingPacksEditorComponent } from '../experience-pricing-packs-editor/experience-pricing-packs-editor.component';
import { FechaPipe } from '../../pipes/format.pipes';

export interface ExperienceFormPayload {
  title: string;
  shortTitle: string;
  slug?: string;
  tagline: string;
  description: string;
  category: string;
  region: string;
  meetingPoint: string;
  meetingPointUrl: string;
  difficulty: string;
  durationLabel: string;
  altitudeMeters: number;
  priceArs: number;
  capacityPerDate: number;
  dates: string[];
  pricingPacks: ExperiencePricingPack[];
  coverImage: string;
  videoUrl: string;
  albumPhotos: ExperienceAlbumPhoto[];
  galleryImages: string[];
  included: string[];
  includedServices: string;
  highlights: string[];
  participantRequirements: string;
  itinerary: string;
  // Admin specific
  providerName?: string;
  providerPhone?: string;
  providerCbuAlias?: string;
  providerCuitDni?: string;
  providerBankName?: string;
  status?: string;
  displayLocation?: string;
}

@Component({
  selector: 'app-experience-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    RouterLink,
    MatIconModule,
    FechaPipe,
    ExperiencePricingPacksEditorComponent,
  ],
  templateUrl: './experience-form.component.html',
  styleUrl: './experience-form.component.css',
})
export class ExperienceFormComponent implements OnInit, OnChanges {
  private readonly fb = inject(FormBuilder);
  private readonly storageService = inject(StorageService);

  @Input() mode: 'admin' | 'provider' = 'provider';
  @Input() initialExperience: Partial<Experience> | Partial<ProviderExperience> | null = null;
  @Input() saving = false;
  @Input() cancelRoute = '';
  @Input() isCreateMode = false;
  @Input() isClubExperience = false;
  @Input() clubConfigRoute = '/admin/configuracion';
  @Input() providerMpInfo?: {
    connected?: boolean;
    collectorId?: string;
    nickname?: string;
  };

  @Output() saveExperience = new EventEmitter<{
    payload: ExperienceFormPayload;
    requestPublication?: boolean;
  }>();
  @Output() cancel = new EventEmitter<void>();

  readonly categoryOptions = EXPERIENCE_CATEGORY_OPTIONS;
  readonly altitudeOptions = ALTITUDE_OPTIONS;

  readonly regions: readonly string[] = [
    'Valle Central y Ambato',
    'Puna Catamarqueña y Seismiles',
    'Oeste y Belén',
    'Tinogasta y Fiambalá',
    'Andalgalá y Pomán',
    'Santa María y Valles Calchaquíes',
    'Este y Yungas',
  ];

  readonly difficulties: readonly string[] = [
    'Ninguna',
    'Baja',
    'Moderada',
    'Exigente',
    'Alta Montaña',
  ];

  readonly durationOptions: readonly string[] = [
    '1 a 2 horas (Paseo express)',
    '2 a 3 horas (Actividad corta)',
    '4 horas (Media jornada)',
    '6 a 8 horas (Jornada completa)',
    'Día completo con noche (2 días / 1 noche)',
    'Expedición 3 días / 2 noches',
    'Travesía 4 días o más',
  ];

  readonly toastMessage = signal<string | null>(null);
  readonly savingAction = signal<'save' | 'publish' | null>(null);

  readonly dates = signal<string[]>([]);
  readonly pricingPacks = signal<ExperiencePricingPack[]>([]);
  readonly newDate = signal('');
  readonly datesError = signal<string | null>(null);

  readonly coverImageUrl = signal<string>('');
  readonly coverUrlInput = signal<string>('');
  readonly uploadingCover = signal(false);

  readonly videoUrl = signal<string>('');
  readonly videoUrlInput = signal<string>('');
  readonly uploadingVideo = signal(false);

  readonly albumPhotos = signal<ExperienceAlbumPhoto[]>([]);
  readonly newAlbumPhotoUrl = signal<string>('');
  readonly uploadingAlbum = signal(false);

  readonly includedRaw = signal<string>('');
  readonly requirementsRaw = signal<string>('');
  readonly highlightsRaw = signal<string>('');
  readonly itinerary = signal<string>('');

  readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(100)]],
    slug: ['', [Validators.maxLength(40)]],
    category: ['expediciones', Validators.required],
    region: [this.regions[0], Validators.required],
    tagline: ['', [Validators.required, Validators.maxLength(160)]],
    description: ['', [Validators.required, Validators.minLength(30), Validators.maxLength(2500)]],
    difficulty: ['Ninguna', Validators.required],
    altitudeMeters: [850, [Validators.required, Validators.min(0)]],
    durationLabel: ['', [Validators.required, Validators.maxLength(50)]],
    meetingPoint: ['', [Validators.required, Validators.maxLength(160)]],
    meetingPointUrl: [''],
    priceArs: [65000, [Validators.required, Validators.min(1000)]],
    capacityPerDate: [12, [Validators.required, Validators.min(1), Validators.max(999)]],
    // Admin specific
    providerName: [''],
    providerPhone: [''],
    providerCbuAlias: [''],
    providerCuitDni: [''],
    providerBankName: [''],
    status: ['publicada'],
    displayLocation: ['destacada'],
  });

  readonly isLodging = computed(() => this.form.get('category')?.value === 'hospedajes');

  readonly calculatedUsd = computed(() => {
    const ars = this.form.get('priceArs')?.value || 0;
    return Math.round(ars / 1300);
  });

  readonly featuredPhotos = computed(() => this.albumPhotos().filter((p) => p.isFeatured));
  readonly galleryPhotos = computed(() => this.albumPhotos().filter((p) => !p.isFeatured));
  readonly totalAlbumCount = computed(() => this.albumPhotos().length);

  ngOnInit(): void {
    if (this.initialExperience) {
      this.populateForm(this.initialExperience);
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['initialExperience'] && this.initialExperience) {
      this.populateForm(this.initialExperience);
    }
  }

  fieldInvalid(fieldName: string): boolean {
    const field = this.form.get(fieldName);
    return Boolean(field && field.invalid && (field.dirty || field.touched));
  }

  isCustomCategory(val: string | null | undefined): boolean {
    if (!val) return false;
    return !this.categoryOptions.some((opt) => opt.value === val);
  }

  isCustomRegion(val: string | null | undefined): boolean {
    if (!val) return false;
    return !this.regions.includes(val);
  }

  isCustomAltitude(val: number | string | null | undefined): boolean {
    if (val === null || val === undefined || val === '') return false;
    const num = Number(val);
    return !this.altitudeOptions.some((opt) => opt.value === num);
  }

  isCustomDuration(val: string | null | undefined): boolean {
    if (!val) return false;
    return !this.durationOptions.includes(val);
  }

  populateForm(exp: Partial<Experience> | Partial<ProviderExperience> | any): void {
    const category = exp.category || 'expediciones';
    const region = exp.region || this.regions[0];
    const difficulty = exp.difficulty || 'Ninguna';
    const durationLabel = exp.durationLabel || (exp.duration ? String(exp.duration) : '');
    const altitudeMeters = exp.altitudeMeters ?? (exp.altitude ? Number(exp.altitude) : 850);
    const priceArs = exp.priceArs ?? 65000;
    const capacity = exp.capacityPerDate ?? (exp.maxSpotsPerGroup ?? 12);

    this.form.patchValue({
      title: exp.title || '',
      slug: exp.slug || '',
      category,
      region,
      tagline: exp.tagline || '',
      description: exp.description || '',
      difficulty,
      altitudeMeters,
      durationLabel,
      meetingPoint: exp.meetingPoint || '',
      meetingPointUrl: exp.meetingPointUrl || '',
      priceArs,
      capacityPerDate: capacity,
      providerName: exp.providerName || exp.providerAgency || '',
      providerPhone: exp.providerPhone || '',
      providerCbuAlias: exp.providerCbuAlias || '',
      providerCuitDni: exp.providerCuitDni || '',
      providerBankName: exp.providerBankName || '',
      status: exp.status || 'publicada',
      displayLocation: exp.displayLocation || 'destacada',
    });

    this.coverImageUrl.set(exp.coverImage || '');
    this.videoUrl.set(exp.videoUrl || exp.coverVideoUrl || '');

    // Album photos
    if (Array.isArray(exp.albumPhotos) && exp.albumPhotos.length > 0) {
      this.albumPhotos.set(exp.albumPhotos.map((p: any) => ({ ...p })));
    } else if (Array.isArray(exp.galleryImages) && exp.galleryImages.length > 0) {
      this.albumPhotos.set(
        exp.galleryImages.map((u: string, idx: number) => ({
          id: `photo_${idx + 1}`,
          url: u,
          title: exp.title || 'Foto de experiencia',
          isCover: Boolean(exp.coverImage && u.trim() === exp.coverImage.trim()),
          order: idx + 1,
        })),
      );
    } else {
      this.albumPhotos.set([]);
    }

    // Dates
    const rawDates = exp.dates || exp.scheduledDates || [];
    if (Array.isArray(rawDates)) {
      this.dates.set([...rawDates]);
    } else if (typeof rawDates === 'string') {
      const parsed = rawDates.match(/\b\d{4}-\d{2}-\d{2}\b/g) || [];
      this.dates.set(parsed);
    }

    // Pricing packs
    if (Array.isArray(exp.pricingPacks)) {
      this.pricingPacks.set(exp.pricingPacks.map((p: any) => ({ ...p })));
    } else {
      this.pricingPacks.set([]);
    }

    // Text details
    this.itinerary.set(exp.itinerary || '');

    if (Array.isArray(exp.included)) {
      this.includedRaw.set(exp.included.join('\n'));
    } else if (typeof exp.includedServices === 'string') {
      this.includedRaw.set(exp.includedServices);
    } else {
      this.includedRaw.set('');
    }

    if (Array.isArray(exp.requirements)) {
      this.requirementsRaw.set(exp.requirements.join('\n'));
    } else if (Array.isArray(exp.notIncluded)) {
      this.requirementsRaw.set(exp.notIncluded.join('\n'));
    } else if (typeof exp.participantRequirements === 'string') {
      this.requirementsRaw.set(exp.participantRequirements);
    } else {
      this.requirementsRaw.set('');
    }

    if (Array.isArray(exp.highlights)) {
      this.highlightsRaw.set(exp.highlights.join('\n'));
    } else {
      this.highlightsRaw.set('');
    }
  }

  showToast(msg: string): void {
    this.toastMessage.set(msg);
    setTimeout(() => {
      if (this.toastMessage() === msg) {
        this.toastMessage.set(null);
      }
    }, 4000);
  }

  // Fechas
  addDate(): void {
    const d = this.newDate().trim();
    if (!d) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
      this.datesError.set('Formato de fecha inválido.');
      return;
    }
    if (this.dates().includes(d)) {
      this.datesError.set('Esa fecha ya está agregada.');
      return;
    }
    this.datesError.set(null);
    this.dates.update((prev) => [...prev, d].sort());
    this.newDate.set('');
  }

  onDatePicked(val: string): void {
    if (val && /^\d{4}-\d{2}-\d{2}$/.test(val)) {
      this.newDate.set(val);
      this.addDate();
    }
  }

  removeDate(d: string): void {
    this.dates.update((prev) => prev.filter((x) => x !== d));
  }

  // Cover image
  async onUploadCoverImage(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.uploadingCover.set(true);
    try {
      const slug = this.form.controls.slug.value || 'exp';
      const res = await this.storageService.uploadFile(file, `COVER-${slug}`);
      this.coverImageUrl.set(res.url);
      this.showToast('Foto de portada subida con éxito.');
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
    this.showToast('Portada actualizada desde URL.');
  }

  removeCoverImage(): void {
    this.coverImageUrl.set('');
    this.showToast('Foto de portada removida.');
  }

  // Video
  async onUploadVideo(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.uploadingVideo.set(true);
    try {
      const slug = this.form.controls.slug.value || 'exp';
      const res = await this.storageService.uploadFile(file, `VIDEO-${slug}`);
      this.videoUrl.set(res.url);
      this.showToast('Video subido con éxito.');
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
    this.showToast('Video actualizado.');
  }

  removeVideo(): void {
    this.videoUrl.set('');
    this.showToast('Video removido.');
  }

  // Album photos
  async onUploadAlbumPhotos(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files || []);
    if (files.length === 0) return;

    const availableSlots = 9 - this.galleryPhotos().length;
    if (availableSlots <= 0) {
      this.showToast('Límite de 9 fotos de galería alcanzado.');
      input.value = '';
      return;
    }

    const toUpload = files.slice(0, availableSlots);
    this.uploadingAlbum.set(true);

    try {
      const slug = this.form.controls.slug.value || 'exp';
      let added = 0;
      for (const file of toUpload) {
        const res = await this.storageService.uploadFile(file, `ALBUM-${slug}`);
        const newPhoto: ExperienceAlbumPhoto = {
          id: `photo_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          url: res.url,
          title: this.form.controls.title.value || 'Foto del álbum',
          order: this.albumPhotos().length + 1,
          isFeatured: false,
        };
        this.albumPhotos.update((prev) => [...prev, newPhoto]);
        added++;
      }
      this.showToast(`${added} foto(s) agregada(s) al álbum.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al subir fotos al álbum';
      this.showToast(msg);
    } finally {
      this.uploadingAlbum.set(false);
      input.value = '';
    }
  }

  addAlbumPhotoFromUrl(): void {
    const url = this.newAlbumPhotoUrl().trim();
    if (!url) return;
    if (this.totalAlbumCount() >= 12) {
      this.showToast('Límite máximo de 12 fotos alcanzado.');
      return;
    }
    const newPhoto: ExperienceAlbumPhoto = {
      id: `photo_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      url,
      title: this.form.controls.title.value || 'Foto del álbum',
      order: this.albumPhotos().length + 1,
      isFeatured: false,
    };
    this.albumPhotos.update((prev) => [...prev, newPhoto]);
    this.newAlbumPhotoUrl.set('');
    this.showToast('Foto sumada al álbum.');
  }

  updatePhotoCaption(idx: number, caption: string): void {
    this.albumPhotos.update((photos) => {
      const updated = [...photos];
      if (updated[idx]) {
        updated[idx] = { ...updated[idx], caption };
      }
      return updated;
    });
  }

  removeAlbumPhoto(idx: number): void {
    this.albumPhotos.update((photos) => photos.filter((_, i) => i !== idx));
    this.showToast('Foto eliminada del álbum.');
  }

  toggleFeaturedPhoto(idx: number): void {
    const photo = this.albumPhotos()[idx];
    if (!photo) return;

    if (photo.isFeatured) {
      this.albumPhotos.update((photos) => {
        const updated = [...photos];
        updated[idx] = { ...updated[idx], isFeatured: false };
        return updated;
      });
      this.showToast('Foto desmarcada como destacada.');
    } else {
      if (this.featuredPhotos().length >= 2) {
        this.showToast('Máximo 2 fotos destacadas para encabezar la galería.');
        return;
      }
      this.albumPhotos.update((photos) => {
        const updated = [...photos];
        updated[idx] = { ...updated[idx], isFeatured: true };
        return updated;
      });
      this.showToast('Foto fijada como destacada.');
    }
  }

  onSubmit(requestPublication = false): void {
    if (this.saving) return;
    this.savingAction.set(requestPublication ? 'publish' : 'save');
    this.form.markAllAsTouched();

    if (this.mode === 'provider' && requestPublication && this.dates().length === 0) {
      this.datesError.set('Agregá al menos una fecha futura para solicitar publicación.');
      this.showToast('Por favor agregá al menos una fecha disponible.');
      return;
    }

    if (this.form.invalid) {
      this.showToast('Por favor completá los campos obligatorios del formulario.');
      if (typeof document !== 'undefined') {
        const firstInvalid = document.querySelector(
          '.panel-form input.ng-invalid, .panel-form select.ng-invalid, .panel-form textarea.ng-invalid',
        );
        if (firstInvalid instanceof HTMLElement) {
          firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
          firstInvalid.focus();
        }
      }
      return;
    }

    const value = this.form.getRawValue();

    const rawSlug = (value.slug || value.title).trim();
    const cleanSlug = rawSlug
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

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

    const cover =
      this.coverImageUrl().trim() ||
      (safeAlbumPhotos.length > 0
        ? safeAlbumPhotos[0].url
        : '/assets/images/kayak-club-de-experiencias.jpg');

    const payload: ExperienceFormPayload = {
      title: value.title.trim(),
      shortTitle: value.title.trim(),
      slug: cleanSlug,
      tagline: value.tagline.trim(),
      description: value.description.trim(),
      category: value.category || 'expediciones',
      region: value.region,
      meetingPoint: value.meetingPoint.trim(),
      meetingPointUrl: value.meetingPointUrl.trim(),
      difficulty: value.difficulty,
      durationLabel: value.durationLabel.trim(),
      altitudeMeters: Math.round(Number(value.altitudeMeters) || 0),
      priceArs: Math.round(Number(value.priceArs)),
      capacityPerDate: Math.round(Number(value.capacityPerDate)),
      dates: this.dates(),
      pricingPacks: this.pricingPacks(),
      coverImage: cover,
      videoUrl: this.videoUrl().trim(),
      albumPhotos: safeAlbumPhotos,
      galleryImages: safeAlbumPhotos.map((p) => p.url),
      included,
      includedServices: this.includedRaw().trim(),
      highlights,
      participantRequirements: this.requirementsRaw().trim(),
      itinerary: this.itinerary().trim(),
      providerName: value.providerName.trim(),
      providerPhone: value.providerPhone.trim(),
      providerCbuAlias: value.providerCbuAlias.trim(),
      providerCuitDni: value.providerCuitDni.trim(),
      providerBankName: value.providerBankName.trim(),
      status: value.status,
      displayLocation: value.displayLocation,
    };

    this.saveExperience.emit({ payload, requestPublication });
  }

  onCancel(): void {
    this.cancel.emit();
  }
}
