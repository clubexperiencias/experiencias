import { Component, HostListener, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { NewsletterService } from '../../core/services/newsletter.service';
import { FooterComponent } from '../../shared/components/footer/footer.component';
import { HeaderComponent } from '../../shared/components/header/header.component';
import {
  BreadcrumbComponent,
  BreadcrumbItem,
} from '../../shared/components/breadcrumb/breadcrumb.component';

@Component({
  selector: 'app-founders',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    FormsModule,
    MatIconModule,
    FooterComponent,
    HeaderComponent,
    BreadcrumbComponent,
  ],
  templateUrl: './founders.component.html',
  styleUrl: './founders.component.css',
})
export class FoundersComponent implements OnInit {
  readonly newsletter = inject(NewsletterService);
  readonly router = inject(Router);

  readonly bg = signal('/assets/images/laguna_blanca.jpg');

  readonly breadcrumbs: BreadcrumbItem[] = [
    { label: 'Inicio', url: '/' },
    { label: 'Niveles de Socio', url: '/socios' },
    { label: 'Socios Fundadores' },
  ];

  // Menús de navegación
  readonly mobileMenuOpen = signal(false);

  // Formulario Carta de Postulación
  readonly founderName = signal('');
  readonly founderEmail = signal('');
  readonly founderPhone = signal('');
  readonly founderLetter = signal('');
  readonly founderAgreedToPrice = signal(false);
  readonly founderSuccess = signal(false);

  ngOnInit(): void {
    const current = this.newsletter.currentMember();
    if (current) {
      this.founderEmail.set(current.email);
      if (current.fullName) {
        this.founderName.set(current.fullName);
      }
    }
  }

  toggleMobileMenu(event: Event): void {
    event.stopPropagation();
    this.mobileMenuOpen.update((v) => !v);
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.mobileMenuOpen.set(false);
  }

  submitFounder(): void {
    if (
      !this.founderName().trim() ||
      !this.founderEmail().trim() ||
      !this.founderLetter().trim() ||
      !this.founderAgreedToPrice()
    ) {
      return;
    }
    this.founderSuccess.set(true);
  }

  logout(): void {
    this.newsletter.resetCurrentSubscription();
    this.mobileMenuOpen.set(false);
    this.router.navigate(['/']);
  }
}
