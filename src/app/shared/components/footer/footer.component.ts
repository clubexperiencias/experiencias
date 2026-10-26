import { Component, Input, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { NewsletterService } from '../../../core/services/newsletter.service';

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
  private readonly router = inject(Router);
  readonly newsletter = inject(NewsletterService);

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

  get userDisplay(): string {
    const member = this.newsletter.currentMember();
    if (!member) {
      return 'Invitado';
    }
    return member.email;
  }

  get membershipLabel(): string {
    const member = this.newsletter.currentMember();
    if (!member) {
      return 'Sin membresía activa';
    }
    const pos = member.position ? ` #${member.position}` : '';
    if (member.membershipTier === 'fundador') {
      return `Socio Fundador${pos}`;
    }
    if (member.membershipTier === 'activo' || member.subscription?.status === 'active') {
      return `Socio Activo${pos}`;
    }
    return `Socio Emergente${pos}`;
  }

  logout(): void {
    this.newsletter.resetCurrentSubscription();
    this.router.navigate(['/ingresar']);
  }
}

