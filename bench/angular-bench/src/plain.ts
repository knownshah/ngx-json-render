// The same tree rendered by hand: one OnPush component per node with a signal
// input, children tracked by key. An unchanged `node` reference leaves the
// component and everything below it untouched — the idiomatic Angular shape.
import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export interface PlainTreeNode {
  key: string;
  type: string;
  props: { title?: string; content?: unknown };
  children: PlainTreeNode[];
}

@Component({
  selector: 'plain-node',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (node().type) {
      @case ('Text') {
        <span class="text">{{ node().props.content ?? '' }}</span>
      }
      @case ('Card') {
        <section class="card">
          <h3>{{ node().props.title }}</h3>
          @for (c of node().children; track c.key) {
            <plain-node [node]="c" />
          }
        </section>
      }
      @default {
        <ul class="list">
          @for (c of node().children; track c.key) {
            <plain-node [node]="c" />
          }
        </ul>
      }
    }
  `,
})
export class PlainNodeComponent {
  readonly node = input.required<PlainTreeNode>();
}
