/**
 * Keeps the camera and renderer matched to the window. `onResize(w, h)`
 * lets other parts (e.g. post-processing) follow along.
 */
export function handleResize(renderer, camera, onResize = () => {}) {
  const resize = () => {
    const width = window.innerWidth;
    const height = window.innerHeight;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height, false);
    onResize(width, height);
  };

  window.addEventListener('resize', resize);
  return () => window.removeEventListener('resize', resize);
}
