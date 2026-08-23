// A deliberately small Ruby evaluator, so that the first thing every developer
// types — `2 + 2` — gets an answer instead of a NameError.
//
// No eval(), no Function(): input is tokenised and walked by hand. That keeps it
// safe by construction and, more usefully, lets integer division behave the way
// Ruby's does rather than the way JavaScript's does.
//
// Explicit non-goals: variables, blocks (beyond `&:sym`), string escapes,
// multi-line input. Anything it cannot parse is handed back to the console so
// the existing NameError/NoMethodError output still has the last word.

import { NAME, POSITION, ABOUT, EMAIL, STACK, LINKS, METHODS, TIMEZONE, formatTime } from './profile.js';

const RUBY_VERSION = '3.4.1';
const MAX_STRING = 10000;
const RAILS_VERSION = '7.2.2';

/* ------------------------------------------------------------------ values -- */

const int = (value) => ({ type: 'Integer', value });
const float = (value) => ({ type: 'Float', value });
const str = (value) => ({ type: 'String', value });
const sym = (value) => ({ type: 'Symbol', value });
const bool = (value) => ({ type: value ? 'TrueClass' : 'FalseClass', value });
const nil = { type: 'NilClass', value: null };
const arr = (value) => ({ type: 'Array', value });
const hash = (value) => ({ type: 'Hash', value });
const regexp = (value) => ({ type: 'Regexp', value });
const time = (value) => ({ type: 'Time', value });
const klass = (value) => ({ type: 'Class', value });
const mod = (value) => ({ type: 'Module', value });
const profile = { type: 'Profile' };

const isNum = (v) => v.type === 'Integer' || v.type === 'Float';

// Method tables are plain objects, so a bare `obj[name]` would happily answer
// `constructor`, `valueOf` and friends off Object.prototype — returning
// JavaScript internals where a NoMethodError belongs.
const has = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

class RubyError extends Error {
  constructor(name, message, options = {}) {
    super(message);
    this.rubyName = name;
    this.hint = options.hint;
    // A name the session never heard of is the console's business, not ours.
    this.fallback = Boolean(options.fallback);
  }
}

const syntaxError = (message = 'unexpected end-of-input') => new RubyError('SyntaxError', message);

function noMethod(receiver, name) {
  if (receiver.type === 'Profile') {
    return new RubyError('NoMethodError', `undefined method \`${name}' for an instance of Profile`, {
      hint: 'did you mean?  andy.methods'
    });
  }
  const target = receiver.type === 'NilClass' ? 'nil'
    : receiver.type === 'Class' ? receiver.value
      : `an instance of ${receiver.type}`;
  return new RubyError('NoMethodError', `undefined method \`${name}' for ${target}`);
}

export function inspect(value) {
  switch (value.type) {
    case 'String': return `"${value.value}"`;
    case 'Symbol': return `:${value.value}`;
    case 'Integer': return String(value.value);
    case 'Float': return Number.isInteger(value.value) ? `${value.value}.0` : String(value.value);
    case 'TrueClass': case 'FalseClass': return String(value.value);
    case 'NilClass': return 'nil';
    case 'Array': return `[${value.value.map(inspect).join(', ')}]`;
    case 'Hash': return `{${value.value.map(([k, v]) => `${k}: ${inspect(v)}`).join(', ')}}`;
    case 'Regexp': return `/${value.value.source}/`;
    case 'Time': return value.value;
    case 'Class': case 'Module': return value.value;
    case 'Enumerator': return value.value;
    case 'Profile': return `#<Profile id: 1, name: "${NAME}", employed: true>`;
    default: return String(value.value);
  }
}

// `puts` stringifies; only `inspect` adds quotes.
function toS(value) {
  if (value.type === 'String') return value.value;
  if (value.type === 'Symbol') return value.value;
  if (value.type === 'NilClass') return '';
  if (value.type === 'Array') return value.value.map(toS).join('\n');
  return inspect(value);
}

/* --------------------------------------------------------------- tokeniser -- */

const IDENT = /^[A-Za-z_][A-Za-z0-9_]*[?!]?/;

