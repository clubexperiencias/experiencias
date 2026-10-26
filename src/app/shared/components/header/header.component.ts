import { Component, EventEmitter, Output, inject, model } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { NewsletterService } from '../../../core/services/newsletter.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, MatIconModule],
  templateUrl: './header.component.html',
  styleUrl: './header.component.css'
})
export class HeaderComponent {
  readonly newsletter = inject(NewsletterService);
  private readonly router = inject(Router);

  readonly mobileMenuOpen = model<boolean>(false);
  @Output() loginClick = new EventEmitter<void>();

  toggleMobileMenu(event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.mobileMenuOpen.update(v => !v);
  }

  closeMobileMenu(): void {
    this.mobileMenuOpen.set(false);
  }

  onLoginClick(): void {
    this.closeMobileMenu();
    this.router.navigate(['/ingresar']);
  }

  logout(): void {
    this.closeMobileMenu();
    this.newsletter.resetCurrentSubscription();
  }
}
