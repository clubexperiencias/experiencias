import { Injectable, computed, signal } from '@angular/core';
import { Hospedaje } from '../models/hospedaje.model';

export const INITIAL_HOSPEDAJES: Hospedaje[] = [];

@Injectable({
  providedIn: 'root',
})
export class HospedajesService {
  private readonly _hospedajes = signal<Hospedaje[]>(INITIAL_HOSPEDAJES);

  readonly hospedajes = this._hospedajes.asReadonly();

  readonly featuredHospedajes = computed(() =>
    this._hospedajes().filter((h) => h.isFeatured && !h.isLocked),
  );

  setHospedajes(items: Hospedaje[]): void {
    this._hospedajes.set(items);
  }

  getHospedajeBySlug(slug: string): Hospedaje | undefined {
    if (!slug) return undefined;
    const clean = slug.trim().toLowerCase();
    return (
      this._hospedajes().find((h) => h.slug.toLowerCase() === clean) ||
      INITIAL_HOSPEDAJES.find((h) => h.slug.toLowerCase() === clean)
    );
  }

  getHospedajeById(id: string): Hospedaje | undefined {
    if (!id) return undefined;
    return (
      this._hospedajes().find((h) => h.id === id) ||
      INITIAL_HOSPEDAJES.find((h) => h.id === id)
    );
  }
}
