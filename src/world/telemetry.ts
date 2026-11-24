// estado mutavel compartilhado entre a cena e o HUD: evita re-render do React a 60fps
export const telemetry = {
  // home: tela inicial com voo pelo canion · shot: o tiro de 2000 m · train: escola de tiro
  mode: 'home' as 'home' | 'shot' | 'train' | 'calc' | 'about',
  p: 0, // progresso suavizado do scroll, 0..1
  s: 0, // distancia percorrida pela bala, em metros
  ready: false, // shaders compilados, cena pronta para aparecer
  scope: 0, // 0..1: quanto da visao esta dentro da luneta
  homeAlt: 0, // altitude do voo da tela inicial
  homeFade: 0 // escurece nas pontas do voo para o recomeco nao aparecer
}
