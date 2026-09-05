import { useRef, useEffect, useState } from "react";
import * as THREE from "three";

const DotsInCircleReveal = ({ imageName = "india.png", bgcolor = "black", dotColor = 0xffffff, heightMap = "100%" }) => {
  const containerRef = useRef(null);
  const rendererRef:any = useRef(null);
  const animationRef:any = useRef(null);

  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("darkMode") === "true";
    }
    setDarkMode(darkMode)
    return false;
  });

  if (darkMode) {
    bgcolor = 'white'
    dotColor = 0x000000; // ✅ numeric, not string
  }

  useEffect(() => {
    const container:any = containerRef.current;
    if (!container) return;
    if (rendererRef.current) return;

    // ✅ WebGL Support Check
    if (!window.WebGLRenderingContext) {
      container.innerHTML =
        "<p style='color:white;text-align:center;margin-top:40vh;'>Your browser does not support WebGL.</p>";
      return;
    }

    const width = container.clientWidth;
    const height = container.clientHeight;

    // ✅ Scene Setup
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.z = 200;

    // ✅ WebGL Renderer
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    } catch (err) {
      console.error("⚠️ WebGL initialization failed:", err);
      container.innerHTML =
        "<p style='color:white;text-align:center;margin-top:40vh;'>WebGL initialization failed. Please enable hardware acceleration.</p>";
      return;
    }

    rendererRef.current = renderer;
    renderer.setSize(width, height);
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.style.position = "absolute";
    renderer.domElement.style.top = "0";
    renderer.domElement.style.left = "0";
    renderer.domElement.style.zIndex = "0";
    container.appendChild(renderer.domElement);

    // ✅ Generate random dots inside a circle
    const radius = (Math.min(width, height) / 2);
    const totalDots = 15000;

    const allPositions = new Float32Array(totalDots * 3);
    for (let i = 0; i < totalDots; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * radius;
      allPositions[i * 3] = r * Math.cos(angle);
      allPositions[i * 3 + 1] = r * Math.sin(angle);
      allPositions[i * 3 + 2] = 0;
    }

    // ✅ Randomize reveal order
    const indices = Array.from({ length: totalDots }, (_, i) => i);
    for (let i = totalDots - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }

    // ✅ Geometry Setup
    const geometry = new THREE.BufferGeometry();
    const revealPositions = new Float32Array(totalDots * 3);
    geometry.setAttribute("position", new THREE.BufferAttribute(revealPositions, 3));
    geometry.setDrawRange(0, 0);

    // ✅ Dots Material
    const material = new THREE.PointsMaterial({
      color: Number(dotColor), size: 2.0,
      sizeAttenuation: true,
    });

    const points = new THREE.Points(geometry, material);
    scene.add(points);

    // ✅ Animation with Delay
    let dotsShown = 0;
    const dotsPerFrame = 500;
    const revealDelay = 1000; // ⏱️ Delay in ms before dots start appearing

    const animate = () => {
      if (dotsShown < totalDots) {
        const end = Math.min(dotsShown + dotsPerFrame, totalDots);
        for (let i = dotsShown; i < end; i++) {
          const idx = indices[i];
          revealPositions[i * 3] = allPositions[idx * 3];
          revealPositions[i * 3 + 1] = allPositions[idx * 3 + 1];
          revealPositions[i * 3 + 2] = allPositions[idx * 3 + 2];
        }
        geometry.attributes.position.needsUpdate = true;
        geometry.setDrawRange(0, end);
        dotsShown = end;
      }

      renderer.render(scene, camera);
      animationRef.current = requestAnimationFrame(animate);
    };

    // ✅ Start animation after delay
    const timeout = setTimeout(() => animate(), revealDelay);

    // ✅ Responsive Resize
    const handleResize = () => {
      if (!container) return;
      const newWidth = container.clientWidth;
      const newHeight = container.clientHeight;
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
    };
    window.addEventListener("resize", handleResize);



    // ✅ Cleanup
    return () => {
      clearTimeout(timeout);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      window.removeEventListener("resize", handleResize);
      if (rendererRef.current) {
        rendererRef.current.dispose();
        if (
          rendererRef.current.domElement &&
          container.contains(rendererRef.current.domElement)
        ) {
          container.removeChild(rendererRef.current.domElement);
        }
        rendererRef.current = null;
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        width: "100%",
        height: heightMap,
        overflow: "hidden",
        background: bgcolor,
        opacity:0.4
      }}
    >
      <img
        src={darkMode ? '/state/white' + imageName : "/state/" + imageName}
        alt="India Map"
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          height: "102%",
          width: "auto",
          objectFit: "contain",
          zIndex: 1,
          pointerEvents: "none",
          userSelect: "none",
        }}
        draggable={false}
      />
    </div>
  );
};

export default DotsInCircleReveal;
