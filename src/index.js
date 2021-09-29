"use strict";

/**
 * 1. 命令行参数
 * 2. √ 命令行交互
 * 3. √ 执行编译
 *      3.1 √ child_process执行
 *      3.2 - cross-env / vue-cli-service - js 执行 
 *          // 不需要 vue-cli-service还是直接从命令行获取参数的 还是要通过child_process执行
 * 4. √ ci 配置
 * 5. sourceMap 保存
 * 6. √ git 对比
 * 7. √ 进度条
 * 8. √ 版本号自增加 版本号确认 git tag
 * 9. √ 依赖更新检查
 * 10. 打包npm 包
 * 11. code review class
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

// const ansiTrim = require('npm/lib/utils/ansi-trim.js')
const table = require('text-table')
// const styles = require('ansistyles')

const args = require('minimist')(process.argv.slice(2)) // 命令行参数解析 解析process.argv
// console.log('hello'.blue.bgWhite)

const ansiTrimRe = new RegExp('\x1b(?:\\[(?:\\d+[ABCDEFGJKSTm]|\\d+;\\d+[Hfm]|' +
          '\\d+;\\d+;\\d+m|6n|s|u|\\?25[lh])|\\w)', 'g')
const ansiTrim = str => str.replace(ansiTrimRe, '')

const APP_PLATFORM = 'mp-weixin'

let APP_VERSION = '0.0.0'

function delay(ms) {
    return new Promise((resolve, reject) => {
        setTimeout(resolve, ms);
    })
}

async function gitCheck(){
    console.log(`*** git 仓库检查 ***`.blue.bgWhite,)

    let spinner
    try{
        const options = {
            binary: 'git',
            maxConcurrentProcesses: 6,
        };

        // when setting all options in a single object
        const git = simpleGit(process.cwd(), options);
        // logSymbols
        // 在主分支上
        const branch = await git.branchLocal()
        spinner = ora('check branch is main or master').start()
        if(branch.current != 'main' && branch.current != 'master'){
            let msg = `branch is ${branch.current.cyan} not main or master`
            spinner.stop()
            console.log(msg,logSymbols.error)
            throw new Error(msg)
        }
        spinner.stop()
        console.log('branch is '+ branch.current,logSymbols.success)

        // 获取更新远端跟踪分支
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

        // 检查当前分支已提交到远端
        const diff = await git.diff('remotes/origin/'+branch.current)
        spinner = ora('check idff').start()
        if(diff){
            let msg = `There are file that have not been commit`
            spinner.stop()
            console.log(msg,logSymbols.error)
            throw new Error(msg)
        }
        spinner.stop()
        console.log(`diff remotes/origin/${branch.current} ok`,logSymbols.success)

        
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
        APP_VERSION = tagParam.tag
        await git.tag(['-a',tagParam.tag,'-m',`"${tagParam.message}"`])
        // tag 提交到远端
        await git.push('--tags')
        spinner.stop()
    }catch(e){
        // throw e
        console.error(e) // message
        process.exit()
    }
}

async function npmOutdated(){
    
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
    console.log(`*** 编译微信小程序 ***`.blue.bgWhite,)
    // const spinner = ora('project building...')
    // spinner.start()
    // exec方法默认的最大允许输出到stdout和stderr的数据量不超过200K，如果超过了，子进程就会被杀死
    // await new Promise((resolve,reject)=>{
    //     exec(`npm run build:${APP_PLATFORM}`, (error, stdout, stderr) => {
    //         resolve({error, stdout, stderr})
    //     })
    // }) 
    await new Promise((resolve,reject)=>{
        const build = spawn(process.platform === "win32" ? "npm.cmd" : "npm", ['run', `build:${APP_PLATFORM}`], {
            stdio: [
                process.stdin, // Use parent’s stdin for child
                process.stdout, // Pipe child’s stdout to parent
                fs.openSync('./outinfo/err.out', 'w') // Direct child’s stderr to a file
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
    // console.log('')
}

async function weiXinCi(){
    console.log(`*** 微信小程序ci发布 ***`.blue.bgWhite,)
    const ci = require('miniprogram-ci')
    const platform = requireJSON5('./src/manifest.json')[APP_PLATFORM]
    const robot = 1
    // todo
    const project = new ci.Project({
        appid: platform.appid,
        type: 'miniProgram',
        projectPath: 'dist/dev/mp-weixin',
        privateKeyPath: 'keys/wx-private.key',
        ignores: ['node_modules/**/*'],
    })
    console.log(`ci.Project`.blue.bgWhite,project)
    const uploadResult = await ci.upload({
        project,
        version: '0.0.3',
        desc: 'hello',
        setting:{ // https://developers.weixin.qq.com/miniprogram/dev/devtools/ci.html#编译设置
            es6:platform.setting,
            minify:platform.minified,
        },
        onProgressUpdate: console.log,
        robot,
    })
    console.log(`完成应用代码上传`.blue.bgWhite,uploadResult)
    const destPath = `./outinfo/source-map-${APP_VERSION}.zip`
    const sourceMapRes = await ci.getDevSourceMap({
        project,
        robot,
        sourceMapSavePath: destPath
    })
    console.log(`sourceMap 路径：`.blue.bgWhite, destPath)
}


/**
 * 
 * 
 */
const methods = {
    gitCheck:gitCheck,
    npmOutdated:npmOutdated,
    projBuild: projBuildProcess,
    ci:weiXinCi,
}

;
(async function main(){
    await methods.gitCheck()
    await methods.npmOutdated()
    await methods.projBuild()
    await methods.ci()
    console.log('应用发布完成'.bold)
})()