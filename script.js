// Ninja Climber - static canvas game
const canvas = document.getElementById('game');
const wrap = document.getElementById('game-wrap');
const scoreEl = document.getElementById('score');
const livesEl = document.getElementById('lives');
const multEl = document.getElementById('mult');
const msgEl = document.getElementById('msg');
const ctx = canvas.getContext('2d');

let W=420,H=760;
function resize(){
  const rect = wrap.getBoundingClientRect();
  W = Math.floor(rect.width); H = Math.floor(rect.height);
  canvas.width = W; canvas.height = H;
}
resize();
window.addEventListener('resize', resize);

// Game state
let score=0, lives=3, multiplier=1;
let running=true;
let player = {
  side: 'left', // 'left' or 'right'
  x: 64/2,
  y: H*0.7,
  w: 28,
  h: 44,
  climbSpeed: 1.2
};

const walls = {left:64, right:W-64};

// Entities
let spikes = [];
let coins = [];
let powerups = [];
let particles = [];

// Timers
let spikeTimer=0, coinTimer=0, powerTimer=0;

// Controls
function switchSide(){
  player.side = player.side==='left' ? 'right' : 'left';
  // tilt screen
  if(player.side==='left'){ wrap.classList.remove('tilt-right'); wrap.classList.add('tilt-left'); }
  else { wrap.classList.remove('tilt-left'); wrap.classList.add('tilt-right'); }
}
window.addEventListener('keydown', e=>{ if(e.code==='Space'){ switchSide(); e.preventDefault(); } });
wrap.addEventListener('click', ()=>switchSide());

// Utility
function rand(min,max){return Math.random()*(max-min)+min}

function spawnSpike(){
  // spawn on either wall randomly
  const side = Math.random()<0.5?'left':'right';
  const x = side==='left' ? 0 : W;
  // y anywhere along wall
  const y = rand(60,H-60);
  // direction of slide: opposite of player's vertical move. If player climbs up (y decreasing), spikes move down.
  // We'll let spikes move down when player.side==='left', and up when right (this gives 'opposite' feeling)
  const dir = player.side==='left'?1:-1;
  spikes.push({side,x,y,w:20,h:20,vy:dir*rand(0.6,1.8)});
}

function spawnCoin(){
  const side = Math.random()<0.5?'left':'right';
  const y = rand(80,H-120);
  coins.push({side,y,collected:false});
}

function spawnPower(){
  // powerups fall from top center-ish
  const kind = (Math.random()<0.4)?'mult': (Math.random()<0.6?'extra':'slow');
  powerups.push({x:W/2 + rand(-80,80), y:-20, vy:rand(1.2,2.4), kind, ttl:8000});
}

function addParticles(x,y,color,amount=18){
  for(let i=0;i<amount;i++){
    particles.push({x,y, vx:rand(-3,3), vy:rand(-4,2), life:rand(30,70), age:0, color});
  }
}

function drawUI(){
  scoreEl.textContent = `Score: ${score}`;
  livesEl.textContent = `Lives: ${'❤'.repeat(lives)}${'♡'.repeat(Math.max(0,3-lives))}`;
  multEl.textContent = `x${multiplier}`;
}

function collidesPlayerWall(y){
  // player rectangle area near wall
  return y>0 && y<H;
}

function update(){
  if(!running) return;
  // player auto-climbs up slowly
  player.y -= player.climbSpeed;
  if(player.y<40) player.y = H-60; // wrap-around climbing

  // spawn mechanics
  spikeTimer += 1;
  if(spikeTimer>60){ spawnSpike(); spikeTimer=0; }
  coinTimer +=1;
  if(coinTimer>90){ spawnCoin(); coinTimer=0; }
  powerTimer +=1;
  if(powerTimer>600){ spawnPower(); powerTimer=0; }

  // update spikes
  spikes.forEach(s=>{
    s.y += s.vy;
    // wrap along wall
    if(s.y > H+40) s.y = -20;
    if(s.y < -40) s.y = H+20;
  });

  // update coins (static on walls)
  // check collection
  for(let i=coins.length-1;i>=0;i--){
    const c = coins[i];
    const px = (player.side==='left')? 20 : W-20;
    const py = player.y;
    const cx = (c.side==='left')? 20 : W-20;
    const cy = c.y;
    const d = Math.hypot(px-cx,py-cy);
    if(d < 30){ score += 10*multiplier; addParticles(cx,cy,'#ffcf00',12); coins.splice(i,1); }
  }

  // update powerups
  for(let i=powerups.length-1;i>=0;i--){
    const p = powerups[i]; p.y += p.vy;
    // collide with player
    const px = (player.side==='left')? 20 : W-20;
    const py = player.y;
    if(Math.hypot(px-p.x,py-p.y) < 30){
      // apply
      if(p.kind==='mult'){ multiplier = Math.min(5,multiplier+1); setTimeout(()=>multiplier=Math.max(1,multiplier-1),8000); }
      else if(p.kind==='extra'){ lives = Math.min(5,lives+1); }
      else if(p.kind==='slow'){ spikes.forEach(s=>s.vy *= 0.6); setTimeout(()=>spikes.forEach(s=>s.vy /= 0.6),7000); }
      addParticles(p.x,p.y,'#6ee7b7',16);
      powerups.splice(i,1);
    } else if(p.y > H+40) powerups.splice(i,1);
  }

  // update particles
  for(let i=particles.length-1;i>=0;i--){
    const t = particles[i]; t.x += t.vx; t.y += t.vy; t.vy += 0.12; t.age++; if(t.age>t.life) particles.splice(i,1);
  }

  // check spike collisions
  for(let i=spikes.length-1;i>=0;i--){
    const s = spikes[i];
    const px = (player.side==='left')? 20 : W-20;
    const py = player.y - player.h/4; // hit area
    const sx = (s.side==='left')? 10 : W-10;
    const sy = s.y;
    const d = Math.hypot(px-sx,py-sy);
    if(d < 22){
      // hit!
      addParticles(px,py,'#f87171',22);
      lives -=1; score = Math.max(0, score-5);
      // knockback
      player.y += 40;
      // remove spike
      spikes.splice(i,1);
      if(lives<=0){ running=false; msgEl.textContent = 'Game over - Click to restart'; msgEl.style.opacity=1; }
    }
  }

  draw();
  drawUI();
}

