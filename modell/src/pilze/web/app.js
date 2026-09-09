// Pilzkarte. Vier Seiten in einem Panel, eine Karte dahinter.
//
// Die Daten kommen aus index.html: SPECIES (die Manifeste der Arten), INPUTS
// (die Eingabe-Ebenen), KATALOG (die Artprofile), COLORS (die Farbrampe) und
// GEBIET_ROH (die Huelle aller Karten). Alles andere holt die Seite bei
// Bedarf: Kacheln, Trainingsfunde, gemeldete Funde.
(() => {
'use strict';
const $ = id => document.getElementById(id);
const namen = Object.keys(SPECIES);
const KAT = Object.fromEntries(KATALOG.map(k => [k.slug, k]));
const GEBIET = L.latLngBounds(GEBIET_ROH);
const mobil = () => matchMedia('(max-width:820px)').matches;
function lies(k){ try { return localStorage.getItem(k); } catch(e){ return null; } }
function merke(k, v){ try { localStorage.setItem(k, v); } catch(e){} }
function zugang(){ return lies('pilze.zugang') || ''; }
const titel = slug => (SPECIES[slug] && SPECIES[slug].title) || (KAT[slug] && KAT[slug].name) || slug;

// ---------------------------------------------------------------- Zustand
let art = namen.includes(lies('pilze.art')) ? lies('pilze.art') : namen[0];
let woche = 0;                 // Index in SPECIES[art].weeks
let modus = 'aus';             // aus = Vorhersage, ein = Ebene, kombi = Kombination
let seite = 'karte';
let melden = false;

// ---------------------------------------------------------------- Karte
// Am Telefon ist der Bildschirm hoch und schmal: bei Zoom 5 reicht er von
// Daenemark bis Italien, also weiter Rand und eine Stufe mehr zum Herauszoomen.
const map = L.map('map', {zoomControl: !mobil(), attributionControl: false, minZoom: mobil() ? 4 : 5, maxBoundsViscosity: 0.9});
// Am Telefon deckt das Blatt den unteren Rand, also sitzt die Quellenangabe oben links.
L.control.attribution({position: mobil() ? 'topleft' : 'bottomright', prefix: false}).addTo(map);
map.setMaxBounds(GEBIET.pad(mobil() ? 2.5 : 0.6));
const OSM = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const bases = {
 'Karte': L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom: 18, attribution: OSM}),
 'Hell': L.tileLayer('https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
   {maxZoom: 19, attribution: OSM + ' &copy; CARTO'}),
 'Topographisch': L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
   {maxZoom: 17, subdomains: 'abc', attribution: OSM + ' | OpenTopoMap (CC-BY-SA)'}),
 'Satellit': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
   {maxZoom: 18, attribution: 'Esri, Maxar, Earthstar Geographics'}),
};
bases['Karte'].addTo(map);
L.control.layers(bases, null, {collapsed: true, position: 'topright'}).addTo(map);
function passeEin(){
  // Am Telefon liegt das halb offene Blatt ueber dem unteren Teil der Karte;
  // die Karte wird in den freien Streifen darueber eingepasst, gemessen.
  let unten = 0;
  if (mobil()){
    const oben = $('panel').getBoundingClientRect().top;
    unten = Math.round(innerHeight - (oben > 0 && oben < innerHeight ? oben : innerHeight * 0.53));
  }
  map.fitBounds(GEBIET, {paddingTopLeft: [0, mobil() ? 44 : 0], paddingBottomRight: [0, unten], animate: false});
}
passeEin();
addEventListener('resize', () => { map.invalidateSize({animate: false}); });

// ---------------------------------------------------------------- Wertkacheln
// Eine Wertkachel traegt einen Kanal: 0 heisst keine Daten, 1 bis 255 den
// Wert im Verhaeltnis zum Hoechstwert. Die Farbe entsteht hier im Browser.
const WertKacheln = L.TileLayer.extend({
  createTile: function(coords, fertig){
    const leinwand = L.DomUtil.create('canvas');
    leinwand.width = leinwand.height = 256;
    const stift = leinwand.getContext('2d', {willReadFrequently: true});
    const lut = this.options.lut;
    if (!this.options.gibtEs.has(coords.z + '/' + coords.x + '/' + coords.y)){
      setTimeout(() => fertig(null, leinwand), 0);
      return leinwand;
    }
    const bild = new Image();
    bild.onload = () => {
      stift.drawImage(bild, 0, 0);
      const d = stift.getImageData(0, 0, 256, 256), q = d.data;
      for (let i = 0; i < q.length; i += 4){
        const o = q[i] * 4;
        q[i] = lut[o]; q[i + 1] = lut[o + 1]; q[i + 2] = lut[o + 2]; q[i + 3] = lut[o + 3];
      }
      stift.putImageData(d, 0, 0);
      fertig(null, leinwand);
    };
    bild.onerror = () => fertig(null, leinwand);
    bild.src = this.getTileUrl(coords);
    return leinwand;
  }
});
function baueLut(top){
  const lut = new Uint8ClampedArray(1024);
  for (let b = 1; b < 256; b++){
    const rel = (b - 1) / 254, wert = rel * top;
    const pos = Math.min(wert, 1) * (COLORS.length - 1);
    const lo = Math.floor(pos), hi = Math.min(lo + 1, COLORS.length - 1), w = pos - lo, o = b * 4;
    for (let k = 0; k < 3; k++) lut[o + k] = COLORS[lo][k] * (1 - w) + COLORS[hi][k] * w;
    lut[o + 3] = Math.min(1, 0.10 + rel * 0.85) * 240;
  }
  return lut;
}
function baueLutFlach(){
  const lut = new Uint8ClampedArray(1024);
  for (let b = 1; b < 256; b++){
    const pos = (b - 1) / 254 * (COLORS.length - 1);
    const lo = Math.floor(pos), hi = Math.min(lo + 1, COLORS.length - 1), w = pos - lo, o = b * 4;
    for (let k = 0; k < 3; k++) lut[o + k] = COLORS[lo][k] * (1 - w) + COLORS[hi][k] * w;
    lut[o + 3] = 215;
  }
  return lut;
}
const kachelMengen = new Map();
function kachelMenge(schluessel, have){
  let m = kachelMengen.get(schluessel);
  if (!m){
    m = new Set();
    Object.entries(have || {}).forEach(([z, liste]) => liste.forEach(xy => m.add(z + '/' + xy)));
    kachelMengen.set(schluessel, m);
  }
  return m;
}
const LEER = new Set();
const wochenSchluessel = wk => wk.year + 'W' + String(wk.week).padStart(2, '0');
const kachelUrl = (satz, wk) => wk.tiles + '/{z}/{x}/{y}.png' + (wk.tv ? '?v=' + wk.tv : '');
const ebeneUrl = (v, s) => v.tiles + '/' + s + '/{z}/{x}/{y}.png' + (v.tv ? '?v=' + v.tv : '');
const deckkraft = () => $('op').value / 100;

