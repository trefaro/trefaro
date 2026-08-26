import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SharedHttp } from './shared-http';

describe('SharedHttp', () => {
  let component: SharedHttp;
  let fixture: ComponentFixture<SharedHttp>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SharedHttp],
    }).compileComponents();

    fixture = TestBed.createComponent(SharedHttp);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
