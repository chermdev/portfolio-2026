import { translate, type Locale } from '@portfolio/i18n';
export async function initSculpture(container: HTMLElement) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { container.querySelector('[data-pause]')?.remove(); return; }
  const THREE = await import('three');
  const { RoomEnvironment } = await import('three/addons/environments/RoomEnvironment.js');
  const { gsap } = await import('gsap');
  const canvas = container.querySelector('canvas')!;
  let renderer: InstanceType<typeof THREE.WebGLRenderer>;
  try { renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power', preserveDrawingBuffer: true }); }
  catch { container.querySelector('[data-pause]')?.remove(); return; }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.3;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
  camera.position.set(0, 0, 9.6);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, 0.04);
  scene.environment = environment.texture;
  room.dispose();
  const material = new THREE.MeshPhysicalMaterial({ color: 0xcbd4d4, metalness: 1, roughness: 0.19, clearcoat: 1, clearcoatRoughness: 0.12, iridescence: 0.14, iridescenceIOR: 1.3 });
  const geometry = new THREE.TorusKnotGeometry(1.5, 0.43, 240, 40, 2, 3);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.set(0.3, -0.4, -0.35);
  scene.add(mesh, new THREE.HemisphereLight(0xf0e8ff, 0x687e71, 1.4));
  const key = new THREE.DirectionalLight(0xffffff, 3); key.position.set(3, 5, 5); scene.add(key);
  let width = 1;
  const resize = new ResizeObserver(entries => { width = entries[0].contentRect.width; renderer.setSize(width, width, false); renderer.render(scene, camera); });
  resize.observe(container);
  let paused = false, visible = true, frame = 0, time = 0, last = performance.now();
  let targetX = 0, targetY = 0, pointerX = 0, pointerY = 0;
  const base = { y: -1.2 };
  gsap.to(base, { y: -0.4, duration: 1.6, ease: 'power3.out' });
  const render = (now: number) => {
    const delta = Math.min((now - last) / 1000, 0.05); last = now;
    if (!paused) time += delta;
    pointerX += (targetX - pointerX) * 0.035; pointerY += (targetY - pointerY) * 0.035;
    mesh.rotation.y = base.y + Math.sin(time * 0.2) * 0.18 + pointerX * 0.4;
    mesh.rotation.x = 0.3 + pointerY * 0.25; mesh.position.y = Math.sin(time * 0.65) * 0.06;
    renderer.render(scene, camera); container.setAttribute('data-ready', 'true');
    if (visible && !document.hidden && !paused) frame = requestAnimationFrame(render);
  };
  const restart = () => { cancelAnimationFrame(frame); last = performance.now(); if (visible && !document.hidden) frame = requestAnimationFrame(render); };
  const visibility = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; restart(); }, { threshold: 0.05 }); visibility.observe(container);
  container.addEventListener('pointermove', (event: PointerEvent) => { if (event.pointerType !== 'mouse' || paused) return; const bounds = container.getBoundingClientRect(); targetX = (event.clientX - bounds.left) / width - 0.5; targetY = (event.clientY - bounds.top) / width - 0.5; });
  container.addEventListener('pointerleave', () => { targetX = targetY = 0; });
  const pause = container.querySelector<HTMLButtonElement>('[data-pause]')!;
  const syncPauseIcons = () => {
    pause.querySelector('[data-pause-icon]')?.classList.toggle('hidden', paused);
    pause.querySelector('[data-play-icon]')?.classList.toggle('hidden', !paused);
  };
  pause.addEventListener('click', () => { paused = !paused; syncPauseIcons(); pause.setAttribute('aria-label', translate(paused ? 'Play sculpture animation' : 'Pause sculpture animation', document.documentElement.lang as Locale)); pause.setAttribute('aria-pressed', String(paused)); restart(); });
  document.addEventListener('visibilitychange', restart);
  const appearance = () => { renderer.toneMappingExposure = document.documentElement.classList.contains('dark') ? 1.6 : 1.3; restart(); }; window.addEventListener('themechange', appearance);
  const controls = document.querySelector<HTMLSelectElement>('[data-material]');
  controls?.addEventListener('change', () => { material.wireframe = controls.value === 'wireframe'; material.metalness = controls.value === 'pearl' ? 0.05 : 1; material.roughness = controls.value === 'pearl' ? 0.3 : 0.19; restart(); });
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  reduced.addEventListener('change', () => { paused = reduced.matches; syncPauseIcons(); pause.setAttribute('aria-pressed', String(paused)); pause.setAttribute('aria-label', translate(paused ? 'Play sculpture animation' : 'Pause sculpture animation', document.documentElement.lang as Locale)); restart(); });
  window.addEventListener('pagehide', () => { cancelAnimationFrame(frame); resize.disconnect(); visibility.disconnect(); document.removeEventListener('visibilitychange', restart); window.removeEventListener('themechange', appearance); geometry.dispose(); material.dispose(); environment.dispose(); pmrem.dispose(); renderer.dispose(); }, { once: true });
  appearance();
}
