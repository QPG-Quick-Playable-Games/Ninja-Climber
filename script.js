// Ninja Climber - Fullscreen, mobile-friendly, juices added (entities resized, spike speed matched to other entities)
const canvas = document.getElementById('game');
const wrap = document.getElementById('game-wrap');
const scoreEl = document.getElementById('score');
const livesEl = document.getElementById('lives');
const multEl = document.getElementById('mult');
const msgEl = document.getElementById('msg');
const btnLeft = document.getElementById('btn-left');
const btnRight = document.getElementById('btn-right');
const ctx = canvas.getContext('2d', { alpha: false });

let W = 800, H = 600;
function resize(){
  W = Math.max(320, window.innerWidth);
  H = Math.max(320, window.innerHeight);
  canvas.width = W; canvas.height = H;
}
resize();
window.addEventListener('resize', resize);

// Game state
let score = 0, lives = 3, multiplier = 1;
let running = true, gameOver = false;
let highScore = Number(localStorage.getItem('nc_high') || 0);

const wallWidth = Math.max(72, Math.floor(Math.min(W,900) * 0.12));
let leftX = Math.floor(wallWidth * 0.8);
let rightX = Math.floor(W - wallWidth * 0.8);

const player = {
  side: 'left', // 'left' or 'right'
  x: leftX,
  y: H - 96,
  size: 52,
  switchCooldown: 0
};

// --- SIZE TUNING: increase entity sizes here (player unchanged) ---
const COIN_RADIUS = 18;       // was ~10
const POWER_RADIUS = 20;      // was ~12
const SPIKE_HALF = 18;        // used for drawing spike triangle (was 10)
const PARTICLE_SIZE = 6;      // was 4
const COLLIDE_COIN = 56;      // collision distance for coins (was 34)
const COLLIDE_POWER = 56;     // collision distance for powerups
const COLLIDE_SPIKE = 50;     // collision distance for spikes (was 30)
// ---------------------------------------------------------------

// Entities
let spikes = [], coins = [], powerups = [], particles = [];

// Timers (time-based)
let lastSpike = 0, lastCoin = 0, lastPower = 0;

// Difficulty scaling
function speedMultiplier(){ return 1 + Math.min(3, score / 200); }
function spawnInterval(base){ return Math.max(200, base - score * 2); }

// Input
function switchSide(fromButton=false){
  if(gameOver) return;
  if(player.switchCooldown > 0) return;
  player.side = player.side === 'left' ? 'right' : 'left';
  player.x = player.side === 'left' ? leftX : rightX;
  // tilt briefly by toggling class (CSS variable --tilt handles rotation smoothly)
  const cls = player.side === 'left' ? 'tilt-left' : 'tilt-right';
  wrap.classList.add(cls);
  // keep tilt a bit longer and smoother
  setTimeout(()=> wrap.classList.remove(cls), 480);
  // small burst and shake
  addParticles(player.x, player.y - 20, ['#fff','#60a5fa','#f97316'], 10);
  doShake(6, 160);
  player.switchCooldown = 260; // ms
}
window.addEventListener('keydown', e=>{
  if(e.code === 'Space'){ switchSide(); e.preventDefault(); }
});
btnLeft.addEventListener('touchstart', e=>{ e.preventDefault(); switchSide(true); }, {passive:false});
btnRight.addEventListener('touchstart', e=>{ e.preventDefault(); switchSide(true); }, {passive:false});
btnLeft.addEventListener('mousedown', e=>{ e.preventDefault(); switchSide(true); });
btnRight.addEventListener('mousedown', e=>{ e.preventDefault(); switchSide(true); });
wrap.addEventListener('click', ()=>{ if(gameOver) reset(); });

// Screen shake state implemented via CSS variables so it composes with tilt
let shakeTime = 0, shakeIntensity = 0;
function doShake(intensity=8, duration=220){ shakeIntensity = intensity; shakeTime = duration; }

