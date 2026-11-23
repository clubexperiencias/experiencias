import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { Experience } from '../../../core/models/experience.model';

export type ExperienceDrawerDirection = 'right' | 'left';
export type ExperienceDrawerTab = 'details' | 'itinerary';

@Component({
  selector: 'app-experience-drawer',
  standalone: true,
  imports: [CommonModule, RouterLink, MatIconModule],
  templateUrl: './experience-drawer.component.html',
  styleUrl: './experience-drawer.component.css',
})
export class ExperienceDrawerComponent {
  @Input({ required: true }) experience!: Experience;
  @Input() direction: ExperienceDrawerDirection = 'right';
  @Input() showFullFicheLink = true;

  @Output() close = new EventEmitter<void>();
  @Output() reserve = new EventEmitter<Experience>();

  readonly activeTab = signal<ExperienceDrawerTab>('details');

  get kickerText(): string {
    return this.direction === 'right'
      ? 'FICHA TÉCNICA Y RECORRIDO →'
      : '← FICHA TÉCNICA Y RECORRIDO';
  }

  onClose(event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.close.emit();
  }

  onReserve(): void {
    this.reserve.emit(this.experience);
  }
}

