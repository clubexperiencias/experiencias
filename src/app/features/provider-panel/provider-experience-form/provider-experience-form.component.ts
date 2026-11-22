import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ProviderStoreService } from '../../../core/services/provider-store.service';
import { ExperienceService } from '../../../core/services/experience.service';
import { ExperienceStatus, ProviderExperience } from '../../../core/models/bank-transfer.model';
import {
  ExperienceFormComponent,
  ExperienceFormPayload,
} from '../../../shared/components/experience-form/experience-form.component';

@Component({
  selector: 'app-provider-experience-form',
  standalone: true,
  imports: [RouterLink, ExperienceFormComponent],
  templateUrl: './provider-experience-form.component.html',
  styleUrl: './provider-experience-form.component.css',
})
export class ProviderExperienceFormComponent implements OnInit {
  private readonly store = inject(ProviderStoreService);
  private readonly expService = inject(ExperienceService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly isEditMode = signal(false);
  readonly editingExpId = signal<string | null>(null);
  readonly editingExpSlug = signal<string | null>(null);
  readonly currentStatus = signal<ExperienceStatus>('borrador');
  readonly notFound = signal(false);
  readonly loadError = signal(false);
  readonly saving = signal(false);
  readonly saveError = signal<string | null>(null);
  readonly loadedExperience = signal<ProviderExperience | null>(null);

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
        this.loadedExperience.set(exp);
      } else {
        this.notFound.set(true);
      }
    }
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
      this.loadedExperience.set(exp);
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
    const { payload, requestPublication } = event;
    this.saveError.set(null);
    this.saving.set(true);

    try {
      if (this.isEditMode() && this.editingExpId()) {
        await this.store.saveExperienceChanges(this.editingExpId()!, {
          ...payload,
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
        this.store.createExperience(
          {
            ...payload,
            difficulty: payload.difficulty as ProviderExperience['difficulty'],
            status: requestPublication ? 'pendiente_publicacion' : 'borrador',
            providerId: this.store.currentProvider()?.id || 'prov-default',
            providerName: this.store.currentProvider()?.agency || 'Prestador Catamarca',
          },
          Boolean(requestPublication),
        );
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
