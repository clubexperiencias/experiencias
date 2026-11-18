import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { FaqComponent } from './faq.component';

describe('FaqComponent', () => {
  let component: FaqComponent;
  let fixture: ComponentFixture<FaqComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FaqComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(FaqComponent);
    component = fixture.componentInstance;
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should store 60ms timer in constructionTimer and transition to 7000ms hide timer', fakeAsync(() => {
    component.triggerConstructionNotice();
    expect((component as any).constructionTimer).toBeTruthy();
    expect(component.showConstructionNotice()).toBe(false);

    // Fast-forward 60ms
    tick(60);
    expect(component.showConstructionNotice()).toBe(true);
    expect((component as any).constructionTimer).toBeTruthy();

    // Fast-forward 7000ms
    tick(7000);
    expect(component.showConstructionNotice()).toBe(false);
    expect((component as any).constructionTimer).toBeNull();
  }));

  it('should cancel pending show timer on dismissConstructionNotice', fakeAsync(() => {
    component.triggerConstructionNotice();
    expect((component as any).constructionTimer).toBeTruthy();

    // Dismiss before 60ms
    tick(20);
    component.dismissConstructionNotice();
    expect((component as any).constructionTimer).toBeNull();
    expect(component.showConstructionNotice()).toBe(false);

    // Ensure the show callback never fires
    tick(100);
    expect(component.showConstructionNotice()).toBe(false);
    expect((component as any).constructionTimer).toBeNull();
  }));

  it('should cancel pending show timer when retriggering', fakeAsync(() => {
    component.triggerConstructionNotice();
    const firstTimer = (component as any).constructionTimer;
    expect(firstTimer).toBeTruthy();

    tick(30);
    component.triggerConstructionNotice();
    const secondTimer = (component as any).constructionTimer;
    expect(secondTimer).toBeTruthy();
    expect(secondTimer).not.toBe(firstTimer);

    tick(60);
    expect(component.showConstructionNotice()).toBe(true);

    tick(7000);
    expect(component.showConstructionNotice()).toBe(false);
  }));

  it('should cancel pending timer on teardown', fakeAsync(() => {
    component.triggerConstructionNotice();
    expect((component as any).constructionTimer).toBeTruthy();

    fixture.destroy();
    expect((component as any).constructionTimer).toBeNull();

    tick(10000);
    expect(component.showConstructionNotice()).toBe(false);
  }));

  it('should pause 7-second timer while keyboard focus is inside notice and resume on focusout', fakeAsync(() => {
    component.triggerConstructionNotice();
    tick(60);
    expect(component.showConstructionNotice()).toBe(true);

    // Focus enters notice
    component.onNoticeFocusIn();
    expect((component as any).constructionTimer).toBeNull();

    // Fast-forward 10 seconds while focused
    tick(10000);
    // Notice is still open because timer was paused
    expect(component.showConstructionNotice()).toBe(true);

    // Focus leaves notice
    component.onNoticeFocusOut();
    expect((component as any).constructionTimer).toBeTruthy();

    // Fast-forward 7000ms after focus left
    tick(7000);
    expect(component.showConstructionNotice()).toBe(false);
  }));

  it('should restore focus to a stable page target when dismissing with Entendido', fakeAsync(() => {
    fixture.detectChanges();
    component.triggerConstructionNotice();
    tick(60);
    fixture.detectChanges();

    const searchInput = fixture.nativeElement.querySelector('.faq-search-input') as HTMLInputElement;
    const toastBtn = fixture.nativeElement.querySelector('.fav-toast-btn') as HTMLButtonElement;
    expect(searchInput).toBeTruthy();
    expect(toastBtn).toBeTruthy();

    // User initially focused the search input
    searchInput.focus();
    expect(document.activeElement).toBe(searchInput);

    // User tabs to toast button
    toastBtn.focus();
    component.onNoticeFocusIn({ relatedTarget: searchInput } as any);
    expect(document.activeElement).toBe(toastBtn);

    // User clicks "Entendido"
    toastBtn.click();
    fixture.detectChanges();

    // Focus should be restored to the search input before removing button
    expect(document.activeElement).toBe(searchInput);
    expect(component.showConstructionNotice()).toBe(false);
  }));
});
