import { Component, provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatTooltip } from '@angular/material/tooltip';
import { By } from '@angular/platform-browser';
import type { Spec } from '@json-render/core';
import { JsonRenderer, type StateChange } from 'ngx-json-render';
import { materialRegistry } from './registry';

@Component({
  imports: [JsonRenderer],
  template: `<json-render
    [spec]="spec()"
    [registry]="registry"
    (stateChange)="changes.push($event)"
  />`,
})
class IconButtonHost {
  readonly spec = signal<Spec | null>(null);
  readonly registry = materialRegistry;
  readonly changes: StateChange[][] = [];
}

afterEach(() => TestBed.resetTestingModule());

describe('disabled Material IconButton', () => {
  it('keeps its tooltip and cannot emit press when disabled', async () => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection()],
    });
    const fixture = TestBed.createComponent(IconButtonHost);
    fixture.componentInstance.spec.set({
      root: 'icon-button',
      state: { pressed: false },
      elements: {
        'icon-button': {
          type: 'IconButton',
          props: { icon: 'delete', label: 'Delete row', disabled: true },
          on: {
            press: {
              action: 'setState',
              params: { statePath: '/pressed', value: true },
            },
          },
          children: [],
        },
      },
    } as unknown as Spec);

    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();

    const host = fixture.debugElement.query(By.directive(MatTooltip));
    expect(host).not.toBeNull();
    const button = host.nativeElement as HTMLButtonElement;
    expect(host.injector.get(MatTooltip).message).toBe('Delete row');
    expect(button.getAttribute('aria-label')).toBe('Delete row');
    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(button.hasAttribute('disabled')).toBe(false);

    button.click();
    await fixture.whenStable();
    expect(fixture.componentInstance.changes.flat()).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ path: '/pressed', value: true })]),
    );
  });
});
