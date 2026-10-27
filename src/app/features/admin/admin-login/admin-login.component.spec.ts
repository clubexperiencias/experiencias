import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AdminLoginComponent } from './admin-login.component';
import { AdminService } from '../../../core/services/admin.service';

describe('AdminLoginComponent (/admin/login)', () => {
  let component: AdminLoginComponent;
  let fixture: ComponentFixture<AdminLoginComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminLoginComponent],
      providers: [provideRouter([]), AdminService]
    }).compileComponents();

    fixture = TestBed.createComponent(AdminLoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the admin login component', () => {
    expect(component).toBeTruthy();
  });

  it('should display error if password is empty', async () => {
    component.password.set('');
    await component.onSubmit();
    expect(component.errorMessage()).toContain('ingresá la clave');
  });

  it('should reject wrong password', async () => {
    component.password.set('wrong-pass');
    await component.onSubmit();
    expect(component.errorMessage()).toContain('incorrecta');
  });
});
