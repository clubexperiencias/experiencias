import {
  Component,
  ElementRef,
  HostListener,
  ViewChild,
  inject,
  input,
  output,
  signal,
  computed,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { ProviderStoreService } from '../../../core/services/provider-store.service';
import { StorageService } from '../../../core/services/storage.service';
import { ProviderExperience } from '../../../core/models/bank-transfer.model';
import { ExperienceAlbumPhoto } from '../../../core/models/experience.model';

@Component({
  selector: 'app-provider-experience-album-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './provider-experience-album-modal.component.html',
  styleUrl: './provider-experience-album-modal.component.css',
})
export class ProviderExperienceAlbumModalComponent {
  readonly store = inject(ProviderStoreService);
  readonly storageService = inject(StorageService);
  readonly router = inject(Router);

  readonly isOpen = input<boolean>(false);
  readonly experience = input<ProviderExperience | null>(null);

  readonly close = output<void>();
  readonly saved = output<ProviderExperience>();

  readonly photos = signal<ExperienceAlbumPhoto[]>([]);
  readonly newPhotoUrl = signal('');
  readonly newPhotoTitle = signal('');
  readonly newPhotoCaption = signal('');
  readonly validationError = signal<string | null>(null);
  readonly isSaving = signal(false);

  @ViewChild('modalDialog') modalDialog?: ElementRef<HTMLElement>;
  private previousActiveElement: HTMLElement | null = null;

  // Computeds for validation counters
  readonly totalCount = computed(() => this.photos().length);
  readonly coverCount = computed(() => this.photos().filter((p) => p.isCover).length);
  readonly featuredCount = computed(() => this.photos().filter((p) => p.isFeatured).length);
  readonly canAddMore = computed(() => this.photos().length < 12);

  readonly remainingSlots = computed(() => 12 - this.photos().length);

  readonly isFormValid = computed(() => {
    const total = this.totalCount();
    if (total === 0) return false;
    if (total > 12) return false;
    if (this.coverCount() !== 1) return false;
    if (total >= 3 && this.featuredCount() !== 2) return false;
    return true;
  });

  constructor() {
    effect(
      () => {
        if (this.isOpen()) {
          const exp = this.experience();
          if (exp) {
            this.initPhotos(exp);
          }
          this.validationError.set(null);
          if (typeof document !== 'undefined') {
            this.previousActiveElement = document.activeElement as HTMLElement | null;
          }
          setTimeout(() => {
            this.focusInitialElement();
          }, 0);
        }
      },
      { allowSignalWrites: true },
    );
  }

  private getFocusableElements(): HTMLElement[] {
    if (!this.modalDialog?.nativeElement) return [];
    const selector =
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    return Array.from(this.modalDialog.nativeElement.querySelectorAll<HTMLElement>(selector));
  }

  private focusInitialElement(): void {
    const focusable = this.getFocusableElements();
    if (focusable.length > 0) {
      focusable[0].focus();
    } else {
      this.modalDialog?.nativeElement.focus();
    }
  }

  @HostListener('keydown', ['$event'])
  handleKeydown(event: KeyboardEvent): void {
    if (!this.isOpen() || event.key !== 'Tab') return;

    const focusable = this.getFocusableElements();
    if (focusable.length === 0) {
      event.preventDefault();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = typeof document !== 'undefined' ? document.activeElement : null;

    if (event.shiftKey) {
      if (active === first || !this.modalDialog?.nativeElement.contains(active)) {
        event.preventDefault();
        last.focus();
      }
    } else {
      if (active === last || !this.modalDialog?.nativeElement.contains(active)) {
        event.preventDefault();
        first.focus();
      }
    }
  }

  private initPhotos(exp: ProviderExperience): void {
    if (exp.albumPhotos && exp.albumPhotos.length > 0) {
      // Clona profundamente para edición aislada
      this.photos.set(
        exp.albumPhotos.map((p, idx) => ({
          ...p,
          order: p.order ?? idx + 1,
        })),
      );
    } else if (exp.coverImage) {
      // Semilla inicial si aún no tiene álbum: usa la foto de portada actual
      this.photos.set([
        {
          id: `photo_${Date.now()}_1`,
          url: exp.coverImage,
          title: exp.title,
          caption: exp.tagline || 'Foto principal de la experiencia',
          isCover: true,
          isFeatured: false,
          order: 1,
        },
      ]);
    } else {
      this.photos.set([]);
    }
  }

  onClose(): void {
    if (this.previousActiveElement && typeof this.previousActiveElement.focus === 'function') {
      this.previousActiveElement.focus();
    }
    this.close.emit();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.isOpen()) {
      this.onClose();
    }
  }

  // Marcar como Portada (1 obligatoria)
  setCover(photoId: string): void {
    this.validationError.set(null);
    this.photos.update((list) =>
      list.map((p) => {
        if (p.id === photoId) {
          return { ...p, isCover: true, isFeatured: false };
        }
        return { ...p, isCover: false };
      }),
    );
  }

  // Marcar / desmarcar como Destacada (hasta 2)
  toggleFeatured(photoId: string): void {
    this.validationError.set(null);
    const photo = this.photos().find((p) => p.id === photoId);
    if (!photo) return;

    if (photo.isCover) {
      this.validationError.set(
        'La foto de portada no puede ser también destacada. Elegí otra foto.',
      );
      return;
    }

    if (photo.isFeatured) {
      // Desmarcar
      this.photos.update((list) =>
        list.map((p) => (p.id === photoId ? { ...p, isFeatured: false } : p)),
      );
      return;
    }

    // Marcar como destacada
    if (this.featuredCount() >= 2) {
      this.validationError.set(
        'Ya tenés 2 fotos seleccionadas como destacadas. Desmarcá una antes de elegir esta.',
      );
      return;
    }

    this.photos.update((list) =>
      list.map((p) => (p.id === photoId ? { ...p, isFeatured: true } : p)),
    );
  }

  // Agregar foto por URL
  addPhotoByUrl(): void {
    const url = this.newPhotoUrl().trim();
    if (!url) {
      this.validationError.set('Ingresá una URL válida de imagen.');
      return;
    }

    if (!this.canAddMore()) {
      this.validationError.set('El álbum ya alcanzó el límite máximo de 12 fotos.');
      return;
    }

    const currentTotal = this.photos().length;
    const isFirst = currentTotal === 0;
    const isSecondOrThird = currentTotal === 1 || currentTotal === 2;

    const newPhoto: ExperienceAlbumPhoto = {
      id: `photo_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      url,
      title: this.newPhotoTitle().trim() || undefined,
      caption: this.newPhotoCaption().trim() || undefined,
      isCover: isFirst,
      isFeatured: !isFirst && isSecondOrThird,
      order: currentTotal + 1,
    };

    this.photos.update((list) => [...list, newPhoto]);
    this.newPhotoUrl.set('');
    this.newPhotoTitle.set('');
    this.newPhotoCaption.set('');
    this.validationError.set(null);
  }

  // Subir foto(s) desde el dispositivo local al almacenamiento persistente
  async onFileSelected(event: Event): Promise<void> {
    const inputEl = event.target as HTMLInputElement;
    if (!inputEl.files || inputEl.files.length === 0) return;

    const files = Array.from(inputEl.files);
    const availableSlots = 12 - this.photos().length;
    if (availableSlots <= 0) {
      this.validationError.set('El álbum ya alcanzó el límite máximo de 12 fotos.');
      inputEl.value = '';
      return;
    }

    const filesToLoad = files.slice(0, availableSlots);
    if (files.length > availableSlots) {
      this.validationError.set(
        `Solo se pueden agregar ${availableSlots} fotos más para no superar el límite de 12.`,
      );
    }

    for (const file of filesToLoad) {
      if (!file.type.startsWith('image/')) {
        this.validationError.set(`El archivo "${file.name}" no es una imagen válida.`);
        continue;
      }

      if (file.size > 5 * 1024 * 1024) {
        this.validationError.set(`El archivo "${file.name}" supera el límite máximo de 5 MB.`);
        continue;
      }

      try {
        const uploadRes = await this.storageService.uploadFile(file, 'ALBUM');
        const currentTotal = this.photos().length;
        if (currentTotal >= 12) break;

        const isFirst = currentTotal === 0;
        const isSecondOrThird = currentTotal === 1 || currentTotal === 2;

        const photo: ExperienceAlbumPhoto = {
          id: `photo_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          url: uploadRes.url,
          title: file.name.replace(/\.[^/.]+$/, ''),
          caption: 'Foto cargada por el prestador',
          isCover: isFirst,
          isFeatured: !isFirst && isSecondOrThird,
          order: currentTotal + 1,
        };

        this.photos.update((list) => [...list, photo]);
      } catch (err: unknown) {
        console.warn('[AlbumModal] Error al subir foto:', err);
        this.validationError.set(`No se pudo subir la foto "${file.name}".`);
      }
    }

    inputEl.value = '';
  }

  // Eliminar foto
  removePhoto(photoId: string): void {
    this.validationError.set(null);
    const removedWasCover = this.photos().find((p) => p.id === photoId)?.isCover;

    this.photos.update((list) => {
      const filtered = list.filter((p) => p.id !== photoId);
      // Si la foto eliminada era portada y quedan fotos, asignar automáticamente a la primera
      if (removedWasCover && filtered.length > 0) {
        filtered[0] = { ...filtered[0], isCover: true, isFeatured: false };
      }
      return filtered.map((p, idx) => ({ ...p, order: idx + 1 }));
    });
  }

  // Reordenar foto
  movePhoto(index: number, direction: 'up' | 'down'): void {
    const list = [...this.photos()];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= list.length) return;

    const temp = list[index];
    list[index] = list[targetIdx];
    list[targetIdx] = temp;

    this.photos.set(list.map((p, idx) => ({ ...p, order: idx + 1 })));
  }

  // Actualizar título o epígrafe de una foto
  updateTitle(photoId: string, event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.photos.update((list) => list.map((p) => (p.id === photoId ? { ...p, title: val } : p)));
  }

  updateCaption(photoId: string, event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.photos.update((list) => list.map((p) => (p.id === photoId ? { ...p, caption: val } : p)));
  }

  // Guardar álbum
  saveAlbum(): void {
    const exp = this.experience();
    if (!exp) return;

    const list = this.photos();
    if (list.length === 0) {
      this.validationError.set('Cargá al menos 1 foto para el álbum de la experiencia.');
      return;
    }

    if (list.length > 12) {
      this.validationError.set('El álbum no puede superar el límite de 12 fotos.');
      return;
    }

    if (this.coverCount() !== 1) {
      this.validationError.set('Debés seleccionar exactamente 1 foto como portada.');
      return;
    }

    if (list.length >= 3 && this.featuredCount() !== 2) {
      this.validationError.set(
        `Debés seleccionar exactamente 2 fotos como destacadas (actualmente tenés ${this.featuredCount()}).`,
      );
      return;
    }

    try {
      this.isSaving.set(true);
      const updated = this.store.updateExperienceAlbum(exp.id, list);
      this.saved.emit(updated);
      this.onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al guardar el álbum';
      this.validationError.set(msg);
    } finally {
      this.isSaving.set(false);
    }
  }

  getPublicAlbumUrl(): string {
    const exp = this.experience();
    return exp ? `/experiencias/${exp.slug}/fotos` : '/experiencias';
  }

  openPublicPreview(): void {
    const exp = this.experience();
    if (!exp) return;
    window.open(`/experiencias/${exp.slug}/fotos`, '_blank');
  }
}
