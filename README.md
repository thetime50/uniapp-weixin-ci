# uniapp-weixin-ci
uniapp-weixin-ci unixpp自动编译 发布微信小程序

[![View UI](https://img.shields.io/npm/v/uniapp-weixin-ci.svg?style=flat)](https://www.npmjs.org/package/uniapp-weixin-ci)


## Stargazers over time

[![Stargazers over time](https://starchart.cc/thetime50/uniapp-weixin-ci.svg)](https://starchart.cc/thetime50/uniapp-weixin-ci)

## 功能

- [x] 小程序编译项目
- [x] git仓库提交检查
- [x] 版本号自增加 版本号确认
- [x] 依赖更新检查
- [x] ci 上传代码
- [x] sourceMap 保存
- [x] 命令行参数控制
- [ ] 配置文件控制
- [ ] 单元测试

## 参考项目
[uniapp-ci](https://github.com/thetime50/uniapp-ci)

## 使用方法

[使用 uniapp cli 初始化项目](https://uniapp.dcloud.io/quickstart-cli)

```cmd
npm install -D uniapp-weixin-ci
```

配置 /src/manifest.json 小程序appid  
参考文件 /src/manifest.json.back
```json5
{
	"mp-weixin": { /* 微信小程序特有相关 */
		"appid": "wx6666666666666666",
    }
}
```

在小程序后台 开发-> 开发管理 -> 开发设置  
在小程序代码上传模块中 获取密钥 并 配置ip白名单  
密钥路径 /keys/wx-private.key  
格式参考 /keys/wx-private.key.back

运行 <code>npm run wxci-publish</code> 发布小程序
```cmd
npm run wxci-publish
:: or
npx wxci-publish
```

```cmd
> npx wxci-publish -h

Usage: index [options]

Options:
  -V, --version                  output the version number
  -a, --annotate <string>        tag 名称 版本号 (default: "")
  -m, --message <string>         版本更新信息 (default: "")
  -b, --branch <string>          选择分支 (default: "")
  -ep --err-path <path>          错误文件目录 (default: "")
  -smp --sourcemap-path <path>   sourcemap 文件目录 (default: "")
  -sp --src-path <path>          uniapp 项目目录 (default: "")
  -kf --private-key-file <file>  miniprogram-ci 微信小程序ci代码上传密钥文件 (default: "")
  -pp --project-path <path>      微信小程序目录，uniapp 编译后的目录 (default: "")  
  -i, --ignore <type...>         跳过的操作步骤:
          git: 跳过所有git操作
          gb: 跳过git branch 检查
          gf: 跳过git fetch origin
          gd: 跳过git diff
          gt: 跳过git tag

          build/b: 跳过npm run build:mp-weixin 编译小程序

          ci: 跳过所有ci操作 (上传 下载sourceMap)
          cs: 跳过下载sourceMap
       (default: {})
  -no --npm-outdated             开启npm outdated依赖更新检查 (default: false)
  -h, --help                     display help for command
  ```
