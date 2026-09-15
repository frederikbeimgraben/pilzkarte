/** Die Piktogramme aus `artefakte/bauen.py`, ein Pfadinhalt je Name. */
export type IconName =
  | 'map'
  | 'map-off'
  | 'species'
  | 'entries'
  | 'more'
  | 'plus'
  | 'location'
  | 'layers'
  | 'back'
  | 'forward'
  | 'close'
  | 'check'
  | 'zone'
  | 'search'
  | 'warning'
  | 'info'
  | 'compare'
  | 'lock'
  | 'empty'
  | 'image-gap'
  | 'left'
  | 'right'
  | 'play'
  | 'pause'
  | 'cloud'
  | 'drop'
  | 'tree'
  | 'mountain'
  | 'calendar'
  | 'rainfall'
  | 'thermometer'
  | 'frost'
  | 'forest'
  | 'conifer'
  | 'leaf'
  | 'elevation'
  | 'slope'
  | 'compass'
  | 'relief'
  | 'ridge'
  | 'club'
  | 'grains'
  | 'soil-layers'
  | 'trash'
  | 'undo'
  | 'filter'
  | 'camera'
  | 'chevron'
  | 'hourglass';

/** Die drei gefüllten Pfeile und die Wiedergabe sitzen auf einem 12er-Raster. */
export const FILLED_ICONS: readonly IconName[] = ['left', 'right', 'play', 'pause'];

