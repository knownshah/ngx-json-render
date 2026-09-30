import {
  provideBrowserGlobalErrorListeners,
  inject,
  provideEnvironmentInitializer,
} from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { MatIconRegistry } from '@angular/material/icon';
import { App } from './app/app';

bootstrapApplication(App, {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // The Material catalog names icons as Material Symbols ligatures.
    provideEnvironmentInitializer(() =>
      inject(MatIconRegistry).setDefaultFontSetClass(
        'material-symbols-outlined',
      ),
    ),
  ],
}).catch((err) => console.error(err));
