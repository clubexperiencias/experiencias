import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { ProviderStoreService } from '../../../core/services/provider-store.service';
import { ProviderExperience } from '../../../core/models/bank-transfer.model';
import { ArsPipe, FechaPipe } from '../../../shared/pipes/format.pipes';
import { ProviderExperienceProposalModalComponent } from '../provider-experience-proposal-modal/provider-experience-proposal-modal.component';
import { ProviderExperienceAlbumModalComponent } from '../provider-experience-album-modal/provider-experience-album-modal.component';

type ExpFilterTab = 'todas' | 'publicadas' | 'solicitudes' | 'revision' | 'borradores' | 'ocultas';

@Component({
  selector: 'app-provider-experiences',
  standalone: true,
  imports: [
    RouterLink,
    FormsModule,
    MatIconModule,
    ArsPipe,
    FechaPipe,
    ProviderExperienceProposalModalComponent,
    ProviderExperienceAlbumModalComponent,
  ],
  templateUrl: './provider-experiences.component.html',
  styleUrl: './provider-experiences.component.css',
})
export class ProviderExperiencesComponent implements OnInit {
  readonly store = inject(ProviderStoreService);
  private readonly route = inject(ActivatedRoute);
  readonly stats = this.store.providerStats;

  readonly activeTab = signal<ExpFilterTab>('todas');

  ngOnInit(): void {
    this.route.queryParams.subscribe((params) => {
      const tab = params['tab'] || params['filtro'];
      if (tab === 'solicitudes' || tab === 'publicadas' || tab === 'todas') {
        this.activeTab.set(tab as ExpFilterTab);
      }
    });
  }
  readonly searchQuery = signal('');
  readonly requests = this.store.providerExperienceRequests;
  readonly requestModalOpen = signal(false);
  readonly albumModalExp = signal<ProviderExperience | null>(null);
  readonly selectedExpForDelete = signal<ProviderExperience | null>(null);
  readonly deleteErrorModal = signal<string | null>(null);
  readonly hideReasonModal = signal<ProviderExperience | null>(null);
  readonly hideReasonText = signal('');
  readonly feedbackToast = signal<string | null>(null);

  readonly publishedCount = computed(
    () => this.store.providerExperiences().filter((e) => e.status === 'publicada').length,
  );
  readonly inReviewCount = computed(
    () =>
      this.store
        .providerExperiences()
        .filter(
          (e) =>
            e.status === 'pendiente_publicacion' ||
            e.status === 'pendiente_ocultar' ||
            e.status === 'pendiente_eliminar',
        ).length,
  );
  readonly draftsCount = computed(
    () => this.store.providerExperiences().filter((e) => e.status === 'borrador').length,
  );
  readonly hiddenCount = computed(
    () => this.store.providerExperiences().filter((e) => e.status === 'oculta').length,
  );
  readonly pendingRequestsCount = computed(
    () => this.requests().filter((r) => r.status === 'pendiente').length,
  );

  readonly filteredRequests = computed(() => {
    const list = this.requests();
    const query = this.searchQuery().trim().toLowerCase();
    if (!query) return list;
    return list.filter(
      (r) =>
        r.title.toLowerCase().includes(query) ||
        r.kicker?.toLowerCase().includes(query) ||
        r.region?.toLowerCase().includes(query) ||
        r.subheading?.toLowerCase().includes(query),
    );
  });

  openRequestModal(): void {
    this.requestModalOpen.set(true);
  }

  openAlbumModal(exp: ProviderExperience): void {
    this.albumModalExp.set(exp);
  }

  closeAlbumModal(): void {
    this.albumModalExp.set(null);
  }

  onAlbumSaved(updated: ProviderExperience): void {
    this.showToast(`📸 Álbum de "${updated.title}" guardado correctamente.`);
  }

  readonly rows = computed(() => {
    const list = this.store.providerExperiences();
    const tab = this.activeTab();
    const query = this.searchQuery().trim().toLowerCase();

    return list
      .filter((exp) => {
        if (tab === 'publicadas') return exp.status === 'publicada';
        if (tab === 'revision') {
          return (
            exp.status === 'pendiente_publicacion' ||
            exp.status === 'pendiente_ocultar' ||
            exp.status === 'pendiente_eliminar'
          );
        }
        if (tab === 'borradores') return exp.status === 'borrador';
        if (tab === 'ocultas') return exp.status === 'oculta';
        return true;
      })
      .filter((exp) => {
        if (!query) return true;
        return (
          exp.title.toLowerCase().includes(query) ||
          exp.tagline.toLowerCase().includes(query) ||
          exp.region.toLowerCase().includes(query) ||
          exp.difficulty.toLowerCase().includes(query) ||
          exp.description.toLowerCase().includes(query)
        );
      })
      .map((experience) => {
        const submissions = this.store.submissionsFor(experience.id);
        const enrolledCount = this.store.totalEnrolledInExperience(experience.id);
        const canDelete = this.store.canDeleteExperience(experience.id);

        return {
          experience,
          enrolledCount,
          canDelete,
          pendingSubmissions: submissions.filter((s) => s.status === 'pendiente').length,
          confirmedRevenue: submissions
            .filter((s) => s.status === 'aprobado')
            .reduce((total, s) => total + s.amountArs, 0),
          nextDates: experience.dates.slice(0, 3).map((date) => ({
            date,
            reserved: this.store.reservedSeats(experience.id, date),
          })),
        };
      });
  });

