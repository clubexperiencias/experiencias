import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AdminService } from '../../../core/services/admin.service';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.css']
})
export class AdminDashboardComponent {
  readonly adminService = inject(AdminService);
  private readonly router = inject(Router);

  readonly metrics = this.adminService.metrics;
  readonly users = this.adminService.users;

  logout(): void {
    this.adminService.logout();
    this.router.navigate(['/admin/login']);
  }
}
