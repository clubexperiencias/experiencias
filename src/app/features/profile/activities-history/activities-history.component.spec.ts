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
    expect(el.textContent).toContain('Actividades: Salidas & Expediciones');
    expect(el.textContent).toContain('Travesía en Kayak & Sunset en el Dique El Jumeal');
  });

  it('should not contain the Mi Perfil return button in box header', () => {
    const el = fixture.nativeElement as HTMLElement;
    const returnBtn = el.querySelector('.btn-return-profile');
    expect(returnBtn).toBeNull();
  });

  it('should filter by date and order activities chronologically', () => {
    component.dateFrom.set('2026-11-01');
    component.dateTo.set('2026-12-31');
    fixture.detectChanges();

    expect(component.filteredActivities().length).toBe(2);

    component.sortOrder.set('asc');
    fixture.detectChanges();
    expect(component.filteredActivities()[0].dateLabel).toContain('24 de Noviembre');

    component.sortOrder.set('desc');
    fixture.detectChanges();
    expect(component.filteredActivities()[0].dateLabel).toContain('12 de Diciembre');
  });
});
