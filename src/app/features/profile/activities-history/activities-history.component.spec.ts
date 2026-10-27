import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ActivitiesHistoryComponent } from './activities-history.component';
import { ActivityHistoryService } from '../../../core/services/activity-history.service';

describe('ActivitiesHistoryComponent (/perfil/actividades)', () => {
  let component: ActivitiesHistoryComponent;
  let fixture: ComponentFixture<ActivitiesHistoryComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ActivitiesHistoryComponent],
      providers: [provideRouter([]), ActivityHistoryService]
    }).compileComponents();

    fixture = TestBed.createComponent(ActivitiesHistoryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the activities history component', () => {
    expect(component).toBeTruthy();
  });

  it('should render page title and activity cards', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Historial de Salidas & Expediciones');
    expect(el.textContent).toContain('Travesía en Kayak & Sunset en Las Pirquitas');
  });

  it('should not contain the Mi Perfil return button in box header', () => {
    const el = fixture.nativeElement as HTMLElement;
    const returnBtn = el.querySelector('.btn-return-profile');
    expect(returnBtn).toBeNull();
  });

  it('should filter activities by status', () => {
    component.setFilter('completada');
    fixture.detectChanges();
    const completed = component.filteredActivities();
    expect(completed.length).toBe(1);
    expect(completed[0].status).toBe('completada');

    component.setFilter('confirmada');
    fixture.detectChanges();
    const confirmed = component.filteredActivities();
    expect(confirmed.length).toBe(2);
    expect(confirmed.every((a) => a.status === 'confirmada')).toBe(true);

    component.setFilter('all');
    fixture.detectChanges();
    expect(component.filteredActivities().length).toBe(3);
  });
});
