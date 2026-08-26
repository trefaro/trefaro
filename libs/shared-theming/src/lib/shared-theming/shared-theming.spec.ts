import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SharedTheming } from './shared-theming';

describe('SharedTheming', () => {
  let component: SharedTheming;
  let fixture: ComponentFixture<SharedTheming>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SharedTheming],
    }).compileComponents();

    fixture = TestBed.createComponent(SharedTheming);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
