// script.js - Ninja Climber
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let W = canvas.width = innerWidth;
let H = canvas.height = innerHeight;

const scoreEl = document.getElementById('score');
const powerupsEl = document.getElementById('powerups');
const overlay = document.getElementById('overlay');
const gameWrap = document.getElementById('game-wrap');
const gameOverEl = document.getElementById('gameOver');
const finalScoreEl = document.getElementById('finalScore');

let isMobileInput = false;
let running = false;
let gameSpeed = 1; // world scroll speed multiplier
let shakeAmt = 0;

const GRAVITY = 0.8;

window.addEventListener('resize', ()=>{
  W = canvas.width = innerWidth;
  H = canvas.height = innerHeight;
});

// Start UI
document.getElementById('pcBtn').addEventListener('click', ()=>start(false));
document.getElementById('mobileBtn').addEventListener('click', ()=>start(true));
document.getElementById('restartBtn').addEventListener('click', ()=>reset());

function start(mobile){
  isMobileInput = mobile;
  overlay.classList.add('hidden');
  setTimeout(()=>overlay.classList.remove('visible'),200);
  init();
}

// Basic game state
let player, entities, particles, spawnTimer, score, multiplierTimer, magnetTimer, shieldActive;

function init(){
  running = true;
  score = 0;
  entities = [];
  particles = [];
  spawnTimer = 0;
  multiplierTimer = 0;
  magnetTimer = 0;
  shieldActive = false;
  gameSpeed = 1;
  player = new Player();
  bindInput();
  loop();
}

function reset(){
  gameOverEl.classList.add('hidden');
  overlay.classList.remove('hidden');
}

function endGame(){
  running = false;
  gameOverEl.classList.remove('hidden');
  finalScoreEl.textContent = 'Score: ' + score;
}

// Player
class Player{
  constructor(){
    this.side = 'left'; // left or right
    this.x = W*0.15;
    this.y = H*0.5;
    this.radius = Math.min(28, W*0.03);
    this.color = '#fff';
    this.targetX = this.x;
    this.vy = 0;
    this.tilt = -6; // deg
    this.scale = 1;
  }
  switchSide(){
    this.side = this.side === 'left' ? 'right' : 'left';
    this.targetX = this.side === 'left' ? W*0.15 : W*0.85;
    this.vy = -8; // hop up a bit
    // tilt UI
    tiltScreen(this.side);
    // juicy
    shake(6);
  }
  update(){
    // smooth x
    this.x += (this.targetX - this.x) * 0.25;
    this.vy += GRAVITY * 0.35;
    this.y += this.vy;
    // clamp
    if(this.y > H*0.8) this.y = H*0.8, this.vy = 0;
    if(this.y < H*0.2) this.y = H*0.2;
    // bounce subtle
    this.scale += (1 - this.scale) * 0.1;
  }
  draw(){
    ctx.save();
    ctx.translate(this.x, this.y);
    // ninja body
    ctx.fillStyle = this.color;
    // head
    ctx.beginPath();
    ctx.arc(0, -this.radius*0.25, this.radius*0.4, 0, Math.PI*2);
    ctx.fill();
    // body
    ctx.beginPath();
    ctx.ellipse(0, this.radius*0.2, this.radius*0.6*this.scale, this.radius*0.9*this.scale, 0, 0, Math.PI*2);
    ctx.fill();
    // eye slits
    ctx.fillStyle = '#111';
    ctx.fillRect(-this.radius*0.2, -this.radius*0.35, this.radius*0.12, 3);
    ctx.fillRect(this.radius*0.06, -this.radius*0.35, this.radius*0.12, 3);
    ctx.restore();
  }
}

