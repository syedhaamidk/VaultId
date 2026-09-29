/**
 * SideRays — WebGL god-ray effect
 *
 * Original by the provided codebase (OGL renderer).
 * Ported to Three.js r165 so no extra OGL dependency is needed.
 * The GLSL shader is identical to the original.
 */
import { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import './SideRays.css';

// ── GLSL shaders ─────────────────────────────────────────────────────────────
const VERT = /* glsl */ `
  void main() {
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

// precision removed — Three.js prepends it automatically
const FRAG = /* glsl */ `
  uniform float iTime;
  uniform vec2  iResolution;
  uniform float iSpeed;
  uniform vec3  iRayColor1;
  uniform vec3  iRayColor2;
  uniform float iIntensity;
  uniform float iSpread;
  uniform float iFlipX;
  uniform float iFlipY;
  uniform float iTilt;
  uniform float iSaturation;
  uniform float iBlend;
  uniform float iFalloff;
  uniform float iOpacity;

  float rayStrength(vec2 raySource, vec2 rayRefDirection, vec2 coord,
                    float seedA, float seedB, float speed) {
    vec2  sourceToCoord = coord - raySource;
    float cosAngle = dot(normalize(sourceToCoord), rayRefDirection);
    return clamp(
        (0.45 + 0.15 * sin(cosAngle * seedA + iTime * speed)) +
        (0.30 + 0.20 * cos(-cosAngle * seedB + iTime * speed)),
        0.0, 1.0) *
      clamp((iResolution.x - length(sourceToCoord)) / iResolution.x, 0.5, 1.0);
  }

  void main() {
    vec2 fragCoord = gl_FragCoord.xy;
    if (iFlipX > 0.5) fragCoord.x = iResolution.x - fragCoord.x;
    if (iFlipY > 0.5) fragCoord.y = iResolution.y - fragCoord.y;

    vec2 coord  = vec2(fragCoord.x, iResolution.y - fragCoord.y);
    vec2 rayPos = vec2(iResolution.x * 1.1, -0.5 * iResolution.y);

    float tiltRad = iTilt * 3.14159265 / 180.0;
    float cs = cos(tiltRad), sn = sin(tiltRad);
    vec2  rel         = coord - rayPos;
    vec2  tiltedCoord = vec2(rel.x * cs - rel.y * sn, rel.x * sn + rel.y * cs) + rayPos;

    float halfSpread = iSpread * 0.275;
    vec2  rayRefDir1 = normalize(vec2(cos(0.785398 + halfSpread), sin(0.785398 + halfSpread)));
    vec2  rayRefDir2 = normalize(vec2(cos(0.785398 - halfSpread), sin(0.785398 - halfSpread)));

    vec4 rays1 = vec4(iRayColor1, 1.0) *
                 rayStrength(rayPos, rayRefDir1, tiltedCoord, 36.2214, 21.11349, iSpeed);
    vec4 rays2 = vec4(iRayColor2, 1.0) *
                 rayStrength(rayPos, rayRefDir2, tiltedCoord, 22.3991, 18.0234,  iSpeed * 0.2);

    vec4 color = rays1 * (1.0 - iBlend) * 0.9 + rays2 * iBlend * 0.9;

    float distanceToLight =
      length(fragCoord.xy - vec2(rayPos.x, iResolution.y - rayPos.y)) / iResolution.y;
    float brightness = iIntensity * 0.4 / pow(max(distanceToLight, 0.001), iFalloff);
    color.rgb *= brightness;

    float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    color.rgb  = mix(vec3(gray), color.rgb, iSaturation);

    color.a    = max(color.r, max(color.g, color.b)) * iOpacity;
    gl_FragColor = color;
  }
`;

// ── Helpers ───────────────────────────────────────────────────────────────────
const hexToVec3 = (hex) => {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return m
    ? new THREE.Vector3(parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255)
    : new THREE.Vector3(1, 1, 1);
};

const originToFlip = (origin) => {
  switch (origin) {
    case 'top-left':     return [1, 0];
    case 'bottom-right': return [0, 1];
    case 'bottom-left':  return [1, 1];
    default:             return [0, 0]; // top-right
  }
};

// ── Component ─────────────────────────────────────────────────────────────────
const SideRays = ({
  speed      = 2.5,
  rayColor1  = '#EAB308',
  rayColor2  = '#96c8ff',
  intensity  = 2,
  spread     = 2,
  origin     = 'top-right',
  tilt       = 0,
  saturation = 1.5,
  blend      = 0.75,
  falloff    = 1.6,
  opacity    = 1.0,
  className  = '',
}) => {
  const containerRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  // Intersection observer — pause animation when off-screen
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => setIsVisible(entries[0].isIntersecting),
      { threshold: 0.1 }
    );
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Three.js setup
  useEffect(() => {
    if (!isVisible || !containerRef.current) return;
    const container = containerRef.current;

    // renderer
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    const w = container.clientWidth  || 800;
    const h = container.clientHeight || 600;
    renderer.setSize(w, h);
    const canvas = renderer.domElement;
    canvas.style.position = 'absolute';
    canvas.style.inset    = '0';
    container.appendChild(canvas);

    // scene / camera (orthographic — we do all projection in the vertex shader)
    const scene  = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    // uniforms
    const [flipX, flipY] = originToFlip(origin);
    const uniforms = {
      iTime:       { value: 0 },
      iResolution: { value: new THREE.Vector2(w * renderer.getPixelRatio(), h * renderer.getPixelRatio()) },
      iSpeed:      { value: speed },
      iRayColor1:  { value: hexToVec3(rayColor1) },
      iRayColor2:  { value: hexToVec3(rayColor2) },
      iIntensity:  { value: intensity },
      iSpread:     { value: spread },
      iFlipX:      { value: flipX },
      iFlipY:      { value: flipY },
      iTilt:       { value: tilt },
      iSaturation: { value: saturation },
      iBlend:      { value: blend },
      iFalloff:    { value: falloff },
      iOpacity:    { value: opacity },
    };

    // fullscreen quad — PlaneGeometry(2, 2) fills NDC exactly
    const geometry = new THREE.PlaneGeometry(2, 2);
    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader:   VERT,
      fragmentShader: FRAG,
      transparent:    true,
      depthWrite:     false,
    });
    scene.add(new THREE.Mesh(geometry, material));

    // resize handler
    const onResize = () => {
      const w2 = container.clientWidth;
      const h2 = container.clientHeight;
      renderer.setSize(w2, h2);
      uniforms.iResolution.value.set(
        w2 * renderer.getPixelRatio(),
        h2 * renderer.getPixelRatio()
      );
    };
    window.addEventListener('resize', onResize);

    // animation loop — skip for reduced-motion users (render one frame only)
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) {
      renderer.render(scene, camera);
    } else {
      const t0 = performance.now();
      let rafId;
      const loop = () => {
        rafId = requestAnimationFrame(loop);
        uniforms.iTime.value = (performance.now() - t0) / 1000;
        renderer.render(scene, camera);
      };
      loop();
    }

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', onResize);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    };
  // Re-mount when visibility or key props change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVisible, speed, rayColor1, rayColor2, intensity, spread, origin, tilt, saturation, blend, falloff, opacity]);

  return (
    <div
      ref={containerRef}
      className={`side-rays-container ${className}`.trim()}
    />
  );
};

export default SideRays;
