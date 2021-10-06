#!/usr/bin/env node
// 需要告诉npm脚本的执行环境
"use strict";

/**
 * 1. 命令行参数
 * 2. √ 命令行交互
 * 3. √ 执行编译
 *      3.1 √ child_process执行
 *      3.2 - cross-env / vue-cli-service - js 执行 
 *          // 不需要 vue-cli-service还是直接从命令行获取参数的 还是要通过child_process执行
 * 4. √ ci 配置
 * 5. √ sourceMap 保存
 * 6. √ git 对比
 * 7. √ 进度条
 * 8. √ 版本号自增加 版本号确认 git tag
 * 9. √ 依赖更新检查
 * 10. √ 打包npm 包
 * 11. 配置文件控制
 * 12. code review class
 */

const ora = require('ora') // 进度条
const fs = require('fs')
const pfs = require('fs/promises')
const path = require('path')
const {exec,spawn} = require('child_process') // 命令行程序执行
const program = require('commander') // 命令行交互提示
const inquirer = require('inquirer') // 命令行交互
var requireJSON5 = require('require-json5'); // 导入json5文件
const logSymbols = require('log-symbols')
require('colors') // 命令行输出颜色 // cli-color // todo colors-plue 参考 chalk
// shelljs?

const simpleGit = require( 'simple-git');

const table = require('text-table')
// const styles = require('ansistyles')

const args = require('minimist')(process.argv.slice(2)) // 命令行参数解析 解析process.argv
// console.log('hello'.blue.bgWhite)
const presolve = path.resolve

/**
 * 参数配置 
 */

// 文件目录检查
// 插入package script 命令

class APP_CFG_C {
    constructor(){
        this.APP_PLATFORM = 'mp-weixin'
        this.APP_VERSION = '0.0.0'
        this.APP_MESSAGE = '更新'
        this.APP_ERR_PATH = presolve('./outinfo')
        this.APP_SOURCEMAP_PATH = presolve('./outinfo')
        this.APP_SRC_PATH = presolve('./src')
        this.APP_PRIVATE_KEY_FILE = presolve('./keys/wx-private.key')
        this.APP_PROJECT_PATH = presolve('./dist/build/mp-weixin')
        this.APP_GIT_BRANCH = ['main','master']
    }
}

// todo create dir

const APP_CFG = new APP_CFG_C

/**
 * 命令行参数
 */
let appOptions = {}
const ignoreInfoList = {
        git:'git: 跳过所有git操作',
        gb:'gb: 跳过git branch 检查',
        gf:'gf: 跳过git fetch origin',
        gd:'gd: 跳过git diff',
        gt:'gt: 跳过git tag',
    
        no:'npm-outdated/no: 跳过npm outdated依赖更新检查',
    
        b:'build/b: 跳过npm run build:mp-weixin 编译小程序',
    
        ci:'ci: 跳过所有ci操作 (上传 下载sourceMap)',
        cs:'cs: 跳过下载sourceMap',
}
function argvOptionParse(){
    const ignoreOpts = [ // 内部检查都使用缩写
        'git',
        'gb',
        'gf',
        'gd',
        'gt',
        'npm-outdated',
        'no',
        'build',
        'b',
        'ci',
        'cs',
    ]
    const ignoreInfo = `跳过的操作步骤:
        ${ignoreInfoList.git}
        ${ignoreInfoList.gb}
        ${ignoreInfoList.gf}
        ${ignoreInfoList.gd}
        ${ignoreInfoList.gt}

        ${ignoreInfoList.no}

        ${ignoreInfoList.b}

        ${ignoreInfoList.ci}
        ${ignoreInfoList.cs}
    `
    function parseIgnore(value,previous){

        previous[value] = true
        if(value == 'npm-outdated'){
            previous.no = true
        }
        if(value == 'build'){
            previous.b = true
        }
        return previous
    }
    const pkg = require('../package')
    program
        .version(`${pkg.name} ${pkg.version}`)
        .option('-a, --annotate <string>', `tag 名称 版本号`,'') // 解析完直接更新到APP_CFG上去
        .option('-m, --message <string>', `版本更新信息`,'')
        .option('-b, --branch <string>', '选择分支','')
        .option('-ep --err-path <path>','错误文件目录','')
        .option('-smp --sourcemap-path <path>','sourcemap 文件目录','')
        .option('-sp --src-path <path>','uniapp 项目目录','')
        .option('-kf --private-key-file <file>','miniprogram-ci 微信小程序ci代码上传密钥文件','')
        .option('-pp --project-path <path>','微信小程序目录，uniapp 编译后的目录','')
        .option('-i, --ignore <type...>', ignoreInfo,parseIgnore,{})
        .parse(process.argv)
    appOptions = program.opts();

    const {ignore} = appOptions

    const errIgnore = Object.keys( ignore).filter((v,i,a)=>{
        return !ignoreOpts.includes(v)
    })

    if(errIgnore.length){
        throw new Error(`不支持的 ignore 参数: ${errIgnore.join(' ')} 执行 npx wxci-publish -h 查看说明`)
    }
    if(appOptions.annotate && !appOptions.message ||
        !appOptions.annotate && appOptions.message){
            throw new Error('请同时设置 annotate 和 message 参数')
        }
    if(appOptions.annotate){
        APP_CFG.APP_VERSION = appOptions.annotate
    }
    if(appOptions.message){
        this.APP_MESSAGE = appOptions.message
    }
    if(appOptions.branch){
        APP_CFG.APP_GIT_BRANCH = appOptions.branch
    }
    
    if(appOptions.errPath){
        this.APP_ERR_PATH = presolve(appOptions.errPath)
    }
    if(appOptions.sourcemapPath){
        this.APP_SOURCEMAP_PATH = presolve(appOptions.sourcemapPath)
    }
    if(appOptions.srcPath){
        this.APP_SRC_PATH = presolve(appOptions.srcPath)
    }
    if(appOptions.privateKeyFile){
        this.APP_PRIVATE_KEY_FILE = presolve(appOptions.privateKeyFile)
    }
    if(appOptions.projectPath){
        this.APP_PROJECT_PATH = presolve(appOptions.projectPath)
    }
}