// Vorhersage: die Kacheln der Woche, mit Wechsel erst, wenn die neue Woche da ist.
let kachelEbene = null, kachelNeu = null;
function setzeKacheln(satz, wk, sichtbar){
  if (kachelNeu){ map.removeLayer(kachelNeu); kachelNeu = null; }
  const ebene = new WertKacheln(kachelUrl(satz, wk), {
    minNativeZoom: satz.tiles.zooms[0], maxNativeZoom: satz.tiles.zooms[1],
    bounds: L.latLngBounds(satz.bounds), lut: baueLut(satz.top),
    gibtEs: kachelMenge(satz.name, satz.tiles.have),
    opacity: sichtbar, updateWhenZooming: false, keepBuffer: 1});
  const fertig = () => {
    ebene.off('load', fertig);
    if (kachelEbene && kachelEbene !== ebene) map.removeLayer(kachelEbene);
    kachelEbene = ebene; kachelNeu = null;
  };
  ebene.on('load', fertig);
  kachelNeu = ebene;
  ebene.addTo(map);
}
// Die Nachbarwochen werden vorgeladen, damit der Regler nicht ruckelt.
const bilder = new Map();
function vorladen(url){
  let b = bilder.get(url);
  if (!b){ b = new Image(); b.decoding = 'async'; b.src = url; bilder.set(url, b); }
  return b;
}
function sichtbareKacheln(satz){
  const zs = satz.tiles.zooms, z = Math.max(zs[0], Math.min(zs[1], map.getZoom()));
  const n = 2 ** z, b = map.getBounds();
  const punkt = (lat, lon) => {
    const s = Math.sin(lat * Math.PI / 180);
    return [Math.floor((lon + 180) / 360 * n), Math.floor((0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n)];
  };
  const [x0, y0] = punkt(b.getNorth(), b.getWest()), [x1, y1] = punkt(b.getSouth(), b.getEast());
  const liste = [];
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) liste.push([z, x, y]);
  return liste;
}
let ladeLauf = 0;
function vorladenReihe(satz, start, weite){
  if (!satz.tiles) return;
  const lauf = ++ladeLauf, n = satz.weeks.length, wochen = [];
  const spanne = weite === null ? n : Math.min(weite, 4);
  for (let d = 0; d <= spanne; d++){
    if (start + d < n) wochen.push(start + d);
    if (d && start - d >= 0) wochen.push(start - d);
  }
  const reihe = [], gibtEs = kachelMenge(satz.name, satz.tiles.have);
  wochen.forEach(w => {
    const url = kachelUrl(satz, satz.weeks[w]);
    sichtbareKacheln(satz).filter(([z, x, y]) => gibtEs.has(z + '/' + x + '/' + y))
      .forEach(([z, x, y]) => reihe.push(url.replace('{z}', z).replace('{x}', x).replace('{y}', y)));
  });
  let i = 0;
  const naechstes = () => {
    while (lauf === ladeLauf && i < reihe.length){
      const b = vorladen(reihe[i++]);
      if (!b.complete){
        b.addEventListener('load', naechstes, {once: true});
        b.addEventListener('error', naechstes, {once: true});
        return;
      }
    }
  };
  for (let k = 0; k < 4; k++) naechstes();
}

// ---------------------------------------------------------------- Zeitleiste
function baueLeiste(){
  const satz = SPECIES[art], leiste = $('leiste');
  leiste.innerHTML = '';
  // Der Balken unter der Woche ist das Mittel der Karte dieser Woche,
  // relativ zur besten Woche der Art im Zeitraum. Eine dunkle Karte hat
  // einen kurzen Balken. Fehlen die Zahlen, bleibt der Balken leer.
  const mittel = satz.weeks.map(wk => wk.mean || 0), spitze = Math.max(1e-6, ...mittel);
  let jahr = null;
  satz.weeks.forEach((wk, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.innerHTML = '<small>KW</small><b>' + wk.week + '</b><span class="balken"><i></i></span>';
    if (wk.year !== jahr){ b.classList.add('jahr'); b.dataset.jahr = wk.year; jahr = wk.year; }
    if (wk.forecast) b.classList.add('prognose');
    b.querySelector('.balken i').style.width = Math.round(100 * mittel[i] / spitze) + '%';
    b.title = wk.year + ', Kalenderwoche ' + wk.week + (wk.forecast ? ', Prognose' : '')
      + (wk.mean != null ? ', Mittel ' + wk.mean.toFixed(3).replace('.', ',') + ', Maximum ' + wk.max.toFixed(2).replace('.', ',') : '');
    b.addEventListener('click', () => { stoppe(); zeige(i); vorladenReihe(satz, i, 6); });
    leiste.appendChild(b);
  });
}
function markiereLeiste(){
  const knoepfe = $('leiste').children;
  for (let i = 0; i < knoepfe.length; i++) knoepfe[i].classList.toggle('aktiv', i === woche);
  const k = knoepfe[woche], leiste = $('leiste');
  // scrollLeft statt scrollIntoView: das schiebt nur die Leiste, nie das Panel.
  if (k) leiste.scrollTo({left: k.offsetLeft - leiste.clientWidth / 2 + k.offsetWidth / 2, behavior: 'smooth'});
}
function zeige(i){
  const satz = SPECIES[art], wk = satz.weeks[i];
  woche = i;
  $('zurueck').disabled = i <= 0;
  $('vor').disabled = i >= satz.weeks.length - 1;
  const text = 'KW ' + wk.week + ' · ' + wk.year + (wk.forecast ? ' · Prognose' : '');
  $('wochenTitel').textContent = text;
  $('wochenTitel').classList.toggle('prognose', !!wk.forecast);
  $('kopfWas').textContent = pillenText() + ' ·';
  markiereLeiste();
  if (wk.tiles) setzeKacheln(satz, wk, modus === 'aus' ? deckkraft() : 0);
  zeigeWochenEbene(wk);
  zeigeFunde();
  zeigeKombi();
}
function pillenText(){
  if (modus === 'ein') return ebeneInfo ? ebeneInfo.label : 'Ebene';
  if (modus === 'kombi') return 'Kombination';
  return titel(art);
}
function schritt(d){
  const neu = Math.min(SPECIES[art].weeks.length - 1, Math.max(0, woche + d));
  stoppe(); zeige(neu); vorladenReihe(SPECIES[art], neu, 6);
}
$('zurueck').addEventListener('click', () => schritt(-1));
$('vor').addEventListener('click', () => schritt(1));
document.addEventListener('keydown', e => {
  if (['SELECT', 'INPUT', 'TEXTAREA'].includes(e.target.tagName) || seite !== 'karte') return;
  if (e.key === 'ArrowLeft'){ schritt(-1); e.preventDefault(); }
  if (e.key === 'ArrowRight'){ schritt(1); e.preventDefault(); }
});
let timer = null;
const PLAY = '<svg viewBox="0 0 12 12"><path d="M3 1.4 10 6 3 10.6Z"/></svg>';
const PAUSE = '<svg viewBox="0 0 12 12"><path d="M3 1.6h2.2v8.8H3zM6.8 1.6H9v8.8H6.8z"/></svg>';
function stoppe(){
  if (timer){ clearInterval(timer); timer = null; }
  $('play').innerHTML = PLAY; $('play').title = 'Saison abspielen';
}
$('play').addEventListener('click', () => {
  if (timer) return stoppe();
  $('play').innerHTML = PAUSE; $('play').title = 'Anhalten';
  vorladenReihe(SPECIES[art], woche, null);
  timer = setInterval(() => zeige((woche + 1) % SPECIES[art].weeks.length), 450);
});