/** Der Inhalt des `<svg>` je Piktogramm, Strich 2 auf Raster 24 ausser den gefüllten. */
export const ICONS: Record<IconName, string> = {
  map: '<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/>',
  'map-off': '<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/><path d="M3 21L21 3"/>',
  species: '<path d="M4 11a8 6 0 0 1 16 0H4z"/><path d="M9 11v7a3 3 0 0 0 6 0v-7"/>',
  entries: '<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  more: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  location:
    '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="8"/>',
  layers: '<path d="M12 4l9 5-9 5-9-5z"/><path d="M3 14l9 5 9-5"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  forward: '<path d="M9 5l7 7-7 7"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  check: '<path d="M5 12l5 5 9-10"/>',
  zone: '<path d="M5 8l7-4 7 5-2 8-8 3-4-6z"/><circle cx="5" cy="8" r="1.5"/><circle cx="12" cy="4" r="1.5"/><circle cx="19" cy="9" r="1.5"/><circle cx="17" cy="17" r="1.5"/><circle cx="9" cy="20" r="1.5"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  warning: '<path d="M12 3.5 2.5 20h19z"/><path d="M12 10v4M12 17.2v.1"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.8v.1"/>',
  compare: '<path d="M4 9h15M16 6l3 3-3 3"/><path d="M20 15H5M8 18l-3-3 3-3"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8.5 11V8a3.5 3.5 0 0 1 7 0v3"/>',
  empty: '<path d="M4 10h16l-1.6 9H5.6z"/><path d="M4 10l4-6M20 10l-4-6"/><path d="M10 13.5v2M14 13.5v2"/>',
  'image-gap':
    '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M6.5 15c0-3 2.5-5.5 5.5-5.5s5.5 2.5 5.5 5.5z"/><path d="M12 15v2.5"/>',
  left: '<path d="M8.5 1.5 3.5 6l5 4.5z"/>',
  right: '<path d="M3.5 1.5 8.5 6l-5 4.5z"/>',
  play: '<path d="M3 1.4 10 6 3 10.6Z"/>',
  pause: '<path d="M2.5 1.5h2.5v9h-2.5zM7 1.5h2.5v9h-2.5z"/>',
  cloud: '<path d="M7 18h10a4 4 0 0 0 0-8 5.5 5.5 0 0 0-10.6 1.5A3.5 3.5 0 0 0 7 18z"/>',
  drop: '<path d="M12 3s6 7 6 11.5a6 6 0 0 1-12 0C6 10 12 3 12 3z"/>',
  tree: '<path d="M12 3l5 7h-3l4 5.5H6L10 10H7z"/><path d="M12 15.5V21"/>',
  mountain: '<path d="M3 19h18L14 7l-3.5 6L8.5 10z"/>',
  calendar:
    '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/><rect x="7" y="13" width="3" height="3" rx="0.6"/>',
  rainfall: '<path d="M3 12h4l3-6 4 12 3-6h4"/>',
  thermometer:
    '<path d="M12 3a2 2 0 0 0-2 2v9.1a4 4 0 1 0 4 0V5a2 2 0 0 0-2-2z"/><circle cx="12" cy="17" r="1.4"/>',
  frost: '<path d="M14 14.2V5.5a2 2 0 1 0-4 0v8.7a3.8 3.8 0 1 0 4 0z"/><path d="M17 4l3 3M20 4l-3 3"/>',
  forest: '<path d="M12 3l4.5 6.5h-2.6L18 15H6l4.1-5.5H7.5z"/><path d="M12 15v5.5"/><path d="M4 20.5h16"/>',
  conifer: '<path d="M12 2.5l3.6 5.4h-2L17 13h-2.2l3 4.5H6.2l3-4.5H7l3.4-5.1h-2z"/><path d="M12 17.5v4"/>',
  leaf: '<path d="M12 21c0-6 1.5-9.5 6-12.5C20 11 19 17 13.5 18.6"/><path d="M12 21c0-4-1-7-5-9"/>',
  elevation: '<path d="M3 19h18"/><path d="M4.5 19l5.5-9 3 4.5 2.5-3.5L20 19"/><path d="M8 10.5h4"/>',
  slope: '<path d="M3.5 19.5h17"/><path d="M4.5 19.5L15 6.5l5.5 13"/><path d="M9 19.5v-3.5h3.5"/>',
  compass: '<path d="M12 2.5l2.2 6.3H21l-5.4 4 2 6.4L12 15.2 6.4 19.2l2-6.4-5.4-4h6.8z"/>',
  relief: '<path d="M3 16c2.5-4 4-4 6.5 0M7 20c3-6 6.5-6 10 0M11 12c1.6-2.6 3.2-2.6 4.8 0"/>',
  ridge: '<path d="M4 18h16"/><path d="M5 18c2-7 5-10 7-10s5 3 7 10"/><circle cx="12" cy="8" r="1.8"/>',
  club: '<path d="M8 3v6.5L4.6 17A3 3 0 0 0 7.3 21h9.4a3 3 0 0 0 2.7-4L16 9.5V3"/><path d="M7 3h10"/><path d="M6.2 14.5h11.6"/>',
  grains:
    '<circle cx="7" cy="9" r="1.4"/><circle cx="13" cy="7.5" r="1"/><circle cx="17.5" cy="10.5" r="1.4"/><circle cx="9.5" cy="14" r="1"/><circle cx="15" cy="15.5" r="1.4"/><path d="M3.5 19.5h17"/>',
  'soil-layers':
    '<path d="M3.5 9.5h17"/><path d="M4 13h16M4.5 16.5h15"/><path d="M9 9.5c0-3 1.5-5 3-6 1.5 1 3 3 3 6"/>',
  trash:
    '<path d="M5 7h14"/><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/><path d="M7 7l1 13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l1-13"/><path d="M10 11v6M14 11v6"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
  filter:
    '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2.2"/><circle cx="10" cy="17" r="2.2"/>',
  camera:
    '<path d="M4 8a1 1 0 0 1 1-1h2l1.5-2h7L17 7h2a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z"/><circle cx="12" cy="13" r="3.5"/>',
  chevron: '<path d="M9 5l7 7-7 7"/>',
  hourglass: '<path d="M6 3h12M6 21h12M8 3v4l4 5 4-5V3M8 21v-4l4-5 4 5v4"/>',
};