function ignoreCheck(flag){ // 如果返回true 跳过执行 
    const res = appOptions.ignore[flag]
    if(res){
        console.log(`ignore ${ignoreInfoList[flag]}`,logSymbols.info)
    }
    return res
}

function isDirectory(path){
    try {
        var stat = fs.statSync(path);
        return stat.isDirectory();
    } catch (error) {
        return false
    }
}
function isFile(path){
    try {
        var stat = fs.statSync(path);
        return stat.isFile();
    } catch (error) {
        return false
    }
}
async function appCfgCheck(){
    if(!isDirectory(APP_CFG.APP_ERR_PATH)){
        fs.mkdirSync(APP_CFG.APP_ERR_PATH)
        await delay(20)
    }
    if(!isDirectory(APP_CFG.APP_SOURCEMAP_PATH)){
        fs.mkdirSync(APP_CFG.APP_SOURCEMAP_PATH)
    }
    if(!isFile(presolve(APP_CFG.APP_SRC_PATH,'manifest.json'))){
        throw new Error(`找不到文件 ${presolve(APP_CFG.APP_SRC_PATH,'manifest.json')}`)
    }
    if(!isFile(presolve(APP_CFG.APP_PRIVATE_KEY_FILE,))){
        throw new Error(`找不到文件 ${presolve(APP_CFG.APP_PRIVATE_KEY_FILE,)}`)
    }
}

const ansiTrimRe = new RegExp('\x1b(?:\\[(?:\\d+[ABCDEFGJKSTm]|\\d+;\\d+[Hfm]|' +
          '\\d+;\\d+;\\d+m|6n|s|u|\\?25[lh])|\\w)', 'g')
const ansiTrim = str => str.replace(ansiTrimRe, '')

function delay(ms) {
    return new Promise((resolve, reject) => {
        setTimeout(resolve, ms);
    })
}

