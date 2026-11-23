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
import { toSignal } from '@angular/core/rxjs-interop';
import { map, startWith } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { StorageService } from '../../../core/services/storage.service';
import { AdminStoreService } from '../../../core/services/admin-store.service';
import { RESERVED_EXPERIENCE_SLUGS } from '../../../core/services/experience.service';
import {
  ALTITUDE_OPTIONS,
  EXPERIENCE_CATEGORY_OPTIONS,
  EXPERIENCE_DURATION_OPTIONS,
  Experience,
  ExperienceAlbumPhoto,
  ExperiencePricingPack,
} from '../../../core/models/experience.model';
import { ProviderExperience, ProviderUser } from '../../../core/models/bank-transfer.model';
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
  priceUsd?: number;
  capacityPerDate: number;
  dates: string[];
  datesOnRequest?: boolean;
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
  providerId?: string;
  providerEmail?: string;
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
  private readonly adminStore = inject(AdminStoreService, { optional: true });

  @Input() mode: 'admin' | 'provider' = 'provider';
  @Input() initialExperience: Partial<Experience> | Partial<ProviderExperience> | null = null;
  @Input() saving = false;
  @Input() saveDisabled = false;
  @Input() cancelRoute = '';
  @Input() isCreateMode = false;
  @Input() isClubExperience = false;
  @Input() clubConfigRoute = '/admin/configuracion';
  private readonly _usdExchangeRateInput = signal<number | undefined>(undefined);
  @Input() set usdExchangeRate(val: number | undefined) {
    this._usdExchangeRateInput.set(val);
  }
  get usdExchangeRate(): number | undefined {
    return this._usdExchangeRateInput();
  }

  @Input() providerMpInfo?: {
    connected?: boolean;
    collectorId?: string;
    nickname?: string;
  };
  @Input() registeredProviders: ProviderUser[] = [];

  private readonly _clubProfileInput = signal<{
    name?: string;
    phone?: string;
    cbuAlias?: string;
    cuitDni?: string;
    bankName?: string;
    email?: string;
    usdExchangeRate?: number;
  } | null>(null);
  @Input() set clubProfile(val: {
    name?: string;
    phone?: string;
    cbuAlias?: string;
    cuitDni?: string;
    bankName?: string;
    email?: string;
    usdExchangeRate?: number;
  } | null | undefined) {
    this._clubProfileInput.set(val ?? null);
  }
  get clubProfile() {
    return this._clubProfileInput();
  }

  readonly selectedProviderId = signal<string>('custom');
  readonly isProviderFieldsLocked = computed(() => this.selectedProviderId() !== 'custom');
  private hasUserSelectedProvider = false;

  @Output() saveExperience = new EventEmitter<{
    payload: ExperienceFormPayload;
    requestPublication?: boolean;
  }>();
  @Output() cancel = new EventEmitter<void>();
  @Output() draftChange = new EventEmitter<void>();
  @Output() providerChange = new EventEmitter<{
    providerId: string;
    isClub: boolean;
    mpInfo: {
      connected?: boolean;
      collectorId?: string;
      nickname?: string;
    };
  }>();

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

  readonly durationOptions: readonly string[] = EXPERIENCE_DURATION_OPTIONS;

  readonly toastMessage = signal<string | null>(null);
  readonly savingAction = signal<'save' | 'publish' | null>(null);

  readonly dates = signal<string[]>([]);
  readonly datesOnRequest = signal<boolean>(false);
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

  readonly isMediaUploading = computed(
    () => this.uploadingCover() || this.uploadingVideo() || this.uploadingAlbum(),
  );

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

  readonly isLodging = toSignal(
    this.form.controls.category.valueChanges.pipe(
      startWith(this.form.controls.category.value),
      map((cat) => cat === 'hospedajes'),
    ),
    { initialValue: this.form.controls.category.value === 'hospedajes' },
  );

  readonly currentUsdRate = computed(() => {
    const isValid = (r: unknown): r is number => typeof r === 'number' && Number.isFinite(r) && r > 0;

    const inputRate = this._usdExchangeRateInput();
    if (isValid(inputRate)) {
      return inputRate;
    }
    const adminRate = this.adminStore?.usdExchangeRate();
    if (isValid(adminRate)) {
      return adminRate;
    }
    const profileRate =
      this._clubProfileInput()?.usdExchangeRate ||
      this.adminStore?.clubProfile()?.usdExchangeRate;
    if (isValid(profileRate)) {
      return profileRate;
    }
    return 1400;
  });

  private readonly priceArsValue = toSignal(
    this.form.controls.priceArs.valueChanges.pipe(
      startWith(this.form.controls.priceArs.value),
    ),
    { initialValue: this.form.controls.priceArs.value },
  );

  readonly calculatedUsd = computed(() => {
    const ars = Number(this.priceArsValue()) || 0;
    const rate = this.currentUsdRate();
    return Math.round(ars / rate);
  });

  readonly featuredPhotos = computed(() => this.albumPhotos().filter((p) => p.isFeatured));
  readonly galleryPhotos = computed(() => this.albumPhotos().filter((p) => !p.isFeatured));
  readonly hasCoverImage = computed(() => Boolean(this.coverImageUrl()?.trim()));
  readonly totalAlbumCount = computed(() => {
    const coverUrl = this.coverImageUrl()?.trim() || '';
    const album = this.albumPhotos();
    const hasCover = Boolean(coverUrl);
    const nonCoverPhotos = album.filter(
      (p) => !p.isCover && (!hasCover || (p.url || '').trim() !== coverUrl),
    );
    const hasMatchingCoverInAlbum = album.some(
      (p) => Boolean(p.isCover) || (hasCover && (p.url || '').trim() === coverUrl),
    );
    const coverCount = hasCover || hasMatchingCoverInAlbum ? 1 : 0;
    return nonCoverPhotos.length + coverCount;
  });

  ngOnInit(): void {
    if (this.mode === 'provider') {
      this.form.controls.slug.clearValidators();
      this.form.controls.slug.updateValueAndValidity();
    } else {
      this.form.controls.slug.setValidators([Validators.maxLength(40)]);
      this.form.controls.slug.updateValueAndValidity();
    }

    if (this.initialExperience) {
      this.populateForm(this.initialExperience);
    }
    this.form.valueChanges.subscribe(() => {
      this.draftChange.emit();
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['mode']) {
      if (this.mode === 'provider') {
        this.form.controls.slug.clearValidators();
      } else {
        this.form.controls.slug.setValidators([Validators.maxLength(40)]);
      }
      this.form.controls.slug.updateValueAndValidity();
    }
    const experienceChanged = Boolean(changes['initialExperience']);
    if (experienceChanged) {
      this.hasUserSelectedProvider = false;
      if (this.initialExperience) {
        this.populateForm(this.initialExperience);
      } else {
        this.syncSelectedProviderFromExperience(null);
      }
    }
    if (changes['registeredProviders'] || changes['isClubExperience']) {
      const currentId = this.selectedProviderId();
      const hasProviderSelected = Boolean(currentId && currentId !== 'custom');
      const hasSelection = this.hasUserSelectedProvider || hasProviderSelected;

      if (!hasSelection) {
        if (!experienceChanged) {
          this.syncSelectedProviderFromExperience(this.initialExperience);
        }
      }

      const activeId = this.selectedProviderId();
      if (activeId && activeId !== 'custom' && activeId !== 'club') {
        const provider = this.registeredProviders?.find((p) => p.id === activeId);
        if (provider) {
          const pName = (provider.agency || provider.name || '').trim();
          this.form.patchValue({
            providerName: this.form.controls.providerName.value || pName,
            providerPhone: this.form.controls.providerPhone.value || (provider.phone || '').trim(),
            providerCbuAlias: this.form.controls.providerCbuAlias.value || (provider.cbuAlias || '').trim(),
            providerCuitDni: this.form.controls.providerCuitDni.value || (provider.cuitDni || '').trim(),
            providerBankName: this.form.controls.providerBankName.value || (provider.bankName || '').trim(),
          });
        }
      }
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

  normalizeDifficulty(val: string | null | undefined): string {
    if (!val || typeof val !== 'string') return 'Ninguna';
    const trimmed = val.trim();
    if (!trimmed) return 'Ninguna';
    const cleaned = trimmed.split('(')[0].trim();
    const match = this.difficulties.find(
      (d) => d.toLowerCase() === cleaned.toLowerCase() || d.toLowerCase() === trimmed.toLowerCase(),
    );
    return match || 'Ninguna';
  }

  populateForm(exp: Partial<Experience> | Partial<ProviderExperience> | any): void {
    this.hasUserSelectedProvider = false;
    const category = exp.category || 'expediciones';
    const region = exp.region || this.regions[0];
    const difficulty = this.normalizeDifficulty(exp.difficulty);
    const rawDuration = exp.durationLabel || (exp.duration ? String(exp.duration) : '');
    const durationLabel = rawDuration === '1 a 2 horas (Paseo express)' ? '1 a 2 horas' : rawDuration;
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
    let hasCoordinar = false;
    if (Array.isArray(rawDates)) {
      hasCoordinar = rawDates.some(
        (d: any) => typeof d === 'string' && d.toLowerCase().includes('coordinar'),
      );
      const parsedDates = rawDates.filter(
        (d: any) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d),
      );
      this.dates.set(parsedDates);
    } else if (typeof rawDates === 'string') {
      hasCoordinar = rawDates.toLowerCase().includes('coordinar');
      const parsed = rawDates.match(/\b\d{4}-\d{2}-\d{2}\b/g) || [];
      this.dates.set(parsed);
    } else {
      this.dates.set([]);
    }

    if (exp.datesOnRequest !== undefined) {
      this.datesOnRequest.set(Boolean(exp.datesOnRequest));
    } else if (hasCoordinar) {
      this.datesOnRequest.set(true);
    } else {
      this.datesOnRequest.set(false);
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

    if (typeof exp.participantRequirements === 'string') {
      this.requirementsRaw.set(exp.participantRequirements);
    } else if (Array.isArray(exp.requirements)) {
      this.requirementsRaw.set(exp.requirements.join('\n'));
    } else if (Array.isArray(exp.notIncluded)) {
      this.requirementsRaw.set(exp.notIncluded.join('\n'));
    } else {
      this.requirementsRaw.set('');
    }

    if (Array.isArray(exp.highlights)) {
      this.highlightsRaw.set(exp.highlights.join('\n'));
    } else {
      this.highlightsRaw.set('');
    }

    this.syncSelectedProviderFromExperience(exp);
  }

  syncSelectedProviderFromExperience(exp: Partial<Experience> | Partial<ProviderExperience> | any): void {
    if (!exp) {
      if (this.isClubExperience) {
        this.selectedProviderId.set('club');
      } else {
        this.selectedProviderId.set('custom');
      }
      return;
    }

    const pName = (exp.providerName || exp.providerAgency || '').trim().toLowerCase();
    const isClub =
      exp.isClubExperience === true ||
      pName === 'club de experiencias' ||
      pName === 'club' ||
      exp.providerSlug === 'club-de-experiencias' ||
      exp.providerSlug === 'club';

    if (isClub) {
      this.selectedProviderId.set('club');
      return;
    }

    if (this.registeredProviders && this.registeredProviders.length > 0) {
      const provId = exp.providerId;
      const provEmail = (exp.providerEmail || '').trim().toLowerCase();
      const provSlug = (exp.providerSlug || '').trim().toLowerCase();

      let match = provId ? this.registeredProviders.find((p) => p.id === provId) : undefined;
      if (!match) {
        match = this.registeredProviders.find((p) => {
          if (provEmail && p.email && p.email.toLowerCase() === provEmail) return true;
          if (provSlug && p.slug && p.slug.toLowerCase() === provSlug) return true;
          const targetName = (p.name || '').trim().toLowerCase();
          const targetAgency = (p.agency || '').trim().toLowerCase();
          if (pName && (targetName === pName || targetAgency === pName)) return true;
          return false;
        });
      }

      if (match) {
        this.selectedProviderId.set(match.id);
        return;
      }
    }

    this.selectedProviderId.set('custom');
  }

  readonly activeMpInfo = computed<{
    connected?: boolean;
    collectorId?: string;
    nickname?: string;
  }>(() => {
    const selectedId = this.selectedProviderId();

    if (selectedId === 'club') {
      return {
        connected: true,
        collectorId: 'CLUB_MP_OFICIAL',
        nickname: this.clubProfile?.name || 'Club de Experiencias',
      };
    }

    if (selectedId && selectedId !== 'custom') {
      const provider = this.registeredProviders?.find((p) => p.id === selectedId);
      if (provider) {
        return {
          connected: Boolean(provider.mpConnected),
          collectorId: provider.mpCollectorId || '',
          nickname: provider.mpNickname || provider.name || '',
        };
      }
    }

    if (this.hasUserSelectedProvider && selectedId === 'custom') {
      return {
        connected: false,
        collectorId: '',
        nickname: '',
      };
    }

    if (this.providerMpInfo) {
      return this.providerMpInfo;
    }

    return {
      connected: false,
      collectorId: '',
      nickname: '',
    };
  });

  private updateProviderMpInfo(providerId: string): void {
    if (providerId === 'club') {
      this.providerMpInfo = {
        connected: true,
        collectorId: 'CLUB_MP_OFICIAL',
        nickname: this.clubProfile?.name || 'Club de Experiencias',
      };
      return;
    }

    if (providerId === 'custom') {
      this.providerMpInfo = {
        connected: false,
        collectorId: '',
        nickname: '',
      };
      return;
    }

    const provider = this.registeredProviders?.find((p) => p.id === providerId);
    if (provider) {
      this.providerMpInfo = {
        connected: Boolean(provider.mpConnected),
        collectorId: provider.mpCollectorId || '',
        nickname: provider.mpNickname || provider.name || '',
      };
    }
  }

  onSelectProvider(providerId: string): void {
    this.hasUserSelectedProvider = true;
    this.selectedProviderId.set(providerId);

    if (providerId === 'club') {
      const clubName = this.clubProfile?.name || 'Club de Experiencias';
      const clubPhone = this.clubProfile?.phone || '';
      const clubCbu = this.clubProfile?.cbuAlias || '';
      const clubCuit = this.clubProfile?.cuitDni || '';
      const clubBank = this.clubProfile?.bankName || '';

      this.form.patchValue({
        providerName: clubName,
        providerPhone: clubPhone,
        providerCbuAlias: clubCbu,
        providerCuitDni: clubCuit,
        providerBankName: clubBank,
      });
      this.isClubExperience = true;
      this.updateProviderMpInfo('club');
      this.providerChange.emit({
        providerId: 'club',
        isClub: true,
        mpInfo: this.activeMpInfo(),
      });
      this.form.markAsDirty();
      return;
    }

    if (providerId === 'custom') {
      this.isClubExperience = false;
      this.updateProviderMpInfo('custom');
      this.providerChange.emit({
        providerId: 'custom',
        isClub: false,
        mpInfo: this.activeMpInfo(),
      });
      return;
    }

    const provider = this.registeredProviders.find((p) => p.id === providerId);
    if (provider) {
      const pName = (provider.agency || provider.name || '').trim();
      this.form.patchValue({
        providerName: pName,
        providerPhone: (provider.phone || '').trim(),
        providerCbuAlias: (provider.cbuAlias || '').trim(),
        providerCuitDni: (provider.cuitDni || '').trim(),
        providerBankName: (provider.bankName || '').trim(),
      });
      this.isClubExperience = false;
      this.updateProviderMpInfo(providerId);
      this.providerChange.emit({
        providerId,
        isClub: false,
        mpInfo: this.activeMpInfo(),
      });
      this.form.markAsDirty();
    }
  }

  resetForm(): void {
    this.hasUserSelectedProvider = false;
    this.selectedProviderId.set('custom');
    this.form.reset(
      {
        title: '',
        slug: '',
        category: 'expediciones',
        region: this.regions[0],
        tagline: '',
        description: '',
        difficulty: 'Ninguna',
        altitudeMeters: 850,
        durationLabel: '',
        meetingPoint: '',
        meetingPointUrl: '',
        priceArs: 65000,
        capacityPerDate: 12,
        providerName: '',
        providerPhone: '',
        providerCbuAlias: '',
        providerCuitDni: '',
        providerBankName: '',
        status: 'publicada',
        displayLocation: 'destacada',
      },
    );
    this.dates.set([]);
    this.datesOnRequest.set(false);
    this.pricingPacks.set([]);
    this.coverImageUrl.set('');
    this.coverUrlInput.set('');
    this.videoUrl.set('');
    this.videoUrlInput.set('');
    this.albumPhotos.set([]);
    this.newAlbumPhotoUrl.set('');
    this.includedRaw.set('');
    this.requirementsRaw.set('');
    this.highlightsRaw.set('');
    this.itinerary.set('');
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
  onAddDateClick(dateInput?: HTMLInputElement): void {
    if (this.newDate()?.trim()) {
      this.addDate();
      return;
    }
    this.openDatePicker(dateInput);
  }

  openDatePicker(dateInput?: HTMLInputElement): void {
    const input = dateInput || (typeof document !== 'undefined' ? (document.getElementById('newDateInput') as HTMLInputElement | null) : null);
    if (input) {
      if (typeof input.showPicker === 'function') {
        try {
          input.showPicker();
          return;
        } catch {
          // Fallback en caso de restricciones de eventos en el navegador
        }
      }
      input.focus();
      input.click();
    }
  }

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
    this.draftChange.emit();
  }

  onDatePicked(val: string): void {
    if (val && /^\d{4}-\d{2}-\d{2}$/.test(val)) {
      this.newDate.set(val);
      this.addDate();
    }
  }

  removeDate(d: string): void {
    this.dates.update((prev) => prev.filter((x) => x !== d));
    this.draftChange.emit();
  }

  toggleDatesOnRequest(checked: boolean): void {
    this.datesOnRequest.set(checked);
    if (checked) {
      this.datesError.set(null);
    }
    this.draftChange.emit();
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
      this.draftChange.emit();
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
    this.draftChange.emit();
    this.showToast('Portada actualizada desde URL.');
  }

  removeCoverImage(): void {
    this.coverImageUrl.set('');
    this.draftChange.emit();
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
      this.draftChange.emit();
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
    this.draftChange.emit();
    this.showToast('Video actualizado.');
  }

  removeVideo(): void {
    this.videoUrl.set('');
    this.draftChange.emit();
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
          title: '',
          caption: '',
          order: this.albumPhotos().length + 1,
          isFeatured: false,
        };
        this.albumPhotos.update((prev) => [...prev, newPhoto]);
        added++;
      }
      this.draftChange.emit();
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
    this.draftChange.emit();
    this.showToast('Foto sumada al álbum.');
  }

  getPhotoInputTitle(photo: ExperienceAlbumPhoto): string {
    if (photo.caption && photo.caption.trim()) {
      return photo.caption.trim();
    }
    if (photo.title && !this.isAutoGeneratedTitle(photo.title)) {
      return photo.title.trim();
    }
    return '';
  }

  isAutoGeneratedTitle(title?: string): boolean {
    if (!title) return true;
    const t = title.trim();
    if (
      t === 'Foto del álbum' ||
      t === 'Portada' ||
      t === 'Foto destacada' ||
      t === 'Foto de la experiencia' ||
      t === 'Foto de experiencia'
    ) {
      return true;
    }
    if (/- Destacada \d+$/i.test(t)) return true;
    if (/- Galería \d+$/i.test(t)) return true;
    if (/· Postal \d+$/i.test(t)) return true;
    const currentTitle = this.form.controls.title.value?.trim();
    if (currentTitle && t === currentTitle) return true;
    return false;
  }

  updatePhotoCaption(idx: number, caption: string): void {
    this.albumPhotos.update((photos) => {
      const updated = [...photos];
      if (updated[idx]) {
        updated[idx] = {
          ...updated[idx],
          title: caption,
          caption: caption,
        };
      }
      return updated;
    });
    this.draftChange.emit();
  }

  removeAlbumPhoto(idx: number): void {
    this.albumPhotos.update((photos) => photos.filter((_, i) => i !== idx));
    this.draftChange.emit();
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
      this.draftChange.emit();
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
      this.draftChange.emit();
      this.showToast('Foto fijada como destacada.');
    }
  }

  onSubmit(requestPublication = false): void {
    if (this.saving || this.isMediaUploading() || this.saveDisabled) return;
    this.savingAction.set(requestPublication ? 'publish' : 'save');
    this.form.markAllAsTouched();

    if (this.mode === 'provider' && requestPublication && this.dates().length === 0 && !this.datesOnRequest()) {
      this.datesError.set('Agregá al menos una fecha futura o seleccioná fechas a coordinar para solicitar publicación.');
      this.showToast('Por favor agregá al menos una fecha disponible o seleccioná fechas a coordinar.');
      return;
    }

    if (this.form.invalid) {
      this.showToast('Por favor completá los campos obligatorios del formulario.');
      if (typeof document !== 'undefined') {
        const firstInvalid = document.querySelector(
          '.panel-form input.ng-invalid, .panel-form select.ng-invalid, .panel-form textarea.ng-invalid',
        );
        if (firstInvalid instanceof HTMLElement) {
          firstInvalid.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
          firstInvalid.focus?.();
        }
      }
      return;
    }

    const value = this.form.getRawValue();

    const rawSlug = (value.slug || value.title).trim();
    let cleanSlug = rawSlug
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    if (RESERVED_EXPERIENCE_SLUGS.has(cleanSlug.toLowerCase())) {
      cleanSlug = `${cleanSlug}-exp`;
    }

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
      priceUsd: this.calculatedUsd(),
      capacityPerDate: Math.round(Number(value.capacityPerDate)),
      dates: this.dates(),
      datesOnRequest: this.datesOnRequest(),
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
      providerId:
        this.selectedProviderId() !== 'club' && this.selectedProviderId() !== 'custom'
          ? this.selectedProviderId()
          : undefined,
      providerEmail:
        this.selectedProviderId() !== 'club' && this.selectedProviderId() !== 'custom'
          ? this.registeredProviders.find((p) => p.id === this.selectedProviderId())?.email
          : undefined,
      status: value.status,
      displayLocation: value.displayLocation,
    };

    this.saveExperience.emit({ payload, requestPublication });
  }

  onCancel(): void {
    this.cancel.emit();
  }
}
