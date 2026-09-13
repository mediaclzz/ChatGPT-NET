const fs=require('fs'),path=require('path'),{spawnSync}=require('child_process');

const root=path.resolve(__dirname,'..'),files=[path.join(root,'background.js')];
for(const dir of ['src','tests']){
  const walk=current=>{
    for(const entry of fs.readdirSync(current,{withFileTypes:true})){
      const file=path.join(current,entry.name);
      if(entry.isDirectory())walk(file);
      else if(entry.isFile()&&(entry.name.endsWith('.js')||entry.name.endsWith('.mjs')))files.push(file);
    }
  };
  walk(path.join(root,dir));
}

for(const file of files){
  const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
  if(result.status!==0){
    process.stderr.write(result.stderr||result.stdout||`Syntax check failed: ${file}\n`);
    process.exit(result.status||1);
  }
}
console.log(`syntax_check.js: PASS (${files.length} files)`);