// ---------------------------------------------------------------- Arten waehlen
function baueChips(ziel, mitAlle, gewaehlt, beiKlick){
  const box = $(ziel); box.innerHTML = '';
  const eintraege = (mitAlle ? [['', 'alle']] : []).concat(namen.map(n => [n, titel(n)]));
  eintraege.forEach(([slug, label]) => {
    const c = document.createElement('button'); c.type = 'button'; c.className = 'chip';
    c.textContent = label; c.dataset.slug = slug;
    if (slug === gewaehlt) c.classList.add('aktiv');
    c.addEventListener('click', () => beiKlick(slug, c));
    box.appendChild(c);
  });
}
function waehleArt(slug){
  if (!SPECIES[slug]) return;
  art = slug; merke('pilze.art', slug);
  [...$('artChips').children].forEach(c => c.classList.toggle('aktiv', c.dataset.slug === slug));
  const chips = $('artChips'), aktiv = [...chips.children].find(c => c.dataset.slug === slug);
  if (aktiv) chips.scrollTo({left: aktiv.offsetLeft - chips.clientWidth / 2 + aktiv.offsetWidth / 2, behavior: 'smooth'});
  const satz = SPECIES[slug];
  $('top').textContent = 'Höchstwert ' + satz.top.toFixed(2).replace('.', ',');
  [kachelEbene, kachelNeu].forEach(e => { if (e) map.removeLayer(e); });
  kachelEbene = kachelNeu = null;
  baueLeiste();
  stoppe();
  const w = Math.min(woche, satz.weeks.length - 1);
  zeige(w);
  vorladenReihe(satz, w, 6);
  ladeMeldungen();
}
baueChips('artChips', false, art, slug => waehleArt(slug));

// ---------------------------------------------------------------- Ansichten auf der Karte
let ebene = null, ebeneInfo = null, ebeneWoche = null;
function setzeModus(neu){
  modus = neu;
  const aus = modus === 'aus', ein = modus === 'ein', kombi = modus === 'kombi';
  $('tabAus').setAttribute('aria-selected', aus);
  $('tabEin').setAttribute('aria-selected', ein);
  $('tabKombi').setAttribute('aria-selected', kombi);
  $('paneAus').style.display = aus ? 'block' : 'none';
  $('paneEin').style.display = ein ? 'block' : 'none';
  $('paneKombi').style.display = kombi ? 'block' : 'none';
  [kachelEbene, kachelNeu].forEach(e => { if (e) e.setOpacity(aus ? deckkraft() : 0); });
  if (ebene) ebene.setOpacity(ein ? deckkraft() : 0);
  if (ein && !ebene && $('lay').options.length > 1){
    $('lay').selectedIndex = 1; $('lay').dispatchEvent(new Event('change'));
  }
  zeigeWochenEbene(SPECIES[art].weeks[woche]);
  zeigeFunde(); ladeMeldungen(); zeigeKombi();
  zeigeZeit();
  $('kopfWas').textContent = pillenText() + ' ·';
}
// Die Zeitleiste gehoert zur Vorhersage, zur Kombination und zu jeder
// Ebene, die sich mit der Woche aendert. Bei einer festen Ebene wirkt sie nicht.
function zeigeZeit(){
  const noetig = modus === 'aus' || modus === 'kombi' || (ebeneInfo && !ebeneInfo.static);
  $('zeit').style.display = noetig ? 'block' : 'none';
  if (!noetig) stoppe();
  berechneRasten();
}
$('tabAus').addEventListener('click', () => setzeModus('aus'));
$('tabEin').addEventListener('click', () => setzeModus('ein'));
$('tabKombi').addEventListener('click', () => setzeModus('kombi'));
$('op').addEventListener('input', () => {
  [kachelEbene, kachelNeu].forEach(e => { if (e) e.setOpacity(modus === 'aus' ? deckkraft() : 0); });
  if (ebene) ebene.setOpacity(modus === 'ein' ? deckkraft() : 0);
  if (kombiEbene) kombiEbene.setOpacity(modus === 'kombi' ? deckkraft() : 0);
});
const balken = COLORS.map(c => '<i style="background:rgb(' + c.join(',') + ')"></i>').join('');
$('ramp').innerHTML = balken; $('layramp').innerHTML = balken; $('kombiramp').innerHTML = balken;