async function gitCheck(){
    if(ignoreCheck('git')) return
    console.log(`*** git 仓库检查 ***`.blue.bgWhite,)

    let spinner
    try{
        const options = {
            binary: 'git',
            maxConcurrentProcesses: 6,
        };

        // when setting all options in a single object
        const git = simpleGit(process.cwd(), options);
        
        // 在主分支上
        const branch = await git.branchLocal()
        const branchStr = typeof APP_CFG.APP_GIT_BRANCH  == 'string' ? APP_CFG.APP_GIT_BRANCH : APP_CFG.APP_GIT_BRANCH.join(' or ')
        async function gitBranchCheck(){
            spinner = ora(`check branch is ${branchStr}`).start()
            if(branch.current !== APP_CFG.APP_GIT_BRANCH && !APP_CFG.APP_GIT_BRANCH.includes( branch.current)){
                let msg = `branch is ${branch.current.cyan} not ${branchStr}`
                spinner.stop()
                console.log(msg,logSymbols.error)
                throw new Error(msg)
            }
            spinner.stop()
            console.log('branch is '+ branch.current,logSymbols.success)
        }
    
        // 获取更新远端跟踪分支
        async function gitFetchOrigin(){
            spinner = ora('git fetch origin').start()
            try{
                await git.fetch('origin')
            }catch(e) {
                let msg = 'git fetch error'
                spinner.stop()
                console.log(msg,logSymbols.error)
                throw new Error(msg)
            }
            spinner.stop()
            console.log('git fetch ok',logSymbols.success)
        }

        // 检查当前分支已提交到远端
        async function gitDiffCheck(){
            const diff = await git.diff('remotes/origin/'+branch.current)
            spinner = ora('check diff').start()
            if(diff){
                let msg = `There are file that have not been commit`
                spinner.stop()
                console.log(msg,logSymbols.error)
                throw new Error(msg)
            }
            spinner.stop()
            console.log(`diff remotes/origin/${branch.current} ok`,logSymbols.success)
        }

        
        async function gitTag(){
            // git tag -n --sort=taggerdate 
            // const tages = await git.tags() // 按字母顺序排序
            const tages = await git.tags('-n',{'--sort': '-taggerdate'}) // 按打tag的时间从旧到新排序的
            // const tages = await git.tags('-n',{'--sort': '-committerdate'}) // 按提交时间从旧到新排序的
            const lastTag =tages.all.find((v,i,a)=>{
                // https://docs.npmjs.com/cli/v6/configuring-npm/package-json#version
                return /^v?(\d+\.)+\d+(-.*)?\b$/.test( v)
            }) || '0.0.0'
            let tail = lastTag.replace(/^v?(\d+\.)+(\d+).*/,'$2')
            tail = Number(tail)+1
            let newTage = lastTag.replace(/^(v?(\d+\.)+)(\d+).*/,'$1'+tail)
            let tagParam = await inquirer.prompt([
                {
                    type: 'input',
                    message: '输入版本号:',
                    name: 'tag',
                    default: newTage, // 默认值
                    validate (val) {
                        if (tages.all.includes(val)) {
                            return '版本号重复'
                        }
                        return true
                    },
                },
                {
                    type: 'input',
                    message: '输入更新信息：',
                    name: 'message',
                    validate(val){
                        if(!val){
                            return '请输入更新信息'
                        }
                        return true
                    },
                }
            ])
            
            spinner = ora('set tag and push remote').start()
            APP_CFG.APP_VERSION = tagParam.tag
            await git.tag(['-a',tagParam.tag,'-m',`"${tagParam.message}"`])
            // tag 提交到远端
            await git.push('--tags')
            spinner.stop()
        }
        async function gitTagFromOption(){
            spinner = ora('set tag and push remote').start()
            // APP_CFG.APP_VERSION = appOptions.annotate // 已经设置过了
            await git.tag(['-a',APP_CFG.APP_VERSION,'-m',`"${APP_CFG.APP_MESSAGE}"`])
            // tag 提交到远端
            await git.push('--tags')
            spinner.stop()
        }

        if(!ignoreCheck('gb')){
            await gitBranchCheck()
        }
        if(!ignoreCheck('gf')){
            await gitFetchOrigin()
        }
        if(!ignoreCheck('gd')){
            await gitDiffCheck()
        }
        if(!ignoreCheck('gt')){
            if(!appOptions.annotate || !appOptions.message){
                await gitTag()
            }else{
                await gitTagFromOption()
            }
        }
    }catch(e){
        // throw e
        spinner && spinner.stop()
        console.error(e) // message
        process.exit()
    }
}

