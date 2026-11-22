import {
  Component,
  OnInit,
  AfterViewInit,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { ProviderStoreService } from '../../../core/services/provider-store.service';
import { ExperienceService } from '../../../core/services/experience.service';
import { ExperienceStatus, ProviderExperience } from '../../../core/models/bank-transfer.model';
import {
  ExperienceFormComponent,
  ExperienceFormPayload,
} from '../../../shared/components/experience-form/experience-form.component';
import {
  loadMediaDraftFromDb,
  clearMediaDraftFromDb,
  PersistedMediaDraft,
} from '../../../shared/utils/media-draft-db.util';

@Component({
  selector: 'app-provider-experience-form',
  standalone: true,
  imports: [RouterLink, MatIconModule, ExperienceFormComponent],
  templateUrl: './provider-experience-form.component.html',
  styleUrl: './provider-experience-form.component.css',
})
export class ProviderExperienceFormComponent implements OnInit, AfterViewInit {
  private readonly store = inject(ProviderStoreService);
  private readonly expService = inject(ExperienceService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  static readonly DRAFT_STORAGE_KEY = 'experiencias_provider_experience_form_draft';

  @ViewChild(ExperienceFormComponent) expFormComponent?: ExperienceFormComponent;

  private isSubmitted = false;
  private draftSessionId = 0;

  readonly isEditMode = signal(false);
  readonly editingExpId = signal<string | null>(null);
  readonly editingExpSlug = signal<string | null>(null);
  readonly currentStatus = signal<ExperienceStatus>('borrador');
  readonly notFound = signal(false);
  readonly loadError = signal(false);
  readonly saving = signal(false);
  readonly saveError = signal<string | null>(null);
  readonly loadedExperience = signal<ProviderExperience | null>(null);
  readonly hasDraft = signal<boolean>(false);

  readonly backLink = computed(() => {
    const isPanel =
      typeof window !== 'undefined' && window.location.pathname.includes('/prestadores/panel');
    return isPanel ? '/prestadores/panel/experiencias' : '/experiencias';
  });

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
        this.currentStatus.set(exp.status || 'borrador');
        const { slug: _slug, ...expWithoutSlug } = exp;
        this.loadedExperience.set(expWithoutSlug as ProviderExperience);
      } else {
        this.notFound.set(true);
      }
    } else {
      await this.loadDraft();
    }
  }

  ngAfterViewInit(): void {
    if (!this.isEditMode() && this.expFormComponent) {
      this.expFormComponent.form.valueChanges.subscribe(() => {
        if (!this.isEditMode()) {
          this.saveDraft();
        }
      });
    }
  }

  async loadDraft(): Promise<void> {
    if (typeof localStorage === 'undefined') return;
    const currentSession = ++this.draftSessionId;

    let formDraft: any = null;
    let proposalDraft: any = null;

    try {
      const rawFormDraft = localStorage.getItem(
        ProviderExperienceFormComponent.DRAFT_STORAGE_KEY,
      );
      if (rawFormDraft) {
        formDraft = JSON.parse(rawFormDraft);
      }
    } catch (err) {
      console.warn('[ProviderExperienceForm] Error parsing form draft:', err);
    }

    try {
      const rawProposalDraft = localStorage.getItem('experiencias_provider_proposal_draft');
      if (rawProposalDraft) {
        proposalDraft = JSON.parse(rawProposalDraft);
      }
    } catch (err) {
      console.warn('[ProviderExperienceForm] Error parsing proposal draft:', err);
    }

    let mediaDraft: PersistedMediaDraft | null = null;
    try {
      mediaDraft = await loadMediaDraftFromDb('experiencias_provider_proposal_media');
    } catch (err) {
      console.warn('[ProviderExperienceForm] Error loading media draft from DB:', err);
    }

    if (currentSession !== this.draftSessionId) return;

    if (!formDraft && !proposalDraft && !mediaDraft) {
      this.hasDraft.set(false);
      return;
    }

    const formVal = formDraft?.formValue || {};
    const reqForm = proposalDraft?.reqForm || {};

    const title = formVal.title || reqForm.title || '';
    const slug = formVal.slug || '';
    const tagline = formVal.tagline || reqForm.title || '';
    const description = formVal.description || reqForm.subheading || '';
    const category = formVal.category || reqForm.category || 'expediciones';
    const region = formVal.region || reqForm.region || 'Valle Central y Ambato';
    const difficulty = formVal.difficulty || reqForm.difficulty || 'Ninguna';
    const durationLabel = formVal.durationLabel || reqForm.duration || '';
    const altitudeMeters =
      formVal.altitudeMeters ??
      (reqForm.altitude ? Number(String(reqForm.altitude).replace(/\D/g, '')) : 850);
    const meetingPoint = formVal.meetingPoint || reqForm.meetingPoint || '';
    const meetingPointUrl = formVal.meetingPointUrl || reqForm.meetingPointUrl || '';
    const priceArs = formVal.priceArs ?? (reqForm.priceArs ? Number(reqForm.priceArs) : 65000);
    const capacityPerDate =
      formVal.capacityPerDate ?? (reqForm.capacity ? Number(reqForm.capacity) : 12);

    let dates: string[] = [];
    if (Array.isArray(formDraft?.dates)) {
      dates = formDraft.dates;
    } else if (reqForm.dates && typeof reqForm.dates === 'string') {
      const parsed = reqForm.dates.match(/\b\d{4}-\d{2}-\d{2}\b/g) || [];
      dates = parsed;
    }

    const datesOnRequest =
      formDraft?.datesOnRequest ??
      (reqForm.dates ? reqForm.dates.toLowerCase().includes('coordinar') : false);

    const pricingPacks = Array.isArray(formDraft?.pricingPacks) ? formDraft.pricingPacks : [];

    let coverImage = formDraft?.coverImageUrl || proposalDraft?.coverImageDataUrl || '';
    if (!coverImage && mediaDraft?.coverImage) {
      coverImage =
        mediaDraft.coverImage.dataUrl ||
        (mediaDraft.coverImage.blob ? URL.createObjectURL(mediaDraft.coverImage.blob) : '');
    }

    let videoUrl = formDraft?.videoUrl || '';
    if (!videoUrl && mediaDraft?.coverVideo) {
      videoUrl =
        mediaDraft.coverVideo.dataUrl ||
        (mediaDraft.coverVideo.blob ? URL.createObjectURL(mediaDraft.coverVideo.blob) : '');
    }

    let albumPhotos: any[] = [];
    if (Array.isArray(formDraft?.albumPhotos) && formDraft.albumPhotos.length > 0) {
      albumPhotos = formDraft.albumPhotos;
    } else if (mediaDraft?.galleryPhotos && mediaDraft.galleryPhotos.length > 0) {
      albumPhotos = mediaDraft.galleryPhotos
        .map((p, idx) => ({
          id: p.id || `photo_${idx + 1}`,
          url: p.dataUrl || (p.blob ? URL.createObjectURL(p.blob) : ''),
          title: p.name || 'Foto de experiencia',
          order: idx + 1,
        }))
        .filter((p) => Boolean(p.url));
    }

    const itinerary = formDraft?.itinerary || reqForm.itinerary || '';
    const includedServices = formDraft?.includedRaw || reqForm.includedServices || '';
    const participantRequirements =
      formDraft?.requirementsRaw || reqForm.participantRequirements || '';
    const highlights = formDraft?.highlightsRaw
      ? formDraft.highlightsRaw
          .split('\n')
          .map((h: string) => h.trim())
          .filter(Boolean)
      : [];

    const hasMeaningfulContent = Boolean(
      title.trim() ||
      tagline.trim() ||
      description.trim() ||
      meetingPoint.trim() ||
      meetingPointUrl.trim() ||
      coverImage.trim() ||
      videoUrl.trim() ||
      albumPhotos.length > 0 ||
      dates.length > 0 ||
      datesOnRequest ||
      pricingPacks.length > 0 ||
      itinerary.trim() ||
      includedServices.trim() ||
      participantRequirements.trim()
    );

    if (hasMeaningfulContent) {
      const restoredDraft: any = {
        id: '',
        slug,
        title,
        tagline,
        description,
        category,
        region,
        difficulty,
        durationLabel,
        altitudeMeters,
        meetingPoint,
        meetingPointUrl,
        priceArs,
        capacityPerDate,
        dates,
        datesOnRequest,
        pricingPacks,
        coverImage,
        videoUrl,
        coverVideoUrl: videoUrl,
        albumPhotos,
        galleryImages: albumPhotos.map((p: any) => p.url),
        itinerary,
        includedServices,
        included: includedServices
          ? includedServices.split('\n').map((s: string) => s.trim()).filter(Boolean)
          : [],
        participantRequirements,
        highlights,
        status: 'borrador',
      };
      this.loadedExperience.set(restoredDraft);
      this.hasDraft.set(true);
    } else {
      this.hasDraft.set(false);
    }
  }

  onDraftChange(): void {
    if (!this.isEditMode()) {
      this.saveDraft();
    }
  }

  saveDraft(): void {
    if (typeof localStorage === 'undefined' || this.isEditMode() || this.saving() || this.isSubmitted) return;
    try {
      const formComp = this.expFormComponent;
      if (!formComp) return;
      const val = formComp.form.getRawValue();
      const hasContent = Boolean(
        val.title?.trim() ||
        val.tagline?.trim() ||
        val.description?.trim() ||
        val.meetingPoint?.trim() ||
        val.meetingPointUrl?.trim() ||
        val.durationLabel?.trim() ||
        formComp.coverImageUrl()?.trim() ||
        formComp.videoUrl()?.trim() ||
        formComp.albumPhotos().length > 0 ||
        formComp.dates().length > 0 ||
        formComp.datesOnRequest() ||
        formComp.pricingPacks().length > 0 ||
        formComp.includedRaw()?.trim() ||
        formComp.highlightsRaw()?.trim() ||
        formComp.requirementsRaw()?.trim() ||
        formComp.itinerary()?.trim()
      );

      if (!hasContent) {
        return;
      }

      const payload = {
        formValue: val,
        dates: formComp.dates(),
        datesOnRequest: formComp.datesOnRequest(),
        pricingPacks: formComp.pricingPacks(),
        coverImageUrl: formComp.coverImageUrl(),
        videoUrl: formComp.videoUrl(),
        albumPhotos: formComp.albumPhotos(),
        includedRaw: formComp.includedRaw(),
        highlightsRaw: formComp.highlightsRaw(),
        requirementsRaw: formComp.requirementsRaw(),
        itinerary: formComp.itinerary(),
        updatedAt: Date.now(),
      };
      localStorage.setItem(
        ProviderExperienceFormComponent.DRAFT_STORAGE_KEY,
        JSON.stringify(payload),
      );
      this.hasDraft.set(true);
    } catch (err) {
      console.warn('[ProviderExperienceForm] Error al guardar borrador:', err);
    }
  }

  clearDraft(): void {
    this.draftSessionId++;
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem(ProviderExperienceFormComponent.DRAFT_STORAGE_KEY);
        localStorage.removeItem('experiencias_provider_proposal_draft');
      } catch {
        // ignore
      }
    }
    if (typeof sessionStorage !== 'undefined') {
      try {
        sessionStorage.removeItem('experiencias_provider_proposal_media');
      } catch {
        // ignore
      }
    }
    void clearMediaDraftFromDb('experiencias_provider_proposal_media');
    this.hasDraft.set(false);
  }

  discardDraft(): void {
    this.isSubmitted = false;
    this.clearDraft();
    this.loadedExperience.set(null);
    this.expFormComponent?.resetForm();
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
      this.editingExpId.set(exp.id);
      this.editingExpSlug.set(exp.slug || exp.id);
      this.currentStatus.set(exp.status || 'borrador');
      const { slug: _slug, ...expWithoutSlug } = exp;
      this.loadedExperience.set(expWithoutSlug as ProviderExperience);
    } else if (!loadOk) {
      this.loadError.set(true);
    } else {
      this.notFound.set(true);
    }
  }

  async onSave(event: {
    payload: ExperienceFormPayload;
    requestPublication?: boolean;
  }): Promise<void> {
    if (this.isEditMode() && !this.loadedExperience()) {
      return;
    }

    const { payload, requestPublication } = event;
    this.saveError.set(null);
    this.saving.set(true);

    try {
      if (this.isEditMode() && this.editingExpId()) {
        const { slug: _slug, ...payloadWithoutSlug } = payload;
        await this.store.saveExperienceChanges(this.editingExpId()!, {
          ...payloadWithoutSlug,
          dates: payload.dates,
          datesOnRequest: payload.datesOnRequest ?? (payload.dates.length === 0),
          difficulty: payload.difficulty as ProviderExperience['difficulty'],
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
        const currentProv = this.store.currentProvider();
        const providerId = currentProv?.id || 'prov-default';
        const providerName = currentProv?.agency || currentProv?.name || 'Prestador Catamarca';
        const providerEmail = currentProv?.email || '';

        if (requestPublication) {
          const requestDates =
            payload.datesOnRequest || payload.dates.length === 0
              ? (payload.dates.length > 0 ? `${payload.dates.join(', ')} (A coordinar)` : 'A coordinar')
              : payload.dates.join(', ');

          // Await remote proposal write to place in admin review queue before navigating
          await this.store.submitExperienceRequest({
            slug: payload.slug,
            providerId,
            providerName: currentProv?.name || providerName,
            providerAgency: currentProv?.agency || 'Prestador emergente del Club',
            providerEmail,
            providerPhone: currentProv?.phone || undefined,
            providerCbuAlias: currentProv?.cbuAlias,
            providerBankName: currentProv?.bankName,
            providerCuitDni: currentProv?.cuitDni,
            title: payload.title,
            kicker: 'EXPERIENCIA',
            subheading: payload.description,
            category: payload.category || 'expediciones',
            region: payload.region,
            difficulty: payload.difficulty,
            duration: payload.durationLabel,
            altitude: `${payload.altitudeMeters} msnm`,
            capacity: payload.capacityPerDate,
            season: 'Todo el año',
            dates: requestDates,
            datesOnRequest: payload.datesOnRequest ?? (payload.dates.length === 0),
            priceArs: payload.priceArs,
            priceUsd: Math.round(payload.priceArs / 1300),
            promosAndPricing: '',
            itinerary: payload.itinerary,
            meetingPoint: payload.meetingPoint,
            meetingPointUrl: payload.meetingPointUrl,
            includedServices: payload.includedServices,
            participantRequirements: payload.participantRequirements,
            coverImage: payload.coverImage,
            coverVideoUrl: payload.videoUrl,
            albumPhotos: payload.albumPhotos,
            galleryImages: payload.galleryImages,
          });

          this.store.createExperience(
            {
              ...payload,
              dates: payload.dates,
              datesOnRequest: payload.datesOnRequest ?? (payload.dates.length === 0),
              difficulty: payload.difficulty as ProviderExperience['difficulty'],
              status: 'pendiente_publicacion',
              providerId,
              providerName,
            },
            true,
          );
        } else {
          // Keep draft saves local
          this.store.createExperience(
            {
              ...payload,
              dates: payload.dates,
              datesOnRequest: payload.datesOnRequest ?? (payload.dates.length === 0),
              difficulty: payload.difficulty as ProviderExperience['difficulty'],
              status: 'borrador',
              providerId,
              providerName,
            },
            false,
          );
        }

        this.isSubmitted = true;
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

  onCancel(): void {
    if (this.isEditMode() && (this.editingExpSlug() || this.editingExpId())) {
      this.router.navigate([this.backLink(), this.editingExpSlug() || this.editingExpId()]);
    } else {
      this.router.navigate([this.backLink()]);
    }
  }
}
