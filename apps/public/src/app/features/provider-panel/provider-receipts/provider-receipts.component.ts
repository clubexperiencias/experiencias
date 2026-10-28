import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { MatIconModule } from '@angular/material/icon';
import { ProviderStoreService } from '../../../core/services/provider-store.service';
import { BANK_TRANSFER_DESTINATION, TransferStatus } from '../../../core/models/bank-transfer.model';
import { ArsPipe, FechaPipe } from '../../../shared/pipes/format.pipes';

type StatusFilter = TransferStatus | 'todos';

@Component({
  selector: 'app-provider-receipts',
  standalone: true,
  imports: [MatIconModule, ArsPipe, FechaPipe],
  templateUrl: './provider-receipts.component.html',
  styleUrl: './provider-receipts.component.css',
})
export class ProviderReceiptsComponent {
  readonly store = inject(ProviderStoreService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly cbu = BANK_TRANSFER_DESTINATION.cbu;
  readonly filters: { value: StatusFilter; label: string }[] = [
    { value: 'pendiente', label: 'Pendientes' },
    { value: 'aprobado', label: 'Aprobados' },
    { value: 'rechazado', label: 'Rechazados' },
    { value: 'todos', label: 'Todos' },
  ];

  readonly statusFilter = signal<StatusFilter>('pendiente');
  readonly experienceFilter = toSignal(
    this.route.queryParamMap.pipe(map((params) => params.get('experiencia') ?? '')),
    { initialValue: '' },
  );

  readonly filtered = computed(() => {
    const status = this.statusFilter();
    const experienceId = this.experienceFilter();
    return this.store
      .submissions()
      .filter((s) => (status === 'todos' || s.status === status) && (!experienceId || s.experienceId === experienceId));
  });

  readonly countFor = (status: StatusFilter) =>
    this.store
      .submissions()
      .filter((s) => (status === 'todos' || s.status === status) && (!this.experienceFilter() || s.experienceId === this.experienceFilter()))
      .length;

  readonly selectedId = signal<string | null>(null);
  readonly selected = computed(() => this.store.submissions().find((s) => s.id === this.selectedId()) ?? null);
  readonly rejecting = signal(false);
  readonly rejectionReason = signal('');

  setExperienceFilter(experienceId: string): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { experiencia: experienceId || null },
      queryParamsHandling: 'merge',
    });
  }

  open(id: string): void {
    this.selectedId.set(id);
    this.rejecting.set(false);
    this.rejectionReason.set('');
  }

  close(): void {
    this.selectedId.set(null);
  }

  @HostListener('window:keydown.escape')
  onEscape(): void {
    if (this.selectedId()) this.close();
  }

  approve(): void {
    const sub = this.selected();
    if (!sub) return;
    this.store.reviewSubmission(sub.id, 'aprobado');
  }

  reject(): void {
    const sub = this.selected();
    const reason = this.rejectionReason().trim();
    if (!sub || reason.length < 5) return;
    this.store.reviewSubmission(sub.id, 'rechazado', reason);
    this.rejecting.set(false);
  }

  isPdf(mimeType: string): boolean {
    return mimeType === 'application/pdf';
  }
}
