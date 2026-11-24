import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FaqComponent } from './faq.component';

describe('FaqComponent', () => {
  let component: FaqComponent;
  let fixture: ComponentFixture<FaqComponent>;

  beforeEach(async () => {
    vi.useFakeTimers();
    await TestBed.configureTestingModule({
      imports: [FaqComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(FaqComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should toggle and auto-close the manifesto after 16s', () => {
    fixture.detectChanges();
    expect(component.showManifesto()).toBe(false);

    component.toggleManifesto();
    fixture.detectChanges();
    expect(component.showManifesto()).toBe(true);

    const manifestoCard = fixture.nativeElement.querySelector('.manifesto-card');
    expect(manifestoCard).toBeTruthy();
    expect(manifestoCard.textContent).toContain('Donde termina el asfalto, empieza la pertenencia');

    // Advance 16 seconds
    vi.advanceTimersByTime(16000);
    fixture.detectChanges();
    expect(component.showManifesto()).toBe(false);
  });

  it('should manually close the manifesto and cancel timer', () => {
    fixture.detectChanges();
    component.toggleManifesto();
    expect(component.showManifesto()).toBe(true);

    component.closeManifesto();
    expect(component.showManifesto()).toBe(false);
    expect((component as any).manifestoTimer).toBeNull();

    vi.advanceTimersByTime(20000);
    expect(component.showManifesto()).toBe(false);
  });

  it('should store 60ms timer in constructionTimer and transition to 7000ms hide timer', () => {
    component.triggerConstructionNotice();
    expect((component as any).constructionTimer).toBeTruthy();
    expect(component.showConstructionNotice()).toBe(false);

    // Fast-forward 60ms
    vi.advanceTimersByTime(60);
    expect(component.showConstructionNotice()).toBe(true);
    expect((component as any).constructionTimer).toBeTruthy();

    // Fast-forward 7000ms
    vi.advanceTimersByTime(7000);
    expect(component.showConstructionNotice()).toBe(false);
    expect((component as any).constructionTimer).toBeNull();
  });

  it('should cancel pending show timer on dismissConstructionNotice', () => {
    component.triggerConstructionNotice();
    expect((component as any).constructionTimer).toBeTruthy();

    // Dismiss before 60ms
    vi.advanceTimersByTime(20);
    component.dismissConstructionNotice();
    expect((component as any).constructionTimer).toBeNull();
    expect(component.showConstructionNotice()).toBe(false);

    // Ensure the show callback never fires
    vi.advanceTimersByTime(100);
    expect(component.showConstructionNotice()).toBe(false);
    expect((component as any).constructionTimer).toBeNull();
  });

  it('should cancel pending show timer when retriggering', () => {
    component.triggerConstructionNotice();
    const firstTimer = (component as any).constructionTimer;
    expect(firstTimer).toBeTruthy();

    vi.advanceTimersByTime(30);
    component.triggerConstructionNotice();
    const secondTimer = (component as any).constructionTimer;
    expect(secondTimer).toBeTruthy();
    expect(secondTimer).not.toBe(firstTimer);

    vi.advanceTimersByTime(60);
    expect(component.showConstructionNotice()).toBe(true);

    vi.advanceTimersByTime(7000);
    expect(component.showConstructionNotice()).toBe(false);
  });

  it('should cancel pending timer on teardown', () => {
    component.triggerConstructionNotice();
    expect((component as any).constructionTimer).toBeTruthy();

    fixture.destroy();
    expect((component as any).constructionTimer).toBeNull();

    vi.advanceTimersByTime(10000);
    expect(component.showConstructionNotice()).toBe(false);
  });

  it('should pause 7-second timer while keyboard focus is inside notice and resume on focusout', () => {
    component.triggerConstructionNotice();
    vi.advanceTimersByTime(60);
    expect(component.showConstructionNotice()).toBe(true);

    // Focus enters notice
    component.onNoticeFocusIn();
    expect((component as any).constructionTimer).toBeNull();

    // Fast-forward 10 seconds while focused
    vi.advanceTimersByTime(10000);
    // Notice is still open because timer was paused
    expect(component.showConstructionNotice()).toBe(true);

    // Focus leaves notice
    component.onNoticeFocusOut();
    expect((component as any).constructionTimer).toBeTruthy();

    // Fast-forward 7000ms after focus left
    vi.advanceTimersByTime(7000);
    expect(component.showConstructionNotice()).toBe(false);
  });

  it('should restore focus to a stable page target when dismissing with Entendido', () => {
    fixture.detectChanges();
    component.triggerConstructionNotice();
    vi.advanceTimersByTime(60);
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
  });
});
