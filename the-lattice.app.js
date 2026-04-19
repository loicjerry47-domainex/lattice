/* The Lattice — app glue */
(function(){
  "use strict";

  const D = window.LATTICE_DATA;

  const els = {
    sphere: document.getElementById("sphere"),
    stars: document.getElementById("stars"),
    tip: document.getElementById("tip"),
    intimate: document.getElementById("intimate"),
    intIdx: document.getElementById("int-idx"),
    intTitle: document.getElementById("int-title"),
    intMeta: document.getElementById("int-meta"),
    intFrames: document.getElementById("int-frames"),
    closeIntimate: document.getElementById("close-intimate"),
    nowclock: document.getElementById("nowclock"),
    pulseCount: document.getElementById("pulseCount"),
    ghostCount: document.getElementById("ghostCount"),
    density: document.getElementById("density"),
    veil: document.getElementById("veil"),
    enter: document.getElementById("enter"),
    btnGhosts: document.getElementById("btn-ghosts"),
    btnSound: document.getElementById("btn-sound"),
    btnTweaks: document.getElementById("btn-tweaks"),
    tweaks: document.getElementById("tweaks"),
    tRot: document.getElementById("t-rot"),
    vRot: document.getElementById("v-rot"),
    tDensity: document.getElementById("t-density"),
    vDensity: document.getElementById("v-density"),
    tShimmer: document.getElementById("t-shimmer"),
    vShimmer: document.getElementById("v-shimmer"),
    caption: document.getElementById("caption"),
    zoomButtons: document.querySelectorAll(".zoom-stack button"),
    motionChips: document.querySelectorAll(".chip[data-motion]"),
    palChips: document.querySelectorAll(".chip[data-pal]"),
  };

  // ---------- Audio (ambient) ----------
  const Audio = {
    on: false, ctx: null, master: null, osc: null, lfo: null,
    init(){
      if (this.ctx) return;
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0;
        this.master.connect(this.ctx.destination);
        // low drone
        this.osc = this.ctx.createOscillator();
        this.osc.type = "sine";
        this.osc.frequency.value = 55;
        const droneGain = this.ctx.createGain();
        droneGain.gain.value = 0.25;
        this.osc.connect(droneGain).connect(this.master);
        this.osc.start();
        // shimmer
        this.osc2 = this.ctx.createOscillator();
        this.osc2.type = "triangle";
        this.osc2.frequency.value = 220;
        const g2 = this.ctx.createGain();
        g2.gain.value = 0.04;
        this.lfo = this.ctx.createOscillator();
        this.lfo.frequency.value = 0.13;
        const lfoGain = this.ctx.createGain();
        lfoGain.gain.value = 0.03;
        this.lfo.connect(lfoGain).connect(g2.gain);
        this.lfo.start();
        this.osc2.connect(g2).connect(this.master);
        this.osc2.start();
      } catch(e){ console.warn("no audio", e); }
    },
    setOn(on){
      this.on = on;
      if (!this.ctx){ if (on) this.init(); }
      if (!this.ctx) return;
      if (this.ctx.state === "suspended") this.ctx.resume();
      const target = on ? 0.12 : 0;
      this.master.gain.cancelScheduledValues(this.ctx.currentTime);
      this.master.gain.linearRampToValueAtTime(target, this.ctx.currentTime + 0.8);
    },
    ping(freq, vol){
      if (!this.on || !this.ctx) return;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.frequency.value = freq;
      o.type = "sine";
      g.gain.value = 0;
      g.gain.linearRampToValueAtTime(vol, this.ctx.currentTime + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 1.4);
      o.connect(g).connect(this.master);
      o.start();
      o.stop(this.ctx.currentTime + 1.5);
    },
  };

  // ---------- App ----------
  const App = window.LatticeApp = {
    init(){
      Sphere.init(els.sphere, els.stars);

      // apply defaults from TWEAK_DEFAULTS
      const T = window.TWEAK_DEFAULTS;
      Sphere.state.autoYaw = T.rotationSpeed;
      Sphere.state.pulseDensity = T.pulseDensity;
      Sphere.state.futureShimmer = T.futureShimmer;
      Sphere.state.motion = T.motion;
      Sphere.state.palette = T.palette;
      Sphere.state.showGhosts = T.ghostsOn;

      els.tRot.value = T.rotationSpeed;
      els.vRot.textContent = T.rotationSpeed.toFixed(3);
      els.tDensity.value = T.pulseDensity;
      els.vDensity.textContent = T.pulseDensity.toFixed(1) + "×";
      els.tShimmer.value = T.futureShimmer;
      els.vShimmer.textContent = T.futureShimmer.toFixed(2);

      this._applyChips(els.motionChips, "motion", T.motion);
      this._applyChips(els.palChips, "pal", T.palette);
      els.btnGhosts.classList.toggle("on", !!T.ghostsOn);
      els.btnSound.classList.toggle("on", !!T.soundOn);

      this._bindUI();
      this._setupEditMode();
      this.updateCounts();
      this._clockTick();
      setInterval(()=>this._clockTick(), 1000);

      // start rAF
      let last = performance.now();
      const loop = (now)=>{
        const dt = Math.min(0.05, (now - last)/1000);
        last = now;
        Sphere.frame(dt);
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);

      // Veil
      els.enter.addEventListener("click", ()=>{
        els.veil.classList.add("hidden");
        setTimeout(()=>els.veil.remove(), 1400);
        if (T.soundOn) Audio.setOn(true);
      });
      // auto-enter after 8s if idle
      setTimeout(()=>{
        if (els.veil && !els.veil.classList.contains("hidden")){
          els.veil.classList.add("hidden");
          setTimeout(()=>els.veil && els.veil.remove(), 1400);
        }
      }, 9000);

      // caption fade
      setTimeout(()=>{ els.caption.style.transition = "opacity 1.2s"; els.caption.style.opacity = "0"; }, 8000);
    },

    _applyChips(nodeList, attr, val){
      nodeList.forEach(c => c.classList.toggle("on", c.dataset[attr] === val));
    },

    _bindUI(){
      // zoom buttons
      els.zoomButtons.forEach(btn=>{
        btn.addEventListener("click", ()=>{
          const z = btn.dataset.zoom;
          Sphere.setZoom(z);
          this.syncZoomButtons();
        });
      });

      // ghosts toggle
      els.btnGhosts.addEventListener("click", ()=>{
        const on = !els.btnGhosts.classList.contains("on");
        els.btnGhosts.classList.toggle("on", on);
        Sphere.setGhosts(on);
        this._persist({ ghostsOn: on });
      });

      // sound toggle
      els.btnSound.addEventListener("click", ()=>{
        const on = !els.btnSound.classList.contains("on");
        els.btnSound.classList.toggle("on", on);
        Audio.setOn(on);
        this._persist({ soundOn: on });
      });

      // tweaks toggle
      els.btnTweaks.addEventListener("click", ()=>{
        const on = !els.tweaks.classList.contains("open");
        els.tweaks.classList.toggle("open", on);
        els.btnTweaks.classList.toggle("on", on);
      });

      // rotation speed
      els.tRot.addEventListener("input", ()=>{
        const v = parseFloat(els.tRot.value);
        Sphere.state.autoYaw = v;
        els.vRot.textContent = v.toFixed(3);
        this._persist({ rotationSpeed: v });
      });
      els.tDensity.addEventListener("input", ()=>{
        const v = parseFloat(els.tDensity.value);
        Sphere.state.pulseDensity = v;
        els.vDensity.textContent = v.toFixed(1) + "×";
        this._persist({ pulseDensity: v });
        this.updateCounts();
      });
      els.tShimmer.addEventListener("input", ()=>{
        const v = parseFloat(els.tShimmer.value);
        Sphere.state.futureShimmer = v;
        els.vShimmer.textContent = v.toFixed(2);
        this._persist({ futureShimmer: v });
      });

      els.motionChips.forEach(c=>{
        c.addEventListener("click", ()=>{
          const v = c.dataset.motion;
          this._applyChips(els.motionChips, "motion", v);
          Sphere.setMotion(v);
          this._persist({ motion: v });
        });
      });
      els.palChips.forEach(c=>{
        c.addEventListener("click", ()=>{
          const v = c.dataset.pal;
          this._applyChips(els.palChips, "pal", v);
          Sphere.setPalette(v);
          this._persist({ palette: v });
        });
      });

      // close intimate
      els.closeIntimate.addEventListener("click", ()=>{
        els.intimate.classList.remove("open");
        Sphere.state.selected = null;
      });

      // keyboard
      window.addEventListener("keydown", (e)=>{
        if (e.key === "Escape") {
          els.intimate.classList.remove("open");
          Sphere.state.selected = null;
        }
        if (e.key === "1") { Sphere.setZoom("cosmic"); this.syncZoomButtons(); }
        if (e.key === "2") { Sphere.setZoom("regional"); this.syncZoomButtons(); }
        if (e.key === "3") { Sphere.setZoom("intimate"); this.syncZoomButtons(); }
      });
    },

    syncZoomButtons(){
      els.zoomButtons.forEach(b=>{
        b.classList.toggle("active", b.dataset.zoom === Sphere.state.zoom);
      });
    },

    updateTooltip(h, x, y){
      const t = els.tip;
      if (!h){ t.classList.remove("show"); return; }
      t.classList.remove("future","ghost");
      if (h.ghost) t.classList.add("ghost");
      else if (h.future) t.classList.add("future");

      const yr = h.year < 0 ? Math.abs(h.year) + " BCE" : h.year + " CE";
      const type = h.ghost ? "near-miss" : (h.future ? "probable" : "observed");
      const names = h.ghost
        ? "<i>" + h.a + " × " + h.b + "</i>"
        : h.a + " × " + h.b;
      t.innerHTML = '<div class="names">' + names + '</div><div class="when">' + type + " · " + yr + " · " + (D.DOMAINS.find(d=>d.key===h.domain)?.label.toLowerCase() || "") + "</div>";
      t.style.left = x + "px";
      t.style.top = y + "px";
      t.classList.add("show");
    },

    selectHandshake(h){
      Sphere.state.selected = h;
      this._populateIntimate(h);
      els.intimate.classList.add("open");
      Audio.ping(h.future ? 380 : 220, 0.08);
    },

    _populateIntimate(h){
      const yr = h.year < 0 ? Math.abs(h.year) + " BCE" : h.year + " CE";
      const idx = "HANDSHAKE " + String(h.id).padStart(5,"0");
      els.intIdx.textContent = idx + (h.ghost ? " · NEAR-MISS" : (h.future ? " · PROBABILISTIC" : (h.self ? " · SELF" : " · OBSERVED")));

      // title
      const a = h.a, b = h.b;
      els.intTitle.innerHTML = a + ' <em>×</em> ' + b;

      // meta line
      const dom = D.DOMAINS.find(d=>d.key===h.domain)?.label || "";
      els.intMeta.innerHTML =
        '<span>' + yr + '</span>' +
        '<span>' + dom.toUpperCase() + '</span>' +
        '<span>LAT ' + h.lat.toFixed(1) + '°</span>' +
        '<span>LON ' + ((h.lon%360+360)%360).toFixed(1) + '°</span>' +
        '<span>WEIGHT ' + (h.weight||0).toFixed(2) + '</span>';

      // frames
      const frameList = [
        ["Transactional", "What passed between them?"],
        ["Relational", "How did the bond shift?"],
        ["Narrative", "Where does this sit in the story?"],
        ["Systemic", "What does it say about the lattice?"],
        ["Emotional", "What did it feel like?"],
      ];

      let html = "";
      if (h.note){
        html += '<div class="frame"><h3>Observed</h3><p>' + this._escape(h.note) + '</p></div>';
      }
      if (h.frames){
        for (const [key, label] of frameList){
          const k = key.toLowerCase();
          const text = h.frames[k];
          if (!text) continue;
          html += '<div class="frame"><h3>' + key + ' — ' + label + '</h3><p>' + this._escape(text) + '</p></div>';
        }
      } else if (!h.ghost){
        // procedural — generate plausible frames
        html += this._proceduralFrames(h);
      }

      if (h.ghost){
        html += '<div class="frame"><h3>Counterfactual</h3><p>A handshake that did not happen. The lattice holds a hollow where it would have been. <em>Every near-miss has a shape; this is one of them.</em></p></div>';
      }
      els.intFrames.innerHTML = html;
    },

    _proceduralFrames(h){
      // light procedural commentary for un-annotated pulses
      const yr = h.year < 0 ? Math.abs(h.year) + " BCE" : h.year + " CE";
      const dom = D.DOMAINS.find(d=>d.key===h.domain)?.label.toLowerCase() || "contact";
      const futureLine = h.future
        ? "A handshake that has not yet happened — but that the lattice considers probable."
        : "A handshake that happened, briefly, in " + yr + ".";
      const weight = h.weight < 0.25 ? "small" : h.weight < 0.4 ? "modest" : "load-bearing";
      return '' +
        '<div class="frame"><h3>Observed</h3><p>' + futureLine + " Category: <em>" + dom + "</em>.</p></div>" +
        '<div class="frame"><h3>Systemic</h3><p>One of millions like it this century. Weight: <em>' + weight + '</em>. Alone, unremarkable. Together, the shape of an age.</p></div>' +
        '<div class="frame"><h3>Emotional</h3><p>Unrecorded. The people who lived it would not have called it a handshake. They would have called it <em>Tuesday</em>.</p></div>';
    },

    _escape(s){ return String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c])); },

    updateCounts(){
      const total = Math.round(D.procedural.length * Math.min(1, Sphere.state.pulseDensity)) + D.anchors.length + D.self.length;
      els.pulseCount.textContent = total.toLocaleString();
      els.ghostCount.textContent = D.ghosts.length.toLocaleString();
      // density badge
      const d = Sphere.state.pulseDensity;
      els.density.textContent = d < 0.5 ? "sparse" : d < 1.2 ? "nominal" : d < 2 ? "dense" : "overgrown";
    },

    _clockTick(){
      const now = new Date();
      const parts = now.toISOString().slice(0,19).replace("T", " · ");
      els.nowclock.textContent = parts + " UTC";
    },

    // ---------- Tweaks host integration ----------
    _setupEditMode(){
      window.addEventListener("message", (ev)=>{
        const m = ev.data;
        if (!m || typeof m !== "object") return;
        if (m.type === "__activate_edit_mode") {
          els.tweaks.classList.add("open");
          els.btnTweaks.classList.add("on");
        }
        if (m.type === "__deactivate_edit_mode") {
          els.tweaks.classList.remove("open");
          els.btnTweaks.classList.remove("on");
        }
      });
      // announce
      try { window.parent.postMessage({type:"__edit_mode_available"}, "*"); } catch(e){}
    },
    _persist(edits){
      try { window.parent.postMessage({type:"__edit_mode_set_keys", edits}, "*"); } catch(e){}
    },
  };

  // go
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ()=>App.init());
  else App.init();
})();
