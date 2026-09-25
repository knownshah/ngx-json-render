// The Angular catalog: three components equivalent to the React ones.
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { JrChildren, injectRenderContext } from 'ngx-json-render';

@Component({
  selector: 'app-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [JrChildren],
  template: `<section class="card"><h3>{{ ctx.props().title }}</h3><jr-children /></section>`,
})
export class CardComponent {
  readonly ctx = injectRenderContext<{ title?: string }>();
}

@Component({
  selector: 'app-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [JrChildren],
  template: `<ul class="list"><jr-children /></ul>`,
})
export class ListComponent {}

@Component({
  selector: 'app-text',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="text">{{ ctx.props().content ?? '' }}</span>`,
})
export class TextComponent {
  readonly ctx = injectRenderContext<{ content?: unknown }>();
}

export const registry = {
  Card: CardComponent,
  List: ListComponent,
  Text: TextComponent,
};