// Entities: spikes, coins, powerups
class Spike{
  constructor(side, y){
    this.side = side;
    this.x = side==='left'?W*0.05:W*0.95;
    this.y = y || -50;
    this.w = Math.min(32, W*0.03);
    this.h = this.w*1.4;
    this.color = '#ff5f5f';
  }
  update(dt){
    this.y += 160 * dt * gameSpeed;
  }
  draw(){
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.moveTo(-this.w, this.h);
    ctx.lineTo(0, -this.h);
    ctx.lineTo(this.w, this.h);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

class Coin{
  constructor(side, y){
    this.side = side;
    this.x = side==='left'?W*0.12:W*0.88;
    this.y = y || -30;
    this.r = Math.min(12, W*0.015);
    this.collected = false;
  }
  update(dt){
    this.y += 140 * dt * gameSpeed;
    // magnet
    if(magnetTimer>0){
      // move toward player
      const dx = player.x - this.x;
      const dy = player.y - this.y;
      this.x += dx * 0.06;
      this.y += dy * 0.06;
    }
  }
  draw(){
    ctx.save();
    ctx.translate(this.x, this.y);
    // coin by two rings
    const g = ctx.createLinearGradient(-this.r,-this.r,this.r,this.r);
    g.addColorStop(0,'#ffea8a');g.addColorStop(1,'#ffcc00');
    ctx.fillStyle = g;
    ctx.beginPath();ctx.arc(0,0,this.r,0,Math.PI*2);ctx.fill();
    ctx.fillStyle = '#c77b00';ctx.fillRect(-this.r*0.45,-this.r*0.15,this.r*0.9,this.r*0.3);
    ctx.restore();
  }
}

class Powerup{
  constructor(type, side, y){
    this.type = type; // 'double'|'magnet'|'shield'|'scoreburst'
    this.side = side;
    this.x = side==='left'?W*0.12:W*0.88;
    this.y = y || -60;
    this.r = Math.min(16, W*0.02);
  }
  update(dt){
    this.y += 130 * dt * gameSpeed;
  }
  draw(){
    ctx.save();ctx.translate(this.x,this.y);
    if(this.type==='double'){
      ctx.fillStyle='#9b59ff';
      ctx.beginPath();ctx.arc(0,0,this.r,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#fff';ctx.font=`${this.r}px sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('x2',0,0);
    }else if(this.type==='magnet'){
      ctx.fillStyle='#39b6ff';ctx.beginPath();ctx.arc(0,0,this.r,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fff';ctx.fillText('M',0,0);
    }else if(this.type==='shield'){
      ctx.fillStyle='#32cd32';ctx.beginPath();ctx.arc(0,0,this.r,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fff';ctx.fillText('S',0,0);
    }else{
      ctx.fillStyle='#ff8c42';ctx.beginPath();ctx.arc(0,0,this.r,0,Math.PI*2);ctx.fill();ctx.fillStyle='#111';ctx.fillText('+',0,0);
    }
    ctx.restore();
  }
}

// Particles
class Particle{
  constructor(x,y,color,life=700){
    this.x=x;this.y=y;this.vx=(Math.random()-0.5)*3;this.vy=(Math.random()-1.5)*-2;this.s=Math.random()*3+1;this.color=color;this.life=life;this.t=0;
  }
  update(dt){
    this.vy += 0.02;
    this.x += this.vx*dt*60;
    this.y += this.vy*dt*60;
    this.t += dt*1000;
  }
  draw(){
    ctx.save();ctx.globalAlpha = Math.max(0,1 - this.t/this.life);
    ctx.fillStyle=this.color;ctx.beginPath();ctx.arc(this.x,this.y,this.s,0,Math.PI*2);ctx.fill();ctx.restore();
  }
}

// utility
function tiltScreen(side){
  if(side==='left') gameWrap.style.transform = 'rotate(-6deg)';
  else gameWrap.style.transform = 'rotate(6deg)';
  setTimeout(()=>{gameWrap.style.transform = 'rotate(0deg)';}, 400);
}
function shake(a){shakeAmt = Math.max(shakeAmt, a);} 

// spawn
function spawnRandom(){
  const rand = Math.random();
  // spikes more likely
  if(rand < 0.5){
    const side = Math.random()<0.5?'left':'right';
    entities.push(new Spike(side, -60 - Math.random()*120));
  }else if(rand < 0.78){
    const side = Math.random()<0.5?'left':'right';
    entities.push(new Coin(side, -40 - Math.random()*80));
  }else{
    // powerup
    const types = ['double','magnet','shield','scoreburst'];
    const t = types[Math.floor(Math.random()*types.length)];
    const side = Math.random()<0.5?'left':'right';
    entities.push(new Powerup(t, side, -80));
  }
}

let last = performance.now();
function loop(now){
  if(!running) return;
  const dt = Math.min(1/30, (now - last)/1000);
  last = now;

  // spawn
  spawnTimer -= dt*60;
  if(spawnTimer <= 0){
    spawnRandom();
    spawnTimer = 35 + Math.random()*50; // ticks count
    // adjust difficulty
    gameSpeed += 0.002;
  }

  // update entities
  for(let i=entities.length-1;i>=0;i--){
    const e = entities[i];
    e.update(dt);
    // collisions
    if(e instanceof Spike){
      // collision if same side and near player
      if(e.side === player.side){
        const dy = Math.abs(e.y - player.y);
        if(dy < 60){
          if(shieldActive){
            // absorb and destroy
            shieldActive = false;entities.splice(i,1);spawnParticles(player.x,player.y,'#ffffff',12);
            shake(10);
          } else {
            spawnParticles(player.x,player.y,'#ff6b6b',25);
            shake(18);
            running = false;setTimeout(()=>endGame(),300);
            return;
          }
        }
      }
    }else if(e instanceof Coin){
      const dx = e.x - player.x, dy = e.y - player.y;
      const dist = Math.sqrt(dx*dx+dy*dy);
      if(dist < 40){
        // collect
        let val = 10;
        if(multiplierTimer>0) val *= 2;
        score += val;entities.splice(i,1);
        scoreEl.textContent = 'Score: ' + score;
        spawnParticles(e.x,e.y,'#ffd24a',12);
        shake(4);
      }
    }else if(e instanceof Powerup){
      const dx = e.x - player.x, dy = e.y - player.y;const dist=Math.sqrt(dx*dx+dy*dy);
      if(dist < 50){
        // apply
        applyPower(e.type);
        entities.splice(i,1);
        spawnParticles(e.x,e.y,'#7be2ff',18);
        shake(6);
      }
    }
    // cleanup offscreen
    if(e.y > H + 200) entities.splice(i,1);
  }

  // update particles
  for(let i=particles.length-1;i>=0;i--){
    particles[i].update(dt);
    if(particles[i].t > particles[i].life) particles.splice(i,1);
  }

  // update timers
  if(multiplierTimer>0){ multiplierTimer -= dt*1000; if(multiplierTimer<=0) multiplierTimer=0; }
  if(magnetTimer>0){ magnetTimer -= dt*1000; if(magnetTimer<=0) magnetTimer=0; }

  player.update();

  // draw
  draw(dt);

  requestAnimationFrame(loop);
}

function draw(dt){
  // camera shake
  let shakeX = 0, shakeY = 0;
  if(shakeAmt>0){
    shakeX = (Math.random()-0.5)*shakeAmt;
    shakeY = (Math.random()-0.5)*shakeAmt;
    shakeAmt -= 0.3; if(shakeAmt<0) shakeAmt=0;
  }

  ctx.clearRect(0,0,W,H);
  ctx.save();
  ctx.translate(shakeX,shakeY);

  // walls
  const wallW = Math.min(140, W*0.2);
  // left wall
  ctx.fillStyle = '#0c2b3b';
  roundRect(ctx, 0, 0, wallW, H, 0, true, false);
  // right wall
  roundRect(ctx, W-wallW, 0, wallW, H, 0, true, false);

  // patterns on wall
  for(let y=0;y<H;y+=80){
    ctx.fillStyle = 'rgba(255,255,255,0.02)';
    ctx.fillRect(12,y+20,wallW-24,6);
    ctx.fillRect(W-wallW+12,y+40,wallW-24,4);
  }

  // draw entities
  entities.forEach(e=>e.draw());
  // draw player
  player.draw();

  // draw particles
  particles.forEach(p=>p.draw());

  ctx.restore();

  // HUD handled by DOM for score, but show small inline powerup icons
  updateHUD();
}

function roundRect(ctx,x,y,w,h,r,fill,stroke){
  if(typeof r==='undefined') r=8;
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y,x+w,y+h,r);
  ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r);
  ctx.arcTo(x,y,x+w,y,r);
  ctx.closePath();
  if(fill) ctx.fill();
  if(stroke) ctx.stroke();
}

function spawnParticles(x,y,color,count=10){
  for(let i=0;i<count;i++) particles.push(new Particle(x + (Math.random()-0.5)*20, y + (Math.random()-0.5)*20, color, 700 + Math.random()*400));
}

function applyPower(type){
  if(type==='double'){ multiplierTimer = 8000; // ms
    powerMsg('Double Coins 8s');
  }else if(type==='magnet'){ magnetTimer = 6000; powerMsg('Magnet 6s'); }
  else if(type==='shield'){ shieldActive = true; powerMsg('Shield'); }
  else if(type==='scoreburst'){ score += 50; scoreEl.textContent = 'Score: ' + score; powerMsg('+50 Score'); }
}

function powerMsg(text){
  powerupsEl.textContent = text + (multiplierTimer>0?(' ('+Math.ceil(multiplierTimer/1000)+'s)'):'');
  setTimeout(()=>{ if(multiplierTimer<=0 && magnetTimer<=0) powerupsEl.textContent = '' }, 2500);
}

// Input
function bindInput(){
  // clear previous
  window.onkeydown = null; window.onkeyup=null; canvas.onclick=null; canvas.ontouchstart=null;
  if(isMobileInput){
    canvas.ontouchstart = (e)=>{ e.preventDefault(); player.switchSide(); };
    canvas.onclick = ()=>{ player.switchSide(); };
  } else {
    window.onkeydown = (e)=>{
      if(['ArrowLeft','ArrowRight','a','A','d','D'].includes(e.key)){
        if(e.key==='ArrowLeft' || e.key==='a' || e.key==='A'){
          if(player.side !== 'left') player.switchSide();
        } else {
          if(player.side !== 'right') player.switchSide();
        }
      }
    };
  }
}

// helper to update HUD DOM every frame-ish
let lastHud = 0;
function updateHUD(){
  // update powerup timer display
  let txt = '';
  if(multiplierTimer>0) txt = 'Double x2 ('+Math.ceil(multiplierTimer/1000)+'s)';
  else if(magnetTimer>0) txt = 'Magnet ('+Math.ceil(magnetTimer/1000)+'s)';
  else if(shieldActive) txt = 'Shield';
  powerupsEl.textContent = txt;
}

// simple collision helper not used - kept for extensibility

// initial spawn schedule
spawnTimer = 40;

// A little autoplayer fallback for desktops without key press after start
let idleTimer = 0;

// small touches: let tapping side-specific on desktop too
canvas.addEventListener('click', (e)=>{
  if(!running) return;
  if(!isMobileInput) {
    // toggle only if clicking on opposite side
    if(e.clientX < W/2 && player.side !== 'left') player.switchSide();
    else if(e.clientX >= W/2 && player.side !== 'right') player.switchSide();
  }
});

// expose for debugging
window.__game = {restart:reset};
