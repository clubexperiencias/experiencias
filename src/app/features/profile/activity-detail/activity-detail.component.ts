import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ActivityHistoryService } from '../../../core/services/activity-history.service';
import { NewsletterService } from '../../../core/services/newsletter.service';
import { ActivityRecord, CommunityPhoto } from '../../../core/models/activity-history.model';
import { BreadcrumbComponent, BreadcrumbItem } from '../../../shared/components/breadcrumb/breadcrumb.component';
import { HeaderComponent } from '../../../shared/components/header/header.component';
import { FooterComponent } from '../../../shared/components/footer/footer.component';

interface StagedPhoto {
  previewUrl: string;
  caption: string;
  name: string;
}

@Component({
  selector: 'app-activity-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, BreadcrumbComponent, HeaderComponent, FooterComponent],
  templateUrl: './activity-detail.component.html',
  styleUrls: ['./activity-detail.component.css']
})
export class ActivityDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  readonly activityService = inject(ActivityHistoryService);
  private readonly newsletter = inject(NewsletterService);

  mobileMenuOpen = false;
  readonly slug = signal<string>('');

  // Actividad reactiva
  readonly activity = computed<ActivityRecord | undefined>(() => {
    return this.activityService.getActivityBySlug(this.slug());
  });

  // Breadcrumbs reactivos
  readonly breadcrumbs = computed<BreadcrumbItem[]>(() => {
    const act = this.activity();
    return [
      { label: 'Inicio', url: '/' },
      { label: 'Mi Perfil', url: '/perfil' },
      { label: 'Actividades', url: '/perfil/actividades' },
      { label: act ? act.title : 'Detalle de Actividad' }
    ];
  });

  // Subida de fotos (hasta 3 fotos)
  readonly stagedPhotos = signal<StagedPhoto[]>([]);
  readonly uploadSuccessMessage = signal<string | null>(null);
  readonly uploadErrorMessage = signal<string | null>(null);
  readonly isUploading = signal<boolean>(false);

  // Votación con 5 estrellas y reseña
  readonly selectedRating = signal<number>(5);
  readonly hoverRating = signal<number>(0);
  readonly reviewComment = signal<string>('');
  readonly reviewSubmitted = signal<boolean>(false);
  readonly reviewErrorMessage = signal<string | null>(null);

  // Firma del usuario (Nombre y la inicial del apellido)
  readonly authorSignature = signal<string>('');

  // Lightbox para fotos de la comunidad
  readonly activeLightboxPhoto = signal<CommunityPhoto | null>(null);

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const s = params.get('slug');
      if (s) {
        this.slug.set(s);
      }
    });

    // Calcular firma por defecto a partir del perfil actual
    const memberName =
      this.newsletter.currentMember()?.fullName ||
      this.newsletter.currentMember()?.email?.split('@')[0] ||
      'Gonzalo Gramaglia';
    this.authorSignature.set(this.activityService.formatAuthorSignature(memberName));
  }

  formatUploadDate(dateStr: string | undefined): string {
    if (!dateStr) return '';
    const months = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];

    const match = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}:\d{2})(?:\s*hs)?)?$/);
    if (!match) {
      return dateStr;
    }

    const day = parseInt(match[1], 10);
    const monthIndex = parseInt(match[2], 10) - 1;
    const year = match[3];
    const time = match[4];

    const monthName = months[monthIndex] || match[2];
    if (time) {
      return `${day} de ${monthName} de ${year} a las ${time}`;
    }
    return `${day} de ${monthName} de ${year}`;
  }

  setRating(stars: number): void {
    this.selectedRating.set(stars);
  }

  setHoverRating(stars: number): void {
    this.hoverRating.set(stars);
  }

  clearHoverRating(): void {
    this.hoverRating.set(0);
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    this.uploadSuccessMessage.set(null);
    this.uploadErrorMessage.set(null);

    const currentCount = this.stagedPhotos().length;
    const availableSlots = 3 - currentCount;

    if (availableSlots <= 0) {
      this.uploadErrorMessage.set('Ya alcanzaste el límite máximo de 3 fotos para esta actividad.');
      return;
    }

    const filesToProcess = Array.from(input.files).slice(0, availableSlots);

    filesToProcess.forEach((file) => {
      if (!file.type.startsWith('image/')) {
        this.uploadErrorMessage.set('Por favor seleccioná únicamente archivos de imagen.');
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const previewUrl = e.target?.result as string;
        this.stagedPhotos.update((prev) => [
          ...prev,
          {
            previewUrl,
            caption: '',
            name: file.name
          }
        ]);
      };
      reader.readAsDataURL(file);
    });

    // Reset input
    input.value = '';
  }

  removeStagedPhoto(index: number): void {
    this.stagedPhotos.update((prev) => prev.filter((_, i) => i !== index));
  }

  submitPhotos(): void {
    const photos = this.stagedPhotos();
    if (photos.length === 0) {
      this.uploadErrorMessage.set('Por favor seleccioná al menos una foto antes de subir.');
      return;
    }

    this.isUploading.set(true);
    this.uploadErrorMessage.set(null);

    setTimeout(() => {
      const success = this.activityService.uploadCommunityPhotos(
        this.slug(),
        photos.map((p) => ({ url: p.previewUrl, caption: p.caption })),
        this.authorSignature()
      );

      this.isUploading.set(false);
      if (success) {
        this.uploadSuccessMessage.set(
          `¡${photos.length} foto${photos.length > 1 ? 's subidas' : ' subida'} con éxito al álbum de la actividad!`
        );
        this.stagedPhotos.set([]);
      } else {
        this.uploadErrorMessage.set('No se pudieron guardar las fotos. Intentá nuevamente.');
      }
    }, 600);
  }

  submitReview(): void {
    const comment = this.reviewComment().trim();
    if (!comment) {
      this.reviewErrorMessage.set('Por favor escribí un comentario sobre tu experiencia.');
      return;
    }

    this.reviewErrorMessage.set(null);
    const success = this.activityService.addReview(this.slug(), {
      rating: this.selectedRating(),
      comment,
      authorSignature: this.authorSignature()
    });

    if (success) {
      this.reviewSubmitted.set(true);
      this.reviewComment.set('');
    } else {
      this.reviewErrorMessage.set('Ocurrió un error al guardar tu reseña.');
    }
  }

  printReceipt(): void {
    window.print();
  }

  openLightbox(photo: CommunityPhoto): void {
    this.activeLightboxPhoto.set(photo);
  }

  closeLightbox(): void {
    this.activeLightboxPhoto.set(null);
  }

  openLoginModal(): void {}
}