// Eingabe-Ebene
const laySel = $('lay');
const gruppen = [['je Woche', ([, v]) => !v.static], ['fest', ([, v]) => v.static]];
laySel.innerHTML = '<option value="">Ebene wählen …</option>' + gruppen.map(([t, passt]) => {
  const e = Object.entries(INPUTS.layers || {}).filter(passt);
  return e.length ? '<optgroup label="' + t + '">' + e.map(([k, v]) => '<option value="' + k + '">' + v.label + '</option>').join('') + '</optgroup>' : '';
}).join('');
laySel.addEventListener('change', () => {
  if (ebene){ map.removeLayer(ebene); ebene = null; }
  ebeneInfo = null; ebeneWoche = null;
  const k = laySel.value, info = $('layinfo');
  if (!k){ info.style.display = 'none'; zeigeZeit(); return; }
  const v = INPUTS.layers[k]; ebeneInfo = v;
  const gemeinsam = {minNativeZoom: v.zooms[0], maxNativeZoom: v.zooms[1], bounds: L.latLngBounds(INPUTS.bounds),
    lut: baueLutFlach(), updateWhenZooming: false, keepBuffer: 1};
  if (v.static){
    ebene = new WertKacheln(v.tiles + '/{z}/{x}/{y}.png' + (v.tv ? '?v=' + v.tv : ''),
      Object.assign(gemeinsam, {gibtEs: kachelMenge('ebene:' + k, v.have), opacity: deckkraft()})).addTo(map);
  } else {
    const s = wochenSchluessel(SPECIES[art].weeks[woche]), da = v.weeks.indexOf(s) >= 0;
    ebeneWoche = s;
    ebene = new WertKacheln(ebeneUrl(v, s),
      Object.assign(gemeinsam, {gibtEs: da ? kachelMenge('ebene:' + k, v.have) : LEER, opacity: da ? deckkraft() : 0})).addTo(map);
  }
  const einheit = v.unit ? ' ' + v.unit : '';
  $('laylo').textContent = String(v.low).replace('.', ',') + einheit;
  $('layhi').textContent = String(v.high).replace('.', ',') + einheit;
  info.style.display = 'block';
  zeigeZeit();
  $('kopfWas').textContent = pillenText() + ' ·';
});
function zeigeWochenEbene(wk){
  if (!ebene || !ebeneInfo || ebeneInfo.static) return;
  const s = wochenSchluessel(wk), da = ebeneInfo.weeks.indexOf(s) >= 0;
  ebene.options.gibtEs = da ? kachelMenge('ebene:' + laySel.value, ebeneInfo.have) : LEER;
  if (ebeneWoche !== s){ ebene.setUrl(ebeneUrl(ebeneInfo, s)); ebeneWoche = s; }
  ebene.setOpacity(da && modus === 'ein' ? deckkraft() : 0);
}

// Trainingsfunde: je 5-km-Zelle und Kalenderwoche ein Punkt.
const fundeDaten = new Map();
let fundeEbene = null;
function zeigeFunde(){
  if (fundeEbene){ map.removeLayer(fundeEbene); fundeEbene = null; }
  const satz = SPECIES[art];
  if (!$('funde').checked || modus !== 'aus' || !satz.finds) return;
  const kw = satz.weeks[woche].week;
  const zeichne = daten => {
    if (fundeEbene || !$('funde').checked || modus !== 'aus' || SPECIES[art] !== satz) return;
    const c = daten.columns, ki = c.indexOf('lat'), ko = c.indexOf('lon'), kw_ = c.indexOf('week'), kn = c.indexOf('n'), kj = c.indexOf('years');
    const g = L.layerGroup();
    daten.rows.forEach(r => {
      const abstand = Math.min(Math.abs(r[kw_] - kw), 52 - Math.abs(r[kw_] - kw));
      if (abstand > 2) return;
      L.circleMarker([r[ki], r[ko]], {radius: 2.5 + 1.5 * Math.sqrt(r[kn]), color: '#0b3d3a', weight: 1,
        fillColor: '#3fd8c8', fillOpacity: 0.75})
       .bindTooltip('KW ' + r[kw_] + ': ' + r[kn] + (r[kn] === 1 ? ' Fund' : ' Funde') + ' in ' + r[kj] + (r[kj] === 1 ? ' Jahr' : ' Jahren'))
       .addTo(g);
    });
    fundeEbene = g.addTo(map);
  };
  const d = fundeDaten.get(art);
  if (d) return zeichne(d);
  fetch(satz.finds).then(r => r.json()).then(d => { fundeDaten.set(art, d); zeichne(d); }).catch(() => {});
}
$('funde').addEventListener('change', zeigeFunde);

