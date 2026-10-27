import { Component, inject, computed, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AdminService } from '../../../core/services/admin.service';
import { AdminUser } from '../../../core/models/admin.model';

@Component({
  selector: 'app-admin-user-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './admin-user-detail.component.html',
  styleUrls: ['./admin-user-detail.component.css']
})
export class AdminUserDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly adminService = inject(AdminService);

  readonly userId = signal<string>('654');
  readonly selectedTab = signal<'perfil' | 'prestador' | 'actividades' | 'comprobantes'>('perfil');

  readonly user = computed<AdminUser | undefined>(() => {
    return this.adminService.getUserById(this.userId());
  });

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.userId.set(id);
      }
    });
  }

  setTab(tab: 'perfil' | 'prestador' | 'actividades' | 'comprobantes'): void {
    this.selectedTab.set(tab);
  }
}