  onRequestPublish(exp: ProviderExperience): void {
    try {
      this.store.requestPublish(exp.id);
      this.showToast('✅ Solicitud de publicación enviada al Admin para revisión.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al solicitar publicación';
      this.showToast(`⚠️ ${msg}`);
    }
  }

  openHideModal(exp: ProviderExperience): void {
    this.hideReasonModal.set(exp);
    this.hideReasonText.set('');
  }

  confirmHide(): void {
    const exp = this.hideReasonModal();
    if (!exp) return;
    this.store.requestHide(exp.id, this.hideReasonText());
    this.hideReasonModal.set(null);
    this.showToast('🟠 Solicitud de ocultación enviada al Admin.');
  }

  onDeleteClick(exp: ProviderExperience): void {
    const check = this.store.canDeleteExperience(exp.id);
    if (!check.allowed) {
      this.deleteErrorModal.set(check.reason || 'No se puede eliminar la experiencia.');
      return;
    }
    this.selectedExpForDelete.set(exp);
  }

  confirmDelete(): void {
    const exp = this.selectedExpForDelete();
    if (!exp) return;
    try {
      this.store.requestDelete(exp.id);
      this.selectedExpForDelete.set(null);
      this.showToast('🔴 Solicitud de eliminación enviada al Admin.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al eliminar';
      this.showToast(`⚠️ ${msg}`);
    }
  }

  getWhatsappEditOrPauseLink(exp: ProviderExperience): string {
    const provider = this.store.currentProvider();
    const name = provider?.name || 'Prestador';
    const agency = provider?.agency ? ` (${provider.agency})` : '';
    const text = `Hola! Soy ${name}${agency}. Me comunico desde el Portal de Prestadores para realizar una solicitud de edición o pausa de la experiencia "${exp.title}" (ID: ${exp.id}). ¿Me podrían ayudar con la gestión?`;
    return `https://wa.me/5493515490431?text=${encodeURIComponent(text)}`;
  }

  getExperiencePublicUrl(exp: ProviderExperience): string {
    if (exp.publicUrl && exp.publicUrl.trim().length > 0) {
      return exp.publicUrl.trim();
    }
    return `https://experiencias.club/experiencias/${exp.slug}`;
  }

  getRequestWhatsappLink(req: { title: string; kicker?: string; id?: string }): string {
    const provider = this.store.currentProvider();
    const name = provider?.name || 'Prestador';
    const text = `Hola! Soy ${name}. Me comunico desde el Portal de Prestadores para consultar el estado de la propuesta de experiencia "${req.title}". ¿Tienen alguna novedad?`;
    return `https://wa.me/5493515490431?text=${encodeURIComponent(text)}`;
  }

  onAdminSimulateApprove(expId: string): void {
    this.store.adminApproveAction(expId);
    this.showToast('✨ [Simulador Admin] Solicitud aprobada con éxito.');
  }

  private showToast(msg: string): void {
    this.feedbackToast.set(msg);
    setTimeout(() => this.feedbackToast.set(null), 4000);
  }

  refresh(): void {
    // Los datos son reactivos en memoria; forzar re-render actualizando la búsqueda
    const q = this.searchQuery();
    this.searchQuery.set(q + ' ');
    setTimeout(() => this.searchQuery.set(q), 0);
  }

  downloadCatalog(): void {
    const list = this.rows();
    const headers = ['Título', 'Estado', 'Región', 'Dificultad', 'Duración', 'Precio ARS', 'Capacidad', 'Socios Anotados', 'Ingresos Confirmados'];
    const escapeCsv = (val: unknown): string => {
      let str = val != null ? String(val) : '';
      if (/^[=+\-@\t\r]/.test(str)) str = "'" + str;
      return `"${str.replace(/"/g, '""')}"`;
    };
    const rows = [
      headers.map(escapeCsv).join(','),
      ...list.map((r) =>
        [
          escapeCsv(r.experience.title),
          escapeCsv(r.experience.status),
          escapeCsv(r.experience.region),
          escapeCsv(r.experience.difficulty),
          escapeCsv(r.experience.durationLabel),
          escapeCsv(r.experience.priceArs),
          escapeCsv(r.experience.capacityPerDate),
          escapeCsv(r.enrolledCount),
          escapeCsv(r.confirmedRevenue),
        ].join(','),
      ),
    ];
    const blob = new Blob(['\uFEFF' + rows.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `catalogo_experiencias_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }
}
