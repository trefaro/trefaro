import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SharedConfig } from './shared-config';

describe('SharedConfig', () => {
  let component: SharedConfig;
  let fixture: ComponentFixture<SharedConfig>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SharedConfig],
    }).compileComponents();

    fixture = TestBed.createComponent(SharedConfig);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
