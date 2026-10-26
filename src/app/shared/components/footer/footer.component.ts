import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

export interface FooterLandscape {
  name: string;
  region: string;
  coordsText: string;
  officialUrl?: string;
}

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.css'
})
export class FooterComponent {
  @Input() landscape?: FooterLandscape;

  readonly defaultLandscape: FooterLandscape = {
    name: 'Laguna Blanca',
    region: 'Reserva de Biósfera · Catamarca',
    coordsText: '26°32\'S 66°56\'W · 3.200 msnm',
    officialUrl: 'https://www.argentina.gob.ar/jefatura/turismo/best-tourism-villages-argentina/laguna-blanca-catamarca'
  };

  get activeLandscape(): FooterLandscape {
    return this.landscape || this.defaultLandscape;
  }
}
