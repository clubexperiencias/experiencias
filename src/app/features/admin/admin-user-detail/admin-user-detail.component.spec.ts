import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { AdminUserDetailComponent } from './admin-user-detail.component';
import { AdminService } from '../../../core/services/admin.service';

describe('AdminUserDetailComponent (/admin/users/:id)', () => {
  let component: AdminUserDetailComponent;
  let fixture: ComponentFixture<AdminUserDetailComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminUserDetailComponent],
      providers: [
        provideRouter([]),
        AdminService,
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of({
              get: (key: string) => (key === 'id' ? '654' : null)
            })
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AdminUserDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the admin user detail component', () => {
    expect(component).toBeTruthy();
  });

  it('should load user #654 details and provider data', () => {
    const user = component.user();
    expect(user).toBeDefined();
    expect(user?.fullName).toBe('Ignacio Balcarce');
    expect(user?.isProvider).toBe(true);
    expect(user?.providerDetail?.category).toContain('Guía');
  });

  it('should switch between tabs', () => {
    component.setTab('prestador');
    expect(component.selectedTab()).toBe('prestador');
    component.setTab('comprobantes');
    expect(component.selectedTab()).toBe('comprobantes');
  });
});
