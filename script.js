// Ninja Climber - tuned: slower spike spawn rate, increased spike fall speed (spikes faster, spawn less often)
window.addEventListener('load', ()=>{
  const canvas = document.getElementById('game');
  const wrap = document.getElementById('game-wrap');
  const scoreEl = document.getElementById('score');
  const livesEl = document.getElementById('lives');
  const multEl = document.getElementById('mult');
  const msgEl = document.getElementById('msg');
  const btnLeft = document.getElementById('btn-left');
  const btnRight = document.getElementById('btn-right');
  const ctx = canvas.getContext('2d', { alpha: false });

  // Dimensions and layout
  let W = 800, H = 600;
  let wallWidth = 96;
  // ensure lane positions exist before calling resize()
  let leftX = 96, rightX = 704;
  // Screen shake state (declare early)
  let shakeTime = 0, shakeIntensity = 0;

  function resize(){
    W = Math.max(320, window.innerWidth);
    H = Math.max(320, window.innerHeight);
    canvas.width = W; canvas.height = H;
    // recompute wallWidth and lane X positions
    wallWidth = Math.max(72, Math.floor(Math.min(W,900) * 0.12));
    leftX = Math.floor(wallWidth * 0.9);
    rightX = Math.floor(W - wallWidth * 0.9);
  }
  resize();
  window.addEventListener('resize', resize);

  // Game state
  let score = 0, lives = 3, multiplier = 1;
  let running = false, gameOver = false;
  let highScore = Number(localStorage.getItem('nc_high') || 0);
  let startTime = performance.now();

  const player = { side: 'left', x: leftX, y: H - 96, size: 52, switchCooldown: 0 };

  // VERY BIG entities
  const COIN_RADIUS = 30;
  const POWER_RADIUS = 30;
  const SPIKE_HALF = 40;
  const PARTICLE_SIZE = 12;
  const COLLIDE_COIN = 120;
  const COLLIDE_POWER = 120;
  const COLLIDE_SPIKE = 100;

  // Entities
  let spikes = [], coins = [], powerups = [], particles = [];

  // Timers
  let lastSpike = 0, lastCoin = 0, lastPower = 0;

  // Survival score
  let survivalElapsed = 0;
  let SURVIVAL_INTERVAL = 1200;
  let SURVIVAL_TICK = 1;
  let survivalMultiplier = 1;

  // Difficulty / speed
  const BASE_SPEED = 1.2; // base multiplier
  const BASE_ENTITY_SPEED = 2.2; // base vy in px/frame-ish (will be scaled)
  // spike-specific speed multiplier (we'll make spikes fall noticeably faster without increasing spawn rate)
  const SPIKE_SPEED_MULT = 1.9;

  function speedMultiplier(){
    // increase with elapsed time since start so players see clear speedup
    const t = (performance.now() - startTime) / 1000; // seconds
    return BASE_SPEED + Math.min(6, t / 6); // + ~1 every 6s, capped
  }
  function entityVy(){
    // single unified speed baseline for non-spike falling entities
    return BASE_ENTITY_SPEED * speedMultiplier();
  }

  // Input
  function switchSide(fromButton=false){
    if(!running || gameOver) return;
    if(player.switchCooldown > 0) return;
    player.side = player.side === 'left' ? 'right' : 'left';
    player.x = player.side === 'left' ? leftX : rightX;
    const cls = player.side === 'left' ? 'tilt-left' : 'tilt-right';
    wrap.classList.add(cls);
    setTimeout(()=> wrap.classList.remove(cls), 420);
    addParticles(player.x, player.y - 20, ['#fff','#60a5fa','#f97316'], 14);
    doShake(6, 160);
    player.switchCooldown = 260;
  }
  window.addEventListener('keydown', e=>{ if(e.code === 'Space'){ switchSide(); e.preventDefault(); } });
  if(btnLeft && btnRight){
    btnLeft.addEventListener('touchstart', e=>{ e.preventDefault(); switchSide(true); }, {passive:false});
    btnRight.addEventListener('touchstart', e=>{ e.preventDefault(); switchSide(true); }, {passive:false});
    btnLeft.addEventListener('mousedown', e=>{ e.preventDefault(); switchSide(true); });
    btnRight.addEventListener('mousedown', e=>{ e.preventDefault(); switchSide(true); });
  }

  // Allow click/tap anywhere to restart after game over
  wrap.addEventListener('pointerdown', ()=>{ if(gameOver) restartFromMenu(); });

  // Spawning
  // Spikes: spawn less frequently but fall faster (using SPIKE_SPEED_MULT)
  function spawnSpike(){
    const side = Math.random() < 0.5 ? 'left' : 'right';
    const x = side === 'left' ? leftX : rightX;
    const vy = entityVy() * SPIKE_SPEED_MULT;
    spikes.push({x, y:-60, vy, side});
  }
  function spawnCoin(){
    const side = Math.random() < 0.5 ? 'left' : 'right';
    const x = side === 'left' ? leftX : rightX;
    const vy = entityVy();
    coins.push({x, y:-40, vy});
  }
  function spawnPower(){
    const kinds = ['mult','extra','slow','score'];
    const kind = kinds[Math.floor(Math.random()*kinds.length)];
    const x = Math.random()<0.5? leftX : rightX;
    const vy = entityVy();
    powerups.push({x, y:-50, vy, kind});
  }

  // Utility
  function rand(a,b){ return Math.random()*(b-a)+a; }
  function addParticles(x,y,colors,amount=20){
    for(let i=0;i<amount;i++){
      const angle = rand(0, Math.PI*2);
      const speed = rand(1,6);
      const c = colors[Math.floor(Math.random()*colors.length)];
      particles.push({x,y,vx:Math.cos(angle)*speed, vy:Math.sin(angle)*speed, life: rand(30,90), age:0, color:c});
    }
  }
  function circleDist(ax,ay,bx,by){ return Math.hypot(ax-bx, ay-by); }

  // UI
  function updateUI(){
    if(scoreEl) scoreEl.textContent = `Score: ${Math.floor(score)}`;
    if(multEl) multEl.textContent = `x${multiplier}`;
    if(livesEl) livesEl.textContent = `Lives: ${'❤'.repeat(Math.max(0,lives))}`;
  }

  // Start / Restart
  function startGame(){
    score = 0; lives = 3; multiplier = 1; spikes = []; coins = []; powerups = []; particles = []; gameOver = false; running = true; if(msgEl) msgEl.classList.remove('game-over'); if(msgEl) msgEl.textContent = '';
    if(btnLeft) btnLeft.classList.remove('disabled'); if(btnRight) btnRight.classList.remove('disabled');
    startTime = performance.now();
  }
  function restartFromMenu(){
    // restart instantly when clicking after game over
    running = false; gameOver = false; if(msgEl) msgEl.classList.remove('game-over');
    highScore = Math.max(highScore, Math.floor(score)); localStorage.setItem('nc_high', highScore);
    startGame();
  }

  // Main loop
  let last = performance.now();
  function loop(now){
    const dt = now - last; last = now;
    if(player.switchCooldown > 0) player.switchCooldown = Math.max(0, player.switchCooldown - dt);

    if(running && !gameOver){
      survivalElapsed += dt;
      const effectiveInterval = SURVIVAL_INTERVAL / Math.max(1, survivalMultiplier);
      if(survivalElapsed >= effectiveInterval){ survivalElapsed -= effectiveInterval; score += SURVIVAL_TICK * multiplier; }

      lastSpike += dt; lastCoin += dt; lastPower += dt;
      // spike spawn rate is intentionally slower now (higher base timers)
      if(lastSpike > Math.max(1200, 1600 - score * 0.2)){ spawnSpike(); lastSpike = 0; }
      if(lastCoin > Math.max(600, 1100 - score * 0.3)){ spawnCoin(); lastCoin = 0; }
      if(lastPower > Math.max(2500, 4000 - score * 0.5)){ spawnPower(); lastPower = 0; }

      // update entities (all use their vy)
      for(let i=spikes.length-1;i>=0;i--){ const s=spikes[i]; s.y += s.vy * dt/16.66; if(s.y > H+80) spikes.splice(i,1); }
      for(let i=coins.length-1;i>=0;i--){ const c=coins[i]; c.y += c.vy * dt/16.66; if(c.y > H+80) coins.splice(i,1); }
      for(let i=powerups.length-1;i>=0;i--){ const p=powerups[i]; p.y += p.vy * dt/16.66; if(p.y > H+80) powerups.splice(i,1); }

      for(let i=particles.length-1;i>=0;i--){ const p=particles[i]; p.x += p.vx; p.y += p.vy; p.vy += 0.12; p.age++; if(p.age>p.life) particles.splice(i,1); }

      const px = player.x; const py = player.y - 12;
      // coins
      for(let i=coins.length-1;i>=0;i--){ const c = coins[i]; if(circleDist(px,py,c.x,c.y) < COLLIDE_COIN){ score += 30 * multiplier; addParticles(c.x,c.y,['#ffcf00','#ffd166','#fff'], 36); doShake(6,110); coins.splice(i,1); } }
      // powerups
      for(let i=powerups.length-1;i>=0;i--){ const p = powerups[i]; if(circleDist(px,py,p.x,p.y) < COLLIDE_POWER){
        if(p.kind === 'mult'){ multiplier = Math.min(9, multiplier + 2); setTimeout(()=> multiplier = Math.max(1, multiplier - 2), 9000); }
        else if(p.kind === 'extra'){ lives = Math.min(9, lives + 1); }
        else if(p.kind === 'slow'){ // temporarily slow entities by reducing their vy
          spikes.forEach(s=> s.vy *= 0.6); coins.forEach(c=> c.vy *= 0.6); powerups.forEach(q=> q.vy *= 0.6);
          setTimeout(()=> { spikes.forEach(s=> s.vy /= 0.6); coins.forEach(c=> c.vy /= 0.6); powerups.forEach(q=> q.vy /= 0.6); }, 7000);
        }
        else if(p.kind === 'score'){ survivalMultiplier = 2; setTimeout(()=> survivalMultiplier = 1, 8000); }
        addParticles(p.x,p.y,['#6ee7b7','#60a5fa','#f472b6'], 48); doShake(8,160); powerups.splice(i,1);
      } }

      // spikes collisions
      for(let i=spikes.length-1;i>=0;i--){ const s = spikes[i]; if(circleDist(px,py,s.x,s.y) < COLLIDE_SPIKE){
        addParticles(px,py,['#f87171','#fb7185','#fff'], 60);
        doShake(18,260);
        lives -= 1; score = Math.max(0, score - 40);
        spikes.splice(i,1);
        if(lives <= 0){ gameOver = true; running = false; if(msgEl){ msgEl.textContent = 'Game Over — Click to restart'; msgEl.classList.add('game-over'); msgEl.style.opacity = 1; } if(Math.floor(score) > highScore){ highScore = Math.floor(score); localStorage.setItem('nc_high', highScore); if(msgEl) msgEl.textContent = 'New High Score! Click to restart'; } }
        break;
      } }

    }

    // shake handling via CSS vars
    if(shakeTime > 0){ shakeTime -= dt; const t = Math.max(0, shakeTime); const s = (t/220) * shakeIntensity; const ox = rand(-s,s), oy = rand(-s,s); wrap.style.setProperty('--tx', `${ox}px`); wrap.style.setProperty('--ty', `${oy}px`); }
    else { wrap.style.setProperty('--tx', `0px`); wrap.style.setProperty('--ty', `0px`); }

    render(); updateUI(); requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  function render(){
    ctx.fillStyle = '#041226'; ctx.fillRect(0,0,W,H);
    const g = ctx.createLinearGradient(0,0,0,H); g.addColorStop(0,'#071530'); g.addColorStop(1,'#041226'); ctx.fillStyle = g; ctx.fillRect(0,0,W,H);

    // walls
    ctx.fillStyle = '#071521'; ctx.fillRect(0,0,wallWidth,H); ctx.fillRect(W-wallWidth,0,wallWidth,H);
    for(let y=10;y<H;y+=30){ ctx.fillStyle = 'rgba(255,255,255,0.02)'; ctx.fillRect(12,y,3,16); ctx.fillRect(W-15,y,3,16); }

    // coins
    coins.forEach(c=>{ ctx.beginPath(); ctx.fillStyle = '#ffd166'; ctx.arc(c.x, c.y, COIN_RADIUS, 0, Math.PI*2); ctx.fill(); ctx.fillStyle = '#fff8'; ctx.fillRect(c.x-10, c.y-10, 18,10); });

    // powerups
    powerups.forEach(p=>{
      ctx.save(); ctx.translate(p.x, p.y);
      ctx.beginPath(); if(p.kind==='mult'){ ctx.fillStyle='#60a5fa'; ctx.arc(0,0,POWER_RADIUS,0,Math.PI*2); ctx.fill(); ctx.fillStyle='#fff'; ctx.font='26px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('x',0,2); }
      else if(p.kind==='extra'){ ctx.fillStyle='#fb7185'; ctx.arc(0,0,POWER_RADIUS,0,Math.PI*2); ctx.fill(); ctx.fillStyle='#fff'; ctx.font='26px sans-serif'; ctx.fillText('+',0,2); }
      else if(p.kind==='slow'){ ctx.fillStyle='#34d399'; ctx.arc(0,0,POWER_RADIUS,0,Math.PI*2); ctx.fill(); ctx.fillStyle='#fff'; ctx.font='26px sans-serif'; ctx.fillText('-',0,2); }
      else if(p.kind==='score'){ ctx.fillStyle='#f59e0b'; ctx.arc(0,0,POWER_RADIUS,0,Math.PI*2); ctx.fill(); ctx.fillStyle='#fff'; ctx.font='22px sans-serif'; ctx.fillText('⚡',0,2); }
      ctx.restore();
    });

    // spikes
    spikes.forEach(s=>{
      ctx.save(); ctx.translate(s.x, s.y);
      ctx.fillStyle = '#ef4444'; ctx.beginPath();
      if(s.side === 'left'){
        ctx.moveTo(-SPIKE_HALF, -Math.floor(SPIKE_HALF/1.8)); ctx.lineTo(SPIKE_HALF, 0); ctx.lineTo(-SPIKE_HALF, Math.floor(SPIKE_HALF/1.8));
      } else {
        ctx.moveTo(SPIKE_HALF, -Math.floor(SPIKE_HALF/1.8)); ctx.lineTo(-SPIKE_HALF, 0); ctx.lineTo(SPIKE_HALF, Math.floor(SPIKE_HALF/1.8));
      }
      ctx.closePath(); ctx.fill(); ctx.restore();
    });

    // player
    ctx.save(); ctx.font = `${player.size}px serif`; ctx.textAlign='center'; ctx.textBaseline='middle';
    const px = player.x; const py = player.y;
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.beginPath(); ctx.ellipse(px+8, py+30, 34, 12, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillText('🥷🏻', px, py-6);
    ctx.restore();

    // particles
    particles.forEach(p=>{ ctx.globalAlpha = 1 - (p.age / p.life); ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, PARTICLE_SIZE, PARTICLE_SIZE); ctx.globalAlpha = 1; });
  }

  // helpers
  function recomputeLayout(){
    wallWidth = Math.max(72, Math.floor(Math.min(W,900) * 0.12));
    leftX = Math.floor(wallWidth * 0.9);
    rightX = Math.floor(W - wallWidth * 0.9);
    player.x = player.side === 'left' ? leftX : rightX; player.y = H - 96;
  }
  window.addEventListener('resize', ()=>{ resize(); recomputeLayout(); }); recomputeLayout();

  // small helper to fade msg in/out
  setTimeout(()=> { if(msgEl) msgEl.style.opacity = 0.9; }, 1000);
  setTimeout(()=> { if(msgEl) msgEl.style.opacity = 0.6; }, 4000);

  // auto start
  setTimeout(()=> startGame(), 120);

  // autosave
  window.addEventListener('beforeunload', ()=> localStorage.setItem('nc_high', highScore));

  function doShake(intensity=8, duration=220){ shakeIntensity = intensity; shakeTime = duration; }
});
