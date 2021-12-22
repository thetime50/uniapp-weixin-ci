// #!/usr/bin/env node
// const readPackageJson = require('read-package-json-fast')
const projectPath = process.cwd()
module.exports = async function(){
    const fs = require('fs')
    const path = require('path')
    let file = path.resolve( projectPath,'./file.txt')
    let data = {
        a: 1
    }
    // 异步写入数据到文件
    fs.writeFile(file, JSON.stringify(data, null, 4), { encoding: 'utf8' }, err => {})
    // const pkg = await readPackageJson(path.resolve(projectPath, 'package.json'))
    // console.log(pkg)
    console.log(this)
    console.info("[nodegit] Completed installation successfully.");
}

console.log(`* require.main.filename`, require.main.filename)
console.log(`* module.paths`, module.paths)
console.log(`* process.cwd()`, process.cwd())
console.log(`* __filename`, __filename)

console.log('postinstall')
console.error('* postinstall')
if (require.main === module) {
  console.log('module')

  module.exports()
    .catch(function(e) {
      console.error("[uniapp-weixin-ci] ERROR - Could not finish install");
      console.error("[uniapp-weixin-ci] ERROR - finished with error code: " + e);
      process.exit(e);
    });
}


      // console.error("[uniapp-weixin-ci] ERROR - Could not finish install");
      // console.error("[uniapp-weixin-ci] ERROR - finished with error code: " );
      // process.exit();