async function npmOutdated(){
    if(ignoreCheck('no')) return
    
    console.log(`*** 依赖更新检查 ***`.blue.bgWhite,)

    let spinner = ora('npm outdated').start()
    try{
        let res = await getOutdatedDependencies()
        res = Object.keys(res).reduce((t,key,i)=>{
            if(res[key].wanted !== res[key].current){
                const row = [
                   res[key].name.red || '',
                   res[key].current.white || '',
                   res[key].wanted.green || '',
                   res[key].latest.magenta || '',
                   res[key].location || '',
                   res[key].dependent || '',
                ]

                t.push(row)
            }
            return t
        },[])
        spinner.stop()
        const head = ['name', 'current', 'wanted', 'latest',  'location', 'dependent by']
        const tableOpts = {
            align: ['l', 'r', 'r', 'r', 'l'],
            stringLength: s => ansiTrim(s).length,
        }
            
        if( Object.keys(res).length ){
            console.log('有依赖需要更新: '.yellow, logSymbols.warning)
            console.log(table([head].concat(res), tableOpts))
            const answers = await inquirer.prompt([{
                type: 'input',
                name: 'publish',
                message: [
                    `请回车退出ci发布程序，执行 ${'npm update'.yellow} 更新依赖并重新提交代码`,
                    `或者输入 publish 忽略依赖更新继续发布:`
                ].join('\n'),
                default: 'exit'
            }])
            
            if (answers.publish !== 'publish'){
                console.log(`\n退出发布，请执行${'npm update '.yellow}更新依赖并重新提交代码`)
                process.exit()
            }else{
                console.log('继续发布应用...')
            }
        }else{
            console.log('outdated check', logSymbols.success)
        }
        // console.log('****'.red,res)
    } catch(e){
        spinner.stop()
        throw e
    }
}

/**
 * Calls `npm outdated` to retrieve information about the outdated dependencies.
 *
 * @public
 * @param {NpmOptions} options - Options which shall be appened to the `npm outdated` command-line call.
 * @returns {Promise<OutdatedDependencies>} The original object returned by `npm outdated --json`.
 */
async function getOutdatedDependencies (options) {
	return new Promise((resolve, reject) => {
		exec([
			'npm outdated --json',
			'--long',
			// '--save false',
		].join(' '),
        { stdio: ['pipe', 'pipe', 'ignore']}, // 屏蔽io流
         (error, stdout) => {
			if (error && stdout.length === 0) {
				reject(error);

				return;
			}

			const response = parseResponse(stdout);

			if ('error' in response) {
				reject(response.error);

				return;
			}

			if (typeof response !== 'object' || response === null) {
				reject(new TypeError('npm did not respond with an object.'));
			}
            // stdout.write('\033c'); // 清除控制台

			resolve(prepareResponseObject(response));
		});
	});
}
/**
 * Adds missing properties to the dependencies object.
 *
 * @private
 * @param {{ readonly [dependencyName: string]: Partial<OutdatedDependency>; }} dependencies - The partial filled outdated dependency object.
 * @returns {{ [dependencyName: string]: OutdatedDependency; }} The enriched outdated dependency object.
 */
function prepareResponseObject (dependencies) {
	/** @type {{ [dependencyName: string]: OutdatedDependency; }} */
	const outdatedDependencies = {};

	for (const [name, dependency] of Object.entries(dependencies)) {
		// Adding the name, makes it easier to work with the dependency object.
		const outdatedDependency = {
			...dependency,
			name
		};

		for (const propertyName of ['current', 'wanted', 'latest', 'type']) {
			if (!(propertyName in outdatedDependency)) {
				outdatedDependency[propertyName] = '';
			}
		}

		/**
		 * Sometimes, npm returns an empty `location` string. So we add it.
		 *
		 * @todo We should try to resolve the path on the same way as npm is doing it.
		 *
		 * @see path.relative(process.cwd(), require.resolve(name));
		 * @see module.path
		 */
		if (!outdatedDependency.location) {
			outdatedDependency.location = `node_modules/${name}`;
		}

		outdatedDependencies[name] = /** @type {OutdatedDependency} */(outdatedDependency);
	}

	return outdatedDependencies;
}

/**
 * Parse the stdout of `npm outdated --json` and convert it into an `object`.
 *
 * @private
 * @param {string} stdout - Response of `npm outdated --json`.
 * @returns {any} The parsed response, or an `object` containing an `error` property.
 */
