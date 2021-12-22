// #!/usr/bin/env node
// const readPackageJson = require('read-package-json-fast')
const path = require('path')
const projectPath = path.resolve( process.cwd(), '../../' )
module.exports = async function(){
    const fs = require('fs')
    const pkgPath = path.resolve(projectPath, 'package.json')
    // let pkgStr = await fs.readFile(pkgPath)
    // const pkg = JSON.parse(pkgStr)
    const pkg = require(pkgPath)
    if(pkg.scripts['wxci-publish']){
      delete pkg.scripts['wxci-publish']
      console.log(`pkg`, pkg)
      fs.writeFile(pkgPath, JSON.stringify(pkg, null, 2), { encoding: 'utf8' }, err => {})
    }
    console.info("[nodegit] Completed installation successfully.");
}

console.log('uniapp-weixin-ci postuninstall ...')
if (require.main === module) {
  module.exports()
    .catch(function(e) {
      console.error("[uniapp-weixin-ci] ERROR - Could not finish install");
      console.error("[uniapp-weixin-ci] ERROR - finished with error code: " + e);
      process.exit(e);
    });
}
