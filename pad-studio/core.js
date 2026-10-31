/* Pad Studio core: protocol encoders, cus frames, display simulator, animations, mock device.
   Works in the browser (window.PadCore) and in Node (module.exports) so it can be tested. */
(function (root) {
  const te = new TextEncoder();
  const td = new TextDecoder();

  /* ---------- key token tables (from the official web-config) ---------- */
  const MOD = { lctrl: 0xe0, lshift: 0xe1, lalt: 0xe2, lgui: 0xe3, rctrl: 0xe4, rshift: 0xe5, ralt: 0xe6, rgui: 0xe7 };
  const SPECIAL = {
    arrowup: 0xd2, arrowdown: 0xd1, arrowleft: 0xd0, arrowright: 0xcf, pagedown: 0xce, end: 0xcd, delete: 0xcc,
    pageup: 0xcb, home: 0xca, insert: 0xc9, pause: 0xc8, scrolllock: 0xc7, prtscr: 0xc6,
    f12: 0xc5, f11: 0xc4, f10: 0xc3, f9: 0xc2, f8: 0xc1, f7: 0xc0, f6: 0xbf, f5: 0xbe, f4: 0xbd, f3: 0xbc, f2: 0xbb, f1: 0xba,
    enter: 0xa8, escape: 0xa9, bkspace: 0xaa, tab: 0xab, space: 0xac,
  };
  const CONSUMER = {
    power: [0, 0x30], reset: [0, 0x31], sleep: [0, 0x32], play_pause: [0, 0xcd], next: [0, 0xb5], prev: [0, 0xb6],
    stop_play: [0, 0xb7], volume: [0, 0xe0], mute: [0, 0xe2], vol_inc: [0, 0xe9], vol_dec: [0, 0xea],
    config: [1, 0x83], email: [1, 0x8a], calc: [1, 0x92], browser: [1, 0x94],
    web_search: [2, 0x21], web_home: [2, 0x23], web_back: [2, 0x24], web_forward: [2, 0x25], web_stop: [2, 0x26],
    web_refresh: [2, 0x27], web_bkmarks: [2, 0x2a],
  };
  const TOKEN_NAMES = [...Object.keys(MOD), ...Object.keys(SPECIAL), ...Object.keys(CONSUMER)];
  const REVERSE = {};
  for (const [k, v] of Object.entries({ ...MOD, ...SPECIAL })) REVERSE[v] = k;

  function concat(...arrs) {
    const out = new Uint8Array(arrs.reduce((n, a) => n + a.length, 0));
    let o = 0;
    for (const a of arrs) { out.set(a, o); o += a.length; }
    return out;
  }
  const str = (s) => te.encode(s);

  /* ---------- ebf frames: "ebf" + 1 byte length + command ---------- */
  function ebf(cmdBytes) {
    if (cmdBytes.length > 255) throw new Error('ebf command is ' + cmdBytes.length + ' bytes; max 255');
    return concat(str('ebf'), Uint8Array.of(cmdBytes.length), cmdBytes);
  }

  /** Encode key text such as "{lctrl}c" or "hello{enter}". Returns {mode, bytes}. */
  function encodeKeyText(text) {
    const out = [];
    let mods = 0, cons = 0, plain = 0;
    for (const part of text.split(/(\{[a-z0-9_]+\})/i)) {
      const m = /^\{([a-z0-9_]+)\}$/i.exec(part);
      const name = m && m[1].toLowerCase();
      if (name && name in MOD) { out.push(MOD[name]); mods++; }
      else if (name && name in SPECIAL) { out.push(SPECIAL[name]); plain++; }
      else if (name && name in CONSUMER) { out.push(...CONSUMER[name]); cons++; }
      else { const b = te.encode(part); out.push(...b); plain += b.length; }
    }
    if (cons > 1) throw new Error('Media/consumer keys can only be used alone');
    if (mods > 0 && plain > 6) throw new Error('At most 6 keys alongside modifiers');
    if (mods === 0 && cons === 0 && out.length > 128) throw new Error('Max 128 bytes of key text');
    return { mode: cons ? '2' : mods ? '1' : '0', bytes: Uint8Array.from(out) };
  }

  /** Bytes the device sends back for a key back into {token} text (specials only; no non-ASCII). */
  function decodeKeyText(bytes) {
    let s = '';
    for (const b of bytes) s += b in REVERSE ? '{' + REVERSE[b] + '}' : b < 0x80 ? String.fromCharCode(b) : '?';
    return s;
  }

  const F = {
    queryVersion: () => ebf(str('5')),
    queryProfiles: () => ebf(str('l')),
    setProfileCount: (n) => ebf(str('m' + n)),
    queryKey: (p, k) => ebf(str('8' + p + '.' + k)),
    enableHid: (p, k) => ebf(str('a' + p + '.' + k)),
    keyConfig: (p, k, text) => {
      const { mode, bytes } = encodeKeyText(text);
      return ebf(concat(str('0' + p + '.' + k + ':' + mode), bytes));
    },
    alias: (p, k, alias) => ebf(alias == null ? str('3' + p + '.' + k + ':') : concat(str('2' + p + '.' + k + ':'), str(alias))),
    script: (p, k, script) => ebf(script == null ? str('7' + p + '.' + k + ':') : concat(str('6' + p + '.' + k + ':'), str(script))),
    led: (hex, brightness) => ebf(str('1' + hex.replace('#', '') + brightness)),
  };

  /* ---------- cus frames: "cus" + u16be length + JSON ---------- */
  const CUS_W = 480, CUS_H = 200, CUS_MAX_PAYLOAD = 2043, CUS_MAX_PANELS = 48;
  function cusFrame(obj) {
    const payload = te.encode(JSON.stringify(obj));
    if (payload.length < 1 || payload.length > CUS_MAX_PAYLOAD) throw new Error('cus payload ' + payload.length + ' bytes out of range');
    return concat(str('cus'), Uint8Array.of(payload.length >> 8, payload.length & 255), payload);
  }

  /* pcs frames drive the pad's built-in PC-monitor screen: "pcs" + u16be length + JSON */
  function pcsFrame(obj) {
    const payload = te.encode(JSON.stringify(obj));
    if (payload.length < 1 || payload.length > CUS_MAX_PAYLOAD) throw new Error('pcs payload ' + payload.length + ' bytes out of range');
    return concat(str('pcs'), Uint8Array.of(payload.length >> 8, payload.length & 255), payload);
  }
  /* Wi-Fi credentials for the pad's firmware updater, exactly as the official web page sends them: type '4', "ssid.password" */
  F.wifi = (ssid, password) => { if (ssid.includes('.')) throw new Error('The pad splits SSID and password at the first "." so the SSID cannot contain one'); return ebf(str('4' + ssid + '.' + password)); };

  /* ---------- display simulator: parses the same bytes the device would ---------- */
  class Simulator {
    constructor(onChange) { this.onChange = onChange || (() => {}); this.buf = new Uint8Array(0); this.panels = []; this.stats = { frames: 0, bytes: 0, errors: 0 }; }
    feed(bytes) {
      this.stats.bytes += bytes.length;
      this.buf = concat(this.buf, bytes);
      for (;;) {
        let i = -1;
        for (let j = 0; j + 2 < this.buf.length; j++) if (this.buf[j] === 0x63 && this.buf[j + 1] === 0x75 && this.buf[j + 2] === 0x73) { i = j; break; }
        if (i < 0) { this.buf = this.buf.slice(Math.max(0, this.buf.length - 2)); return; }
        if (this.buf.length < i + 5) { this.buf = this.buf.slice(i); return; }
        const n = (this.buf[i + 3] << 8) | this.buf[i + 4];
        if (n < 1 || n > 2048) { this.stats.errors++; this.buf = this.buf.slice(i + 3); continue; }
        if (this.buf.length < i + 5 + n) { this.buf = this.buf.slice(i); return; }
        const payload = this.buf.slice(i + 5, i + 5 + n);
        this.buf = this.buf.slice(i + 5 + n);
        this.apply(payload);
      }
    }
    apply(payload) {
      let o;
      try { o = JSON.parse(td.decode(payload)); } catch (e) { this.stats.errors++; return; }
      this.stats.frames++;
      if (o.clear_canvas) this.panels = [];
      if (typeof o.text === 'string' && o.text.length) {
        const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
        const x = clamp(o.x | 0, 0, CUS_W), y = clamp(o.y | 0, 0, CUS_H);
        const w = clamp(o.w == null ? CUS_W : o.w | 0, 0, CUS_W - x), h = clamp(o.h == null ? CUS_H : o.h | 0, 0, CUS_H - y);
        const border = o.border === undefined ? 0 : o.border === true ? 1 : o.border === false ? 0 : Math.max(0, o.border | 0);
        this.panels.push({ x, y, w, h, text: o.text, fg: o.fg || '#FFFFFF', bg: o.bg || '#000000', align: (o.align || 'LEFT').toUpperCase(),
          border, borderColor: o['border-color'] || '#888888', radius: o['border-radius'] | 0 });
        if (this.panels.length > CUS_MAX_PANELS) this.panels.shift();
      }
      this.onChange(this);
    }
    render(ctx) {
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, CUS_W, CUS_H);
      for (const p of this.panels) {
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(p.x, p.y, p.w, p.h, p.radius); else ctx.rect(p.x, p.y, p.w, p.h);
        ctx.fillStyle = p.bg; ctx.fill();
        if (p.border) { ctx.lineWidth = p.border; ctx.strokeStyle = p.borderColor; ctx.stroke(); }
        if (p.text.trim()) {
          ctx.fillStyle = p.fg; ctx.font = '16px sans-serif'; ctx.textBaseline = 'top';
          ctx.textAlign = p.align === 'CENTER' ? 'center' : p.align === 'RIGHT' ? 'right' : 'left';
          const tx = p.align === 'CENTER' ? p.x + p.w / 2 : p.align === 'RIGHT' ? p.x + p.w - 6 : p.x + 6;
          ctx.fillText(p.text, tx, p.y + 6, Math.max(1, p.w - 12));
        }
      }
    }
  }

  /* ---------- animations: each returns an array of panel objects per frame ---------- */
  const hex2 = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  function hsl(h, s, l) {
    h = ((h % 360) + 360) % 360; s /= 100; l /= 100;
    const a = s * Math.min(l, 1 - l), f = (n) => { const k = (n + h / 30) % 12; return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
    return '#' + hex2(f(0) * 255) + hex2(f(8) * 255) + hex2(f(4) * 255);
  }
  const BG = (bg) => ({ x: 0, y: 0, w: CUS_W, h: CUS_H, text: ' ', bg });
  const ANIMATIONS = [
    { id: 'equalizer', name: 'Equalizer bars', fps: 12, gen: (t) => {
      const out = [BG('#0b0b14')], n = 16, bw = 24, gap = 4;
      for (let i = 0; i < n; i++) {
        const v = 0.5 + 0.5 * Math.sin(t * 3 + i * 0.7) * Math.sin(t * 1.3 + i * 0.31), h = 12 + Math.round(v * 170);
        out.push({ x: 8 + i * (bw + gap), y: CUS_H - 8 - h, w: bw, h, text: ' ', bg: hsl(200 + i * 8 + t * 20, 80, 55) });
      }
      return out;
    } },
    { id: 'wave', name: 'Rainbow wave', fps: 10, gen: (t) => {
      const out = [], n = 20, w = CUS_W / n;
      for (let i = 0; i < n; i++) out.push({ x: Math.round(i * w), y: 0, w: Math.ceil(w), h: CUS_H, text: ' ', bg: hsl(t * 90 + i * 18, 85, 50) });
      return out;
    } },
    { id: 'progress', name: 'Progress bar', fps: 10, gen: (t) => {
      const p = (t % 5) / 5;
      return [BG('#101820'), { x: 20, y: 80, w: 440, h: 40, text: ' ', bg: '#243040', 'border-radius': 8 },
        { x: 20, y: 80, w: Math.max(8, Math.round(440 * p)), h: 40, text: Math.round(p * 100) + '%', bg: hsl(120 * p, 75, 45), align: 'CENTER', 'border-radius': 8 }];
    } },
    { id: 'pulse', name: 'Pulse', fps: 12, gen: (t) => {
      const v = 0.5 + 0.5 * Math.sin(t * 3);
      return [{ x: 0, y: 0, w: CUS_W, h: CUS_H, text: 'PAD STUDIO', bg: hsl(260, 70, 10 + v * 35), fg: '#FFFFFF', align: 'CENTER' }];
    } },
    { id: 'clock', name: 'Clock', fps: 1, gen: () => {
      const d = new Date(), z = (n) => String(n).padStart(2, '0');
      return [{ x: 0, y: 0, w: CUS_W, h: CUS_H, text: z(d.getHours()) + ':' + z(d.getMinutes()) + ':' + z(d.getSeconds()), bg: '#05070d', fg: '#7CFFB2', align: 'CENTER' }];
    } },
    { id: 'marquee', name: 'Scrolling text (device-native)', fps: 0.2, gen: () => [
      { x: 0, y: 70, w: CUS_W, h: 50, text: 'Hello from Pad Studio  -  this scroll is animated by the device itself   ', bg: '#1b1030', fg: '#FFD166', long_mode: 'SCROLL_CIRCULAR' }] },
  ];

  /** One animation frame -> list of cus frames (first one clears the canvas). Each frame appends one panel. */
  function animFrames(panels) {
    return panels.map((p, i) => cusFrame(i === 0 ? { clear_canvas: true, ...p } : p));
  }

  /* ---------- mock device for testing without hardware ---------- */
  class MockDevice {
    constructor(onData) { this.onData = onData; this.buf = new Uint8Array(0); this.keys = {}; this.version = 'mock-1.0'; this.profiles = 5; this.log = []; }
    write(bytes) {
      this.buf = concat(this.buf, bytes);
      for (;;) {
        let i = -1;
        for (let j = 0; j + 3 < this.buf.length; j++) if (this.buf[j] === 0x65 && this.buf[j + 1] === 0x62 && this.buf[j + 2] === 0x66) { i = j; break; }
        if (i < 0) { this.buf = new Uint8Array(0); return; }
        const n = this.buf[i + 3];
        if (this.buf.length < i + 4 + n) { this.buf = this.buf.slice(i); return; }
        const cmd = this.buf.slice(i + 4, i + 4 + n);
        this.buf = this.buf.slice(i + 4 + n);
        this.handle(cmd);
      }
    }
    handle(cmd) {
      const type = String.fromCharCode(cmd[0]), rest = cmd.slice(1);
      this.log.push(type);
      const say = (s) => this.onData(typeof s === 'string' ? str(s + '\r\n') : concat(s, str('\r\n')));
      const pk = () => { const m = /^(\d+)\.(\d+):?/.exec(td.decode(rest)); return m ? m[1] + '.' + m[2] : null; };
      if (type === '5') say('v=' + this.version);
      else if (type === 'l') say('n=' + this.profiles);
      else if (type === 'm') this.profiles = parseInt(td.decode(rest), 10);
      else if (type === '0') { const k = pk(); const colon = rest.indexOf(0x3a); (this.keys[k] = this.keys[k] || {}).bytes = rest.slice(colon + 2); }
      else if (type === '2') { const k = pk(); (this.keys[k] = this.keys[k] || {}).alias = td.decode(rest.slice(rest.indexOf(0x3a) + 1)); }
      else if (type === '3') { const k = pk(); if (this.keys[k]) delete this.keys[k].alias; }
      else if (type === '8') {
        const k = pk(), e = this.keys[k] || {};
        say(concat(str('c='), e.bytes || new Uint8Array(0)));
        say(e.alias != null ? 'a=' + e.alias : 'b=');
      }
    }
  }

  const api = { MOD, SPECIAL, CONSUMER, TOKEN_NAMES, concat, ebf, encodeKeyText, decodeKeyText, F, cusFrame, Simulator, ANIMATIONS, animFrames, hsl, MockDevice,
    CUS_W, CUS_H, CUS_MAX_PAYLOAD, CUS_MAX_PANELS, pcsFrame };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.PadCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
