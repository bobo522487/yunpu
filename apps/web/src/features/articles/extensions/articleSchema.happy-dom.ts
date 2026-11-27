import { Window } from 'happy-dom';

if (typeof globalThis.document === 'undefined') {
  const win = new Window({ url: 'https://localhost/' });
  globalThis.window = win as unknown as Window & typeof globalThis.window;
  globalThis.document = win.document as unknown as Document;
}