function parseResponse (stdout) {
	try {
		const response = JSON.parse(stdout || '{}');

		if (typeof response !== 'object' || response === null) {
			throw new Error('Unexpected JSON response');
		}

		return response;
	}
	catch (error) {
		if (error instanceof Error) {
			return {
				error: {
					message: error.message,
					stack: error.stack,
					source: stdout
				}
			};
		}

		return {
			message: (typeof error === 'string' ? error : 'Unknown error'),
			source: stdout
		};
	}
}
async function projBuildProcess() {
    if(ignoreCheck('b')) return
    console.log(`*** 编译微信小程序 ***`.blue.bgWhite,)
    // const spinner = ora('project building...')
    // spinner.start()
    // exec方法默认的最大允许输出到stdout和stderr的数据量不超过200K，如果超过了，子进程就会被杀死
    // await new Promise((resolve,reject)=>{
    //     exec(`npm run build:${APP_CFG.APP_PLATFORM}`, (error, stdout, stderr) => {
    //         resolve({error, stdout, stderr})
    //     })
    // }) 
    await new Promise((resolve,reject)=>{
        const build = spawn(process.platform === "win32" ? "npm.cmd" : "npm", ['run', `build:${APP_CFG.APP_PLATFORM}`], {
            stdio: [
                process.stdin, // Use parent’s stdin for child
                process.stdout, // Pipe child’s stdout to parent
                fs.openSync(presolve(APP_CFG.APP_ERR_PATH,'err.out'), 'w') // Direct child’s stderr to a file
            ]
        })
        build.on('exit', (code, signal) => { // signal 终止子进程的信号
            console.log('exit'.blue.bgWhite, code, signal)
            resolve({
                event:'exit',
                code, signal,
            })
        })
        build.on('disconnect', (code) => {
            console.log('disconnect'.blue.bgWhite, code)
            reject({
                event:'disconnect',
                code,
            })
        })
        build.on('error', (err) => {
            console.log('error'.blue.bgWhite, err)
            reject({
                event:'error',
                err,
            })
        })
    }) 
    // await delay(3000)
    // spinner.stop()
    console.log('编译完成')
}

async function weiXinCi(){
    if(ignoreCheck('ci')) return
    console.log(`*** 微信小程序ci发布 ***`.blue.bgWhite,)
    if(!isFile(presolve(APP_CFG.APP_PROJECT_PATH,'app.json'))){
        throw new Error(`找不到文件 ${presolve(APP_CFG.APP_PROJECT_PATH,'app.json')}`)
    }
    const ci = require('miniprogram-ci')
    const platform = requireJSON5(presolve(APP_CFG.APP_SRC_PATH,'manifest.json'))[APP_CFG.APP_PLATFORM]
    const robot = 1
    // todo
    const project = new ci.Project({
        appid: platform.appid,
        type: 'miniProgram',
        projectPath: APP_CFG.APP_PROJECT_PATH,
        privateKeyPath: APP_CFG.APP_PRIVATE_KEY_FILE,
        ignores: ['node_modules/**/*'],
    })
    console.log(`ci.Project`.blue.bgWhite,project)
    const uploadResult = await ci.upload({
        project,
        version: APP_CFG.APP_VERSION,
        desc: APP_CFG.APP_MESSAGE,
        setting:{ // https://developers.weixin.qq.com/miniprogram/dev/devtools/ci.html#编译设置
            es6:platform.setting,
            minify:platform.minified,
        },
        onProgressUpdate: console.log,
        robot,
    })
    
    if(!ignoreCheck('cs')){
        console.log(`完成应用代码上传`.blue.bgWhite,uploadResult)
        const destPath = presolve(APP_CFG.APP_SOURCEMAP_PATH, `source-map-${APP_CFG.APP_VERSION}.zip`) 
        const sourceMapRes = await ci.getDevSourceMap({
            project,
            robot,
            sourceMapSavePath: destPath
        })
        console.log(`sourceMap 路径：`.blue.bgWhite, destPath)
    }
}


/**
 * 
 * 
 */
const methods = {
    argvOptionParse:argvOptionParse,
    appCfgCheck:appCfgCheck,
    gitCheck:gitCheck,
    npmOutdated:npmOutdated,
    projBuild: projBuildProcess,
    ci:weiXinCi,
}

;
(async function main(){
    await methods.argvOptionParse()
    await methods.appCfgCheck()
    await methods.gitCheck()
    await methods.npmOutdated()
    await methods.projBuild()
    await methods.ci()
    console.log('\n','执行完成'.bold.black.bgWhite)
    process.exit()
})()