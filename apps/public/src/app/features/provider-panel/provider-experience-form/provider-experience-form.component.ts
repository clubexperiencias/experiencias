import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { ProviderStoreService } from '../../../core/services/provider-store.service';
import { ExperienceStatus, ProviderExperience } from '../../../core/models/bank-transfer.model';
import { FechaPipe } from '../../../shared/pipes/format.pipes';

const MAX_DATES = 20;

@Component({
  selector: 'app-provider-experience-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, MatIconModule, FechaPipe],
  templateUrl: './provider-experience-form.component.html',
  styleUrl: './provider-experience-form.component.css',
})
export class ProviderExperienceFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly store = inject(ProviderStoreService);
  private readonly router = inject(Router);

  readonly difficulties: ProviderExperience['difficulty'][] = ['Baja', 'Moderada', 'Exigente', 'Alta Montaña'];
  readonly regions = [
    'Valle Central y Ambato',
    'Puna de Atacama',
    'Antofagasta de la Sierra',
    'Fiambalá y Seismiles',
    'Belén y Ruta del Telar',
  ];
  readonly today = new Date().toISOString().slice(0, 10);

  readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(90)]],
    tagline: ['', [Validators.required, Validators.maxLength(140)]],
    description: ['', [Validators.required, Validators.minLength(40), Validators.maxLength(2000)]],
    region: [this.regions[0], Validators.required],
    meetingPoint: ['', [Validators.required, Validators.maxLength(140)]],
    difficulty: this.fb.nonNullable.control<ProviderExperience['difficulty']>('Baja', Validators.required),
    durationLabel: ['', [Validators.required, Validators.maxLength(40)]],
    priceArs: [0, [Validators.required, Validators.min(1000), Validators.max(10_000_000)]],
    capacityPerDate: [10, [Validators.required, Validators.min(1), Validators.max(200)]],
  });

  readonly dates = signal<string[]>([]);
  readonly newDate = signal('');
  readonly datesError = signal<string | null>(null);

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
  }

  removeDate(date: string): void {
    this.dates.update((list) => list.filter((d) => d !== date));
  }

  fieldInvalid(name: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[name];
    return control.invalid && (control.touched || control.dirty);
  }

  save(status: ExperienceStatus): void {
    this.form.markAllAsTouched();
    if (status === 'publicada' && this.dates().length === 0) {
      this.datesError.set('Agregá al menos una fecha para publicar.');
      return;
    }
    if (this.form.invalid) return;

    const value = this.form.getRawValue();
    this.store.createExperience({
      ...value,
      title: value.title.trim(),
      tagline: value.tagline.trim(),
      description: value.description.trim(),
      meetingPoint: value.meetingPoint.trim(),
      durationLabel: value.durationLabel.trim(),
      priceArs: Math.round(Number(value.priceArs)),
      capacityPerDate: Math.round(Number(value.capacityPerDate)),
      dates: this.dates(),
      status,
    });
    this.router.navigate(['/prestador/experiencias']);
  }
}
