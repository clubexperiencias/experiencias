import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { NewsletterService } from '../../../core/services/newsletter.service';

@Component({
  selector: 'app-member-tiers',
  standalone: true,
  imports: [CommonModule, RouterLink, MatIconModule],
  templateUrl: './member-tiers.component.html',
  styleUrl: './member-tiers.component.css',
})
export class MemberTiersComponent {
  readonly newsletter = inject(NewsletterService);
}