// Kombination mehrerer Ebenen, je Kachel im Browser gerechnet.
function ladeBytes(url){
  return new Promise(res => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = c.height = 256;
      const ctx = c.getContext('2d', {willReadFrequently: true});
      ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(0, 0, 256, 256).data, b = new Uint8Array(65536);
      for (let i = 0; i < 65536; i++) b[i] = d[i * 4];
      res(b);
    };
    img.onerror = () => res(null);
    img.src = url;
  });
}
async function ebenenBytes(eb, z, x, y){
  const d = Math.max(0, z - eb.maxNative), zz = z - d, xx = x >> d, yy = y >> d;
  if (eb.gibtEs && !eb.gibtEs.has(zz + '/' + xx + '/' + yy)) return null;
  const b = await ladeBytes(eb.url(zz, xx, yy));
  if (!b || d === 0) return b;
  const n = 256 >> d, ox = (x - (xx << d)) * n, oy = (y - (yy << d)) * n, out = new Uint8Array(65536);
  for (let j = 0; j < 256; j++){
    const sy = oy + (j >> d);
    for (let i = 0; i < 256; i++) out[j * 256 + i] = b[sy * 256 + ox + (i >> d)];
  }
  return out;
}
const KombiKacheln = L.GridLayer.extend({
  createTile: function(coords, fertig){
    const c = L.DomUtil.create('canvas'); c.width = c.height = 256;
    const ebenen = this.options.ebenen, art_ = this.options.modus, lut = this.options.lut;
    Promise.all(ebenen.map(e => ebenenBytes(e, coords.z, coords.x, coords.y))).then(teile => {
      const ctx = c.getContext('2d'), img = ctx.createImageData(256, 256), q = img.data;
      const w = ebenen.map(e => e.gewicht), W = w.reduce((a, b) => a + b, 0);
      for (let p = 0; p < 65536; p++){
        let ok = true, acc = art_ === 'min' ? 1 : 0;
        for (let k = 0; k < ebenen.length; k++){
          const t = teile[k], b = t ? t[p] : 0;
          if (!b){ ok = false; break; }
          let v = (b - 1) / 254;
          if (ebenen[k].ab) v = 1 - v;
          if (art_ === 'min') acc = Math.min(acc, v);
          else if (art_ === 'geo') acc += w[k] * Math.log(Math.max(v, 0.001));
          else acc += w[k] * v;
        }
        if (!ok) continue;
        const v = art_ === 'min' ? acc : art_ === 'geo' ? Math.exp(acc / W) : acc / W;
        const o = (1 + Math.round(Math.min(1, Math.max(0, v)) * 254)) * 4, i = p * 4;
        q[i] = lut[o]; q[i + 1] = lut[o + 1]; q[i + 2] = lut[o + 2]; q[i + 3] = lut[o + 3];
      }
      ctx.putImageData(img, 0, 0);
      fertig(null, c);
    }).catch(() => fertig(null, c));
    return c;
  }
});
let kombiEbene = null, kombiWahl = {};
try { kombiWahl = JSON.parse(lies('pilze.kombi') || '{}'); } catch(e){ kombiWahl = {}; }
function baueKombiListe(){
  const ul = $('kombiListe'); ul.innerHTML = '';
  const ebenen = Object.entries(INPUTS.layers || {});
  const gruppen_ = [
    ['Vorhersage', [['vorhersage', 'Vorhersage der gewählten Art']]],
    ['je Woche', ebenen.filter(([, v]) => !v.static && v.tiles).map(([k, v]) => [k, v.label])],
    ['fest', ebenen.filter(([, v]) => v.static && v.tiles).map(([k, v]) => [k, v.label])]];
  gruppen_.forEach(([t, eintraege]) => {
    if (!eintraege.length) return;
    const kopf = document.createElement('li'); kopf.className = 'gruppe'; kopf.textContent = t; ul.appendChild(kopf);
    eintraege.forEach(([k, label]) => {
      const wahl = kombiWahl[k] || (kombiWahl[k] = {an: false, ab: false, gewicht: 1});
      const li = document.createElement('li'), lab = document.createElement('label');
      const box = document.createElement('input'); box.type = 'checkbox'; box.checked = !!wahl.an;
      box.addEventListener('change', () => { wahl.an = box.checked; kombiGeaendert(); });
      lab.appendChild(box);
      if (k === 'vorhersage'){
        // Die Art gehoert hier hinein, nicht in die Vorhersage-Ansicht.
        const artSel = document.createElement('select');
        namen.forEach(n => { const o = document.createElement('option'); o.value = n; o.textContent = titel(n); artSel.appendChild(o); });
        artSel.value = SPECIES[wahl.art] ? wahl.art : art;
        artSel.addEventListener('change', () => { wahl.art = artSel.value; kombiGeaendert(); });
        artSel.addEventListener('click', e => e.preventDefault());
        lab.appendChild(document.createTextNode('Vorhersage '));
        lab.appendChild(artSel);
      } else lab.appendChild(document.createTextNode(label));
      const pfeil = document.createElement('button'); pfeil.type = 'button';
      pfeil.className = 'richtung' + (wahl.ab ? ' ab' : ''); pfeil.textContent = wahl.ab ? '↓' : '↑';
      pfeil.title = 'mehr ist besser / weniger ist besser';
      pfeil.addEventListener('click', () => { wahl.ab = !wahl.ab; pfeil.textContent = wahl.ab ? '↓' : '↑';
        pfeil.classList.toggle('ab', wahl.ab); kombiGeaendert(); });
      const gew = document.createElement('select');
      [1, 2, 3].forEach(g => { const o = document.createElement('option'); o.value = g; o.textContent = '×' + g; gew.appendChild(o); });
      gew.value = wahl.gewicht || 1; gew.title = 'Gewicht';
      gew.addEventListener('change', () => { wahl.gewicht = +gew.value; kombiGeaendert(); });
      li.appendChild(lab); li.appendChild(pfeil); li.appendChild(gew); ul.appendChild(li);
    });
  });
}
function kombiGeaendert(){ merke('pilze.kombi', JSON.stringify(kombiWahl)); zeigeKombi(); }
$('kombiModus').addEventListener('change', zeigeKombi);
function kombiEbenen(wk){
  const s = wochenSchluessel(wk), liste = [];
  Object.entries(kombiWahl).forEach(([k, wahl]) => {
    if (!wahl.an) return;
    let vorlage, maxNative, gibtEs;
    if (k === 'vorhersage'){
      const satz = SPECIES[wahl.art] || SPECIES[art];
      const wk_ = satz.weeks.find(w => w.year === wk.year && w.week === wk.week);
      if (!wk_ || !wk_.tiles) return;
      vorlage = kachelUrl(satz, wk_); maxNative = satz.tiles.zooms[1]; gibtEs = kachelMenge(satz.name, satz.tiles.have);
    } else {
      const v = INPUTS.layers[k]; if (!v || !v.tiles) return;
      if (!v.static && v.weeks.indexOf(s) < 0) return;
      vorlage = v.static ? v.tiles + '/{z}/{x}/{y}.png' + (v.tv ? '?v=' + v.tv : '') : ebeneUrl(v, s);
      maxNative = v.zooms[1]; gibtEs = kachelMenge('ebene:' + k, v.have);
    }
    liste.push({url: (z, x, y) => vorlage.replace('{z}', z).replace('{x}', x).replace('{y}', y),
                maxNative, gibtEs, ab: wahl.ab, gewicht: wahl.gewicht || 1});
  });
  return liste;
}
function zeigeKombi(){
  if (kombiEbene){ map.removeLayer(kombiEbene); kombiEbene = null; }
  if (modus !== 'kombi') return;
  const ebenen = kombiEbenen(SPECIES[art].weeks[woche]);
  if (!ebenen.length) return;
  kombiEbene = new KombiKacheln({ebenen, modus: $('kombiModus').value, lut: baueLutFlach(), minZoom: 5,
    maxNativeZoom: 8, bounds: GEBIET, opacity: deckkraft(), updateWhenZooming: false, keepBuffer: 1}).addTo(map);
}
baueKombiListe();

