// A ready-made sample home so the app opens with something realistic to explore.
import { uid } from './state.js';

export function sampleHouse() {
  const objects = [];
  const wall = (x1, y1, x2, y2, kind = 'exterior') => {
    const w = { id: uid(), type: 'wall', level: 0, x1, y1, x2, y2, kind, thickness: kind === 'interior' ? 0.12 : 0.25, height: 3, finish: 'plaster', color: '#ece3d3', innerColor: '#f4f1ea' };
    objects.push(w);
    return w;
  };
  const opening = (w, props) => objects.push({ id: uid(), level: 0, wallId: w.id, ...props });
  const door = (w, t, style, extra = {}) => opening(w, { type: 'door', t, style, width: 0.9, height: 2.1, open: 25, color: '#8a5a33', frameColor: '#f4f1ea', ...extra });
  const win = (w, t, style, extra = {}) => opening(w, { type: 'window', t, style, width: 1.2, height: 1.3, sill: 0.9, frameColor: '#f7f5f0', ...extra });
  const item = (props) => objects.push({ id: uid(), level: 0, rot: 0, z: 0, ...props });

  // shell (front of the house faces +y / south)
  const back = wall(0, 0, 12, 0), right = wall(12, 0, 12, 9), front = wall(12, 9, 0, 9), left = wall(0, 9, 0, 0);
  const mid = wall(7, 0, 7, 9, 'interior'), bedSplit = wall(7, 4.5, 12, 4.5, 'interior');

  door(front, 8.5, 'double', { width: 1.6, height: 2.3, open: 20, color: '#5a3a22' });
  win(front, 6.4, 'picture', { width: 1.6, height: 1.6, sill: 0.6, frameColor: '#2f343b' });
  win(front, 4.0, 'casement', { width: 1.0 });
  door(back, 4.2, 'sliding', { width: 2.2, height: 2.2, open: 0, color: '#3a3f47', frameColor: '#3a3f47' });
  win(back, 1.6, 'casement', { width: 1.2, height: 1.0, sill: 1.1 });
  win(back, 11, 'casement', { width: 1.0 });
  win(right, 2.25, 'sliding', { width: 1.6, height: 1.2, frameColor: '#3a3f47' });
  win(right, 6.75, 'sliding', { width: 1.6, height: 1.2, frameColor: '#3a3f47' });
  win(left, 2.5, 'casement', { width: 1.4 });
  win(left, 6.5, 'casement', { width: 1.2, height: 1.0, sill: 1.1 });
  door(mid, 3.3, 'single', { flip: true, open: 60 });
  door(mid, 8.2, 'single', { flip: true, open: 60 });

  // floors
  item({ type: 'floor', x: 6, y: 4.5, w: 12, d: 9, finish: 'wood', color: '#ffffff' });
  item({ type: 'floor', x: 3.5, y: 2.0, w: 7, d: 4, z: 0.006, finish: 'tile', color: '#ffffff' });
  item({ type: 'floor', x: 9.5, y: 2.25, w: 5, d: 4.5, z: 0.006, finish: 'carpet', color: '#c9c2b8' });
  item({ type: 'floor', x: 9.5, y: 6.75, w: 5, d: 4.5, z: 0.006, finish: 'carpet', color: '#b9c4cc' });

  // roof & entrance
  item({ type: 'roof', style: 'hip', x: 6, y: 4.5, w: 12.25, d: 9.25, z: 3, pitch: 24, overhang: 0.6, finish: 'clay', color: '#b9583a', gableColor: '#efe8dc' });
  item({ type: 'portico', x: 3.5, y: 10.225, w: 3.6, d: 2.2, h: 3, columns: 4, style: 'pediment', steps: true, color: '#f6f3ec', roofColor: '#7a4a35' });

  // parking & paths
  item({ type: 'carport', x: 15.2, y: 6, w: 3.6, d: 6, h: 2.6, withCar: true, carColor: '#8a1c1c', color: '#3d4148', roofColor: '#9aa1a9' });
  item({ type: 'paving', x: 15.2, y: 12.75, w: 3.6, d: 7.5, finish: 'pavers' });
  item({ type: 'paving', x: 6, y: 19.5, w: 34, d: 6, finish: 'asphalt' });
  item({ type: 'paving', x: 3.5, y: 13.6, w: 1.4, d: 5.8, finish: 'flagstone' });
  item({ type: 'car', x: 6, y: 18.2, w: 4.5, d: 1.85, color: '#1d4e89' });

  // backyard
  item({ type: 'paving', x: 4.2, y: -1.65, w: 5, d: 3, finish: 'pavers' });
  item({ type: 'gazebo', x: 2.5, y: -6.6, w: 4, d: 4, h: 2.4, sides: 8, color: '#f2ede4', roofColor: '#5d6168' });
  item({ type: 'pool', x: 9.6, y: -6.2, w: 7, d: 3.5, color: '#3fa7cf' });
  item({ type: 'fence', x: 6, y: -11, w: 30, d: 0.12, h: 1.2, style: 'picket', color: '#f5f2ea' });

  // landscaping
  item({ type: 'tree', x: -4.5, y: 2, w: 5, d: 5, h: 7, variety: 'round' });
  item({ type: 'tree', x: -5, y: -7, w: 3.2, d: 3.2, h: 8, variety: 'conifer' });
  item({ type: 'tree', x: 19.5, y: -5, w: 5.5, d: 5.5, h: 7.5, variety: 'round' });
  item({ type: 'tree', x: -3.5, y: 13.5, w: 4.5, d: 4.5, h: 6, variety: 'round' });
  item({ type: 'tree', x: 10.5, y: 14, w: 3.5, d: 3.5, h: 6.5, variety: 'palm' });
  item({ type: 'tree', x: 20.5, y: 3, w: 3, d: 3, h: 7, variety: 'conifer' });
  for (const x of [1.0, 6.3, 8.5, 11.0]) item({ type: 'shrub', x, y: 9.85, w: 1.0, d: 1.0, h: 0.9, color: '#4f7f3a' });
  item({ type: 'lamp', x: 2.3, y: 15.6, w: 0.4, d: 0.4, h: 2.6 });
  item({ type: 'lamp', x: 13.0, y: 15.6, w: 0.4, d: 0.4, h: 2.6 });

  // furniture
  item({ type: 'kitchen', x: 1.6, y: 0.44, w: 2.6, d: 0.62, color: '#f2f0eb' });
  item({ type: 'table', x: 3.6, y: 2.4, w: 1.8, d: 0.9, color: '#9c6b3f' });
  item({ type: 'sofa', x: 6.35, y: 6.1, rot: 90, w: 2.2, d: 0.95, color: '#7d8a99' });
  item({ type: 'bed', x: 9.5, y: 1.2, w: 1.8, d: 2.1, color: '#4a6b8a' });
  item({ type: 'bed', x: 9.5, y: 7.8, rot: 180, w: 1.6, d: 2.1, color: '#8a5a4a' });

  return { version: 1, name: 'Sample family home', units: 'm', levels: [{ name: 'Ground Floor', height: 3 }], objects };
}
