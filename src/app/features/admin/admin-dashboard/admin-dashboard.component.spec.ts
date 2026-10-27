import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AdminDashboardComponent } from './admin-dashboard.component';
import { AdminService } from '../../../core/services/admin.service';

describe('AdminDashboardComponent (/admin)', () => {
  let component: AdminDashboardComponent;
  let fixture: ComponentFixture<AdminDashboardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminDashboardComponent],
      providers: [provideRouter([]), AdminService]
    }).compileComponents();

    fixture = TestBed.createComponent(AdminDashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the admin dashboard component', () => {
    expect(component).toBeTruthy();
  });

  it('should display dashboard title and metrics', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Panel de Administración');
    expect(el.textContent).toContain('REGISTRADOS TOTALES');
    expect(el.textContent).toContain('SOCIOS FUNDADORES');
  });
});
