import {
  ApplicationRef,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import type { Spec } from '@json-render/core';
import { JsonRenderer } from 'ngx-json-render';
import { registry } from './catalog';
import { PlainNodeComponent, type PlainTreeNode } from './plain';
import { runScenario } from '../../shared/scenarios.js';
import { makeSpec, toTree } from '../../shared/spec-gen.js';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [JsonRenderer, PlainNodeComponent],
  template: `
    @if (spec(); as s) {
      <json-render [spec]="s" [registry]="registry" [loading]="loading()" />
    }
    @if (tree(); as t) {
      <plain-node [node]="t" />
    }
  `,
})
export class BenchApp {
  readonly registry = registry;
  readonly spec = signal<Spec | null>(null);
  readonly loading = signal(false);
  readonly tree = signal<PlainTreeNode | null>(null);
  private readonly renderer = viewChild(JsonRenderer);
  private readonly appRef = inject(ApplicationRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    const container = this.host.nativeElement;
    const adapter = {
      mount: (spec: Spec, opts?: { loading?: boolean }) => {
        this.loading.set(!!opts?.loading);
        this.spec.set(spec);
        this.appRef.tick();
      },
      setSpec: (spec: Spec) => {
        this.spec.set(spec);
        this.appRef.tick();
      },
      setState: (path: string, value: unknown) => {
        this.renderer()!.stateStore.set(path, value);
        this.appRef.tick();
      },
      unmount: () => {
        this.spec.set(null);
        this.appRef.tick();
      },
      domTextCount: () => container.querySelectorAll('span.text').length,
      readLeaf: (index: number) => {
        const leaves = container.querySelectorAll('span.text');
        return leaves[index < 0 ? leaves.length + index : index]?.textContent;
      },
      mountTree: (tree: PlainTreeNode) => {
        this.tree.set(tree);
        this.appRef.tick();
      },
      setTree: (tree: PlainTreeNode) => {
        this.tree.set(tree);
        this.appRef.tick();
      },
      unmountTree: () => {
        this.tree.set(null);
        this.appRef.tick();
      },
      mountSize: (size: number, opts?: object) =>
        adapter.mount(makeSpec(size, opts) as unknown as Spec),
      mountTreeSize: (size: number) =>
        adapter.mountTree(toTree(makeSpec(size)) as PlainTreeNode),
      run: (name: string, size: number, reps: number) =>
        runScenario(adapter, name, size, reps),
    };
    (window as any).bench = adapter;
    (window as any).benchReady = true;
  }
}