// ---------------------------------------------------------------- API und Zugang
async function api(pfad, opts){
  const o = Object.assign({headers: {}}, opts || {});
  o.headers['X-Zugang'] = zugang();
  if (o.body && typeof o.body !== 'string'){ o.body = JSON.stringify(o.body); o.headers['Content-Type'] = 'application/json'; }
  const r = await fetch('/api' + pfad, o);
  let d = {}; try { d = await r.json(); } catch(e){}
  if (!r.ok) throw Object.assign(new Error(d.fehler || ('HTTP ' + r.status)), {status: r.status});
  return d;
}
function zeigeZugang(){
  const da = !!zugang();
  $('fundeOhneCode').style.display = da ? 'none' : 'block';
  $('fundeMitCode').style.display = da ? 'block' : 'none';
  $('meldungenZeile').style.display = da ? 'flex' : 'none';
  $('fab').style.display = da || true ? 'flex' : 'none';
  $('zugangInfo').textContent = da ? 'Zugangscode ist gespeichert.' : 'Kein Zugangscode gespeichert. Eintragen unter Funde.';
  $('zugangVergessen').style.display = da ? 'inline-flex' : 'none';
}
$('zugangKnopf').addEventListener('click', async () => {
  const code = $('zugangFeld').value.trim(), st = $('zugangStatus');
  st.textContent = 'Prüfe …'; st.classList.remove('warn');
  try {
    await api('/anmelden', {method: 'POST', body: {code}});
    merke('pilze.zugang', code); st.textContent = '';
    zeigeZugang(); ladeMeldungen(); ladeFundeListe();
  } catch(e){
    st.textContent = e.status === 403 ? 'Der Code stimmt nicht.' : 'Kein Netz oder Server nicht erreichbar.';
    st.classList.add('warn');
  }
});
$('zugangVergessen').addEventListener('click', () => { merke('pilze.zugang', ''); zeigeZugang(); ladeMeldungen(); });
$('cacheLeeren').addEventListener('click', async () => {
  if (!window.caches) return;
  const ks = await caches.keys();
  await Promise.all(ks.filter(k => k === 'pilze-kacheln' || k === 'pilze-hintergrund').map(k => caches.delete(k)));
  $('cacheLeeren').textContent = 'Gelöscht';
});

// ---------------------------------------------------------------- Fund melden
// Der Fundort ist die Kartenmitte unter dem Fadenkreuz: die Karte schieben,
// bis das Kreuz auf dem Ort liegt. Das trifft am Telefon besser als ein Tipp.
function beginneMelden(){
  if (!zugang()){ location.hash = '#funde'; $('zugangStatus').textContent = 'Zum Melden braucht es den Zugangscode.'; return; }
  melden = true;
  $('app').classList.add('melden');
  if (mobil()) setzeRaste(2);
  if (map.getZoom() < 11) map.setZoom(12);
}
function beendeMelden(){
  melden = false;
  $('app').classList.remove('melden');
  if (location.hash === '#melden') location.hash = '#karte';
}
$('fab').addEventListener('click', () => { location.hash = '#melden'; });
$('fundeMelden').addEventListener('click', () => { location.hash = '#melden'; });
$('meldeAbbruch').addEventListener('click', beendeMelden);
$('ortGps').addEventListener('click', () => {
  if (!navigator.geolocation){ $('meldeAnleitung').textContent = 'Kein Standort verfügbar.'; return; }
  $('meldeAnleitung').textContent = 'Suche Standort …';
  navigator.geolocation.getCurrentPosition(p => {
    map.setView([p.coords.latitude, p.coords.longitude], Math.max(map.getZoom(), 15));
    $('meldeAnleitung').textContent = 'Standort gefunden. Bei Bedarf nachschieben, dann „Hier ist es“.';
  }, () => { $('meldeAnleitung').textContent = 'Kein Standort verfügbar. Karte von Hand schieben.'; },
  {enableHighAccuracy: true, timeout: 10000});
});
function heute(){ const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); }
let meldeOrt = null;
$('ortHier').addEventListener('click', () => {
  meldeOrt = map.getCenter();
  const sel = $('meldeArt');
  if (!sel.options.length) namen.forEach(n => { const o = document.createElement('option'); o.value = n; o.textContent = titel(n); sel.appendChild(o); });
  sel.value = art;
  $('meldeDatum').value = heute();
  $('meldeName').value = lies('pilze.name') || '';
  $('meldeOrt').textContent = 'Fundort ' + meldeOrt.lat.toFixed(4) + ', ' + meldeOrt.lng.toFixed(4);
  $('meldeFehler').textContent = '';
  $('meldeDialog').showModal();
});
$('meldeSchliessen').addEventListener('click', () => $('meldeDialog').close());
$('meldeForm').addEventListener('submit', async e => {
  e.preventDefault();
  const fund = {
    id: crypto.randomUUID ? crypto.randomUUID() : 'f-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10),
    art: $('meldeArt').value, lat: +meldeOrt.lat.toFixed(6), lon: +meldeOrt.lng.toFixed(6),
    datum: $('meldeDatum').value, name: $('meldeName').value.trim(), notiz: $('meldeNotiz').value.trim(),
    anzahl: $('meldeAnzahl').value || null};
  if (!fund.name){ $('meldeFehler').textContent = 'Bitte einen Namen eintragen.'; return; }
  merke('pilze.name', fund.name);
  $('meldeSpeichern').disabled = true;
  const ergebnis = await sende(fund);
  $('meldeSpeichern').disabled = false;
  if (ergebnis === 'abgelehnt') return;
  $('meldeNotiz').value = ''; $('meldeAnzahl').value = '';
  $('meldeDialog').close();
  beendeMelden();
  if (fund.art !== art) waehleArt(fund.art); else ladeMeldungen();
  ladeFundeListe();
});
function warteschlange(){ try { return JSON.parse(lies('pilze.warteschlange') || '[]'); } catch(e){ return []; } }
function setzeWarteschlange(q){ merke('pilze.warteschlange', JSON.stringify(q)); }
async function sende(fund){
  try { await api('/funde', {method: 'POST', body: fund}); zeigeMeldeStatus('Fund gespeichert.'); return 'ok'; }
  catch(e){
    if (e.status === 400 || e.status === 403){ $('meldeFehler').textContent = 'Abgelehnt: ' + e.message; return 'abgelehnt'; }
    const q = warteschlange(); q.push(fund); setzeWarteschlange(q);
    zeigeMeldeStatus('Kein Netz. Der Fund wartet und geht raus, sobald wieder Netz da ist.', true);
    return 'wartet';
  }
}
async function leereWarteschlange(){
  const q = warteschlange();
  if (!q.length || !zugang()) return;
  const rest = [];
  for (const f of q){ try { await api('/funde', {method: 'POST', body: f}); } catch(e){ if (e.status !== 400) rest.push(f); } }
  setzeWarteschlange(rest);
  zeigeMeldeStatus(rest.length < q.length ? 'Wartende Funde sind raus.' : '');
  if (rest.length < q.length){ ladeMeldungen(); ladeFundeListe(); }
}
function zeigeMeldeStatus(text, warn){
  const el = $('meldeStatus'), q = warteschlange().length;
  el.textContent = (text || '') + (q ? ' ' + q + (q === 1 ? ' Fund wartet auf Netz.' : ' Funde warten auf Netz.') : '');
  el.classList.toggle('warn', !!warn || q > 0);
}
addEventListener('online', leereWarteschlange);