// Spawning
function spawnSpike(){
  const side = Math.random() < 0.5 ? 'left' : 'right';
  const x = side === 'left' ? leftX : rightX;
  // match spike fall speed to coins/powerups for consistent pacing
  const vy = (rand(0.9,1.6)) * speedMultiplier();
  spikes.push({x, y:-20, vy, side});
}
function spawnCoin(){
  const side = Math.random() < 0.5 ? 'left' : 'right';
  const x = side === 'left' ? leftX : rightX;
  coins.push({x, y:-10, vy: (rand(0.8,1.6))*speedMultiplier()});
}
function spawnPower(){
  const kinds = ['mult','extra','slow','bonus'];
  const kind = kinds[Math.floor(Math.random()*kinds.length)];
  const x = Math.random()<0.5? leftX : rightX;
  powerups.push({x, y:-20, vy: (rand(0.9,1.6))*speedMultiplier(), kind});
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

// Collision helper
function circleDist(ax,ay,bx,by){ return Math.hypot(ax-bx, ay-by); }

// Score / UI
function updateUI(){
  scoreEl.textContent = `Score: ${score}`;
  multEl.textContent = `x${multiplier}`;
  livesEl.textContent = `Lives: ${'❤'.repeat(Math.max(0,lives))}`;
}

// Game reset
function reset(){
  score = 0; lives = 3; multiplier = 1; spikes = []; coins = []; powerups = []; particles = []; gameOver = false; running = true; msgEl.classList.remove('game-over'); msgEl.style.opacity = 0.9; msgEl.textContent = 'Tap left / right or press Space to switch';
}

// Main update loop
let last = performance.now();
function loop(now){
  const dt = now - last; last = now;
  if(player.switchCooldown > 0) player.switchCooldown = Math.max(0, player.switchCooldown - dt);

  if(running && !gameOver){
    // spawn based on timers and dynamic intervals
    lastSpike += dt; lastCoin += dt; lastPower += dt;
    if(lastSpike > spawnInterval(800)){ spawnSpike(); lastSpike = 0; }
    if(lastCoin > spawnInterval(1100)){ spawnCoin(); lastCoin = 0; }
    if(lastPower > spawnInterval(4000 + Math.random()*2000)){ spawnPower(); lastPower = 0; }

    // update entities
    const spdMul = speedMultiplier();
    for(let i=spikes.length-1;i>=0;i--){ const s=spikes[i]; s.y += s.vy; if(s.y > H+40) spikes.splice(i,1); }
    for(let i=coins.length-1;i>=0;i--){ const c=coins[i]; c.y += c.vy; if(c.y > H+40) coins.splice(i,1); }
    for(let i=powerups.length-1;i>=0;i--){ const p=powerups[i]; p.y += p.vy; if(p.y > H+40) powerups.splice(i,1); }

    // particles
    for(let i=particles.length-1;i>=0;i--){ const p=particles[i]; p.x += p.vx; p.y += p.vy; p.vy += 0.12; p.age++; if(p.age>p.life) particles.splice(i,1); }

    // collisions
    const px = player.x; const py = player.y - 12;
    // coins
    for(let i=coins.length-1;i>=0;i--){ const c = coins[i]; if(circleDist(px,py,c.x,c.y) < COLLIDE_COIN){ score += 10 * multiplier; addParticles(c.x,c.y,['#ffcf00','#ffd166','#fff'], 28); doShake(6,110); coins.splice(i,1); } }
    // powerups
    for(let i=powerups.length-1;i>=0;i--){ const p = powerups[i]; if(circleDist(px,py,p.x,p.y) < COLLIDE_POWER){
      if(p.kind === 'mult'){ multiplier = Math.min(5, multiplier + 1); setTimeout(()=> multiplier = Math.max(1, multiplier - 1), 8000); }
      else if(p.kind === 'extra'){ lives = Math.min(5, lives + 1); }
      else if(p.kind === 'slow'){ spikes.forEach(s=>s.vy *= 0.6); setTimeout(()=> spikes.forEach(s=> s.vy /= 0.6), 7000); }
      else if(p.kind === 'bonus'){ score += 50; }
      addParticles(p.x,p.y,['#6ee7b7','#60a5fa','#f472b6'], 32); doShake(8,160); powerups.splice(i,1);
    } }

    // spikes collisions
    for(let i=spikes.length-1;i>=0;i--){ const s = spikes[i]; if(circleDist(px,py,s.x,s.y) < COLLIDE_SPIKE){
      // hit
      addParticles(px,py,['#f87171','#fb7185','#fff'], 40);
      doShake(18,260);
      lives -= 1; score = Math.max(0, score - 12);
      spikes.splice(i,1);
      if(lives <= 0){ gameOver = true; running = false; msgEl.textContent = 'Game Over — Click to restart'; msgEl.classList.add('game-over'); msgEl.style.opacity = 1; if(score > highScore){ highScore = score; localStorage.setItem('nc_high', highScore); msgEl.textContent = 'New High Score! Click to restart'; } }
      break;
    } }

    // accelerate difficulty slowly as score increases - handled in spawnInterval and speedMultiplier
  }

  // shake handling via CSS variables so tilt and shake compose
  if(shakeTime > 0){
    shakeTime -= dt;
    const t = Math.max(0, shakeTime);
    const s = (t/220) * shakeIntensity;
    const ox = rand(-s,s), oy = rand(-s,s);
    wrap.style.setProperty('--tx', `${ox}px`);
    wrap.style.setProperty('--ty', `${oy}px`);
  } else {
    wrap.style.setProperty('--tx', `0px`);
    wrap.style.setProperty('--ty', `0px`);
  }

  render(); updateUI();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

function render(){
  // draw background
  ctx.fillStyle = '#041226'; ctx.fillRect(0,0,W,H);
  // decorative background: mountains + gradient
  const g = ctx.createLinearGradient(0,0,0,H); g.addColorStop(0,'#071530'); g.addColorStop(1,'#041226'); ctx.fillStyle = g; ctx.fillRect(0,0,W,H);

  // subtle stars/parallax
  ctx.fillStyle = 'rgba(255,255,255,0.03)'; for(let i=0;i<80;i++){ const sx = (i*97) % W; const sy = (i*61 + (score*0.3))%H; ctx.fillRect(sx, sy, 1.2, 1.2); }

  // walls
  ctx.fillStyle = '#071521'; ctx.fillRect(0,0,wallWidth,H); ctx.fillRect(W-wallWidth,0,wallWidth,H);
  // wall patterns - vertical bamboo strokes
  for(let y=10;y<H;y+=30){ ctx.fillStyle = 'rgba(255,255,255,0.02)'; ctx.fillRect(12,y,3,16); ctx.fillRect(W-15,y,3,16); }

  // draw coins
  coins.forEach(c=>{
    ctx.beginPath(); ctx.fillStyle = '#ffd166'; ctx.arc(c.x, c.y, COIN_RADIUS, 0, Math.PI*2); ctx.fill(); ctx.fillStyle = '#fff8'; ctx.fillRect(c.x-6, c.y-8, 10,6);
  });

  // draw powerups
  powerups.forEach(p=>{
    ctx.save(); ctx.translate(p.x, p.y);
    ctx.beginPath(); if(p.kind==='mult'){ ctx.fillStyle='#60a5fa'; ctx.arc(0,0,POWER_RADIUS,0,Math.PI*2); ctx.fill(); ctx.fillStyle='#fff'; ctx.font='18px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('x',0,0); }
    else if(p.kind==='extra'){ ctx.fillStyle='#fb7185'; ctx.arc(0,0,POWER_RADIUS,0,Math.PI*2); ctx.fill(); ctx.fillStyle='#fff'; ctx.font='18px sans-serif'; ctx.fillText('+',0,0); }
    else if(p.kind==='slow'){ ctx.fillStyle='#34d399'; ctx.arc(0,0,POWER_RADIUS,0,Math.PI*2); ctx.fill(); ctx.fillStyle='#fff'; ctx.font='18px sans-serif'; ctx.fillText('-',0,0); }
    else { ctx.fillStyle='#a78bfa'; ctx.arc(0,0,POWER_RADIUS,0,Math.PI*2); ctx.fill(); ctx.fillStyle='#fff'; ctx.font='18px sans-serif'; ctx.fillText('★',0,0); }
    ctx.restore();
  });

  // draw spikes (bigger)
  spikes.forEach(s=>{
    ctx.save(); ctx.translate(s.x, s.y);
    ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.moveTo(-SPIKE_HALF, -Math.floor(SPIKE_HALF/1.8)); ctx.lineTo(SPIKE_HALF, 0); ctx.lineTo(-SPIKE_HALF, Math.floor(SPIKE_HALF/1.8)); ctx.closePath(); ctx.fill();
    ctx.restore();
  });

  // draw player as emoji, anchored at bottom on current side
  ctx.save(); ctx.font = `${player.size}px serif`; ctx.textAlign='center'; ctx.textBaseline='middle';
  const px = player.x; const py = player.y;
  // small shadow
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.beginPath(); ctx.ellipse(px+6, py+24, 22, 8, 0, 0, Math.PI*2); ctx.fill();
  // emoji
  ctx.fillStyle = '#fff'; ctx.fillText('🥷🏻', px, py-6);
  ctx.restore();

  // particles (slightly larger)
  particles.forEach(p=>{
    ctx.globalAlpha = 1 - (p.age / p.life);
    ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, PARTICLE_SIZE, PARTICLE_SIZE);
    ctx.globalAlpha = 1;
  });

  // HUD overlays (score etc already in DOM)
}

// initial positioning
function recomputeLayout(){
  leftX = Math.floor(Math.max(72, Math.min(W*0.12, 120)) * 0.9);
  rightX = Math.floor(W - leftX);
  player.x = player.side === 'left' ? leftX : rightX;
  player.y = H - 96;
}
window.addEventListener('resize', ()=>{ resize(); recomputeLayout(); }); recomputeLayout();

// small helper to start with a bit of instructions fade
setTimeout(()=> msgEl.style.opacity = 0.9, 1000);
setTimeout(()=> msgEl.style.opacity = 0.6, 4000);

// friendly autosave high score on unload
window.addEventListener('beforeunload', ()=> localStorage.setItem('nc_high', highScore));
