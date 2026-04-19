/* The Lattice — sphere renderer
 * Pure canvas 2D. Projects lat/lon onto a rotating sphere.
 * Renders: graticule, pulses, arcs, near-miss ghosts, equator, atmosphere.
 */

(function(){
  "use strict";

  const D = window.LATTICE_DATA;

  // ---------- Public namespace ----------
  const Sphere = window.Sphere = {
    state: {
      rotX: -0.15,       // pitch (radians) — slight tilt
      rotY: 0.3,         // yaw (auto-rotates)
      autoYaw: 0.04,     // radians/sec
      radius: 0,
      cx: 0, cy: 0,
      zoom: "cosmic",    // cosmic | regional | intimate
      zoomScale: 1.0,
      targetZoomScale: 1.0,
      breath: 0,         // 0..1 oscillation
      t: 0,              // time in seconds
      palette: "ember",
      showGhosts: true,
      motion: "breath",
      futureShimmer: 0.6,
      pulseDensity: 1.0,
      pointer: {x:-1e4, y:-1e4, dragging:false, lastX:0, lastY:0, justClicked:false},
      hover: null,       // hovered handshake
      selected: null,    // locked handshake (intimate)
      dragged: false,
    },

    palettes: {
      ember: { past:"#e8e6df", now:"#e89a5c", future:"#6ea8c6", ghost:"#4a4d58" },
      ice:   { past:"#cfdbe3", now:"#8fd4ff", future:"#a9f0d9", ghost:"#3a4b58" },
      bone:  { past:"#f2eee3", now:"#f2eee3", future:"#bcb7aa", ghost:"#4a4842" },
    },

    init(canvas, starsCanvas){
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      this.stars = starsCanvas;
      this.sctx = starsCanvas.getContext("2d");
      this.resize();
      window.addEventListener("resize", ()=>this.resize());
      this._bindPointer();
      this._seedStars();
    },

    resize(){
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      for (const c of [this.canvas, this.stars]){
        c.width = Math.floor(window.innerWidth * dpr);
        c.height = Math.floor(window.innerHeight * dpr);
        c.style.width = window.innerWidth + "px";
        c.style.height = window.innerHeight + "px";
      }
      this.ctx.setTransform(dpr,0,0,dpr,0,0);
      this.sctx.setTransform(dpr,0,0,dpr,0,0);
      const w = window.innerWidth, h = window.innerHeight;
      this.state.cx = w/2;
      this.state.cy = h/2 + 20;
      this.state.radius = Math.min(w,h) * 0.34;
      this._drawStars();
    },

    setZoom(level){
      this.state.zoom = level;
      this.state.targetZoomScale = level==="cosmic" ? 1.0 : level==="regional" ? 1.55 : 2.4;
      this.state.autoYaw = level==="intimate" ? 0.005 : level==="regional" ? 0.02 : 0.04;
    },

    setPalette(p){ this.state.palette = p; this._drawStars(); },
    setGhosts(on){ this.state.showGhosts = on; },
    setMotion(m){ this.state.motion = m; },

    // ---------- Stars background ----------
    _seedStars(){
      const s = [];
      const n = 320;
      for (let i=0;i<n;i++){
        s.push({
          x: Math.random(),
          y: Math.random(),
          r: Math.pow(Math.random(), 3) * 1.4 + 0.2,
          a: 0.15 + Math.random()*0.5,
        });
      }
      this._stars = s;
    },
    _drawStars(){
      const ctx = this.sctx;
      const w = window.innerWidth, h = window.innerHeight;
      ctx.clearRect(0,0,w,h);
      // vignette
      const g = ctx.createRadialGradient(w/2, h/2+20, this.state.radius*0.8, w/2, h/2+20, Math.max(w,h));
      g.addColorStop(0, "rgba(12,14,22,0.0)");
      g.addColorStop(0.5, "rgba(7,7,10,0.2)");
      g.addColorStop(1, "rgba(0,0,0,0.85)");
      ctx.fillStyle = g;
      ctx.fillRect(0,0,w,h);
      // stars
      ctx.fillStyle = "#e8e6df";
      for (const s of this._stars){
        ctx.globalAlpha = s.a;
        ctx.beginPath();
        ctx.arc(s.x*w, s.y*h, s.r, 0, Math.PI*2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    },

    // ---------- Projection ----------
    project(latDeg, lonDeg){
      // convert to radians
      const lat = latDeg * Math.PI/180;
      const lon = lonDeg * Math.PI/180;
      // sphere coords (unit)
      let x = Math.cos(lat) * Math.sin(lon);
      let y = Math.sin(lat);
      let z = Math.cos(lat) * Math.cos(lon);
      // rotate yaw (around y)
      const yaw = this.state.rotY;
      let x1 = x*Math.cos(yaw) + z*Math.sin(yaw);
      let z1 = -x*Math.sin(yaw) + z*Math.cos(yaw);
      // rotate pitch (around x)
      const pitch = this.state.rotX;
      let y1 = y*Math.cos(pitch) - z1*Math.sin(pitch);
      let z2 = y*Math.sin(pitch) + z1*Math.cos(pitch);
      // project
      const R = this.state.radius * this.state.zoomScale;
      const sx = this.state.cx + x1 * R;
      const sy = this.state.cy - y1 * R;
      return { x: sx, y: sy, z: z2, visible: z2 > -0.02 };
    },

    // ---------- Main draw ----------
    frame(dt){
      this.state.t += dt;
      // breath
      if (this.state.motion === "breath"){
        this.state.breath = 0.5 + 0.5 * Math.sin(this.state.t * 0.4);
      } else {
        this.state.breath = 0.5;
      }
      // auto yaw
      if (!this.state.pointer.dragging){
        this.state.rotY += this.state.autoYaw * dt;
      }
      // zoom easing
      this.state.zoomScale += (this.state.targetZoomScale - this.state.zoomScale) * Math.min(1, dt*2.5);

      const ctx = this.ctx;
      const w = window.innerWidth, h = window.innerHeight;
      ctx.clearRect(0,0,w,h);

      this._drawAtmosphere();
      this._drawGraticule();
      this._drawDomainBands();
      this._drawEquator();
      this._drawGhosts();
      this._drawPulses();
      this._drawSelfCluster();
      this._drawAnchors();
      this._drawHoverHalo();
    },

    _palette(){ return this.palettes[this.state.palette]; },

    // ---------- Atmosphere (soft glow behind sphere) ----------
    _drawAtmosphere(){
      const ctx = this.ctx;
      const R = this.state.radius * this.state.zoomScale;
      const br = 0.15 + 0.1 * this.state.breath;
      const g = ctx.createRadialGradient(this.state.cx, this.state.cy, R*0.9, this.state.cx, this.state.cy, R*1.7);
      g.addColorStop(0, "rgba(232,154,92,"+ (0.08*br) +")");
      g.addColorStop(0.4, "rgba(232,154,92,"+ (0.02*br) +")");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(this.state.cx, this.state.cy, R*1.8, 0, Math.PI*2);
      ctx.fill();

      // sphere body — very dark
      const bodyG = ctx.createRadialGradient(
        this.state.cx - R*0.3, this.state.cy - R*0.3, R*0.1,
        this.state.cx, this.state.cy, R
      );
      bodyG.addColorStop(0, "rgba(20,22,32,0.55)");
      bodyG.addColorStop(0.7, "rgba(10,11,16,0.6)");
      bodyG.addColorStop(1, "rgba(4,4,8,0.85)");
      ctx.fillStyle = bodyG;
      ctx.beginPath();
      ctx.arc(this.state.cx, this.state.cy, R, 0, Math.PI*2);
      ctx.fill();
    },

    // ---------- Graticule ----------
    _drawGraticule(){
      const ctx = this.ctx;
      ctx.strokeStyle = "rgba(232,230,223,0.05)";
      ctx.lineWidth = 0.5;

      // latitude circles every 20°
      for (let lat=-80; lat<=80; lat+=20){
        if (lat === 0) continue;
        this._drawLatCircle(lat);
      }
      // longitude meridians every 45° (one per domain)
      for (let lon=0; lon<360; lon+=45){
        this._drawMeridian(lon);
      }
    },
    _drawLatCircle(lat){
      const ctx = this.ctx;
      ctx.beginPath();
      let started = false;
      for (let lon=0; lon<=360; lon+=4){
        const p = this.project(lat, lon);
        if (!p.visible){ started=false; continue; }
        if (!started){ ctx.moveTo(p.x,p.y); started=true; }
        else ctx.lineTo(p.x,p.y);
      }
      ctx.stroke();
    },
    _drawMeridian(lon){
      const ctx = this.ctx;
      ctx.beginPath();
      let started = false;
      for (let lat=-90; lat<=90; lat+=4){
        const p = this.project(lat, lon);
        if (!p.visible){ started=false; continue; }
        if (!started){ ctx.moveTo(p.x,p.y); started=true; }
        else ctx.lineTo(p.x,p.y);
      }
      ctx.stroke();
    },

    // ---------- Domain labels around equator ----------
    _drawDomainBands(){
      const ctx = this.ctx;
      ctx.font = "9px 'JetBrains Mono', monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (const d of D.DOMAINS){
        // place label just outside the sphere, at equator, at this longitude
        const p = this.project(2, d.hue);
        if (!p.visible) continue;
        // offset outward
        const dx = p.x - this.state.cx, dy = p.y - this.state.cy;
        const len = Math.hypot(dx,dy) || 1;
        const out = 18 + 8*(this.state.zoomScale-1);
        const lx = p.x + (dx/len)*out;
        const ly = p.y + (dy/len)*out;
        const alpha = 0.35 + 0.45 * Math.max(0, p.z);
        ctx.fillStyle = "rgba(232,230,223," + alpha + ")";
        ctx.fillText(d.label.toUpperCase(), lx, ly);
      }
    },

    // ---------- Equator (NOW) ----------
    _drawEquator(){
      const ctx = this.ctx;
      const pal = this._palette();
      ctx.lineWidth = 1.2;
      // draw glow
      for (let pass=0; pass<2; pass++){
        ctx.strokeStyle = pass===0 ? "rgba(232,154,92,0.12)" : "rgba(232,154,92,0.8)";
        ctx.lineWidth = pass===0 ? 6 : 1;
        ctx.beginPath();
        let started=false;
        for (let lon=0; lon<=360; lon+=2){
          const p = this.project(0, lon);
          if (!p.visible){ started=false; continue; }
          if (!started){ ctx.moveTo(p.x,p.y); started=true; }
          else ctx.lineTo(p.x,p.y);
        }
        ctx.stroke();
      }

      // ticker dot that travels around the equator
      const lonTick = (this.state.t * 12) % 360;
      const pt = this.project(0, lonTick);
      if (pt.visible){
        ctx.fillStyle = pal.now;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 2.2, 0, Math.PI*2);
        ctx.fill();
        ctx.fillStyle = "rgba(232,154,92,0.25)";
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 6, 0, Math.PI*2);
        ctx.fill();
      }
    },

    // ---------- Pulses ----------
    _drawPulses(){
      const ctx = this.ctx;
      const pal = this._palette();
      const pulses = D.procedural;
      const density = this.state.pulseDensity;
      const shimmer = this.state.futureShimmer;
      const hoverId = this.state.hover ? this.state.hover.id : -1;

      for (let i=0; i<pulses.length; i++){
        if ((i / pulses.length) > density && i > 60) continue; // density control
        const h = pulses[i];
        const p = this.project(h.lat, h.lon);
        if (!p.visible) continue;

        const isFuture = h.future;
        const baseAlpha = 0.35 + 0.55 * Math.max(0, p.z);
        let alpha = baseAlpha * (0.4 + h.weight);

        // pulse timing
        const phase = (this.state.t * (isFuture?0.7:0.5) + h.phase*10) % (isFuture?1.6:2.4);
        const burst = phase < 0.25 ? (1 - phase/0.25) : 0;

        if (isFuture){
          // shimmer: flicker
          const flick = 0.4 + 0.6 * Math.sin(this.state.t * 3 + h.phase*50);
          alpha *= 0.55 + shimmer * flick * 0.6;
        }

        const color = isFuture ? pal.future : pal.past;
        const r = 0.7 + h.weight * 1.4 + burst*1.8;

        ctx.fillStyle = this._rgba(color, alpha);
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI*2);
        ctx.fill();

        // occasional burst glow for past
        if (!isFuture && burst > 0.2){
          ctx.fillStyle = this._rgba(color, alpha*burst*0.3);
          ctx.beginPath();
          ctx.arc(p.x, p.y, r + burst*6, 0, Math.PI*2);
          ctx.fill();
        }
      }
    },

    // ---------- Anchor handshakes (named/real) ----------
    _drawAnchors(){
      const ctx = this.ctx;
      const pal = this._palette();
      const hoverId = this.state.hover ? this.state.hover.id : -1;
      const selId = this.state.selected ? this.state.selected.id : -1;

      const anchors = D.anchors;
      for (const h of anchors){
        const p = this.project(h.lat, h.lon);
        if (!p.visible) continue;
        const isFuture = h.future;
        const baseAlpha = 0.55 + 0.45 * Math.max(0, p.z);
        const color = isFuture ? pal.future : pal.past;

        // arc: draw brief connecting arc between the two points of the handshake
        // (we don't actually have a second point — use a short curved companion arc)
        const phase = (this.state.t * 0.6 + h.phase*5) % 3.2;
        const arcBurst = phase < 0.45 ? 1 - phase/0.45 : 0;

        // main pulse
        ctx.fillStyle = this._rgba(color, baseAlpha);
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2.4 + h.weight*1.6, 0, Math.PI*2);
        ctx.fill();

        // glow
        ctx.fillStyle = this._rgba(color, 0.18 * baseAlpha);
        ctx.beginPath();
        ctx.arc(p.x, p.y, 10 + h.weight*8, 0, Math.PI*2);
        ctx.fill();

        if (arcBurst > 0.05){
          ctx.fillStyle = this._rgba(color, arcBurst * 0.3);
          ctx.beginPath();
          ctx.arc(p.x, p.y, 4 + arcBurst*14, 0, Math.PI*2);
          ctx.fill();
        }

        // label when zoomed
        if (this.state.zoomScale > 1.3){
          const a = (this.state.zoomScale - 1.3) / 0.8;
          ctx.font = "9px 'JetBrains Mono', monospace";
          ctx.fillStyle = this._rgba("#e8e6df", Math.min(1, a) * (0.55 + 0.45*Math.max(0,p.z)));
          ctx.textAlign = "left";
          ctx.textBaseline = "middle";
          ctx.fillText("· " + h.year + "  " + h.a, p.x + 8, p.y);
        }

        // selection ring
        if (h.id === selId){
          ctx.strokeStyle = pal.now;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 12 + 2*Math.sin(this.state.t*3), 0, Math.PI*2);
          ctx.stroke();
        }
        if (h.id === hoverId){
          ctx.strokeStyle = this._rgba(pal.now, 0.5);
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 9, 0, Math.PI*2);
          ctx.stroke();
        }
      }
    },

    _drawSelfCluster(){
      const ctx = this.ctx;
      const pal = this._palette();
      for (const h of D.self){
        const p = this.project(h.lat, h.lon);
        if (!p.visible) continue;
        // extra warm pulsing ring
        const pulse = 0.5 + 0.5 * Math.sin(this.state.t * 1.6 + h.phase*5);
        ctx.fillStyle = this._rgba(pal.now, 0.85);
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2 + pulse*1.2, 0, Math.PI*2);
        ctx.fill();
        ctx.strokeStyle = this._rgba(pal.now, 0.25 + 0.35*pulse);
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 6 + pulse*6, 0, Math.PI*2);
        ctx.stroke();
      }
    },

    // ---------- Ghost near-misses ----------
    _drawGhosts(){
      if (!this.state.showGhosts) return;
      const ctx = this.ctx;
      const pal = this._palette();
      const hoverId = this.state.hover ? this.state.hover.id : -1;
      const selId = this.state.selected ? this.state.selected.id : -1;
      ctx.setLineDash([2,3]);
      for (const h of D.ghosts){
        const p = this.project(h.lat, h.lon);
        if (!p.visible) continue;
        const a = 0.35 + 0.45 * Math.max(0, p.z);
        ctx.strokeStyle = this._rgba(pal.ghost, a);
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI*2);
        ctx.stroke();
        // tiny X inside
        ctx.beginPath();
        ctx.moveTo(p.x-2, p.y-2); ctx.lineTo(p.x+2, p.y+2);
        ctx.moveTo(p.x+2, p.y-2); ctx.lineTo(p.x-2, p.y+2);
        ctx.stroke();

        if (h.id === hoverId || h.id === selId){
          ctx.strokeStyle = this._rgba(pal.ghost, 0.9);
          ctx.beginPath();
          ctx.arc(p.x, p.y, 8, 0, Math.PI*2);
          ctx.stroke();
        }
      }
      ctx.setLineDash([]);
    },

    _drawHoverHalo(){
      const h = this.state.hover;
      if (!h) return;
      // already drawn per-anchor; nothing extra needed
    },

    // ---------- Picking ----------
    pickAt(mx, my){
      // find closest visible pulse within 12px
      let best = null;
      let bestD = 14*14;
      const check = (list)=>{
        for (const h of list){
          const p = this.project(h.lat, h.lon);
          if (!p.visible) continue;
          const dx = p.x - mx, dy = p.y - my;
          const d2 = dx*dx + dy*dy;
          if (d2 < bestD){ bestD = d2; best = h; }
        }
      };
      check(D.anchors);
      check(D.self);
      if (this.state.showGhosts) check(D.ghosts);
      // only pick from procedural if nothing found — tighter threshold
      if (!best){
        let bp = null, bd = 8*8;
        for (const h of D.procedural){
          const p = this.project(h.lat, h.lon);
          if (!p.visible) continue;
          const dx = p.x - mx, dy = p.y - my;
          const d2 = dx*dx + dy*dy;
          if (d2 < bd){ bd = d2; bp = h; }
        }
        best = bp;
      }
      return best;
    },

    // ---------- Pointer ----------
    _bindPointer(){
      const c = this.canvas;
      const st = this.state;
      c.style.pointerEvents = "auto";
      c.style.cursor = "grab";

      c.addEventListener("pointerdown", (e)=>{
        st.pointer.dragging = true;
        st.pointer.lastX = e.clientX;
        st.pointer.lastY = e.clientY;
        st.dragged = false;
        c.setPointerCapture(e.pointerId);
        c.style.cursor = "grabbing";
      });
      c.addEventListener("pointermove", (e)=>{
        st.pointer.x = e.clientX; st.pointer.y = e.clientY;
        if (st.pointer.dragging){
          const dx = e.clientX - st.pointer.lastX;
          const dy = e.clientY - st.pointer.lastY;
          if (Math.abs(dx)+Math.abs(dy) > 2) st.dragged = true;
          st.rotY += dx * 0.005;
          st.rotX = Math.max(-1.1, Math.min(1.1, st.rotX + dy * 0.005));
          st.pointer.lastX = e.clientX;
          st.pointer.lastY = e.clientY;
        } else {
          const h = this.pickAt(e.clientX, e.clientY);
          st.hover = h;
          c.style.cursor = h ? "pointer" : "grab";
          if (window.LatticeApp) window.LatticeApp.updateTooltip(h, e.clientX, e.clientY);
        }
      });
      c.addEventListener("pointerup", (e)=>{
        st.pointer.dragging = false;
        c.style.cursor = "grab";
        if (!st.dragged){
          const h = this.pickAt(e.clientX, e.clientY);
          if (h && window.LatticeApp) window.LatticeApp.selectHandshake(h);
        }
      });
      c.addEventListener("pointerleave", ()=>{
        st.pointer.dragging = false;
        st.hover = null;
        if (window.LatticeApp) window.LatticeApp.updateTooltip(null);
      });
      // wheel to zoom
      c.addEventListener("wheel", (e)=>{
        e.preventDefault();
        const s = Math.exp(-e.deltaY * 0.001);
        st.targetZoomScale = Math.max(0.8, Math.min(3.2, st.targetZoomScale * s));
        if (st.targetZoomScale < 1.3) st.zoom = "cosmic";
        else if (st.targetZoomScale < 2.0) st.zoom = "regional";
        else st.zoom = "intimate";
        if (window.LatticeApp) window.LatticeApp.syncZoomButtons();
      }, { passive:false });
    },

    _rgba(hex, a){
      // accept #rrggbb
      const r = parseInt(hex.slice(1,3),16);
      const g = parseInt(hex.slice(3,5),16);
      const b = parseInt(hex.slice(5,7),16);
      return "rgba(" + r + "," + g + "," + b + "," + a + ")";
    },
  };
})();