// Gemeldete Funde auf der Karte
let meldungenEbene = null, zeigeFundId = null;
const fundIkon = L.divIcon({className: 'fundmarke', iconSize: [14, 14]});
function fundPopup(f){
  const box = document.createElement('div');
  const kopf = document.createElement('b'); kopf.textContent = titel(f.art); box.appendChild(kopf);
  [f.datum + (f.anzahl ? ', ' + f.anzahl + ' Stück' : ''), 'gemeldet von ' + f.name].concat(f.notiz ? [f.notiz] : [])
    .forEach(t => { const p = document.createElement('div'); p.textContent = t; box.appendChild(p); });
  const weg = document.createElement('button'); weg.className = 'knopf klein'; weg.textContent = 'löschen';
  weg.addEventListener('click', async () => {
    if (!confirm('Diesen Fund löschen?')) return;
    try { await api('/funde/' + f.id, {method: 'DELETE'}); map.closePopup(); ladeMeldungen(); ladeFundeListe(); }
    catch(e){ weg.textContent = 'ging nicht: ' + e.message; }
  });
  box.appendChild(weg);
  return box;
}
async function ladeMeldungen(){
  if (meldungenEbene){ map.removeLayer(meldungenEbene); meldungenEbene = null; }
  $('meldungenZahl').textContent = '';
  if (!zugang() || !$('meldungen').checked || modus !== 'aus') return;
  let d;
  try { d = await api('/funde?art=' + art); }
  catch(e){ if (e.status === 403){ merke('pilze.zugang', ''); zeigeZugang(); zeigeMeldeStatus('Der Zugangscode gilt nicht mehr.', true); } return; }
  const g = L.layerGroup();
  d.funde.forEach(f => {
    const m = L.marker([f.lat, f.lon], {icon: fundIkon}).bindPopup(() => fundPopup(f)).addTo(g);
    if (f.id === zeigeFundId){ zeigeFundId = null; setTimeout(() => m.openPopup(), 50); }
  });
  meldungenEbene = g.addTo(map);
  $('meldungenZahl').textContent = '(' + d.funde.length + ')';
}
$('meldungen').addEventListener('change', ladeMeldungen);

// Die Liste aller gemeldeten Funde
let fundFilter = '', alleFunde = [];
baueChips('fundChips', true, '', (slug, chip) => {
  fundFilter = slug;
  [...$('fundChips').children].forEach(c => c.classList.toggle('aktiv', c === chip));
  zeichneFundeListe();
});
$('nurMeine').addEventListener('change', zeichneFundeListe);
async function ladeFundeListe(){
  if (!zugang() || seite !== 'funde') return;
  try { alleFunde = (await api('/funde')).funde; } catch(e){ return; }
  zeichneFundeListe();
}
function zeichneFundeListe(){
  const ul = $('fundliste'); ul.innerHTML = '';
  const meiner = lies('pilze.name') || '';
  const liste = alleFunde.filter(f => (!fundFilter || f.art === fundFilter) && (!$('nurMeine').checked || f.name === meiner));
  $('fundeLeer').style.display = liste.length ? 'none' : 'block';
  liste.forEach(f => {
    const li = document.createElement('li');
    const punkt = document.createElement('span'); punkt.className = 'punkt';
    const text = document.createElement('div'); text.className = 'text';
    const b = document.createElement('b'); b.textContent = titel(f.art);
    const s = document.createElement('span'); s.textContent = f.datum + (f.anzahl ? ' · ' + f.anzahl + ' Stück' : '') + ' · ' + f.name;
    text.appendChild(b); text.appendChild(s);
    if (f.notiz){ const n = document.createElement('span'); n.className = 'notiz'; n.textContent = f.notiz; text.appendChild(n); }
    li.appendChild(punkt); li.appendChild(text);
    li.addEventListener('click', () => {
      zeigeFundId = f.id;
      if (f.art !== art) waehleArt(f.art);
      location.hash = '#karte';
      map.setView([f.lat, f.lon], Math.max(map.getZoom(), 13));
      if (f.art === art) ladeMeldungen();
    });
    ul.appendChild(li);
  });
}

