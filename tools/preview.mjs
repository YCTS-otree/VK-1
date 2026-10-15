import http from 'node:http'
import { apply } from '../dsh-plugin/index-v12.js'
const routes = new Map()
let transform, dispose, balance = 100
apply({ webServer: { register(route) { routes.set(route.path, route); return () => {} }, tapIndex(fn) { transform = fn; return () => {} } }, credentials: {}, effect(fn) { dispose = fn() } })
const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>VK-1 插件交互验证</title><style>body{font:16px/1.6 system-ui;margin:0;background:#f5f7fb;color:#24324d}main{max-width:760px;margin:40px auto;padding:24px}button{padding:9px 14px;margin:5px;border-radius:8px;border:1px solid #bcc8e0;background:white}aside{padding:20px;background:white;border:1px solid #d9dfec;border-radius:14px}h1{font-size:24px}p{max-width:580px}</style><main><h1>VK-1 插件交互验证</h1><p>使用真实 bundle 注入与素材路由，余额为模拟数据，不访问账号或真实余额接口。</p><aside><button onclick="stroke()">连续抚摸</button><button onclick="change(-.05)">模拟真实扣费 0.05</button><button onclick="change(3)">模拟真实充值 3</button><button onclick="reloadWidget()">卸载并重新挂载</button><button onclick="stopWidget()">卸载插件</button><button onclick="fetch('/fixture/fail').then(()=>location.reload())">模拟离线</button><button onclick="fetch('/fixture/restore').then(()=>location.reload())">恢复连接</button><p id="status">模拟余额 100.00 元</p></aside><p>右键角色打开菜单。验证抚摸、拖动、尺寸、平板双击、喂食、铁盆堆叠和设置保存。</p></main><script>function stroke(){let r=document.querySelector('.dshvk1-root').getBoundingClientRect(),i=0;let timer=setInterval(()=>{document.dispatchEvent(new PointerEvent('pointermove',{clientX:r.x+r.width*(.33+Math.sin(i/3)*.06),clientY:r.y+r.height*.36,pointerType:'mouse',bubbles:true}));if(++i>600)clearInterval(timer)},16)}async function change(d){let r=await fetch('/fixture/balance?delta='+d);statusEl().textContent='模拟余额 '+await r.text()+' 元'}function statusEl(){return document.getElementById('status')}function stopWidget(){window.__dshAppearanceWidgets['dsh-vk1-balance-widget'].stop()}function reloadWidget(){stopWidget();let s=document.createElement('script');s.src='/dsh-vk1/widget.js?test='+Date.now();document.body.appendChild(s)}</script></html>`
let failed = false
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost')
  if (url.pathname === '/') { res.setHeader('Content-Type', 'text/html; charset=utf-8'); return res.end(transform(html)) }
  if (url.pathname === '/fixture/balance') { balance += Number(url.searchParams.get('delta')); return res.end(balance.toFixed(2)) }
  if (url.pathname === '/fixture/fail') { failed = true; return res.end('ok') }
  if (url.pathname === '/fixture/restore') { failed = false; return res.end('ok') }
  if (url.pathname === '/fixture/audio.wav') {
    const data = new ArrayBuffer(44 + 8000 * 2), v = new DataView(data)
    function str(o,s) { for(let i=0;i<s.length;i++)v.setUint8(o+i,s.charCodeAt(i)) }
    str(0,'RIFF');v.setUint32(4,data.byteLength-8,true);str(8,'WAVEfmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,8000,true);v.setUint32(28,16000,true);v.setUint16(32,2,true);v.setUint16(34,16,true);str(36,'data');v.setUint32(40,16000,true)
    for(let i=0;i<8000;i++)v.setInt16(44+2*i,Math.sin(i*440/8000*Math.PI*2)*8000,true)
    res.setHeader('Content-Type','audio/wav');return res.end(Buffer.from(data))
  }
  if (url.pathname === '/dsh-vk1/balance.json') { res.setHeader('Content-Type', 'application/json'); return res.end(JSON.stringify(failed ? {ok:false} : {ok:true,totalBalance:balance,serverTime:new Date().toUTCString()})) }
  const route = routes.get(url.pathname)
  if (route) return route.handler(req, res)
  res.writeHead(404); res.end()
})
server.listen(4317, '127.0.0.1', () => console.log('VK-1 fixture: http://127.0.0.1:4317'))
server.on('close', () => dispose?.())
