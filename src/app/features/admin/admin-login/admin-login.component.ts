import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AdminService } from '../../../core/services/admin.service';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './admin-login.component.html',
  styleUrls: ['./admin-login.component.css']
})
export class AdminLoginComponent {
  private readonly adminService = inject(AdminService);
  private readonly router = inject(Router);

  password = signal<string>('');
  errorMessage = signal<string | null>(null);
  isLoading = signal<boolean>(false);

  async onSubmit(): Promise<void> {
    this.errorMessage.set(null);
    const pass = this.password().trim();
    if (!pass) {
      this.errorMessage.set('Por favor ingresá la clave de acceso de administrador.');
      return;
    }

    this.isLoading.set(true);
    const success = await this.adminService.login(pass);
    this.isLoading.set(false);

    if (success) {
      this.router.navigate(['/admin']);
    } else {
      this.errorMessage.set('Clave de administrador incorrecta. (Clave por defecto: admin2026)');
    }
  }
}
