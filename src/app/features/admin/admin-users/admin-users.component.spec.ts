import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AdminUsersComponent } from './admin-users.component';
import { AdminService } from '../../../core/services/admin.service';

describe('AdminUsersComponent (/admin/users)', () => {
  let component: AdminUsersComponent;
  let fixture: ComponentFixture<AdminUsersComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminUsersComponent],
      providers: [provideRouter([]), AdminService]
    }).compileComponents();

    fixture = TestBed.createComponent(AdminUsersComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the admin users component', () => {
    expect(component).toBeTruthy();
  });

  it('should filter users by search query', () => {
    component.searchQuery.set('Ignacio');
    fixture.detectChanges();
    expect(component.filteredUsers().length).toBeGreaterThan(0);
    expect(component.filteredUsers()[0].fullName).toContain('Ignacio');
  });

  it('should filter users by provider tier', () => {
    component.setFilter('prestadores');
    fixture.detectChanges();
    expect(component.filteredUsers().every((u) => u.isProvider)).toBe(true);
  });
});