function draw(){
  ctx.clearRect(0,0,W,H);

  // draw background gradient
  const g = ctx.createLinearGradient(0,0,0,H);
  g.addColorStop(0,'#061019'); g.addColorStop(1,'#07111b');
  ctx.fillStyle = g; ctx.fillRect(0,0,W,H);

  // walls
  ctx.fillStyle = '#0e1720'; ctx.fillRect(0,0,64,H); ctx.fillRect(W-64,0,64,H);
  // subtle texture lines
  ctx.strokeStyle='rgba(255,255,255,0.02)'; for(let i=0;i<H;i+=20){ ctx.beginPath(); ctx.moveTo(6,i); ctx.lineTo(58,i); ctx.stroke(); ctx.beginPath(); ctx.moveTo(W-58,i); ctx.lineTo(W-6,i); ctx.stroke(); }

  // coins
  coins.forEach(c=>{
    const cx = (c.side==='left')? 20 : W-20;
    const cy = c.y;
    // coin body
    ctx.beginPath(); ctx.fillStyle='#ffcf00'; ctx.arc(cx,cy,8,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#ffffff22'; ctx.fillRect(cx-3,cy-8,6,6);
  });

  // powerups
  powerups.forEach(p=>{
    ctx.save(); ctx.translate(p.x,p.y);
    if(p.kind==='mult'){
      ctx.fillStyle='#60a5fa'; ctx.beginPath(); ctx.arc(0,0,10,0,Math.PI*2); ctx.fill(); ctx.fillStyle='#fff'; ctx.font='12px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('x',0,0);
    } else if(p.kind==='extra'){
      ctx.fillStyle='#fb7185'; ctx.beginPath(); ctx.arc(0,0,10,0,Math.PI*2); ctx.fill(); ctx.fillStyle='#fff'; ctx.fillText('+',0,0);
    } else {
      ctx.fillStyle='#34d399'; ctx.beginPath(); ctx.arc(0,0,10,0,Math.PI*2); ctx.fill(); ctx.fillStyle='#fff'; ctx.fillText('-',0,0);
    }
    ctx.restore();
  });

  // spikes
  spikes.forEach(s=>{
    const sx = s.side==='left'? 10 : W-10; const sy = s.y;
    ctx.fillStyle='#b91c1c'; ctx.beginPath();
    if(s.side==='left'){
      ctx.moveTo(sx+8,sy-10); ctx.lineTo(sx+8,sy+10); ctx.lineTo(sx-6,sy); // triangle pointing right from wall
    } else {
      ctx.moveTo(sx-8,sy-10); ctx.lineTo(sx-8,sy+10); ctx.lineTo(sx+6,sy);
    }
    ctx.closePath(); ctx.fill();
  });

  // player
  ctx.save();
  const px = (player.side==='left')? 20 : W-20; const py = player.y;
  // body
  ctx.translate(px,py);
  ctx.fillStyle='#fff';
  // simple ninja: head and body
  ctx.beginPath(); ctx.arc(0,-6,10,0,Math.PI*2); ctx.fillStyle='#0f1724'; ctx.fill();
  ctx.fillStyle='#fff'; ctx.fillRect(-8,2,16,18);
  // bandana
  ctx.fillStyle='#ef4444'; ctx.fillRect(-10,-6,20,6);
  ctx.restore();

  // particles
  particles.forEach(p=>{
    ctx.fillStyle = p.color; ctx.globalAlpha = 1 - (p.age/p.life);
    ctx.fillRect(p.x,p.y,3,3);
    ctx.globalAlpha = 1;
  });

  // overlay info
  ctx.fillStyle='rgba(255,255,255,0.04)'; ctx.fillRect(0,H-20,W,20);
}

// restart
wrap.addEventListener('click', ()=>{ if(!running){ reset(); } });

function reset(){ score=0; lives=3; multiplier=1; spikes=[]; coins=[]; powerups=[]; particles=[]; player.y=H*0.7; running=true; msgEl.textContent=''; }

// main loop
function loop(){ update(); requestAnimationFrame(loop); }
loop();

// initial UI
drawUI();

// small accessibility: pause on blur
window.addEventListener('blur', ()=>running=false);
window.addEventListener('focus', ()=>{ if(lives>0) running=true; });
