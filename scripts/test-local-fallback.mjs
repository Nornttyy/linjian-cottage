import assert from 'node:assert/strict';
import {compileProject} from './test-support.mjs';

const project=compileProject({name:'local-fallback'});
const globalNames=['window','location','Image','requestAnimationFrame','cancelAnimationFrame','localStorage','fetch','setTimeout','clearTimeout'];
const originals=new Map(globalNames.map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)]));
const storage=new Map(),writes=[];
let timerId=0,checks=0,failures=0,rejectedWrites=0,rejectWrite=()=>false;

Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{
    getItem:key=>storage.get(key)??null,
    setItem(key,value){if(rejectWrite(key)){rejectedWrites++;throw new DOMException('blocked','QuotaExceededError');}const text=String(value);storage.set(key,text);writes.push({key,value:text});},
    removeItem:key=>storage.delete(key),
    clear(){storage.clear();},
}});
globalThis.window={addEventListener(){},removeEventListener(){}};
globalThis.location={href:'https://nornttyy.github.io/linjian-cottage/',origin:'https://nornttyy.github.io'};
globalThis.Image=class{};
globalThis.requestAnimationFrame=()=>1;
globalThis.cancelAnimationFrame=()=>{};
globalThis.setTimeout=()=>++timerId;
globalThis.clearTimeout=()=>{};

