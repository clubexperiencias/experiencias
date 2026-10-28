import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { ProviderStoreService } from '../../../core/services/provider-store.service';
import { ProviderExperience } from '../../../core/models/bank-transfer.model';
import { ArsPipe, FechaPipe } from '../../../shared/pipes/format.pipes';

@Component({
  selector: 'app-provider-experiences',
  standalone: true,
  imports: [RouterLink, MatIconModule, ArsPipe, FechaPipe],
  templateUrl: './provider-experiences.component.html',
  styleUrl: './provider-experiences.component.css',
})
export class ProviderExperiencesComponent {
  readonly store = inject(ProviderStoreService);

  readonly rows = computed(() =>
    this.store.experiences().map((experience) => {
      const submissions = this.store.submissionsFor(experience.id);
      return {
        experience,
        pending: submissions.filter((s) => s.status === 'pendiente').length,
        confirmedRevenue: submissions
          .filter((s) => s.status === 'aprobado')
          .reduce((total, s) => total + s.amountArs, 0),
        nextDates: experience.dates.slice(0, 3).map((date) => ({
          date,
          reserved: this.store.reservedSeats(experience.id, date),
        })),
      };
    }),
  );

  toggleStatus(experience: ProviderExperience): void {
    this.store.setExperienceStatus(experience.id, experience.status === 'publicada' ? 'borrador' : 'publicada');
  }
}