function tokenize(src) {
  const tokens = [];
  let i = 0;

  // `/` opens a regexp only where a value could start; anywhere else it divides.
  const regexAllowed = () => {
    const prev = tokens[tokens.length - 1];
    return !prev || (prev.t === 'op' && prev.v !== ')' && prev.v !== ']');
  };

  while (i < src.length) {
    const ch = src[i];
    const rest = src.slice(i);

    if (/\s/.test(ch)) { i += 1; continue; }

    if (/[0-9]/.test(ch)) {
      const [match] = /^\d+(\.\d+)?/.exec(rest);
      tokens.push({ t: 'num', v: match });
      i += match.length;
      continue;
    }

    if (ch === '"' || ch === "'") {
      const end = src.indexOf(ch, i + 1);
      if (end < 0) throw syntaxError('unterminated string meets end of file');
      tokens.push({ t: 'str', v: src.slice(i + 1, end) });
      i = end + 1;
      continue;
    }

    if (ch === ':' && IDENT.test(rest.slice(1))) {
      const [match] = IDENT.exec(rest.slice(1));
      tokens.push({ t: 'sym', v: match });
      i += match.length + 1;
      continue;
    }

    if (ch === '/' && regexAllowed()) {
      const end = src.indexOf('/', i + 1);
      if (end > 0) {
        tokens.push({ t: 'regex', v: src.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    }

    if (IDENT.test(rest)) {
      const [match] = IDENT.exec(rest);
      tokens.push({ t: 'ident', v: match });
      i += match.length;
      continue;
    }

    if (rest.startsWith('**')) { tokens.push({ t: 'op', v: '**' }); i += 2; continue; }
    if ('+-*/%().,&[]'.includes(ch)) { tokens.push({ t: 'op', v: ch }); i += 1; continue; }

    throw syntaxError(`unexpected '${ch}'`);
  }

  return tokens;
}

/* ------------------------------------------------------------------ parser -- */
// Evaluates as it parses. There is no AST because nothing here needs one: no
// blocks to defer, no short-circuit operators, no assignment.

class Parser {
  constructor(tokens) {
    this.tokens = tokens;
    this.i = 0;
  }

  peek() { return this.tokens[this.i]; }
  next() { return this.tokens[this.i++]; }

  isOp(v) {
    const token = this.peek();
    return Boolean(token) && token.t === 'op' && token.v === v;
  }

  eat(v) {
    if (!this.isOp(v)) return false;
    this.i += 1;
    return true;
  }

  expect(v) {
    if (!this.eat(v)) throw syntaxError(`expected '${v}'`);
  }

  expression() {
    let left = this.term();
    while (this.isOp('+') || this.isOp('-')) {
      const op = this.next().v;
      left = binary(op, left, this.term());
    }
    return left;
  }

  term() {
    let left = this.unary();
    while (this.isOp('*') || this.isOp('/') || this.isOp('%')) {
      const op = this.next().v;
      left = binary(op, left, this.unary());
    }
    return left;
  }

  unary() {
    if (this.eat('-')) {
      const value = this.unary();
      if (!isNum(value)) throw noMethod(value, '-@');
      return value.type === 'Integer' ? int(-value.value) : float(-value.value);
    }
    return this.power();
  }

  power() {
    const base = this.postfix();
    if (this.eat('**')) return binary('**', base, this.unary());
    return base;
  }

  postfix() {
    let value = this.primary();
    while (this.isOp('.')) {
      this.next();
      const name = this.next();
      if (!name || name.t !== 'ident') throw syntaxError('expected a method name');
      value = callMethod(value, name.v, this.args());
    }
    return value;
  }

  args() {
    if (!this.eat('(')) return [];
    const args = [];
    if (this.eat(')')) return args;
    do {
      if (this.eat('&')) {
        const token = this.next();
        if (!token || token.t !== 'sym') throw syntaxError('expected a symbol after &');
        args.push({ block: token.v });
      } else {
        args.push(this.expression());
      }
    } while (this.eat(','));
    this.expect(')');
    return args;
  }

  primary() {
    const token = this.next();
    if (!token) throw syntaxError();

    if (token.t === 'num') {
      return token.v.includes('.') ? float(parseFloat(token.v)) : int(parseInt(token.v, 10));
    }
    if (token.t === 'str') return str(token.v);
    if (token.t === 'sym') return sym(token.v);
    if (token.t === 'regex') return regexp(new RegExp(token.v));

    if (token.t === 'op' && token.v === '(') {
      const value = this.expression();
      this.expect(')');
      return value;
    }

    if (token.t === 'op' && token.v === '[') {
      const items = [];
      if (this.eat(']')) return arr(items);
      do { items.push(this.expression()); } while (this.eat(','));
      this.expect(']');
      return arr(items);
    }

    if (token.t === 'ident') return constant(token.v);

    throw syntaxError(`unexpected '${token.v}'`);
  }
}

/* --------------------------------------------------------------- constants -- */

function constant(name) {
  switch (name) {
    case 'andy': case 'profile': case 'self': return profile;
    case 'nil': return nil;
    case 'true': return bool(true);
    case 'false': return bool(false);
    case 'Profile': return klass('Profile');
    case 'Rails': return mod('Rails');
    case 'Time': return klass('Time');
    case 'RUBY_VERSION': return str(RUBY_VERSION);
    case 'RUBY_PLATFORM': return str('x86_64-linux');
    case 'ARGV': return arr([]);
    default:
      // The console's own NameError is friendlier than anything produced here.
      throw new RubyError('NameError', `undefined local variable or method \`${name}' for main:Object`, { fallback: true });
  }
}

/* --------------------------------------------------------------- operators -- */

function binary(op, a, b) {
  if (isNum(a) && isNum(b)) {
    const bothInt = a.type === 'Integer' && b.type === 'Integer';
    const x = a.value;
    const y = b.value;

    if ((op === '/' || op === '%') && bothInt && y === 0) {
      throw new RubyError('ZeroDivisionError', 'divided by 0');
    }

    switch (op) {
      case '+': return bothInt ? int(x + y) : float(x + y);
      case '-': return bothInt ? int(x - y) : float(x - y);
      case '*': return bothInt ? int(x * y) : float(x * y);
      // Ruby floors integer division and takes the sign of the divisor for %.
      case '/': return bothInt ? int(Math.floor(x / y)) : float(x / y);
      case '%': return bothInt ? int(((x % y) + y) % y) : float(((x % y) + y) % y);
      case '**': {
        const result = Math.pow(x, y);
        return bothInt && y >= 0 ? int(result) : float(result);
      }
      default: throw noMethod(a, op);
    }
  }

  if (a.type === 'String' && op === '+') {
    if (b.type !== 'String') {
      throw new RubyError('TypeError', `no implicit conversion of ${b.type} into String`);
    }
    return str(a.value + b.value);
  }

  if (a.type === 'String' && op === '*' && b.type === 'Integer') {
    // Real Ruby would try and eventually die of it. A browser tab that freezes
    // is a worse outcome than a slightly early error.
    if (a.value.length * b.value > MAX_STRING) {
      throw new RubyError('RangeError', `result too long (max ${MAX_STRING} characters here)`);
    }
    return str(a.value.repeat(Math.max(0, b.value)));
  }

  if (a.type === 'Array' && op === '+' && b.type === 'Array') {
    return arr(a.value.concat(b.value));
  }

  throw noMethod(a, op);
}

/* ----------------------------------------------------------------- methods -- */

const profileFields = () => ({
  name: () => str(NAME),
  position: () => str(POSITION),
  about: () => str(ABOUT),
  email: () => str(EMAIL),
  stack: () => arr(STACK.map(str)),
  socials: () => hash([['github', str(LINKS.github.replace('https://', ''))],
    ['linkedin', str(LINKS.linkedin.replace('https://www.', ''))]]),
  methods: () => arr(METHODS.map(sym)),
  local_time: () => time(`${formatTime(TIMEZONE).text}`),
  id: () => int(1),
  'employed?': () => bool(true),
  'persisted?': () => bool(true),
  'frozen?': () => bool(false)
});

function callMethod(receiver, name, args) {
  const one = args[0];

  // --- universal ----------------------------------------------------------
  if (name === 'class') {
    if (receiver.type === 'Class' || receiver.type === 'Module') return klass('Class');
    return klass(receiver.type);
  }
  if (name === 'inspect') return str(inspect(receiver));
  if (name === 'frozen?' && receiver.type !== 'Profile') return bool(receiver.type === 'Symbol' || receiver.type === 'Integer');
  if (name === 'nil?') return bool(receiver.type === 'NilClass');
  if (name === 'to_s' && receiver.type !== 'Integer' && receiver.type !== 'Float') return str(toS(receiver));

  switch (receiver.type) {
    /* ------------------------------------------------------------ Profile -- */
    case 'Profile': {
      const fields = profileFields();
      if (has(fields, name)) return fields[name]();
      if (name === 'respond_to?') {
        const asked = one && (one.type === 'Symbol' || one.type === 'String') ? one.value : '';
        return bool(METHODS.includes(asked) || Object.keys(fields).includes(asked));
      }
      throw noMethod(receiver, name);
    }

    /* -------------------------------------------------------------- Class -- */
    case 'Class': {
      if (receiver.value === 'Profile') {
        switch (name) {
          case 'first': case 'last': case 'new': return profile;
          case 'all': return arr([profile]);
          case 'count': case 'size': return int(1);
          case 'name': case 'table_name': return str(receiver.value === 'Profile' ? 'Profile' : receiver.value);
          case 'ancestors': return arr([klass('Profile'), klass('ApplicationRecord'), klass('ActiveRecord::Base'), klass('Object'), klass('Kernel'), klass('BasicObject')]);
          case 'superclass': return klass('ApplicationRecord');
          case 'column_names': return arr(['id', 'name', 'position', 'about', 'email', 'employed'].map(str));
          default: throw noMethod(receiver, name);
        }
      }
      if (receiver.value === 'Time') {
        if (name === 'now') return time(formatTime(null).text);
        throw noMethod(receiver, name);
      }
      if (name === 'ancestors') return arr([receiver, klass('Object')]);
      if (name === 'name') return str(receiver.value);
      throw noMethod(receiver, name);
    }

    /* ------------------------------------------------------------- Module -- */
    case 'Module': {
      if (receiver.value === 'Rails') {
        if (name === 'version') return str(RAILS_VERSION);
        if (name === 'env') return str('production');
        if (name === 'root') return str('/var/www/alekseenko.github.io');
      }
      throw noMethod(receiver, name);
    }

    /* ------------------------------------------------------------- String -- */
    case 'String': {
      const s = receiver.value;
      switch (name) {
        case 'upcase': return str(s.toUpperCase());
        case 'downcase': return str(s.toLowerCase());
        case 'capitalize': return str(s.charAt(0).toUpperCase() + s.slice(1).toLowerCase());
        case 'swapcase': return str(s.replace(/[a-zA-Z]/g, (c) => (c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase())));
        case 'reverse': return str(s.split('').reverse().join(''));
        case 'strip': return str(s.trim());
        case 'length': case 'size': return int(s.length);
        case 'chars': return arr(s.split('').map(str));
        case 'bytes': return arr(s.split('').map((c) => int(c.charCodeAt(0))));
        case 'split': return arr(s.split(one && one.type === 'String' ? one.value : ' ').map(str));
        case 'to_sym': return sym(s);
        case 'to_i': return int(parseInt(s, 10) || 0);
        case 'empty?': return bool(s.length === 0);
        case 'include?': return bool(Boolean(one) && s.includes(toS(one)));
        case 'start_with?': return bool(Boolean(one) && s.startsWith(toS(one)));
        case 'end_with?': return bool(Boolean(one) && s.endsWith(toS(one)));
        case 'first': return str(s.charAt(0));
        case 'freeze': return receiver;
        default: throw noMethod(receiver, name);
      }
    }

    /* -------------------------------------------------------------- Array -- */
    case 'Array': {
      const items = receiver.value;
      switch (name) {
        case 'length': case 'size': case 'count': return int(items.length);
        case 'first': return items.length ? items[0] : nil;
        case 'last': return items.length ? items[items.length - 1] : nil;
        case 'sample': return items.length ? items[Math.floor(Math.random() * items.length)] : nil;
        case 'shuffle': return arr(items.slice().sort(() => Math.random() - 0.5));
        case 'sort': return arr(items.slice().sort((a, b) => (toS(a) > toS(b) ? 1 : -1)));
        case 'reverse': return arr(items.slice().reverse());
        case 'uniq': return arr(items.filter((v, i) => items.findIndex((o) => inspect(o) === inspect(v)) === i));
        case 'empty?': return bool(items.length === 0);
        case 'to_a': return receiver;
        case 'join': return str(items.map(toS).join(one && one.type === 'String' ? one.value : ''));
        case 'include?': return bool(Boolean(one) && items.some((v) => inspect(v) === inspect(one)));
        case 'take': return arr(items.slice(0, one ? one.value : 0));
        case 'drop': return arr(items.slice(one ? one.value : 0));
        case 'sum': return int(items.reduce((total, v) => total + (isNum(v) ? v.value : 0), 0));
        case 'min': return items.length ? items.slice().sort((a, b) => (toS(a) > toS(b) ? 1 : -1))[0] : nil;
        case 'max': return items.length ? items.slice().sort((a, b) => (toS(a) < toS(b) ? 1 : -1))[0] : nil;
        case 'grep': {
          if (!one || one.type !== 'Regexp') throw new RubyError('TypeError', 'grep wants a Regexp here');
          return arr(items.filter((v) => one.value.test(toS(v))));
        }
        case 'map': case 'collect': {
          if (!one || !one.block) throw new RubyError('LocalJumpError', 'no block given (yield)');
          return arr(items.map((v) => callMethod(v, one.block, [])));
        }
        case 'select': case 'filter': {
          if (!one || !one.block) throw new RubyError('LocalJumpError', 'no block given (yield)');
          return arr(items.filter((v) => callMethod(v, one.block, []).value));
        }
        case 'each': return receiver;
        default: throw noMethod(receiver, name);
      }
    }

    /* --------------------------------------------------------------- Hash -- */
    case 'Hash': {
      const pairs = receiver.value;
      switch (name) {
        case 'keys': return arr(pairs.map(([k]) => sym(k)));
        case 'values': return arr(pairs.map(([, v]) => v));
        case 'size': case 'length': case 'count': return int(pairs.length);
        case 'to_a': return arr(pairs.map(([k, v]) => arr([sym(k), v])));
        default: throw noMethod(receiver, name);
      }
    }

    /* ------------------------------------------------------------ numbers -- */
    case 'Integer': case 'Float': {
      const n = receiver.value;
      switch (name) {
        case 'even?': return bool(n % 2 === 0);
        case 'odd?': return bool(Math.abs(n % 2) === 1);
        case 'zero?': return bool(n === 0);
        case 'positive?': return bool(n > 0);
        case 'negative?': return bool(n < 0);
        case 'abs': return receiver.type === 'Integer' ? int(Math.abs(n)) : float(Math.abs(n));
        case 'succ': case 'next': return int(n + 1);
        case 'pred': return int(n - 1);
        case 'round': return int(Math.round(n));
        case 'floor': return int(Math.floor(n));
        case 'ceil': return int(Math.ceil(n));
        case 'to_i': return int(Math.trunc(n));
        case 'to_f': return float(n);
        case 'to_s': return str(String(receiver.type === 'Float' && Number.isInteger(n) ? `${n}.0` : n));
        case 'times': return { type: 'Enumerator', value: `#<Enumerator: ${n}.times>` };
        default: throw noMethod(receiver, name);
      }
    }

    /* ------------------------------------------------------------- Symbol -- */
    case 'Symbol': {
      switch (name) {
        case 'length': case 'size': return int(receiver.value.length);
        case 'upcase': return sym(receiver.value.toUpperCase());
        case 'to_proc': return { type: 'Proc', value: `#<Proc:0x000f (&:${receiver.value})>` };
        default: throw noMethod(receiver, name);
      }
    }

    default:
      throw noMethod(receiver, name);
  }
}

/* --------------------------------------------------------------- evaluate -- */

function evaluate(source) {
  const parser = new Parser(tokenize(source));
  const value = parser.expression();
  if (parser.peek()) throw syntaxError(`unexpected '${parser.peek().v}'`);
  return value;
}

function errorLines(error) {
  const out = [{ text: `${error.rubyName}: ${error.message}`, kind: 'accent' }];
  if (error.hint) out.push({ text: `  ${error.hint}`, kind: 'dim' });
  out.push({ text: '' });
  return out;
}

// Everything that is not letters or a known operator: worth a real SyntaxError
// rather than pretending it might have been a method name.
const LOOKS_ARITHMETIC = /^[\d\s+\-*/%().]*$/;

export function rubyMatchers() {
  return [
    {
      // `puts "hi"` — output first, then the nil that `puts` actually returns.
      pattern: /^(puts|p|pp|print)\s+(.+)$/,
      run(match) {
        try {
          const value = evaluate(match[2]);
          const printed = match[1] === 'p' || match[1] === 'pp' ? inspect(value) : toS(value);
          return [{ text: printed }, { text: '=> nil' }, { text: '' }];
        } catch (error) {
          if (!(error instanceof RubyError) || error.fallback) return null;
          return errorLines(error);
        }
      }
    },
    {
      // Catch-all, tried last: if this cannot make sense of the input the
      // console falls through to its own NameError.
      pattern: /^.+$/,
      run(match) {
        const source = match[0];
        try {
          return [{ text: `=> ${inspect(evaluate(source))}` }, { text: '' }];
        } catch (error) {
          if (!(error instanceof RubyError)) return null;
          if (error.rubyName === 'SyntaxError') {
            return LOOKS_ARITHMETIC.test(source) ? errorLines(error) : null;
          }
          return error.fallback ? null : errorLines(error);
        }
      }
    }
  ];
}
