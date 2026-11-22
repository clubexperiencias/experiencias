import { Component, HostListener, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { NewsletterService } from '../../core/services/newsletter.service';
import { FooterComponent } from '../../shared/components/footer/footer.component';
import { HeaderComponent } from '../../shared/components/header/header.component';
import {
  BreadcrumbComponent,
  BreadcrumbItem,
} from '../../shared/components/breadcrumb/breadcrumb.component';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatIconModule,
    FooterComponent,
    HeaderComponent,
    BreadcrumbComponent,
  ],
  templateUrl: './not-found.component.html',
  styleUrl: './not-found.component.css',
})
export class NotFoundComponent {
  readonly newsletter = inject(NewsletterService);
  readonly router = inject(Router);

  readonly breadcrumbs: BreadcrumbItem[] = [
    { label: 'Inicio', url: '/' },
    { label: 'Página no encontrada' },
  ];

  readonly mobileMenuOpen = signal(false);

  toggleMobileMenu(event: Event): void {
    event.stopPropagation();
    this.mobileMenuOpen.update((v) => !v);
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.mobileMenuOpen.set(false);
  }

  @HostListener('window:keydown.escape')
  onEscape(): void {
    this.mobileMenuOpen.set(false);
  }

  logout(): void {
    this.newsletter.resetCurrentSubscription();
    this.mobileMenuOpen.set(false);
    this.router.navigate(['/']);
  }
}
