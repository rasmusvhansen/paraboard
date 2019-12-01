// Import stylesheets
import { BehaviorSubject, fromEvent, interval, merge } from 'rxjs';
import { throttle, tap, map, distinctUntilChanged, switchMap, filter } from 'rxjs/operators';

interface Settings {
  alphabet: string;
  left: string;
  right: string;
  pick: string;
  space: string;
  backspace: string;
  clear: string;
  newLine: string;
}

interface Model {
  cursorPosition: number;
  text: string;
  settings: Settings;
}

class Store {
  state: Model;
  state$: BehaviorSubject<Model>;
  init(state: Model) {
    this.state = state;
    this.state$ = new BehaviorSubject(state);
  }

  dispatch(msg: Message) {
    const next = reducer(this.state, msg);
    const effects = next.effects || [];
    this.state = next.state;
    this.state$.next(this.state);
    effects.forEach(ef => this.dispatch(ef));
  }
}

const store = new Store();

const SETTINGS = 'settings';
const KEY_DELAY = 500; //Bestemmer hastigheden hvormed cursor flytter sig når tasten holdes nede

const alphabetDiv: HTMLElement = document.getElementById('alphabet');
const textDiv: HTMLElement = document.getElementById('text');
const marker: HTMLElement = document.getElementById('marker');
const main: HTMLElement = document.querySelector('.main');
const close = document.querySelector('#settings .close');
const settingsDiv = document.querySelector('#settings') as HTMLDivElement;
const openSettings = document.querySelector('.open-settings');

close.addEventListener('click', () => {
  settingsDiv.style.display = 'none';
  main.focus();
});

openSettings.addEventListener('click', () => (settingsDiv.style.display = 'flex'));

main.focus();

const keyUp$ = fromEvent<KeyboardEvent>(main, 'keyup');
const keyEvents$ = fromEvent<KeyboardEvent>(main, 'keydown').pipe(throttle(ev => merge(interval(KEY_DELAY), keyUp$)));

/************ SETINGS DIALOG  *****************/
const changeKey = (key: Keys) => (ev: KeyboardEvent) => {
  (ev.target as HTMLButtonElement).blur();
  store.dispatch(new ChangeKey({ key, value: ev.key }));
};

const alphabetInput: HTMLInputElement = document.getElementById('alphabet-input') as HTMLInputElement;
const left = document.getElementById('key-left') as HTMLButtonElement;
const right = document.getElementById('key-right') as HTMLButtonElement;
const pick = document.getElementById('key-pick') as HTMLButtonElement;
const space = document.getElementById('key-space') as HTMLButtonElement;
const backspace = document.getElementById('key-backspace') as HTMLButtonElement;
const newLine = document.getElementById('key-newline') as HTMLButtonElement;
const clear = document.getElementById('key-clear') as HTMLButtonElement;

left.addEventListener('keydown', changeKey('left'));
right.addEventListener('keydown', changeKey('right'));
pick.addEventListener('keydown', changeKey('pick'));
space.addEventListener('keydown', changeKey('space'));
backspace.addEventListener('keydown', changeKey('backspace'));
newLine.addEventListener('keydown', changeKey('newLine'));
clear.addEventListener('keydown', changeKey('clear'));
alphabetInput.addEventListener('input', ev =>
  store.dispatch(new ChangeKey({ key: 'alphabet', value: alphabetInput.value }))
);

/************ SETINGS DIALOG END *****************/

const defaultSettings = {
  alphabet: 'ABCDEFGHIJKLMNOPQRSTUVXYZÆØÅ',
  left: '4',
  right: '6',
  pick: '5',
  newLine: '2',
  space: '3',
  backspace: '1',
  clear: '0'
};
const settings: Settings =
  (localStorage.getItem(SETTINGS) && JSON.parse(localStorage.getItem(SETTINGS))) || defaultSettings;

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

class Move {
  readonly type = 'move';
  constructor(public payload: 1 | -1) {}
}

class Pick {
  readonly type = 'pick';
}

class Space {
  readonly type = 'space';
}

class Backspace {
  readonly type = 'backspace';
}

class Clear {
  readonly type = 'clear';
}

class NewLine {
  readonly type = 'newline';
}

type Keys = keyof Settings;

class ChangeKey {
  readonly type = 'changekey';
  constructor(public payload: { key: Keys; value: string }) {}
}

type Message = Move | Pick | Space | Backspace | NewLine | Clear | ChangeKey;

const wrap = (x: number, length: number) => (x < 0 ? length - 1 : x >= length ? 0 : x);

function reducer(state: Model, msg: Message): { state: Model; effects?: Message[] } {
  switch (msg.type) {
    case 'move':
      return {
        state: { ...state, cursorPosition: wrap(state.cursorPosition + msg.payload, state.settings.alphabet.length) }
      };
    // return { state: { ...state, cursorPosition: clamp(state.cursorPosition + msg.payload, 0, alphabet.length - 1) } };
    case 'pick':
      const newText = state.text + state.settings.alphabet[state.cursorPosition];
      return { state: { ...state, text: newText } };
    case 'newline':
      const textWithNewLine = state.text + '\n';
      return { state: { ...state, text: textWithNewLine } };
    case 'space':
      const text = state.text + ' ';
      return { state: { ...state, text } };
    case 'backspace':
      const revisedText = state.text.slice(0, -1);
      return { state: { ...state, text: revisedText } };
    case 'clear':
      return { state: { ...state, text: '' } };
    case 'changekey':
      return { state: { ...state, settings: { ...state.settings, [msg.payload.key]: msg.payload.value } } };
  }
}

store.init({ cursorPosition: 16, text: '', settings });

store.state$.subscribe(state => {
  setTimeout(() => {
    const alphabetWidth = alphabetDiv.clientWidth;
    const alphabetLength = state.settings.alphabet.length;
    const charWidth = alphabetWidth / alphabetLength;
    const x = state.cursorPosition * charWidth;
    marker.style.transform = `translateX(${x}px)`;
    console.log({ alphabetWidth, charWidth, alphabetLength, x });
    textDiv.textContent = state.text;
  }, 0);
});

const settings$ = store.state$.pipe(
  map(s => s.settings),
  distinctUntilChanged()
);

const alphabet$ = settings$.pipe(map(s => s.alphabet));

alphabet$.subscribe(a => {
  alphabetDiv.textContent = a;
});

settings$
  .pipe(
    switchMap(s =>
      keyEvents$.pipe(
        map(event => {
          event.preventDefault();
          switch (event.key) {
            case s.pick:
              return new Pick();
            case s.space:
              return new Space();
            case s.left:
              return new Move(-1);
            case s.right:
              return new Move(1);
            case s.backspace:
              return new Backspace();
            case s.clear:
              return new Clear();
            case s.newLine:
              return new NewLine();
            default:
              return; // Quit when this doesn't handle the key event.
          }
        })
      )
    ),
    filter(e => !!e)
  )
  .subscribe(m => store.dispatch(m));

settings$.subscribe(s => {
  left.textContent = s.left;
  right.textContent = s.right;
  pick.textContent = s.pick;
  space.textContent = s.space;
  backspace.textContent = s.backspace;
  newLine.textContent = s.newLine;
  clear.textContent = s.clear;

  Array.from(document.querySelectorAll('.legend')).forEach(
    (e: HTMLSpanElement) => (e.textContent = s[e.dataset['key']])
  );
  localStorage.setItem(SETTINGS, JSON.stringify(s));
});

alphabet$.subscribe(a => (alphabetInput.value = a));
