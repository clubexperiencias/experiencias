import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AdminService } from '../../../core/services/admin.service';
import { AdminUser } from '../../../core/models/admin.model';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './admin-users.component.html',
  styleUrls: ['./admin-users.component.css']
})
export class AdminUsersComponent {
  private readonly adminService = inject(AdminService);

  readonly users = this.adminService.users;
  readonly searchQuery = signal<string>('');
  readonly selectedFilter = signal<'todos' | 'fundador' | 'activo' | 'prestadores'>('todos');

  readonly filteredUsers = computed<AdminUser[]>(() => {
    const list = this.users();
    const query = this.searchQuery().toLowerCase().trim();
    const filter = this.selectedFilter();

    return list.filter((user) => {
      // Filter criteria
      if (filter === 'fundador' && user.membershipTier !== 'fundador') return false;
      if (filter === 'activo' && user.membershipTier !== 'activo') return false;
      if (filter === 'prestadores' && !user.isProvider) return false;

      // Search query
      if (!query) return true;
      return (
        user.fullName.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query) ||
        user.memberNumber.toLowerCase().includes(query) ||
        user.id.includes(query)
      );
    });
  });

  setFilter(filter: 'todos' | 'fundador' | 'activo' | 'prestadores'): void {
    this.selectedFilter.set(filter);
  }
}
