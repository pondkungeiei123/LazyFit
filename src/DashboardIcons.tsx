const paths = {
  overview: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  food: 'M5 3v6c0 3 5 3 5 0V3 M7.5 3v18 M18 3c-3 3-4 8-3 10h4 M19 3v18',
  exercise: 'M2 9v6 M5 6v12 M8 9v6 M8 12h8 M16 9v6 M19 6v12 M22 9v6',
  health: 'M12 21 4 13c-5-6 2-13 8-7 6-6 13 1 8 7z M5 12h4l2-3 3 6 2-3h3',
  settings: 'M3 6h8m4 0h6 M3 12h2m4 0h12 M3 18h12m4 0h2 M11 3v6 M6 9v6 M16 15v6',
  flame: 'M14 2c2 6-4 7-1 11 2 0 4-2 4-5 6 7 4 14-5 14-7 0-11-6-6-12 0 3 1 4 3 4-2-5 3-7 5-12z',
  target: 'M20 12a8 8 0 1 1-8-8 M16 12a4 4 0 1 1-4-4 M12 12l8-8 M17 4h3v3',
  steps: 'M8 3c-3 0-4 6-2 9l4-1c1-4 0-8-2-8z M6 15l4-1 1 3c-2 3-4 2-5-2z M17 6c-2 0-4 4-3 8l4 2c3-4 3-9-1-10z M14 17l4 2c-1 4-5 3-4-2z',
  weight: 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z M7 8q5-5 10 0l-3 4h-4z M12 10l2-3',
  waist: 'M4 8c0-5 14-5 14 0s-14 5-14 0z M4 8v7c0 4 10 5 14 2l3-2v-5l-4 2 M8 14v3 M12 14v4',
  level: 'm12 2 2.8 6 6.5 1-4.7 4.6 1.1 6.5-5.7-3.1-5.7 3.1 1.1-6.5L2.7 9l6.5-1z',
  sleep: 'M20 15A8 8 0 0 1 9 4a9 9 0 1 0 11 11z',
  streak: 'm13 2-9 12h7l-1 8 10-13h-7z',
  calendar: 'M4 6h16v15H4z M8 3v5 M16 3v5 M4 10h16 M8 14h2 M14 14h2',
  screen: 'M3 4h18v13H3z M8 21h8 M12 17v4',
  leaf: 'M4 16c0-8 6-12 16-12 0 11-5 17-13 14 M4 21l11-12',
  plus: 'M12 5v14 M5 12h14',
  arrow:'M5 12h14 M14 7l5 5-5 5',
  chart:'M4 3v17h17 M7 14l4-4 4 2 5-7',
}
export type IconName = keyof typeof paths
export function DashIcon({name}: {name:IconName}) {
  return <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round"><path d={paths[name]}/></svg>
}