// ---------------------------------------------------------------- Arten
function funke(saison, gross){
  const w = gross ? 300 : 84, h = gross ? 70 : 34, spitze = Math.max(1, ...saison);
  const pts = saison.map((v, i) => [(i / 51) * w, h - 2 - (v / spitze) * (h - 6)]);
  const pfad = 'M0,' + h + ' ' + pts.map(p => 'L' + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ') + ' L' + w + ',' + h + ' Z';
  const monate = [0, 9, 18, 27, 36, 44].map(k => '<line x1="' + (k / 51 * w).toFixed(1) + '" y1="0" x2="' + (k / 51 * w).toFixed(1) + '" y2="' + h + '"/>').join('');
  return '<svg class="funke' + (gross ? ' gross' : '') + '" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none">' + monate + '<path d="' + pfad + '"/></svg>';
}
function baueArten(filter){
  const raster = $('raster'); raster.innerHTML = '';
  const f = (filter || '').trim().toLowerCase();
  KATALOG.filter(k => !f || (k.name + ' ' + k.latein + ' ' + k.gruppe + ' ' + k.baeume.join(' ')).toLowerCase().includes(f))
    .forEach(k => {
      const a = document.createElement('a'); a.className = 'artkarte'; a.href = '#arten/' + k.slug;
      const tags = k.baeume.slice(0, 3).map(b => '<span class="tag">' + b + '</span>').join('')
        + (k.schutz.startsWith('Besonders') ? '<span class="tag schutz">geschützt</span>' : '')
        + (k.peak ? '<span class="tag">Spitze KW ' + k.peak + '</span>' : '');
      a.innerHTML = '<div class="text"><b></b><i></i><div class="tags">' + tags + '</div></div>' + funke(k.saison, false);
      a.querySelector('b').textContent = k.name; a.querySelector('i').textContent = k.latein;
      raster.appendChild(a);
    });
}
$('suche').addEventListener('input', () => baueArten($('suche').value));
function zeigeArt(slug){
  const k = KAT[slug];
  $('artenListe').style.display = k ? 'none' : 'block';
  $('artDetail').style.display = k ? 'block' : 'none';
  if (!k) return;
  const d = $('artDetail');
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  d.innerHTML = '';
  const z = el('a', 'zurueck', '← alle Arten'); z.href = '#arten'; d.appendChild(z);
  d.appendChild(el('h1', null, k.name));
  d.appendChild(el('div', 'latein', k.latein + ' · ' + k.gruppe));
  const kurz = el('p', 'hinweis', k.kurz); kurz.style.cssText = 'font-size:14px;color:var(--ink);margin-top:8px'; d.appendChild(kurz);
  const knopf = el('button', 'knopf haupt breit', 'Auf der Karte zeigen'); knopf.type = 'button';
  knopf.addEventListener('click', () => { waehleArt(k.slug); location.hash = '#karte'; }); d.appendChild(knopf);
  const block = (titel_, inhalt) => { const b = el('div', 'block'); b.style.marginTop = '18px'; b.appendChild(el('h2', null, titel_)); b.appendChild(inhalt); d.appendChild(b); };
  const sw = el('div'); sw.innerHTML = funke(k.saison, true);
  sw.appendChild(el('p', 'hinweis', (k.funde ? k.funde + ' Funde' : '') + (k.peak ? ', Spitze KW ' + k.peak : '') + ', Januar bis Dezember'));
  block('Saison in den Daten', sw);
  const ul = el('ul'); k.erkennen.forEach(t => ul.appendChild(el('li', null, t))); block('Erkennen', ul);
  block('Wo', el('p', 'hinweis', k.wo));
  const vw = el('ul', 'vw'); k.verwechslung.forEach(v => { const li = el('li'); li.appendChild(el('b', null, v.art)); li.appendChild(document.createTextNode(v.merkmal)); vw.appendChild(li); });
  block('Verwechslung', vw);
  block('Schutz und Sammeln', el('p', 'hinweis', k.schutz));
  const links = el('p', 'hinweis');
  k.links.forEach((l, i) => { const a = el('a', null, l.titel); a.href = l.url; a.target = '_blank'; a.rel = 'noopener'; if (i) links.appendChild(document.createTextNode(' · ')); links.appendChild(a); });
  links.appendChild(document.createTextNode(' · '));
  const psv = el('a', null, 'Pilzberatung finden'); psv.href = 'https://www.dgfm-ev.de/pilzsachverstaendige'; psv.target = '_blank'; psv.rel = 'noopener'; links.appendChild(psv);
  block('Weiterlesen', links);
  $('inhalt').scrollTop = 0;
}
baueArten('');

// ---------------------------------------------------------------- Blatt am Telefon
const panel = $('panel'), griff = $('griff');
let rasten = [0, 0, 0], raste = 1, ziehStart = null, wegStart = 0;
function berechneRasten(){
  if (!mobil()) return;
  const h = panel.offsetHeight, kopf = griff.offsetHeight + $('zeit').offsetHeight;
  rasten = [0, Math.round(h * 0.55), Math.max(0, h - kopf)];
  setzeRaste(raste);
}
function setzeRaste(i){
  raste = Math.max(0, Math.min(2, i));
  panel.style.setProperty('--weg', rasten[raste] + 'px');
}
griff.addEventListener('pointerdown', e => { if (!mobil()) return; ziehStart = e.clientY; wegStart = rasten[raste]; panel.classList.add('zieht'); griff.setPointerCapture(e.pointerId); });
griff.addEventListener('pointermove', e => { if (ziehStart === null) return; panel.style.setProperty('--weg', Math.max(0, wegStart + e.clientY - ziehStart) + 'px'); });
const ziehEnde = e => {
  if (ziehStart === null) return;
  const dy = e.clientY - ziehStart, weg = wegStart + dy; ziehStart = null; panel.classList.remove('zieht');
  let ziel = 0, naeh = Infinity;
  rasten.forEach((r, i) => { const d = Math.abs(r - weg); if (d < naeh){ naeh = d; ziel = i; } });
  if (dy < -40) ziel = Math.min(ziel, raste - 1);
  if (dy > 40) ziel = Math.max(ziel, raste + 1);
  if (Math.abs(dy) < 6) ziel = raste === 0 ? 2 : 0;
  setzeRaste(ziel);
};
griff.addEventListener('pointerup', ziehEnde); griff.addEventListener('pointercancel', ziehEnde);
addEventListener('resize', berechneRasten);

// ---------------------------------------------------------------- Seiten
function zeigeSeite(name){
  seite = name;
  document.querySelectorAll('.seite').forEach(s => s.classList.toggle('aktiv', s.dataset.seite === name));
  document.querySelectorAll('.nav a').forEach(a => a.classList.toggle('aktiv', a.dataset.seite === name));
  if (mobil()) setzeRaste(name === 'karte' ? 1 : 0);
  if (name !== 'karte') stoppe();
  if (name === 'karte') requestAnimationFrame(markiereLeiste);   // erst sichtbar, dann messbar
  if (name === 'funde'){ zeigeZugang(); zeigeMeldeStatus(); ladeFundeListe(); }
  if (name === 'info') zeigeZugang();
  $('inhalt').scrollTop = 0;
}
function route(){
  const h = location.hash.replace(/^#/, '') || 'karte';
  const [name, rest] = h.split('/');
  if (name === 'melden'){ zeigeSeite('karte'); beginneMelden(); return; }
  if (melden) beendeMelden();
  if (name === 'arten'){ zeigeSeite('arten'); zeigeArt(rest || ''); return; }
  zeigeSeite(['karte', 'funde', 'info'].includes(name) ? name : 'karte');
}
addEventListener('hashchange', route);

// ---------------------------------------------------------------- Start
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
zeigeZugang();
zeigeMeldeStatus();
berechneRasten();
requestAnimationFrame(() => requestAnimationFrame(() => { berechneRasten(); map.invalidateSize({animate: false}); passeEin(); }));
// Nach dem Verschieben des Blatts steht die Karte erst fest.
setTimeout(() => { map.invalidateSize({animate: false}); passeEin(); }, 400);
(function start(){
  const satz = SPECIES[art];
  woche = satz.weeks.length - 1;
  $('top').textContent = 'Höchstwert ' + satz.top.toFixed(2).replace('.', ',');
  baueLeiste();
  zeige(woche);
  vorladenReihe(satz, woche, 6);
  ladeMeldungen();
  route();
  leereWarteschlange();
})();
})();