try{
    const [{GameClient},simulation,guide]=await Promise.all([
        import(project.module('client')),
        import(project.module('simulation')),
        import(project.module('tutorial')),
    ]);
    const clients=[];
    const canvas=()=>({
        width:800,height:400,clientWidth:800,clientHeight:400,
        addEventListener(){},removeEventListener(){},setPointerCapture(){},
        getBoundingClientRect(){return{left:0,top:0,width:800,height:400};},
    });
    const makeClient=(messages=[])=>{
        const client=new GameClient(canvas(),()=>{},message=>messages.push(message),()=>{},'https://linjian-cottage.example/api/game');
        clients.push(client);
        return client;
    };
    const localKey=session=>`linjian-local-world:${session.room}:${session.playerId}`;
    const settle=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
    const reset=()=>{storage.clear();writes.length=0;rejectedWrites=0;rejectWrite=()=>false;};
    const failNetwork=(calls,reason='Failed to fetch')=>{
        globalThis.fetch=async(_url,options={})=>{
            calls.push(options.body?JSON.parse(options.body):null);
            throw new TypeError(reason);
        };
    };
    const seedLocal=(overrides={})=>{
        const session={room:'LOCAL123',playerId:'local-player',token:'local-token',local:true};
        const world=simulation.createWorld(Date.now());
        world.players[session.playerId]=simulation.createPlayer(session.playerId,'local','旅人',0,Date.now());
        Object.assign(world.players[session.playerId],overrides);
        storage.set('linjian-session',JSON.stringify(session));
        storage.set(localKey(session),JSON.stringify(world));
        return{session,world};
    };
    const test=async(name,run)=>{
        checks++;
        try{await run();console.log('PASS',name);}
        catch(error){failures++;console.error('FAIL',name,error?.stack??error);}
    };

    await test('新建世界网络失败后自动进入并保存本机世界',async()=>{
        reset();const calls=[],messages=[];failNetwork(calls);
        const client=makeClient(messages);
        try{
            await client.connect('create');
            assert.deepEqual(calls,[{action:'create'}]);
            assert.equal(client.connected,true,`connect error: ${client.error}`);
            assert.equal(client.error,'');
            assert.equal(client.session?.local,true);
            assert.match(client.session.room,/^LOCAL[A-Z0-9]{3}$/);
            assert.equal(messages.at(-1),'多人服务器不可用，已进入本机世界');
            const saved=JSON.parse(storage.get('linjian-session'));
            assert.deepEqual(saved,client.session);
            const world=JSON.parse(storage.get(localKey(saved)));
            assert.ok(world.players[saved.playerId]);
            assert.deepEqual(writes.slice(-2).map(write=>write.key),[localKey(saved),'linjian-session']);
            assert.equal(client.localSaved,true);
        }finally{client.destroy();}
    });

    await test('本机世界动作同步后立即写入本机存档',async()=>{
        reset();const calls=[];failNetwork(calls);
        const client=makeClient();
        try{
            await client.connect('create');
            client.ready=true;
            const key=localKey(client.session),before=storage.get(key);
            assert.equal(client.command({type:'dodge'}),true);
            await settle();
            const saved=JSON.parse(storage.get(key)),player=saved.players[client.session.playerId];
            assert.notEqual(storage.get(key),before);
            assert.equal(player.seq,1);
            assert.equal(player.stamina,72);
            assert.equal(saved.events.at(-1)?.kind,'dodge');
            assert.equal(calls.length,1,'本机动作不应再发起网络请求');
        }finally{client.destroy();}
    });

    await test('新客户端 resume 本机会话时无需网络并恢复存档',async()=>{
        reset();const {session}=seedLocal({stamina:41,kills:7});let fetches=0;
        globalThis.fetch=async()=>{fetches++;throw new Error('resume 不应访问网络');};
        const client=makeClient();
        try{
            await client.connect('resume');
            assert.equal(fetches,0);
            assert.equal(client.connected,true);
            assert.deepEqual(client.session,session);
            assert.equal(client.world.players[session.playerId].stamina,41);
            assert.equal(client.world.players[session.playerId].kills,7);
        }finally{client.destroy();}
    });

    await test('join 网络失败不能伪装成本机联机',async()=>{
        reset();const {session}=seedLocal(),calls=[],messages=[],before=storage.get('linjian-session');failNetwork(calls);
        const client=makeClient(messages);
        try{
            await client.connect('join','abcd1234');
            assert.deepEqual(calls,[{action:'join',room:'ABCD1234'}]);
            assert.equal(client.connected,false);
            assert.equal(client.session,null);
            assert.equal(client.error,'多人服务器暂时无法连接');
            assert.deepEqual(messages,[]);
            assert.equal(storage.get('linjian-session'),before);
            assert.deepEqual(JSON.parse(before),session);
        }finally{client.destroy();}
    });

    await test('本机世界写入失败时保留旧会话并明确标记无法保存',async()=>{
        reset();const previous={room:'OLDROOM1',playerId:'old-player',token:'old-token'},calls=[],messages=[];
        storage.set('linjian-session',JSON.stringify(previous));failNetwork(calls);rejectWrite=key=>key.startsWith('linjian-local-world:');
        const client=makeClient(messages);
        try{
            await client.connect('create');
            assert.equal(client.connected,true);
            assert.equal(client.session?.local,true);
            assert.equal(client.localSaved,false);
            assert.deepEqual(JSON.parse(storage.get('linjian-session')),previous);
            assert.equal(messages.at(-1),'已进入本机世界，但此设备无法保存');
            for(let i=0;i<20;i++)client.localRequest({action:'sync'});
            assert.equal(rejectedWrites,1,'存储失败后不应按同步帧反复序列化和写入');
        }finally{client.destroy();}
    });

    await test('缺失的本机存档不会静默重建并覆盖',async()=>{
        reset();const session={room:'LOCAL123',playerId:'local-player',token:'local-token',local:true};
        storage.set('linjian-session',JSON.stringify(session));let fetches=0;globalThis.fetch=async()=>{fetches++;throw Error('不应访问网络');};
        const client=makeClient();
        try{
            await client.connect('resume');
            assert.equal(fetches,0);
            assert.equal(client.connected,false);
            assert.equal(client.session,null);
            assert.equal(client.error,'本机存档无法读取，请返回主菜单新建世界');
            assert.deepEqual(JSON.parse(storage.get('linjian-session')),session);
            assert.equal(storage.has(localKey(session)),false);
        }finally{client.destroy();}
    });

    await test('服务器明确拒绝创建时不会伪装成网络中断并回退单机',async()=>{
        reset();globalThis.fetch=async()=>({ok:false,status:400,json:async()=>({error:'暂时不能创建世界'})});
        const client=makeClient();
        try{
            await client.connect('create');
            assert.equal(client.connected,false);
            assert.equal(client.session,null);
            assert.equal(client.error,'暂时不能创建世界');
            assert.equal(storage.has('linjian-session'),false);
        }finally{client.destroy();}
    });

    await test('savedSession 保留经验证的 local 标记',()=>{
        const session={room:'LOCAL123',playerId:'local-player',token:'local-token',local:true};
        assert.deepEqual(guide.savedSession(JSON.stringify(session)),session);
        assert.deepEqual(
            guide.savedSession(JSON.stringify({...session,local:'true'})),
            {room:session.room,playerId:session.playerId,token:session.token},
        );
    });

    clients.forEach(client=>client.destroy());
    console.log(`${checks} local fallback checks; ${failures} failures`);
    process.exitCode=failures?1:0;
}finally{
    for(const[name,descriptor]of originals){
        if(descriptor)Object.defineProperty(globalThis,name,descriptor);
        else delete globalThis[name];
    }
    project.cleanup();
}
