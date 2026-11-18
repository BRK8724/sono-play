import Phaser from 'phaser';
import {CONFIG, difficultyFor, themeFor, type ThemeName} from './config';
import {localDemoResult} from './security';
import './style.css';

type GamePhase='HOME'|'READY'|'PLAYING'|'GAME_OVER';
type Pair={top:Phaser.GameObjects.Rectangle;bottom:Phaser.GameObjects.Rectangle; x:number;gapCenter:number;gap:number;scored:boolean};
const overlay=document.querySelector<HTMLDivElement>('#overlay')!;
class FlappyScene extends Phaser.Scene {
  phase:GamePhase='HOME'; score=0; bird!:Phaser.GameObjects.Image; vy=0; pairs:Pair[]=[];
  ground!:Phaser.GameObjects.Rectangle; sky!:Phaser.GameObjects.Rectangle; theme:ThemeName='morning';
  skyColors:Record<ThemeName,number>={morning:0xf3bf9d,day:0x8ccefa,evening:0xb9789b,night:0x17294b};
  hud!:Phaser.GameObjects.Text;
  constructor(){super('FlappyScene')}
  preload(){this.load.image('bird','/assets/legacy/bird-body.png')}
  create(){
    this.sky=this.add.rectangle(180,320,360,640,this.skyColors.morning).setDepth(-2);
    this.ground=this.add.rectangle(180,602,360,76,0xcda76b).setDepth(10);
    this.bird=this.add.image(CONFIG.birdX,280,'bird').setDisplaySize(56,56).setDepth(8);
    this.hud=this.add.text(12,12,'SCORE 0', {font:'bold 22px monospace',color:'#fff',stroke:'#17294b',strokeThickness:3}).setDepth(20);
    this.input.on('pointerdown',()=>this.onTap());
    this.game.events.on('BLUR',()=>this.terminate('APP_BACKGROUND'));
    document.addEventListener('visibilitychange',()=>{if(document.hidden)this.terminate('APP_BACKGROUND')});
    window.addEventListener('pagehide',()=>this.terminate('APP_BACKGROUND'));
    this.showHome();
  }
  showHome(){this.clearPairs();this.phase='HOME';this.score=0;this.vy=0;this.bird.setPosition(CONFIG.birdX,280);this.hud.setText('');this.renderOverlay('SONO PLAY','Local prototype — no real scores or rewards',[['PLAY',()=>this.ready()],['STORE (design reference)',()=>this.referenceOnly('Store / screens 3, 5–8')],['STATS (design reference)',()=>this.referenceOnly('Stats / screens 1–2')]]);}
  ready(){this.phase='READY';this.clearPairs();this.score=0;this.theme='morning';this.sky.setFillStyle(this.skyColors.morning);this.bird.setPosition(CONFIG.birdX,285).setAngle(0);this.vy=0;this.hud.setText('SCORE 0');this.renderOverlay('TAP TO PLAY','Best score is server-owned in production.',[['START',()=>this.start()]]);}
  start(){if(this.phase!=='READY')return;this.phase='PLAYING';overlay.replaceChildren();this.spawnPair();}
  onTap(){if(this.phase==='READY'){this.start();this.vy=CONFIG.flapVelocity;} else if(this.phase==='PLAYING') this.vy=CONFIG.flapVelocity;}
  spawnPair(){const d=difficultyFor(this.score);const center=Phaser.Math.Between(170,CONFIG.groundY-170);const h=(CONFIG.height-CONFIG.groundY);const x=CONFIG.spawnStartX;const topH=Math.max(1,center-d.gap/2);const bottomY=center+d.gap/2;
    const top=this.add.rectangle(x,topH/2,CONFIG.pipeWidth,topH,0x3f9e46).setDepth(3);
    const bottom=this.add.rectangle(x,(bottomY+CONFIG.groundY)/2,CONFIG.pipeWidth,CONFIG.groundY-bottomY,0x3f9e46).setDepth(3);
    this.pairs.push({top,bottom,x,gapCenter:center,gap:d.gap,scored:false});
  }
  update(_time:number,delta:number){if(this.phase!=='PLAYING')return; const dt=Math.min(delta,50)/1000;
    this.vy+=CONFIG.gravity*dt;this.bird.y+=this.vy*dt;this.bird.angle=Phaser.Math.Clamp(this.vy/12,-25,75);
    if(this.bird.y<15||this.bird.y>CONFIG.groundY-15){this.terminate('COLLISION');return;}
    const h=22; // demo hitbox; final calibrated against actual visible sprite
    for(const p of this.pairs){p.x-=CONFIG.scrollSpeed*dt;p.top.x=p.x;p.bottom.x=p.x;
      if(Math.abs(p.x-this.bird.x)<(CONFIG.pipeWidth/2+h/2) && (this.bird.y-h/2<p.gapCenter-p.gap/2||this.bird.y+h/2>p.gapCenter+p.gap/2)){this.terminate('COLLISION');return;}
      if(!p.scored && p.x+CONFIG.pipeWidth/2<this.bird.x-h/2){p.scored=true;this.score++;this.hud.setText('SCORE '+this.score);this.updateTheme();}
    }
    this.pairs=this.pairs.filter(p=>{if(p.x < -CONFIG.pipeWidth){p.top.destroy();p.bottom.destroy();return false;}return true;});
    const last=this.pairs[this.pairs.length-1];if(!last||last.x<CONFIG.spawnStartX-difficultyFor(this.score).spacing)this.spawnPair();
  }
  updateTheme(){const next=themeFor(this.score);if(next!==this.theme){this.theme=next;this.tweens.addCounter({from:0,to:100,duration:2000,onUpdate:t=>{const a=Phaser.Display.Color.IntegerToColor(this.sky.fillColor);const b=Phaser.Display.Color.IntegerToColor(this.skyColors[next]);const c=Phaser.Display.Color.Interpolate.ColorWithColor(a,b,100,Math.round(t.getValue()??0));this.sky.setFillStyle(Phaser.Display.Color.GetColor(c.r,c.g,c.b));}});}}
  terminate(reason:'COLLISION'|'APP_BACKGROUND'){if(this.phase!=='PLAYING')return;this.phase='GAME_OVER';const r=localDemoResult(this.score);
    this.renderOverlay('GAME OVER',`Reason: ${reason}. Demo score: ${r.displayPipeScore} pipes. VERIFIED SCORE: unavailable. No rewards.`,[['RETRY',()=>this.ready()],['HOME',()=>this.showHome()]]);
  }
  clearPairs(){for(const p of this.pairs){p.top.destroy();p.bottom.destroy()}this.pairs=[];}
  referenceOnly(name:string){this.renderOverlay(name,'Design reference only. Purchasing, leaderboard and rewards disabled.',[['BACK',()=>this.showHome()]]);}
  renderOverlay(title:string,desc:string,btns:[string,()=>void][]){overlay.replaceChildren();const panel=document.createElement('div');panel.className='panel';const h=document.createElement('h1');h.textContent=title;const p=document.createElement('p');p.textContent=desc;panel.append(h,p);for(const [name,cb] of btns){const b=document.createElement('button');b.textContent=name;b.onclick=cb;panel.append(b)}overlay.append(panel);}
}
new Phaser.Game({type:Phaser.AUTO, parent:'game',width:CONFIG.width,height:CONFIG.height,backgroundColor:'#8ccefa',scene:[FlappyScene],scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH}});
